// 앞 회차 판정 DB 를 «작업트리 스키마»까지 맞춘다 — 내부 검증 전용, 교안에 인용하지 않는다.
//
// 🚨 2026-10-29 `p3-22` — `p2-34` 뒤로 처음 `users` 에 컬럼(`email`·`phone`·`name`)이 생겼다.
//    `node_modules` 의 Prisma 클라이언트는 작업트리의 `prisma/schema.prisma` 로 만든 것이라(`npx prisma generate`),
//    select 없이 사람을 읽는 질의(`seed.js` 의 `prisma.user.findMany()`)가 새 컬럼까지 고른다. 그 회차까지의
//    마이그레이션만 재생한 판정 DB 에는 그 컬럼이 없어 시드가 `P2022 ColumnNotFound`(`users.email`)로 멈췄다.
// 🔑 그 회차의 학생 파일은 새 컬럼을 읽지도 쓰지도 않는다(셋 다 NULL 허용 · 응답은 select 로 고른다) —
//    마이그레이션을 tip 까지 더 얹어도 판정이 보는 동작은 같다. 앞으로 스키마를 바꾸는 회차도 이 도우미를 그대로 쓴다.
import { readdirSync, readFileSync } from 'node:fs';

const MIG = new URL('../../prisma/migrations/', import.meta.url);

/** 폴더 이름이 `after` 보다 뒤인 마이그레이션을 차례로 모두 적용한다. */
export async function applyMigrationsAfter(client, after) {
  const dirs = readdirSync(MIG, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const dir of dirs.filter((name) => name > after)) {
    await client.query(readFileSync(new URL(`${dir}/migration.sql`, MIG), 'utf8'));
  }
}

/** `p2-34` 의 마지막 마이그레이션 — 그 뒤로는 `p3-22` 가 처음 스키마를 바꿨다. */
export const P234_LAST = '20261001144541_add_post_likes';
