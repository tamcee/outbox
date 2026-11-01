import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const envSchema = z.object({
  PORT: z.string().default('5001').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),

  // Database
  DATABASE_URL: z.string(),

  // Redis
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().default('6379').transform(Number),
  REDIS_PASSWORD: z.string().optional().default(''),

  // Elasticsearch
  ELASTICSEARCH_NODE: z.string().default('http://localhost:9200'),

  // Auth & Sessions
  JWT_SECRET: z.string().default('super-secret-jwt-key-change-in-production'),
  SESSION_COOKIE_NAME: z.string().default('email_scheduler_token'),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
  GOOGLE_CALLBACK_URL: z.string().default('http://localhost:5000/api/auth/google/callback'),

  // Slack OAuth
  SLACK_CLIENT_ID: z.string().optional().default(''),
  SLACK_CLIENT_SECRET: z.string().optional().default(''),
  SLACK_REDIRECT_URI: z.string().default('http://localhost:5000/api/slack/callback'),

  // Scheduling & Throttling
  MAX_EMAILS_PER_HOUR_PER_SENDER: z.string().default('100').transform(Number),
  MIN_DELAY_PER_SENDER_MS: z.string().default('2000').transform(Number),
  WORKER_CONCURRENCY: z.string().default('5').transform(Number),

  // Bull Board
  ADMIN_PASSWORD: z.string().default('adminsecret'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
