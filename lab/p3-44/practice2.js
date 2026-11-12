// ~/instagram-api/lab/p3-44/practice2.js
import { prisma } from '../../db.js';
import { SESSION_MAX_LIFETIME } from '../../services/sessionService.js';

// jaehoon(2번)의 로그인 기록마다 «다시 로그인해야 하는 때»를 보여 준다 — 최근 로그인부터.
const sessions = await prisma.session.findMany({ where: { userId: 2 }, orderBy: { createdAt: 'desc' } });

for (const session of sessions) {
  // 끝나는 때는 둘 중 이른 쪽 — 7일 동안 새 토큰을 안 받은 때(expires_at)와 처음 로그인한 뒤 30일.
  const limit = session.createdAt.getTime() + SESSION_MAX_LIFETIME;
  const endsAt = Math.min(session.expiresAt.getTime(), limit);
  const reason = endsAt === limit ? '처음 로그인한 뒤 30일' : '7일 동안 새 토큰을 안 받으면';
  const when = new Date(endsAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

  console.log(`${session.id.slice(0, 8)}  ${when}  ${reason}`);
}

await prisma.$disconnect();
