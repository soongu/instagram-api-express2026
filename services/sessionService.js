// ~/instagram-api/services/sessionService.js
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { prisma } from '../db.js';

// 로그인을 남겨 둘 기간 — 7일(밀리초).
export const SESSION_LIFETIME = 1000 * 60 * 60 * 24 * 7;

// Refresh 토큰에 붙일 비밀값 — 아무도 짐작할 수 없는 무작위 32바이트.
function newSecret() {
  return randomBytes(32).toString('base64url');
}

// Refresh 토큰의 비밀값을 해시로 바꾼다 — 데이터베이스에는 이 해시만 둔다.
function hashSecret(secret) {
  return createHash('sha256').update(secret).digest('hex');
}

// 세션 하나가 sessions 테이블의 한 행이다. 서버가 다시 떠도 테이블은 남는다.
// Refresh 토큰은 «행 ID.비밀값» — 행 ID 는 Access 토큰에도 담겨 누구나 읽으니, 아무도 모르는 비밀값을 붙인다.
export async function createSession(userId) {
  const secret = newSecret();
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

// Refresh 토큰을 새것으로 바꾼다(회전) — 비밀값이 맞으면 새 비밀값으로 바꾸고, 그 행과 새 Refresh 토큰을 돌려준다.
// 바꾸기 전 비밀값(직전 비밀값)이 다시 오면 이미 쓴 토큰이 다시 온 것이다 — 누가 훔쳐 썼는지 알 수 없으니 그 로그인 기록을 지운다.
export async function rotateRefreshToken(refreshToken) {
  const [sessionId, secret] = (refreshToken ?? '').split('.');

  if (!sessionId || !secret) return null;

  const session = await prisma.session.findUnique({ where: { id: sessionId } });

  if (!session) return null;

  const hash = hashSecret(secret);
  const nextSecret = newSecret();
  // 해시가 «지금도» 받은 비밀값의 것일 때만 바꾼다 — 같은 토큰으로 두 요청이 거의 같이 와도 하나만 바뀐다.
  // 바꾸면서 지금 해시를 직전 해시로 옮겨 둔다.
  const { count } = await prisma.session.updateMany({
    where: { id: sessionId, refreshTokenHash: hash },
    data: { refreshTokenHash: hashSecret(nextSecret), previousRefreshTokenHash: hash },
  });

  if (count === 0) {
    // 직전 비밀값이면 재사용이라 그 행을 지운다. 그 밖의 엉터리 값이면 아무것도 지우지 않는다.
    await prisma.session.deleteMany({ where: { id: sessionId, previousRefreshTokenHash: hash } });
    return null;
  }

  return { session, refreshToken: `${sessionId}.${nextSecret}` };
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
