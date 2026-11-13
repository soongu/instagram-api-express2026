// ~/instagram-api/routes/likes.js
import express from 'express';
import * as likeService from '../services/likeService.js';
import { parseId, parseUserId } from '../middlewares/params.js';

// app.js 가 붙인 주소(/api/posts/:id/likes)의 :id 까지 req.params 로 받는다.
const router = express.Router({ mergeParams: true });

// 주소에 이 이름의 값이 있으면, 라우트로 들어가기 전에 이 함수부터 한 번 부른다.
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

export default router;
