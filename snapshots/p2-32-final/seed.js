// ~/instagram-api/seed.js
import { prisma } from './db.js';
import { posts } from '../p2-33-final/data/posts.js';
import { comments } from '../p2-33-final/data/comments.js';

function withTimes({ minutesAgo, ...row }) {
  const createdAt = new Date(Date.now() - minutesAgo * 60 * 1000);
  return { ...row, createdAt, updatedAt: createdAt };
}

await prisma.$executeRaw`TRUNCATE TABLE comments, posts RESTART IDENTITY`;

await prisma.post.createMany({ data: posts.map(withTimes) });

await prisma.comment.createMany({ data: comments.map(withTimes) });

console.log(`게시물 ${posts.length}개와 댓글 ${comments.length}개를 넣었어요.`);

await prisma.$disconnect();
