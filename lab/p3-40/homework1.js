// ~/instagram-api/lab/p3-40/homework1.js
import express from 'express';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';

const app = express();
const COST = 12;

// 이메일이 없을 때 대신 비교할 가짜 해시 — 서버가 뜰 때 한 번만 만든다.
const DUMMY_HASH = await bcrypt.hash(randomUUID(), COST);

// 가입한 회원 — 메모리에만 두니 서버를 다시 켜면 비어요.
const members = [];

app.use(express.json());

app.post('/members', async (req, res) => {
  const { email, password } = req.body;

  if (typeof email !== 'string' || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ message: '이메일과 8자 이상의 비밀번호를 보내 주세요' });
  }
  if (members.some((member) => member.email === email)) {
    return res.status(409).json({ message: '이미 가입한 이메일이에요' });
  }

  const passwordHash = await bcrypt.hash(password, COST);
  members.push({ email, passwordHash });
  console.log('저장한 회원', { email, passwordHash });

  res.status(201).json({ email });
});

// 목록에는 이메일만 싣는다 — 해시도 밖으로 내보내지 않는다.
app.get('/members', (req, res) => {
  res.json(members.map(({ email }) => ({ email })));
});

// 로그인 — 이메일이 없어도 가짜 해시와 비교해서, 실패는 이유와 상관없이 같은 문장으로 비슷한 시간에 답한다.
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

  res.json({ email });
});

app.listen(4011, () => {
  console.log('4011번 포트에서 동아리 가입 서버가 돌아가요');
});
