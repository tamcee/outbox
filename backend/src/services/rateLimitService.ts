import { redisClient } from '../config/redis.js';
import { env } from '../config/env.js';
import { prisma } from '../db/prisma.js';
import { logger } from '../utils/logger.js';
import type { SenderAccount } from '@prisma/client';

// Atomic Lua script: only increments if under maxLimit.
// Returns -1 if limit reached (never increments, preventing inflation).
const CHECK_AND_INCR_LUA = `
local current = redis.call('GET', KEYS[1])
if current and tonumber(current) >= tonumber(ARGV[1]) then
  return -1
end
local val = redis.call('INCR', KEYS[1])
if val == 1 then
  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
end
return val
`;

export function getHourKey(senderId: string, date: Date = new Date()): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  return `rate:${senderId}:${yyyy}${mm}${dd}${hh}`;
}

export function getNextHourWindowStart(date: Date = new Date()): Date {
  const next = new Date(date);
  next.setUTCMinutes(0, 0, 0);
  next.setUTCHours(next.getUTCHours() + 1);
  return next;
}

export const rateLimitService = {
  /**
   * Tries to atomically increment the hourly counter for a sender.
   * Returns true if slot reserved, false if limit exceeded.
   */
  async tryReserveHourlySlot(senderId: string, hourlyLimit: number): Promise<boolean> {
    const key = getHourKey(senderId);
    const ttlSeconds = 7200; // 2 hours

    try {
      const res = (await redisClient.eval(
        CHECK_AND_INCR_LUA,
        1,
        key,
        hourlyLimit.toString(),
        ttlSeconds.toString()
      )) as number;

      return res > 0;
    } catch (err: any) {
      logger.error(`Error in tryReserveHourlySlot for sender ${senderId}:`, err.message);
      return true; // Fallback to allow if Redis issue
    }
  },

  /**
   * Checks current hourly count for a sender.
   */
  async getHourlyCount(senderId: string): Promise<number> {
    const key = getHourKey(senderId);
    const val = await redisClient.get(key);
    return val ? parseInt(val, 10) : 0;
  },

  /**
   * Selects the next available sender by rotating round-robin across all active senders,
   * skipping any sender that has reached its hourly limit.
   */
  async selectAvailableSender(
    customHourlyLimit?: number | null
  ): Promise<{ sender: SenderAccount; limit: number } | null> {
    const activeSenders = await prisma.senderAccount.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    if (activeSenders.length === 0) {
      return null;
    }

    const defaultLimit = env.MAX_EMAILS_PER_HOUR_PER_SENDER;
    const limit = customHourlyLimit && customHourlyLimit > 0 ? customHourlyLimit : defaultLimit;

    // Increment round-robin index
    const rawIndex = await redisClient.incr('sender:round_robin:index');
    const startIndex = Math.abs(rawIndex) % activeSenders.length;

    // Scan through all senders starting from rotated index
    for (let i = 0; i < activeSenders.length; i++) {
      const candidate = activeSenders[(startIndex + i) % activeSenders.length];
      const count = await this.getHourlyCount(candidate.id);
      if (count < limit) {
        return { sender: candidate, limit };
      }
    }

    return null; // All senders currently at hourly limit
  },

  /**
   * Tries to acquire sender min-delay lock.
   * Returns { acquired: true } or { acquired: false, remainingMs: number }
   */
  async acquireSenderDelayLock(
    senderId: string,
    workerId: string
  ): Promise<{ acquired: boolean; remainingMs: number }> {
    const lockKey = `lock:sender:${senderId}`;
    const minDelayMs = env.MIN_DELAY_PER_SENDER_MS;

    try {
      const result = await redisClient.set(lockKey, workerId, 'PX', minDelayMs, 'NX');
      if (result === 'OK') {
        return { acquired: true, remainingMs: 0 };
      }

      const pttl = await redisClient.pttl(lockKey);
      return { acquired: false, remainingMs: Math.max(100, pttl) };
    } catch (err: any) {
      logger.error(`Error acquiring sender delay lock for ${senderId}:`, err.message);
      return { acquired: true, remainingMs: 0 };
    }
  },

  /**
   * Checks whether a Slack rate-limit alert should be sent (once per sender per hour window).
   * Returns true if this is the first alert this hour for this sender.
   */
  async shouldTriggerSlackAlert(senderId: string): Promise<boolean> {
    const yyyyMmDdHh = getHourKey(senderId).split(':').slice(2).join(':');
    const alertKey = `slack:alert:${senderId}:${yyyyMmDdHh}`;

    const res = await redisClient.set(alertKey, '1', 'EX', 7200, 'NX');
    return res === 'OK';
  },
};

