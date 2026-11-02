// ~/instagram-api/lab/practice1.js
import express from 'express';
import morgan from 'morgan';
import { logger } from '../middlewares/logger.js';

const app = express();

app.use(logger);
app.use(morgan(':method :url :status :total-time[1]ms'));

app.get('/api/fast', (req, res) => {
  res.json({ message: '바로 답했어요' });
});

app.get('/api/slow', (req, res) => {
  setTimeout(() => {
    res.json({ message: '0.5초 기다렸다가 답했어요' });
  }, 500);
});

app.listen(4001, () => {
  console.log('실습 서버가 4001번 포트에서 기다리고 있어요.');
});
