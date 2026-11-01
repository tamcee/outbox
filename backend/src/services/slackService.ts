import axios from 'axios';
import { prisma } from '../db/prisma.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export const slackService = {
  getAuthUrl(state: string): string {
    const scopes = 'incoming-webhook';
    const params = new URLSearchParams({
      client_id: env.SLACK_CLIENT_ID,
      scope: scopes,
      redirect_uri: env.SLACK_REDIRECT_URI,
      state,
    });
    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  },

  async exchangeCodeForWebhook(
    code: string
  ): Promise<{ webhookUrl: string; channel: string; teamName: string }> {
    const response = await axios.post(
      'https://slack.com/api/oauth.v2.access',
      new URLSearchParams({
        client_id: env.SLACK_CLIENT_ID,
        client_secret: env.SLACK_CLIENT_SECRET,
        code,
        redirect_uri: env.SLACK_REDIRECT_URI,
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );

    if (!response.data.ok) {
      throw new Error(`Slack OAuth error: ${response.data.error || 'Failed to exchange code'}`);
    }

    const webhook = response.data.incoming_webhook;
    return {
      webhookUrl: webhook.url,
      channel: webhook.channel,
      teamName: response.data.team?.name || 'Workspace',
    };
  },

  async notifyRateLimitExceeded(
    userId: string,
    senderEmail: string,
    limit: number,
    spilloverTime: Date
  ): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { slackWebhookUrl: true, slackChannel: true },
      });

      if (!user || !user.slackWebhookUrl) {
        // Silently skip if Slack is not connected
        return;
      }

      const formattedTime = spilloverTime.toUTCString();
      const payload = {
        text: `⚠️ *Hourly Rate Limit Reached* for sender \`${senderEmail}\` (Limit: ${limit}/hr). In-flight emails will automatically spill over to the next window starting at *${formattedTime}*.`,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '⚠️ Email Scheduler Rate Limit Alert',
              emoji: true,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `Sender account *${senderEmail}* has reached its hourly threshold of *${limit} emails*.\nPending jobs have been rescheduled to spill over into the next hourly window (*${formattedTime}*) preserving initial dispatch ordering.`,
            },
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `Notification sent to ${user.slackChannel ? `\`#${user.slackChannel}\`` : 'your configured Slack channel'}.`,
              },
            ],
          },
        ],
      };

      await axios.post(user.slackWebhookUrl, payload, { timeout: 4000 });
      logger.info(`Slack alert sent to user ${userId} via webhook`);
    } catch (err: any) {
      logger.error('Failed to send Slack rate limit alert:', err.message);
    }
  },
};

