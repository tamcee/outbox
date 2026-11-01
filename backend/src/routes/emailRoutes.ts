import { Router } from 'express';
import { emailController, scheduleEmailSchema } from '../controllers/emailController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { validateRequest } from '../middlewares/validateRequest.js';

export const emailRouter = Router();

emailRouter.use(authMiddleware);

emailRouter.post('/schedule', validateRequest(scheduleEmailSchema), emailController.scheduleEmails);
emailRouter.get('/scheduled', emailController.getScheduled);
emailRouter.get('/sent', emailController.getSent);
emailRouter.get('/stats', emailController.getStats);
emailRouter.get('/search', emailController.search);
emailRouter.get('/:id', emailController.getById);

