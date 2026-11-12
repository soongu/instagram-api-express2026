// ~/instagram-api/lab/p3-43/practice3.js
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

// 관리자만 다음으로 보낸다 — 토큰의 역할로 먼저 거르고, 관리자라고 적힌 토큰이면
// 수업 서버의 «나는 누구» 에 같은 토큰을 보내 지금 역할을 다시 본다. 이 서버에는 데이터베이스가 없어서다.
async function requireAdmin(req, res, next) {
  if (res.locals.role !== 'ADMIN') {
    res.status(403).json({ message: '관리자만 할 수 있어요' });
    return;
  }

  let role;
  try {
    const response = await fetch('http://localhost:3000/api/v2/auth/me', {
      headers: { Authorization: req.headers.authorization },
    });
    role = response.ok ? (await response.json()).data.role : undefined;
  } catch {
    // 수업 서버가 꺼져 있으면 지금 역할을 알 수 없다 — 모르면 막는다.
    res.status(503).json({ message: '지금은 관리자인지 확인할 수 없어요' });
    return;
  }

  if (role !== 'ADMIN') {
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

app.listen(4003, () => {
  console.log('4003번 포트에서 공지 서버가 돌아가요');
});
