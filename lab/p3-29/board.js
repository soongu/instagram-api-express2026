// ~/instagram-api/lab/p3-29/board.js
import express from 'express';
import morgan from 'morgan';
import { logger } from '../../middlewares/logger.js';
import { HttpError } from '../../errors.js';
import helmet from 'helmet';


const app = express();

app.use(logger);
// app.use(morgan('combined'));
app.use(helmet());

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
    return;
  }

  req.notice = notice;
  next();
}


// 조회 수를 따로 저장하는 곳에 남긴다 — 실습용이라 3번 공지는 늘 실패한다
async function saveView(id) {
  await new Promise((resolve) => setTimeout(resolve, 100));

  if (id === 3) {
    throw new Error(`${id}번 공지의 조회 수를 저장하지 못했어요`);
  }
}


app.get('/api/notices/:id', findNotice, (req, res) => {
  res.json({ notice: req.notice });
});

app.post('/api/notices/:id/views', findNotice, async (req, res) => {
  await saveView(req.notice.id);
  res.json({ message: '조회 수를 남겼어요' });
});

app.use((req, res) => {
  res.status(404).json({ message: '그런 주소는 없어요' });
});

app.use((err, req, res, next) => {

  if (res.headersSent) {
    next(err);
    return;
  }

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
