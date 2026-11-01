import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { emailQueue } from './emailQueue.js';
import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';

export const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter,
});

import jwt from 'jsonwebtoken';

/**
 * Middleware protecting /admin/queues:
 * - Allowed if logged into the dashboard (valid session cookie)
 * - Allowed via HTTP Basic Auth (admin / adminsecret)
 * - Allowed via URL param (?password=adminsecret)
 */
export function adminAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  // 1. Allow if user is already logged in to the app
  const sessionToken = req.cookies?.[env.SESSION_COOKIE_NAME];
  if (sessionToken) {
    try {
      jwt.verify(sessionToken, env.JWT_SECRET);
      return next();
    } catch {
      // Invalid session, fallback to Basic Auth check
    }
  }

  // 2. Allow via URL parameter or cookie
  if (
    req.query?.password === env.ADMIN_PASSWORD ||
    req.query?.key === env.ADMIN_PASSWORD ||
    req.cookies?.admin_auth === env.ADMIN_PASSWORD
  ) {
    return next();
  }

  // 3. HTTP Basic Auth
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Basic ')) {
    const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString('ascii');
    const [user, pass] = credentials.split(':');
    if (user === 'admin' && pass === env.ADMIN_PASSWORD) {
      return next();
    }
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="Bull Board Admin"');
  res.status(401).send('Authentication required for Queue Dashboard');
}
