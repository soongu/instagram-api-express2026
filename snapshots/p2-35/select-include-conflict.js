// select 와 include 는 같은 층에 함께 못 쓴다 — 「이것만」과 「이것도」라 서로 반대말이다.
import { prisma } from '../../db.js';

try {
  await prisma.post.findMany({ select: { id: true }, include: { author: true } });
  console.log('통과했어요');
} catch (error) {
  console.log(`막혔어요: ${error.constructor.name}`);
}

await prisma.$disconnect();
