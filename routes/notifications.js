// ~/instagram-api/routes/notifications.js
import express from 'express';
import * as notificationController from '../controllers/notificationController.js';
import { validateQuery } from '../middlewares/validate.js';
import { allowOnly } from '../middlewares/methods.js';
import { parseNotificationId } from '../middlewares/params.js';
import { notificationListQuerySchema } from '../schemas/notificationSchema.js';

const router = express.Router();

// 주소에 알림 번호가 있으면 라우트로 들어가기 전에 숫자로 바꿔 둔다.
router.param('id', parseNotificationId);

router.get('/', validateQuery(notificationListQuerySchema), notificationController.list);
router.patch('/:id/read', notificationController.read);

router.all('/', allowOnly('GET'));
router.all('/:id/read', allowOnly('PATCH'));

export default router;
