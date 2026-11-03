// ~/instagram-api/lab/homework2.js
import { prisma } from '../db.js';

// 적어둔 숫자와 실제 원댓글 수를 나란히 찍는다.
async function report(title) {
  const posts = await prisma.post.findMany({
    include: { _count: { select: { comments: { where: { parentId: null } } } } },
    orderBy: { id: 'asc' },
  });

  console.log(title);
  console.log('   id   comment_count   실제 원댓글');
  for (const post of posts) {
    const id = String(post.id).padStart(2);
    const written = String(post.commentCount).padStart(13);
    const actual = String(post._count.comments).padStart(11);
    console.log(`   ${id}   ${written}   ${actual}`);
  }
}

await report('지금 상태');
await prisma.$disconnect();
