// ~/instagram-api/controllers/authController.js
import * as authService from '../services/authService.js';
import * as userService from '../services/userService.js';

// 로그인 쿠키를 남겨 둘 기간 — 7일(밀리초)
const SEVEN_DAYS = 1000 * 60 * 60 * 24 * 7;

// 이미 쓰고 있을 때 보여 줄 문장 — 무엇을 찾았는지에 따라 다르다.
const TAKEN = {
  email: '이미 가입한 이메일이에요',
  phone: '이미 가입한 휴대폰 번호예요',
  username: '이미 쓰고 있는 사용자 이름이에요',
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
  const { emailOrPhone, name, username } = req.body;
  const user = await authService.signup({ emailOrPhone, name, username });

  res.status(201).json({ message: '가입했어요', username: user.username });
}

export async function checkDuplicate(req, res) {
  const { type, value } = res.locals.query;
  const taken = await userService.isTaken(type, value);

  res.json({
    available: !taken,
    message: taken ? TAKEN[type] : '쓸 수 있어요',
  });
}

export async function login(req, res) {
  const { user, sessionId } = await authService.login(req.body.username);

  // 쿠키에는 그 세션 ID만 담아 준다.
  res.cookie('sessionId', sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: SEVEN_DAYS,
  });

  res.json(user);
}

export async function me(req, res) {
  const user = await authService.whoAmI(readSessionId(req));

  res.json(user);
}

export function logout(req, res) {
  authService.logout(readSessionId(req));

  res.clearCookie('sessionId');
  res.json({ message: '로그아웃했어요' });
}