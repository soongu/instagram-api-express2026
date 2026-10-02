// ~/instagram-api/db.js
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

// 보낸 질의를 터미널에 그대로 찍는다 — 볼 때만 켜는 스위치다.
export const prisma = new PrismaClient({ adapter, log: ['query'] });
