// ~/instagram-api/lab/p3-43/practice2.js
import express from 'express';
import jwt from 'jsonwebtoken';

const app = express();

// 수업 서버와 같은 비밀키 — 실행할 때 --env-file=.env 로 같은 .env 를 읽는다.
const SECRET = process.env.JWT_SECRET;

// 비밀키가 없으면 뜨지 않게 — 수업 서버의 tokenService 와 같은 확인
if (!SECRET) {
  throw new Error('.env에 JWT_SECRET이 없어요');
}

// 공지 — 메모리에만 둔다. 이 서버는 데이터베이스에 연결하지 않는다.
const notices = [
  { id: 1, title: '서버 점검 안내', authorId: 1 },
  { id: 2, title: '새 기능 소개', authorId: 1 },
];

app.use(express.json());

// 토큰을 확인해 누가 보냈는지와 역할을 정한다 — 수업 서버에 묻지 않고, 서명과 기한만 본다.
function requireToken(req, res, next) {
  const header = req.headers.authorization ?? '';

  try {
    const payload = jwt.verify(header.slice('Bearer '.length), SECRET, { algorithms: ['HS256'] });
    res.locals.userId = Number(payload.sub);
    res.locals.role = payload.role;
    next();
  } catch {
    res.status(401).json({ message: '로그인이 필요해요' });
  }
}

// 관리자만 다음으로 보낸다 — 라우터를 배울 때의 공지 서버와 같은 함수이고, 비교하는 값만 'ADMIN' 이다.
function requireAdmin(req, res, next) {
  if (res.locals.role !== 'ADMIN') {
    res.status(403).json({ message: '관리자만 할 수 있어요' });
    return;
  }

  next();
}

const adminOnly = [requireToken, requireAdmin];

app.get('/notices', (req, res) => {
  res.json(notices);
});

app.delete('/notices/:id', adminOnly, (req, res) => {
  const index = notices.findIndex((notice) => notice.id === Number(req.params.id));

  if (index === -1) {
    return res.status(404).json({ message: '그런 공지는 없어요' });
  }

  const [deleted] = notices.splice(index, 1);
  res.json(deleted);
});

app.listen(4002, () => {
  console.log('4002번 포트에서 공지 서버가 돌아가요');
});
