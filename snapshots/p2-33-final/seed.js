// ~/instagram-api/seed.js
import { prisma } from './db.js';
import { posts } from './data/posts.js';
import { comments } from './data/comments.js';

await prisma.$executeRaw`TRUNCATE TABLE comments, posts, users RESTART IDENTITY`;

// 사람을 먼저 넣는다 — 게시물과 댓글이 가리킬 대상이라서.
// 게시물은 안 쓰고 댓글만 쓴 사람도 있으니 두 목록을 함께 훑는다.
const names = [];

for (const row of [...posts, ...comments]) {
  if (!names.includes(row.username)) names.push(row.username);
}

names.sort();

await prisma.user.createMany({
  data: names.map((username) => ({
    username,
    profileImage: posts.find((post) => post.username === username)?.profileImage ?? null,
  })),
});

const users = await prisma.user.findMany();
const idOf = (username) => users.find((user) => user.username === username).id;

await prisma.post.createMany({
  data: posts.map(({ username, profileImage, ...post }) => ({
    ...post,
    authorId: idOf(username),
    createdAt: new Date(Date.now() - post.minutesAgo * 60 * 1000),
  })),
});

await prisma.comment.createMany({
  data: comments.map(({ username, ...comment }) => ({
    ...comment,
    authorId: idOf(username),
  })),
});

console.log(`사람 ${names.length}명, 게시물 ${posts.length}개, 댓글 ${comments.length}개를 넣었어요.`);

await prisma.$disconnect();
