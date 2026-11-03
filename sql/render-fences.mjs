// sql/p2-NN/blocks.sql 을 순서대로 실행해서, 교안에 붙일 「언어 없는 펜스」를 «계산해서» 만든다.
//
// 🚨 결과 표를 손으로 옮겨 적지 않으려고 만들었다. 옮겨 적는 순간 그 자리가 드리프트가 된다
//    (루트 캐논 「다이어그램-코드 수치 드리프트」). 여기서 나온 것을 그대로 붙인다.
// 🚨 폭 계산은 캐논 실측 자를 쓴다 — 한글·전각·①~⑳ = 2칸, 박스·`·`·`→`·ASCII = 1칸.
//
// 쓰는 법:  node sql/render-fences.mjs          (컨테이너 둘이 떠 있어야 한다)
// 숫자 칸은 오른쪽 정렬, 글자 칸은 왼쪽 정렬. 한글=2칸.
import pg from 'pg';
import { readFileSync } from 'node:fs';
// 폭 계산·펜스 조립은 `_fence.mjs` 로 옮겼다 — p2-28 이 같은 자를 쓴다.
export { fence, W, pad } from './_fence.mjs';
import { fence } from './_fence.mjs';

const mk = (db, port) => new pg.Client({host:'localhost',port,database:db,user:'postgres',password:'postgres'});
const IG = mk('instagram',5432), BK = mk('bookstore',5433);
await IG.connect(); await BK.connect();
const base = readFileSync('sql/p2-26/03-posts.sql','utf8')+'\n'+readFileSync('sql/p2-26/04-insert.sql','utf8');
const reset = async () => { await IG.query('DROP TABLE IF EXISTS posts'); await IG.query(base); };
await reset();
await BK.query('DROP TABLE IF EXISTS stock_check');
await BK.query('DROP TABLE IF EXISTS books');
await BK.query(`CREATE TABLE books (id SERIAL PRIMARY KEY, title VARCHAR(200) NOT NULL,
  author VARCHAR(100) NOT NULL, price INTEGER NOT NULL, stock INTEGER NOT NULL DEFAULT 0)`);
await BK.query("INSERT INTO books (title, author, price) VALUES ('객체지향의 사실과 오해','조영호',15000)");

const raw = readFileSync(process.env.BLOCKS ?? 'sql/p2-27/blocks.sql','utf8');
const parts = raw.split(/^-- @@(reset|bookstore|instagram)?$/m);
let cur = IG, n = 0;
for (let i = 1; i < parts.length; i += 2) {
  const t = parts[i];
  if (t === 'reset') await reset();
  if (t === 'bookstore') cur = BK;
  if (t === 'instagram') cur = IG;
  const body = (parts[i+1]||'').split('\n').filter(l=>!l.startsWith('--')).join('\n').trim();
  if (!body) continue;
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
