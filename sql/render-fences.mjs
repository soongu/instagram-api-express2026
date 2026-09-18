// sql/p2-NN/blocks.sql 을 순서대로 실행해서, 교안에 붙일 「언어 없는 펜스」를 «계산해서» 만든다.
//
// 🚨 결과 표를 손으로 옮겨 적지 않으려고 만들었다. 옮겨 적는 순간 그 자리가 드리프트가 된다
//    (루트 캐논 「다이어그램-코드 수치 드리프트」). 여기서 나온 것을 그대로 붙인다.
// 🚨 폭 계산은 캐논 실측 자를 쓴다 — 한글·전각·①~⑳ = 2칸, 박스·`·`·`→`·ASCII = 1칸.
//
// 쓰는 법:  node sql/render-fences.mjs          (컨테이너 둘이 떠 있어야 한다)
//           BLOCKS=sql/p2-27/answers.sql node sql/render-fences.mjs
// 숫자 칸은 오른쪽 정렬, 글자 칸은 왼쪽 정렬. 한글=2칸.
import pg from 'pg';
import { readFileSync } from 'node:fs';
// 폭 계산·펜스 조립은 `_fence.mjs` 로 옮겼다 — p2-28 이 같은 자를 쓴다.
export { fence, W, pad } from './_fence.mjs';
import { fence } from './_fence.mjs';

// 🚨 TIMESTAMP(OID 1114) 는 «서버가 찍은 글자 그대로» 받는다. 안 그러면 node-pg 가 로컬 시각
//    `Date` 로 읽어서, 교안에 붙일 칸에 `Mon Sep 28 2026 08:55:00 GMT+0900 …` 같은 글자가 찍힌다.
//    학생 결과 창(VS Code 확장)은 psql 과 같은 `2026-09-28 08:55:00` 을 보여준다.
pg.types.setTypeParser(1114, (v) => v);

// 🚨 수업 DB(`instagram`·`bookstore`)에 대고 돌리지 않는다 — 표를 통째로 DROP 하고 다시 만들어서
//    그 DB 에 쌓인 상태를 날린다(뒤 회차의 외래 키가 있으면 DROP 이 2BP01 로 죽기도 한다).
//    두 서버에 이 스크립트 전용 DB 를 만들고 끝나면 지운다(2026-09-18).
const RENDER_DB = 'p227_render';
const mk = (db, port) => new pg.Client({host:'localhost',port,database:db,user:'postgres',password:'postgres'});
async function scratch(port, drop) {
  const admin = mk('postgres', port);
  await admin.connect();
  await admin.query(`select pg_terminate_backend(pid) from pg_stat_activity where datname = '${RENDER_DB}' and pid <> pg_backend_pid()`);
  await admin.query(`DROP DATABASE IF EXISTS ${RENDER_DB}`);
  if (!drop) await admin.query(`CREATE DATABASE ${RENDER_DB}`);
  await admin.end();
}
await scratch(5432); await scratch(5433);
const IG = mk(RENDER_DB,5432), BK = mk(RENDER_DB,5433);
await IG.connect(); await BK.connect();
const base = readFileSync('sql/p2-26/03-posts.sql','utf8')+'\n'+readFileSync('sql/p2-26/04-insert.sql','utf8');
const reset = async () => { await IG.query('DROP TABLE IF EXISTS posts'); await IG.query(base); };
await reset();
await BK.query(`CREATE TABLE books (id SERIAL PRIMARY KEY, title VARCHAR(200) NOT NULL,
  author VARCHAR(100) NOT NULL, price INTEGER NOT NULL, stock INTEGER NOT NULL DEFAULT 0)`);
await BK.query("INSERT INTO books (title, author, price) VALUES ('객체지향의 사실과 오해','조영호',15000)");

// `-- @@setup` 은 답안 코퍼스(answers.sql)의 앞 회차 산출물 재현 — 조용히 실행하고 번호를 안 매긴다.
const raw = readFileSync(process.env.BLOCKS ?? 'sql/p2-27/blocks.sql','utf8');
const parts = raw.split(/^-- @@(reset|bookstore|instagram|setup)?$/m);
let cur = IG, n = 0;
for (let i = 1; i < parts.length; i += 2) {
  const t = parts[i];
  if (t === 'reset') await reset();
  if (t === 'bookstore') cur = BK;
  if (t === 'instagram') cur = IG;
  const body = (parts[i+1]||'').split('\n').filter(l=>!l.startsWith('--')).join('\n').trim();
  if (!body) continue;
  if (t === 'setup') { await cur.query(body); continue; }
  n += 1;
  const r = await cur.query(body);
  if (r.rows.length) {
    console.log(`\n<<<${n}>>> ${body.split('\n')[0].slice(0,60)}`);
    console.log(fence(r.rows, r.fields));
  } else {
    console.log(`\n<<<${n}>>> ${body.split('\n')[0].slice(0,60)}  [${r.command} ${r.rowCount ?? ''} · 돌아온 줄 없음]`);
  }
}
await IG.end(); await BK.end();
await scratch(5432, true); await scratch(5433, true);
