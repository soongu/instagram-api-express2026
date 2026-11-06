// ~/instagram-api/routes/auth.js
import express from 'express';
import * as userService from '../services/userService.js';
import * as sessionService from '../services/sessionService.js';
import { validateBody } from '../middlewares/validate.js';
import { loginSchema } from '../schemas/authSchema.js';
import { UnauthorizedError } from '../errors.js';

const SEVEN_DAYS = 1000 * 60 * 60 * 24 * 7;

const router = express.Router();

router.post('/login', validateBody(loginSchema), async (req, res) => {
  const user = await userService.findUserByUsername(req.body.username);

  if (!user) throw new UnauthorizedError('그런 사용자는 없어요');

  // 비밀번호 확인은 아직 없다 — 이름만 맞으면 세션을 만들고, 쿠키에는 그 세션 ID만 담아 준다.
  const sessionId = sessionService.createSession(user.id);

  res.cookie('sessionId', sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: SEVEN_DAYS,
  });

  res.json(user);
});


// 요청에 실려 온 세션 ID — 헤더에 적어 보냈으면 그것을, 아니면 쿠키를 본다.
function readSessionId(req) {
  const header = req.headers.authorization;

  if (header && header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length);
  }

  return req.cookies.sessionId;
}

router.get('/me', async (req, res) => {
  // 서버가 기억해 둔 세션에서 사람의 번호를 찾는다 — 모르는 세션 ID면 undefined.
  const userId = sessionService.getUserId(readSessionId(req));

  if (!userId) throw new UnauthorizedError('로그인이 필요해요');

  const user = await userService.findUserById(userId);

  if (!user) throw new UnauthorizedError('로그인이 필요해요');

  res.json(user);
});

router.post('/logout', (req, res) => {
  // 서버가 세션을 지운다 — 누가 이 세션 ID를 복사해 뒀어도 이제는 통하지 않는다.
  sessionService.deleteSession(readSessionId(req));

  res.clearCookie('sessionId');
  res.json({ message: '로그아웃했어요' });
});


export default router;
