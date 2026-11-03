// 게이트 전용 — 「마이그레이션 이력만으로 스키마가 그대로 되살아나는가」를 재기 위한 설정.
// 이력을 재생하려면 Prisma 가 «빈 DB 한 곳»을 빌려야 해서 shadowDatabaseUrl 이 필요하다.
// 학생 config 에는 이 줄이 없다 — migrate dev 는 자기가 알아서 빌려 쓴다.
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: '../../snapshots/p2-29/schema-final.prisma',
  migrations: { path: '../../snapshots/p2-29/migrations' },
  datasource: {
    url: process.env.DATABASE_URL,
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
