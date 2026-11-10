// ~/instagram-api/controllers/authController.js
import * as authService from '../services/authService.js';
import * as userService from '../services/userService.js';
import { sendData } from '../responses.js';
import { MESSAGES } from '../errors.js';

// 로그인 쿠키를 남겨 둘 기간 — 7일(밀리초)
const SEVEN_DAYS = 1000 * 60 * 60 * 24 * 7;

// 이미 쓰고 있을 때의 에러 코드 — 무엇을 찾았는지에 따라 다르다. 문장은 가입이 409 로 실패할 때와 같다.
const TAKEN = {
  email: 'EMAIL_TAKEN',
  phone: 'PHONE_TAKEN',
  username: 'USERNAME_TAKEN',
};

// 요청에 실려 온 세션 ID — 헤더에 적어 보냈으면 그것을, 아니면 쿠키를 본다.
function readSessionId(req) {
  const header = req.headers.authorization;

  if (header && header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length);
  }

  return req.cookies.sessionId;
}

export async function signup(req, res) {
  const { emailOrPhone, name, username, password } = req.body;
  const user = await authService.signup({ emailOrPhone, name, username, password });

  res.status(201);
  sendData(res, { message: '가입했어요', username: user.username });
}

export async function checkDuplicate(req, res) {
  const { type, value } = res.locals.query;
  const taken = await userService.isTaken(type, value);

  sendData(res, { available: !taken, message: taken ? MESSAGES[TAKEN[type]] : '쓸 수 있어요' });
}

export async function login(req, res) {
  const { user, sessionId } = await authService.login(req.body.username);

  // 쿠키에는 그 세션 ID만 담아 준다.
  res.cookie('sessionId', sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: SEVEN_DAYS,
  });

  sendData(res, user);
}

export async function me(req, res) {
  const user = await authService.whoAmI(readSessionId(req));

  sendData(res, user);
}

export function logout(req, res) {
  authService.logout(readSessionId(req));

  res.clearCookie('sessionId');
  sendData(res, { message: '로그아웃했어요' });
}
