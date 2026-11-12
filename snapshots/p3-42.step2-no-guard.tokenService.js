// ~/instagram-api/services/tokenService.js
import jwt from 'jsonwebtoken';

// 토큰에 서명할 비밀키 — .env 의 JWT_SECRET 을 읽는다.
const SECRET = process.env.JWT_SECRET;

// 토큰을 쓸 수 있는 시간 — 1시간(밀리초). 로그인 쿠키의 maxAge 도 이 값을 쓴다.
export const TOKEN_LIFETIME = 1000 * 60 * 60;

// 로그인한 사람에게 줄 토큰 — 누구인지(sub)와 어느 로그인인지(sid)를 담아 서명한다.
export function createAccessToken(userId, sessionId) {
  return jwt.sign({ sid: sessionId }, SECRET, {
    subject: String(userId),
    // expiresIn 은 초 단위라 1000으로 나눈다.
    expiresIn: TOKEN_LIFETIME / 1000,
    algorithm: 'HS256',
  });
}
