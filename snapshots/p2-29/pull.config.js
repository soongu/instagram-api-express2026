// 게이트 전용 — `db pull` 이 «지난 시간 그대로의 DB» 에서 무엇을 뽑는지 재현한다.
// 학생 config 와 다른 점은 schema 경로 하나뿐이다(스냅숏 자리로 뽑는다).
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'schema-pulled.prisma',
  datasource: { url: process.env.DATABASE_URL },
});
