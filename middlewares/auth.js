// ~/instagram-api/middlewares/auth.js
import * as tokenService from '../services/tokenService.js';
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
export function requireLogin(req, res, next) {
  const payload = tokenService.readAccessToken(readToken(req));

  if (!payload) {
    next(new UnauthorizedError('LOGIN_REQUIRED'));
    return;
  }

  // 토큰의 sub 는 글자라 숫자로 바꿔 담는다 — 서비스들은 사람 번호를 숫자로 받는다.
  res.locals.userId = Number(payload.sub);
  // 역할도 토큰에서 꺼낸다 — 역할을 담기 전에 만든 토큰이면 undefined 라 관리자가 아니다.
  res.locals.role = payload.role;
  next();
}

// 관리자만 다음으로 보낸다 — requireLogin 이 토큰에서 꺼내 둔 역할을 본다.
export function requireAdmin(req, res, next) {
  if (res.locals.role !== 'ADMIN') {
    next(new ForbiddenError('ADMIN_ONLY'));
    return;
  }

  next();
}
