// ~/instagram-api/controllers/authController.js
import * as authService from '../services/authService.js';
import * as userService from '../services/userService.js';
import { sendData } from '../responses.js';
import { MESSAGES } from '../errors.js';
import { TOKEN_LIFETIME } from '../services/tokenService.js';
import { readToken } from '../middlewares/auth.js';


// 이미 쓰고 있을 때 보여 줄 문장 — 무엇을 찾았는지에 따라 다르다.
const TAKEN = {
  email: 'EMAIL_TAKEN',
  phone: 'PHONE_TAKEN',
  username: 'USERNAME_TAKEN',
};


export async function signup(req, res) {
  const { emailOrPhone, name, username, password } = req.body;
  const user = await authService.signup({
    emailOrPhone,
    name,
    username,
    password,
  });

  res.status(201);
  sendData(res, { message: '가입했어요', username: user.username });
}

export async function checkDuplicate(req, res) {
  const { type, value } = res.locals.query;
  const taken = await userService.isTaken(type, value);

  sendData(res, {
    available: !taken,
    message: taken ? MESSAGES[TAKEN[type]] : '쓸 수 있어요',
  });
}

export async function login(req, res) {
  const { username, password } = req.body;
  const { user, accessToken } = await authService.login(username, password);

  // 토큰을 쿠키에 담는다 — 스크립트가 못 읽게 httpOnly, 토큰이 끝나는 1시간 뒤에 쿠키도 사라지게.
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: TOKEN_LIFETIME,
  });

  sendData(res, user);
}

export async function me(req, res) {
  const user = await authService.whoAmI(res.locals.userId);

  sendData(res, user);
}

export async function logout(req, res) {
  await authService.logout(readToken(req));

  res.clearCookie('accessToken');
  sendData(res, { message: '로그아웃했어요' });
}

export async function logoutAll(req, res) {
  await authService.logoutAll(res.locals.userId);

  res.clearCookie('accessToken');
  sendData(res, { message: '모든 기기에서 로그아웃했어요' });
}

