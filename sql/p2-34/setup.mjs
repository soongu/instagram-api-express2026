// p2-34 착수 상태 — 「p2-33 교안과 과제를 끝낸 학생」을 통째로 재현한다.
//
// 🚨 손으로 DDL 을 적지 않는다. 그 회차까지의 «실제 마이그레이션» 을 순서대로 재생한다.
//    손으로 적으면 마이그레이션이 바뀔 때 조용히 갈리고, 그러면 게이트가 학생 것과
//    다른 표 위에서 판정한다.
// 🚨 데이터는 snapshots/p2-33-final/seed.js 가 넣는다 — 그쪽은 그 시점 클라이언트를
//    쓰므로 이 회차가 스키마를 키워도 안 흔들린다.
import { readFileSync } from 'node:fs';

const MIG = new URL('../../prisma/migrations/', import.meta.url);

/** p2-33 종료 시점까지의 마이그레이션 — 이 뒤는 이 회차가 만드는 것이다. */
export const P233_MIGRATIONS = [
  '0_init',
  '20260910232755_add_created_at',
  '20260911120333_normalize_author',
  '20260911120412_cascade_comments',
  '20260911130714_add_user_deactivated_at',
];

/** instagram 을 p2-33 종료 상태로 — users 5 · posts 5(author_id) · comments 9 · post_image 칸 하나. */
export async function setupP234(client) {
  for (const dir of P233_MIGRATIONS) {
    await client.query(readFileSync(new URL(`${dir}/migration.sql`, MIG), 'utf8'));
  }
}

/** 서점을 p2-33 종료 상태로 — 그 회차 직접 해보기 2 가 글자 칸을 뗀 뒤다. */
export async function setupP234Bookstore(client) {
  const { setupP233Bookstore } = await import('../p2-33/setup.mjs');
  await setupP233Bookstore(client);
  await client.query(
    readFileSync(new URL('../../lab/p2-33/migrations/20260911130547_drop_book_author/migration.sql',
      import.meta.url), 'utf8'));
}

/** 이 회차가 서점에 얹는 마이그레이션 — 직접 해보기 셋이 하나씩 만든다. */
export const P234_LAB_MIGRATIONS = [
  '20260911150328_add_book_images',
  '20260911150338_add_review_replies',
  '20260911150339_add_book_tags',
];
