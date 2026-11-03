// 게이트 전용 — p2-29 «그 시점» 마이그레이션만 적용한다.
//
// 🚨 왜 필요한가: `migrate deploy` 는 «있는 것을 전부» 적용한다. p2-33 이 정규화
//    마이그레이션을 더한 뒤로는 그냥 deploy 하면 p229_gate 가 users·author_id 까지
//    받아버려서, 이 회차가 재려던 상태(posts.username 이 글자인 판)가 사라진다.
//    실제로 그렇게 돼서 p2-29 축 셋이 한꺼번에 FAIL 했다 — 캐논 「앞 회차 테스트가
//    «자라는 파일»을 live 로 보면 다음 회차 부채를 가린다」의 마이그레이션 판이다.
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: '../../snapshots/p2-29/schema-final.prisma',
  migrations: { path: '../../snapshots/p2-29/migrations' },
  datasource: {
    url: process.env.DATABASE_URL,
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
