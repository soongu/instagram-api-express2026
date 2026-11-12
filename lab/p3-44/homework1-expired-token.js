// ~/instagram-api/lab/p3-44/homework1-expired-token.js
// 동아리 서버의 비밀키로, 기한이 1분 전에 지난 1번 회원의 토큰을 만든다.
import jwt from 'jsonwebtoken';

const token = jwt.sign({ role: 'MANAGER' }, process.env.CLUB_SECRET, {
  subject: '1',
  expiresIn: -60,
  algorithm: 'HS256',
});

console.log(token);
