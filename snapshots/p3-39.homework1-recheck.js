// ~/instagram-api/lab/p3-39/homework1.js
import express from 'express';
import bcrypt from 'bcrypt';

const app = express();
const COST = 12;

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
  // 해시를 기다리는 사이에 같은 이메일이 먼저 들어왔을 수 있다 — 넣기 직전에 한 번 더 본다.
  if (members.some((member) => member.email === email)) {
    return res.status(409).json({ message: '이미 가입한 이메일이에요' });
  }
  members.push({ email, passwordHash });
  console.log('저장한 회원', { email, passwordHash });

  res.status(201).json({ email });
});

// 목록에는 이메일만 싣는다 — 해시도 밖으로 내보내지 않는다.
app.get('/members', (req, res) => {
  res.json(members.map(({ email }) => ({ email })));
});

app.listen(4011, () => {
  console.log('4011번 포트에서 동아리 가입 서버가 돌아가요');
});
