// ~/instagram-api/lab/homework1.js
import express from 'express';
import morgan from 'morgan';

const app = express();

// 실패한 요청만 기록한다 — 상태 코드가 400보다 작으면 건너뛴다
app.use(morgan('dev', {
  skip: (req, res) => res.statusCode < 400,
}));

const notices = [
  { id: 1, title: '서버 점검 안내' },
  { id: 2, title: '새 기능 소개' },
];

app.get('/api/notices/:id', (req, res) => {
  const notice = notices.find((one) => one.id === Number(req.params.id));

  if (!notice) {
    res.status(404).json({ message: '그런 공지는 없어요' });
    return;
  }

  res.json(notice);
});

app.get('/api/boom', (req, res) => {
  throw new Error('일부러 낸 에러예요');
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: '서버에서 문제가 생겼어요' });
});

app.listen(4011, () => {
  console.log('실습 서버가 4011번 포트에서 기다리고 있어요.');
});
