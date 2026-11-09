// ~/instagram-api/lab/p3-36/homework2.js
import * as authService from '../../services/authService.js';
import { prisma } from '../../db.js';

// HTTP 요청 없이 서비스만 불러 로그인 흐름을 차례로 확인한다 — 쿠키는 어디에도 없다.
const { user, sessionId } = await authService.login('jaehoon');
console.log('로그인했어요', user.username, sessionId.length);

const me = await authService.whoAmI(sessionId);
console.log('나는 누구', me.username);

authService.logout(sessionId);
console.log('로그아웃했어요');

try {
  await authService.whoAmI(sessionId);
} catch (error) {
  console.log('나는 누구', error.status, error.message);
}

try {
  await authService.login('hana');
} catch (error) {
  console.log('없는 이름으로 로그인', error.status, error.message);
}

await prisma.$disconnect();
