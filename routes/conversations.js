// ~/instagram-api/routes/conversations.js
import express from 'express';
import * as conversationController from '../controllers/conversationController.js';
import { validateBody, validateQuery } from '../middlewares/validate.js';
import { allowOnly } from '../middlewares/methods.js';
import { conversationCreateSchema, conversationListQuerySchema } from '../schemas/conversationSchema.js';

const router = express.Router();

router.get('/', validateQuery(conversationListQuerySchema), conversationController.list);
router.post('/', validateBody(conversationCreateSchema), conversationController.create);

router.all('/', allowOnly('GET', 'POST'));

export default router;
