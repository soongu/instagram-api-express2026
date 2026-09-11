// ~/instagram-api/lab/bookstore.js
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/index.js';

const adapter = new PrismaPg({ connectionString: process.env.BOOKSTORE_URL });

export const bookstore = new PrismaClient({ adapter });
