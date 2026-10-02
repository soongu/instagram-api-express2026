// 배열 꼴 — 서로의 결과가 필요 없는 작업 여럿을 한 묶음으로 보낸다.
import { prisma } from '../../db.js';

const [posts, images, likes] = await prisma.$transaction([
  prisma.post.count(),
  prisma.postImage.count(),
  prisma.postLike.count(),
]);

console.log(`게시물 ${posts}개, 사진 ${images}장, 좋아요 ${likes}개`);

await prisma.$disconnect();
