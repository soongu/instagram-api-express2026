// ~/instagram-api/lab/p3-42/practice2.js
import express from 'express';
import jwt from 'jsonwebtoken';

const app = express();

// 지금 서명에 쓰는 키와, 바꾸기 전에 쓰던 키 — 옛 키는 없을 수도 있다.
const SECRET = process.env.LAB_SECRET;
const OLD_SECRET = process.env.LAB_OLD_SECRET;

app.use(express.json());

// 지금 키로 먼저 확인하고, 안 맞으면 옛 키로 한 번 더 — 둘 중 하나라도 맞으면 그 토큰을 받는다.
function readToken(token) {
  for (const secret of [SECRET, OLD_SECRET]) {
    if (!secret) continue;

    try {
      return jwt.verify(token, secret, { algorithms: ['HS256'] });
    } catch {
      // 이 키로는 서명이 안 맞는다 — 다음 키로
    }
  }

  return null;
}

// 새 토큰은 언제나 지금 키로만 만든다.
app.post('/login', (req, res) => {
  const token = jwt.sign({}, SECRET, { subject: req.body.username, expiresIn: '10m', algorithm: 'HS256' });

  res.json({ token });
});

app.get('/me', (req, res) => {
  const header = req.headers.authorization ?? '';
  const payload = readToken(header.slice('Bearer '.length));

  if (!payload) {
    return res.status(401).json({ message: '로그인이 필요해요' });
  }

  res.json({ username: payload.sub });
});

app.listen(4002, () => {
  console.log('4002번 포트에서 키 바꾸기 실습 서버가 돌아가요');
});
