// ~/instagram-api/app.js
import express from 'express';
import { posts } from './data/posts.js';

const app = express();

app.get('/', (req, res) => {
  res.send('인스타그램 서버가 살아 있어요');
});

app.get('/api/posts', (req, res) => {
  res.json(posts);
});

app.listen(3000, () => {
  console.log('서버가 3000번 포트에서 기다리고 있어요.');
});
