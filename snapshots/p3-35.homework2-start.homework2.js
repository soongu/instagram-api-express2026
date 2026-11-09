// ~/instagram-api/lab/p3-35/homework2.js
import express from 'express';
import { setTimeout as sleep } from 'node:timers/promises';
import { logger } from '../../middlewares/logger.js';

const app = express();

app.use(logger);
app.use(express.json());

const posts = [
  { id: 1, hashtags: ['여행', '바다'] },
  { id: 2, hashtags: ['여행', '맛집'] },
  { id: 3, hashtags: ['바다'] },
];

// 게시물 전체에서 해시태그를 센다 — 게시물이 많을수록 오래 걸리는 일이라 0.5초로 흉내 낸다.
async function countHashtags() {
  await sleep(500);
  console.log('인기 해시태그를 셌어요');
  const counts = new Map();
  for (const post of posts) {
    for (const tag of post.hashtags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, count]) => ({ name, count }));
}

app.get('/api/hashtags/popular', async (req, res) => {
  res.json(await countHashtags());
});

// 새 게시물
app.post('/api/posts', (req, res) => {
  const post = { id: posts.length + 1, hashtags: req.body.hashtags };
  posts.push(post);
  res.status(201).json(post);
});

app.listen(4012, () => {
  console.log('과제 서버가 4012번 포트에서 기다리고 있어요.');
});
