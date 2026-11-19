// ~/instagram-api/routes/likes.js
import express from 'express';
import * as likeController from '../controllers/likeController.js';
import { parseId } from '../middlewares/params.js';
import { allowOnly } from '../middlewares/methods.js';

// app.js 가 붙인 주소(/api/posts/:id/likes)의 :id 까지 req.params 로 받는다.
const router = express.Router({ mergeParams: true });

// 이 라우터에 들어온 요청은 모두 어느 게시물의 좋아요라서, 게시물 번호부터 확인한다.
router.use(parseId);

router.get('/', likeController.list);

// 「3번 게시물에 2번 사람이 누른 좋아요」 하나를 주소로 가리킨다.
// 있게 만들기(PUT)와 없게 만들기(DELETE) — 둘 다 몇 번을 보내도 결과가 같다.
router.put('/me', likeController.like);
router.delete('/me', likeController.unlike);

router.all('/', allowOnly('GET'));
router.all('/me', allowOnly('PUT', 'DELETE'));

export default router;
