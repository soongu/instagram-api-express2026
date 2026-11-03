// p2-26 「관계형 DB 와 테이블」 게이트
//
// 🚨 학생은 psql 을 안 친다 — VS Code PostgreSQL 확장(ms-ossdata.vscode-pgsql)으로
//    SQL 을 실행한다. 그래서 이 게이트는 «학생이 붙는 그 포트»(localhost:5432)로
//    똑같이 왕복하고, 교안에는 psql 메타명령(\d 등)을 한 줄도 인용하지 않는다.
//    (p2-22 가 supertest 대신 실제 포트를 쓴 것과 같은 이유다.)
//
// 전제: 저장소 루트에서 `docker compose up -d` (compose.yaml)
//    🚨 postgres:18 은 데이터 위치를 옮겼다 — PGDATA=/var/lib/postgresql/18/docker 이고
//       선언된 볼륨은 /var/lib/postgresql 이다. 인터넷 예제가 전부 쓰는
//       /var/lib/postgresql/data 에 마운트하면 «컨테이너가 아예 안 뜬다».
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import pg from 'pg';
import mongoose from 'mongoose';
import { LOCAL_MONGO_URL } from './helpers/boot.js';

// 🚨 전용 DB 에서 돈다 — 이 회차는 `posts`·`comments` 를 통째로 DROP 하고 다시 만드는데,
//    그것을 수업 DB(`instagram`)에 대고 하면 «학생이 지금까지 쌓은 것» 이 사라진다.
//    2026-09-12 실측 — 앞 세션의 전수 실행이 실제로 수업 DB 를 p2-33 이전 모양으로 되돌려놨고,
//    그 망가진 상태에서만 이 회차가 통과하고 있었다(복구하니 DROP 이 외래 키에 막혔다).
const ADMIN = { host: 'localhost', port: 5432, database: 'postgres', user: 'postgres', password: 'postgres' };
const PG = { ...ADMIN, database: 'p226_gate' };

async function 전용DB만들기() {
  const admin = new pg.Client(ADMIN);
  await admin.connect();
  await admin.query(
    "select pg_terminate_backend(pid) from pg_stat_activity where datname = 'p226_gate' and pid <> pg_backend_pid()");
  await admin.query('DROP DATABASE IF EXISTS p226_gate');
  await admin.query('CREATE DATABASE p226_gate');
  await admin.end();
}

async function 전용DB지우기() {
  const admin = new pg.Client(ADMIN);
  await admin.connect();
  await admin.query(
    "select pg_terminate_backend(pid) from pg_stat_activity where datname = 'p226_gate' and pid <> pg_backend_pid()");
  await admin.query('DROP DATABASE IF EXISTS p226_gate');
  await admin.end();
}
const sql = (n) => readFileSync(new URL(`../sql/p2-26/${n}`, import.meta.url), 'utf8');

let db;
beforeAll(async () => {
  await 전용DB만들기();
  db = new pg.Client(PG);
  await db.connect();
  await db.query('DROP TABLE IF EXISTS comments');
      await db.query('DROP TABLE IF EXISTS posts');
  await db.query(sql('03-posts.sql'));
  await db.query(sql('04-insert.sql'));
}, 30000);
afterAll(async () => { await db?.end(); 
  await 전용DB지우기();
});

// 실패를 «에러 객체»로 받는다 — 교안이 인용할 메시지가 여기서 나온다
async function refused(text, params = []) {
  try { await db.query(text, params); return null; }
  catch (e) { return { code: e.code, message: e.message }; }
}

// 🚨 replay.py 는 SQL 을 모른다 — 이 회차의 실행 대조는 0/0 쌍이었다(「볼 게 없어서 통과」).
//    그래서 교안이 인용한 DDL 이 코드베이스 파일과 «글자 단위로» 같은지를 여기서 잠근다.
//    사본이 두 벌 있으면 언젠가 갈리고, 갈리면 학생이 치는 쪽이 틀린다.
describe('교안 ↔ 코드베이스 — 인용한 SQL 이 파일과 글자 단위로 같다', () => {
  const md = readFileSync(new URL('../../../part2/5-db-prisma/p2-26-relational-table-lecture.md',
                                  import.meta.url), 'utf8');
  const blocks = [...md.matchAll(/```sql\n([\s\S]*?)```/g)].map(m => m[1].trim());
  // .sql 파일의 맨 위 `-- Step N —` 머리 주석은 저장소용이라 떼고 비교한다
  const body = (f) => sql(f).split('\n').filter(l => !l.startsWith('--')).join('\n').trim();

  it('교안 sql 블록을 실제로 세었다 (0건이면 이 축이 침묵한 것이다)', () => {
    expect(blocks.length).toBe(14);
  });

  it('Step 5 첫 표가 01-first-table.sql 과 같다', () => {
    expect(blocks).toContain(body('01-first-table.sql'));
  });

  it('Step 6 규칙판이 02-with-rules.sql 과 같다', () => {
    expect(blocks).toContain(body('02-with-rules.sql'));
  });

  it('Step 8 완성판이 03-posts.sql 과 같다', () => {
    expect(blocks).toContain(body('03-posts.sql'));
  });

  it('Step 8 INSERT 가 04-insert.sql 과 같다', () => {
    expect(blocks).toContain(body('04-insert.sql'));
  });

  // 🚨 교안 «전부» 를 위에서 아래로 실제로 돌린다. 판정은 「몇 개가 막히나」다 —
  //    Step 7 이 일부러 막는 셋 말고 다른 것이 막히면 교안이 안 돌아가는 것이다.
  it('14블록을 교안 순서대로 돌리면 «정확히 셋» 만 막힌다', async () => {
    const c = new pg.Client(PG);
    await c.connect();
    try {
      await c.query('DROP TABLE IF EXISTS comments');
      await c.query('DROP TABLE IF EXISTS posts');
      await c.query('DROP TABLE IF EXISTS authors CASCADE');
      await c.query('DROP TABLE IF EXISTS reviews');
      await c.query('DROP TABLE IF EXISTS books');
      const failed = [];
      for (const [n, b] of blocks.entries()) {
        try { await c.query(b); }
        catch (e) { failed.push({ n: n + 1, code: e.code, head: b.split('\n')[0].slice(0, 40) }); }
      }
      // Step 7 의 넷 중 셋 — 모르는 칸 · 빈 칸 · 못 읽는 값
      expect(failed.map(f => f.n)).toEqual([5, 6, 7]);
      expect(failed.map(f => f.code)).toEqual(['42703', '23502', '22P02']);
      // 마지막 SELECT 가 게시물 셋을 돌려준다 — 교안 끝까지 살아 있다는 뜻
      const { rows } = await c.query('SELECT count(*)::int AS n FROM posts');
      expect(rows[0].n).toBe(3);
      await c.query('DROP TABLE IF EXISTS authors CASCADE');
      await c.query('DROP TABLE IF EXISTS reviews');
      await c.query('DROP TABLE IF EXISTS books');
    } finally { await c.end(); }
  }, 60000);
});

describe('조립 — Step 5→6→8 을 «교안 순서 그대로» 이어 돌린다', () => {
  it('학생이 위에서 아래로 따라가면 표가 세 번 다시 그려진다', async () => {
    const one = new pg.Client(PG);
    await one.connect();
    try {
      await one.query('DROP TABLE IF EXISTS comments');
      await one.query('DROP TABLE IF EXISTS posts');
      await one.query(sql('01-first-table.sql'));          // Step 5
      await one.query('DROP TABLE posts');                 // Step 6 이 지우라고 말한다
      await one.query(sql('02-with-rules.sql'));           // Step 6
      await one.query('DROP TABLE posts');                 // Step 8 이 지우라고 말한다
      await one.query(sql('03-posts.sql'));                // Step 8
      await one.query(sql('04-insert.sql'));
      const { rows } = await one.query('SELECT count(*)::int AS n FROM posts');
      expect(rows[0].n).toBe(3);
    } finally { await one.end(); }
  }, 30000);

  it('Step 6 판에도 Step 7 의 에러 셋이 그대로 난다', async () => {
    const two = new pg.Client(PG);
    await two.connect();
    try {
      await two.query('DROP TABLE IF EXISTS rulecheck');
      await two.query(sql('02-with-rules.sql').replace(/posts/g, 'rulecheck'));
      const grab = async (q) => { try { await two.query(q); return null; } catch (e) { return e.code; } };
      expect(await grab(`INSERT INTO rulecheck (username, post_image, mood) VALUES ('m','/i.jpg','happy')`)).toBe('42703');
      expect(await grab(`INSERT INTO rulecheck (username, post_image) VALUES ('m', NULL)`)).toBe('23502');
      expect(await grab(`INSERT INTO rulecheck (username, post_image, like_count) VALUES ('m','/i.jpg','많아요')`)).toBe('22P02');
      await two.query('DROP TABLE rulecheck');
    } finally { await two.end(); }
  }, 30000);
});

describe('Step 8 — 교안이 인용하는 DDL 이 postgres:18 에서 그대로 돈다', () => {
  it('학생이 붙는 포트가 곧 게이트가 붙는 포트다', async () => {
    // 🔑 «이름» 만 다르다 — 이 회차는 표를 통째로 DROP 하므로 수업 DB 를 쓰면 학생이
    //    쌓아온 것이 사라진다. 포트·계정·이미지는 학생이 붙는 그것과 같아야 한다.
    const { rows } = await db.query('SELECT current_user AS usr');
    expect(rows[0]).toEqual({ usr: 'postgres' });
    expect(PG.port).toBe(5432);

    const compose = readFileSync(new URL('../compose.yaml', import.meta.url), 'utf8');
    expect(compose, '학생이 띄우는 그 설정이 5432 를 연다').toContain('5432:5432');
    expect(compose, '학생이 붙는 DB 이름').toContain('POSTGRES_DB: instagram');
    expect(compose).toContain('POSTGRES_USER: postgres');
  });

  it('표 모양이 교안이 그려 보일 그것과 같다', async () => {
    const { rows } = await db.query(`
      SELECT column_name, data_type, character_maximum_length AS len,
             is_nullable, column_default
        FROM information_schema.columns
       WHERE table_name = 'posts' ORDER BY ordinal_position`);
    expect(rows.map(r => r.column_name)).toEqual([
      'id', 'username', 'profile_image', 'post_image', 'post_alt',
      'content', 'minutes_ago', 'like_count', 'comment_count',
    ]);
    const by = Object.fromEntries(rows.map(r => [r.column_name, r]));
    // SERIAL 은 «자료형» 이 아니라 integer + nextval 기본값이다 — 교안이 이걸 짚는다
    expect(by.id.data_type).toBe('integer');
    expect(by.id.column_default).toBe("nextval('posts_id_seq'::regclass)");
    expect(by.username.data_type).toBe('character varying');
    expect(by.username.len).toBe(50);
    expect(by.username.is_nullable).toBe('NO');
    expect(by.post_image.is_nullable).toBe('NO');
    expect(by.profile_image.is_nullable).toBe('YES');
    expect(by.like_count.column_default).toBe('0');
  });

  it('PRIMARY KEY 가 실제로 걸려 있다', async () => {
    const { rows } = await db.query(`
      SELECT c.conname, c.contype FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
       WHERE t.relname = 'posts' AND c.contype = 'p'`);
    expect(rows).toHaveLength(1);
    expect(rows[0].conname).toBe('posts_pkey');
  });

  it('넣은 게시물 셋이 그대로 있고 번호는 우리가 안 적었다', async () => {
    const { rows } = await db.query('SELECT id, username, like_count FROM posts ORDER BY id');
    expect(rows).toEqual([
      { id: 1, username: 'jaehoon',  like_count: 128 },
      { id: 2, username: 'minji',    like_count: 512 },
      { id: 3, username: 'seungwoo', like_count: 76 },
    ]);
  });

  it('DEFAULT 는 «칸을 안 적었을 때만» 채운다', async () => {
    await db.query(`INSERT INTO posts (username, post_image) VALUES ('nayeon', '/images/p4.jpg')`);
    const { rows } = await db.query(`SELECT minutes_ago, like_count, comment_count, content
                                       FROM posts WHERE username = 'nayeon'`);
    expect(rows[0]).toEqual({ minutes_ago: 0, like_count: 0, comment_count: 0, content: null });
  });
});

describe('Step 7 — 데이터베이스가 «직접» 막는 것 셋', () => {
  it('① 모르는 칸은 에러다 (몽고는 조용히 버렸다)', async () => {
    const e = await refused(`INSERT INTO posts (username, post_image, mood) VALUES ('minji','/i.jpg','happy')`);
    expect(e.code).toBe('42703');
    expect(e.message).toBe('column "mood" of relation "posts" does not exist');
  });

  it('② 필수 칸을 비우면 에러다', async () => {
    const e = await refused(`INSERT INTO posts (username, post_image) VALUES ('minji', NULL)`);
    expect(e.code).toBe('23502');
    expect(e.message).toBe('null value in column "post_image" of relation "posts" violates not-null constraint');
  });

  it('③ 숫자 칸에 말을 넣으면 에러다', async () => {
    const e = await refused(`INSERT INTO posts (username, post_image, like_count) VALUES ('minji','/i.jpg','많아요')`);
    expect(e.code).toBe('22P02');
    expect(e.message).toBe('invalid input syntax for type integer: "많아요"');
  });
});

describe('🚨 그런데 관계형도 다 막지는 않는다 — 교안이 단정하지 않게 잡아두는 축', () => {
  it('④ 글자 칸에 숫자를 넣으면 «통과»하고 글자로 바뀐다', async () => {
    const { rows } = await db.query(
      `INSERT INTO posts (username, post_image) VALUES (123, '/i.jpg') RETURNING username`);
    expect(rows[0].username).toBe('123');
    expect(typeof rows[0].username).toBe('string');
  });

  it('⑤ 숫자로 읽히는 말은 «통과»하고 숫자로 바뀐다 — Mongoose 와 같은 결과다', async () => {
    const { rows } = await db.query(
      `INSERT INTO posts (username, post_image, like_count) VALUES ('minji','/i.jpg','42') RETURNING like_count`);
    expect(rows[0].like_count).toBe(42);
  });

  // 🚨 초고가 「막힌 INSERT 는 번호를 쓴다」로 뭉뚱그렸다가 실행에 반증됐다.
  //    셋 중 «NOT NULL 하나만» 쓴다 — 나머지 둘은 줄을 만들기 «전에» 터진다.
  const seq = async () => Number((await db.query('SELECT last_value FROM posts_id_seq')).rows[0].last_value);

  it('타입 변환 실패는 번호를 «안» 쓴다', async () => {
    const before = await seq();
    await refused(`INSERT INTO posts (username, post_image, like_count) VALUES ('x','/i.jpg','많아요')`);
    expect(await seq()).toBe(before);
  });

  it('모르는 칸도 번호를 «안» 쓴다', async () => {
    const before = await seq();
    await refused(`INSERT INTO posts (username, post_image, mood) VALUES ('x','/i.jpg','happy')`);
    expect(await seq()).toBe(before);
  });

  it('NOT NULL 위반만 번호를 «쓴다» — 에러 본문이 그 번호를 직접 보여준다', async () => {
    const before = await seq();
    const e = await refused(`INSERT INTO posts (username, post_image) VALUES ('x', NULL)`);
    expect(await seq()).toBe(before + 1);
    // 줄이 이미 만들어졌다는 증거가 에러에 그대로 찍힌다
    expect(e.message).toContain('violates not-null constraint');
  });
});

describe('Step 7 — 교안이 «네 줄을 차례로» 넣었을 때의 번호를 잠근다', () => {
  it('살아남은 줄의 id 는 1 이 아니라 2 이고, 실패한 줄이 1 을 가져갔다', async () => {
    const c = new pg.Client(PG);
    await c.connect();
    try {
      await c.query('DROP TABLE IF EXISTS step7');
      await c.query(sql('02-with-rules.sql').replace(/posts/g, 'step7'));
      const errs = [];
      const put = async (q) => { try { await c.query(q); } catch (e) { errs.push(e); } };
      // 교안이 적은 «그 순서 그대로»
      await put(`INSERT INTO step7 (username, post_image, mood) VALUES ('minji','/images/p.jpg','happy')`);
      await put(`INSERT INTO step7 (username, post_image) VALUES ('minji', NULL)`);
      await put(`INSERT INTO step7 (username, post_image, like_count) VALUES ('minji','/images/p.jpg','많아요')`);
      await put(`INSERT INTO step7 (username, post_image) VALUES (123, '/images/p.jpg')`);

      expect(errs).toHaveLength(3);
      // 교안이 인용하는 DETAIL 한 줄 — 번호가 1 이다
      expect(errs[1].detail).toBe('Failing row contains (1, minji, null, null, 0).');

      const { rows } = await c.query('SELECT id, username FROM step7');
      expect(rows).toEqual([{ id: 2, username: '123' }]);
      await c.query('DROP TABLE step7');
    } finally { await c.end(); }
  }, 30000);
});

describe('답안 [응용] — 「규칙은 데이터가 들어오기 전에 걸어야 쉽다」를 실행으로', () => {
  it('규칙 없이 쌓은 표에는 PRIMARY KEY 를 나중에 못 건다', async () => {
    const c = new pg.Client(PG);
    await c.connect();
    try {
      await c.query('DROP TABLE IF EXISTS loose_books');
      await c.query('CREATE TABLE loose_books (id INTEGER, title VARCHAR(200), price INTEGER)');
      // 답안이 적은 다섯 줄 그대로
      await c.query(`INSERT INTO loose_books (id, title, price) VALUES (3,'클린 코드',33000)`);
      await c.query(`INSERT INTO loose_books (title, price) VALUES ('리팩터링',40000)`);
      await c.query(`INSERT INTO loose_books (id, title, price) VALUES (3,'또 3번',1000)`);
      await c.query(`INSERT INTO loose_books (id, price) VALUES (4,5000)`);
      await c.query(`INSERT INTO loose_books (price) VALUES (9000)`);

      const all = await c.query('SELECT count(*)::int AS n FROM loose_books');
      expect(all.rows[0].n).toBe(5);                       // 다섯 «전부» 들어간다
      const three = await c.query('SELECT count(*)::int AS n FROM loose_books WHERE id = 3');
      expect(three.rows[0].n).toBe(2);                     // 「3번 책」이 둘이다
      const empty = await c.query('SELECT count(*)::int AS n FROM loose_books WHERE id IS NULL');
      expect(empty.rows[0].n).toBe(2);                     // 가리킬 수 없는 줄이 둘

      let err = null;
      try { await c.query('ALTER TABLE loose_books ADD PRIMARY KEY (id)'); }
      catch (e) { err = e; }
      expect(err).not.toBeNull();
      expect(err.detail).toBe('Key (id)=(3) is duplicated.');
      await c.query('DROP TABLE loose_books');
    } finally { await c.end(); }
  }, 30000);
});

describe('오프닝 — 앱을 «안 거치면» 몽고에는 그대로 들어간다', () => {
  it('Mongoose 를 건너뛰면 규칙이 하나도 안 남는다', async () => {
    await mongoose.connect(LOCAL_MONGO_URL);
    const raw = mongoose.connection.db.collection('p226_opening');
    await raw.deleteMany({});
    await raw.insertOne({ username: 123, postImage: null, likeCount: '많아요', mood: 'happy' });
    const [doc] = await raw.find().toArray();
    expect(doc.username).toBe(123);       // 숫자 그대로
    expect(doc.postImage).toBeNull();     // 필수인데 비어 있다
    expect(doc.likeCount).toBe('많아요');  // 숫자 칸에 말이
    expect(doc.mood).toBe('happy');       // 스키마에 없는 칸까지
    await raw.deleteMany({});
    await mongoose.disconnect();
  }, 30000);
});
