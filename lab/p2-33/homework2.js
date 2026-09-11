// ~/instagram-api/lab/homework2.js
import { prisma } from '../db.js';

// ① 탈퇴 처리 — 줄을 지우는 게 아니라 시각을 적는다.
const left = await prisma.user.update({
  where: { username: 'minji' },
  data: { deactivatedAt: new Date() },
});

console.log(`${left.username} 탈퇴 처리 — ${left.deactivatedAt.toISOString()}`);

// ② 그 사람 게시물이 그대로 있는지 본다.
const posts = await prisma.post.findMany({
  where: { author: { username: 'minji' } },
  orderBy: { id: 'asc' },
});

console.log(`minji의 게시물 ${posts.length}개가 그대로 있어요.`);
for (const post of posts) console.log(`  ${post.id}번 ${post.postAlt}`);

// ③ 다음 실습에 영향이 없게 되돌린다.
await prisma.user.update({
  where: { username: 'minji' },
  data: { deactivatedAt: null },
});

console.log('되돌렸어요.');

await prisma.$disconnect();
