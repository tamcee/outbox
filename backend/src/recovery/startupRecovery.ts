import { prisma } from '../db/prisma.js';
import { emailQueue } from '../queues/emailQueue.js';
import { logger } from '../utils/logger.js';

export async function runStartupRecovery(): Promise<void> {
  logger.info('Running startup recovery check for scheduled & in-flight emails...');

  try {
    // 1. Recover stuck 'PROCESSING' emails (e.g. from a sudden crash/restart while sending)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const stuckEmails = await prisma.email.findMany({
      where: {
        status: 'PROCESSING',
        updatedAt: { lt: fiveMinutesAgo },
      },
      include: { campaign: true },
    });

    if (stuckEmails.length > 0) {
      logger.warn(`Found ${stuckEmails.length} stuck PROCESSING email(s). Resetting to SCHEDULED...`);
      for (const email of stuckEmails) {
        await prisma.email.update({
          where: { id: email.id },
          data: { status: 'SCHEDULED' },
        });

        const existingJob = await emailQueue.getJob(email.id);
        if (!existingJob) {
          await emailQueue.add(
            'send-email',
            {
              emailId: email.id,
              campaignId: email.campaignId ?? undefined,
              userId: email.userId,
              campaignOrderIndex: 0,
              delayBetweenSec: email.campaign?.delayBetweenSec ?? 2,
              hourlyLimit: email.campaign?.hourlyLimit ?? undefined,
              originalScheduledAt: email.scheduledAt.toISOString(),
            },
            {
              jobId: email.id,
              delay: 0,
            }
          );
        }
      }
    }

    // 2. Recover all 'SCHEDULED' emails missing from the queue
    const scheduledEmails = await prisma.email.findMany({
      where: { status: 'SCHEDULED' },
      include: { campaign: true },
    });

    let recoveredCount = 0;
    for (const email of scheduledEmails) {
      const existingJob = await emailQueue.getJob(email.id);
      if (!existingJob) {
        const remainingDelay = Math.max(0, email.scheduledAt.getTime() - Date.now());
        await emailQueue.add(
          'send-email',
          {
            emailId: email.id,
            campaignId: email.campaignId ?? undefined,
            userId: email.userId,
            campaignOrderIndex: 0,
            delayBetweenSec: email.campaign?.delayBetweenSec ?? 2,
            hourlyLimit: email.campaign?.hourlyLimit ?? undefined,
            originalScheduledAt: email.scheduledAt.toISOString(),
          },
          {
            jobId: email.id,
            delay: remainingDelay,
          }
        );
        recoveredCount++;
      }
    }

    logger.info(
      `Startup recovery finished. Checked ${scheduledEmails.length} SCHEDULED emails, recovered ${recoveredCount} missing queue job(s).`
    );
  } catch (err: any) {
    logger.error('Error during startup recovery:', err.message);
  }
}

