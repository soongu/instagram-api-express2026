// ~/instagram-api/routes/auth.js
import express from 'express';
import * as userService from '../services/userService.js';
import * as sessionService from '../services/sessionService.js';
import { validateBody, validateQuery } from '../middlewares/validate.js';
import { allowOnly } from '../middlewares/methods.js';
import { loginSchema, signupSchema, checkDuplicateSchema, PHONE } from '../schemas/authSchema.js';
import { UnauthorizedError } from '../errors.js';

const router = express.Router();

// 로그인 쿠키를 남겨 둘 기간 — 7일(밀리초)
const SEVEN_DAYS = 1000 * 60 * 60 * 24 * 7;

router.post('/signup', validateBody(signupSchema), async (req, res) => {
  const { emailOrPhone, name, username } = req.body;

  // 휴대폰 번호 모양이면 phone 에, 아니면 email 에 넣는다 — 번호를 맞추는 일은 서비스가 한다.
  const contact = PHONE.test(emailOrPhone) ? { phone: emailOrPhone } : { email: emailOrPhone };

  // 비밀번호는 아직 저장하지 않는다 — 안전하게 저장하는 법은 서버에서 인증을 구현하는 구간에서 배운다.
  const user = await userService.createUser({ username, name, ...contact });

  res.status(201).json({ message: '가입했어요', username: user.username });
});

// 이미 쓰고 있을 때 보여 줄 문장 — 무엇을 찾았는지에 따라 다르다.
const TAKEN = {
  email: '이미 가입한 이메일이에요',
  phone: '이미 가입한 휴대폰 번호예요',
  username: '이미 쓰고 있는 사용자 이름이에요',
};

router.get('/check-duplicate', validateQuery(checkDuplicateSchema), async (req, res) => {
  const { type, value } = res.locals.query;
  const taken = await userService.isTaken(type, value);

  res.json({ available: !taken, message: taken ? TAKEN[type] : '쓸 수 있어요' });
});

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

router.all('/signup', allowOnly('POST'));
router.all('/check-duplicate', allowOnly('GET'));
router.all('/login', allowOnly('POST'));
router.all('/me', allowOnly('GET'));
router.all('/logout', allowOnly('POST'));

export default router;
