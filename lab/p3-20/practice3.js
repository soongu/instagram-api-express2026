// ~/instagram-api/lab/p3-20/practice3.js
import express from 'express';
import jwt from 'jsonwebtoken';

const SECRET = 'my-lab-secret';
const users = { dahye: 1, jaehoon: 2, minji: 3 };

const app = express();

app.use(express.json());

app.post('/login', (req, res) => {
  const userId = users[req.body.username];

  if (!userId) {
    res.status(401).json({ message: '그런 사용자는 없어요' });
    return;
  }

  // 서버는 아무것도 저장하지 않는다 — 누구인지를 토큰에 담고 서명해서 건네준다.
  const accessToken = jwt.sign({ sub: String(userId) }, SECRET, { expiresIn: '15m' });
  res.json({ accessToken });
});

app.get('/me', (req, res) => {
  const header = req.headers.authorization ?? '';

  try {
    const payload = jwt.verify(header.slice('Bearer '.length), SECRET);
    res.json({ userId: Number(payload.sub) });
  } catch (error) {
    res.status(401).json({ message: '로그인이 필요해요' });
  }
});

app.listen(4003, () => {
  console.log('실습 서버가 4003번 포트에서 기다리고 있어요.');
});
