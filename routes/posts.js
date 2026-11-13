// ~/instagram-api/routes/posts.js
import express from 'express';
import * as postService from '../services/postService.js';
import * as likeService from '../services/likeService.js';
import { validateBody } from '../middlewares/validate.js';
import { postCreateSchema, postUpdateSchema } from '../schemas/postSchema.js';
import { NotFoundError } from '../errors.js';

const router = express.Router();

function parseId(req, res, next) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    next(new NotFoundError('그런 게시물은 없어요'));
    return;
  }

  req.postId = id;
  next();
}

function parseUserId(req, res, next) {
  const userId = Number(req.params.userId);

  if (!Number.isInteger(userId)) {
    next(new NotFoundError('그런 사용자는 없어요'));
    return;
  }

  req.userId = userId;
  next();
}

// 주소에 이 이름의 값이 있으면, 라우트로 들어가기 전에 이 함수부터 한 번 부른다.
router.param('id', parseId);
router.param('userId', parseUserId);

router.get('/', async (req, res) => {
  const page = await postService.getPosts({
    username: req.query.username,
    // 로그인을 배우기 전까지는 «누가 보는지» 를 주소에 실어 받는다.
    userId: Number(req.query.userId) || undefined,
    limit: Number(req.query.limit) || undefined,
    cursor: Number(req.query.cursor) || undefined,
  });

  res.json(page);
});

router.get('/:id', async (req, res) => {
  const post = await postService.getPost(req.postId);

  res.json(post);
});

router.post('/', validateBody(postCreateSchema), async (req, res) => {
  const newPost = await postService.createPost(req.body);

  res.status(201).json(newPost);
});

router.patch(
  '/:id',
  parseId,
  validateBody(postUpdateSchema),
  async (req, res) => {
    const post = await postService.updatePost(req.postId, req.body);

    res.json(post);
  },
);

router.delete('/:id', async (req, res) => {
  const deleted = await postService.removePost(req.postId);

  res.json(deleted);
});

router.get('/:id/likes', async (req, res) => {
  const usernames = await likeService.getLikers(req.postId);

  res.json(usernames);
});

// 「3번 게시물에 2번 사람이 누른 좋아요」 하나를 주소로 가리킨다.
// 있게 만들기(PUT)와 없게 만들기(DELETE) — 둘 다 몇 번을 보내도 결과가 같다.
router.put('/:id/likes/:userId', async (req, res) => {
  const status = await likeService.likePost(req.postId, req.userId);

  res.json(status);
});

router.delete('/:id/likes/:userId', async (req, res) => {
  const status = await likeService.unlikePost(req.postId, req.userId);

  res.json(status);
});




export default router;
