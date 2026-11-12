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

/** 폴더 이름이 `after` 보다 뒤인(그리고 `before` 를 주면 그보다 앞인) 마이그레이션을 차례로 모두 적용한다. */
// 🚨 2026-11-11 `p3-41` — `sessions` 테이블이 `users` 를 가리키게 됐다. 그 테이블이 있는 DB 에서는
//    `sessions` 를 비우는 목록에 없는 옛 회차의 `seed.js`(북마크 판)가 `TRUNCATE … users` 에서 0A000 으로 멈춘다.
//    옛 시드를 그대로 쓰는 판정은 `before: SESSIONS_MIGRATION` 으로 그 앞까지만 얹는다(그 회차 학생 파일은 세션을 메모리에 둔다).
export async function applyMigrationsAfter(client, after, before = null) {
  const dirs = readdirSync(MIG, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const dir of dirs.filter((name) => name > after && (before === null || name < before))) {
    await client.query(readFileSync(new URL(`${dir}/migration.sql`, MIG), 'utf8'));
  }
}

/** `p2-34` 의 마지막 마이그레이션 — 그 뒤로는 `p3-22` 가 처음 스키마를 바꿨다. */
export const P234_LAST = '20261001144541_add_post_likes';

/** `p3-41` 의 `sessions` 테이블 — 이것이 생기면 `sessions` 를 모르는 옛 시드는 `users` 를 비우지 못한다. */
export const SESSIONS_MIGRATION = '20261111043902_add_sessions';

/**
 * `p3-43` 의 `users.role`(enum · 기본값 USER) — 작업트리 클라이언트는 사람을 만들 때 기본값 USER 를 직접 실어 보내서,
 * 이 컬럼이 없는 판정 DB 에서는 시드가 `P2022 ColumnNotFound`(`role of relation users`)로 멈춘다.
 * 그 회차 학생 파일은 역할을 읽지도 쓰지도 않으니 얹어도 판정이 보는 동작은 같다.
 */
export const ROLE_MIGRATION = '20261112021830_add_user_role';

/** 마이그레이션 하나만 적용한다 — `before` 로 앞에서 끊은 판정이 그 뒤의 것 하나를 더 얹을 때. */
export async function applyMigration(client, name) {
  await client.query(readFileSync(new URL(`${name}/migration.sql`, MIG), 'utf8'));
}
