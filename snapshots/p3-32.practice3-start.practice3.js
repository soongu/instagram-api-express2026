// ~/instagram-api/lab/p3-32/practice3.js
import express from 'express';
import { logger } from '../../middlewares/logger.js';

const app = express();

app.use(logger);
app.use(express.json());

const notices = [
  { id: 1, title: '서버 점검 안내' },
  { id: 2, title: '새 기능 소개' },
];
let nextId = 3;

app.get('/api/notices/:id', (req, res) => {
  const notice = notices.find((one) => one.id === Number(req.params.id));

  if (!notice) {
    res.json({ ok: false, error: '그런 공지는 없어요' });
    return;
  }

  res.json({ ok: true, notice });
});

app.post('/api/notices', (req, res) => {
  const title = (req.body.title ?? '').trim();

  if (title === '') {
    res.json({ ok: false, error: '제목을 적어 주세요' });
    return;
  }

  if (notices.some((one) => one.title === title)) {
    res.json({ ok: false, error: '같은 제목의 공지가 이미 있어요' });
    return;
  }

  const notice = { id: nextId, title };
  nextId += 1;
  notices.push(notice);

  res.json({ ok: true, notice });
});

app.delete('/api/notices/:id', (req, res) => {
  const index = notices.findIndex((one) => one.id === Number(req.params.id));

  if (index === -1) {
    res.json({ ok: false, error: '그런 공지는 없어요' });
    return;
  }

  notices.splice(index, 1);
  res.json({ ok: true });
});

app.listen(4003, () => {
  console.log('공지 서버가 4003번 포트에서 기다리고 있어요.');
});
