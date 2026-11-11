// ~/instagram-api/services/sessionService.js
import { randomUUID } from 'node:crypto';
import { prisma } from '../db.js';

// 로그인을 남겨 둘 기간 — 7일(밀리초)
const SESSION_LIFETIME = 1000 * 60 * 60 * 24 * 7;

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

// 테이블에 그 세션이 없으면 undefined 가 나온다.
export async function getUserId(sessionId) {
  // 세션 ID 가 없으면 찾을 것도 없다 — findUnique 는 undefined 를 받으면 에러로 멈춘다.
  if (!sessionId) return undefined;

  const session = await prisma.session.findUnique({ where: { id: sessionId } });

  return session?.userId;
}

export async function deleteSession(sessionId) {
  // 세션 ID 가 없으면 여기서 끝낸다 — undefined 를 넘기면 조건이 사라져 모든 세션을 지운다.
  if (!sessionId) return;

  await prisma.session.deleteMany({ where: { id: sessionId } });
}
