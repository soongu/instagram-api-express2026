// p2-33 「글쓴이를 번호로 — ERD와 1:N, 그리고 onDelete」 게이트
//
// 🚨 진짜 instagram·bookstore DB 를 안 건드린다 — 전용 DB 를 p2-32 종료 상태로 세워서 쓴다.
// 🚨 이 회차의 판정 축은 둘이다.
//    ① «마이그레이션이 데이터를 살려 건너보내는가» — Prisma 가 써준 판은 거부당하고,
//       손으로 고친 판만 5줄·9줄을 온전히 옮긴다. 그 대조가 이 회차의 알맹이다.
//    ② «바깥에서 본 모습이 안 바뀌었는가» — 표가 둘에서 셋이 됐는데 응답은 평평한
//       username 을 그대로 싣는다. p2-31 이 리팩토링에 쓴 그 축을 저장 구조 변경에 쓴다.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import pg from 'pg';
import { boot } from './helpers/boot.js';
import { setupP233, setupP233Bookstore } from '../sql/p2-33/setup.mjs';

const ROOT = new URL('../', import.meta.url);
const P = (rel) => new URL(rel, ROOT).pathname;
const ADMIN = { host: 'localhost', port: 5432, database: 'postgres', user: 'postgres', password: 'postgres' };
const GATE_URL = 'postgresql://postgres:postgres@localhost:5432/p233_gate';
const SHADOW_URL = 'postgresql://postgres:postgres@localhost:5432/p233_shadow';
const BOOK_ADMIN = { ...ADMIN, port: 5433 };
const BOOK_GATE_URL = 'postgresql://postgres:postgres@localhost:5433/p233_book_gate';
const ENV = { DATABASE_URL: GATE_URL, BOOKSTORE_URL: BOOK_GATE_URL };
const JSON_HEADERS = { 'Content-Type': 'application/json' };

const LECTURE = P('../../part2/5-db-prisma/p2-33-relations-lecture.md');
const ANSWERS = P('../../part2/5-db-prisma/p2-33-relations-answers.md');
const read = (p) => readFileSync(p, 'utf8');
const exists = (p) => { try { readFileSync(p); return true; } catch { return false; } };
const blocksOf = (path, lang) =>
  [...read(path).matchAll(new RegExp('```' + lang + '\\n([\\s\\S]*?)```', 'g'))].map((m) => m[1].trimEnd());

let db = null;
let server = null;
/** 정규화 «전» 게시물·댓글의 두 시각 — 마이그레이션이 그것을 건드리나 보려고 담아둔다. */
let timesBefore = null;
/** 이 회차 시드의 stdout — 교안 bash 블록과 대조한다. */
let seedOut = '';

const prismaCli = (args, env = {}) =>
  execFileSync(P('node_modules/.bin/prisma'), args, {
    cwd: P('.'), encoding: 'utf8',
    env: { ...process.env, ...ENV, SHADOW_DATABASE_URL: SHADOW_URL, ...env },
  });

const migrationDir = (suffix) =>
  readdirSync(P('prisma/migrations')).find((d) => d.endsWith(suffix));

async function bootApp(file, port) {
  if (server) { await server.stop(); server = null; await new Promise((r) => setTimeout(r, 150)); }
  server = await boot(file, { port, env: { ...ENV, PORT: String(port) }, ready: `${port}번 포트에서` });
  return server;
}

/** 마이그레이션 SQL 을 주석만 걷어내 문장 단위로 돌린다. */
async function runSql(client, sql) {
  const failed = [];
  for (const raw of sql.split(/;\s*(?=\n|$)/)) {
    const stmt = raw.split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n').trim();
    if (!stmt) continue;
    try { await client.query(stmt); }
    catch (e) { failed.push({ head: stmt.split('\n')[0].slice(0, 60), code: e.code, msg: e.message }); break; }
  }
  return failed;
}

beforeAll(async () => {
  // 🚨 이 회차 «종료 시점» 클라이언트를 먼저 낸다 (gitignore 된 생성물이라 매번 만든다).
  //    output 이 회차 폴더라 수업 클라이언트를 안 덮는다 — p2-29·p2-33 이 겪은 그 사고.
  prismaCli(['generate', '--config', 'snapshots/p2-33-final/generate.config.js']);

  const admin = new pg.Client(ADMIN);
  await admin.connect();
  for (const name of ['p233_gate', 'p233_shadow']) {
    await admin.query(
      `select pg_terminate_backend(pid) from pg_stat_activity where datname = '${name}' and pid <> pg_backend_pid()`);
    await admin.query(`DROP DATABASE IF EXISTS ${name}`);
    await admin.query(`CREATE DATABASE ${name}`);
  }
  await admin.end();

  db = new pg.Client({ ...ADMIN, database: 'p233_gate' });
  await db.connect();
  await setupP233(db);
  // 🚨 p2-30 Step 6 이 시드를 Prisma 로 다시 써서 «실행»했다 — 그 뒤로 학생 표는 번호 1~5 ·
  //    시드 데이터(dahye 사진 있음 · 2번 본문 「오늘 아침에 구운 크루아상」)다. SQL 코퍼스만
  //    재생하면 p2-27 의 번호(1·2·3·6·7)와 값이 남아 교안이 학생 화면에 없는 출력을 싣는다
  //    (2026-09-18 낭독 retrofit 에서 발견 — 번호 6·7 · 「4 non-null」 · dahye 사진 없음).
  //    그래서 p2-30~32 게이트가 쓰는 그 시드를 그대로 한 번 돌린다(그 시점 클라이언트).
  //    🔀 2026-09-18 audit — 그 시드가 댓글 updated_at 까지 채워서 p2-30 클라이언트로 바꿨다.
  prismaCli(['generate', '--config', 'snapshots/p2-30/generate.config.js']);
  execFileSync(process.execPath, [P('snapshots/p2-32-final/seed.js')],
    { cwd: P('.'), encoding: 'utf8', env: { ...process.env, ...ENV } });

  const bookAdmin = new pg.Client(BOOK_ADMIN);
  await bookAdmin.connect();
  await bookAdmin.query(
    "select pg_terminate_backend(pid) from pg_stat_activity where datname = 'p233_book_gate' and pid <> pg_backend_pid()");
  await bookAdmin.query('DROP DATABASE IF EXISTS p233_book_gate');
  await bookAdmin.query('CREATE DATABASE p233_book_gate');
  await bookAdmin.end();
  const book = new pg.Client({ ...BOOK_ADMIN, database: 'p233_book_gate' });
  await book.connect();
  await setupP233Bookstore(book);
  await book.end();
}, 120000);

afterAll(async () => {
  await server?.stop();
  await db?.end();
  const admin = new pg.Client(ADMIN);
  await admin.connect();
  for (const name of ['p233_gate', 'p233_shadow']) {
    await admin.query(
      `select pg_terminate_backend(pid) from pg_stat_activity where datname = '${name}' and pid <> pg_backend_pid()`);
    await admin.query(`DROP DATABASE IF EXISTS ${name}`);
  }
  await admin.end();
  const bookAdmin = new pg.Client(BOOK_ADMIN);
  await bookAdmin.connect();
  await bookAdmin.query(
    "select pg_terminate_backend(pid) from pg_stat_activity where datname = 'p233_book_gate' and pid <> pg_backend_pid()");
  await bookAdmin.query('DROP DATABASE IF EXISTS p233_book_gate');
  await bookAdmin.end();
});

// ── Step 1·2 — 착수 상태와 중복 실측 ────────────────────────────────────────

describe('Step 1·2 — 지금 표 둘과 그 안의 중복', () => {
  it('p2-32 를 끝낸 학생의 표 둘이 그대로 서 있다', async () => {
    const r = await db.query(
      'select (select count(*)::int from posts) p, (select count(*)::int from comments) c');
    expect(r.rows[0]).toEqual({ p: 5, c: 9 });
  });

  it('🚨 번호는 1~5 이고 사진은 다섯 줄 모두에 있다 — p2-30 시드 뒤의 판', async () => {
    const r = await db.query(
      'select id, username, profile_image is not null has_photo from posts order by id');
    expect(r.rows.map((x) => x.id)).toEqual([1, 2, 3, 4, 5]);
    expect(r.rows.every((x) => x.has_photo), 'dahye 도 사진이 있다').toBe(true);
  });

  it('🔴 사람은 5명인데 이름이 적힌 곳은 14군데다', async () => {
    const r = await db.query(`
      select (select count(*) from (select username from posts union select username from comments) x)::int people,
             ((select count(*) from posts) + (select count(*) from comments))::int spots`);
    expect(r.rows[0]).toEqual({ people: 5, spots: 14 });
    expect(read(LECTURE)).toContain('14군데');
  });

  it('🚨 nayeon 은 댓글에만 있다 — posts 만 보면 네 명이다', async () => {
    const only = await db.query('select count(distinct username)::int n from posts');
    expect(only.rows[0].n).toBe(4);
    const extra = await db.query('select username from comments except select username from posts');
    expect(extra.rows.map((x) => x.username)).toEqual(['nayeon']);
  });

  it('minji 의 프로필 사진이 게시물 두 줄에 같은 주소로 들어 있다', async () => {
    const r = await db.query(
      `select count(*)::int n, count(distinct profile_image)::int d from posts where username = 'minji'`);
    expect(r.rows[0]).toEqual({ n: 2, d: 1 });
  });

  // 🚨 이 둘은 교안이 4칸 표의 «출처» 로 새로 실은 블록이다(2026-09-11 정독 반영).
  //    어느 축도 안 보던 자리라 실행으로 잠근다 — 표의 게시물·댓글 칸이 여기서 나온다.
  it('교안이 실은 표별 세기 SQL 두 줄이 실제로 돌고, 표의 칸과 같다', async () => {
    const fence = read(LECTURE).split('```')
      .find((b) => b.includes('적힌 곳') && b.includes('nayeon'));
    const sqls = blocksOf(LECTURE, 'sql')
      .filter((b) => /^SELECT username, COUNT\(\*\) AS (게시물|댓글)/.test(b.trim()));
    expect(sqls.length, '표별 세기 블록').toBe(1);

    for (const stmt of sqls[0].trim().split(';').map((x) => x.trim()).filter(Boolean)) {
      const col = stmt.includes('AS 게시물') ? 1 : 2;
      const r = await db.query(stmt);
      expect(r.rows.length, stmt.slice(0, 40)).toBeGreaterThan(0);
      for (const row of r.rows) {
        const line = fence.split('\n').find((l) => l.trim().startsWith(row.username));
        expect(line, row.username).toBeTruthy();
        const nums = line.trim().split(/\s+/).slice(1).map(Number);
        expect(nums[col - 1], `${row.username} / ${col === 1 ? '게시물' : '댓글'}`)
          .toBe(Number(row[col === 1 ? '게시물' : '댓글']));
      }
    }
  });

  // 🔀 2026-09-18~ audit retrofit — minutes_ago 칸은 관계형 DB 에 한 번도 생기지 않는다.
  //    p2-26 이 created_at 으로 시작하고 p2-29 가 updated_at 을 더했다.
  it('🔴 minutes_ago 칸은 두 표 어디에도 없고, audit 칸 넷이 서 있다', async () => {
    const r = await db.query(`
      select table_name, column_name from information_schema.columns
      where table_name in ('posts','comments') and column_name in ('minutes_ago','created_at','updated_at')
      order by table_name, column_name`);
    expect(r.rows).toEqual([
      { table_name: 'comments', column_name: 'created_at' },
      { table_name: 'comments', column_name: 'updated_at' },
      { table_name: 'posts', column_name: 'created_at' },
      { table_name: 'posts', column_name: 'updated_at' },
    ]);
    // 🚨 교안에 남은 `minutesAgo` 는 시드의 «다리» 뿐이다 — data/*.js 는 분을 적어두고
    //    withTimes 가 그것을 시각으로 바꿔 넣는다(캐논: 그 다리는 유지한다).
    //    표의 칸 이름 `minutes_ago` 는 한 건도 없어야 한다.
    expect(read(LECTURE), '교안에 칸 이름 minutes_ago 가 남으면 안 된다').not.toContain('minutes_ago');
  });

  it('🚨 한 번도 안 고친 줄이라 두 시각이 같다 — 시드가 withTimes 로 넣은 판', async () => {
    const p = await db.query('select id, created_at, updated_at from posts order by id');
    const c = await db.query('select id, created_at, updated_at from comments order by id');
    expect(p.rows).toHaveLength(5);
    expect(c.rows).toHaveLength(9);
    for (const row of [...p.rows, ...c.rows]) {
      expect(row.updated_at.getTime(), `${row.id}번의 두 시각`).toBe(row.created_at.getTime());
    }
    // 🚨 시각이 줄마다 달라야 p2-30 이 세운 정렬 축이 산다(같으면 최신순이 동점이다).
    expect(new Set(p.rows.map((r) => r.created_at.getTime())).size, '게시물 5개의 시각이 서로 다르다').toBe(5);
    timesBefore = Object.fromEntries(p.rows.map((r) => [r.id, [r.created_at.getTime(), r.updated_at.getTime()]]));
  });

  it('교안이 인용한 누가-몇-번 표가 실측과 같다', async () => {
    const r = await db.query(`
      select u.username,
             (select count(*) from posts    p where p.username = u.username)::int post_n,
             (select count(*) from comments c where c.username = u.username)::int comment_n
      from (select username from posts union select username from comments) u
      order by 2 desc, 3 desc, 1`);   // 🚨 출력 별칭은 «식 안에서» 못 쓴다(Postgres)
    const fence = read(LECTURE).split('```')
      .find((b) => b.includes('적힌 곳') && b.includes('nayeon'));
    expect(fence, '누가 몇 번 적혀 있나 표').toBeTruthy();
    for (const row of r.rows) {
      const line = fence.split('\n').find((l) => l.trim().startsWith(row.username));
      expect(line, row.username).toBeTruthy();
      const nums = line.trim().split(/\s+/).slice(1).map(Number);
      expect(nums, row.username).toEqual([row.post_n, row.comment_n, row.post_n + row.comment_n]);
    }
  });
});

// ── Step 5 — 써준 판은 못 돌고, 손으로 고친 판만 데이터를 살린다 ────────────

describe('Step 5 — 마이그레이션 둘의 대조', () => {
  it('🔴 Prisma 가 써주는 판은 이 표에서 «돌지 않는다» — 23502 로 막힌다', async () => {
    // 스키마 두 판의 차이를 Prisma 에게 그대로 받아 돌려본다.
    const auto = prismaCli(['migrate', 'diff',
      '--from-schema', 'snapshots/p2-33/schema-before.prisma',
      '--to-schema', 'snapshots/p2-33/schema-after-normalize.prisma', '--script'])
      .replace(/^Loaded Prisma config.*\n\n?/, '');
    expect(auto).toContain('ADD COLUMN     "author_id" INTEGER NOT NULL');

    const probe = new pg.Client({ ...ADMIN, database: 'p233_gate' });
    await probe.connect();
    await probe.query('BEGIN');
    const failed = await runSql(probe, auto);
    await probe.query('ROLLBACK');
    await probe.end();

    expect(failed).toHaveLength(1);
    expect(failed[0].code).toBe('23502');                       // not_null_violation
    expect(failed[0].msg).toContain('author_id');
  });

  it('✅ 손으로 고친 판은 게시물 5줄·댓글 9줄을 «하나도 안 잃는다»', async () => {
    const dir = migrationDir('_normalize_author');
    expect(dir).toBeTruthy();
    const failed = await runSql(db, read(P(`prisma/migrations/${dir}/migration.sql`)));
    expect(failed).toEqual([]);

    const r = await db.query(
      'select (select count(*)::int from posts) p, (select count(*)::int from comments) c, (select count(*)::int from users) u');
    expect(r.rows[0]).toEqual({ p: 5, c: 9, u: 5 });
  });

  // 🔴 이 회차의 audit 축 — 교안 Step 8 이 「두 시각이 서로 같다」고 싣는 근거다.
  //    @updatedAt 은 Prisma 클라이언트가 채우는 규칙이라, 마이그레이션의 raw SQL UPDATE
  //    (author_id 를 채우는 그 줄)로는 안 바뀐다. DB 의 DEFAULT 는 INSERT 때만 동작한다.
  //    2026-09-21 실측 — 정규화 전후로 게시물 5줄의 두 시각이 밀리초까지 그대로였다.
  it('🔴 글쓴이를 옮긴 UPDATE 가 updated_at 을 «안» 건드린다', async () => {
    expect(timesBefore, '정규화 전 시각을 담아뒀다').toBeTruthy();
    const migration = read(P(`prisma/migrations/${migrationDir('_normalize_author')}/migration.sql`));
    expect(migration, 'author_id 를 채우는 UPDATE 가 실제로 있다').toContain('SET "author_id" = u."id"');

    const r = await db.query('select id, created_at, updated_at from posts order by id');
    for (const row of r.rows) {
      expect([row.created_at.getTime(), row.updated_at.getTime()], `${row.id}번`).toEqual(timesBefore[row.id]);
    }
  });

  it('글쓴이가 번호로 이어져 이름이 그대로 따라온다', async () => {
    const r = await db.query(
      'select p.id, u.username from posts p join users u on u.id = p.author_id order by p.id');
    expect(r.rows).toEqual([
      { id: 1, username: 'jaehoon' }, { id: 2, username: 'minji' }, { id: 3, username: 'seungwoo' },
      { id: 4, username: 'minji' }, { id: 5, username: 'dahye' },
    ]);
  });

  it('교안 Step 6 의 JOIN 표가 실측과 같다', async () => {
    const r = await db.query(
      'SELECT p.id, u.username, p.post_alt FROM posts p JOIN users u ON u.id = p.author_id ORDER BY p.id');
    const fence = read(LECTURE).split('```').find((b) => b.includes('post_alt') && b.includes('새 렌즈'));
    expect(fence, 'JOIN 결과 표').toBeTruthy();
    const rows = fence.trim().split('\n').slice(1).map((l) => l.trim().split(/\s{2,}/));
    expect(rows).toEqual(r.rows.map((x) => [String(x.id), x.username, x.post_alt]));
  });

  it('users 의 번호가 아이디 순이고 사진이 옮겨졌다 — 교안 표와 같다', async () => {
    const r = await db.query('select id, username, profile_image from users order by id');
    expect(r.rows).toEqual([
      { id: 1, username: 'dahye', profile_image: '/images/dahye.jpg' },
      { id: 2, username: 'jaehoon', profile_image: '/images/jaehoon.jpg' },
      { id: 3, username: 'minji', profile_image: '/images/minji.jpg' },
      { id: 4, username: 'nayeon', profile_image: null },
      { id: 5, username: 'seungwoo', profile_image: '/images/seungwoo.jpg' },
    ]);
  });

  it('🚨 옛 칸은 정말로 사라졌다 — username·profile_image 가 0개', async () => {
    const r = await db.query(`
      select column_name from information_schema.columns
      where table_name in ('posts','comments') and column_name in ('username','profile_image')`);
    expect(r.rows).toEqual([]);
  });
});

// ── Step 7 — onDelete 는 규칙만 바꾼다 ──────────────────────────────────────

describe('Step 7 — onDelete', () => {
  it('정규화 직후 FK 는 RESTRICT 이고 댓글 쪽은 NO ACTION 이다', async () => {
    const r = await db.query(`
      select con.conname, con.confdeltype from pg_constraint con where con.contype = 'f'
      order by con.conname`);
    const by = Object.fromEntries(r.rows.map((x) => [x.conname, x.confdeltype]));
    expect(by.posts_author_id_fkey).toBe('r');        // RESTRICT — Prisma 기본값
    expect(by.comments_author_id_fkey).toBe('r');
    expect(by.comments_post_id_fkey).toBe('a');       // NO ACTION — p2-29 가 손으로 쓴 판
  });

  it('🔴 그 상태에서 댓글 달린 게시물을 지우면 23503 으로 막힌다', async () => {
    await db.query('BEGIN');
    const failed = await runSql(db, 'DELETE FROM posts WHERE id = 1');
    await db.query('ROLLBACK');
    expect(failed).toHaveLength(1);
    expect(failed[0].code).toBe('23503');
    expect(failed[0].msg).toContain('comments_post_id_fkey');
  });

  it('✅ cascade 마이그레이션은 «두 줄» 이고 데이터를 안 건드린다', async () => {
    const dir = migrationDir('_cascade_comments');
    expect(dir).toBeTruthy();
    const sql = read(P(`prisma/migrations/${dir}/migration.sql`));
    expect(sql).toContain('DROP CONSTRAINT "comments_post_id_fkey"');
    expect(sql).toContain('ON DELETE CASCADE');
    expect(sql).not.toMatch(/INSERT INTO|UPDATE "/);     // 값을 옮기는 줄이 없다

    const before = await db.query('select count(*)::int n from comments');
    expect(await runSql(db, sql)).toEqual([]);
    const after = await db.query('select count(*)::int n from comments');
    expect(after.rows[0].n).toBe(before.rows[0].n);
  });

  it('과제 [응용] 의 칸도 한 줄짜리 마이그레이션으로 붙는다', async () => {
    const dir = migrationDir('_add_user_deactivated_at');
    expect(dir).toBeTruthy();
    const sql = read(P(`prisma/migrations/${dir}/migration.sql`));
    expect(sql.trim().split('\n').filter((l) => l.trim() && !l.startsWith('--'))).toHaveLength(1);
    expect(sql).toContain('ADD COLUMN     "deactivated_at" TIMESTAMP(3)');
    expect(sql, '널을 허용하니 손댈 게 없다').not.toContain('NOT NULL');
    expect(await runSql(db, sql)).toEqual([]);
  });

  it('✅ 이제 게시물을 지우면 딸린 댓글이 함께 사라진다 — 3 → 0', async () => {
    const before = await db.query('select count(*)::int n from comments where post_id = 1');
    expect(before.rows[0].n).toBe(3);
    await db.query('DELETE FROM posts WHERE id = 1');
    const after = await db.query('select count(*)::int n from comments where post_id = 1');
    expect(after.rows[0].n).toBe(0);
    // 다음 축을 위해 되돌린다 — 이 회차 시드가 다시 채운다.
  });
});

// ── Step 6·8 — 바깥에서 본 모습이 안 바뀌었는가 ────────────────────────────

describe('Step 6·8 — 계약은 그대로, P2003 에는 이름이 붙는다', () => {
  beforeAll(() => {
    // 🚨 얼린 시드다 — live seed.js 는 p2-34 가 사진·좋아요·답글까지 넣게 키우므로
    //    이 회차 게이트 DB(그 표들이 없는 판)에서는 안 돈다.
    seedOut = execFileSync(process.execPath, [P('snapshots/p2-33-final/seed.js')], { cwd: P('.'), encoding: 'utf8', env: { ...process.env, ...ENV } });
  }, 30000);

  it('시드가 사람 5명·게시물 5개·댓글 9개를 넣는다', async () => {
    const r = await db.query(
      'select (select count(*)::int from users) u, (select count(*)::int from posts) p, (select count(*)::int from comments) c');
    expect(r.rows[0]).toEqual({ u: 5, p: 5, c: 9 });
  });

  // 🚨 replay 가 이 짝을 못 본다 — 시드는 루트 파일이라 `./db.js` 를 부르는데
  //    그 게이트는 블록을 `__replay__/` 에 놓아 형제 파일이 안 풀린다(ERR_MODULE_NOT_FOUND).
  //    교안이 싣는 그 한 줄은 여기서 실행으로 잠근다.
  it('🔴 교안이 싣는 시드 출력 한 줄이 실제 출력과 같다', () => {
    const shown = blocksOf(LECTURE, 'bash').find((b) => b.includes('넣었어요.'));
    expect(shown, '시드 출력 bash 블록').toBeTruthy();
    expect(seedOut.trim()).toBe(shown.trim());
  });

  // 🔀 2026-09-21 audit — 시드가 withTimes 로 두 시각을 «같은 값» 으로 넣는다.
  //    게시물·댓글 전부이고, 줄마다 시각이 달라야 최신순 정렬이 동점이 안 된다.
  it('🔴 시드가 넣은 두 시각이 줄마다 같고, 줄 사이에서는 서로 다르다', async () => {
    const p = await db.query('select id, created_at, updated_at from posts order by id');
    const c = await db.query('select id, created_at, updated_at from comments order by id');
    for (const row of [...p.rows, ...c.rows]) {
      expect(row.updated_at.getTime(), `${row.id}번의 두 시각`).toBe(row.created_at.getTime());
    }
    expect(new Set(p.rows.map((r) => r.created_at.getTime())).size).toBe(5);
    const r = await db.query(
      "select count(*)::int n from information_schema.columns where table_name in ('posts','comments') and column_name = 'minutes_ago'");
    expect(r.rows[0].n, '정규화 뒤에도 minutes_ago 칸은 없다').toBe(0);
  });

  it('🔴 목록 응답이 «평평한» username·profileImage 를 싣는다 — author 객체가 아니다', async () => {
    // 🚨 얼린 앱이다 — live app.js 는 p2-34 가 사진을 표로 빼서 이 게이트 DB 에선 안 돈다.
    await bootApp('snapshots/p2-33-final/app.js', 3700);
    const list = await (await fetch(`${server.base}/api/posts`)).json();
    expect(list).toHaveLength(5);
    for (const post of list) {
      expect(typeof post.username, 'username').toBe('string');
      expect(post, 'author 가 그대로 나가면 계약이 깨진다').not.toHaveProperty('author');
      expect(post).toHaveProperty('profileImage');
    }
  });

  it('관계를 거치는 조건도 지난 시간과 같게 동작한다 — ?username=minji 가 둘', async () => {
    const two = await (await fetch(`${server.base}/api/posts?username=minji`)).json();
    expect(two).toHaveLength(2);
    expect(two.every((p) => p.username === 'minji')).toBe(true);
    const all = await (await fetch(`${server.base}/api/posts`)).json();
    expect(all, '조건을 안 보내면 전부').toHaveLength(5);
  });

  it('🔴 없는 사람 번호로 만들면 P2003 이 400 «그런 사용자는 없어요» 가 된다', async () => {
    const res = await fetch(`${server.base}/api/posts`, {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ authorId: 999, postImage: '/x.jpg' }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ message: '그런 사용자는 없어요' });
  });

  it('정상 생성은 201 이고 응답도 평평하다', async () => {
    const res = await fetch(`${server.base}/api/posts`, {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ authorId: 3, postImage: '/images/new.jpg', postAlt: '새 사진' }),
    });
    expect(res.status).toBe(201);
    const made = await res.json();
    expect(made.authorId).toBe(3);
    expect(made.username).toBe('minji');
    expect(made).not.toHaveProperty('author');
    await fetch(`${server.base}/api/posts/${made.id}`, { method: 'DELETE' });
  });

  it('지난 시간이 세운 404·400 이 그대로 남아 있다', async () => {
    expect((await fetch(`${server.base}/api/posts/9999`)).status).toBe(404);
    expect((await fetch(`${server.base}/api/posts/abc`)).status).toBe(404);
    const bad = await fetch(`${server.base}/api/posts`, {
      method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ postImage: '/x.jpg' }),
    });
    expect(bad.status, 'authorId 를 안 보내면 Zod 400').toBe(400);
  });

  it('🔴 Step 6 판은 include 없이도 400 을 낸다 — 그 시점에 실제로 돈다', async () => {
    // 🚨 교안 Step 6 은 withAuthor 가 «아직 없는» 판을 싣는다. 최종본을 미리 실으면
    //    학생 파일이 ReferenceError 로 죽는다(선언 전 사용). 그 중간 판을 띄워 잠근다.
    mkdirSync(P('__replay__'), { recursive: true });
    writeFileSync(P('__replay__/p233-step6-service.js'),
      // 🚨 얼린 클라이언트로 돌린다 — live db.js 의 클라이언트는 p2-34 스키마를 알아서
      //    이 회차의 postImage 를 「모르는 인자」로 거부한다.
      read(P('snapshots/p2-33/step6.postService.js'))
        .replaceAll("from '../db.js'", "from '../snapshots/p2-33-final/db.js'")
        .replaceAll("from '../errors.js'", "from '../snapshots/p2-33-final/errors.js'"));
    const probe = P('__replay__/p233-step6.mjs');
    writeFileSync(probe, `
import * as svc from './p233-step6-service.js';
try { await svc.createPost({ authorId: 999, postImage: '/x.jpg' }); console.log('CREATED'); }
catch (e) { console.log(e.status, e.message); }
const list = await svc.getPosts({});
console.log('list', list.length, 'username' in list[0]);
// Step 8 첫 「게시물 목록」 — Step 7 이 1번을 지운 뒤 맨 앞 게시물
console.log('FIRST ' + JSON.stringify(list.filter((p) => p.id !== 1)[0]));
const { prisma } = await import('../snapshots/p2-33-final/db.js');
await prisma.$disconnect();`);
    const out = execFileSync(process.execPath, [probe], { cwd: P('.'), encoding: 'utf8', env: { ...process.env, ...ENV } });
    expect(out).toContain('400 그런 사용자는 없어요');
    expect(out, 'Step 6 시점에는 username 이 아직 안 실린다').toContain('list 5 false');
    // 🚨 Step 8 이 싣는 맨 앞 게시물 — 시드 데이터(2번 본문·댓글 4)라야 학생 화면과 같다.
    //    🔀 2026-09-21 audit — 고르는 열쇠였던 minutesAgo 가 사라져서 commentCount 로 바꿨다.
    const first = JSON.parse(out.split('\n').find((l) => l.startsWith('FIRST ')).slice('FIRST '.length));
    const shown = blocksOf(LECTURE, 'json').find((b) => b.includes('"authorId": 3') && b.includes('"commentCount": 4'));
    expect(shown, 'Step 8 의 맨 앞 게시물 json').toBeTruthy();
    // 두 시각은 «시드를 실행한 순간» 이라 값은 못 잠근다 — 칸이 있는지와 서로 같은지만 본다.
    const { createdAt: _a, updatedAt: _b, ...want } = first;
    const shownObj = JSON.parse(shown);
    const { createdAt, updatedAt, ...got } = shownObj;
    expect(got).toEqual(want);
    expect(typeof createdAt, 'createdAt 이 실려 있다').toBe('string');
    expect(updatedAt, '한 번도 안 고친 게시물이라 두 시각이 같다').toBe(createdAt);
    expect(new Date(createdAt).toISOString(), 'Z 가 붙은 ISO 시각이다').toBe(createdAt);
    expect(Object.keys(shownObj), '칸 순서도 응답과 같다').toEqual(Object.keys(first));
  });

  // 🔴 과제 [응용] — 답안이 싣는 다섯 줄을 실제로 돌려 본다.
  //    replay 는 이 블록에 닿지 못한다(`../db.js` 가 라이브 클라이언트라 이 회차 DB 에서 안 돈다 ·
  //    DATABASE_URL 도 안 준다). 그래서 이 회차 클라이언트로 갈아 끼워 여기서 돌린다.
  //    🚨 시각 한 줄은 실행할 때마다 달라지니 «모양» 으로만 잠근다.
  it('🔴 과제 [응용] homework2 가 답안이 싣는 다섯 줄을 낸다', async () => {
    mkdirSync(P('__replay__'), { recursive: true });
    const probe = P('__replay__/p233-homework2.js');
    writeFileSync(probe, read(P('lab/p2-33/homework2.js'))
      .replace("from '../db.js'", "from '../snapshots/p2-33-final/db.js'"));
    const out = execFileSync(process.execPath, [probe],
      { cwd: P('.'), encoding: 'utf8', env: { ...process.env, ...ENV } }).trim().split('\n');

    const shown = blocksOf(ANSWERS, 'bash').find((b) => b.includes('탈퇴 처리'));
    expect(shown, '과제 [응용] 출력 블록').toBeTruthy();
    const want = shown.trim().split('\n');
    expect(out).toHaveLength(want.length);
    // 첫 줄은 「minji 탈퇴 처리 — <ISO 시각>」 — 시각만 다르고 나머지는 글자까지 같다.
    expect(out[0]).toMatch(/^minji 탈퇴 처리 — \d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
    expect(want[0]).toMatch(/^minji 탈퇴 처리 — \d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
    expect(out.slice(1), '나머지 네 줄은 축자로 같다').toEqual(want.slice(1));

    // 🚨 되돌리는 줄까지 돌았는지 — 다음 축이 이 DB 를 이어 쓴다.
    const r = await db.query("select deactivated_at from users where username = 'minji'");
    expect(r.rows[0].deactivated_at, '끝에 다시 비웠다').toBeNull();
  });

  it('🚨 글쓴이를 지우는 것은 RESTRICT 가 막고, 그것도 P2003 이다', async () => {
    mkdirSync(P('__replay__'), { recursive: true });
    const probe = P('__replay__/p233-restrict.mjs');
    writeFileSync(probe, `
import { prisma } from '../db.js';
try { await prisma.user.delete({ where: { username: 'minji' } }); console.log('DELETED'); }
catch (e) { console.log(e.code); }
await prisma.$disconnect();`);
    const out = execFileSync(process.execPath, [probe], { cwd: P('.'), encoding: 'utf8', env: { ...process.env, ...ENV } });
    expect(out.trim()).toBe('P2003');
  });
});

// ── 직접 해보기 — 서점 ──────────────────────────────────────────────────────

describe('직접 해보기 — 서점', () => {
  it('실습 1 — 리뷰어가 6줄에 다섯 사람이고, books 에 저자가 두 가지로 적혀 있다', async () => {
    const book = new pg.Client({ ...BOOK_ADMIN, database: 'p233_book_gate' });
    await book.connect();
    const r = await book.query(
      'select count(*)::int spots, count(distinct reviewer)::int people from reviews');
    expect(r.rows[0]).toEqual({ spots: 6, people: 5 });

    const cols = await book.query(`
      select column_name from information_schema.columns
      where table_name = 'books' and column_name in ('author','author_id') order by column_name`);
    expect(cols.rows.map((x) => x.column_name)).toEqual(['author', 'author_id']);

    // 교안 해설의 books 표가 실측과 같은가
    const rows = await book.query('select id, title, author, author_id from books order by id');
    const fence = read(LECTURE).split('```').find((b) => b.includes('author_id') && b.includes('클린 아키텍처'));
    expect(fence, 'books 표').toBeTruthy();
    for (const row of rows.rows) {
      const line = fence.split('\n').find((l) => l.includes(row.title));
      expect(line, row.title).toBeTruthy();
      expect(line, row.title).toContain(row.author);
      expect(line.trim().split(/\s+/).at(-1), `${row.title} author_id`).toBe(String(row.author_id));
    }
    await book.end();
  });

  it('실습 2 — 글자 칸을 떼는 마이그레이션은 「못 한다」가 아니라 「값을 잃는다」뿐이다', () => {
    const diff = prismaCli(['migrate', 'diff',
      '--from-schema', 'snapshots/p2-33/lab-schema-before.prisma',
      '--to-schema', 'lab/p2-33/schema.prisma', '--script'])
      .replace(/^Loaded Prisma config.*\n\n?/, '');
    expect(diff).toContain('DROP COLUMN "author"');
    // 🔑 NOT NULL 칸을 더하지 않으니 세 단계가 필요 없다 — 그게 이 실습의 답이다.
    expect(diff).not.toContain('NOT NULL');
    // 관계 이름만 바꾼 것은 DB 에 한 줄도 안 남는다.
    expect(diff).not.toMatch(/authorRef/);
  });

  it('실습 3 — 저자 이름을 평평하게 펴서 여섯 권이 찍힌다', async () => {
    const book = new pg.Client({ ...BOOK_ADMIN, database: 'p233_book_gate' });
    await book.connect();
    await book.query('ALTER TABLE books DROP COLUMN IF EXISTS author');   // 실습 2 의 결과
    await book.end();

    // 🚨 이 회차 전용 클라이언트로 돌린다. 학생 파일은 `../generated` 를 부르는데
    //    그것은 p2-29~32 서점 실습이 함께 쓰는 판이라, 이 회차 스키마로 덮으면
    //    그 회차들의 직접 해보기가 통째로 깨진다(실제로 4건이 깨져서 찾았다).
    prismaCli(['generate', '--config', 'lab/p2-33/prisma.config.js']);
    mkdirSync(P('__replay__'), { recursive: true });
    for (const f of ['bookstore.js', 'practice1.js']) {
      const src = read(P(`lab/p2-33/${f}`))
        .replace("'../generated/index.js'", "'../lab/generated-p2-33/index.js'")
        .replace("'./bookstore.js'", "'./p233-bookstore.js'");
      writeFileSync(P(`__replay__/p233-${f}`), src);
    }
    expect(read(P('__replay__/p233-bookstore.js')), '바꿔치기 실패를 조용히 넘기지 않게')
      .toContain('generated-p2-33');
    const out = execFileSync(process.execPath, [P('__replay__/p233-practice1.js')], {
      cwd: P('.'), encoding: 'utf8', env: { ...process.env, ...ENV },
    });
    const lines = out.trim().split('\n');
    expect(lines).toHaveLength(6);
    expect(lines[0]).toContain("title: '클린 코드'");
    expect(lines[0]).toContain("author: '로버트 마틴'");
    expect(lines[0]).toContain('price: 33000');
    expect(lines[1]).toContain('price: 55000');          // 🚨 초고가 43000 으로 지어냈던 자리
    for (const l of lines) expect(l, '중첩이 남으면 안 된다').not.toMatch(/author: \{/);
  });
});

// ── 교안 ↔ 코드베이스 — 인용한 것이 실재한다 ───────────────────────────────

describe('교안 ↔ 코드베이스', () => {
  // 🚨 live 가 아니라 «이 회차 종료 시점» 스냅숏을 본다 (2026-09-11 `p2-34` 착수 시 얼림).
  //    다음 회차가 postService·seed·schema 를 계속 키우므로 live 를 보면 이 회차 인용이
  //    전건 「불일치」로 뜨고, 그러면 사람이 멀쩡한 교안을 고치게 된다.
  const jsSources = () => [
    'snapshots/p2-33-final/services/postService.js', 'snapshots/p2-33-final/schemas/postSchema.js',
    'snapshots/p2-33-final/seed.js', 'snapshots/p2-33-final/db.js', 'snapshots/p2-33-final/errors.js',
    'snapshots/p2-33-final/routes/posts.js', 'snapshots/p2-33-final/app.js',
    'snapshots/p2-33-final/middlewares/validate.js',
    'snapshots/p2-33/step6.postService.js',
    'lab/p2-33/practice1.js', 'lab/p2-33/commentService.js', 'lab/p2-33/commentSchema.js',
    'lab/p2-33/commentRoutes.js', 'lab/p2-33/homework2.js', 'lab/p2-33/bookstore.js',
  ].map((f) => read(P(f)));

  const sqlSources = () =>
    readdirSync(P('prisma/migrations')).filter((d) => !d.endsWith('.toml'))
      .map((d) => read(P(`prisma/migrations/${d}/migration.sql`)))
      .concat(readdirSync(P('lab/p2-33/migrations')).filter((d) => !d.endsWith('.toml'))
        .map((d) => read(P(`lab/p2-33/migrations/${d}/migration.sql`))));

  const prismaSources = () => [
    'snapshots/p2-33-final/prisma/schema.prisma', 'snapshots/p2-33/schema-after-normalize.prisma',
    // 직접 해보기 2 가 보여주는 「지금 모습」 — p2-29 과제까지 끝낸 서점 스키마
    'snapshots/p2-33/lab-schema-before.prisma', 'lab/p2-33/schema.prisma',
  ].map((f) => read(P(f)));

  /** 주석·빈 줄을 걷어낸 덩어리 — 교안은 발췌를 설명 주석과 함께 싣는다. */
  const chunks = (block) =>
    block.split(/\n\s*\n/).map((c) => c.split('\n').filter((l) => !l.trimStart().startsWith('//')).join('\n').trim())
      .filter(Boolean);

  it('🔴 교안의 ```prisma 블록이 전부 코드베이스 스키마 안에 실재한다', () => {
    const srcs = prismaSources();
    const missing = blocksOf(LECTURE, 'prisma').filter((b) => !srcs.some((s) => s.includes(b)));
    expect(missing).toEqual([]);
  });

  it('🔴 교안의 ```sql 중 마이그레이션 몫이 파일 안에 실재한다', () => {
    const srcs = sqlSources();
    // 손으로 치는 조회(SELECT·UPDATE users)는 마이그레이션이 아니라 Step 3 의 탐색이다.
    const fromMigration = blocksOf(LECTURE, 'sql').filter((b) => /^(CREATE TABLE|ALTER TABLE|INSERT INTO "users"|-- ①|-- ④|-- ⑤|-- ⑥|-- DropForeignKey)/.test(b.trim()));
    expect(fromMigration.length).toBeGreaterThanOrEqual(4);
    const missing = fromMigration.filter((b) => !srcs.some((s) => s.includes(b.trim())));
    expect(missing).toEqual([]);
  });

  it('🔴 교안·답안의 자바스크립트가 전부 코드베이스 어딘가에 실재한다', () => {
    const srcs = jsSources();
    const missing = [];
    for (const doc of [LECTURE, ANSWERS]) {
      if (!exists(doc)) continue;
      for (const block of blocksOf(doc, 'javascript')) {
        for (const chunk of chunks(block)) {
          if (chunk.startsWith('const posts = await prisma.post.findMany')) continue;   // Step 8 설명용 조각
          if (chunk.startsWith('{')) continue;                                          // 응답 예시
          if (!srcs.some((s) => s.includes(chunk))) missing.push(chunk.split('\n')[0]);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('🔴 완성본으로 인용한 postService 가 byte 동일하다', () => {
    const quoted = blocksOf(LECTURE, 'javascript')
      .filter((b) => b.startsWith('// ~/instagram-api/services/postService.js'));
    expect(quoted.length).toBeGreaterThanOrEqual(1);
    const fullest = quoted.reduce((a, b) => (b.length > a.length ? b : a));
    expect(fullest).toBe(read(P('snapshots/p2-33-final/services/postService.js')).trimEnd());
  });

  it('🚨 교안이 인용한 CLI 경고가 실제 출력과 같다', () => {
    const lec = read(LECTURE);
    for (const phrase of [
      // 🚨 Step 번호는 0 부터다 — 2026-09-18 학생 상태(p2-30 시드 뒤)에서 pty 로 다시 받았다.
      '• Step 0 Added the required column `author_id` to the `comments` table without a default value.',
      '• Step 1 Added the required column `author_id` to the `posts` table without a default value.',
      'There are 9 rows in this table, it is not possible to execute this step.',
      'There are 5 rows in this table, it is not possible to execute this step.',
      'You are about to drop the column `username` on the `posts` table, which still contains 5 non-null values.',
      // 🚨 시드 뒤라 dahye 도 사진이 있다 — 4 가 아니라 5.
      'You are about to drop the column `profile_image` on the `posts` table, which still contains 5 non-null values.',
      'You can now edit it and apply it by running prisma migrate dev.',
    ]) expect(lec, phrase.slice(0, 40)).toContain(phrase);
  });
});
