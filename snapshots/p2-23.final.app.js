// ~/instagram-api/app.js
import express from 'express';
import { posts } from './p2-22.data-posts.js';

const app = express();

app.use(express.json());

let nextId = 4;

app.get('/', (req, res) => {
  res.send('인스타그램 서버가 살아 있어요');
});

app.get('/api/posts', (req, res) => {
  res.json(posts);
});

app.get('/api/posts/:id', (req, res) => {
  const id = Number(req.params.id);
  const post = posts.find((one) => one.id === id);

  if (!post) {
    res.status(404).json({ message: '그런 게시물은 없어요' });
    return;
  }

  res.json(post);
});

app.post('/api/posts', (req, res) => {
  const { username, postImage } = req.body;

  if (!username || !postImage) {
    res.status(400).json({ message: 'username과 postImage는 꼭 있어야 해요' });
    return;
  }

  const newPost = {
    ...req.body,
    id: nextId,
    likeCount: 0,
    commentCount: 0,
    minutesAgo: 0,
  };

  nextId = nextId + 1;
  posts.push(newPost);

  res.status(201).json(newPost);
});

app.patch('/api/posts/:id', (req, res) => {
  const id = Number(req.params.id);
  const index = posts.findIndex((one) => one.id === id);

  if (index === -1) {
    res.status(404).json({ message: '그런 게시물은 없어요' });
    return;
  }

  posts[index] = { ...posts[index], ...req.body, id };

  res.json(posts[index]);
});

app.delete('/api/posts/:id', (req, res) => {
  const id = Number(req.params.id);
  const index = posts.findIndex((one) => one.id === id);

  if (index === -1) {
    res.status(404).json({ message: '그런 게시물은 없어요' });
    return;
  }

  const deleted = posts[index];
  posts.splice(index, 1);

  res.json(deleted);
});

app.use((req, res) => {
  res.status(404).json({ message: '그런 주소는 없어요' });
});

app.listen(3000, () => {
  console.log('서버가 3000번 포트에서 기다리고 있어요.');
});
