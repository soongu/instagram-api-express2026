// ~/instagram-api/lab/p3-29/parsers.js
import express from 'express';
import { logger } from '../../middlewares/logger.js';

const app = express();

app.use(logger);
app.use(express.json());
app.use(express.urlencoded());
app.use(express.text());

// 받은 본문을 그대로 돌려준다 — 어떤 형식이 어떻게 읽혔는지 보려고
app.post('/api/echo', (req, res) => {
  res.json({ contentType: req.get('Content-Type'), body: req.body ?? null });
});

app.listen(4007, () => {
  console.log('실습 서버가 4007번 포트에서 기다리고 있어요.');
});
