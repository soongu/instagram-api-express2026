// ~/instagram-api/services/tokenService.js
import jwt from 'jsonwebtoken';

// 토큰에 서명할 비밀키 — .env 의 JWT_SECRET 을 읽는다.
const SECRET = process.env.JWT_SECRET;

// 비밀키가 없으면 서버가 뜨지 않게 여기서 멈춘다 — 로그인할 때가 아니라 뜰 때 알게 된다.
if (!SECRET) {
  throw new Error('.env에 JWT_SECRET이 없어요');
}

// 토큰을 쓸 수 있는 시간 — 15분(밀리초). 토큰을 담는 쿠키는 이보다 오래, 로그인 기한 동안 둔다.
// .env 에 ACCESS_TOKEN_SECONDS 가 있으면 그 초만큼으로 바꾼다 - 기한이 지난 뒤의 일을 15분 기다리지 않고 겪어 보려고 둔 값이다.
// 비워 두거나 숫자가 아니면 15분 그대로다.
export const TOKEN_LIFETIME = 1000 * (Number(process.env.ACCESS_TOKEN_SECONDS) || 60 * 15);

// 로그인한 사람에게 줄 토큰 — 누구인지(sub), 어느 로그인인지(sid), 무엇을 할 수 있는 사람인지(role)를 담아 서명한다.
export function createAccessToken(user, sessionId) {
  return jwt.sign({ sid: sessionId, role: user.role }, SECRET, {
    subject: String(user.id),
    // expiresIn 은 초 단위라 1000으로 나눈다.
    expiresIn: TOKEN_LIFETIME / 1000,
    algorithm: 'HS256',
  });
}

// 토큰의 서명과 기한을 확인하고 담긴 값을 돌려준다 — 서명이 틀렸거나 기한이 지났으면 에러를 던진다.
// 기한만 지났으면 에러의 이름이 TokenExpiredError 라, 받는 쪽이 둘을 가를 수 있다.
// 받을 알고리즘은 HS256 하나로 정한다 — 토큰 헤더의 alg 가 무엇이라고 하든 그것만 받는다.
export function verifyAccessToken(token) {
  return jwt.verify(token, SECRET, { algorithms: ['HS256'] });
}
