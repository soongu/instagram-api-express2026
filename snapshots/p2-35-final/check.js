// ~/instagram-api/check.js
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

// 보낸 질의를 세어보려고 로그를 받는다. 터미널에 바로 찍는 대신 우리가 센다.
const prisma = new PrismaClient({ adapter, log: [{ emit: 'event', level: 'query' }] });

let sent = 0;
prisma.$on('query', () => { sent += 1; });

// ① 하나씩 돌기 — 게시물을 읽은 뒤 글쓴이와 사진은 게시물마다 따로 물어본다.
sent = 0;
const posts = await prisma.post.findMany();

for (const post of posts) {
  await prisma.user.findUnique({ where: { id: post.authorId } });
  await prisma.postImage.findMany({ where: { postId: post.id } });
}

console.log(`하나씩 돌기 — 게시물 ${posts.length}개에 질의 ${sent}번`);

// ② 함께 읽기 — 똑같은 것을 한 번의 부탁으로.
sent = 0;
await prisma.post.findMany({ include: { author: true, images: true } });

console.log(`함께 읽기 — 게시물 ${posts.length}개에 질의 ${sent}번`);

await prisma.$disconnect();
