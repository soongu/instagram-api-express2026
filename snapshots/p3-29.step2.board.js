// ~/instagram-api/lab/p3-29/board.js
import express from 'express';
import morgan from 'morgan';
import { logger } from '../../middlewares/logger.js';
import { HttpError } from '../../errors.js';

const app = express();

app.use(logger);
app.use(morgan('dev'));

const notices = [
  { id: 1, title: '서버 점검 안내' },
  { id: 2, title: '새 기능 소개' },
  { id: 3, title: '이용 약관 변경' },
];

// 일부러 404 분기에 return; 을 빠뜨렸다
function findNotice(req, res, next) {
  const notice = notices.find((one) => one.id === Number(req.params.id));

  if (!notice) {
    res.status(404).json({ message: '그런 공지는 없어요' });
  }

  req.notice = notice;
  next();
}

app.get('/api/notices/:id', findNotice, (req, res) => {
  res.json({ notice: req.notice });
});

app.use((req, res) => {
  res.status(404).json({ message: '그런 주소는 없어요' });
});

app.use((err, req, res, next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ message: err.message });
    return;
  }

  console.error(err);
  res.status(500).json({ message: '서버에서 문제가 생겼어요' });
});

app.listen(4006, () => {
  console.log('실습 서버가 4006번 포트에서 기다리고 있어요.');
});
