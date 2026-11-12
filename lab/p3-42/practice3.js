// ~/instagram-api/lab/p3-42/practice3.js
import express from 'express';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';

const app = express();

// 직접 해보기 2 에서 .env 에 넣은 키를 쓴다.
const SECRET = process.env.LAB_SECRET;

// 로그아웃한 토큰의 번호(jti) → 그 토큰이 끝나는 시각(초). 끝난 토큰은 어차피 막히니 그때까지만 둔다.
const revoked = new Map();

app.use(express.json());

// 서명과 기한을 확인하고, 로그아웃한 토큰이면 막는다.
function requireToken(req, res, next) {
  const header = req.headers.authorization ?? '';

  try {
    const payload = jwt.verify(header.slice('Bearer '.length), SECRET, { algorithms: ['HS256'] });

    if (revoked.has(payload.jti)) {
      return res.status(401).json({ message: '로그아웃한 토큰이에요' });
    }

    res.locals.payload = payload;
    next();
  } catch {
    res.status(401).json({ message: '로그인이 필요해요' });
  }
}

// 토큰마다 번호(jti)를 붙여 만든다 — 그 번호로 토큰 하나를 가리킬 수 있다.
app.post('/login', (req, res) => {
  const token = jwt.sign({}, SECRET, { subject: req.body.username, jwtid: randomUUID(), expiresIn: '10m', algorithm: 'HS256' });

  res.json({ token });
});

app.post('/logout', requireToken, (req, res) => {
  const { jti, exp } = res.locals.payload;

  revoked.set(jti, exp);

  // 이미 끝난 토큰은 목록에서 지운다 — 목록이 끝없이 늘지 않게.
  const now = Math.floor(Date.now() / 1000);
  for (const [id, end] of revoked) {
    if (end <= now) revoked.delete(id);
  }

  res.json({ message: '로그아웃했어요' });
});

app.get('/me', requireToken, (req, res) => {
  res.json({ username: res.locals.payload.sub });
});

app.listen(4003, () => {
  console.log('4003번 포트에서 차단 목록 실습 서버가 돌아가요');
});
