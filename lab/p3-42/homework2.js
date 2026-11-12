// ~/instagram-api/lab/p3-42/homework2.js
import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';

const app = express();
const COST = 12;
const SECRET = process.env.CLUB_SECRET;
const TOKEN_LIFETIME = 1000 * 60 * 30;
const DUMMY_HASH = await bcrypt.hash(randomUUID(), COST);

// 회원마다 토큰 버전을 둔다 — 비밀번호를 바꾸면 1 올라가고, 그 전에 내준 토큰은 버전이 안 맞는다.
const members = [];

app.use(express.json());
app.use(cookieParser());

// 이 회원의 지금 버전을 담아 토큰을 만들고 쿠키에 싣는다.
function giveToken(res, member) {
  const token = jwt.sign({ ver: member.tokenVersion }, SECRET, { subject: member.email, expiresIn: TOKEN_LIFETIME / 1000, algorithm: 'HS256' });
  res.cookie('clubToken', token, { httpOnly: true, sameSite: 'lax', maxAge: TOKEN_LIFETIME });
}

// 서명과 기한을 확인한 뒤, 토큰의 버전이 그 회원의 지금 버전과 같은지 한 번 더 본다.
function requireMember(req, res, next) {
  try {
    const payload = jwt.verify(req.cookies.clubToken, SECRET, { algorithms: ['HS256'] });
    const member = members.find((m) => m.email === payload.sub);

    if (!member || payload.ver !== member.tokenVersion) {
      return res.status(401).json({ message: '로그인이 필요해요' });
    }

    res.locals.member = member;
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
  members.push({ email, passwordHash, tokenVersion: 0 });

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

  giveToken(res, member);
  res.json({ email });
});

app.post('/logout', (req, res) => {
  res.clearCookie('clubToken');
  res.json({ message: '로그아웃했어요' });
});

app.use(requireMember);

// 비밀번호 바꾸기 — 버전을 올려 다른 기기의 토큰을 모두 끊고, 이 기기에는 새 버전의 토큰을 준다.
app.post('/password', async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const { member } = res.locals;

  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({ message: '새 비밀번호는 8자 이상이어야 해요' });
  }
  if (typeof currentPassword !== 'string' || !(await bcrypt.compare(currentPassword, member.passwordHash))) {
    return res.status(401).json({ message: '지금 비밀번호가 맞지 않아요' });
  }

  member.passwordHash = await bcrypt.hash(newPassword, COST);
  member.tokenVersion += 1;
  giveToken(res, member);

  res.json({ message: '비밀번호를 바꿨어요' });
});

app.get('/me', (req, res) => {
  res.json({ email: res.locals.member.email });
});

app.listen(4012, () => {
  console.log('4012번 포트에서 동아리 가입 서버가 돌아가요');
});
