// ~/instagram-api/routes/auth.js
import express from 'express';
import * as userService from '../services/userService.js';
import * as sessionService from '../services/sessionService.js';
import { validateBody } from '../middlewares/validate.js';
import { loginSchema } from '../schemas/authSchema.js';
import { UnauthorizedError } from '../errors.js';

const router = express.Router();

// 로그인 쿠키를 남겨 둘 기간 — 7일(밀리초)
const SEVEN_DAYS = 1000 * 60 * 60 * 24 * 7;

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

// 누가 보냈는지 — 헤더에 적어 보냈으면 그것을, 아니면 쿠키를 본다.
function readUserId(req) {
  const header = req.headers.authorization;

  if (header && header.startsWith('Bearer ')) {
    return Number(header.slice('Bearer '.length));
  }

  // 브라우저가 다시 실어 보낸 쿠키 — cookie-parser 가 `userId=2` 를 { userId: '2' } 로 바꿔 둔다.
  return Number(req.cookies.userId);
}

router.get('/me', async (req, res) => {
  const userId = readUserId(req);

  if (!Number.isInteger(userId)) throw new UnauthorizedError('로그인이 필요해요');

  const user = await userService.findUserById(userId);

  if (!user) throw new UnauthorizedError('로그인이 필요해요');

  res.json(user);
});

export default router;
