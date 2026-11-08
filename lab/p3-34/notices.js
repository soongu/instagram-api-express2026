// ~/instagram-api/lab/p3-34/notices.js
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

// v1 으로 온 요청에는 모두 알린다 — 이 라우터로 들어온 요청은 라우트보다 먼저 여기를 지난다.
v1.use((req, res, next) => {
  res.set('Deprecation', '@1796083200');
  res.set('Sunset', 'Mon, 01 Mar 2027 00:00:00 GMT');
  next();
});

// v1 — 처음부터 내보내던 모양. 공지를 배열 하나로 준다.
v1.get('/notices', (req, res) => {
  res.json(notices);
});

// v2 — 고정 공지를 따로 담는다. 응답이 배열이 아니라 객체라서 v1 과 한 응답에 함께 둘 수 없다.
v2.get('/notices', (req, res) => {
  res.json({
    pinned: notices.filter((notice) => notice.pinned),
    items: notices.filter((notice) => !notice.pinned),
  });
});

app.use('/api/v1', v1);
app.use('/api/v2', v2);
// 버전을 나누기 전의 주소로 오는 화면도 있다 — 그 주소는 그대로 v1 이 받는다.
app.use('/api', v1);

app.listen(4010, () => {
  console.log('공지 서버가 4010번 포트에서 기다리고 있어요.');
});
