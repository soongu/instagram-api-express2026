// ~/instagram-api/check.js
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// 사진은 이제 게시물의 칸이 아니라 딸린 표의 줄이라, 함께 읽어야 보인다.
const withImages = await prisma.post.findMany({
  include: { images: { orderBy: { imgOrder: 'asc' } } },
  orderBy: { id: 'asc' },
});

for (const post of withImages) {
  const urls = post.images.map((image) => image.imageUrl).join(', ');
  console.log(`${post.id}번 ${post.postAlt} — 사진 ${post.images.length}장: ${urls}`);
}

// 답글은 원댓글과 «같은 표» 에 있다. 그래서 그냥 읽으면 둘이 섞여 나온다.
const all = await prisma.comment.findMany();
console.log(`\ncomments 표의 줄은 모두 ${all.length}개예요.`);

// 원댓글만 고르려면 「가리키는 원댓글이 없는 줄」을 찾는다.
const roots = await prisma.comment.findMany({
  where: { parentId: null },
  include: { replies: true },
  orderBy: { id: 'asc' },
});

console.log(`그중 원댓글은 ${roots.length}개고, 나머지는 어딘가에 달린 답글이에요.\n`);

for (const comment of roots) {
  console.log(`${comment.id}번 "${comment.content}" — 답글 ${comment.replies.length}개`);
  for (const reply of comment.replies) {
    console.log(`    └ ${reply.id}번 "${reply.content}"`);
  }
}

await prisma.$disconnect();
