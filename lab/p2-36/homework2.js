// ~/instagram-api/lab/homework2.js
import { prisma } from '../db.js';

const postCount = await prisma.post.count();
const imageCount = await prisma.postImage.count();
const likeCount = await prisma.postLike.count();
const commentCount = await prisma.comment.count();

console.log(`게시물 ${postCount}개`);
console.log(`사진 ${imageCount}장`);
console.log(`좋아요 줄 ${likeCount}개`);
console.log(`댓글 ${commentCount}개`);

await prisma.$disconnect();
