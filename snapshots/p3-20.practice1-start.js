// ~/instagram-api/lab/p3-20/practice1.js
import express from 'express';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';

const users = { dahye: 1, jaehoon: 2, minji: 3 };

// 세션 ID → 사람의 번호
const sessions = new Map();

const app = express();

app.use(express.json());
app.use(cookieParser());

app.post('/login', (req, res) => {
  const userId = users[req.body.username];

  if (!userId) {
    res.status(401).json({ message: '그런 사용자는 없어요' });
    return;
  }

  const sessionId = randomUUID();
  sessions.set(sessionId, userId);

  res.cookie('labSession', sessionId, { httpOnly: true, sameSite: 'lax' });
  res.json({ userId });
});

app.get('/me', (req, res) => {
  const userId = sessions.get(req.cookies.labSession);

  if (!userId) {
    res.status(401).json({ message: '로그인이 필요해요' });
    return;
  }

  res.json({ userId });
});

app.listen(4001, () => {
  console.log('실습 서버가 4001번 포트에서 기다리고 있어요.');
});
