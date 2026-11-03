// ~/instagram-api/prisma.config.js
import { defineConfig } from 'prisma/config';

// 배포한 곳에는 `.env` 파일이 없어요. 값이 이미 환경에 있으면 파일을 안 찾아요.
if (process.env.DATABASE_URL === undefined) process.loadEnvFile();

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL },
});
