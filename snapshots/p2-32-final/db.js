// 게이트 전용 — p2-32 «그 시점» 클라이언트를 쓴다.
// 학생 db.js 는 `@prisma/client` 를 부르는데, 그것은 p2-33 이 정규화한 모델을 아는 판이라
// p2-30~32 게이트 DB(글자 판)에서는 안 돈다. 얼린 클라이언트가 그 시점 모델을 안다.
// 🔀 2026-09-18 p2-29 클라이언트 → p2-30 클라이언트. p2-30 시드가 댓글 updated_at(p2-29 과제 [기초])까지
//    채우는데 p2-29 클라이언트는 그 칸을 몰라서 `Unknown argument updatedAt` 으로 멈춘다.
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../p2-30/client/index.js';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma = new PrismaClient({ adapter });
