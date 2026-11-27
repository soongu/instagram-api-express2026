// ~/instagram-api/routes/conversations.js
import express from 'express';
import * as conversationController from '../controllers/conversationController.js';
import { validateBody, validateQuery } from '../middlewares/validate.js';
import { allowOnly } from '../middlewares/methods.js';
import { parseConversationId } from '../middlewares/params.js';
import { conversationCreateSchema, conversationListQuerySchema, messageListQuerySchema } from '../schemas/conversationSchema.js';

const router = express.Router();

// 주소에 대화방 번호가 있으면 라우트로 들어가기 전에 숫자로 바꿔 둔다.
router.param('id', parseConversationId);

router.get('/', validateQuery(conversationListQuerySchema), conversationController.list);
router.post('/', validateBody(conversationCreateSchema), conversationController.create);
// /unread 는 /:id 보다 위에 둔다 - 아래에 두면 unread 를 대화방 번호로 읽으려 한다.
router.get('/unread', conversationController.unread);
router.get('/:id', conversationController.get);
router.delete('/:id', conversationController.remove);
router.get('/:id/messages', validateQuery(messageListQuerySchema), conversationController.messages);
router.patch('/:id/messages/read', conversationController.read);

router.all('/', allowOnly('GET', 'POST'));
router.all('/unread', allowOnly('GET'));
router.all('/:id', allowOnly('GET', 'DELETE'));
router.all('/:id/messages', allowOnly('GET'));
router.all('/:id/messages/read', allowOnly('PATCH'));

export default router;
