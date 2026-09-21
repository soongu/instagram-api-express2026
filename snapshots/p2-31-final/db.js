// 🚨 게이트 전용 — p2-33 정규화 뒤로는 live 클라이언트가 이 회차 DB(글자 판)를 모른다.
//    얼린 p2-29 클라이언트를 쓴다.
// ~/instagram-api/db.js
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../p2-29/client/index.js';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma = new PrismaClient({ adapter });
