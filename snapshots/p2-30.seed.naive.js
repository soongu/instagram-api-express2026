// ~/instagram-api/seed.js
import { prisma } from '../db.js';
import { posts } from '../data/posts.js';
import { comments } from '../data/comments.js';

await prisma.comment.deleteMany({});
await prisma.post.deleteMany({});

await prisma.post.createMany({
  data: posts.map((post) => ({
    ...post,
    createdAt: new Date(Date.now() - post.minutesAgo * 60 * 1000),
  })),
});

await prisma.comment.createMany({ data: comments });

console.log(`게시물 ${posts.length}개와 댓글 ${comments.length}개를 넣었어요.`);

await prisma.$disconnect();
