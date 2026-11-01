import { Redis, RedisOptions } from 'ioredis';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

function getRedisConfig(): RedisOptions {
  if (env.REDIS_URL) {
    try {
      const parsed = new URL(env.REDIS_URL);
      const isTls = parsed.protocol === 'rediss:';
      return {
        host: parsed.hostname,
        port: parsed.port ? parseInt(parsed.port, 10) : 6379,
        username: parsed.username || undefined,
        password: parsed.password || undefined,
        tls: isTls ? {} : undefined,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      };
    } catch (e: any) {
      logger.warn('Failed to parse REDIS_URL, falling back to host/port:', e.message);
    }
  }

  return {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
}

export const redisConnectionOptions: RedisOptions = getRedisConfig();

export const redisClient = new Redis(redisConnectionOptions);

redisClient.on('connect', () => {
  logger.info('Connected to Redis');
});

redisClient.on('error', (err: any) => {
  logger.error('Redis connection error:', err.message);
});
