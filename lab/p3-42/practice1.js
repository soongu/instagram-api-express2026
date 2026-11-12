// ~/instagram-api/lab/p3-42/practice1.js
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';

const app = express();

// 수업 서버와 같은 비밀키 — 실행할 때 --env-file=.env 로 같은 .env 를 읽는다.
const SECRET = process.env.JWT_SECRET;

// 공지 — 메모리에만 둔다. 이 서버는 데이터베이스에 연결하지 않는다.
const notices = [{ id: 1, title: '서버 점검 안내', authorId: 1 }];

app.use(express.json());
app.use(cookieParser());

// 토큰을 확인해 누가 보냈는지 정한다 — 수업 서버에 묻지 않고, 서명과 기한만 본다.
function requireToken(req, res, next) {
  const header = req.headers.authorization;
  const token = header && header.startsWith('Bearer ') ? header.slice('Bearer '.length) : req.cookies.accessToken;

  try {
    const payload = jwt.verify(token, SECRET, { algorithms: ['HS256'] });
    res.locals.userId = Number(payload.sub);
    next();
  } catch {
    res.status(401).json({ message: '로그인이 필요해요' });
  }
}

app.get('/notices', (req, res) => {
  res.json(notices);
});

app.post('/notices', requireToken, (req, res) => {
  const notice = { id: notices.length + 1, title: req.body.title, authorId: res.locals.userId };

  notices.push(notice);
  res.status(201).json(notice);
});

app.listen(4001, () => {
  console.log('4001번 포트에서 공지 서버가 돌아가요');
});
