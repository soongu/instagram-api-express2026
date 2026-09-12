// p2-35 착수 상태 — 「p2-34 를 끝낸 학생」을 통째로 재현한다.
//
// 🚨 이 회차는 «스키마를 안 바꾼다». 표도 칸도 그대로이고, 달라지는 것은
//    쓰는 «방법»(트랜잭션·중첩 쓰기)과 읽는 «방법»(select·_count)뿐이다.
//    그래서 이 파일은 마이그레이션을 새로 얹지 않고 p2-34 종료 상태까지만 재생한다.
import { readFileSync } from 'node:fs';

const MIG = new URL('../../prisma/migrations/', import.meta.url);

/** p2-34 종료 시점까지의 마이그레이션 — 이 회차는 여기에 아무것도 안 더한다. */
export const P234_MIGRATIONS = [
  '0_init',
  '20260910232755_add_created_at',
  '20260911120333_normalize_author',
  '20260911120412_cascade_comments',
  '20260911130714_add_user_deactivated_at',
  '20260911142735_add_post_images',
  '20260911142828_move_images_to_table',
  '20260911143803_add_comment_replies',
  '20260911144541_add_post_likes',
];

/** instagram 을 p2-34 종료 상태로 — 표 다섯 · users 5 · posts 5 · post_images 8 · comments 12. */
export async function setupP235(client) {
  for (const dir of P234_MIGRATIONS) {
    await client.query(readFileSync(new URL(`${dir}/migration.sql`, MIG), 'utf8'));
  }
}

/** 서점을 p2-34 종료 상태로 — 그 회차 실습 셋(사진·답글·태그)까지 얹은 뒤다. */
export async function setupP235Bookstore(client) {
  const { setupP234Bookstore } = await import('../p2-34/setup.mjs');
  await setupP234Bookstore(client);
  const LAB = new URL('../../lab/p2-34/migrations/', import.meta.url);
  for (const dir of ['20260911150328_add_book_images', '20260911150338_add_review_replies',
    '20260911150339_add_book_tags']) {
    await client.query(readFileSync(new URL(`${dir}/migration.sql`, LAB), 'utf8'));
  }
}
