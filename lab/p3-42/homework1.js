// ~/instagram-api/lab/p3-42/homework1.js
import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';

const app = express();
const COST = 12;

// 이 서버만 쓰는 비밀키 — 수업 서버의 JWT_SECRET 과 다른 키를 .env 의 CLUB_SECRET 에 둔다.
const SECRET = process.env.CLUB_SECRET;

// 비밀키가 없으면 뜨지 않게 — 로그인할 때가 아니라 뜰 때 알게 된다.
if (!SECRET) {
  throw new Error('.env에 CLUB_SECRET이 없어요');
}

// 토큰을 쓸 수 있는 시간 — 30분(밀리초). 쿠키의 maxAge 도 이 값을 쓴다.
const TOKEN_LIFETIME = 1000 * 60 * 30;

// 이메일이 없을 때 대신 비교할 가짜 해시 — 서버가 뜰 때 한 번만 만든다.
const DUMMY_HASH = await bcrypt.hash(randomUUID(), COST);

// 가입한 회원 — 메모리에만 두니 서버를 다시 켜면 비어요. 회원마다 1부터 번호(id)를 매긴다.
const members = [];

app.use(express.json());
app.use(cookieParser());

// 로그인한 회원만 다음으로 보낸다 — 토큰의 서명과 기한만 본다. 토큰의 sub 는 회원 번호다.
function requireMember(req, res, next) {
  try {
    const payload = jwt.verify(req.cookies.clubToken, SECRET, { algorithms: ['HS256'] });
    res.locals.memberId = Number(payload.sub);
    next();
  } catch {
    res.status(401).json({ message: '로그인이 필요해요' });
  }
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
  members.push({ id: members.length + 1, email, passwordHash });

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

  // 회원 번호(sub)를 담아 서명한다 — 이메일은 담지 않는다. 서버는 이 토큰을 어디에도 적어 두지 않는다.
  const token = jwt.sign({}, SECRET, { subject: String(member.id), expiresIn: TOKEN_LIFETIME / 1000, algorithm: 'HS256' });
  res.cookie('clubToken', token, { httpOnly: true, sameSite: 'lax', maxAge: TOKEN_LIFETIME });

  res.json({ email });
});

// 로그아웃 — 지울 세션이 없으니 쿠키만 지운다.
app.post('/logout', (req, res) => {
  res.clearCookie('clubToken');
  res.json({ message: '로그아웃했어요' });
});

// 여기부터는 로그인한 회원만 지나간다 — 가입·로그인·로그아웃은 위에 둔다.
app.use(requireMember);

// 회원 목록은 로그인한 회원만 본다.
app.get('/members', (req, res) => {
  res.json(members.map(({ email }) => ({ email })));
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
  console.log('4011번 포트에서 동아리 가입 서버가 돌아가요');
});
