// ~/instagram-api/lab/homework2.js
import { prisma } from '../db.js';
import { posts } from '../data/posts.js';
import { comments } from '../data/comments.js';

function withTimes({ minutesAgo, ...row }) {
  const createdAt = new Date(Date.now() - minutesAgo * 60 * 1000);
  return { ...row, createdAt, updatedAt: createdAt };
}

const force = process.argv.includes('--force');
const already = await prisma.post.count();

if (already > 0 && !force) {
  console.log(`게시물이 이미 ${already}개 있어서 아무것도 안 했어요.`);
  await prisma.$disconnect();
  process.exit(0);
}

await prisma.$executeRaw`TRUNCATE TABLE comments, posts RESTART IDENTITY`;

await prisma.post.createMany({ data: posts.map(withTimes) });

await prisma.comment.createMany({ data: comments.map(withTimes) });

console.log(`게시물 ${posts.length}개와 댓글 ${comments.length}개를 넣었어요.`);

await prisma.$disconnect();
