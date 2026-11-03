// 내부 검증 전용 — 교안 Step 5 «시점» 의 app.js 다 (404 가드가 아직 없다).
// 학생 파일 경로 주석을 일부러 안 붙인다 — 이 파일은 학생 쪽에 없다.
import express from 'express';
import { posts } from './p2-22.data-posts.js';

const app = express();

app.get('/', (req, res) => {
  res.send('인스타그램 서버가 살아 있어요');
});

app.get('/api/posts', (req, res) => {
  res.json(posts);
});

app.get('/api/posts/:id', (req, res) => {
  const id = Number(req.params.id);
  const post = posts.find((one) => one.id === id);

  res.json(post);
});

app.listen(3000, () => {
  console.log('서버가 3000번 포트에서 기다리고 있어요.');
});
