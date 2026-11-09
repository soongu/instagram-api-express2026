// ~/instagram-api/lab/p3-35/practice3.js
import express from 'express';
import { setTimeout as sleep } from 'node:timers/promises';
import { logger } from '../../middlewares/logger.js';

const app = express();

app.use(logger);
app.use(express.json());

const notices = [
  { id: 1, title: '서버 점검 안내', pinned: true },
  { id: 2, title: '새 기능 소개', pinned: false },
  { id: 3, title: '이용 약관 변경', pinned: true },
];

async function buildList(pinnedOnly) {
  await sleep(300);
  console.log(pinnedOnly ? '고정 공지 목록을 만들었어요' : '공지 목록을 만들었어요');
  return notices
    .filter((notice) => !pinnedOnly || notice.pinned)
    .map((notice) => ({ id: notice.id, title: notice.title }));
}

app.get('/api/notices', async (req, res) => {
  res.json(await buildList(req.query.pinned === 'true'));
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

app.listen(4003, () => {
  console.log('실습 서버가 4003번 포트에서 기다리고 있어요.');
});
