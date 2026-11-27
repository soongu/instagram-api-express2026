// ~/instagram-api/routes/notifications.js
import express from 'express';
import * as notificationController from '../controllers/notificationController.js';
import { validateQuery } from '../middlewares/validate.js';
import { allowOnly } from '../middlewares/methods.js';
import { notificationListQuerySchema } from '../schemas/notificationSchema.js';

const router = express.Router();

router.get('/', validateQuery(notificationListQuerySchema), notificationController.list);

router.all('/', allowOnly('GET'));

export default router;
