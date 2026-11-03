// 하나씩 돌기 — 게시물을 읽은 뒤 글쓴이와 사진을 게시물마다 따로 물어본다.
// 읽기는 자연스러운데, 데이터베이스에 말을 거는 횟수가 게시물 수를 따라 늘어난다.
import { prisma } from '../../db.js';

const posts = await prisma.post.findMany();

for (const post of posts) {
  const author = await prisma.user.findUnique({ where: { id: post.authorId } });
  const images = await prisma.postImage.findMany({ where: { postId: post.id } });

  console.log(`${post.id}번 — ${author.username} · 사진 ${images.length}장`);
}

await prisma.$disconnect();
