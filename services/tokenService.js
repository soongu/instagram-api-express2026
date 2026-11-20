// ~/instagram-api/services/tokenService.js
import jwt from 'jsonwebtoken';

// 토큰에 서명할 비밀키 — .env 의 JWT_SECRET 을 읽는다.
const SECRET = process.env.JWT_SECRET;

// 비밀키가 없으면 서버가 뜨지 않게 여기서 멈춘다 — 로그인할 때가 아니라 뜰 때 알게 된다.
if (!SECRET) {
  throw new Error('.env에 JWT_SECRET이 없어요');
}

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

// 토큰의 서명과 기한을 확인하고 담긴 값을 돌려준다 — 서명이 틀렸거나 기한이 지났으면 null.
// 받을 알고리즘은 HS256 하나로 정한다 — 토큰 헤더의 alg 가 무엇이라고 하든 그것만 받는다.
export function readAccessToken(token) {
  try {
    return jwt.verify(token, SECRET, { algorithms: ['HS256'] });
  } catch {
    return null;
  }
}
