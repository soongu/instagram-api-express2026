// ~/instagram-api/routes/comments.js
import express from 'express';
import * as commentController from '../controllers/commentController.js';
import { validateBody, validateQuery } from '../middlewares/validate.js';
import { parseCommentId, parseId } from '../middlewares/params.js';
import { allowOnly } from '../middlewares/methods.js';
import { commentCreateSchema, commentListQuerySchema } from '../schemas/commentSchema.js';

// app.js 가 붙인 주소(/api/posts/:id/comments)의 :id 까지 req.params 로 받는다.
const router = express.Router({ mergeParams: true });

// 이 라우터에 들어온 요청은 모두 어느 게시물의 댓글이라서, 게시물 번호부터 확인한다.
router.use(parseId);

// 주소에 댓글 번호가 있으면 라우트로 들어가기 전에 숫자로 바꿔 둔다.
router.param('commentId', parseCommentId);

router.get('/', validateQuery(commentListQuerySchema), commentController.list);
router.post('/', validateBody(commentCreateSchema), commentController.create);
router.delete('/:commentId', commentController.remove);

router.all('/', allowOnly('GET', 'POST'));
router.all('/:commentId', allowOnly('DELETE'));

export default router;
