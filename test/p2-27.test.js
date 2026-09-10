// p2-27 「SQL 로 데이터 다루기 — CRUD · WHERE · ORDER BY」 게이트
//
// 🚨 학생은 psql 을 안 친다 — VS Code PostgreSQL 확장으로 SQL 을 실행한다.
//    그래서 이 게이트는 «학생이 붙는 그 포트»(localhost:5432)로 똑같이 왕복하고,
//    교안에는 psql 메타명령(\d 등)도 psql 이 찍는 행 수(`DELETE 3`)도 인용하지 않는다.
//    학생이 확인하는 방법은 언제나 `SELECT` 를 한 번 더 돌리는 것이다.
//
// 🚨 p2-26 이 세운 SQL 실행 축을 «한 단계» 넓혔다.
//    그 회차는 파일 4개를 `toContain` 으로 봤는데, 그러면 «순서»와 «그 밖의 블록»이 안 잡힌다.
//    여기서는 교안의 ```sql 블록 목록과 코퍼스를 «전량·순서까지» 같은지 본다(toEqual).
//    교안에 블록을 하나 더 넣거나 순서를 바꾸면 그 자리에서 빨개진다.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import pg from 'pg';

const PG = { host: 'localhost', port: 5432, database: 'instagram', user: 'postgres', password: 'postgres' };
const p26 = (n) => readFileSync(new URL(`../sql/p2-26/${n}`, import.meta.url), 'utf8');
const LECTURE = new URL('../../../part2/5-db-prisma/p2-27-sql-crud-lecture.md', import.meta.url);
const ANSWERS = new URL('../../../part2/5-db-prisma/p2-27-sql-crud-answers.md', import.meta.url);

// 코퍼스를 `-- @@` 로 가른다. `-- @@reset` 은 교안 블록이 아니라 «상태 되돌리기» 지점이다.
function corpus() {
  const raw = readFileSync(new URL('../sql/p2-27/blocks.sql', import.meta.url), 'utf8');
  const parts = raw.split(/^-- @@(reset)?$/m);
  const out = [];
  for (let i = 1; i < parts.length; i += 2) {
    if (parts[i] === 'reset') out.push({ reset: true });
    const body = (parts[i + 1] || '').split('\n').filter((l) => !l.startsWith('--')).join('\n').trim();
    if (body) out.push({ sql: body });
  }
  return out;
}

let db;
const BASE = () => p26('03-posts.sql') + '\n' + p26('04-insert.sql');
async function reset() {
  await db.query('DROP TABLE IF EXISTS posts');
  await db.query(BASE());
}
beforeAll(async () => {
  db = new pg.Client(PG);
  await db.connect();
  await reset();
}, 30000);
afterAll(async () => { await db?.end(); });

describe('교안 ↔ 코퍼스 — 인용한 SQL 이 «전량·순서까지» 같다', () => {
  const md = readFileSync(LECTURE, 'utf8');
  const blocks = [...md.matchAll(/```sql\n([\s\S]*?)```/g)].map((m) => m[1].trim());

  it('교안 sql 블록을 실제로 세었다 (0건이면 이 축이 침묵한 것이다)', () => {
    expect(blocks.length).toBe(34);
  });

  it('블록 목록이 코퍼스와 순서까지 같다', () => {
    expect(blocks).toEqual(corpus().filter((c) => c.sql).map((c) => c.sql));
  });
});

describe('조립 — 교안을 위에서 아래로 «그대로» 따라간다', () => {
  it('34블록이 순서대로 전부 돈다 — 하나도 안 막힌다', async () => {
    await reset();
    const failed = [];
    let i = 0;
    for (const step of corpus()) {
      if (step.reset) { await reset(); continue; }
      i += 1;
      try { await db.query(step.sql); }
      catch (e) { failed.push({ n: i, code: e.code, head: step.sql.split('\n')[0].slice(0, 50) }); }
    }
    // 오늘은 «막히는 것을 보여주는» 회차가 아니다 — 조건을 배우는 회차라 전부 성공해야 한다
    expect(failed).toEqual([]);
    expect(i).toBe(34);
  }, 30000);
});

// 아래는 교안이 «그림으로 그려 보이는» 결과들이다. 산문으로만 적으면 어느 게이트도 안 본다.
describe('Step 1 — 조건을 빠뜨리면', () => {
  it('WHERE 없는 DELETE 는 게시물 셋을 전부 지운다', async () => {
    await reset();
    const r = await db.query('DELETE FROM posts');
    expect(r.rowCount).toBe(3);
    const left = await db.query('SELECT count(*)::int AS n FROM posts');
    expect(left.rows[0].n).toBe(0);
  });

  it('그런데 표 자체는 남는다 — DROP TABLE 과 갈리는 자리', async () => {
    const cols = await db.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'posts' ORDER BY ordinal_position`);
    expect(cols.rows.map((r) => r.column_name)).toEqual([
      'id', 'username', 'profile_image', 'post_image', 'post_alt',
      'content', 'minutes_ago', 'like_count', 'comment_count']);
  });

  it('🚨 WHERE 없는 UPDATE 는 «줄이 그대로 있어서» 더 조용하다', async () => {
    await reset();
    const r = await db.query('UPDATE posts SET like_count = 0');
    expect(r.rowCount).toBe(3);
    const after = await db.query('SELECT id, like_count FROM posts ORDER BY id');
    expect(after.rows).toEqual([
      { id: 1, like_count: 0 }, { id: 2, like_count: 0 }, { id: 3, like_count: 0 }]);
  });
});

describe('Step 2~4 — 조건으로 골라낸다', () => {
  beforeAll(async () => {
    await reset();
    await db.query(corpus().filter((c) => c.sql)[2].sql); // 교안 Step 2 의 INSERT 블록 그대로
  });

  const ids = (r) => r.rows.map((x) => x.id);

  it('예고가 약속한 셋이 전부 돈다 — 100 넘는 것 · 특정 사람 · (정렬은 Step 6)', async () => {
    expect(ids(await db.query('SELECT id FROM posts WHERE like_count > 100 ORDER BY id'))).toEqual([1, 2, 6]);
    expect(ids(await db.query("SELECT id FROM posts WHERE username = 'jaehoon' ORDER BY id"))).toEqual([1, 5]);
  });

  it('글자 조건은 대소문자를 구별한다', async () => {
    expect(ids(await db.query("SELECT id FROM posts WHERE username = 'Jaehoon'"))).toEqual([]);
    expect(ids(await db.query("SELECT id FROM posts WHERE username = 'jaehoon' ORDER BY id"))).toEqual([1, 5]);
  });

  it('🚨 AND 가 OR 보다 «먼저» 묶인다 — 괄호가 결과를 바꾼다', async () => {
    const without = "SELECT id FROM posts WHERE username = 'jaehoon' OR username = 'minji' AND like_count > 300 ORDER BY id";
    const withParen = "SELECT id FROM posts WHERE (username = 'jaehoon' OR username = 'minji') AND like_count > 300 ORDER BY id";
    expect(ids(await db.query(without))).toEqual([1, 2, 5]);
    expect(ids(await db.query(withParen))).toEqual([2]);
  });

  it('BETWEEN 은 «양끝을 포함»한다', async () => {
    expect(ids(await db.query('SELECT id FROM posts WHERE like_count BETWEEN 43 AND 128 ORDER BY id'))).toEqual([1, 3, 4]);
    // 43 과 128 이 실제로 표에 있는 값이라 「포함」이 이 결과로 판정된다
    const edge = await db.query('SELECT like_count FROM posts WHERE id IN (1, 4) ORDER BY id');
    expect(edge.rows.map((r) => r.like_count)).toEqual([128, 43]);
  });

  it('LIKE 의 % 는 아무 글자 여럿, _ 는 한 글자다', async () => {
    expect(ids(await db.query("SELECT id FROM posts WHERE content LIKE '%한강%'"))).toEqual([1]);
    expect(ids(await db.query("SELECT id FROM posts WHERE username LIKE 'j%' ORDER BY id"))).toEqual([1, 5]);
    expect(ids(await db.query("SELECT id FROM posts WHERE username LIKE '_inji' ORDER BY id"))).toEqual([2, 6]);
  });
});

describe('Step 5 — 빈 칸은 조건에 «안 걸린다»', () => {
  beforeAll(async () => {
    await reset();
    await db.query(corpus().filter((c) => c.sql)[2].sql);
  });
  const ids = (r) => r.rows.map((x) => x.id);

  it('= NULL 은 빈 칸이 실재해도 0줄이다', async () => {
    const real = await db.query('SELECT count(*)::int AS n FROM posts WHERE content IS NULL');
    expect(real.rows[0].n).toBe(1);                       // 빈 칸이 «있는데»
    expect(ids(await db.query('SELECT id FROM posts WHERE content = NULL'))).toEqual([]); // 0줄
  });

  it('IS NULL / IS NOT NULL 로만 걸린다', async () => {
    expect(ids(await db.query('SELECT id FROM posts WHERE content IS NULL'))).toEqual([5]);
    expect(ids(await db.query('SELECT id FROM posts WHERE content IS NOT NULL ORDER BY id'))).toEqual([1, 2, 3, 4, 6]);
  });

  it('🚨 <> 로 걸러도 빈 칸은 «안 따라온다» — 5줄일 것 같은데 4줄이다', async () => {
    const r = await db.query("SELECT id FROM posts WHERE content <> '오늘 도착한 렌즈' ORDER BY id");
    expect(ids(r)).toEqual([1, 2, 3, 4]);                 // 5번(빈 칸)이 빠진다
    expect(r.rowCount).toBe(4);
  });
});

describe('Step 6 — 줄 세워서 위에서 몇 개만', () => {
  beforeAll(async () => {
    await reset();
    await db.query(corpus().filter((c) => c.sql)[2].sql);
  });
  const ids = (r) => r.rows.map((x) => x.id);

  it('최신순은 minutes_ago 가 «작은» 쪽이다 — 오름차순이 최신순이 된다', async () => {
    expect(ids(await db.query('SELECT id FROM posts ORDER BY minutes_ago'))).toEqual([4, 1, 2, 5, 3, 6]);
  });

  it('DESC 는 큰 쪽부터', async () => {
    expect(ids(await db.query('SELECT id FROM posts ORDER BY like_count DESC'))).toEqual([2, 6, 1, 3, 4, 5]);
  });

  it('둘째 칸은 «동점일 때만» 일한다 — jaehoon 둘과 minji 둘이 그 자리다', async () => {
    expect(ids(await db.query('SELECT id FROM posts ORDER BY username, minutes_ago'))).toEqual([4, 1, 5, 2, 6, 3]);
    const dup = await db.query(
      'SELECT username FROM posts GROUP BY username HAVING count(*) > 1 ORDER BY username');
    expect(dup.rows.map((r) => r.username)).toEqual(['jaehoon', 'minji']); // 동점이 실재한다
  });

  it('LIMIT · OFFSET — p2-11 의 _page=2&_per_page=2 가 서버에서 하던 일', async () => {
    expect(ids(await db.query('SELECT id FROM posts ORDER BY minutes_ago LIMIT 5'))).toEqual([4, 1, 2, 5, 3]);
    expect(ids(await db.query('SELECT id FROM posts ORDER BY minutes_ago LIMIT 2 OFFSET 2'))).toEqual([2, 5]);
  });

  it('🚨 한글 칸으로 줄을 세우면 가나다순이 아니다 — 글자 수가 적은 것부터 온다', async () => {
    const r = await db.query(
      `SELECT s FROM unnest(ARRAY['나','가가','나나','가나다']) AS s ORDER BY s`);
    expect(r.rows.map((x) => x.s)).toEqual(['나', '가가', '나나', '가나다']);
    const loc = await db.query("SELECT datcollate FROM pg_database WHERE datname = 'instagram'");
    expect(loc.rows[0].datcollate).toBe('en_US.utf8');   // 교안이 대는 이유가 이것이다
  });
});

describe('Step 7~8 — 고치기와 지우기', () => {
  beforeAll(async () => {
    await reset();
    await db.query(corpus().filter((c) => c.sql)[2].sql);
  });

  it('현재 값을 기준으로 더할 수 있다', async () => {
    await db.query('UPDATE posts SET like_count = like_count + 1 WHERE id = 1');
    const r = await db.query('SELECT like_count FROM posts WHERE id = 1');
    expect(r.rows[0].like_count).toBe(129);
  });

  it('RETURNING 이 «고친 뒤의» 줄을 돌려준다 — SELECT 를 한 번 덜 돌린다', async () => {
    const r = await db.query('UPDATE posts SET like_count = like_count + 1 WHERE id = 1 RETURNING id, like_count');
    expect(r.rows).toEqual([{ id: 1, like_count: 130 }]);
  });

  it('아무 줄도 안 걸리면 «에러가 아니라» 0줄이다', async () => {
    const r = await db.query('UPDATE posts SET like_count = 0 WHERE id = 999');
    expect(r.rowCount).toBe(0);
  });

  it('지우기 전에 «같은 조건으로» 세어본 수가 실제로 지워진 수와 같다', async () => {
    const before = await db.query('SELECT id FROM posts WHERE like_count < 50 ORDER BY id');
    expect(before.rows.map((r) => r.id)).toEqual([4, 5]);
    const del = await db.query('DELETE FROM posts WHERE like_count < 50');
    expect(del.rowCount).toBe(before.rowCount);
  });

  it('🚨 지운 번호는 «돌아오지 않는다» — p2-26 의 DROP TABLE 과 갈린다', async () => {
    const left = await db.query('SELECT id FROM posts ORDER BY id');
    expect(left.rows.map((r) => r.id)).toEqual([1, 2, 3, 6]);   // 4·5 가 비었다
    const ins = await db.query(
      "INSERT INTO posts (username, post_image, post_alt) VALUES ('dahye', '/images/post-7.jpg', '저녁 산책') RETURNING id");
    expect(ins.rows[0].id).toBe(7);                             // 4 가 아니라 7
  });

  it('DROP TABLE 은 번호를 «처음부터» 세운다 — p2-26 이 그렇게 가르쳤다', async () => {
    await reset();
    const ins = await db.query(
      "INSERT INTO posts (username, post_image) VALUES ('x', '/x.jpg') RETURNING id");
    expect(ins.rows[0].id).toBe(4);   // 셋을 넣은 뒤라 4 — 표를 새로 그렸으므로 1 부터 센 결과다
  });
});

describe('답안 — 과제가 시킨 것과 답안이 답하는 것이 같다', () => {
  it('답안 파일이 있고 채점 포인트가 과제 수(2)만큼 있다', () => {
    const md = readFileSync(ANSWERS, 'utf8');
    expect([...md.matchAll(/^### 채점 포인트/gm)].length).toBe(2);
  });
});
