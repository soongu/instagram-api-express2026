// p2-30 착수 상태 — 「p2-29 교안과 과제를 끝낸 학생의 instagram」을 통째로 재현한다.
//
// 🚨 손으로 DDL 을 적지 않는다. p2-28 종료 상태(setupP229) 위에 p2-29 가 «실제로 만든»
//    마이그레이션 둘을 그대로 얹는다 — 교안의 add_updated_at 과 과제 [기초]의 댓글 칸.
//    과제 칸까지 얹는 이유: p2-30 시드가 댓글 updated_at 을 채우고, 「시작하기 전에」가
//    그 과제를 먼저 하라고 한다(2026-09-18 사용자 결정). 학생 착수 상태가 하나로 모인다.
// 🚨 «정렬 없는 목록» 의 순서도 학생 것과 맞춘다. setupP229 는 p2-28 종료 상태를 한 번에
//    INSERT 해서 번호순(1·2·3·6·7)으로 놓이지만, 학생 표는 p2-27 이 1번을 두 번 UPDATE 한 뒤
//    7번을 넣어서 2·3·6·1·7 순서로 읽힌다(2026-09-18 학생 이력을 재생해 실측 — ctid
//    (0,2)·(0,3)·(0,6)·(0,9)·(0,10)). 줄을 고치면 그 줄이 뒤로 가니, 1 과 7 을 차례로
//    «아무것도 안 바꾸는» UPDATE 로 건드려 같은 순서를 만든다. 안 맞추면 교안 Step 1·5 의
//    「목록 맨 앞」 주장이 게이트에서만 참이 된다(메모리 gate-premise-vs-student-state).
import { readFileSync } from 'node:fs';
import { setupP229 } from '../p2-29/setup.mjs';

const MIG = new URL('../../snapshots/p2-29/', import.meta.url);

/** 지정한 instagram DB 를 p2-29 종료 상태(과제 포함)로 되돌린다. */
export async function setupP230(client) {
  await setupP229(client);
  await client.query(readFileSync(new URL('migrations/20260930062755_add_updated_at/migration.sql', MIG), 'utf8'));
  await client.query(readFileSync(new URL('answers-comments.sql', MIG), 'utf8'));
  await client.query('UPDATE posts SET like_count = like_count WHERE id = 1');
  await client.query('UPDATE posts SET like_count = like_count WHERE id = 7');
}
