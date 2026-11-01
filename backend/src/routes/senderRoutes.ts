import { Router } from 'express';
import { senderController } from '../controllers/senderController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

export const senderRouter = Router();

senderRouter.use(authMiddleware);

senderRouter.get('/', senderController.getSenders);
senderRouter.post('/seed', senderController.seedSenders);

