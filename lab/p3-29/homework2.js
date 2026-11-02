// ~/instagram-api/lab/homework2.js
import express from 'express';
import { logger } from '../middlewares/logger.js';

const app = express();

app.use(logger);

const errorLog = [];

app.get('/api/boom', (req, res) => {
  throw new Error('일부러 낸 에러예요');
});

app.get('/api/slow-boom', async (req, res) => {
  await new Promise((resolve) => setTimeout(resolve, 100));
  throw new Error('기다렸다가 낸 에러예요');
});

app.get('/api/late', (req, res) => {
  res.json({ message: '먼저 답했어요' });
  throw new Error('답한 뒤에 낸 에러예요');
});

app.get('/api/errors', (req, res) => {
  res.json(errorLog);
});

app.use((req, res) => {
  res.status(404).json({ message: '그런 주소는 없어요' });
});

// 에러를 기록한다 — 최근 5개만 남기고 넘긴다
app.use((err, req, res, next) => {
  errorLog.push({ method: req.method, url: req.originalUrl, message: err.message });

  if (errorLog.length > 5) {
    errorLog.shift();
  }

  next(err);
});

// 에러에 답한다
app.use((err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  res.status(500).json({ message: '서버에서 문제가 생겼어요' });
});

app.listen(4012, () => {
  console.log('실습 서버가 4012번 포트에서 기다리고 있어요.');
});
