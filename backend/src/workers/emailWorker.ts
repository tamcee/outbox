import { Worker, Job, DelayedError } from 'bullmq';
import { EMAIL_QUEUE_NAME, EmailJobData } from '../queues/emailQueue.js';
import { redisConnectionOptions } from '../config/redis.js';
import { env } from '../config/env.js';
import { prisma } from '../db/prisma.js';
import { etherealService } from '../services/etherealService.js';
import {
  rateLimitService,
  getNextHourWindowStart,
} from '../services/rateLimitService.js';
import { slackService } from '../services/slackService.js';
import { elasticsearchService } from '../services/elasticsearchService.js';
import { logger } from '../utils/logger.js';
import crypto from 'crypto';

const workerInstanceId = `worker-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;

export function startEmailWorker(): Worker<EmailJobData> {
  const worker = new Worker<EmailJobData>(
    EMAIL_QUEUE_NAME,
    async (job: Job<EmailJobData>, token?: string) => {
      const {
        emailId,
        userId,
        campaignOrderIndex,
        delayBetweenSec,
        hourlyLimit,
      } = job.data;

      // 1. Fetch email record from DB to verify it exists and is still SCHEDULED
      const emailRecord = await prisma.email.findUnique({
        where: { id: emailId },
      });

      if (!emailRecord || emailRecord.status !== 'SCHEDULED') {
        logger.info(`Job ${job.id}: Email is not in SCHEDULED state (current: ${emailRecord?.status ?? 'missing'}). Skipping.`);
        return;
      }

      // 2. Select next available sender using round-robin, skipping any at their hourly limit
      const selected = await rateLimitService.selectAvailableSender(hourlyLimit);

      if (!selected) {
        // All active senders are currently at their hourly limit for this window.
        // Spill over to the start of the next hour window.
        const nextHour = getNextHourWindowStart();
        // Offset using original campaign order index so dispatch sequence is preserved
        const offsetMs = (campaignOrderIndex || 0) * (delayBetweenSec || 2) * 1000;
        const delayedUntil = nextHour.getTime() + offsetMs;

        logger.warn(
          `All senders capped. Spilling job ${job.id} over to next hour (${new Date(delayedUntil).toISOString()}).`
        );

        // Update scheduledAt in DB
        await prisma.email.update({
          where: { id: emailId },
          data: { scheduledAt: new Date(delayedUntil) },
        });

        if (token) {
          await job.moveToDelayed(delayedUntil, token);
          throw new DelayedError();
        }
        return;
      }

      const { sender, limit } = selected;

      // 3. Atomically reserve hourly slot for this sender
      const slotReserved = await rateLimitService.tryReserveHourlySlot(sender.id, limit);
      if (!slotReserved) {
        // Sender hit rate limit right as we checked. Check if we should alert on Slack
        const shouldAlert = await rateLimitService.shouldTriggerSlackAlert(sender.id);
        if (shouldAlert) {
          const nextHour = getNextHourWindowStart();
          await slackService.notifyRateLimitExceeded(userId, sender.email, limit, nextHour);
        }

        // Reschedule job to next hour
        const nextHour = getNextHourWindowStart();
        const offsetMs = (campaignOrderIndex || 0) * (delayBetweenSec || 2) * 1000;
        const delayedUntil = nextHour.getTime() + offsetMs;

        await prisma.email.update({
          where: { id: emailId },
          data: { scheduledAt: new Date(delayedUntil) },
        });

        if (token) {
          await job.moveToDelayed(delayedUntil, token);
          throw new DelayedError();
        }
        return;
      }

      // 4. Check & acquire minimum delay lock between sends for this sender
      const lock = await rateLimitService.acquireSenderDelayLock(sender.id, workerInstanceId);
      if (!lock.acquired) {
        // Lock taken by another job/worker. Jitter delay to prevent thundering herd
        const jitterMs = Math.floor(Math.random() * 500) + 100;
        const retryDelay = lock.remainingMs + jitterMs;

        logger.debug(
          `Sender ${sender.email} locked. Retrying job ${job.id} in ${retryDelay}ms.`
        );

        if (token) {
          await job.moveToDelayed(Date.now() + retryDelay, token);
          throw new DelayedError();
        }
        return;
      }

      // 5. ATOMIC DB state transition: 'SCHEDULED' -> 'PROCESSING'
      const updateResult = await prisma.email.updateMany({
        where: { id: emailId, status: 'SCHEDULED' },
        data: {
          status: 'PROCESSING',
          senderId: sender.id,
        },
      });

      if (updateResult.count === 0) {
        logger.warn(`Job ${job.id}: Race condition detected. Email ${emailId} was not updated (count: 0). Skipping send.`);
        return;
      }

      // 6. Send the email via Nodemailer Ethereal
      logger.info(`Sending email ${emailId} to ${emailRecord.recipient} via sender ${sender.email}...`);

      try {
        const { previewUrl } = await etherealService.sendEmail(sender, {
          to: emailRecord.recipient,
          subject: emailRecord.subject,
          body: emailRecord.body,
        });

        const url = typeof previewUrl === 'string' ? previewUrl : null;
        const sentAt = new Date();

        await prisma.email.update({
          where: { id: emailId },
          data: {
            status: 'SENT',
            sentAt,
            previewUrl: url,
            errorMessage: null,
          },
        });

        await elasticsearchService.updateEmailStatus(emailId, 'SENT', sentAt);

        logger.info(`✅ Email ${emailId} SENT successfully! Preview: ${url ?? 'N/A'}`);
      } catch (err: any) {
        logger.error(`❌ Failed to send email ${emailId}:`, err.message);

        await prisma.email.update({
          where: { id: emailId },
          data: {
            status: 'FAILED',
            errorMessage: err.message,
          },
        });

        await elasticsearchService.updateEmailStatus(emailId, 'FAILED', null);
        throw err;
      }
    },
    {
      connection: redisConnectionOptions,
      concurrency: env.WORKER_CONCURRENCY,
    }
  );

  worker.on('failed', (job, err) => {
    // If it's a DelayedError, it is expected when job is moved to delayed
    if (err.name === 'DelayedError') {
      return;
    }
    logger.error(`Worker job ${job?.id} failed:`, err.message);
  });

  worker.on('completed', (job) => {
    logger.debug(`Worker job ${job.id} completed.`);
  });

  return worker;
}

