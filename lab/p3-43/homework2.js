// ~/instagram-api/lab/p3-43/homework2.js
import express from 'express';
import jwt from 'jsonwebtoken';

const app = express();

// 수업 서버와 같은 비밀키 — 실행할 때 --env-file=.env 로 같은 .env 를 읽는다.
const SECRET = process.env.JWT_SECRET;

// 비밀키가 없으면 뜨지 않게 — 수업 서버의 tokenService 와 같은 확인
if (!SECRET) {
  throw new Error('.env에 JWT_SECRET이 없어요');
}

// 공지 — 메모리에만 둔다. 숨긴 공지는 목록에서 빠진다.
const notices = [
  { id: 1, title: '서버 점검 안내', authorId: 1, hidden: false },
  { id: 2, title: '새 기능 소개', authorId: 1, hidden: false },
];

// 관리 기록 — 누가 · 언제 · 무엇을 · 왜 · 어떻게 끝났는지. 토큰이나 비밀번호는 남기지 않는다.
const auditLog = [];

function record(res, action, result, extra = {}) {
  auditLog.push({ at: new Date().toISOString(), actorId: res.locals.userId, action, result, ...extra });
}

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

// 관리자만 다음으로 보낸다 — 직접 해보기 3 처럼 지금 역할을 다시 보고, 막힌 시도도 기록에 남긴다.
async function requireAdmin(req, res, next) {
  if (res.locals.role !== 'ADMIN') {
    record(res, `${req.method} ${req.path}`, 'DENIED');
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
    record(res, `${req.method} ${req.path}`, 'DENIED');
    res.status(403).json({ message: '관리자만 할 수 있어요' });
    return;
  }

  next();
}

const adminOnly = [requireToken, requireAdmin];

app.get('/notices', (req, res) => {
  res.json(notices.filter((notice) => !notice.hidden));
});

// 공지 숨기기 — 관리자만, 이유를 함께 받는다. 공백만 적은 이유는 빈 것으로 본다.
app.patch('/notices/:id/hide', adminOnly, (req, res) => {
  const reason = req.body?.reason;

  if (typeof reason !== 'string' || reason.trim() === '' || reason.length > 100) {
    return res.status(400).json({ message: '숨기는 이유를 100자 안으로 적어 주세요' });
  }

  const notice = notices.find((one) => one.id === Number(req.params.id));

  if (!notice) {
    return res.status(404).json({ message: '그런 공지는 없어요' });
  }

  notice.hidden = true;
  record(res, 'HIDE_NOTICE', 'OK', { targetId: notice.id, reason: reason.trim() });
  res.json(notice);
});

// 관리 기록 보기 — 관리자만. 최근 기록이 위로 오게.
app.get('/audit', adminOnly, (req, res) => {
  res.json([...auditLog].reverse());
});

app.listen(4012, () => {
  console.log('4012번 포트에서 공지 서버가 돌아가요');
});
