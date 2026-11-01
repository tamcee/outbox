import { Request, Response } from 'express';
import { slackService } from '../services/slackService.js';
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import axios from 'axios';

export const slackController = {
  getConnectUrl(req: Request, res: Response): void {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!env.SLACK_CLIENT_ID || !env.SLACK_CLIENT_SECRET) {
      res.status(400).json({
        error: 'Slack credentials not configured in backend .env',
      });
      return;
    }

    // Pass user ID as state so we know which user connected
    const state = req.user.id;
    const url = slackService.getAuthUrl(state);
    res.json({ url });
  },

  async handleCallback(req: Request, res: Response): Promise<void> {
    const code = req.query.code as string;
    const state = req.query.state as string; // userId

    if (!code) {
      res.redirect(`${env.FRONTEND_URL}/?slack=error_no_code`);
      return;
    }

    try {
      const webhookData = await slackService.exchangeCodeForWebhook(code);

      if (state) {
        await prisma.user.update({
          where: { id: state },
          data: {
            slackWebhookUrl: webhookData.webhookUrl,
            slackChannel: webhookData.channel,
            slackTeamName: webhookData.teamName,
          },
        });
      }

      logger.info(`Slack connected successfully for user ${state} (#${webhookData.channel})`);
      res.redirect(`${env.FRONTEND_URL}/?slack=connected`);
    } catch (err: any) {
      logger.error('Slack OAuth callback error:', err.message);
      res.redirect(`${env.FRONTEND_URL}/?slack=error`);
    }
  },

  async disconnect(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        slackWebhookUrl: null,
        slackChannel: null,
        slackTeamName: null,
      },
    });

    res.json({ success: true, message: 'Slack disconnected' });
  },

  async sendTestNotification(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { slackWebhookUrl: true, slackChannel: true },
    });

    if (!user?.slackWebhookUrl) {
      res.status(400).json({ error: 'Slack not connected' });
      return;
    }

    try {
      await axios.post(user.slackWebhookUrl, {
        text: '🚀 *Email Scheduler Test Alert*: Slack integration is live and working properly!',
      });
      res.json({ success: true, message: 'Test message sent to Slack' });
    } catch (err: any) {
      res.status(500).json({ error: `Failed to post to Slack: ${err.message}` });
    }
  },
};

