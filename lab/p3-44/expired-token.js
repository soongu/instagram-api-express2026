// ~/instagram-api/lab/p3-44/expired-token.js
// 기한이 1분 전에 지난 토큰을 만든다 — 15분을 기다리지 않고 «끝난 토큰» 을 서버에 보내 보려고.
import jwt from 'jsonwebtoken';

// 수업 백엔드와 같은 비밀키 · 같은 알고리즘으로 서명한다 — 서명은 맞고, 기한만 지났다.
const token = jwt.sign({ role: 'USER' }, process.env.JWT_SECRET, {
  subject: '2',
  expiresIn: -60,
  algorithm: 'HS256',
});

console.log(token);
