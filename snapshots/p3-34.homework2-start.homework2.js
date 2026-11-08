// ~/instagram-api/lab/p3-34/homework2.js
import express from 'express';

const app = express();

const notices = [
  { id: 1, title: '서버 점검 안내', pinned: true },
  { id: 2, title: '새 기능 소개', pinned: false },
  { id: 3, title: '이용 약관 변경', pinned: true },
  { id: 4, title: '연말 이벤트', pinned: false },
];

const v1 = express.Router();
const v2 = express.Router();

v1.use((req, res, next) => {
  res.set('Deprecation', '@1796083200');
  res.set('Sunset', 'Mon, 01 Mar 2027 00:00:00 GMT');
  next();
});

v1.get('/notices', (req, res) => {
  res.json(notices);
});

v2.get('/notices', (req, res) => {
  res.json({
    pinned: notices.filter((notice) => notice.pinned),
    items: notices.filter((notice) => !notice.pinned),
  });
});

app.use('/api/v1', v1);
app.use('/api/v2', v2);
app.use('/api', v1);

app.listen(4012, () => {
  console.log('과제 서버가 4012번 포트에서 기다리고 있어요.');
});
