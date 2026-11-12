// ~/instagram-api/lab/p3-44/homework1.js
import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createHash, randomBytes, randomUUID } from 'node:crypto';

const app = express();
const COST = 12;

// 이 서버만 쓰는 비밀키 — 수업 서버의 JWT_SECRET 과 다른 키를 .env 의 CLUB_SECRET 에 둔다.
const SECRET = process.env.CLUB_SECRET;

// 비밀키가 없으면 뜨지 않게 — 로그인할 때가 아니라 뜰 때 알게 된다.
if (!SECRET) {
  throw new Error('.env에 CLUB_SECRET이 없어요');
}

// 토큰을 쓸 수 있는 시간 — 5분(밀리초).
const ACCESS_LIFETIME = 1000 * 60 * 5;
// 로그인을 남겨 둘 기간 — 7일(밀리초). 새 토큰을 받을 때마다 다시 7일로 미룬다. 쿠키 둘의 maxAge 도 이 값을 쓴다.
const LOGIN_LIFETIME = 1000 * 60 * 60 * 24 * 7;

// 이메일이 없을 때 대신 비교할 가짜 해시 — 서버가 뜰 때 한 번만 만든다.
const DUMMY_HASH = await bcrypt.hash(randomUUID(), COST);

// 가입한 회원 — 메모리에만 두니 서버를 다시 켜면 비어요. 회원마다 1부터 번호(id)를 매긴다.
// 역할(role)은 운영진 MANAGER 와 회원 MEMBER 둘이다.
const members = [];
// 다음 회원 번호 — 내보낸 회원의 번호를 다른 사람에게 다시 주지 않으려고 따로 센다.
let nextId = 1;
// 로그인 기록 — 로그인 ID → { memberId, secretHash, previousHash, expiresAt }. Refresh 토큰의 비밀값은 해시로만 둔다.
// previousHash 는 바로 앞 비밀값의 해시 — 그 값이 다시 오면 이미 쓴 토큰이 다시 온 것이다.
const logins = new Map();

const hashSecret = (secret) => createHash('sha256').update(secret).digest('hex');

// 토큰 둘을 쿠키에 담는다 — Refresh 쿠키는 /auth 로 시작하는 주소에만 실려 가게.
function setTokens(res, member, loginId, secret) {
  const token = jwt.sign({ sid: loginId, role: member.role }, SECRET, { subject: String(member.id), expiresIn: ACCESS_LIFETIME / 1000, algorithm: 'HS256' });
  res.cookie('clubToken', token, { httpOnly: true, sameSite: 'lax', maxAge: LOGIN_LIFETIME });
  res.cookie('clubRefresh', `${loginId}.${secret}`, { httpOnly: true, sameSite: 'lax', path: '/auth', maxAge: LOGIN_LIFETIME });
}

app.use(express.json());
app.use(cookieParser());

// 로그인한 회원만 다음으로 보낸다 — 토큰의 서명과 기한만 본다. 토큰의 sub 는 회원 번호, role 은 역할이다.
// 기한만 지난 토큰은 code 로 따로 알린다 — 받는 쪽이 이것을 보고 새 토큰을 받는다.
function requireMember(req, res, next) {
  try {
    const payload = jwt.verify(req.cookies.clubToken, SECRET, { algorithms: ['HS256'] });
    res.locals.memberId = Number(payload.sub);
    res.locals.role = payload.role;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ code: 'TOKEN_EXPIRED', message: '토큰의 기한이 지났어요' });
    }

    res.status(401).json({ message: '로그인이 필요해요' });
  }
}

// 운영진만 다음으로 보낸다 — requireMember 가 토큰에서 꺼내 둔 역할을 본다.
function requireManager(req, res, next) {
  if (res.locals.role !== 'MANAGER') {
    return res.status(403).json({ message: '운영진만 할 수 있어요' });
  }

  next();
}

app.post('/members', async (req, res) => {
  const { email, password } = req.body;

  if (typeof email !== 'string' || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ message: '이메일과 8자 이상의 비밀번호를 보내 주세요' });
  }
  if (members.some((member) => member.email === email)) {
    return res.status(409).json({ message: '이미 가입한 이메일이에요' });
  }

  const passwordHash = await bcrypt.hash(password, COST);
  // 역할은 본문에서 받지 않는다 — 첫 가입자만 운영진이고, 그 뒤로는 모두 회원이다.
  const role = members.length === 0 ? 'MANAGER' : 'MEMBER';
  members.push({ id: nextId, email, passwordHash, role });
  nextId += 1;

  res.status(201).json({ email });
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ message: '이메일과 비밀번호를 보내 주세요' });
  }

  const member = members.find((m) => m.email === email);
  const matched = await bcrypt.compare(password, member?.passwordHash ?? DUMMY_HASH);

  if (!member || !matched) {
    return res.status(401).json({ message: '이메일이나 비밀번호가 맞지 않아요' });
  }

  // 로그인 기록을 하나 남기고, 그 기록을 가리키는 토큰 둘을 준다.
  const loginId = randomUUID();
  const secret = randomBytes(32).toString('base64url');
  logins.set(loginId, { memberId: member.id, secretHash: hashSecret(secret), previousHash: null, expiresAt: Date.now() + LOGIN_LIFETIME });
  setTokens(res, member, loginId, secret);

  res.json({ email });
});

// 새 토큰 받기 — 기록이 있고 기한이 남았고 비밀값이 맞으면 비밀값을 새것으로 바꾸고(회전) 지금 역할로 토큰을 다시 만든다.
app.post('/auth/refresh', (req, res) => {
  const [loginId, secret] = (req.cookies.clubRefresh ?? '').split('.');
  const login = logins.get(loginId);

  if (!login || login.expiresAt <= Date.now()) {
    logins.delete(loginId);
    return res.status(401).json({ message: '다시 로그인해 주세요' });
  }
  const hash = hashSecret(secret ?? '');

  if (login.secretHash !== hash) {
    // 바로 앞 비밀값이 다시 왔다 — 이미 쓴(또는 훔친) 토큰이니 그 로그인 기록을 지운다. 지어낸 값이면 지우지 않는다.
    if (login.previousHash === hash) {
      logins.delete(loginId);
    }
    return res.status(401).json({ message: '다시 로그인해 주세요' });
  }

  // 내보낸 회원이면 새 토큰을 주지 않는다 — 역할도 지금 회원 목록에서 다시 읽는다.
  const member = members.find((m) => m.id === login.memberId);

  if (!member) {
    logins.delete(loginId);
    return res.status(401).json({ message: '다시 로그인해 주세요' });
  }

  const nextSecret = randomBytes(32).toString('base64url');
  login.previousHash = hash;
  login.secretHash = hashSecret(nextSecret);
  login.expiresAt = Date.now() + LOGIN_LIFETIME;
  setTokens(res, member, loginId, nextSecret);

  res.json({ message: '새 토큰을 받았어요' });
});

// 로그아웃 — Refresh 토큰이 가리키는 기록을 지우고(비밀값까지 맞을 때만) 쿠키 둘을 지운다.
app.post('/auth/logout', (req, res) => {
  const [loginId, secret] = (req.cookies.clubRefresh ?? '').split('.');
  const login = logins.get(loginId);

  if (login && secret && login.secretHash === hashSecret(secret)) {
    logins.delete(loginId);
  }

  res.clearCookie('clubToken');
  res.clearCookie('clubRefresh', { path: '/auth' });
  res.json({ message: '로그아웃했어요' });
});

// 여기부터는 로그인한 회원만 지나간다 — 가입·로그인·로그아웃은 위에 둔다.
app.use(requireMember);

// 회원 목록은 운영진만 본다 — 번호·이메일·역할까지.
app.get('/members', requireManager, (req, res) => {
  res.json(members.map(({ id, email, role }) => ({ id, email, role })));
});

// 회원 내보내기도 운영진만 한다. 자기 자신은 내보낼 수 없다 — 운영진이 아무도 안 남을 수 있어서다.
app.delete('/members/:id', requireManager, (req, res) => {
  const id = Number(req.params.id);

  if (id === res.locals.memberId) {
    return res.status(400).json({ message: '자기 자신은 내보낼 수 없어요' });
  }

  const index = members.findIndex((member) => member.id === id);

  if (index === -1) {
    return res.status(404).json({ message: '그런 회원은 없어요' });
  }

  const [removed] = members.splice(index, 1);
  res.json({ email: removed.email });
});

// 나는 누구 — 토큰의 번호로 회원을 찾아 이메일을 돌려준다. 서버를 다시 켜 회원이 비었으면 401.
app.get('/me', (req, res) => {
  const member = members.find((m) => m.id === res.locals.memberId);

  if (!member) {
    return res.status(401).json({ message: '로그인이 필요해요' });
  }

  res.json({ email: member.email });
});

app.listen(4011, () => {
  console.log('4011번 포트에서 동아리 서버가 돌아가요');
});
