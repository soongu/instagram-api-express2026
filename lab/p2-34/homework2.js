// ~/instagram-api/lab/homework2.js
import { prisma } from '../db.js';

// 적어둔 숫자와 실제 줄 수를 나란히 찍는다.
// 실제 줄 수는 post_likes 에서 그 게시물의 줄만 골라 센다.
async function report(title) {
  const posts = await prisma.post.findMany({ orderBy: { id: 'asc' } });

  console.log(`\n${title}`);
  console.log('   id   like_count   실제 줄 수');
  for (const post of posts) {
    const count = await prisma.postLike.count({ where: { postId: post.id } });
    const id = String(post.id).padStart(2);
    const written = String(post.likeCount).padStart(10);
    const actual = String(count).padStart(10);
    console.log(`   ${id}   ${written}   ${actual}`);
  }
}

await report('고치기 전');

// 사람 몇 명이 몇 개 게시물에 눌렀다고 해둔다.
// 같은 사람이 같은 게시물에 두 번 들어가면 UNIQUE 에 막히므로 쌍이 겹치지 않게 한다.
await prisma.postLike.createMany({
  data: [
    { postId: 1, userId: 2 },
    { postId: 1, userId: 3 },
    { postId: 2, userId: 1 },
    { postId: 3, userId: 5 },
  ],
});

// 적어둔 숫자를 실제 줄 수로 맞춘다 — 게시물을 하나씩 차례로 세고 고친다.
const posts = await prisma.post.findMany({ orderBy: { id: 'asc' } });

for (const post of posts) {
  const actual = await prisma.postLike.count({ where: { postId: post.id } });

  await prisma.post.update({ where: { id: post.id }, data: { likeCount: actual } });
}

await report('고친 뒤');

await prisma.$disconnect();
