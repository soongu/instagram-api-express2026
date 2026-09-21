// p2-28 blocks.sql 을 순서대로 실행해서 교안에 붙일 「언어 없는 펜스」를 «계산해서» 만든다.
//   쓰는 법:  node sql/p2-28/render.mjs        (컨테이너 둘이 떠 있어야 한다)
//             BLOCKS=sql/p2-28/answers.sql node sql/p2-28/render.mjs
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { fence } from '../_fence.mjs';
import { parse, setupInstagram, setupBookstore } from './corpus.mjs';

const mk = (db, port) => new pg.Client({ host:'localhost', port, database:db, user:'postgres', password:'postgres' });
const IG = mk('instagram', 5432), BK = mk('bookstore', 5433);
await IG.connect(); await BK.connect();
await setupInstagram(IG); await setupBookstore(BK);

// PRELUDE 를 주면 그것을 «조용히» 먼저 돌린다 — 답안은 「교안을 끝까지 따라간 학생」에서 출발한다.
if (process.env.PRELUDE) {
  let pc = IG;
  for (const step of parse(readFileSync(process.env.PRELUDE, 'utf8'))) {
    if (step.db) { pc = step.db === 'bookstore' ? BK : IG; continue; }
    try { await pc.query(step.sql); } catch { /* 일부러 막히는 블록 */ }
  }
}
let cur = IG, n = 0;
for (const step of parse(readFileSync(process.env.BLOCKS ?? 'sql/p2-28/blocks.sql', 'utf8'))) {
  if (step.db) { cur = step.db === 'bookstore' ? BK : IG; continue; }
  if (step.setup) { await cur.query(step.sql); continue; }
  n += 1;
  const head = step.sql.split('\n')[0].slice(0, 62);
  try {
    const r = await cur.query(step.sql);
    const last = Array.isArray(r) ? r[r.length - 1] : r;
    if (step.fails) { console.log(`\n<<<${n}>>> ${head}\n  ❌ 막혀야 하는데 «성공»했다 (기대 ${step.fails})`); continue; }
    if (last.rows?.length) {
      console.log(`\n<<<${n}>>> ${head}   [${last.rows.length}줄 · 칸 ${last.fields.length}개]`);
      console.log('  칸이름: ' + last.fields.map((f) => f.name).join(', '));
      try { console.log(fence(last.rows, last.fields)); }
      catch (e) { console.log('  ⚠️ ' + e.message + ' — 교안에는 칸 이름만 쓴다'); }
    } else {
      console.log(`\n<<<${n}>>> ${head}   [${last.command} ${last.rowCount ?? ''} · 돌아온 줄 없음]`);
    }
  } catch (e) {
    const ok = step.fails === e.code ? '✅ 기대대로' : `❌ 기대 ${step.fails ?? '성공'}`;
    console.log(`\n<<<${n}>>> ${head}\n  ${ok} 막힘 ${e.code}\n  message: ${e.message}` +
      (e.detail ? `\n  detail:  ${e.detail}` : '') + (e.hint ? `\n  hint:    ${e.hint}` : ''));
  }
}
await IG.end(); await BK.end();
