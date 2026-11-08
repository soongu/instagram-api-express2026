// ~/instagram-api/lab/p3-34/notices.js
import express from 'express';

const app = express();

const notices = [
  { id: 1, title: '서버 점검 안내', pinned: true },
  { id: 2, title: '새 기능 소개', pinned: false },
  { id: 3, title: '이용 약관 변경', pinned: true },
  { id: 4, title: '연말 이벤트', pinned: false },
];

app.get('/api/notices', (req, res) => {
  res.json(notices);
});

app.listen(4010, () => {
  console.log('공지 서버가 4010번 포트에서 기다리고 있어요.');
});
