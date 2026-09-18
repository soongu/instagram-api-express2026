// p2-33 착수 상태 — 「p2-32 교안과 과제를 끝낸 학생」을 통째로 재현한다.
//
// 🚨 손으로 적지 않는다. 앞 회차 코퍼스·스냅숏을 «재생해서» 세운다.
// 🚨 instagram 쪽은 p2-30 세터(p2-29 교안 + 과제 [기초] · 학생 표의 줄 순서)를 그대로 쓴다.
//    🔀 2026-09-18 audit — 옛 판은 p2-29 세터에 created_at 만 얹었다. 이제 created_at 은 p2-26 부터 있고
//       updated_at 둘은 p2-29 가 더하며, p2-30 시드가 그 둘을 채운다.
// 🚨 bookstore 쪽은 조각이 셋이다 — p2-28 코퍼스(books·authors·reviews·author_id) +
//    p2-29 직접 해보기의 is_sold_out + p2-29 과제의 publishers. 하나라도 빼면
//    Prisma 가 드리프트를 보고 «리셋하자»고 해서 이 회차 실습이 통째로 성립하지 않는다.
//    (실제로 그렇게 돼서 직접 해보기 2 를 못 돌렸다 — 2026-09-11)
import { readFileSync } from 'node:fs';
import { setupP229Bookstore } from '../p2-29/setup.mjs';
import { setupP230 } from '../p2-30/setup.mjs';

const SNAP = new URL('../../snapshots/p2-29/', import.meta.url);

/** instagram 을 p2-30 착수 상태로 — 🚨 p2-30 시드는 테스트가 따로 돌린다(번호 1~5). */
export async function setupP233(client) {
  await client.query('DROP TABLE IF EXISTS users CASCADE');   // 이 회차가 만드는 표
  await setupP230(client);
}

/** bookstore 를 p2-29 교안 + 과제까지 끝낸 상태로. */
export async function setupP233Bookstore(client) {
  await client.query('DROP TABLE IF EXISTS reviewers CASCADE');
  await setupP229Bookstore(client);
  await client.query(
    'ALTER TABLE books ADD COLUMN IF NOT EXISTS is_sold_out BOOLEAN NOT NULL DEFAULT false');
  await client.query(readFileSync(new URL('answers-publishers.sql', SNAP), 'utf8'));
}
