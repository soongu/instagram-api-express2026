// ~/instagram-api/routes/likes.js
import express from 'express';
import * as likeService from '../services/likeService.js';
import { parseId, parseUserId } from '../middlewares/params.js';
import { allowOnly } from '../middlewares/methods.js';

// app.js 가 붙인 주소(/api/posts/:id/likes)의 :id 까지 req.params 로 받는다.
const router = express.Router({ mergeParams: true });

// 이 라우터에 들어온 요청은 모두 어느 게시물의 좋아요라서, 게시물 번호부터 확인한다.
router.use(parseId);
router.param('userId', parseUserId);

router.get('/', async (req, res) => {
  const usernames = await likeService.getLikers(req.postId);

  res.json(usernames);
});

// 「3번 게시물에 2번 사람이 누른 좋아요」 하나를 주소로 가리킨다.
// 있게 만들기(PUT)와 없게 만들기(DELETE) — 둘 다 몇 번을 보내도 결과가 같다.
router.put('/:userId', async (req, res) => {
  const status = await likeService.likePost(req.postId, req.userId);

  res.json(status);
});

router.delete('/:userId', async (req, res) => {
  const status = await likeService.unlikePost(req.postId, req.userId);

  res.json(status);
});

router.all('/', allowOnly('GET'));
router.all('/:userId', allowOnly('PUT', 'DELETE'));

export default router;
