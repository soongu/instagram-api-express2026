// p2-29 착수 상태 — 「p2-28 교안과 과제를 끝낸 학생의 instagram」을 통째로 재현한다.
//
// 🚨 손으로 적지 않는다. p2-28 코퍼스(교안 blocks + 답안 answers)를 «재생해서» 세운다.
//    p2-28 이 바뀌면 여기가 따라 바뀌고, 그래야 이 회차가 「지난 시간 그대로」에서 출발한다.
// 🚨 Prisma 가 남기는 것(_prisma_migrations)과 이 회차가 더하는 칸(created_at)도 함께 지운다.
//    안 지우면 게이트를 두 번 돌릴 때 두 번째가 「이미 baseline 됨」에서 출발해 축이 침묵한다.
// 🚨 blocks.sql 은 두 DB 를 «여섯 번» 오간다 — 첫 bookstore 에서 멈추면 뒤쪽 instagram
//    블록을 통째로 놓친다. 건너뛰되 «계속 읽는다».
import { readFileSync } from 'node:fs';
import { parse, setupInstagram, setupBookstore } from '../p2-28/corpus.mjs';

const D = new URL('../p2-28/', import.meta.url);

/** 지정한 instagram DB 를 p2-28 종료 상태로 되돌린다. */
export async function setupP229(client) {
  await client.query('DROP TABLE IF EXISTS _prisma_migrations');
  await setupInstagram(client);
  for (const f of ['blocks.sql', 'answers.sql']) {
    let onInstagram = true;
    for (const step of parse(readFileSync(new URL(f, D), 'utf8'))) {
      if (step.db) { onInstagram = step.db === 'instagram'; continue; }
      if (!onInstagram) continue;
      try { await client.query(step.sql); } catch { /* 일부러 막히는 블록 */ }
    }
  }
}

/** 지정한 bookstore DB 를 p2-28 종료 상태로 되돌린다 (직접 해보기·과제 몫). */
export async function setupP229Bookstore(client) {
  await client.query('DROP TABLE IF EXISTS publishers CASCADE');
  await client.query('DROP TABLE IF EXISTS _prisma_migrations');
  await setupBookstore(client);
  for (const f of ['blocks.sql', 'answers.sql']) {
    let onBookstore = false;
    for (const step of parse(readFileSync(new URL(f, D), 'utf8'))) {
      if (step.db) { onBookstore = step.db === 'bookstore'; continue; }
      if (!onBookstore) continue;
      try { await client.query(step.sql); } catch { /* 일부러 막히는 블록 */ }
    }
  }
}
