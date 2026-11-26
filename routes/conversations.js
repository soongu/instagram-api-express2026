// ~/instagram-api/routes/conversations.js
import express from 'express';
import * as conversationController from '../controllers/conversationController.js';
import { validateBody } from '../middlewares/validate.js';
import { allowOnly } from '../middlewares/methods.js';
import { conversationCreateSchema } from '../schemas/conversationSchema.js';

const router = express.Router();

router.post('/', validateBody(conversationCreateSchema), conversationController.create);

router.all('/', allowOnly('POST'));

export default router;
