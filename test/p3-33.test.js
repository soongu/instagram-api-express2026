// p3-33 「커서 페이지네이션 — SQL 원리부터 트레이드오프까지」 게이트 — 백엔드
//
// `6-api-design` 둘째 회차다(`curriculum.md` 「`p3-33` 착수 결정」). 수업 백엔드에서 바뀌는 학생 파일 —
// `prisma/schema.prisma`(@@index) · 새 마이그레이션 · `services/postService.js`(keyset · 불투명 커서) ·
// `routes/posts.js` · `schemas/postSchema.js`(목록 쿼리 검사) · 새 `requests/cursor.http`.
//
// 축 ① Step 1 — 쿼리 로그의 SQL 이 교안 블록과 같다(앞 판 · 끝 판)
// 축 ② Step 2~6 — 실습 데이터베이스에서 교안의 EXPLAIN 블록을 차례로 실행해 실행 계획 펜스와 대조
// 축 ⑥ Step 6·7 — 끝 판의 목록 계약
// 축 ⑦ Step 7 — 잘못된 입력 · 상한
// 축 ⑧ 직접 해보기 · 과제 — 정답 판 · 틀린 판(해설의 «이렇게 하면 이렇게 돼요» 를 실제로 돌린다)
// 축 ⑨ 학생 파일 — code/p3-32 에서 바뀐 파일 · 교안 코드 블록 줄 실재
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, mkdtempSync, rmSync, cpSync, symlinkSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import pg from 'pg';
import { boot } from './helpers/boot.js';
import { roundDir } from './helpers/round.js';

const ROOT = new URL('../', import.meta.url);
const P = (rel) => new URL(rel, ROOT).pathname;
const read = (path) => readFileSync(path, 'utf8');
const ADMIN = { host: 'localhost', port: 5432, database: 'postgres', user: 'postgres', password: 'postgres' };
const GATE_DB = 'p333_gate';
const GATE_URL = `postgresql://postgres:postgres@localhost:5432/${GATE_DB}`;
const PORT = 3791;

const ROUND = roundDir('code/p3-33');
const R = (rel) => join(ROUND.dir, rel);
const BEFORE = roundDir('code/p3-32');
const B = (rel) => join(BEFORE.dir, rel);

const getJson = async (url, init) => {
  const res = await fetch(url, init);
  const type = res.headers.get('content-type') ?? '';
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: type.includes('json') && text !== '' ? JSON.parse(text) : text };
};
const send = (base, method, path, { headers = {}, json } = {}) => getJson(`${base}${path}`, {
  method,
  headers: { ...headers, ...(json ? { 'Content-Type': 'application/json' } : {}) },
  body: json ? JSON.stringify(json) : undefined,
});

let db = null;
const env = { DATABASE_URL: GATE_URL, CORS_ORIGIN: 'http://localhost:3001' };
const STUDENT_FILES = ['app.js', 'db.js', 'errors.js', 'routes', 'services', 'middlewares', 'schemas', 'package.json', 'requests'];

/** overrides: { '상대 경로': 내용 | null(지우기) } · from: 어느 판에서 복사할지(기본 이 회차) */
const withServer = async (port, overrides, fn, from = R) => {
  const dir = mkdtempSync(join(tmpdir(), 'p333-srv-'));
  for (const name of STUDENT_FILES) {
    if (existsSync(from(name))) cpSync(from(name), join(dir, name), { recursive: true });
  }
  symlinkSync(P('node_modules'), join(dir, 'node_modules'));
  for (const [name, src] of Object.entries(overrides)) {
    if (src === null) rmSync(join(dir, name), { force: true });
    else {
      mkdirSync(join(dir, name, '..'), { recursive: true });
      writeFileSync(join(dir, name), src);
    }
  }
  const srv = await boot(join(dir, 'app.js'), { port, cwd: dir, env: { ...env, PORT: String(port) }, ready: `${port}번 포트에서` });
  try {
    await fn({ ...srv, dir });
  } finally {
    await Promise.race([srv.stop(), sleep(500)]);
    rmSync(dir, { recursive: true, force: true });
  }
};

const dropGate = async () => {
  const admin = new pg.Client(ADMIN);
  await admin.connect();
  await admin.query(
    `select pg_terminate_backend(pid) from pg_stat_activity where datname = '${GATE_DB}' and pid <> pg_backend_pid()`);
  await admin.query(`DROP DATABASE IF EXISTS ${GATE_DB}`);
  return admin;
};
const reseed = () => execFileSync(process.execPath, [P('seed.js')], { cwd: P('.'), encoding: 'utf8', env: { ...process.env, ...env } });

beforeAll(async () => {
  const admin = await dropGate();
  await admin.query(`CREATE DATABASE ${GATE_DB}`);
  await admin.end();
  db = new pg.Client({ ...ADMIN, database: GATE_DB });
  await db.connect();
  for (const dir of readdirSync(R('prisma/migrations')).filter((name) => name !== 'migration_lock.toml').sort()) {
    await db.query(read(R(`prisma/migrations/${dir}/migration.sql`)));
  }
  reseed();
}, 120000);

afterAll(async () => {
  if (db) await db.end();
  const admin = await dropGate();
  await admin.end();
  ROUND.cleanup();
  BEFORE.cleanup();
});

/** nextCursor 를 따라 끝까지 내려가며 받은 페이지를 모은다 */
const walk = async (base, query = 'limit=2') => {
  const pages = [];
  let cursor = null;
  for (let turn = 0; turn < 50; turn += 1) {
    const path = `/api/posts?${query}${cursor === null ? '' : `&cursor=${cursor}`}`;
    const res = await send(base, 'GET', path);
    expect(res.status, path).toBe(200);
    pages.push(res.body);
    if (res.body.nextCursor === null) return pages;
    cursor = res.body.nextCursor;
  }
  throw new Error('50번을 내려가도 끝나지 않아요');
};
const ids = (pages) => pages.flatMap((page) => page.items.map((post) => post.id));

describe('축 ⑥ — Step 6: 끝 판의 목록 계약', () => {
  it('🔴 응답은 { items, hasNext, nextCursor } — nextCursor 를 따라가면 게시물 5개가 최신순으로 한 번씩 · 마지막은 null', async () => {
    reseed();
    await withServer(PORT, {}, async (now) => {
      const pages = await walk(now.base);
      expect(pages.map((page) => Object.keys(page).sort())).toEqual(Array(3).fill(['hasNext', 'items', 'nextCursor']));
      expect(ids(pages)).toEqual([1, 2, 3, 4, 5]);
      expect(pages.map((page) => page.hasNext)).toEqual([true, true, false]);
      expect(pages.at(-1).nextCursor).toBeNull();
    });
  });

  it('🔴 커서는 base64url 글자이고, 풀면 그 페이지 마지막 게시물의 시각과 번호다', async () => {
    reseed();
    await withServer(PORT, {}, async (now) => {
      const [first] = await walk(now.base);
      expect(first.nextCursor).toMatch(/^[A-Za-z0-9_-]+$/);
      const last = first.items.at(-1);
      expect(JSON.parse(Buffer.from(first.nextCursor, 'base64url').toString())).toEqual({ createdAt: last.createdAt, id: last.id });
    });
  });

  it('🔴 새 게시물이 올라와도 다음 페이지가 겹치지 않는다', async () => {
    reseed();
    await withServer(PORT, {}, async (now) => {
      const first = (await send(now.base, 'GET', '/api/posts?limit=2')).body;
      await db.query(`INSERT INTO posts (author_id, content, created_at, updated_at) VALUES (1, '새 글', now(), now())`);
      const second = (await send(now.base, 'GET', `/api/posts?limit=2&cursor=${first.nextCursor}`)).body;
      expect(second.items.map((post) => post.id)).toEqual([3, 4]);
    });
  });

  it('🔴 커서였던 게시물이 지워져도 다음 게시물부터 이어진다(앞 판은 빈 목록)', async () => {
    reseed();
    await withServer(PORT, {}, async (now) => {
      const first = (await send(now.base, 'GET', '/api/posts?limit=2')).body;
      expect((await send(now.base, 'DELETE', '/api/posts/2')).status).toBe(200);
      const second = (await send(now.base, 'GET', `/api/posts?limit=2&cursor=${first.nextCursor}`)).body;
      expect(second.items.map((post) => post.id)).toEqual([3, 4]);
      expect(second.hasNext).toBe(true);
    });
    reseed();
    await withServer(PORT + 1, {}, async (before) => {
      expect((await send(before.base, 'DELETE', '/api/posts/2')).status).toBe(200);
      expect((await send(before.base, 'GET', '/api/posts?limit=2&cursor=2')).body).toEqual({ items: [], hasNext: false });
    }, B);
  });

  it('🔴 시각이 같은 게시물이 페이지 경계에 걸려도 빠지거나 겹치지 않는다', async () => {
    reseed();
    await db.query(`UPDATE posts SET created_at = '2026-01-01 00:00:00' WHERE id IN (2, 3, 4)`);
    await withServer(PORT, {}, async (now) => {
      // 2·3·4 번을 5번보다 오래된 같은 시각으로 맞췄다 — 같은 시각 안에서는 번호가 큰 쪽이 먼저다.
      expect(ids(await walk(now.base))).toEqual([1, 5, 4, 3, 2]);
    });
  });

  it('🔴 ?username= 과 ?userId= 가 커서와 함께 동작한다', async () => {
    reseed();
    await db.query(`INSERT INTO post_likes (post_id, user_id) VALUES (3, 1) ON CONFLICT DO NOTHING`);
    await withServer(PORT, {}, async (now) => {
      const all = (await send(now.base, 'GET', '/api/posts?limit=5')).body.items;
      const name = all[0].username;
      const own = all.filter((post) => post.username === name).map((post) => post.id);
      expect(ids(await walk(now.base, `limit=1&username=${name}`))).toEqual(own);
      const liked = (await walk(now.base, 'limit=2&userId=1')).flatMap((page) => page.items).find((post) => post.id === 3);
      expect(liked.liked).toBe(true);
    });
  });
});

// Step 6 끝 판 — 검사가 없는 판. Step 7 이 «겪기» 로 쓴다.
const STEP6 = {
  'services/postService.js': read(P('snapshots/p3-33/step6.postService.js')),
  'routes/posts.js': read(P('snapshots/p3-33/step6.posts-route.js')),
};
const BAD_CURSOR = { message: '커서 값이 올바르지 않아요' };

describe('축 ⑦ — Step 7: 잘못된 입력', () => {
  it('🔴 앞 판(Step 6) — 커서가 아닌 값 · 옛 숫자 커서 · 필드가 빠진 커서는 500', async () => {
    reseed();
    await withServer(PORT, STEP6, async (step6) => {
      for (const cursor of ['abc', '2', 'eyJpZCI6Mn0']) {
        expect((await send(step6.base, 'GET', `/api/posts?limit=2&cursor=${cursor}`)).status, cursor).toBe(500);
      }
    });
  });

  it('🔴 끝 판 — 커서가 아닌 글자·옛 숫자 커서·모양이 틀린 커서는 400 «커서 값이 올바르지 않아요»', async () => {
    reseed();
    const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
    await withServer(PORT, {}, async (now) => {
      const T0 = '2026-01-01T00:00:00.000Z';
      for (const cursor of ['abc', '2', 'eyJpZCI6Mn0', encode({ id: 2 }), encode({ createdAt: '어제', id: 2 }), encode({ createdAt: T0, id: '2' }),
        encode({ createdAt: null, id: 2 }), encode({ createdAt: true, id: 2 }), encode({ createdAt: 0, id: 2 }), encode({ createdAt: T0, id: 3000000000 })]) {
        const res = await send(now.base, 'GET', `/api/posts?limit=2&cursor=${cursor}`);
        expect({ status: res.status, body: res.body }, cursor).toEqual({ status: 400, body: BAD_CURSOR });
      }
      expect((await send(now.base, 'GET', '/api/posts?limit=2&cursor=')).status).toBe(400);
    });
  });

  it('🔴 끝 판 — limit 은 1 이상 50 이하의 정수(그 밖은 400) · 없으면 기본 5', async () => {
    reseed();
    await withServer(PORT, {}, async (now) => {
      for (const limit of ['0', '-1', '51', '100000', 'abc', '1.5']) {
        const res = await send(now.base, 'GET', `/api/posts?limit=${limit}`);
        expect(res.status, limit).toBe(400);
        expect(res.body.message, limit).toBe('보낸 내용이 규칙에 안 맞아요');
      }
      expect((await send(now.base, 'GET', '/api/posts?limit=50')).status).toBe(200);
      expect((await send(now.base, 'GET', '/api/posts')).body.items).toHaveLength(5);
    });
  });

  it('🔴 끝 판 — userId 가 숫자가 아니면 세지 않고 liked: false(계약 그대로)', async () => {
    reseed();
    await withServer(PORT, {}, async (now) => {
      const res = await send(now.base, 'GET', '/api/posts?userId=abc&limit=1');
      expect(res.status).toBe(200);
      expect(res.body.items[0].liked).toBe(false);
    });
  });
});

// ───────── 교안 ─────────
const LECTURE = () => read(P('../../part3/6-api-design/p3-33-cursor-pagination-lecture.md'));
const ANSWERS = () => read(P('../../part3/6-api-design/p3-33-cursor-pagination-answers.md'));
const SNAP = (name) => P(`snapshots/p3-33/${name}`);
const LAB_FILE = (name) => read(P(`lab/p3-33/${name}`));
const rep = (src, a, b) => {
  if (src.split(a).length !== 2) throw new Error(`바꿀 글자가 정확히 한 번 있어야 해요: ${a}`);
  return src.replace(a, b);
};
/** 마크다운의 펜스를 차례대로 { lang, body, line } 으로 */
const fences = (md) => {
  const out = [];
  let open = null;
  md.split('\n').forEach((text, index) => {
    const m = text.match(/^```(\S*)$/);
    if (!m) { if (open) open.body.push(text); return; }
    if (open) { out.push({ ...open, body: open.body.join('\n') }); open = null; } else open = { lang: m[1], body: [], line: index + 1 };
  });
  return out;
};
const oneLine = (sql) => sql.replace(/\s+/g, ' ').replace(/\( /g, '(').replace(/ \)/g, ')').trim();

describe('축 ① — Step 1·6: 쿼리 로그의 SQL', () => {
  const COLUMNS = 'id, author_id, post_alt, content, like_count, comment_count, created_at, updated_at';
  const LOG_ON = (src) => rep(src, 'new PrismaClient({ adapter })', "new PrismaClient({ adapter, log: ['query'] })");
  // 교안은 큰따옴표 · 스키마 이름 · 겹괄호를 뺐다고 말한다 — 괄호를 양쪽에서 지우고 비교한다.
  const noParens = (sql) => oneLine(sql.replace(/[()]/g, ' '));
  const clean = (line) => noParens(line.replace('prisma:query ', '').replaceAll('"public"."posts".', '').replaceAll('"public"."posts"', 'posts').replaceAll('"', ''));
  const blocks = () => fences(LECTURE()).filter((f) => f.lang === 'sql' && f.body.startsWith(`SELECT ${COLUMNS}`)).map((f) => noParens(f.body));
  const postLines = (log) => log.split('\n').filter((l) => l.startsWith('prisma:query') && l.includes('"public"."posts"."author_id"'));

  it('🔴 앞 판 — 첫 페이지와 둘째 페이지의 SQL 이 교안 블록과 같다 · 줄이 3개씩', async () => {
    reseed();
    await withServer(PORT + 2, { 'db.js': LOG_ON(read(B('db.js'))) }, async (srv) => {
      await send(srv.base, 'GET', '/api/posts?limit=2');
      await sleep(100);
      const first = srv.tail();
      expect(first.split('\n').filter((l) => l.startsWith('prisma:query'))).toHaveLength(3);
      await send(srv.base, 'GET', '/api/posts?limit=2&cursor=2');
      await sleep(100);
      const lines = postLines(srv.tail());
      expect(lines).toHaveLength(2);
      expect(blocks().slice(0, 2)).toEqual(lines.map(clean));
    }, B);
  });

  it('🔴 끝 판 — 둘째 페이지의 SQL 이 교안 블록과 같다', async () => {
    reseed();
    await withServer(PORT + 2, { 'db.js': LOG_ON(read(R('db.js'))) }, async (srv) => {
      const first = (await send(srv.base, 'GET', '/api/posts?limit=2')).body;
      await send(srv.base, 'GET', `/api/posts?limit=2&cursor=${first.nextCursor}`);
      await sleep(100);
      expect(blocks()[2]).toBe(clean(postLines(srv.tail())[1]));
    });
  });
});

// ───────── 실습 데이터베이스 ─────────
const LAB_DB = 'p333_gate_lab';
const LAB_URL = `postgresql://postgres:postgres@localhost:5432/${LAB_DB}`;
const LAB_ENV = { DATABASE_URL: LAB_URL };
let lab = null;
const FEED_MIGRATION = '20261106135135_add_posts_feed_index';

const dropLab = async () => {
  if (lab) { await lab.end(); lab = null; }
  const admin = new pg.Client(ADMIN);
  await admin.connect();
  await admin.query(`select pg_terminate_backend(pid) from pg_stat_activity where datname = '${LAB_DB}' and pid <> pg_backend_pid()`);
  await admin.query(`DROP DATABASE IF EXISTS ${LAB_DB}`);
  await admin.end();
};
const planText = async (sql) => (await lab.query(sql)).rows.map((row) => row['QUERY PLAN']).join('\n');
// 시간 · 메모리 · 힙 조회는 사람과 순간마다 다르다 — 행 수와 노드만 본다.
const normal = (plan) => plan
  .replace(/actual time=[\d.]+\.\.[\d.]+ /g, 'actual ')
  .replace(/(Planning|Execution) Time: [\d.]+ ms/g, '$1 Time')
  .replace(/Memory: \d+kB/g, 'Memory')
  .replace(/Heap Fetches: \d+/g, 'Heap Fetches')
  .trim();
const fencePlan = (body) => normal(body.replace(/^ /gm, ''));
/** 교안에서 EXPLAIN 블록과 바로 뒤의 언어 없는 펜스를 짝지어 준다 */
const planPairs = () => {
  const list = fences(LECTURE());
  return list.flatMap((f, i) => (f.lang === 'sql' && f.body.startsWith('EXPLAIN') && list[i + 1]?.lang === '' ? [{ sql: f.body, plan: list[i + 1].body, line: f.line }] : []));
};

describe('축 ② — Step 2~6: 교안의 실행 계획', () => {
  beforeAll(async () => {
    await dropLab();
    const admin = new pg.Client(ADMIN);
    await admin.connect();
    await admin.query(`CREATE DATABASE ${LAB_DB}`);
    await admin.end();
    lab = new pg.Client({ ...ADMIN, database: LAB_DB });
    await lab.connect();
    for (const dir of readdirSync(R('prisma/migrations')).filter((name) => name !== 'migration_lock.toml' && name !== FEED_MIGRATION).sort()) {
      await lab.query(read(R(`prisma/migrations/${dir}/migration.sql`)));
    }
    execFileSync(process.execPath, [P('seed.js')], { cwd: P('.'), encoding: 'utf8', env: { ...process.env, ...LAB_ENV } });
    await lab.query(LAB_FILE('many-posts.sql'));
  }, 120000);
  afterAll(dropLab);

  it('🔴 many-posts.sql 은 교안 블록과 byte 같다 · 시드를 더해 100005행 · 최신순 n번째의 번호가 n', async () => {
    expect(fences(LECTURE()).some((f) => f.body === LAB_FILE('many-posts.sql').trimEnd())).toBe(true);
    expect((await lab.query('SELECT count(*)::int AS n FROM posts')).rows[0].n).toBe(100005);
    const { rows } = await lab.query('SELECT id FROM posts ORDER BY created_at DESC, id DESC');
    expect(rows.every((row, index) => row.id === index + 1)).toBe(true);
  });

  it('🔴 인덱스 없는 첫 페이지 — 교안의 계획과 같다(rows × loops 가 100005)', async () => {
    const [first] = planPairs();
    expect(normal(await planText(first.sql))).toBe(fencePlan(first.plan));
    expect(50002.5 * 2).toBe(100005);
  });

  it('🔴 인덱스 뒤 — 교안의 EXPLAIN 블록과 펜스를 차례로 대조한다', async () => {
    await lab.query(read(R(`prisma/migrations/${FEED_MIGRATION}/migration.sql`)));
    const [, ...rest] = planPairs();
    expect(rest.length).toBeGreaterThanOrEqual(6);
    for (const pair of rest) {
      expect(normal(await planText(pair.sql)), `L${pair.line}`).toBe(fencePlan(pair.plan));
    }
  });

  const rowsOf = (plan) => Number(plan.match(/Index Scan using posts_created_at_id_idx on posts \(actual time=\S+ rows=([\d.]+)/)[1]);
  const removed = (plan) => Number(plan.match(/Rows Removed by Filter: (\d+)/)?.[1] ?? 0);
  const timeOf = async (id) => (await lab.query(`SELECT to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') AS t FROM posts WHERE id = ${id}`)).rows[0].t;
  const E = 'EXPLAIN (ANALYZE, COSTS OFF, BUFFERS OFF) ';

  it('🔴 Step 4 표 — OFFSET 이 읽는 행은 OFFSET + 20', async () => {
    const lecture = LECTURE();
    for (const [offset, read20] of [[0, '20'], [1000, '1,020'], [50000, '50,020'], [99980, '100,000']]) {
      const plan = await planText(`${E}SELECT * FROM posts ORDER BY created_at DESC, id DESC LIMIT 20 OFFSET ${offset}`);
      expect(rowsOf(plan)).toBe(offset + 20);
      expect(lecture).toMatch(new RegExp(`^ +${offset} +${read20} +20$`, 'm'));
    }
  });

  it('🔴 Step 5 표 — 깊이마다 OFFSET · 지금 커서 · 행 비교식이 읽은 행', async () => {
    const lecture = LECTURE();
    for (const [id, offset, cursor] of [[1000, '1,020', '1,021'], [50000, '50,020', '50,021'], [99980, '100,000', '100,001']]) {
      const prisma = await planText(`${E}SELECT * FROM posts WHERE (created_at = (SELECT created_at FROM posts WHERE id = ${id}) AND id <= (SELECT id FROM posts WHERE id = ${id})) OR created_at < (SELECT created_at FROM posts WHERE id = ${id}) ORDER BY created_at DESC, id DESC LIMIT 21 OFFSET 1`);
      expect((rowsOf(prisma) + removed(prisma)).toLocaleString('en-US')).toBe(cursor);
      const t = await timeOf(id);
      const keyset = await planText(`${E}SELECT * FROM posts WHERE (created_at, id) < ('${t}', ${id}) ORDER BY created_at DESC, id DESC LIMIT 20`);
      expect(rowsOf(keyset)).toBe(20);
      expect(removed(keyset)).toBe(0);
      expect(lecture).toMatch(new RegExp(`^ ${id}번 +${offset} +${cursor} +20$`, 'm'));
    }
  });

  it('🔴 Step 4 — 정렬이 id 한 칸이면 Prisma 꼴의 커서도 Index Cond 로 22행', async () => {
    const plan = await planText(`${E}SELECT * FROM posts WHERE id <= (SELECT id FROM posts WHERE id = 99980) ORDER BY id DESC LIMIT 21 OFFSET 1`);
    expect(plan).toMatch(/Index Scan Backward using posts_pkey on posts \(actual time=\S+ rows=22\.00/);
    expect(plan).toContain('Index Cond: (id <= (InitPlan 1).col1)');
    expect(plan).not.toContain('Rows Removed by Filter');
  });

  it('🔴 Step 6 — Prisma where 판의 조건은 어느 깊이에서든 Index Cond + 1행만 버린다', async () => {
    for (const id of [1000, 50000, 99980]) {
      const t = await timeOf(id);
      const plan = await planText(`${E}SELECT * FROM posts WHERE created_at <= '${t}' AND (created_at < '${t}' OR id < ${id}) ORDER BY created_at DESC, id DESC LIMIT 21`);
      expect(plan).toContain('Index Cond: (created_at <=');
      expect(removed(plan)).toBe(1);
    }
  });

  it('🔴 Step 3 🙋 — 오름차순 인덱스는 거꾸로 읽고, 한쪽만 뒤집힌 인덱스는 Incremental Sort', async () => {
    const q = `${E}SELECT * FROM posts ORDER BY created_at DESC, id DESC LIMIT 20`;
    await lab.query('BEGIN');
    await lab.query('DROP INDEX posts_created_at_id_idx');
    await lab.query('CREATE INDEX t_asc ON posts (created_at, id)');
    expect(await planText(q)).toMatch(/Index Scan Backward using t_asc[\s\S]*rows=20\.00/);
    await lab.query('ROLLBACK');
    await lab.query('BEGIN');
    await lab.query('DROP INDEX posts_created_at_id_idx');
    await lab.query('CREATE INDEX t_mix ON posts (created_at DESC, id ASC)');
    expect(await planText(q)).toContain('Incremental Sort');
    await lab.query('ROLLBACK');
  });

  it('🔴 직접 해보기 1 — 해설의 계획 · 확인 절차 셋(Rows Removed · Sort · Buffers)이 틀린 판을 모두 가른다', async () => {
    const q = 'SELECT * FROM posts WHERE author_id = 5 ORDER BY created_at DESC, id DESC LIMIT 20';
    const lecture = LECTURE();
    const before = await planText(`${E}${q}`);
    expect(removed(before)).toBe(18985);
    expect(lecture).toContain('Rows Removed by Filter: 18985');
    expect((await lab.query('SELECT count(*)::int AS n FROM posts WHERE author_id = 5')).rows[0].n).toBe(101);
    const second = async (definition) => {
      await lab.query(`CREATE INDEX lab_try ON posts ${definition}`);
      await planText(`EXPLAIN (ANALYZE, COSTS OFF) ${q}`);
      const plan = await planText(`EXPLAIN (ANALYZE, COSTS OFF) ${q}`);
      await lab.query('DROP INDEX lab_try');
      const blocks = Number(plan.match(/Limit[^\n]*\n\s+Buffers: shared hit=(\d+)/)[1]);
      return { noRemoved: !plan.includes('Rows Removed by Filter'), noSort: !plan.includes('Sort'), blocks, plan };
    };
    const good = await second('(author_id, created_at DESC, id DESC)');
    expect(good).toMatchObject({ noRemoved: true, noSort: true });
    expect(good.blocks).toBeLessThan(30);
    expect(good.plan).toContain('Index Cond: (author_id = 5)');
    // 교안 해설의 계획 펜스 — 둘째 실행(인덱스 이름만 판정용 lab_try)
    const fence = fences(lecture).find((f) => f.lang === '' && f.body.includes('Index Scan using lab_profile'));
    expect(fencePlan(fence.body.replace(/Buffers: shared hit=\d+/g, 'Buffers'))).toBe(normal(good.plan.replace(/lab_try/g, 'lab_profile').replace(/Buffers: shared hit=\d+/g, 'Buffers')));
    const reversed = await second('(created_at DESC, id DESC, author_id)');
    expect(reversed).toMatchObject({ noRemoved: true, noSort: true });
    expect(reversed.plan).toContain('Index Cond: (author_id = 5)');
    expect(reversed.blocks).toBeGreaterThan(80);
    for (const wrong of ['(author_id)', '(author_id, created_at DESC)', '(author_id, created_at DESC, id ASC)']) {
      expect((await second(wrong)).noSort, wrong).toBe(false);
    }
  });

  it('🔴 직접 해보기 2 — 시각만 비교하면 49개가 사라진다 · 행 비교식은 2049번부터 · 되돌리면 그대로', async () => {
    const before = (await lab.query('SELECT created_at FROM posts WHERE id = 2001')).rows[0].created_at.getTime();
    await lab.query(`UPDATE posts SET created_at = '2025-12-31 00:00:00' WHERE id BETWEEN 2001 AND 2100`);
    const ids3 = async (where) => (await lab.query(`SELECT id FROM posts WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT 3`)).rows.map((row) => row.id);
    expect(await ids3(`created_at < '2025-12-31 00:00:00'`)).toEqual([2341, 2342, 2343]);
    expect(await ids3(`(created_at, id) < ('2025-12-31 00:00:00', 2050)`)).toEqual([2049, 2048, 2047]);
    expect((await lab.query(`SELECT count(*)::int AS n FROM posts WHERE created_at = '2025-12-31 00:00:00' AND id < 2050`)).rows[0].n).toBe(49);
    await lab.query(`UPDATE posts SET created_at = TIMESTAMP '2026-01-01 00:00:00' - (id - 5) * INTERVAL '37 seconds' WHERE id BETWEEN 2001 AND 2100`);
    expect((await lab.query('SELECT created_at FROM posts WHERE id = 2001')).rows[0].created_at.getTime()).toBe(before);
    expect((await lab.query(`SELECT to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') AS t FROM posts WHERE id = 2001`)).rows[0].t).toBe('2025-12-31 03:29:08');
  });

  it('🔴 Step 8 — count(*) 는 100005행을 읽는다', async () => {
    expect(await planText(`${E}SELECT count(*) FROM posts`)).toMatch(/Seq Scan on posts \(actual time=\S+ rows=100005\.00/);
  });

  describe('Step 7 — 상한이 없던 판', () => {
    it('🔴 Step 6 판 — limit=30000 은 200 · 8MB 넘는 응답 · limit=100000 은 500 + P2029', async () => {
      const dir = mkdtempSync(join(tmpdir(), 'p333-limit-'));
      for (const name of STUDENT_FILES) cpSync(R(name), join(dir, name), { recursive: true });
      symlinkSync(P('node_modules'), join(dir, 'node_modules'));
      for (const [name, src] of Object.entries(STEP6)) writeFileSync(join(dir, name), src);
      const srv = await boot(join(dir, 'app.js'), { port: PORT + 3, cwd: dir, env: { ...env, ...LAB_ENV, PORT: String(PORT + 3) }, ready: `${PORT + 3}번 포트에서` });
      try {
        const big = await fetch(`${srv.base}/api/posts?limit=30000`);
        expect(big.status).toBe(200);
        expect((await big.text()).length).toBeGreaterThan(5_000_000);
        expect((await send(srv.base, 'GET', '/api/posts?limit=100000')).status).toBe(500);
        await sleep(100);
        expect(srv.tail()).toContain("code: 'P2029'");
      } finally {
        await Promise.race([srv.stop(), sleep(500)]);
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  // ───────── 실습 서버 ─────────
  const withLab = async ({ name, port, src, url = LAB_URL }, fn) => {
    const dir = mkdtempSync(join(tmpdir(), 'p333-lab-'));
    for (const file of ['db.js', 'errors.js', 'middlewares', 'schemas', 'package.json']) cpSync(R(file), join(dir, file), { recursive: true });
    mkdirSync(join(dir, 'lab/p3-33'), { recursive: true });
    writeFileSync(join(dir, 'lab/p3-33', name), src ?? LAB_FILE(name));
    symlinkSync(P('node_modules'), join(dir, 'node_modules'));
    const srv = await boot(join(dir, 'lab/p3-33', name), { port, cwd: dir, env: { ...env, DATABASE_URL: url }, ready: `${port}번 포트에서` });
    try {
      await fn(`http://localhost:${port}`);
    } finally {
      await Promise.race([srv.stop(), sleep(500)]);
      rmSync(dir, { recursive: true, force: true });
    }
  };
  const list = async (base, path) => (await send(base, 'GET', path));

  describe('직접 해보기 3 — 댓글 커서', () => {
    const tieReset = async () => {
      const { rows } = await lab.query('SELECT id, created_at FROM comments WHERE id IN (4, 5, 6, 7) ORDER BY id');
      return async () => { for (const row of rows) await lab.query('UPDATE comments SET created_at = $1 WHERE id = $2', [row.created_at, row.id]); };
    };
    const walk2 = async (base) => {
      const first = (await list(base, '/api/posts/2/comments?limit=2')).body;
      const second = first.nextCursor ? (await list(base, `/api/posts/2/comments?limit=2&cursor=${first.nextCursor}`)).body : null;
      return { first, second };
    };
    const tie = async () => {
      const blocks = fences(LECTURE()).filter((f) => f.lang === 'sql' && f.body.startsWith('UPDATE comments'));
      expect(blocks).toHaveLength(1);
      for (const statement of blocks[0].body.split(';').map((s) => s.trim()).filter(Boolean)) await lab.query(statement);
    };

    it('🔴 정답 판 — 4·5 / 6·7 · 끝 null · 400 둘 · 시각이 같아도 그대로', async () => {
      await withLab({ name: 'practice3.js', port: 4003 }, async (base) => {
        const { first, second } = await walk2(base);
        expect(first.items.map((c) => c.id)).toEqual([4, 5]);
        expect(Object.keys(first.items[0]).sort()).toEqual(['content', 'createdAt', 'id']);
        expect(second.items.map((c) => c.id)).toEqual([6, 7]);
        expect(second).toMatchObject({ hasNext: false, nextCursor: null });
        const bad = await list(base, '/api/posts/2/comments?limit=2&cursor=abc');
        expect({ status: bad.status, body: bad.body }).toEqual({ status: 400, body: BAD_CURSOR });
        expect((await list(base, '/api/posts/2/comments?limit=21')).status).toBe(400);
        expect((await list(base, '/api/posts/abc/comments')).status).toBe(404);
        const undo = await tieReset();
        await tie();
        const tied = await walk2(base);
        expect(tied.first.items.map((c) => c.id)).toEqual([7, 4]);
        expect(tied.second.items.map((c) => c.id)).toEqual([5, 6]);
        expect(tied.second).toMatchObject({ hasNext: false, nextCursor: null });
        await undo();
      });
    });

    it('🔴 틀린 판 — 비교 방향을 안 뒤집으면 다음 페이지에 앞 댓글이 다시 온다', async () => {
      const src = rep(rep(LAB_FILE('practice3.js'), 'createdAt: { gte: createdAt },', 'createdAt: { lte: createdAt },'),
        'OR: [{ createdAt: { gt: createdAt } }, { id: { gt: id } }],', 'OR: [{ createdAt: { lt: createdAt } }, { id: { lt: id } }],');
      await withLab({ name: 'practice3.js', port: 4003, src }, async (base) => {
        const { first, second } = await walk2(base);
        expect(first.items.map((c) => c.id)).toEqual([4, 5]);
        expect(second.items.map((c) => c.id)).toEqual([4]);
      });
    });

    it('🔴 틀린 판 — OR 의 id 조건을 빼면 평소에는 멀쩡하고 7번 요구사항에서 5·6번이 사라진다', async () => {
      const src = rep(rep(LAB_FILE('practice3.js'), 'createdAt: { gte: createdAt },\n', ''),
        'OR: [{ createdAt: { gt: createdAt } }, { id: { gt: id } }],', 'createdAt: { gt: createdAt },');
      await withLab({ name: 'practice3.js', port: 4003, src }, async (base) => {
        expect((await walk2(base)).second.items.map((c) => c.id)).toEqual([6, 7]);
        const undo = await tieReset();
        await tie();
        expect((await walk2(base)).second.items).toEqual([]);
        await undo();
      });
    });

    it('🔴 틀린 판 — 시각을 버리고 id 만 비교하면 평소에는 멀쩡하고 7번 요구사항에서 본 7번이 또 나온다', async () => {
      const src = rep(rep(LAB_FILE('practice3.js'), 'createdAt: { gte: createdAt },\n', ''),
        'OR: [{ createdAt: { gt: createdAt } }, { id: { gt: id } }],', 'id: { gt: id },');
      await withLab({ name: 'practice3.js', port: 4003, src }, async (base) => {
        expect((await walk2(base)).second.items.map((c) => c.id)).toEqual([6, 7]);
        const undo = await tieReset();
        await tie();
        const { first, second } = await walk2(base);
        expect(first.items.map((c) => c.id)).toEqual([7, 4]);
        expect(second.items.map((c) => c.id)).toEqual([7, 5]);
        expect(second.hasNext).toBe(true);
        await undo();
      });
    });

    it('🔴 틀린 판 — take 를 limit 으로 줄이면 첫 페이지부터 hasNext 가 false 라 다음 페이지를 못 받는다', async () => {
      const src = rep(LAB_FILE('practice3.js'), 'take: limit + 1,', 'take: limit,');
      await withLab({ name: 'practice3.js', port: 4003, src }, async (base) => {
        expect((await walk2(base)).first).toMatchObject({ hasNext: false, nextCursor: null });
      });
    });
  });

  describe('과제 [기초] — 페이지 번호 목록', () => {
    it('🔴 정답 판 — 1 · 5000 · 5001 · 5002 · 0 · 51', async () => {
      await withLab({ name: 'homework1.js', port: 4011 }, async (base) => {
        const get = (q) => list(base, `/api/admin/posts${q}`);
        const one = await get('');
        expect(one.body).toMatchObject({ page: 1, size: 20, totalCount: 100005, totalPages: 5001 });
        expect(one.body.items).toHaveLength(20);
        expect(Object.keys(one.body.items[0]).sort()).toEqual(['content', 'createdAt', 'id']);
        const deep = await get('?page=5000');
        expect(deep.body.items[0].id).toBe(99981);
        expect((await get('?page=5001')).body.items.map((p) => p.id)).toEqual([100001, 100002, 100003, 100004, 100005]);
        expect(await get('?page=5002').then((r) => [r.status, r.body.items])).toEqual([200, []]);
        expect((await get('?page=0')).status).toBe(400);
        expect((await get('?size=51')).status).toBe(400);
      });
    });

    it('🔴 틀린 판 — 번호로 정렬하면 시각을 바꾼 50000번이 맨 위로 안 올라온다(요구사항 7 · 정답 판은 올라온다)', async () => {
      const update = `UPDATE posts SET created_at = now() + INTERVAL '1 day' WHERE id = 50000`;
      const undo = `UPDATE posts SET created_at = TIMESTAMP '2026-01-01 00:00:00' - 49995 * INTERVAL '37 seconds' WHERE id = 50000`;
      expect(LECTURE()).toContain(update);
      expect(LECTURE()).toContain(undo);
      await lab.query(update);
      await withLab({ name: 'homework1.js', port: 4011 }, async (base) => {
        expect((await list(base, '/api/admin/posts')).body.items[0].id).toBe(50000);
      });
      const src = rep(LAB_FILE('homework1.js'), "orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],", "orderBy: { id: 'asc' },");
      await withLab({ name: 'homework1.js', port: 4011, src }, async (base) => {
        expect((await list(base, '/api/admin/posts')).body.items[0].id).toBe(1);
      });
      await lab.query(undo);
      await withLab({ name: 'homework1.js', port: 4011 }, async (base) => {
        expect((await list(base, '/api/admin/posts?page=5000')).body.items[0].id).toBe(99981);
      });
    });

    it('🔴 틀린 판 — page 검사가 없으면 page=0 이 500 · floor 면 totalPages 5000', async () => {
      const src = rep(rep(LAB_FILE('homework1.js'), 'page: z.coerce.number().int().min(1).optional(),', 'page: z.coerce.number().int().optional(),'),
        'Math.ceil(totalCount / size)', 'Math.floor(totalCount / size)');
      await withLab({ name: 'homework1.js', port: 4011, src }, async (base) => {
        expect((await list(base, '/api/admin/posts?page=0')).status).toBe(500);
        expect((await list(base, '/api/admin/posts')).body.totalPages).toBe(5000);
      });
    });
  });

  describe('과제 [응용] — 인기순 커서', () => {
    const FEED_CURSOR = 'eyJjcmVhdGVkQXQiOiIyMDI2LTAxLTAxVDAwOjAwOjAwLjAwMFoiLCJpZCI6Mn0';
    beforeAll(async () => {
      for (const statement of LAB_FILE('homework2.sql').split(';').map((s) => s.trim()).filter(Boolean)) await lab.query(statement);
    });

    it('🔴 깊은 페이지 조건이 lab_popular 의 Index Cond 로 들어간다 · 정렬이 같은 수만큼 행 비교 판도', async () => {
      const plan = await planText(`${E}SELECT * FROM posts WHERE like_count <= 25000 AND (like_count < 25000 OR id < 75000) ORDER BY like_count DESC, id DESC LIMIT 21`);
      expect(plan).toContain('Index Scan using lab_popular');
      expect(plan).toContain('Index Cond: (like_count <= 25000)');
      expect(removed(plan)).toBe(1);
      expect((await lab.query('SELECT like_count FROM posts WHERE id = 75000')).rows[0].like_count).toBe(25000);
      const row = await planText(`${E}SELECT * FROM posts WHERE (like_count, id) < (25000, 75000) ORDER BY like_count DESC, id DESC LIMIT 20`);
      expect(row).toContain('Index Cond: (ROW(like_count, id) < ROW(25000, 75000))');
    });

    it('🔴 정답 판 — 첫 페이지 세 게시물 · 좋아요를 낮추면 둘째 페이지에 또 나온다 · 400 둘', async () => {
      await withLab({ name: 'homework2.js', port: 4012 }, async (base) => {
        const first = (await list(base, '/api/popular-posts?limit=3')).body;
        expect(first.items.map((p) => [p.id, p.likeCount])).toEqual([[82321, 49999], [32321, 49999], [64642, 49998]]);
        expect(Object.keys(first.items[0]).sort()).toEqual(['content', 'id', 'likeCount']);
        await lab.query('UPDATE posts SET like_count = 49997 WHERE id = 82321');
        const second = (await list(base, `/api/popular-posts?limit=3&cursor=${first.nextCursor}`)).body;
        expect(second.items.map((p) => p.id)).toEqual([14642, 96963, 82321]);
        await lab.query('UPDATE posts SET like_count = 49999 WHERE id = 82321');
        for (const cursor of ['abc', FEED_CURSOR]) {
          const bad = await list(base, `/api/popular-posts?cursor=${cursor}`);
          expect({ status: bad.status, body: bad.body }, cursor).toEqual({ status: 400, body: BAD_CURSOR });
        }
      });
    });

    it('🔴 틀린 판 — likeCount lt 만 쓰면 둘째 페이지에서 14642번이 사라진다(요구사항 7 이 가른다)', async () => {
      const src = rep(rep(LAB_FILE('homework2.js'), '    likeCount: { lte: likeCount },\n', ''),
        'OR: [{ likeCount: { lt: likeCount } }, { id: { lt: id } }],', 'likeCount: { lt: likeCount },');
      await withLab({ name: 'homework2.js', port: 4012, src }, async (base) => {
        const first = (await list(base, '/api/popular-posts?limit=3')).body;
        await lab.query('UPDATE posts SET like_count = 49997 WHERE id = 82321');
        const second = (await list(base, `/api/popular-posts?limit=3&cursor=${first.nextCursor}`)).body;
        expect(second.items.map((p) => p.id)).toEqual([96963, 82321, 46963]);
        await lab.query('UPDATE posts SET like_count = 49999 WHERE id = 82321');
      });
    });

    it('🔴 반대 — 뒤에 있던 게시물의 좋아요가 커서 위로 올라가면 끝내 안 보인다', async () => {
      await withLab({ name: 'homework2.js', port: 4012 }, async (base) => {
        const first = (await list(base, '/api/popular-posts?limit=3')).body;
        await lab.query('UPDATE posts SET like_count = 50000 WHERE id = 14642');
        const second = (await list(base, `/api/popular-posts?limit=3&cursor=${first.nextCursor}`)).body;
        expect(second.items.map((p) => p.id)).not.toContain(14642);
        await lab.query('UPDATE posts SET like_count = 49998 WHERE id = 14642');
      });
    });
  });

  it('🔴 답안의 EXPLAIN 블록 둘 — 펜스와 대조(인기순 깊은 페이지 · 위로 받는 쿼리)', async () => {
    const list = fences(ANSWERS());
    const pairs = list.flatMap((f, i) => (f.lang === 'sql' && f.body.startsWith('EXPLAIN') && list[i + 1]?.lang === '' ? [{ sql: f.body, plan: list[i + 1].body, line: f.line }] : []));
    expect(pairs).toHaveLength(2);
    for (const pair of pairs) expect(normal(await planText(pair.sql)), `L${pair.line}`).toBe(fencePlan(pair.plan));
  });

  it('🔴 주제 1 — 위로 받는 쿼리는 Index Scan Backward + Index Cond · 20행', async () => {
    const t = await timeOf(50000);
    const plan = await planText(`${E}SELECT * FROM posts WHERE (created_at, id) > ('${t}', 50000) ORDER BY created_at ASC, id ASC LIMIT 20`);
    const ids = (await lab.query(`SELECT id FROM posts WHERE (created_at, id) > ('${t}', 50000) ORDER BY created_at ASC, id ASC LIMIT 20`)).rows.map((row) => row.id);
    expect([ids[0], ids.at(-1)]).toEqual([49999, 49980]);
    expect(plan).toMatch(/Index Scan Backward using posts_created_at_id_idx on posts \(actual time=\S+ rows=20\.00/);
    expect(plan).toContain('Index Cond: (ROW(created_at, id) > ROW(');
  });

  it('🔴 주제 2 — 상한까지만 세면 1001행 · 통계의 근사값은 100005', async () => {
    expect(await planText(`${E}SELECT count(*) FROM (SELECT 1 FROM posts LIMIT 1001) AS capped`)).toMatch(/Seq Scan on posts \(actual time=\S+ rows=1001\.00/);
    await lab.query('ANALYZE posts');
    expect((await lab.query(`SELECT reltuples::bigint AS n FROM pg_class WHERE relname = 'posts'`)).rows[0].n).toBe('100005');
  });

  it('🔴 Step 7 — 2번을 지운 뒤 시드와 many-posts.sql 을 다시 실행하면 처음 상태(100005행 · 2번 댓글 다섯)로 돌아온다', async () => {
    await lab.query('DROP INDEX IF EXISTS lab_popular');
    await lab.query('DELETE FROM posts WHERE id = 2');
    expect((await lab.query('SELECT count(*)::int AS n FROM comments WHERE post_id = 2')).rows[0].n).toBe(0);
    execFileSync(process.execPath, [P('seed.js')], { cwd: P('.'), encoding: 'utf8', env: { ...process.env, ...LAB_ENV } });
    await lab.query(LAB_FILE('many-posts.sql'));
    expect((await lab.query('SELECT count(*)::int AS n FROM posts')).rows[0].n).toBe(100005);
    expect((await lab.query('SELECT count(*)::int AS n FROM comments WHERE post_id = 2 AND parent_id IS NULL')).rows[0].n).toBe(4);
    expect((await lab.query('SELECT id FROM posts ORDER BY created_at DESC, id DESC OFFSET 99980 LIMIT 1')).rows[0].id).toBe(99981);
    expect((await lab.query('SELECT count(*)::int AS n FROM post_images WHERE post_id > 5')).rows[0].n).toBe(100000);
  });

  it('🔴 DROP DATABASE … WITH (FORCE) 는 연결이 남아 있어도 지운다', async () => {
    const admin = new pg.Client(ADMIN);
    await admin.connect();
    await admin.query('CREATE DATABASE p333_gate_drop');
    const holder = new pg.Client({ ...ADMIN, database: 'p333_gate_drop' });
    holder.on('error', () => {});
    await holder.connect();
    await expect(admin.query('DROP DATABASE p333_gate_drop')).rejects.toThrow();
    await admin.query('DROP DATABASE p333_gate_drop WITH (FORCE)');
    await admin.end();
    await holder.end().catch(() => {});
  }, 20000);
});

describe('축 ⑦ — 커서를 고쳐서 보내면(주제 3)', () => {
  it('🔴 미래 시각의 커서는 첫 페이지와 같고, 끝 뒤의 시각이면 빈 목록 — 200', async () => {
    reseed();
    const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
    await withServer(PORT, {}, async (now) => {
      const first = (await send(now.base, 'GET', '/api/posts?limit=2')).body;
      const future = await send(now.base, 'GET', `/api/posts?limit=2&cursor=${encode({ createdAt: '2100-01-01T00:00:00.000Z', id: 1 })}`);
      expect(future.status).toBe(200);
      expect(future.body.items.map((p) => p.id)).toEqual(first.items.map((p) => p.id));
      const past = await send(now.base, 'GET', `/api/posts?limit=2&cursor=${encode({ createdAt: '2000-01-01T00:00:00.000Z', id: 1 })}`);
      expect(past.body).toEqual({ items: [], hasNext: false, nextCursor: null });
    });
  });
});

describe('축 ⑨ — 학생 파일', () => {
  it('🔴 code/p3-32 에서 바뀐 학생 파일', () => {
    // 🔀 2026-11-08 p3-34 — HEAD 를 읽으면 뒤 회차가 바꾼 파일까지 센다. 북마크가 있으면 그 판을 읽는다.
    const changed = execFileSync('git', ['diff', '--name-only', 'code/p3-32', ROUND.fromBookmark ? 'code/p3-33' : 'HEAD', '--', '.', ':(exclude)test', ':(exclude)lab', ':(exclude)snapshots'], { cwd: P('.'), encoding: 'utf8' }).trim().split('\n').sort();
    expect(changed).toEqual([
      'prisma/migrations/20261106135135_add_posts_feed_index/migration.sql',
      'prisma/schema.prisma',
      'requests/cursor.http',
      'routes/posts.js',
      'schemas/postSchema.js',
      'services/postService.js',
    ]);
    expect(read(R('db.js'))).toBe(read(B('db.js')));
  });

  it('🔴 교안의 수업 코드 블록 — 줄마다 그 파일에 실재한다', () => {
    const owners = {
      '// ~/instagram-api/services/postService.js': [read(R('services/postService.js')), read(SNAP('step6.postService.js')), read(B('services/postService.js'))],
      '// ~/instagram-api/routes/posts.js': [read(R('routes/posts.js')), read(SNAP('step6.posts-route.js'))],
      '// ~/instagram-api/schemas/postSchema.js': [read(R('schemas/postSchema.js'))],
    };
    let seen = 0;
    for (const f of fences(LECTURE()).filter((one) => one.lang === 'javascript')) {
      const [head, ...lines] = f.body.split('\n');
      if (!owners[head]) continue;
      seen += 1;
      const hay = owners[head].join('\n');
      for (const line of lines.filter((one) => one.trim() !== '' && one.trim() !== '...')) {
        expect(hay, `L${f.line}: ${line}`).toContain(line);
      }
    }
    expect(seen).toBeGreaterThanOrEqual(6);
  });

  it('🔴 요청 파일 — Step 6 블록 + Step 7 이 더한 요청이 파일과 byte 같다', () => {
    const http = fences(LECTURE()).filter((f) => f.lang === 'http');
    const step6 = http.find((f) => f.body.includes('# @name first')).body;
    const step7 = http.find((f) => f.body.startsWith('### 2번 게시물 지우기')).body;
    expect(read(R('requests/cursor.http'))).toBe(`${step6}\n\n${step7}\n`);
  });

  it('🔴 답안 — 코드 블록 줄 실재 · 요청 파일 byte 같다 · 실행 계획은 축 ⑧ 에서 잰 값', () => {
    const answers = fences(ANSWERS());
    const owners = { 'homework1.js': LAB_FILE('homework1.js'), 'homework2.js': LAB_FILE('homework2.js') };
    let seen = 0;
    for (const f of answers.filter((one) => one.lang === 'javascript')) {
      const name = f.body.split('\n')[0].split('/').at(-1);
      expect(owners[name], name).toBeDefined();
      seen += 1;
      for (const line of f.body.split('\n').filter((one) => one.trim() !== '')) expect(owners[name], line).toContain(line);
    }
    expect(seen).toBe(2);
    expect(answers.some((f) => f.lang === 'http' && f.body === LAB_FILE('homework1.http').trimEnd())).toBe(true);
    expect(answers.some((f) => f.lang === 'http' && f.body === LAB_FILE('homework2.http').trimEnd())).toBe(true);
  });

  it('🔴 Step 4 의 인용 — 무한 스크롤 회차의 답안에 축자로 있다', () => {
    const answer = read(P('../../part3/2-react-query/p3-16-infinite-scroll-answers.md'));
    const quote = LECTURE().split('\n').find((line) => line.startsWith('> 커서 방식은')).slice(2);
    expect(answer).toContain(quote);
  });
});
