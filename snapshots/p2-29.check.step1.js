// ~/instagram-api/check.js
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const posts = await prisma.post.findMany({ orderBy: { id: 'asc' } });
console.log(`게시물 ${posts.length}개를 읽었어요.`);
console.log(posts[0]);

await prisma.$disconnect();
