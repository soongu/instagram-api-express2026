// 게이트 전용 — p2-32 «그 시점» 클라이언트를 쓴다.
// 학생 db.js 는 `@prisma/client` 를 부르는데, 그것은 p2-33 이 정규화한 모델을 아는 판이라
// p2-30~32 게이트 DB(글자 판)에서는 안 돈다. 얼린 클라이언트가 그 시점 모델을 안다.
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../p2-29/client/index.js';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma = new PrismaClient({ adapter });
