import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { prisma } from './db/prisma.js';
import { redisClient } from './config/redis.js';
import { initElasticsearch } from './config/elasticsearch.js';
import { serverAdapter, adminAuthMiddleware } from './queues/bullBoard.js';
import { startEmailWorker } from './workers/emailWorker.js';
import { runStartupRecovery } from './recovery/startupRecovery.js';
import { etherealService } from './services/etherealService.js';
import { authRouter } from './routes/authRoutes.js';
import { emailRouter } from './routes/emailRoutes.js';
import { senderRouter } from './routes/senderRoutes.js';
import { slackRouter } from './routes/slackRoutes.js';
import { emailQueue } from './queues/emailQueue.js';

const app = express();

// Trust reverse proxy in production (Render, Nginx, Cloudflare)
app.set('trust proxy', 1);

// Middlewares
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl) or matching allowed origins
      if (
        !origin ||
        origin === env.FRONTEND_URL ||
        origin.endsWith('.vercel.app') ||
        origin.endsWith('.onrender.com') ||
        origin.includes('localhost')
      ) {
        callback(null, true);
      } else {
        callback(null, true); // Permissive for production deployment
      }
    },
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Bull Board Queue Dashboard mounted at /admin/queues
app.use('/admin/queues', adminAuthMiddleware, serverAdapter.getRouter());

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/emails', emailRouter);
app.use('/api/senders', senderRouter);
app.use('/api/slack', slackRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled server error:', err.stack || err.message);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

async function bootstrap() {
  try {
    logger.info('🚀 Bootstrapping Email Scheduler Backend...');

    // 1. Initialize Elasticsearch index
    await initElasticsearch();

    // 2. Seed Ethereal sender accounts if table is empty
    await etherealService.seedSenderAccounts(3);

    // 3. Run crash & restart recovery on startup
    await runStartupRecovery();

    // 4. Start BullMQ worker process
    const worker = startEmailWorker();
    logger.info(`Email dispatch worker started with concurrency ${env.WORKER_CONCURRENCY}`);

    // 5. Start HTTP server
    const server = app.listen(env.PORT, () => {
      logger.info(`✨ Server running on http://localhost:${env.PORT}`);
      logger.info(`📊 Bull Board Queue Dashboard available at http://localhost:${env.PORT}/admin/queues`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        await worker.close();
        await emailQueue.close();
        await redisClient.quit();
        await prisma.$disconnect();
        logger.info('Clean shutdown complete.');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (err: any) {
    logger.error('Fatal bootstrap error:', err);
    process.exit(1);
  }
}

bootstrap();

