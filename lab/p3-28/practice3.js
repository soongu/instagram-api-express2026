// ~/instagram-api/lab/p3-28/practice3.js
import express from 'express';

const app = express();

function slowLogger(limitMs) {
  return (req, res, next) => {
    const start = performance.now();

    res.on('finish', () => {
      const ms = performance.now() - start;

      if (ms > limitMs) {
        console.log(
          `느린 요청 — ${req.method} ${req.originalUrl} ${ms.toFixed(1)}ms`,
        );
      }
    });

    next();
  };
}

app.use(slowLogger(500));

app.get('/api/fast', (req, res) => {
  res.json({ message: '바로 답해요' });
});

app.get('/api/slow', async (req, res) => {
  await new Promise((resolve) => setTimeout(resolve, 800));
  res.json({ message: '0.8초 뒤에 답해요' });
});

app.listen(4003, () => {
  console.log('실습 서버가 4003번 포트에서 기다리고 있어요.');
});
