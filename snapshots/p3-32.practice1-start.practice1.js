// ~/instagram-api/lab/p3-32/practice1.js
import express from 'express';

const app = express();

app.use(express.json());

const notices = [
  { id: 1, title: '서버 점검 안내', pinned: true },
  { id: 2, title: '새 기능 소개', pinned: false },
  { id: 3, title: '이용 약관 변경', pinned: true },
];
let nextId = 4;

app.get('/api/getNotices', (req, res) => {
  res.json(notices);
});

app.get('/api/getPinnedNotices', (req, res) => {
  res.json(notices.filter((notice) => notice.pinned));
});

app.get('/api/getNotice', (req, res) => {
  const notice = notices.find((one) => one.id === Number(req.query.id));

  if (!notice) {
    res.status(404).json({ message: '그런 공지는 없어요' });
    return;
  }

  res.json(notice);
});

app.post('/api/notice/create', (req, res) => {
  const notice = { id: nextId, title: req.body.title, pinned: false };
  nextId += 1;
  notices.push(notice);

  res.status(201).json(notice);
});

app.post('/api/notice/delete', (req, res) => {
  const index = notices.findIndex((one) => one.id === Number(req.body.id));

  if (index === -1) {
    res.status(404).json({ message: '그런 공지는 없어요' });
    return;
  }

  notices.splice(index, 1);
  res.json({ message: '지웠어요' });
});

app.listen(4001, () => {
  console.log('공지 서버가 4001번 포트에서 기다리고 있어요.');
});
