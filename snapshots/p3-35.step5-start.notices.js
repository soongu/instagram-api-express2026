// ~/instagram-api/lab/p3-35/notices.js
import express from 'express';
import { setTimeout as sleep } from 'node:timers/promises';
import { logger } from '../../middlewares/logger.js';

const app = express();

app.use(logger);
app.use(express.json());

const notices = [
  { id: 1, title: '서버 점검 안내' },
  { id: 2, title: '새 기능 소개' },
  { id: 3, title: '이용 약관 변경' },
];

// 목록을 만든다 — 데이터베이스에서 읽어 오는 시간을 0.3초 기다리는 것으로 흉내 낸다.
async function buildList() {
  await sleep(300);
  console.log('공지 목록을 만들었어요');
  return notices.map((notice) => ({ id: notice.id, title: notice.title }));
}

app.get('/api/notices', async (req, res) => {
  res.json(await buildList());
});

app.patch('/api/notices/:id', (req, res) => {
  const notice = notices.find((one) => one.id === Number(req.params.id));
  if (!notice) {
    res.status(404).json({ message: '그런 공지는 없어요' });
    return;
  }

  notice.title = req.body.title;
  res.json(notice);
});

app.listen(4013, () => {
  console.log('공지 서버가 4013번 포트에서 기다리고 있어요.');
});
