// 게이트 전용 — p2-29 시점 스키마로 «따로» 클라이언트를 낸다.
// 🚨 output 을 안 주면 수업 클라이언트(node_modules/.prisma/client)를 덮어쓴다 — p2-29 가 겪은 그 사고.
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: '../../snapshots/p2-29/schema-final-gen.prisma',
});
