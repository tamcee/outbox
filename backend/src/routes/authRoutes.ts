import { Router } from 'express';
import { authController } from '../controllers/authController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

export const authRouter = Router();

authRouter.get('/google', authController.getGoogleAuthUrl);
authRouter.get('/google/callback', authController.handleGoogleCallback);
authRouter.post('/dev-login', authController.devLogin);
authRouter.get('/me', authMiddleware, authController.getCurrentUser);
authRouter.post('/logout', authMiddleware, authController.logout);

