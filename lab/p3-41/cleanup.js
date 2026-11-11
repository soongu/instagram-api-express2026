// ~/instagram-api/lab/p3-41/cleanup.js
import { prisma } from '../../db.js';

// 기한이 지난 세션 — expires_at 이 지금이거나 그보다 앞인 행을 한 번에 지운다(getUserId 와 같은 기준).
const { count } = await prisma.session.deleteMany({
  where: { expiresAt: { lte: new Date() } },
});
const left = await prisma.session.count();

console.log(`기한이 지난 세션 ${count}개를 지웠어요. 남은 세션은 ${left}개예요.`);

await prisma.$disconnect();
