// ~/instagram-api/routes/posts.js
import express from 'express';
import * as postService from '../services/postService.js';
import * as likeService from '../services/likeService.js';
import { validateBody } from '../middlewares/validate.js';
import { postCreateSchema, postUpdateSchema, likeSchema } from '../schemas/postSchema.js';
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

router.get('/', async (req, res) => {
  const posts = await postService.getPosts({
    username: req.query.username,
    limit: Number(req.query.limit) || undefined,
  });

  res.json(posts);
});

router.get('/:id', parseId, async (req, res) => {
  const post = await postService.getPost(req.postId);

  res.json(post);
});

router.post('/', validateBody(postCreateSchema), async (req, res) => {
  const newPost = await postService.createPost(req.body);

  res.status(201).json(newPost);
});

router.patch('/:id', parseId, validateBody(postUpdateSchema), async (req, res) => {
  const post = await postService.updatePost(req.postId, req.body);

  res.json(post);
});

router.delete('/:id', parseId, async (req, res) => {
  const deleted = await postService.removePost(req.postId);

  res.json(deleted);
});

router.get('/:id/likes', parseId, async (req, res) => {
  const usernames = await likeService.getLikers(req.postId);

  res.json(usernames);
});

// 한 주소로 켜고 끈다 — 이미 눌렀으면 취소, 아니면 추가.
router.post('/:id/likes', parseId, validateBody(likeSchema), async (req, res) => {
  const status = await likeService.toggleLike(req.postId, req.body.userId);

  res.json(status);
});

export default router;
