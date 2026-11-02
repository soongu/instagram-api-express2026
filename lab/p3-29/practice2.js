// ~/instagram-api/lab/practice2.js
import express from 'express';
import { logger } from '../middlewares/logger.js';

const app = express();

app.use(logger);
app.use(express.json());

const readIds = [];

// 읽음 표시를 따로 저장하는 곳에 남긴다 — 실습용이라 3번 공지는 늘 실패한다
async function markRead(id) {
  await new Promise((resolve) => setTimeout(resolve, 100));

  if (id === 3) {
    throw new Error(`${id}번 공지를 읽음으로 표시하지 못했어요`);
  }

  if (!readIds.includes(id)) {
    readIds.push(id);
  }
}

// 공지 여러 개를 한꺼번에 읽음으로 — 본문은 { "ids": [1, 2] } 모양
app.post('/api/notices/read', async (req, res) => {
  for (const id of req.body.ids) {
    await markRead(id);
  }

  res.json({ message: '읽음으로 표시했어요' });
});

app.get('/api/notices/read', (req, res) => {
  res.json({ readIds });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: '서버에서 문제가 생겼어요' });
});

app.listen(4002, () => {
  console.log('실습 서버가 4002번 포트에서 기다리고 있어요.');
});
