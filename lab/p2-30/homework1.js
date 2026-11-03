// ~/instagram-api/lab/homework1.js
import express from 'express';
import { prisma } from '../db.js';

const app = express();

app.use(express.json());

app.get('/api/comments', async (req, res) => {
  const comments = await prisma.comment.findMany({
    where: { postId: Number(req.query.postId) || undefined },
    orderBy: { id: 'asc' },
  });

  res.json(comments);
});

app.get('/api/comments/:id', async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    res.status(404).json({ message: '그런 댓글은 없어요' });
    return;
  }

  const comment = await prisma.comment.findUnique({ where: { id } });

  if (!comment) {
    res.status(404).json({ message: '그런 댓글은 없어요' });
    return;
  }

  res.json(comment);
});

app.delete('/api/comments/:id', async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    res.status(404).json({ message: '그런 댓글은 없어요' });
    return;
  }

  const deleted = await prisma.comment.delete({ where: { id } });

  res.json(deleted);
});

app.use((req, res) => {
  res.status(404).json({ message: '그런 주소는 없어요' });
});

app.use((err, req, res, next) => {
  if (err.code === 'P2025') {
    res.status(404).json({ message: '그런 댓글은 없어요' });
    return;
  }

  console.error(err);
  res.status(500).json({ message: '서버에서 문제가 생겼어요' });
});

app.listen(4001, () => {
  console.log('댓글 서버가 4001번 포트에서 기다리고 있어요.');
});
