// ~/instagram-api/routes/auth.js
import express from 'express';
import * as userService from '../services/userService.js';
import { validateBody } from '../middlewares/validate.js';
import { loginSchema } from '../schemas/authSchema.js';
import { UnauthorizedError } from '../errors.js';

const SEVEN_DAYS = 1000 * 60 * 60 * 24 * 7;

const router = express.Router();

router.post('/login', validateBody(loginSchema), async (req, res) => {
  const user = await userService.findUserByUsername(req.body.username);

  if (!user) throw new UnauthorizedError('그런 사용자는 없어요');

  // 비밀번호 확인은 아직 없다 — 이름만 맞으면 그 사람의 번호를 쿠키에 담아 준다.
  res.cookie('userId', String(user.id), {
    maxAge: SEVEN_DAYS,
  });

  res.json(user);
});


router.get('/me', async (req, res) => {
  // 브라우저가 다시 실어 보낸 쿠키 — cookie-parser 가 `userId=2` 를 { userId: '2' } 로 바꿔 둔다.
  const userId = Number(req.cookies.userId);

  if (!Number.isInteger(userId))
    throw new UnauthorizedError('로그인이 필요해요');

  const user = await userService.findUserById(userId);

  if (!user) throw new UnauthorizedError('로그인이 필요해요');

  res.json(user);
});

export default router;
