// ~/instagram-api/controllers/authController.js
import * as authService from '../services/authService.js';
import * as userService from '../services/userService.js';
import * as tokenService from '../services/tokenService.js';
import { sendData } from '../responses.js';
import { HttpError, MESSAGES, UnauthorizedError } from '../errors.js';
import { readToken } from '../middlewares/auth.js';
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
  // username 에는 사용자 이름 말고 이메일이나 휴대폰 번호가 올 수도 있다 - 무엇인지는 authService 가 가른다.
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

// 내 로그인 방법 — 비밀번호가 있는지와, 이어진 소셜 계정(이은 차례로).
export async function loginMethods(req, res) {
  const methods = await authService.getLoginMethods(res.locals.userId);

  sendData(res, methods);
}

// 소셜 계정 연결 끊기 — 주소의 제공자 이름으로, 로그인한 사람 자신의 연결만 끊는다.
export async function unlinkSocialAccount(req, res) {
  await authService.unlinkSocialAccount(res.locals.userId, req.params.provider);

  sendData(res, { message: '연결을 끊었어요' });
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
// 지난번에 남은 연결 표시 쿠키는 지운다 — 연결하러 떠나는 길이면 바로 뒤의 rememberLink 가 다시 둔다.
export function rememberNext(provider) {
  const nextCookie = `oauth_next_${provider}`;
  const linkCookie = `oauth_link_${provider}`;

  return (req, res, next) => {
    res.cookie(nextCookie, safeNextPath(req.query.next), tempCookie);
    res.clearCookie(linkCookie, { path: tempCookie.path });
    next();
  };
}

// 소셜 계정을 이으러 떠난다는 것을 연결 표시 쿠키에 적어 둔다 — 같은 콜백으로 돌아와도 로그인이 아니라 연결로 처리하려고.
// 사람 번호가 아니라 지금 로그인 기록 번호를 담는다 — 돌아왔을 때 떠날 때와 같은 로그인인지 확인한다.
export function rememberLink(provider) {
  const linkCookie = `oauth_link_${provider}`;

  return (req, res, next) => {
    res.cookie(linkCookie, res.locals.sessionId, tempCookie);
    next();
  };
}

// 제공자에게 다녀온 사람을 로그인시킨다 — req.user 는 제공자가 확인해 준 프로필이라, 거기에 이어진 users 의 사람을 먼저 찾는다(처음 온 사람이면 만든다).
// 그 뒤는 비밀번호 로그인과 같다 — 같은 로그인 기록을 남기고, 같은 쿠키 둘을 준다. 브라우저가 문서로 연 주소라 JSON 대신 보던 곳으로 보낸다.
// 연결 표시 쿠키가 있으면 로그인이 아니라 연결이다 — 지금 로그인한 사람에게 잇는다.
export function socialCallback(provider) {
  const nextCookie = `oauth_next_${provider}`;
  const linkCookie = `oauth_link_${provider}`;

  return async (req, res) => {
    if (req.cookies[linkCookie]) {
      await linkToCurrentUser(req, res, provider);
      return;
    }

    const user = await authService.findOrCreateSocialUser(req.user);
    const tokens = await authService.startSession(user);

    setTokenCookies(res, tokens);
    res.clearCookie(nextCookie, { path: tempCookie.path });
    res.redirect(safeNextPath(req.cookies[nextCookie]));
  };
}

// 연결 — 제공자가 확인해 준 계정(req.user)을 지금 로그인한 사람에게 잇는다. 로그인 기록도 토큰 쿠키도 새로 만들지 않는다.
// 실패해도 로그인 화면이 아니라 보던 화면으로 보낸다 — 로그인한 사람에게 로그인 화면은 곧바로 피드로 넘어가 문장이 보이지 않는다.
async function linkToCurrentUser(req, res, provider) {
  const nextCookie = `oauth_next_${provider}`;
  const linkCookie = `oauth_link_${provider}`;
  const back = new URL(safeNextPath(req.cookies[nextCookie]), process.env.SITE_URL);
  const userId = linkingUserId(req, req.cookies[linkCookie]);

  res.clearCookie(nextCookie, { path: tempCookie.path });
  res.clearCookie(linkCookie, { path: tempCookie.path });

  try {
    if (userId === null) throw new UnauthorizedError('LOGIN_REQUIRED');
    await authService.linkSocialAccount(userId, req.user);
    back.searchParams.set('linked', provider);
  } catch (error) {
    // 에러 코드가 있는 실패만 보던 화면의 주소에 싣는다 — 그 밖의 에러는 아래 socialFailed 가 받는다.
    if (!(error instanceof HttpError)) throw error;
    back.searchParams.set('error', error.code);
  }

  res.redirect(back.pathname + back.search);
}

// 연결 표시 쿠키를 둔 로그인이 지금도 그 로그인인지 — 요청에 실려 온 Access 토큰이 살아 있고
// 그 sid 가 쿠키의 값과 같으면 그 사람의 번호를, 아니면(토큰 없음 · 기한 지남 · 다른 로그인) null 을 돌려준다.
function linkingUserId(req, sessionId) {
  try {
    const payload = tokenService.verifyAccessToken(readToken(req));

    return payload.sid === sessionId ? Number(payload.sub) : null;
  } catch {
    return null;
  }
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
