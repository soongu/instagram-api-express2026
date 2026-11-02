// ~/instagram-api/lab/homework1.js
import express from 'express';
import { logger } from '../middlewares/logger.js';

const app = express();

const MAINTENANCE = true;

function maintenance(enabled) {
  return (req, res, next) => {
    if (enabled) {
      res.status(503).json({ message: '지금은 점검 중이에요. 잠시 뒤에 다시 와 주세요' });
      return;
    }

    next();
  };
}

app.use(logger);
app.use(maintenance(MAINTENANCE));

app.get('/api/notices', (req, res) => {
  res.json(['서버 점검 안내', '새 기능 소개']);
});

app.listen(4011, () => {
  console.log('실습 서버가 4011번 포트에서 기다리고 있어요.');
});
