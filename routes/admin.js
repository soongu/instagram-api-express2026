// ~/instagram-api/routes/admin.js
import express from 'express';
import * as adminController from '../controllers/adminController.js';
import { requireAdmin } from '../middlewares/auth.js';
import { validateBody } from '../middlewares/validate.js';
import { parseUserId } from '../middlewares/params.js';
import { allowOnly } from '../middlewares/methods.js';
import { roleSchema } from '../schemas/adminSchema.js';

const router = express.Router();

// 이 라우터에 들어온 요청은 모두 requireAdmin 부터 지나간다.
router.use(requireAdmin);
router.param('userId', parseUserId);

router.get('/users', adminController.listUsers);
router.patch(
  '/users/:userId/role',
  validateBody(roleSchema),
  adminController.changeRole,
);

router.all('/users', allowOnly('GET'));
router.all('/users/:userId/role', allowOnly('PATCH'));

export default router;
