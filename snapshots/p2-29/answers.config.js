// 게이트 전용 — 과제[기초] 의 스키마를 그 회차 DB 에 적용해 답안 수치를 «실행으로» 얻는다.
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'schema-answers.prisma',
  migrations: { path: process.env.ANSWERS_MIGRATIONS ?? '../../prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL },
});
