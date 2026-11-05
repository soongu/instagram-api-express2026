// ~/instagram-api/lab/p3-30/practice1.js
import express from 'express';

const app = express();

const notices = [
  { id: 1, title: '서버 점검 안내' },
  { id: 2, title: '새 기능 소개' },
];

const bookmarks = {
  minji: [1, 3],
  jaehoon: [2],
};

// 실습용 — 요청 헤더 X-User 에 적힌 이름을 그대로 믿는다.
function requireUser(req, res, next) {
  const username = req.get('X-User');

  if (!username) {
    res.status(401).json({ message: '로그인이 필요해요' });
    return;
  }

  res.locals.username = username;
  next();
}

// 누구나
app.get('/api/notices', (req, res) => {
  res.json(notices);
});

// 로그인한 사람만 — 내 정보와 내가 저장한 게시물
const meRouter = express.Router();

meRouter.use(requireUser);

meRouter.get('/', (req, res) => {
  res.json({ username: res.locals.username });
});

meRouter.get('/bookmarks', (req, res) => {
  res.json(bookmarks[res.locals.username] ?? []);
});

app.use('/api/me', meRouter);

app.use((req, res) => {
  res.status(404).json({ message: '그런 주소는 없어요' });
});

app.listen(4001, () => {
  console.log('실습 서버가 4001번 포트에서 기다리고 있어요.');
});
