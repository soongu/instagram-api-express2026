// 게이트 전용 — p2-30 시점(p2-29 교안 + 과제 [기초]) 스키마로 «따로» 클라이언트를 낸다.
// 게시물·댓글 둘 다 updated_at 을 안다. p2-29 클라이언트는 댓글 칸을 몰라서 이 회차 시드가 안 돈다.
// 🚨 output 을 안 주면 수업 클라이언트(node_modules/.prisma/client)를 덮어쓴다 — p2-29 가 겪은 그 사고.
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: '../../snapshots/p2-30/schema-gen.prisma',
});
