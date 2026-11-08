// p3-34 「계약 바꾸기와 남기기 — 버저닝 · 문서화」 게이트 — 백엔드
//
// `6-api-design` 셋째 회차다(`curriculum.md` 「`p3-34` 착수 결정」 — 캐싱은 `p3-35` 로 나눴다).
// 수업 백엔드에서 바뀌는 학생 파일 — 새 `middlewares/legacyCursor.js` · `services/postService.js`(`cursorOf`) ·
// `routes/posts.js`(목록에 `legacyCursor`) · `requests/cursor.http` 끝 요청 · 새 `docs/openapi.js` ·
// `app.js`(`/api/docs` · `/api/openapi.json`) · `package.json`(`swagger-ui-express`).
//
// 축 ① Step 1 — 앞 판(code/p3-33)은 옛 화면의 숫자 커서에 400
// 축 ② Step 2 — 옛 커서를 지금 커서로 바꿔 준다 · 커서였던 게시물이 지워졌으면 빈 목록
// 축 ③ Step 3 — 옛 커서 응답에만 Deprecation · Sunset
// 축 ④ Step 4 — 실습 서버 lab/p3-34/notices.js 의 v1 · v2
// 축 ⑤ Step 5~7 — 문서(손으로 쓴 판 · Swagger UI · 스키마에서 뽑은 판)
// 축 ⑥ 직접 해보기 · 과제 — 정답 판 · 틀린 판
// 축 ⑦ 학생 파일 — code/p3-33 에서 바뀐 파일 · 교안 코드 블록 줄 실재
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
const GATE_DB = 'p334_gate';
const GATE_URL = `postgresql://postgres:postgres@localhost:5432/${GATE_DB}`;
const PORT = 3811;

const ROUND = roundDir('code/p3-34');
const R = (rel) => join(ROUND.dir, rel);
const BEFORE = roundDir('code/p3-33');
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
const STUDENT_FILES = ['app.js', 'db.js', 'errors.js', 'routes', 'services', 'middlewares', 'schemas', 'docs', 'package.json', 'requests'];

/** overrides: { '상대 경로': 내용 | null(지우기) } · from: 어느 판에서 복사할지(기본 이 회차) */
const withServer = async (port, overrides, fn, from = R) => {
  const dir = mkdtempSync(join(tmpdir(), 'p334-srv-'));
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

/** 옛 화면(파트2 usePosts)처럼 «마지막 게시물의 번호» 를 커서로 보내며 끝까지 내려간다 */
const walkOld = async (base, query = 'limit=2') => {
  const pages = [];
  let cursor = null;
  for (let turn = 0; turn < 50; turn += 1) {
    const path = `/api/posts?${query}${cursor === null ? '' : `&cursor=${cursor}`}`;
    const res = await send(base, 'GET', path);
    pages.push(res);
    if (res.status !== 200 || !res.body.hasNext) return pages;
    cursor = res.body.items.at(-1).id;
  }
  throw new Error('50번을 내려가도 끝나지 않아요');
};
const ids = (pages) => pages.flatMap((page) => page.body.items.map((post) => post.id));
const BAD_CURSOR = { message: '커서 값이 올바르지 않아요' };

describe('축 ① — Step 1: 앞 판은 옛 화면의 숫자 커서에 400', () => {
  it('🔴 code/p3-33 — 첫 페이지 200 · cursor=2 는 400 «커서 값이 올바르지 않아요»', async () => {
    reseed();
    await withServer(PORT, {}, async (before) => {
      const pages = await walkOld(before.base);
      expect(pages.map((page) => page.status)).toEqual([200, 400]);
      expect(pages[0].body.items.map((post) => post.id)).toEqual([1, 2]);
      expect(pages[1].body).toEqual(BAD_CURSOR);
    }, B);
  });
});

describe('축 ② — Step 2: 옛 커서도 받는다', () => {
  it('🔴 옛 화면처럼 번호를 보내며 내려가도 게시물 5개가 최신순으로 한 번씩', async () => {
    reseed();
    await withServer(PORT, {}, async (now) => {
      const pages = await walkOld(now.base);
      expect(pages.map((page) => page.status)).toEqual([200, 200, 200]);
      expect(ids(pages)).toEqual([1, 2, 3, 4, 5]);
    });
  });

  it('🔴 cursor=2 의 응답은 지금 커서(nextCursor)로 받은 둘째 페이지와 같다', async () => {
    reseed();
    await withServer(PORT, {}, async (now) => {
      const first = (await send(now.base, 'GET', '/api/posts?limit=2')).body;
      const viaNew = (await send(now.base, 'GET', `/api/posts?limit=2&cursor=${first.nextCursor}`)).body;
      const viaOld = (await send(now.base, 'GET', '/api/posts?limit=2&cursor=2')).body;
      expect(viaOld).toEqual(viaNew);
    });
  });

  it('🔴 커서였던 게시물이 지워졌으면 빈 목록(옛 서버와 같다) — 첫 페이지를 다시 주지 않는다', async () => {
    reseed();
    await withServer(PORT, {}, async (now) => {
      expect((await send(now.base, 'DELETE', '/api/posts/2')).status).toBe(200);
      expect((await send(now.base, 'GET', '/api/posts?limit=2&cursor=2')).body).toEqual({ items: [], hasNext: false, nextCursor: null });
    });
  });

  it('🔴 없는 번호(999)도 지워진 게시물과 같다 — 빈 목록', async () => {
    reseed();
    await withServer(PORT, {}, async (now) => {
      expect((await send(now.base, 'GET', '/api/posts?limit=2&cursor=999')).body).toEqual({ items: [], hasNext: false, nextCursor: null });
    });
  });

  it('🔴 Step 2 첫 판(없는 경우를 안 본 판) — 없는 번호에 첫 페이지가 다시 온다 · 지워진 커서는 1번이 또 온다', async () => {
    reseed();
    await withServer(PORT, { 'middlewares/legacyCursor.js': read(P('snapshots/p3-34.step2-first.legacyCursor.js')) }, async (now) => {
      expect((await send(now.base, 'GET', '/api/posts?limit=2&cursor=999')).body.items.map((post) => post.id)).toEqual([1, 2]);
      expect((await send(now.base, 'DELETE', '/api/posts/2')).status).toBe(200);
      const res = await send(now.base, 'GET', '/api/posts?limit=2&cursor=2');
      expect(res.body.items.map((post) => post.id)).toEqual([1, 3]);
    });
  });

  it('🔴 Step 2 판(헤더 전) — 스냅숏은 끝 판에서 헤더 세 줄(주석 · set 둘)과 상수 셋만 뺀 것', () => {
    const now = read(R('middlewares/legacyCursor.js')).split('\n');
    const step2 = read(P('snapshots/p3-34.step2.legacyCursor.js')).split('\n');
    const removed = now.filter((line) => !step2.includes(line));
    expect(removed.filter((line) => line.trim() !== '')).toEqual([
      '// 옛 커서를 언제부터 쓰지 말라고 했는지와, 언제부터 받지 않을지.',
      "const DEPRECATED_AT = new Date('2026-12-01T00:00:00Z');",
      "const SUNSET_AT = new Date('2027-03-01T00:00:00Z');",
      '  // 옛 커서로 온 요청에만 알린다 — 이 방식은 곧 사라지니 새 커서로 옮기라고.',
      "  res.set('Deprecation', `@${DEPRECATED_AT.getTime() / 1000}`);",
      "  res.set('Sunset', SUNSET_AT.toUTCString());",
    ]);
  });

  it('🔴 숫자가 아니거나 10자리가 넘으면 옛 커서로 보지 않는다 — 400 그대로 · 지금 커서는 그대로 동작', async () => {
    reseed();
    await withServer(PORT, {}, async (now) => {
      for (const cursor of ['abc', '2a', '-2', '1e3', '12345678901']) {
        const res = await send(now.base, 'GET', `/api/posts?limit=2&cursor=${cursor}`);
        expect([cursor, res.status, res.body]).toEqual([cursor, 400, BAD_CURSOR]);
      }
      const first = (await send(now.base, 'GET', '/api/posts?limit=2')).body;
      expect((await send(now.base, 'GET', `/api/posts?limit=2&cursor=${first.nextCursor}`)).body.items.map((post) => post.id)).toEqual([3, 4]);
    });
  });

  it('🔴 ?username= 과 함께 보낸 옛 커서도 그 사람의 목록에서 이어진다', async () => {
    reseed();
    await withServer(PORT, {}, async (now) => {
      const all = (await send(now.base, 'GET', '/api/posts?limit=5')).body.items;
      const name = all[0].username;
      const own = all.filter((post) => post.username === name).map((post) => post.id);
      expect(ids(await walkOld(now.base, `limit=1&username=${name}`))).toEqual(own);
    });
  });
});

describe('축 ③ — Step 3: Deprecation · Sunset', () => {
  it('🔴 옛 커서 응답에만 두 헤더 — Deprecation @1796083200(2026-12-01) · Sunset Mon, 01 Mar 2027', async () => {
    reseed();
    await withServer(PORT, {}, async (now) => {
      const old = await send(now.base, 'GET', '/api/posts?limit=2&cursor=2');
      expect(old.headers.get('deprecation')).toBe('@1796083200');
      expect(old.headers.get('sunset')).toBe('Mon, 01 Mar 2027 00:00:00 GMT');
      expect(new Date(old.headers.get('sunset')).getTime() / 1000).toBeGreaterThan(1796083200);
      const first = await send(now.base, 'GET', '/api/posts?limit=2');
      const next = await send(now.base, 'GET', `/api/posts?limit=2&cursor=${first.body.nextCursor}`);
      for (const res of [first, next]) {
        expect(res.headers.get('deprecation')).toBeNull();
        expect(res.headers.get('sunset')).toBeNull();
      }
    });
  });

  it('🔴 지워진 커서의 빈 목록에도 두 헤더가 붙는다', async () => {
    reseed();
    await withServer(PORT, {}, async (now) => {
      expect((await send(now.base, 'DELETE', '/api/posts/2')).status).toBe(200);
      const res = await send(now.base, 'GET', '/api/posts?limit=2&cursor=2');
      expect(res.headers.get('deprecation')).toBe('@1796083200');
    });
  });

  it('🔴 로거 줄에 옛 커서 요청이 그대로 찍힌다(세는 법)', async () => {
    reseed();
    await withServer(PORT, {}, async (now) => {
      await send(now.base, 'GET', '/api/posts?limit=2&cursor=2');
      await sleep(200);
      expect(now.tail()).toMatch(/GET \/api\/posts\?limit=2&cursor=2 200 [\d.]+ms/);
    });
  });
});
