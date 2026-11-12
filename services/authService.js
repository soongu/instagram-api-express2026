// ~/instagram-api/services/authService.js
import * as userService from './userService.js';
import * as sessionService from './sessionService.js';
import * as tokenService from './tokenService.js';
import { UnauthorizedError } from '../errors.js';
import { PHONE } from '../schemas/authSchema.js';

// 가입 — 연락처가 휴대폰 번호 모양이면 phone 에, 아니면 email 에 넣는다.
// 비밀번호는 넘기기만 한다 — 해시로 바꿔 저장하는 일은 userService 가 맡는다.
export function signup({ emailOrPhone, name, username, password }) {
  const contact = PHONE.test(emailOrPhone) ? { phone: emailOrPhone } : { email: emailOrPhone };

  return userService.createUser({ username, name, ...contact, password });
}

// 로그인 기록(세션)을 남기고 토큰 둘을 만든다 — 비밀번호로 확인했든 구글이 확인해 줬든, 확인이 끝난 뒤의 일은 같다.
// Access 토큰에는 그 기록(sid)을 담고, Refresh 토큰은 그 기록에서 새 Access 토큰을 받을 때 쓴다.
export async function startSession(user) {
  const { sessionId, refreshToken } = await sessionService.createSession(user.id);
  const accessToken = tokenService.createAccessToken(user, sessionId);

  return { user, accessToken, refreshToken };
}

// 로그인 — 사용자 이름과 비밀번호를 확인한 뒤, 로그인 기록과 토큰 둘을 돌려준다.
export async function login(username, password) {
  const user = await userService.checkPassword(username, password);

  if (!user) throw new UnauthorizedError('LOGIN_FAILED');

  return startSession(user);
}

// 소셜 로그인 — 제공자가 확인해 준 사람(profile)에 이어진 우리 사람을 찾고, 처음 온 사람이면 만든다.
// 이메일이 같은 사람이 이미 있어도 그 사람에게 잇지 않는다 — 찾는 기준은 «어느 제공자의 누구» 뿐이다.
export async function findOrCreateSocialUser(profile) {
  const user = await userService.findUserBySocialAccount(profile.provider, profile.id);

  return user ?? userService.createSocialUser(profile);
}

// 새 토큰 받기 — Refresh 토큰을 새것으로 바꾸고, 그 사람을 다시 찾아 «지금» 역할로 Access 토큰을 만든다.
// 사람을 지우면 그 사람의 기록도 함께 지워지니(Cascade), 기록이 있으면 사람도 있다.
export async function reissue(refreshToken) {
  const rotated = await sessionService.rotateRefreshToken(refreshToken);

  if (!rotated) throw new UnauthorizedError('LOGIN_REQUIRED');

  const user = await userService.findUserById(rotated.session.userId);
  const accessToken = tokenService.createAccessToken(user, rotated.session.id);

  return { accessToken, refreshToken: rotated.refreshToken };
}

// 나는 누구 — 토큰에서 꺼낸 번호로 그 사람을 찾는다. 토큰은 살아 있어도 그 사람이 지워졌으면 401.
export async function whoAmI(userId) {
  const user = await userService.findUserById(userId);

  if (!user) throw new UnauthorizedError('LOGIN_REQUIRED');

  return user;
}

// 로그아웃 — Refresh 토큰이 가리키는 로그인 기록을 지운다. 그 뒤로는 이 로그인으로 새 토큰을 받을 수 없다.
// Access 토큰은 15분이면 끝나니, 기한이 지난 뒤에 로그아웃해도 Refresh 토큰으로 기록을 찾는다.
export async function logout(refreshToken) {
  await sessionService.deleteSessionByRefreshToken(refreshToken);
}

// 모든 기기에서 로그아웃 — 그 사람의 세션을 테이블에서 모두 지운다. 지운 세션 수를 돌려준다.
export function logoutAll(userId) {
  return sessionService.deleteUserSessions(userId);
}
