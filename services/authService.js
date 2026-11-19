// ~/instagram-api/services/authService.js
import * as userService from './userService.js';
import * as sessionService from './sessionService.js';
import { UnauthorizedError } from '../errors.js';
import { PHONE } from '../schemas/authSchema.js';

// 가입 — 연락처가 휴대폰 번호 모양이면 phone 에, 아니면 email 에 넣는다.
// 비밀번호는 넘기기만 한다 — 해시로 바꿔 저장하는 일은 userService 가 맡는다.
export function signup({ emailOrPhone, name, username, password }) {
  const contact = PHONE.test(emailOrPhone) ? { phone: emailOrPhone } : { email: emailOrPhone };

  return userService.createUser({ username, name, ...contact, password });
}

// 로그인 — 사용자 이름과 비밀번호를 확인하고, 세션을 만들어 그 ID 를 사람과 함께 돌려준다.
export async function login(username, password) {
  const user = await userService.checkPassword(username, password);

  if (!user) throw new UnauthorizedError('LOGIN_FAILED');

  const sessionId = await sessionService.createSession(user.id);

  return { user, sessionId };
}

// 나는 누구 — 세션에서 사람의 번호를 찾고, 그 사람을 돌려준다.
export async function whoAmI(sessionId) {
  // 서버가 기억해 둔 세션에서 사람의 번호를 찾는다 — 모르는 세션 ID면 undefined.
  const userId = await sessionService.getUserId(sessionId);

  if (!userId) throw new UnauthorizedError('LOGIN_REQUIRED');

  const user = await userService.findUserById(userId);

  if (!user) throw new UnauthorizedError('LOGIN_REQUIRED');

  return user;
}

// 로그아웃 — 서버가 세션을 지운다. 누가 이 세션 ID를 복사해 뒀어도 이제는 통하지 않는다.
export async function logout(sessionId) {
  await sessionService.deleteSession(sessionId);
}

// 모든 기기에서 로그아웃 — 그 사람의 세션을 테이블에서 모두 지운다. 지운 세션 수를 돌려준다.
export function logoutAll(userId) {
  return sessionService.deleteUserSessions(userId);
}
