// ~/instagram-api/lab/homework1.js
import express from 'express';
import mongoose from 'mongoose';
import Comment from './Comment.js';

const MONGO_URL = 'mongodb+srv://<사용자이름>:<비밀번호>@cluster0.xxxxx.mongodb.net/instagram';

const app = express();

app.use(express.json());

await mongoose.connect(MONGO_URL);
console.log('데이터베이스에 연결됐어요.');

app.get('/api/comments', async (req, res) => {
  const comments = await Comment.find();
  res.json(comments);
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

app.listen(4000, () => {
  console.log('서버가 4000번 포트에서 기다리고 있어요.');
});
