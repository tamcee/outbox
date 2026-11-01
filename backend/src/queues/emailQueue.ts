import { Queue } from 'bullmq';
import { redisConnectionOptions } from '../config/redis.js';
import { logger } from '../utils/logger.js';

export const EMAIL_QUEUE_NAME = 'email-dispatch-queue';

export interface EmailJobData {
  emailId: string;
  campaignId?: string;
  userId: string;
  campaignOrderIndex: number;
  delayBetweenSec: number;
  hourlyLimit?: number;
  originalScheduledAt: string;
}

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: redisConnectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 3000,
    },
    removeOnComplete: false,
    removeOnFail: false,
  },
});

emailQueue.on('error', (err: any) => {
  logger.error('BullMQ EmailQueue error:', err?.message || err);
});


