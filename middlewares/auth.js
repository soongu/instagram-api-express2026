// ~/instagram-api/middlewares/auth.js
import * as tokenService from '../services/tokenService.js';
import * as userService from '../services/userService.js';
import { ForbiddenError, UnauthorizedError } from '../errors.js';

// 요청에 실려 온 토큰 — 헤더에 적어 보냈으면 그것을, 아니면 쿠키를 본다.
export function readToken(req) {
  const header = req.headers.authorization;

  if (header && header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length);
  }

  return req.cookies.accessToken;
}

// 로그인한 사람만 다음으로 보낸다 — 토큰의 서명과 기한만 확인하고, 데이터베이스는 찾아보지 않는다.
// 기한만 지난 토큰은 TOKEN_EXPIRED 로 따로 알린다 — 화면은 이 코드를 보고 새 토큰을 받는다.
export function requireLogin(req, res, next) {
  let payload;

  try {
    payload = tokenService.verifyAccessToken(readToken(req));
  } catch (error) {
    next(new UnauthorizedError(error.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'LOGIN_REQUIRED'));
    return;
  }

  // 토큰의 sub 는 글자라 숫자로 바꿔 담는다 — 서비스들은 사람 번호를 숫자로 받는다.
  res.locals.userId = Number(payload.sub);
  // 역할도 토큰에서 꺼낸다 — 역할을 담기 전에 만든 토큰이면 undefined 라 관리자가 아니다.
  res.locals.role = payload.role;
  // 어느 로그인 기록으로 들어온 요청인지도 담아 둔다 — 소셜 계정을 이을 때 떠날 때와 돌아올 때가 같은 로그인인지 확인한다.
  res.locals.sessionId = payload.sid;
  next();
}

// 관리자만 다음으로 보낸다 — 토큰의 역할로 먼저 거르고,
// 토큰이 관리자라고 할 때만 데이터베이스에서 지금 역할을 한 번 더 본다(역할을 내렸어도 토큰은 만료까지 ADMIN 이라서).
export async function requireAdmin(req, res, next) {
  if (res.locals.role !== 'ADMIN' || !(await userService.isAdmin(res.locals.userId))) {
    next(new ForbiddenError('ADMIN_ONLY'));
    return;
  }

  next();
}
