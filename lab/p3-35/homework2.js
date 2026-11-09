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

const TEN_SECONDS = 10 * 1000;
// 센 결과와 센 시각을 함께 담아 둔다 — 10초가 지나면 다시 센다.
let saved = null;

app.get('/api/hashtags/popular', async (req, res) => {
  if (saved === null || Date.now() - saved.countedAt >= TEN_SECONDS) {
    saved = { hashtags: await countHashtags(), countedAt: Date.now() };
  }

  // 누구에게나 같고 10초쯤 늦어도 괜찮은 응답 — 브라우저도 10초 동안은 서버에 확인하지 않고 쓴다.
  res.set('Cache-Control', 'public, max-age=10');
  res.json(saved.hashtags);
});

// 새 게시물 — 담아 둔 결과는 그대로 둔다. 10초 안에 반영되면 충분하다.
app.post('/api/posts', (req, res) => {
  const post = { id: posts.length + 1, hashtags: req.body.hashtags };
  posts.push(post);
  res.status(201).json(post);
});

app.listen(4012, () => {
  console.log('과제 서버가 4012번 포트에서 기다리고 있어요.');
});
