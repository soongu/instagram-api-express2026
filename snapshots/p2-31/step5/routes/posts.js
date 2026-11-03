// ~/instagram-api/routes/posts.js
import express from 'express';
import * as postService from '../services/postService.js';

const router = express.Router();

function parseId(req, res, next) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    res.status(404).json({ message: '그런 게시물은 없어요' });
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

  if (!post) {
    res.status(404).json({ message: '그런 게시물은 없어요' });
    return;
  }

  res.json(post);
});

router.post('/', async (req, res) => {
  const { username, profileImage, postImage, postAlt, content } = req.body;

  if (!username || !postImage) {
    res.status(400).json({ message: 'username과 postImage는 꼭 있어야 해요' });
    return;
  }

  const newPost = await postService.createPost({
    username, profileImage, postImage, postAlt, content,
  });

  res.status(201).json(newPost);
});

router.patch('/:id', parseId, async (req, res) => {
  const { username, profileImage, postImage, postAlt, content, likeCount } = req.body;

  const post = await postService.updatePost(req.postId, {
    username, profileImage, postImage, postAlt, content, likeCount,
  });

  res.json(post);
});

router.delete('/:id', parseId, async (req, res) => {
  const deleted = await postService.removePost(req.postId);

  res.json(deleted);
});

export default router;
