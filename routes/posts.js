// ~/instagram-api/routes/posts.js
import express from 'express';
import * as postService from '../services/postService.js';
import { validateBody } from '../middlewares/validate.js';
import { postCreateSchema, postUpdateSchema } from '../schemas/postSchema.js';
import { parseId } from '../middlewares/params.js';

const router = express.Router();

// 주소에 이 이름의 값이 있으면, 라우트로 들어가기 전에 이 함수부터 한 번 부른다.
router.param('id', parseId);

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



export default router;
