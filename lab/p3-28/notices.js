// ~/instagram-api/lab/p3-28/notices.js
import express from 'express';
import { logger } from '../../middlewares/logger.js';

const app = express();

app.use(logger);
app.use(express.json());

const notices = [
  { id: 1, title: '서버 점검 안내' },
  { id: 2, title: '새 기능 소개' },
  { id: 3, title: '이용 약관 변경' },
];

function parseNoticeId(req, res, next) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    res.status(404).json({ message: '그런 공지는 없어요' });
    return;
  }

  req.noticeId = id;
  next();
}

function findNotice(req, res, next) {
  const notice = notices.find((one) => one.id === req.noticeId);

  if (!notice) {
    res.status(404).json({ message: '그런 공지는 없어요' });
    return;
  }

  req.notice = notice;
  next();
}


const noticeTarget = [parseNoticeId, findNotice];


app.get('/api/notices/:id', noticeTarget, (req, res) => {
  res.json(req.notice);
});

app.patch('/api/notices/:id', noticeTarget, (req, res) => {
  req.notice.title = req.body.title;
  res.json(req.notice);
});

app.delete('/api/notices/:id', noticeTarget, (req, res) => {
  notices.splice(notices.indexOf(req.notice), 1);
  res.json(req.notice);
});

app.listen(4005, () => {
  console.log('실습 서버가 4005번 포트에서 기다리고 있어요.');
});
