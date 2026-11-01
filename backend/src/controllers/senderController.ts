import { Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { etherealService } from '../services/etherealService.js';
import { rateLimitService } from '../services/rateLimitService.js';

export const senderController = {
  async getSenders(req: Request, res: Response): Promise<void> {
    const senders = await prisma.senderAccount.findMany({
      where: { isActive: true },
      select: {
        id: true,
        email: true,
        host: true,
        port: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const sendersWithCounts = await Promise.all(
      senders.map(async (sender: any) => {
        const hourlyCount = await rateLimitService.getHourlyCount(sender.id);
        return {
          ...sender,
          currentHourlyCount: hourlyCount,
        };
      })
    );

    res.json(sendersWithCounts);
  },

  async seedSenders(req: Request, res: Response): Promise<void> {
    const count = parseInt(req.body?.count as string) || 3;
    await etherealService.seedSenderAccounts(count);
    const senders = await prisma.senderAccount.findMany();
    res.json({ success: true, senders });
  },
};

