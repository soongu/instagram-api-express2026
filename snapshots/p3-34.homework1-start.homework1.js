// ~/instagram-api/lab/p3-34/homework1.js
import express from 'express';

const app = express();

const notices = [
  { id: 1, title: '서버 점검 안내', body: '11월 20일 새벽 2시부터 4시까지 서버를 점검해요.' },
  { id: 2, title: '새 기능 소개', body: '이제 게시물에 사진을 열 장까지 올릴 수 있어요.' },
];

app.get('/api/notices/:id', (req, res) => {
  const notice = notices.find((one) => one.id === Number(req.params.id));

  if (!notice) {
    res.status(404).json({ message: '그런 공지는 없어요' });
    return;
  }

  res.json(notice);
});

app.listen(4011, () => {
  console.log('과제 서버가 4011번 포트에서 기다리고 있어요.');
});
