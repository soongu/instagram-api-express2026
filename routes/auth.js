// ~/instagram-api/routes/auth.js
import express from 'express';
import * as userService from '../services/userService.js';
import { validateBody } from '../middlewares/validate.js';
import { loginSchema } from '../schemas/authSchema.js';
import { UnauthorizedError } from '../errors.js';

const router = express.Router();

router.post('/login', validateBody(loginSchema), async (req, res) => {
  const user = await userService.findUserByUsername(req.body.username);

  if (!user) throw new UnauthorizedError('그런 사용자는 없어요');

  // 비밀번호 확인은 아직 없다 — 이름만 맞으면 그 사람의 번호를 쿠키에 담아 준다.
  res.cookie('userId', String(user.id));

  res.json(user);
});

export default router;
