import { Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import axios from 'axios';
import { env } from '../config/env.js';
import { prisma } from '../db/prisma.js';
import { signUserToken } from '../middlewares/authMiddleware.js';
import { logger } from '../utils/logger.js';

const googleClient = new OAuth2Client(
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET,
  env.GOOGLE_CALLBACK_URL
);

export const authController = {
  getGoogleAuthUrl(req: Request, res: Response): void {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      res.status(400).json({
        error: 'Google OAuth credentials not configured in backend .env',
      });
      return;
    }

    const authUrl = googleClient.generateAuthUrl({
      access_type: 'offline',
      scope: ['openid', 'email', 'profile'],
      prompt: 'consent',
    });

    res.json({ url: authUrl });
  },

  async handleGoogleCallback(req: Request, res: Response): Promise<void> {
    const code = req.query.code as string;
    if (!code) {
      res.redirect(`${env.FRONTEND_URL}/login?error=no_code`);
      return;
    }

    try {
      const { tokens } = await googleClient.getToken(code);
      googleClient.setCredentials(tokens);

      let email = '';
      let name = '';
      let avatar = '';
      let googleId = '';

      if (tokens.id_token) {
        const ticket = await googleClient.verifyIdToken({
          idToken: tokens.id_token,
          audience: env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        if (payload) {
          email = payload.email || '';
          name = payload.name || '';
          avatar = payload.picture || '';
          googleId = payload.sub || '';
        }
      } else if (tokens.access_token) {
        const userInfo = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        email = userInfo.data.email;
        name = userInfo.data.name;
        avatar = userInfo.data.picture;
        googleId = userInfo.data.sub;
      }

      if (!email) {
        throw new Error('Could not retrieve email from Google OAuth profile');
      }

      const user = await prisma.user.upsert({
        where: { email },
        update: {
          name: name || undefined,
          avatar: avatar || undefined,
          googleId,
        },
        create: {
          email,
          name,
          avatar,
          googleId,
        },
      });

      const token = signUserToken(user);
      const isProd = env.NODE_ENV === 'production';

      res.cookie(env.SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.redirect(`${env.FRONTEND_URL}/`);
    } catch (err: any) {
      logger.error('Google OAuth callback error:', err.message);
      res.redirect(`${env.FRONTEND_URL}/login?error=auth_failed`);
    }
  },

  /**
   * Development login endpoint for testing before Google credentials are provided
   */
  async devLogin(req: Request, res: Response): Promise<void> {
    const email = (req.body?.email || 'oliver.brown@domain.io').toLowerCase().trim();
    const name = req.body?.name || 'Oliver Brown';
    const avatar = req.body?.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120';

    const user = await prisma.user.upsert({
      where: { email },
      update: { name, avatar },
      create: {
        email,
        name,
        avatar,
        googleId: `dev-mock-${email}`,
      },
    });

    const token = signUserToken(user);
    const isProd = env.NODE_ENV === 'production';

    res.cookie(env.SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ user, token });
  },

  async getCurrentUser(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        slackWebhookUrl: true,
        slackChannel: true,
        slackTeamName: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      ...user,
      slackConnected: Boolean(user.slackWebhookUrl),
    });
  },

  logout(req: Request, res: Response): void {
    const isProd = env.NODE_ENV === 'production';
    res.clearCookie(env.SESSION_COOKIE_NAME, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
    });
    res.json({ success: true });
  },
};

