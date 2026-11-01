import { Redis, RedisOptions } from 'ioredis';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

function parseRedisUrl(input?: string): Partial<RedisOptions> | null {
  let str = (input || '').trim().replace(/^["']|["']$/g, '').trim();
  if (!str) return null;

  // Auto-prepend scheme if missing
  if (!str.startsWith('redis://') && !str.startsWith('rediss://')) {
    if (str.includes(':6380') || str.includes('rediss') || str.includes('ssl=true')) {
      str = 'rediss://' + str;
    } else {
      str = 'redis://' + str;
    }
  }

  try {
    const parsed = new URL(str);
    const isTls = parsed.protocol === 'rediss:';
    return {
      host: parsed.hostname,
      port: parsed.port ? parseInt(parsed.port, 10) : (isTls ? 6380 : 6379),
      username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
      password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
      tls: isTls ? { rejectUnauthorized: false } : undefined,
    };
  } catch (urlErr) {
    // Regex fallback in case password contains unescaped special characters (e.g. # or @)
    const regex = /^(rediss?):\/\/(?:([^:]*)(?::(.*))?@)?([^:\/?#]+)(?::([0-9]+))?/;
    const match = str.match(regex);
    if (match) {
      const isTls = match[1] === 'rediss';
      return {
        host: match[4],
        port: match[5] ? parseInt(match[5], 10) : (isTls ? 6380 : 6379),
        username: match[2] ? decodeURIComponent(match[2]) : undefined,
        password: match[3] ? decodeURIComponent(match[3]) : undefined,
        tls: isTls ? { rejectUnauthorized: false } : undefined,
      };
    }
    throw urlErr;
  }
}

function getRedisConfig(): RedisOptions {
  if (env.REDIS_URL) {
    try {
      const parsed = parseRedisUrl(env.REDIS_URL);
      if (parsed && parsed.host) {
        logger.info(`Parsed REDIS_URL -> target: ${parsed.host}:${parsed.port} (TLS: ${Boolean(parsed.tls)})`);
        return {
          host: parsed.host,
          port: parsed.port,
          username: parsed.username,
          password: parsed.password,
          tls: parsed.tls,
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
          retryStrategy(times) {
            return Math.min(times * 300, 5000);
          },
        };
      }
    } catch (e: any) {
      logger.warn('Failed to parse REDIS_URL, falling back to REDIS_HOST/PORT:', e?.message || e);
    }
  }

  if (env.NODE_ENV === 'production' && env.REDIS_HOST === 'localhost') {
    logger.warn('⚠️ Redis is configured to connect to localhost in production. Please set REDIS_URL in your deployment environment variables (e.g. Upstash, Redis Cloud, or Render Redis).');
  }

  return {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times) {
      return Math.min(times * 300, 5000);
    },
  };
}

export const redisConnectionOptions: RedisOptions = getRedisConfig();

export const redisClient = new Redis(redisConnectionOptions);

redisClient.on('connect', () => {
  logger.info(`Connected to Redis at ${redisConnectionOptions.host}:${redisConnectionOptions.port}`);
});

redisClient.on('error', (err: any) => {
  const errMsg = err?.message || err?.code || String(err);
  logger.error(`Redis connection error (${redisConnectionOptions.host}:${redisConnectionOptions.port}):`, errMsg);
});
