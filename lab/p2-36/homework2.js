// ~/instagram-api/lab/homework2.js
import { prisma } from '../db.js';

const 게시물 = await prisma.post.count();
const 사진 = await prisma.postImage.count();
const 좋아요 = await prisma.postLike.count();
const 댓글 = await prisma.comment.count();

console.log(`게시물 ${게시물}개`);
console.log(`사진 ${사진}장`);
console.log(`좋아요 줄 ${좋아요}개`);
console.log(`댓글 ${댓글}개`);

await prisma.$disconnect();
