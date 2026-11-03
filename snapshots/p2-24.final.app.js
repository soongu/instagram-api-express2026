// ~/instagram-api/app.js
import express from 'express';
import mongoose from 'mongoose';
import Post from '../models/Post.js';

const MONGO_URL = 'mongodb+srv://<사용자이름>:<비밀번호>@cluster0.xxxxx.mongodb.net/instagram';

const app = express();

app.use(express.json());

await mongoose.connect(MONGO_URL);
console.log('데이터베이스에 연결됐어요.');

app.get('/', (req, res) => {
  res.send('인스타그램 서버가 살아 있어요');
});

app.get('/api/posts', async (req, res) => {
  const posts = await Post.find();
  res.json(posts);
});

app.get('/api/posts/:id', async (req, res) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    res.status(404).json({ message: '그런 게시물은 없어요' });
    return;
  }

  res.json(post);
});

app.post('/api/posts', async (req, res) => {
  const { username, postImage } = req.body;

  if (!username || !postImage) {
    res.status(400).json({ message: 'username과 postImage는 꼭 있어야 해요' });
    return;
  }

  const newPost = await Post.create({
    ...req.body,
    likeCount: 0,
    commentCount: 0,
    minutesAgo: 0,
  });

  res.status(201).json(newPost);
});

app.patch('/api/posts/:id', async (req, res) => {
  const post = await Post.findByIdAndUpdate(req.params.id, req.body, {
    returnDocument: 'after',
  });

  if (!post) {
    res.status(404).json({ message: '그런 게시물은 없어요' });
    return;
  }

  res.json(post);
});

app.delete('/api/posts/:id', async (req, res) => {
  const deleted = await Post.findByIdAndDelete(req.params.id);

  if (!deleted) {
    res.status(404).json({ message: '그런 게시물은 없어요' });
    return;
  }

  res.json(deleted);
});

app.use((req, res) => {
  res.status(404).json({ message: '그런 주소는 없어요' });
});

app.listen(3000, () => {
  console.log('서버가 3000번 포트에서 기다리고 있어요.');
});
