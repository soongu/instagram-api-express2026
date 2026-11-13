// ~/instagram-api/controllers/authController.js
import * as authService from '../services/authService.js';
import * as userService from '../services/userService.js';
import { sendData } from '../responses.js';
import { HttpError, MESSAGES } from '../errors.js';
import { SESSION_LIFETIME } from '../services/sessionService.js';
import { tempCookie } from '../strategies/stateStore.js';

// 토큰 둘을 쿠키에 담는다 — 둘 다 스크립트가 못 읽게 httpOnly, 둘 다 로그인 기록이 남는 7일 동안.
// Access 토큰 자체는 15분이면 끝나지만, 쿠키가 먼저 사라지면 서버는 «기한이 지난 토큰»인지 «로그인하지 않은 요청»인지 모른다.
// Refresh 토큰은 /api/v2/auth 로 시작하는 인증 주소에만 실려 가게 path 를 좁힌다.
function setTokenCookies(res, { accessToken, refreshToken }) {
  res.cookie('accessToken', accessToken, { httpOnly: true, sameSite: 'lax', maxAge: SESSION_LIFETIME });
  res.cookie('refreshToken', refreshToken, { httpOnly: true, sameSite: 'lax', path: '/api/v2/auth', maxAge: SESSION_LIFETIME });
}

// 토큰 쿠키 둘을 지우라고 알린다 — 쿠키는 이름과 path 가 같아야 같은 쿠키라, Refresh 쿠키는 path 를 함께 적는다.
function clearTokenCookies(res) {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken', { path: '/api/v2/auth' });
}

// 이미 쓰고 있을 때의 에러 코드 — 무엇을 찾았는지에 따라 다르다. 문장은 가입이 409 로 실패할 때와 같다.
const TAKEN = {
  email: 'EMAIL_TAKEN',
  phone: 'PHONE_TAKEN',
  username: 'USERNAME_TAKEN',
};

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
  const { username, password } = req.body;
  const { user, accessToken, refreshToken } = await authService.login(username, password);

  setTokenCookies(res, { accessToken, refreshToken });

  sendData(res, user);
}

export async function reissue(req, res) {
  const tokens = await authService.reissue(req.cookies.refreshToken);

  setTokenCookies(res, tokens);
  sendData(res, { message: '새 토큰을 받았어요' });
}

export async function me(req, res) {
  const user = await authService.whoAmI(res.locals.userId);

  sendData(res, user);
}

export async function logout(req, res) {
  await authService.logout(req.cookies.refreshToken);

  clearTokenCookies(res);
  sendData(res, { message: '로그아웃했어요' });
}

export async function logoutAll(req, res) {
  await authService.logoutAll(res.locals.userId);

  clearTokenCookies(res);
  sendData(res, { message: '모든 기기에서 로그아웃했어요' });
}

// 로그인한 뒤 돌아갈 주소 — 우리 화면 안의 경로일 때만 쓰고, 아니면 피드로 간다.
function safeNextPath(next) {
  const site = process.env.SITE_URL;

  if (typeof next !== 'string' || !URL.canParse(next, site)) return '/';

  const url = new URL(next, site);

  return url.origin === new URL(site).origin ? url.pathname + url.search : '/';
}

// 제공자로 떠나기 전에, 다녀온 뒤 돌아갈 곳(주소의 ?next=)을 쿠키에 맡겨 둔다.
// 쿠키 이름에 제공자 이름을 붙인다 — 두 제공자에 함께 다녀와도 돌아갈 곳이 섞이지 않게.
export function rememberNext(provider) {
  const nextCookie = `oauth_next_${provider}`;

  return (req, res, next) => {
    res.cookie(nextCookie, safeNextPath(req.query.next), tempCookie);
    next();
  };
}

// 제공자에게 다녀온 사람을 로그인시킨다 — req.user 는 제공자가 확인해 준 프로필이라, 거기에 이어진 users 의 사람을 먼저 찾는다(처음 온 사람이면 만든다).
// 그 뒤는 비밀번호 로그인과 같다 — 같은 로그인 기록을 남기고, 같은 쿠키 둘을 준다. 브라우저가 문서로 연 주소라 JSON 대신 보던 곳으로 보낸다.
export function socialCallback(provider) {
  const nextCookie = `oauth_next_${provider}`;

  return async (req, res) => {
    const user = await authService.findOrCreateSocialUser(req.user);
    const tokens = await authService.startSession(user);

    setTokenCookies(res, tokens);
    res.clearCookie(nextCookie, { path: tempCookie.path });
    res.redirect(safeNextPath(req.cookies[nextCookie]));
  };
}

// 소셜 로그인이 실패했을 때 — 이 주소도 브라우저가 문서로 연 것이라, JSON 대신 로그인 화면으로 보낸다.
// 무엇 때문인지는 주소의 ?error= 에 에러 코드로 싣는다.
export function socialFailed(err, req, res, next) {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (!(err instanceof HttpError)) console.error(err);

  res.redirect(`/login?error=${err instanceof HttpError ? err.code : 'SOCIAL_LOGIN_FAILED'}`);
}
