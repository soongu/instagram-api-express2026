// p2-28 「관계와 JOIN — Foreign Key · JOIN · 집계」 게이트
//
// 🚨 학생은 psql 을 안 친다 — VS Code PostgreSQL 확장으로 SQL 을 실행한다.
//    그래서 교안에는 psql 메타명령도 psql 이 찍는 행 수도 인용하지 않는다.
//
// 🚨 p2-27 이 세운 SQL 실행 축을 «두 군데» 넓혔다.
//    ① 답안 코퍼스도 실제로 대조·실행한다. p2-27 은 sql/p2-27/answers.sql 을 만들어두고
//       테스트가 그 파일을 «읽지도 않았다» — 축이 통째로 침묵하고 있었다(2026-09-11 발견).
//    ② `-- @@fails <SQLSTATE>` 를 도입했다. 이 회차는 「막히는 것」을 보여주는 회차라
//       「전부 성공」 판정으로는 원리적으로 못 본다. 어느 코드로 막히는지까지 못박는다.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { parse, quoted, lectureCorpus, answerCorpus, setupInstagram, setupBookstore }
  from '../sql/p2-28/corpus.mjs';

// 🚨 전용 DB 에서 돈다 — 이 회차는 `posts`·`comments` 를 통째로 DROP 하고 다시 만드는데,
//    그것을 수업 DB(`instagram`)에 대고 하면 «학생이 지금까지 쌓은 것» 이 사라진다.
//    2026-09-12 실측 — 앞 세션의 전수 실행이 실제로 수업 DB 를 p2-33 이전 모양으로 되돌려놨고,
//    그 망가진 상태에서만 이 회차가 통과하고 있었다(복구하니 DROP 이 외래 키에 막혔다).
const ADMIN = { host: 'localhost', port: 5432, database: 'postgres', user: 'postgres', password: 'postgres' };
const PG = { ...ADMIN, database: 'p228_gate' };

async function 전용DB만들기() {
  const admin = new pg.Client(ADMIN);
  await admin.connect();
  await admin.query(
    "select pg_terminate_backend(pid) from pg_stat_activity where datname = 'p228_gate' and pid <> pg_backend_pid()");
  await admin.query('DROP DATABASE IF EXISTS p228_gate');
  await admin.query('CREATE DATABASE p228_gate');
  await admin.end();
}

async function 전용DB지우기() {
  const admin = new pg.Client(ADMIN);
  await admin.connect();
  await admin.query(
    "select pg_terminate_backend(pid) from pg_stat_activity where datname = 'p228_gate' and pid <> pg_backend_pid()");
  await admin.query('DROP DATABASE IF EXISTS p228_gate');
  await admin.end();
}
const BOOKSTORE = { ...PG, port: 5433, database: 'bookstore' };
const LECTURE = new URL('../../../part2/5-db-prisma/p2-28-join-aggregate-lecture.md', import.meta.url);
const ANSWERS = new URL('../../../part2/5-db-prisma/p2-28-join-aggregate-answers.md', import.meta.url);
const blocksOf = (url) =>
  [...readFileSync(url, 'utf8').matchAll(/```sql\n([\s\S]*?)```/g)].map((m) => m[1].trim());

let db, bk;
const reset = async () => { await setupInstagram(db); await setupBookstore(bk); };
/** 코퍼스를 순서대로 돌린다. `fails` 표시가 있으면 그 SQLSTATE 로 막혀야 한다. */
async function run(raw) {
  const wrong = [];
  let cur = db, n = 0;
  for (const step of parse(raw)) {
    if (step.db) { cur = step.db === 'bookstore' ? bk : db; continue; }
    if (step.setup) { await cur.query(step.sql); continue; }
    n += 1;
    const head = step.sql.split('\n')[0].slice(0, 46);
    try {
      await cur.query(step.sql);
      if (step.fails) wrong.push({ n, head, 기대: step.fails, 실제: '성공' });
    } catch (e) {
      if (step.fails !== e.code) wrong.push({ n, head, 기대: step.fails ?? '성공', 실제: e.code });
    }
  }
  return { wrong, n };
}

beforeAll(async () => {
  await 전용DB만들기();
  db = new pg.Client(PG); bk = new pg.Client(BOOKSTORE);
  await db.connect(); await bk.connect();
  await reset();
}, 30000);
// 🚨 뒷정리를 «반드시» 한다. 이 회차가 comments→posts 외래 키를 남기면
//    p2-26·p2-27 의 `DROP TABLE IF EXISTS posts` 가 2BP01 로 죽는다(실측).
afterAll(async () => {
  try {
    await db?.query('DROP TABLE IF EXISTS comments');
    await bk?.query('DROP TABLE IF EXISTS authors CASCADE');
    await bk?.query('DROP TABLE IF EXISTS reviews');
  } finally { await db?.end(); await bk?.end(); }

  await 전용DB지우기();
});

describe('교안·답안 ↔ 코퍼스 — 인용한 SQL 이 «전량·순서까지» 같다', () => {
  it('교안 sql 블록을 실제로 세었다 (0건이면 이 축이 침묵한 것이다)', () => {
    expect(blocksOf(LECTURE).length).toBe(53);
  });
  it('교안 블록 목록이 코퍼스와 순서까지 같다', () => {
    expect(blocksOf(LECTURE)).toEqual(quoted(lectureCorpus()));
  });
  it('답안 sql 블록을 실제로 세었다', () => {
    expect(blocksOf(ANSWERS).length).toBe(19);
  });
  it('답안 블록 목록이 코퍼스와 순서까지 같다 — p2-27 이 침묵하던 축', () => {
    expect(blocksOf(ANSWERS)).toEqual(quoted(answerCorpus()));
  });
});

describe('착수 상태 — p2-27 을 끝까지 따라간 학생과 어긋나지 않는다', () => {
  it('sql/p2-28/00-posts.sql 이 p2-27 blocks.sql 재생본과 «같은 posts» 를 만든다', async () => {
    const p26 = (n) => readFileSync(new URL(`../sql/p2-26/${n}`, import.meta.url), 'utf8');
    const base = p26('03-posts.sql') + '\n' + p26('04-insert.sql');
    const replay = async () => {
      await db.query('DROP TABLE IF EXISTS comments');
      await db.query('DROP TABLE IF EXISTS posts');
      await db.query(base);
    };
    await replay();
    const raw = readFileSync(new URL('../sql/p2-27/blocks.sql', import.meta.url), 'utf8');
    const parts = raw.split(/^-- @@(reset|bookstore|instagram)?$/m);
    let skip = false;
    for (let i = 1; i < parts.length; i += 2) {
      const t = parts[i];
      if (t === 'reset') await replay();
      if (t === 'bookstore') skip = true;
      if (t === 'instagram') skip = false;
      const body = (parts[i + 1] || '').split('\n').filter((l) => !l.startsWith('--')).join('\n').trim();
      if (!body || skip) continue;
      try { await db.query(body); } catch { /* p2-27 도 막히는 블록이 있다 */ }
    }
    const replayed = (await db.query('SELECT * FROM posts ORDER BY id')).rows;
    await reset();
    const ours = (await db.query('SELECT * FROM posts ORDER BY id')).rows;
    expect(ours).toEqual(replayed);           // 하드코딩한 착수 상태가 낡으면 여기서 빨개진다
  }, 60000);

  it('오프닝이 대는 comment_count 가 실제 값이다', async () => {
    const r = await db.query('SELECT id, comment_count FROM posts ORDER BY id');
    expect(r.rows).toEqual([
      { id: 1, comment_count: 4 }, { id: 2, comment_count: 23 }, { id: 3, comment_count: 8 },
      { id: 6, comment_count: 11 }, { id: 7, comment_count: 0 }]);
  });

  it('🚨 오프닝의 근거 — 6번 게시물 댓글은 «어느 학생 표에도» 0개다', async () => {
    // p2-26 과제(post_id=1 셋)와 p2-27 과제(2·2·3·3)가 1·2·3 에만 댓글을 달게 했다.
    const r = await db.query('SELECT count(*)::int AS n FROM comments WHERE post_id = 6');
    expect(r.rows[0].n).toBe(0);
  });
});

describe('조립 — 교안을 위에서 아래로 «그대로» 따라간다', () => {
  it('53블록이 순서대로 돌고, 막힌다고 적은 7개가 «그 코드로» 막힌다', async () => {
    await reset();
    const { wrong, n } = await run(lectureCorpus());
    expect(wrong).toEqual([]);
    expect(n).toBe(53);
    expect(parse(lectureCorpus()).filter((s) => s.fails).length).toBe(7);
  }, 60000);

  it('답안 19블록도 «교안을 끝낸 상태에서» 순서대로 돈다', async () => {
    await reset();
    await run(lectureCorpus());
    const { wrong, n } = await run(answerCorpus());
    expect(wrong).toEqual([]);
    expect(n).toBe(19);
  }, 60000);

  it('위험한 블록은 서점 것이거나 조건이 붙어 있다', () => {
    const risky = quoted(lectureCorpus()).filter((s) => /^(DELETE|DROP|TRUNCATE)/.test(s));
    // posts 를 조건 없이 지우거나 통째로 버리는 블록은 «성공하는 자리에» 없다
    const dropsPosts = parse(lectureCorpus())
      .filter((s) => s.sql && /^DROP TABLE posts/.test(s.sql));
    expect(dropsPosts.every((s) => s.fails === '2BP01')).toBe(true);
    expect(risky.filter((s) => /^DELETE FROM posts$/.test(s))).toEqual([]);
  });
});

describe('Step 1~2 — 외래 키가 막는 것 셋', () => {
  beforeAll(async () => { await reset(); await run(lectureCorpus()); });

  it('규칙을 걸기 전에는 없는 번호가 그냥 들어간다', async () => {
    await db.query('ALTER TABLE comments DROP CONSTRAINT comments_post_id_fkey');
    const r = await db.query(
      "INSERT INTO comments (post_id, username, content) VALUES (999,'x','y') RETURNING post_id");
    expect(r.rows[0].post_id).toBe(999);
  });

  it('🚨 어긋난 줄이 하나라도 있으면 «규칙 자체가 안 걸린다»', async () => {
    await expect(db.query(
      'ALTER TABLE comments ADD CONSTRAINT comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES posts (id)'
    )).rejects.toMatchObject({ code: '23503' });
  });

  it('치우고 걸면 걸린다', async () => {
    await db.query('DELETE FROM comments WHERE post_id = 999');
    await db.query(
      'ALTER TABLE comments ADD CONSTRAINT comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES posts (id)');
    const r = await db.query(
      "SELECT count(*)::int AS n FROM pg_constraint WHERE conname = 'comments_post_id_fkey'");
    expect(r.rows[0].n).toBe(1);
  });

  it('① 없는 post_id · ② 댓글 달린 posts 줄 · ③ posts 표 자체 — 셋 다 막힌다', async () => {
    await expect(db.query("INSERT INTO comments (post_id, username, content) VALUES (999,'x','y')"))
      .rejects.toMatchObject({ code: '23503' });
    await expect(db.query('DELETE FROM posts WHERE id = 1'))
      .rejects.toMatchObject({ code: '23503' });
    await expect(db.query('DROP TABLE posts'))
      .rejects.toMatchObject({ code: '2BP01' });   // IF EXISTS 를 붙여도 마찬가지다
    await expect(db.query('DROP TABLE IF EXISTS posts'))
      .rejects.toMatchObject({ code: '2BP01' });
  });

  it('NULL 은 외래 키 검사를 지나간다 — 실습 정답이 그렇게 적혀 있다', async () => {
    await bk.query("INSERT INTO reviews (book_title, reviewer, score, book_id) VALUES ('x','n',5,NULL)");
    const r = await bk.query("SELECT count(*)::int AS n FROM reviews WHERE book_id IS NULL");
    expect(r.rows[0].n).toBe(1);
    await bk.query("DELETE FROM reviews WHERE reviewer = 'n'");
  });

  it('이미 줄이 든 표에 NOT NULL 칸은 바로 못 붙이고, DEFAULT 를 주면 붙는다', async () => {
    await expect(bk.query('ALTER TABLE reviews ADD COLUMN t INTEGER NOT NULL'))
      .rejects.toMatchObject({ code: '23502' });
    await bk.query('ALTER TABLE reviews ADD COLUMN t INTEGER NOT NULL DEFAULT 0');
    await bk.query('ALTER TABLE reviews DROP COLUMN t');
  });
});

describe('Step 3~4 — 잇기', () => {
  beforeAll(async () => { await reset(); await run(lectureCorpus()); });
  const one = async (s) => (await db.query(s)).rows[0];

  it('🚨 조건을 안 주면 모든 조합 — 게시물 5 × 댓글 9 = 45줄', async () => {
    expect((await one('SELECT count(*)::int AS n FROM posts, comments')).n).toBe(45);
    const p = await one('SELECT count(*)::int AS n FROM posts');
    const c = await one('SELECT count(*)::int AS n FROM comments');
    expect([p.n, c.n]).toEqual([5, 9]);     // 45 가 곱이라는 것까지 못박는다
  });

  it('JOIN 에 ON 을 빼면 «문법 에러»가 난다', async () => {
    await expect(db.query('SELECT * FROM posts JOIN comments'))
      .rejects.toMatchObject({ code: '42601' });
  });

  it('🚨 SELECT * 로 이으면 칸 15개 · 이름이 겹치는 것 5개', async () => {
    const r = await db.query('SELECT * FROM posts JOIN comments ON comments.post_id = posts.id');
    const names = r.fields.map((f) => f.name);
    expect(names.length).toBe(15);
    const dup = [...new Set(names.filter((n, i) => names.indexOf(n) !== i))];
    expect(dup).toEqual(['id', 'username', 'content', 'like_count', 'minutes_ago']);
    expect(r.rows.length).toBe(9);
  });

  it('INNER 는 9줄이고 6·7번이 빠진다 · LEFT 는 11줄이고 그 둘이 NULL 로 남는다', async () => {
    const inner = await db.query(
      'SELECT p.id FROM posts p JOIN comments c ON c.post_id = p.id ORDER BY p.id');
    expect(inner.rows.length).toBe(9);
    expect([...new Set(inner.rows.map((r) => r.id))]).toEqual([1, 2, 3]);
    const left = await db.query(
      'SELECT p.id, c.username FROM posts p LEFT JOIN comments c ON c.post_id = p.id ORDER BY p.id');
    expect(left.rows.length).toBe(11);
    expect(left.rows.filter((r) => r.username === null).map((r) => r.id)).toEqual([6, 7]);
  });
});

describe('Step 5~8 — 세기와 집계', () => {
  beforeAll(async () => { await reset(); await run(lectureCorpus()); });
  const rows = async (s) => (await db.query(s)).rows;

  it('count(칸) 은 NULL 인 줄을 안 센다 — posts 다섯 중 content 는 넷', async () => {
    expect((await rows('SELECT count(*)::int AS a, count(content)::int AS b FROM posts'))[0])
      .toEqual({ a: 5, b: 4 });
  });

  it('🚨 LEFT JOIN 뒤 count(*) 는 11, count(c.id) 는 9 — 맞는 답은 9다', async () => {
    expect((await rows(`SELECT count(*)::int AS a, count(c.id)::int AS b
      FROM posts p LEFT JOIN comments c ON c.post_id = p.id`))[0]).toEqual({ a: 11, b: 9 });
  });

  it('🚨 게시물별로 묶으면 «댓글 0인 게시물이 count(*) 로는 1» 이다', async () => {
    const r = await rows(`SELECT p.id, count(*)::int AS star, count(c.id)::int AS col
      FROM posts p LEFT JOIN comments c ON c.post_id = p.id GROUP BY p.id ORDER BY p.id`);
    expect(r).toEqual([
      { id: 1, star: 3, col: 3 }, { id: 2, star: 4, col: 4 }, { id: 3, star: 2, col: 2 },
      { id: 6, star: 1, col: 0 }, { id: 7, star: 1, col: 0 }]);
  });

  it('오프닝 회수 — 적어둔 수와 세어본 수가 다섯 중 넷에서 어긋난다', async () => {
    const r = await rows(`SELECT p.id, p.comment_count AS wrote, count(c.id)::int AS counted
      FROM posts p LEFT JOIN comments c ON c.post_id = p.id
      GROUP BY p.id, p.comment_count ORDER BY p.id`);
    expect(r).toEqual([
      { id: 1, wrote: 4, counted: 3 }, { id: 2, wrote: 23, counted: 4 },
      { id: 3, wrote: 8, counted: 2 }, { id: 6, wrote: 11, counted: 0 },
      { id: 7, wrote: 0, counted: 0 }]);
    expect(r.filter((x) => x.wrote !== x.counted).length).toBe(4);
  });

  it('GROUP BY 에 안 넣은 칸을 고르면 막힌다 · WHERE 에는 집계 함수를 못 쓴다', async () => {
    await expect(db.query('SELECT post_id, username, count(*) FROM comments GROUP BY post_id'))
      .rejects.toMatchObject({ code: '42803' });
    await expect(db.query('SELECT post_id, count(*) FROM comments WHERE count(*) >= 3 GROUP BY post_id'))
      .rejects.toMatchObject({ code: '42803' });
  });

  it('HAVING · 그리고 WHERE 가 걷어낸 줄이 HAVING 결과를 바꾼다', async () => {
    expect((await rows(`SELECT post_id FROM comments GROUP BY post_id
      HAVING count(*) >= 3 ORDER BY post_id`)).map((r) => r.post_id)).toEqual([1, 2]);
    expect((await rows(`SELECT post_id, count(*)::int AS n FROM comments
      WHERE like_count > 0 GROUP BY post_id ORDER BY post_id`)))
      .toEqual([{ post_id: 1, n: 2 }, { post_id: 2, n: 4 }, { post_id: 3, n: 2 }]);
    expect((await rows(`SELECT post_id FROM comments WHERE like_count > 0
      GROUP BY post_id HAVING count(*) >= 3`)).map((r) => r.post_id)).toEqual([2]);
  });

  it('집계 다섯 · round · 그리고 «셀 게 없으면 count 는 0, avg 는 NULL»', async () => {
    const a = (await rows(`SELECT count(*)::int AS c, sum(like_count)::int AS s,
      max(like_count) AS mx, min(like_count) AS mn, round(avg(like_count),1) AS av FROM comments`))[0];
    expect(a).toEqual({ c: 9, s: 92, mx: 30, mn: 0, av: '10.2' });
    const r = await rows(`SELECT p.id, count(c.id)::int AS n, round(avg(c.like_count),1) AS av
      FROM posts p LEFT JOIN comments c ON c.post_id = p.id GROUP BY p.id ORDER BY p.id`);
    expect(r.filter((x) => x.n === 0)).toEqual([{ id: 6, n: 0, av: null }, { id: 7, n: 0, av: null }]);
  });
});

describe('답안 — 과제가 시킨 것과 답안이 답하는 것이 같다', () => {
  it('채점 포인트가 과제 수(2)만큼 있다', () => {
    expect([...readFileSync(ANSWERS, 'utf8').matchAll(/^### 채점 포인트/gm)].length).toBe(2);
  });
  it('🚨 과제 1 의 정렬이 «동점에서 흔들리지 않는다» — 둘째 기준이 실제로 일한다', async () => {
    await reset(); await run(lectureCorpus());
    const tie = await db.query('SELECT count(*)::int AS n FROM comments WHERE like_count = 12');
    expect(tie.rows[0].n).toBe(2);                       // 동점이 실재한다
    const r = await db.query(`SELECT c.content FROM posts p JOIN comments c ON c.post_id = p.id
      ORDER BY c.like_count DESC, c.minutes_ago LIMIT 3`);
    expect(r.rows.map((x) => x.content))
      .toEqual(['코트 어디예요?', '냄새가 여기까지', '크루아상 색이 좋네요']);
  }, 60000);
  it('과제 2 — 저자는 다섯이고 로버트 마틴만 책이 둘이다', async () => {
    await reset(); await run(lectureCorpus()); await run(answerCorpus());
    expect((await bk.query('SELECT count(*)::int AS n FROM authors')).rows[0].n).toBe(5);
    const r = await bk.query(`SELECT a.name, count(b.id)::int AS n, round(avg(b.price),1) AS av
      FROM authors a JOIN books b ON b.author_id = a.id
      GROUP BY a.id, a.name HAVING count(b.id) >= 2 ORDER BY a.id`);
    expect(r.rows).toEqual([{ name: '로버트 마틴', n: 2, av: '32500.0' }]);
  }, 60000);
});
