// p3-33 「커서 페이지네이션 — SQL 원리부터 트레이드오프까지」 게이트 — 백엔드
//
// `6-api-design` 둘째 회차다(`curriculum.md` 「`p3-33` 착수 결정」). 수업 백엔드에서 바뀌는 학생 파일 —
// `prisma/schema.prisma`(@@index) · 새 마이그레이션 · `services/postService.js`(keyset · 불투명 커서) ·
// `routes/posts.js` · `schemas/postSchema.js`(목록 쿼리 검사) · 새 `requests/cursor.http`.
//
// 축 ⑥ Step 6·7 — 끝 판의 목록 계약
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
  it('🔴 앞 판(Step 6) — 커서가 아닌 글자·옛 숫자 커서는 500', async () => {
    reseed();
    await withServer(PORT, STEP6, async (step6) => {
      for (const cursor of ['abc', '2']) {
        expect((await send(step6.base, 'GET', `/api/posts?limit=2&cursor=${cursor}`)).status, cursor).toBe(500);
      }
    });
  });

  it('🔴 끝 판 — 커서가 아닌 글자·옛 숫자 커서·모양이 틀린 커서는 400 «커서 값이 올바르지 않아요»', async () => {
    reseed();
    const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
    await withServer(PORT, {}, async (now) => {
      for (const cursor of ['abc', '2', encode({ id: 2 }), encode({ createdAt: '어제', id: 2 }), encode({ createdAt: '2026-01-01T00:00:00.000Z', id: '2' })]) {
        const res = await send(now.base, 'GET', `/api/posts?limit=2&cursor=${cursor}`);
        expect({ status: res.status, body: res.body }, cursor).toEqual({ status: 400, body: BAD_CURSOR });
      }
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
