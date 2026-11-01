import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { emailQueue } from '../queues/emailQueue.js';
import { elasticsearchService } from '../services/elasticsearchService.js';
import { logger } from '../utils/logger.js';

export const scheduleEmailSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Email body is required'),
  recipients: z.array(z.string().email('Invalid email address')).min(1, 'At least one recipient required'),
  startTime: z.string().or(z.date()).transform((val) => new Date(val)),
  delayBetweenSec: z.number().int().min(0).default(2),
  hourlyLimit: z.number().int().positive().optional(),
});

export const emailController = {
  async scheduleEmails(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { subject, body, recipients, startTime, delayBetweenSec, hourlyLimit } = req.body;
    const userId = req.user.id;

    const baseTimeMs = Math.max(Date.now(), startTime.getTime());

    try {
      // 1. Create Campaign record
      const campaign = await prisma.campaign.create({
        data: {
          userId,
          subject,
          body,
          totalLeads: recipients.length,
          delayBetweenSec,
          hourlyLimit: hourlyLimit || null,
          startTime: new Date(baseTimeMs),
        },
      });

      // 2. Prepare Email records
      const emailCreateData = recipients.map((recipient: string, index: number) => {
        const scheduledTimeMs = baseTimeMs + index * delayBetweenSec * 1000;
        return {
          userId,
          campaignId: campaign.id,
          recipient: recipient.trim().toLowerCase(),
          subject,
          body,
          status: 'SCHEDULED' as const,
          scheduledAt: new Date(scheduledTimeMs),
        };
      });

      // Insert all email records in batches
      const createdEmails = await prisma.$transaction(
        emailCreateData.map((data: any) => prisma.email.create({ data }))
      );

      // 3. Dispatch BullMQ delayed jobs & index in Elasticsearch
      const jobPromises = createdEmails.map((email: any, index: number) => {
        const delayMs = Math.max(0, email.scheduledAt.getTime() - Date.now());

        // Index in Elasticsearch (non-blocking)
        elasticsearchService.indexEmail({
          id: email.id,
          userId,
          campaignId: campaign.id,
          recipient: email.recipient,
          subject: email.subject,
          body: email.body,
          status: email.status,
          scheduledAt: email.scheduledAt,
          createdAt: email.createdAt,
        });

        // Add delayed BullMQ job with email.id as unique jobId
        return emailQueue.add(
          'send-email',
          {
            emailId: email.id,
            campaignId: campaign.id,
            userId,
            campaignOrderIndex: index,
            delayBetweenSec,
            hourlyLimit: hourlyLimit || undefined,
            originalScheduledAt: email.scheduledAt.toISOString(),
          },
          {
            jobId: email.id,
            delay: delayMs,
          }
        );
      });

      await Promise.all(jobPromises);

      logger.info(
        `Scheduled campaign ${campaign.id} with ${createdEmails.length} email(s) for user ${userId}`
      );

      res.status(201).json({
        success: true,
        campaignId: campaign.id,
        totalScheduled: createdEmails.length,
        firstScheduledAt: createdEmails[0]?.scheduledAt,
        lastScheduledAt: createdEmails[createdEmails.length - 1]?.scheduledAt,
      });
    } catch (err: any) {
      logger.error('Failed to schedule emails:', err.message);
      res.status(500).json({ error: `Failed to schedule emails: ${err.message}` });
    }
  },

  async getScheduled(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const where: any = {
      userId: req.user.id,
      status: 'SCHEDULED',
    };

    const [total, emails] = await Promise.all([
      prisma.email.count({ where }),
      prisma.email.findMany({
        where,
        orderBy: { scheduledAt: 'asc' },
        skip,
        take: limit,
        include: {
          sender: { select: { email: true } },
        },
      }),
    ]);

    res.json({
      emails,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  },

  async getSent(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;
    const statusParam = req.query.status as string;

    const where: any = {
      userId: req.user.id,
      status: statusParam ? statusParam.toUpperCase() : { in: ['SENT', 'FAILED'] },
    };

    const [total, emails] = await Promise.all([
      prisma.email.count({ where }),
      prisma.email.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        include: {
          sender: { select: { email: true } },
        },
      }),
    ]);

    res.json({
      emails,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  },

  async getStats(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const [scheduled, sent, failed] = await Promise.all([
      prisma.email.count({ where: { userId: req.user.id, status: 'SCHEDULED' } }),
      prisma.email.count({ where: { userId: req.user.id, status: 'SENT' } }),
      prisma.email.count({ where: { userId: req.user.id, status: 'FAILED' } }),
    ]);

    res.json({
      scheduled,
      sent,
      failed,
      total: scheduled + sent + failed,
    });
  },

  async getById(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const id = String(req.params.id);
    const email = await prisma.email.findFirst({
      where: { id, userId: req.user.id },
      include: {
        sender: { select: { email: true } },
        campaign: true,
      },
    });

    if (!email) {
      res.status(404).json({ error: 'Email not found' });
      return;
    }

    res.json(email);
  },

  async search(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const query = (req.query.q as string) || '';
    const status = req.query.status as string;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 20));
    const from = (page - 1) * limit;

    // First attempt search via Elasticsearch
    const esResult = await elasticsearchService.searchEmails(
      req.user.id,
      query,
      status,
      from,
      limit
    );

    if (esResult.emails.length > 0 || esResult.total > 0) {
      res.json({
        source: 'elasticsearch',
        emails: esResult.emails,
        pagination: {
          page,
          limit,
          total: esResult.total,
          totalPages: Math.ceil(esResult.total / limit),
        },
      });
      return;
    }

    // Fallback search via Postgres
    const where: any = {
      userId: req.user.id,
      ...(status ? { status: status.toUpperCase() } : {}),
    };

    if (query.trim()) {
      where.OR = [
        { recipient: { contains: query.trim(), mode: 'insensitive' } },
        { subject: { contains: query.trim(), mode: 'insensitive' } },
        { body: { contains: query.trim(), mode: 'insensitive' } },
      ];
    }

    const [total, emails] = await Promise.all([
      prisma.email.count({ where }),
      prisma.email.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: from,
        take: limit,
        include: { sender: { select: { email: true } } },
      }),
    ]);

    res.json({
      source: 'database',
      emails,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  },
};
