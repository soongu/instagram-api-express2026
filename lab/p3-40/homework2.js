// ~/instagram-api/lab/p3-40/homework2.js
import express from 'express';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';

const app = express();
const COST = 12;

// 이메일이 없을 때 대신 비교할 가짜 해시 — 서버가 뜰 때 한 번만 만든다.
const DUMMY_HASH = await bcrypt.hash(randomUUID(), COST);

// 가입한 회원 — 메모리에만 두니 서버를 다시 켜면 비어요.
const members = [];

// 이메일마다 1분 동안의 로그인 실패 수 — 실패 횟수는 요청을 보낸 곳(IP)이 아니라 계정에 붙인다.
const WINDOW_MS = 60 * 1000;
const MAX_FAILURES = 5;
const failures = new Map();

// 같은 이메일로 1분 안에 5번 실패하면, 남은 시간 동안 그 이메일의 로그인을 받지 않는다.
function limitLoginFailures(req, res, next) {
  const email = req.body?.email;
  const record = failures.get(email);
  const now = Date.now();

  if (record && now - record.firstAt >= WINDOW_MS) {
    failures.delete(email);
  } else if (record && record.count >= MAX_FAILURES) {
    const seconds = Math.ceil((record.firstAt + WINDOW_MS - now) / 1000);
    res.set('Retry-After', String(seconds));
    return res.status(429).json({ message: '로그인 시도가 너무 많아요. 잠시 뒤에 다시 시도해 주세요' });
  }

  // 응답을 다 보낸 뒤 상태 코드를 보고 센다 — 401 이면 실패를 더하고, 200 이면 기록을 지운다.
  res.on('finish', () => {
    if (res.statusCode === 401) {
      const current = failures.get(email);
      if (current) current.count += 1;
      else failures.set(email, { count: 1, firstAt: Date.now() });
    } else if (res.statusCode === 200) {
      failures.delete(email);
    }
  });

  next();
}

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
app.post('/login', limitLoginFailures, async (req, res) => {
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

app.listen(4012, () => {
  console.log('4012번 포트에서 동아리 가입 서버가 돌아가요');
});
