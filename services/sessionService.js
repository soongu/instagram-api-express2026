// ~/instagram-api/services/sessionService.js
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { prisma } from '../db.js';

// 로그인을 남겨 둘 기간 — 7일(밀리초).
export const SESSION_LIFETIME = 1000 * 60 * 60 * 24 * 7;

// Refresh 토큰의 비밀값을 해시로 바꾼다 — 데이터베이스에는 이 해시만 둔다.
function hashSecret(secret) {
  return createHash('sha256').update(secret).digest('hex');
}

// 세션 하나가 sessions 테이블의 한 행이다. 서버가 다시 떠도 테이블은 남는다.
// Refresh 토큰은 «행 ID.비밀값» — 행 ID 는 Access 토큰에도 담겨 누구나 읽으니, 아무도 모르는 비밀값을 붙인다.
export async function createSession(userId) {
  const secret = randomBytes(32).toString('base64url');
  const session = await prisma.session.create({
    data: {
      id: randomUUID(),
      userId,
      expiresAt: new Date(Date.now() + SESSION_LIFETIME),
      refreshTokenHash: hashSecret(secret),
    },
  });

  return { sessionId: session.id, refreshToken: `${session.id}.${secret}` };
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
