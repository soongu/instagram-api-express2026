// ~/instagram-api/routes/posts.js
import express from 'express';
import * as postController from '../controllers/postController.js';
import { validateBody, validateQuery } from '../middlewares/validate.js';
import { parseId } from '../middlewares/params.js';
import { allowOnly } from '../middlewares/methods.js';
import { legacyCursor } from '../middlewares/legacyCursor.js';
import { postCreateSchema, postListQuerySchema, postUpdateSchema } from '../schemas/postSchema.js';

const router = express.Router();

// 주소에 이 이름의 값이 있으면, 라우트로 들어가기 전에 이 함수부터 한 번 부른다.
router.param('id', parseId);

// 어느 주소로 오면 어떤 검사를 거쳐 어느 컨트롤러 함수로 가는지만 적는다.
router.get('/', validateQuery(postListQuerySchema), legacyCursor, postController.list);
router.get('/:id', postController.detail);
router.post('/', validateBody(postCreateSchema), postController.create);
router.patch('/:id', validateBody(postUpdateSchema), postController.update);
router.delete('/:id', postController.remove);

// 위 라우트가 받지 않은 HTTP 메서드는 여기까지 내려온다 — 라우트보다 «아래» 에 둔다.
router.all('/', allowOnly('GET', 'POST'));
router.all('/:id', allowOnly('GET', 'PATCH', 'DELETE'));

export default router;
