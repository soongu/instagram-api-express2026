// ~/instagram-api/middlewares/auth.js
import * as sessionService from '../services/sessionService.js';
import { UnauthorizedError } from '../errors.js';

// 요청에 실려 온 세션 ID — 헤더에 적어 보냈으면 그것을, 아니면 쿠키를 본다.
export function readSessionId(req) {
  const header = req.headers.authorization;

  if (header && header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length);
  }

  return req.cookies.sessionId;
}

// 로그인한 사람만 다음으로 보낸다 — 찾은 사람의 번호는 res.locals.userId 에 담아 둔다.
export async function requireLogin(req, res, next) {
  const userId = await sessionService.getUserId(readSessionId(req));

  if (!userId) {
    next(new UnauthorizedError('LOGIN_REQUIRED'));
    return;
  }

  res.locals.userId = userId;
  next();
}
