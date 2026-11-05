// ~/instagram-api/lab/p3-29/practice1.js
import express from 'express';
import morgan from 'morgan';
import { logger } from '../../middlewares/logger.js';

const app = express();

app.use(logger);
app.use(morgan(':method :url :status :total-time[1]ms'));

app.get('/api/fast', (req, res) => {
  res.json({ message: '바로 답했어요' });
});

// 상태 줄과 헤더는 바로 보내고, 본문은 0.5초 뒤에 보낸다
app.get('/api/slow', (req, res) => {
  res.type('json');
  res.flushHeaders();

  setTimeout(() => {
    res.end(JSON.stringify({ message: '본문은 0.5초 뒤에 보냈어요' }));
  }, 500);
});

app.listen(4001, () => {
  console.log('실습 서버가 4001번 포트에서 기다리고 있어요.');
});
