// ~/instagram-api/services/sessionService.js
import { randomUUID } from 'node:crypto';
import { prisma } from '../db.js';

// 로그인을 남겨 둘 기간 — 7일(밀리초). 로그인 쿠키의 maxAge 도 이 값을 쓴다.
export const SESSION_LIFETIME = 1000 * 60 * 60 * 24 * 7;

// 세션 하나가 sessions 테이블의 한 행이다. 서버가 다시 떠도 테이블은 남는다.
export async function createSession(userId) {
  const session = await prisma.session.create({
    data: {
      id: randomUUID(),
      userId,
      expiresAt: new Date(Date.now() + SESSION_LIFETIME),
    },
  });

  return session.id;
}

export async function deleteSession(sessionId) {
  // 세션 ID 가 없으면 여기서 끝낸다 — undefined 를 넘기면 조건이 사라져 모든 세션을 지운다.
  if (!sessionId) return;

  await prisma.session.deleteMany({ where: { id: sessionId } });
}

// 한 사람의 세션을 모두 지운다 — 그 사람이 로그인해 둔 기기가 몇 개든 한 번에.
export async function deleteUserSessions(userId) {
  // 사람 번호가 없으면 여기서 끝낸다 — undefined 를 넘기면 조건이 사라져 모든 사람의 세션을 지운다.
  if (userId === undefined) return 0;

  const { count } = await prisma.session.deleteMany({ where: { userId } });

  return count;
}
