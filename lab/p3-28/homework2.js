// ~/instagram-api/lab/p3-28/homework2.js
import express from 'express';
import { randomUUID } from 'node:crypto';

const app = express();

function requestId(req, res, next) {
  const id = randomUUID();

  res.locals.requestId = id;
  res.set('X-Request-Id', id);
  next();
}

function logger(req, res, next) {
  const start = performance.now();

  res.on('finish', () => {
    const ms = performance.now() - start;
    const id = res.locals.requestId?.slice(0, 8);
    console.log(`[${id}] ${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms`);
  });

  next();
}

app.use(requestId);
app.use(logger);

app.get('/api/notices', (req, res) => {
  res.json(['서버 점검 안내', '새 기능 소개']);
});

app.get('/api/boom', () => {
  throw new Error('일부러 낸 에러예요');
});

app.use((req, res) => {
  res.status(404).json({ message: '그런 주소는 없어요' });
});

app.use((err, req, res, next) => {
  const id = res.locals.requestId;

  console.error(`[${id?.slice(0, 8)}] ${err.stack}`);
  res.status(500).json({ message: '서버에서 문제가 생겼어요', requestId: id });
});

app.listen(4012, () => {
  console.log('실습 서버가 4012번 포트에서 기다리고 있어요.');
});
