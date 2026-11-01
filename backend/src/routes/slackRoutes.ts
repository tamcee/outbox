import { Router } from 'express';
import { slackController } from '../controllers/slackController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

export const slackRouter = Router();

// OAuth initiation requires auth so we associate state with current user
slackRouter.get('/connect', authMiddleware, slackController.getConnectUrl);

// Slack redirects here after user authorizes
slackRouter.get('/callback', slackController.handleCallback);

// Disconnect Slack
slackRouter.post('/disconnect', authMiddleware, slackController.disconnect);

// Test notification
slackRouter.post('/test', authMiddleware, slackController.sendTestNotification);

