import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { prisma } from '../db/prisma.js';
import { logger } from '../utils/logger.js';
import type { SenderAccount } from '@prisma/client';

const transporterCache = new Map<string, Transporter>();

export const etherealService = {
  async seedSenderAccounts(targetCount: number = 3): Promise<void> {
    try {
      const existingCount = await prisma.senderAccount.count({ where: { isActive: true } });
      if (existingCount >= targetCount) {
        logger.info(`Found ${existingCount} active sender accounts in database. Seeding skipped.`);
        return;
      }

      const toCreate = targetCount - existingCount;
      logger.info(`Seeding ${toCreate} Ethereal email sender account(s)...`);

      for (let i = 0; i < toCreate; i++) {
        const testAccount = await nodemailer.createTestAccount();
        const account = await prisma.senderAccount.upsert({
          where: { email: testAccount.user },
          update: {
            host: testAccount.smtp.host,
            port: testAccount.smtp.port,
            user: testAccount.user,
            pass: testAccount.pass,
            isActive: true,
          },
          create: {
            email: testAccount.user,
            host: testAccount.smtp.host,
            port: testAccount.smtp.port,
            user: testAccount.user,
            pass: testAccount.pass,
            isActive: true,
          },
        });
        logger.info(`Created Ethereal sender account: ${account.email}`);
      }
    } catch (err: any) {
      logger.error('Failed to seed Ethereal sender accounts:', err.message);
    }
  },

  getTransporter(sender: SenderAccount): Transporter {
    let transporter = transporterCache.get(sender.id);
    if (!transporter) {
      transporter = nodemailer.createTransport({
        host: sender.host,
        port: sender.port,
        secure: sender.port === 465,
        auth: {
          user: sender.user,
          pass: sender.pass,
        },
      });
      transporterCache.set(sender.id, transporter);
    }
    return transporter;
  },

  async sendEmail(
    sender: SenderAccount,
    options: { to: string; subject: string; body: string }
  ): Promise<{ messageId: string; previewUrl: string | false }> {
    const transporter = this.getTransporter(sender);
    const info = await transporter.sendMail({
      from: `"Scheduler Team" <${sender.email}>`,
      to: options.to,
      subject: options.subject,
      html: options.body,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    return {
      messageId: info.messageId,
      previewUrl,
    };
  },
};
