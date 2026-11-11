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

// 테이블에 그 세션이 없거나 기한이 지났으면 undefined 가 나온다.
export async function getUserId(sessionId) {
  // 세션 ID 가 없으면 찾을 것도 없다 — findUnique 는 undefined 를 받으면 에러로 멈춘다.
  if (!sessionId) return undefined;

  const session = await prisma.session.findUnique({ where: { id: sessionId } });

  if (!session) return undefined;

  // 기한이 지난 세션은 없는 것과 같다 — 찾은 김에 테이블에서도 지운다.
  if (session.expiresAt <= new Date()) {
    await deleteSession(sessionId);
    return undefined;
  }

  return session.userId;
}

export async function deleteSession(sessionId) {
  // 세션 ID 가 없으면 여기서 끝낸다 — undefined 를 넘기면 조건이 사라져 모든 세션을 지운다.
  if (!sessionId) return;

  await prisma.session.deleteMany({ where: { id: sessionId } });
}
