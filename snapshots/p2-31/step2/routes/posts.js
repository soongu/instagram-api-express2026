// ~/instagram-api/routes/posts.js
import express from 'express';
import { prisma } from '../db.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const posts = await prisma.post.findMany({
    where: { username: req.query.username },
    orderBy: { createdAt: 'desc' },
    take: Number(req.query.limit) || undefined,
  });

  res.json(posts);
});

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    res.status(404).json({ message: '그런 게시물은 없어요' });
    return;
  }

  const post = await prisma.post.findUnique({ where: { id } });

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

  const newPost = await prisma.post.create({
    data: { username, profileImage, postImage, postAlt, content },
  });

  res.status(201).json(newPost);
});

router.patch('/:id', async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    res.status(404).json({ message: '그런 게시물은 없어요' });
    return;
  }

  const { username, profileImage, postImage, postAlt, content, likeCount } = req.body;

  const post = await prisma.post.update({
    where: { id },
    data: { username, profileImage, postImage, postAlt, content, likeCount },
  });

  res.json(post);
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    res.status(404).json({ message: '그런 게시물은 없어요' });
    return;
  }

  const deleted = await prisma.post.delete({ where: { id } });

  res.json(deleted);
});

export default router;
