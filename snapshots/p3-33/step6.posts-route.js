// ~/instagram-api/routes/posts.js
import express from 'express';
import * as postService from '../services/postService.js';
import { validateBody } from '../middlewares/validate.js';
import { parseId } from '../middlewares/params.js';
import { allowOnly } from '../middlewares/methods.js';
import { postCreateSchema, postUpdateSchema } from '../schemas/postSchema.js';

const router = express.Router();

// 주소에 이 이름의 값이 있으면, 라우트로 들어가기 전에 이 함수부터 한 번 부른다.
router.param('id', parseId);

router.get('/', async (req, res) => {
  const page = await postService.getPosts({
    username: req.query.username,
    // 서버가 로그인 정보를 쓰기 전까지는 «누가 보는지» 를 주소에 실어 받는다.
    userId: Number(req.query.userId) || undefined,
    limit: Number(req.query.limit) || undefined,
    cursor: req.query.cursor,
  });

  res.json(page);
});

router.get('/:id', async (req, res) => {
  const post = await postService.getPost(req.postId);

  res.json(post);
});

router.post('/', validateBody(postCreateSchema), async (req, res) => {
  const newPost = await postService.createPost(req.body);

  // 새 게시물을 가리키는 주소를 Location 헤더에 싣는다.
  res.status(201).location(`/api/posts/${newPost.id}`).json(newPost);
});

router.patch('/:id', validateBody(postUpdateSchema), async (req, res) => {
  const post = await postService.updatePost(req.postId, req.body);

  res.json(post);
});

router.delete('/:id', async (req, res) => {
  const deleted = await postService.removePost(req.postId);

  res.json(deleted);
});

// 위 라우트가 받지 않은 HTTP 메서드는 여기까지 내려온다 — 라우트보다 «아래» 에 둔다.
router.all('/', allowOnly('GET', 'POST'));
router.all('/:id', allowOnly('GET', 'PATCH', 'DELETE'));

export default router;
