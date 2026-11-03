// _count — 딸린 것의 «개수» 만 세어 온다. 줄은 한 개도 안 실려 오고 질의도 안 늘어난다.
import { prisma } from '../../db.js';

const posts = await prisma.post.findMany({
  include: { _count: { select: { comments: true, images: true } } },
  orderBy: { id: 'asc' },
});

for (const post of posts) {
  console.log(`${post.id}번  댓글 ${post._count.comments}  사진 ${post._count.images}`);
}

// 조건을 걸어 셀 수도 있다 — 답글을 빼고 원댓글만.
const roots = await prisma.post.findMany({
  include: { _count: { select: { comments: { where: { parentId: null } } } } },
  orderBy: { id: 'asc' },
});

console.log(`1번 게시물 — 원댓글만 ${roots[0]._count.comments}개`);

await prisma.$disconnect();
