// ~/instagram-api/lab/p3-27/practice1.js
import express from 'express';
import { logger } from '../../middlewares/logger.js';
import { HttpError, BadRequestError } from '../../errors.js';

const app = express();

const notices = [
  { id: 1, title: '서버 점검 안내' },
  { id: 2, title: '새 기능 소개' },
  { id: 3, title: '이용 약관 변경' },
];

function findNotice(req, res, next) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    next(new BadRequestError('공지 번호는 숫자로 보내주세요.'));
    return;
  }

  const notice = notices.find((one) => one.id === id);

  if (!notice) {
    res.status(404).json({ message: '그런 공지는 없어요' });
    return;
  }

  req.notice = notice;
  next();
}

app.use(logger);

app.get('/api/notices/:id', findNotice, (req, res) => {
  res.json({ notice: req.notice });
});

app.use((err, req, res, next) => {
  console.log('에러 미들웨어에 들어왔어요');

  if (err instanceof HttpError) {
    res.status(err.status).json({ message: err.message });
    return;
  }

  console.error(err);
  res.status(500).json({ message: '서버에서 문제가 생겼어요' });
});

app.listen(4001, () => {
  console.log('실습 서버가 4001번 포트에서 기다리고 있어요.');
});
