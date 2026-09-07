// ~/instagram-api/lab/homework1.js
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import Comment from './Comment.js';

const app = express();

app.use(cors());
app.use(express.json());

await mongoose.connect(process.env.MONGO_URL);
console.log('데이터베이스에 연결됐어요.');

app.get('/api/comments', async (req, res) => {
  const comments = await Comment.find();
  res.json(comments);
});

app.get('/api/comments/:id', async (req, res) => {
  const comment = await Comment.findById(req.params.id);

  if (!comment) {
    res.status(404).json({ message: '그런 댓글은 없어요' });
    return;
  }

  res.json(comment);
});

app.post('/api/comments', async (req, res) => {
  const { postId, username, content } = req.body;

  if (!postId || !username || !content) {
    res.status(400).json({ message: 'postId와 username과 content는 꼭 있어야 해요' });
    return;
  }

  const newComment = await Comment.create({ ...req.body, likeCount: 0 });

  res.status(201).json(newComment);
});

app.delete('/api/comments/:id', async (req, res) => {
  const deleted = await Comment.findByIdAndDelete(req.params.id);

  if (!deleted) {
    res.status(404).json({ message: '그런 댓글은 없어요' });
    return;
  }

  res.json(deleted);
});

app.use((req, res) => {
  res.status(404).json({ message: '그런 주소는 없어요' });
});

app.use((err, req, res, next) => {
  if (err.name === 'CastError') {
    res.status(404).json({ message: '그런 댓글은 없어요' });
    return;
  }

  if (err.status) {
    res.status(err.status).json({ message: '보낸 내용을 읽을 수 없어요' });
    return;
  }

  console.error(err);
  res.status(500).json({ message: '서버에서 문제가 생겼어요' });
});

const PORT = process.env.COMMENTS_PORT ?? 4000;

app.listen(PORT, () => {
  console.log(`서버가 ${PORT}번 포트에서 기다리고 있어요.`);
});
