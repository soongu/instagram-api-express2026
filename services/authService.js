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

// 로그인 — 사용자 이름과 비밀번호를 확인하고, 로그인 기록(세션)을 남긴 뒤 그 기록을 담은 토큰을 돌려준다.
export async function login(username, password) {
  const user = await userService.checkPassword(username, password);

  if (!user) throw new UnauthorizedError('LOGIN_FAILED');

  const sessionId = await sessionService.createSession(user.id);
  const accessToken = tokenService.createAccessToken(user, sessionId);
  return { user, accessToken };
}

// 나는 누구 — 토큰에서 꺼낸 번호로 그 사람을 찾는다. 토큰은 살아 있어도 그 사람이 지워졌으면 401.
export async function whoAmI(userId) {
  const user = await userService.findUserById(userId);

  if (!user) throw new UnauthorizedError('LOGIN_REQUIRED');

  return user;
}

// 로그아웃 — 토큰에 담긴 로그인 기록(sid)을 지운다. 토큰이 틀렸거나 기한이 지났으면 지울 것이 없다.
export async function logout(token) {
  const payload = tokenService.readAccessToken(token);

  await sessionService.deleteSession(payload?.sid);
}
// 모든 기기에서 로그아웃 — 그 사람의 세션을 테이블에서 모두 지운다. 지운 세션 수를 돌려준다.
export function logoutAll(userId) {
  return sessionService.deleteUserSessions(userId);
}
