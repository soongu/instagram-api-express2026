// ~/instagram-api/lab/p3-41/practice2.js
import express from 'express';
import cookieParser from 'cookie-parser';
import { requireLogin } from '../../middlewares/auth.js';

const app = express();

// 공지는 메모리에만 둔다 — 서버를 다시 켜면 처음 하나로 돌아간다.
const notices = [{ id: 1, authorId: 1, title: '이번 주 점검 안내' }];

app.use(express.json());
// requireLogin 이 쿠키에서 세션 ID 를 읽는다 — 그보다 먼저 쿠키를 꺼내 둔다.
app.use(cookieParser());

// 공지 목록은 누구나 본다 — 로그인 확인보다 «위» 에 둔다.
app.get('/notices', (req, res) => {
  res.json(notices);
});

// 여기부터는 로그인한 사람만 지나간다.
app.use(requireLogin);

// 공지는 로그인한 사람만 올린다 — 쓴 사람은 로그인 정보로 정한다.
app.post('/notices', (req, res) => {
  const notice = { id: notices.length + 1, authorId: res.locals.userId, title: req.body.title };

  notices.push(notice);
  res.status(201).json(notice);
});

// requireLogin 이 넘긴 401 을 JSON 으로 답한다.
app.use((err, req, res, next) => {
  res.status(err.status ?? 500).json({ message: err.message });
});

app.listen(4002, () => {
  console.log('4002번 포트에서 공지 서버가 돌아가요');
});
