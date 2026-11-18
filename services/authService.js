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

// 로그인 — 이름으로 사람을 찾고, 세션을 만들어 그 ID 를 사람과 함께 돌려준다.
export async function login(username) {
  const user = await userService.findUserByUsername(username);

  if (!user) throw new UnauthorizedError('LOGIN_FAILED');

  // 비밀번호 확인은 아직 없다 — 이름만 맞으면 세션을 만든다.
  const sessionId = sessionService.createSession(user.id);

  return { user, sessionId };
}

// 나는 누구 — 세션에서 사람의 번호를 찾고, 그 사람을 돌려준다.
export async function whoAmI(sessionId) {
  // 서버가 기억해 둔 세션에서 사람의 번호를 찾는다 — 모르는 세션 ID면 undefined.
  const userId = sessionService.getUserId(sessionId);

  if (!userId) throw new UnauthorizedError('LOGIN_REQUIRED');

  const user = await userService.findUserById(userId);

  if (!user) throw new UnauthorizedError('LOGIN_REQUIRED');

  return user;
}

// 로그아웃 — 서버가 세션을 지운다. 누가 이 세션 ID를 복사해 뒀어도 이제는 통하지 않는다.
export function logout(sessionId) {
  sessionService.deleteSession(sessionId);
}
