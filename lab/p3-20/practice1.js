// ~/instagram-api/lab/p3-20/practice1.js
import express from 'express';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';

const users = { dahye: 1, jaehoon: 2, minji: 3 };

// 세션을 남겨 둘 시간 — 30초(밀리초)
const SESSION_TIME = 30 * 1000;

// 세션 ID → { 사람의 번호, 끝나는 시각 }
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
  sessions.set(sessionId, { userId, expiresAt: Date.now() + SESSION_TIME });

  res.cookie('labSession', sessionId, { httpOnly: true, sameSite: 'lax' });
  res.json({ userId });
});

app.get('/me', (req, res) => {
  const session = sessions.get(req.cookies.labSession);

  if (!session) {
    res.status(401).json({ message: '로그인이 필요해요' });
    return;
  }

  // 끝나는 시각이 지났으면 서버가 세션을 지운다.
  if (Date.now() > session.expiresAt) {
    sessions.delete(req.cookies.labSession);
    res
      .status(401)
      .json({ message: '로그인이 끝났어요. 다시 로그인해 주세요' });
    return;
  }

  const leftSeconds = Math.ceil((session.expiresAt - Date.now()) / 1000);
  res.json({ userId: session.userId, leftSeconds });
});

app.listen(4001, () => {
  console.log('실습 서버가 4001번 포트에서 기다리고 있어요.');
});
