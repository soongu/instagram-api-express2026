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
import { applyMigrationsAfter } from './helpers/tip-schema.js';

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
  // 🚨 2026-11-10 p3-39 — 작업트리 스키마에 users.password_hash 가 생겼다. 시드가 작업트리 클라이언트로 돌아 그 칸까지 고르므로
  //    (P2022) 이 회차의 마이그레이션 뒤로 tip 의 것을 얹는다. 이 회차의 학생 파일은 그 칸을 읽지도 쓰지도 않는다(test/helpers/tip-schema.js).
  await applyMigrationsAfter(db, '20261106135135_add_posts_feed_index');
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

// ── 실습 서버 — 사본을 임시 폴더에 두고 포트만 바꿔 띄운다(실습 포트를 다른 세션이 쥐고 있을 수 있다)
const LAB = (name) => read(R(`lab/p3-34/${name}`));
const withLab = async (src, labPort, port, fn) => {
  const dir = mkdtempSync(join(tmpdir(), 'p334-lab-'));
  symlinkSync(P('node_modules'), join(dir, 'node_modules'));
  const body = src.replaceAll(`listen(${labPort}`, `listen(${port}`).replaceAll(`${labPort}번 포트`, `${port}번 포트`);
  writeFileSync(join(dir, 'server.js'), body);
  const srv = await boot(join(dir, 'server.js'), { port, cwd: dir, ready: `${port}번 포트에서` });
  try {
    await fn(srv);
  } finally {
    await Promise.race([srv.stop(), sleep(500)]);
    rmSync(dir, { recursive: true, force: true });
  }
};
const swap = (src, from, to) => {
  expect(src.split(from).length - 1, from).toBe(1);
  return src.replace(from, to);
};
const DEP = '@1796083200';

describe('축 ④ — Step 4: 공지 서버의 v1 · v2', () => {
  it('🔴 시작 판 — /api/notices 가 배열', async () => {
    await withLab(read(P('snapshots/p3-34.step4-start.notices.js')), 4010, 3812, async (srv) => {
      const res = await send(srv.base, 'GET', '/api/notices');
      expect(res.body.map((notice) => notice.id)).toEqual([1, 2, 3, 4]);
    });
  });

  it('🔴 끝 판 — v1 배열(헤더 둘) · v2 { pinned, items } · 버전 없는 옛 주소는 v1 그대로(헤더도)', async () => {
    await withLab(LAB('notices.js'), 4010, 3812, async (srv) => {
      const v1 = await send(srv.base, 'GET', '/api/v1/notices');
      const old = await send(srv.base, 'GET', '/api/notices');
      const v2 = await send(srv.base, 'GET', '/api/v2/notices');
      expect(Array.isArray(v1.body)).toBe(true);
      expect(old.body).toEqual(v1.body);
      for (const res of [v1, old]) {
        expect(res.headers.get('deprecation')).toBe(DEP);
        expect(res.headers.get('sunset')).toBe('Mon, 01 Mar 2027 00:00:00 GMT');
      }
      expect(v2.headers.get('deprecation')).toBeNull();
      expect(v2.body.pinned.map((notice) => notice.id)).toEqual([1, 3]);
      expect(v2.body.items.map((notice) => notice.id)).toEqual([2, 4]);
    });
  });

  it('🔴 틀린 판 — app.use(\'/api\', v1) 을 빼면 옛 주소가 404', async () => {
    const src = swap(LAB('notices.js'), "app.use('/api', v1);\n", '');
    await withLab(src, 4010, 3812, async (srv) => {
      expect((await send(srv.base, 'GET', '/api/notices')).status).toBe(404);
    });
  });
});

describe('축 ⑤ — Step 5~7: 문서', () => {
  it('🔴 /api/openapi.json — 3.2.0 · 목록 쿼리 넷(셋은 스키마에서 · userId 는 손으로) · 올리기 본문은 스키마에서', async () => {
    reseed();
    await withServer(PORT, {}, async (now) => {
      const { body: doc } = await send(now.base, 'GET', '/api/openapi.json');
      expect(doc.openapi).toBe('3.2.0');
      const params = doc.paths['/api/posts'].get.parameters;
      expect(params.map((param) => param.name)).toEqual(['limit', 'cursor', 'username', 'userId']);
      expect(params[0].schema).toEqual({ type: 'integer', minimum: 1, maximum: 50 });
      expect(params[0].description).toBe('한 페이지의 게시물 수 — 없으면 5');
      const body = doc.paths['/api/posts'].post.requestBody.content['application/json'].schema;
      expect(body.required).toEqual(['authorId', 'imageUrls']);
      expect(body.properties.imageUrls).toEqual({ minItems: 1, type: 'array', items: { type: 'string', minLength: 1 } });
    });
  });

  it('🔴 /api/docs — 301 뒤 Swagger UI 페이지 · init 스크립트에 문서가 담겨 있다', async () => {
    await withServer(PORT, {}, async (now) => {
      const first = await fetch(`${now.base}/api/docs`, { redirect: 'manual' });
      expect([first.status, first.headers.get('location')]).toEqual([301, '/api/docs/']);
      const page = await send(now.base, 'GET', '/api/docs/');
      expect(page.body).toContain('<title>Swagger UI</title>');
      const init = await send(now.base, 'GET', '/api/docs/swagger-ui-init.js');
      expect(init.body).toContain('"openapi": "3.2.0"');
      expect(init.body).toContain('"summary": "게시물 목록"');
    });
  });

  it('🔴 손으로 쓴 응답 스키마의 필드가 실제 응답의 키와 같다(목록 · 게시물 하나)', async () => {
    reseed();
    await withServer(PORT, {}, async (now) => {
      const { body: doc } = await send(now.base, 'GET', '/api/openapi.json');
      const page = (await send(now.base, 'GET', '/api/posts?limit=2&userId=1')).body;
      expect(Object.keys(doc.components.schemas.PostPage.properties).sort()).toEqual(Object.keys(page).sort());
      expect(Object.keys(doc.components.schemas.Post.properties).sort()).toEqual(Object.keys(page.items[0]).sort());
      const post = (await send(now.base, 'GET', '/api/posts/1')).body;
      expect(Object.keys(post).sort()).toEqual(Object.keys(doc.components.schemas.Post.properties).sort());
    });
  });

  const LIMIT20 = (src) => swap(src, '.max(50)', '.max(20)');

  it('🔴 Step 6 어긋남 — 손으로 쓴 문서(Step 5 판)는 상한을 20 으로 줄여도 50 이라고 말하고, 서버는 30 에 400', async () => {
    reseed();
    const step6Schema = LIMIT20(read(B('schemas/postSchema.js')));
    const step6Route = read(B('routes/posts.js')).replace(
      "router.get('/', validateQuery(postListQuerySchema), async (req, res) => {",
      "router.get('/', validateQuery(postListQuerySchema), legacyCursor, async (req, res) => {").replace(
      "import { allowOnly } from '../middlewares/methods.js';\n",
      "import { allowOnly } from '../middlewares/methods.js';\nimport { legacyCursor } from '../middlewares/legacyCursor.js';\n");
    await withServer(PORT, {
      'docs/openapi.js': read(P('snapshots/p3-34.step5.openapi.js')),
      'schemas/postSchema.js': step6Schema,
      'routes/posts.js': step6Route,
    }, async (now) => {
      const { body: doc } = await send(now.base, 'GET', '/api/openapi.json');
      expect(doc.paths['/api/posts'].get.parameters[0].schema.maximum).toBe(50);
      const res = await send(now.base, 'GET', '/api/posts?limit=30');
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('보낸 내용이 규칙에 안 맞아요');
      expect(res.body.details.properties.limit.errors).toEqual(['Too big: expected number to be <=20']);
    });
  });

  it('🔴 Step 7 — 스키마에서 뽑은 문서는 상한 20 을 따라온다 · 50 으로 되돌리면 문서도 50', async () => {
    reseed();
    await withServer(PORT, { 'schemas/postSchema.js': LIMIT20(read(R('schemas/postSchema.js'))) }, async (now) => {
      const { body: doc } = await send(now.base, 'GET', '/api/openapi.json');
      expect(doc.paths['/api/posts'].get.parameters[0].schema.maximum).toBe(20);
    });
  });

  it('🔴 Step 7 — username 을 스키마로 옮겨도 받던 요청은 그대로 · 두 번 보내면 400 · userId=abc 는 여전히 200 liked:false', async () => {
    reseed();
    await withServer(PORT, {}, async (now) => {
      const all = (await send(now.base, 'GET', '/api/posts?limit=5')).body.items;
      const name = all[0].username;
      const own = (await send(now.base, 'GET', `/api/posts?limit=5&username=${name}`)).body.items;
      expect(own.map((post) => post.id)).toEqual(all.filter((post) => post.username === name).map((post) => post.id));
      expect((await send(now.base, 'GET', '/api/posts?username=minji&username=dahye')).status).toBe(400);
      const res = await send(now.base, 'GET', '/api/posts?limit=2&userId=abc');
      expect(res.status).toBe(200);
      expect(res.body.items.every((post) => post.liked === false)).toBe(true);
    });
  });

  it('🔴 앞 판 — username 을 두 번 보내면 500(Prisma 가 배열을 못 받는다)', async () => {
    reseed();
    await withServer(PORT, {}, async (before) => {
      expect((await send(before.base, 'GET', '/api/posts?username=minji&username=dahye')).status).toBe(500);
    }, B);
  });

  it('🔴 userId 에 검사를 더하면 받던 요청이 400 — 그래서 손으로 남긴다', async () => {
    reseed();
    const strict = swap(read(R('schemas/postSchema.js')),
      "  username: z.string().optional().describe('이 사람이 올린 게시물만'),\n",
      "  username: z.string().optional().describe('이 사람이 올린 게시물만'),\n  userId: z.coerce.number().int().positive().optional(),\n");
    await withServer(PORT, { 'schemas/postSchema.js': strict }, async (now) => {
      expect((await send(now.base, 'GET', '/api/posts?limit=2&userId=abc')).status).toBe(400);
    });
  });
});

describe('축 ⑥ — 직접 해보기', () => {
  it('🔴 1 정답 판 — keyword · q · 둘 다(keyword) · 없음 400', async () => {
    await withLab(LAB('practice1.js'), 4001, 3813, async (srv) => {
      const names = async (q) => (await send(srv.base, 'GET', `/api/members/search${q}`)).body.map((m) => m.username);
      expect(await names('?keyword=min')).toEqual(['minji', 'minsu']);
      expect(await names('?q=min')).toEqual(['minji', 'minsu']);
      expect(await names('?keyword=dahye&q=min')).toEqual(['dahye']);
      const none = await send(srv.base, 'GET', '/api/members/search');
      expect([none.status, none.body]).toEqual([400, { message: '검색어를 보내 주세요' }]);
    });
  });

  it('🔴 1 틀린 판 — req.query 에 넣으면 사라져 q 가 400 · 순서를 뒤집으면 둘 다 보낸 요청이 q 로', async () => {
    const lost = swap(LAB('practice1.js'), '  res.locals.keyword = req.query.keyword ?? req.query.q;\n',
      '  req.query.keyword = req.query.keyword ?? req.query.q;\n  res.locals.keyword = req.query.keyword;\n');
    await withLab(lost, 4001, 3813, async (srv) => {
      expect((await send(srv.base, 'GET', '/api/members/search?q=min')).status).toBe(400);
      expect((await send(srv.base, 'GET', '/api/members/search?keyword=dahye')).status).toBe(200);
    });
    const flipped = swap(LAB('practice1.js'), 'req.query.keyword ?? req.query.q', 'req.query.q ?? req.query.keyword');
    await withLab(flipped, 4001, 3813, async (srv) => {
      const res = await send(srv.base, 'GET', '/api/members/search?keyword=dahye&q=min');
      expect(res.body.map((m) => m.username)).toEqual(['minji', 'minsu']);
    });
  });

  it('🔴 2 정답 판 — v1 이름 글자 · v2 { family, given } · 옛 주소 v1(헤더 둘) · 없는 회원 404', async () => {
    await withLab(LAB('practice2.js'), 4002, 3814, async (srv) => {
      const v1 = await send(srv.base, 'GET', '/api/v1/members/2');
      const v2 = await send(srv.base, 'GET', '/api/v2/members/2');
      const old = await send(srv.base, 'GET', '/api/members/2');
      expect(v1.body).toEqual({ id: 2, username: 'minji', name: '이민지' });
      expect(v2.body).toEqual({ id: 2, username: 'minji', name: { family: '이', given: '민지' } });
      expect(old.body).toEqual(v1.body);
      expect([v1, old].map((res) => res.headers.get('deprecation'))).toEqual([DEP, DEP]);
      expect(v2.headers.get('deprecation')).toBeNull();
      for (const path of ['/api/v2/members/9', '/api/v1/members/9']) {
        const missing = await send(srv.base, 'GET', path);
        expect([path, missing.status, missing.body]).toEqual([path, 404, { message: '그런 회원은 없어요' }]);
      }
    });
  });

  it('🔴 2 틀린 판 — 헤더를 app.use(\'/api/v1\') 에 걸면 옛 주소에는 헤더가 없다', async () => {
    let src = swap(LAB('practice2.js'), 'v1.use((req, res, next) => {', "app.use('/api/v1', (req, res, next) => {");
    await withLab(src, 4002, 3814, async (srv) => {
      expect((await send(srv.base, 'GET', '/api/v1/members/2')).headers.get('deprecation')).toBe(DEP);
      const old = await send(srv.base, 'GET', '/api/members/2');
      expect([old.status, old.headers.get('deprecation')]).toEqual([200, null]);
    });
  });

  it('🔴 3 정답 판 — 문서의 title 은 1~50 · pinned 쿼리는 enum · 스키마를 30 으로 바꾸면 문서도 30', async () => {
    await withLab(LAB('practice3.js'), 4003, 3815, async (srv) => {
      const { body: doc } = await send(srv.base, 'GET', '/openapi.json');
      expect(doc.paths['/api/notices'].get.parameters).toEqual([{ name: 'pinned', in: 'query', description: 'true 면 고정 공지만, false 면 고정 안 한 공지만', required: false, schema: { type: 'string', enum: ['true', 'false'] } }]);
      expect(doc.paths['/api/notices'].post.requestBody.content['application/json'].schema.properties.title).toEqual({ type: 'string', minLength: 1, maxLength: 50, description: '공지 제목' });
      expect((await send(srv.base, 'GET', '/docs/')).body).toContain('Swagger UI');
      expect((await send(srv.base, 'POST', '/api/notices', { json: { title: 'x'.repeat(51) } })).status).toBe(400);
      expect((await send(srv.base, 'GET', '/api/notices?pinned=true')).body.map((n) => n.id)).toEqual([1]);
    });
    await withLab(swap(LAB('practice3.js'), '.max(50)', '.max(30)'), 4003, 3815, async (srv) => {
      const { body: doc } = await send(srv.base, 'GET', '/openapi.json');
      expect(doc.paths['/api/notices'].post.requestBody.content['application/json'].schema.properties.title.maxLength).toBe(30);
    });
  });

  it('🔴 3 시작 판 — 문서 없이 뜬다 · /docs 는 404', async () => {
    await withLab(read(P('snapshots/p3-34.practice3-start.practice3.js')), 4003, 3815, async (srv) => {
      expect((await send(srv.base, 'GET', '/docs/')).status).toBe(404);
      expect((await send(srv.base, 'GET', '/api/notices')).body).toHaveLength(2);
    });
  });
});

describe('축 ⑥ — 과제', () => {
  it('🔴 [기초] 정답 판 — content 와 body 가 같은 값 · 문서의 body 는 deprecated · 없는 공지 404', async () => {
    await withLab(LAB('homework1.js'), 4011, 3816, async (srv) => {
      const res = await send(srv.base, 'GET', '/api/notices/1');
      expect(Object.keys(res.body)).toEqual(['id', 'title', 'content', 'body']);
      expect(res.body.body).toBe(res.body.content);
      const { body: doc } = await send(srv.base, 'GET', '/openapi.json');
      const schema = doc.paths['/api/notices/{id}'].get.responses[200].content['application/json'].schema;
      expect(schema.properties.body.deprecated).toBe(true);
      expect(schema.required).toEqual(['id', 'title', 'content', 'body']);
      expect((await send(srv.base, 'GET', '/api/notices/9')).status).toBe(404);
    });
  });

  it('🔴 [기초] 시작 판 — body 만 있다', async () => {
    await withLab(read(P('snapshots/p3-34.homework1-start.homework1.js')), 4011, 3816, async (srv) => {
      expect(Object.keys((await send(srv.base, 'GET', '/api/notices/1')).body)).toEqual(['id', 'title', 'body']);
    });
  });

  const MEMO = (src) => swap(src, "{ id: 1, title: '서버 점검 안내', content:", "{ id: 1, memo: '관리자만 보는 메모', title: '서버 점검 안내', content:");
  it('🔴 [기초] 요구사항 5 의 메모 확인 — parse 를 거치면 데이터에 더한 memo 가 응답에 안 온다', async () => {
    await withLab(MEMO(LAB('homework1.js')), 4011, 3816, async (srv) => {
      expect(Object.keys((await send(srv.base, 'GET', '/api/notices/1')).body)).toEqual(['id', 'title', 'content', 'body']);
    });
  });

  it('🔴 [기초] 틀린 판 — parse 없이 보내면 메모가 응답에 새어 나간다(요구사항 5 가 가려낸다)', async () => {
    const noParse = swap(MEMO(LAB('homework1.js')), 'res.json(noticeSchema.parse({ ...notice, body: notice.content }));', 'res.json({ ...notice, body: notice.content });');
    await withLab(noParse, 4011, 3816, async (srv) => {
      expect((await send(srv.base, 'GET', '/api/notices/1')).body.memo).toBe('관리자만 보는 메모');
    });
  });

  it('🔴 [응용] 정답 판 — 문서에 두 주소 · v1 은 deprecated · v2 응답은 { pinned, items } · 서버 응답은 시작 판 그대로', async () => {
    await withLab(LAB('homework2.js'), 4012, 3817, async (srv) => {
      const { body: doc } = await send(srv.base, 'GET', '/openapi.json');
      expect(Object.keys(doc.paths)).toEqual(['/api/v1/notices', '/api/v2/notices']);
      expect(doc.paths['/api/v1/notices'].get.deprecated).toBe(true);
      expect(doc.paths['/api/v2/notices'].get.deprecated).toBeUndefined();
      const v1Schema = doc.paths['/api/v1/notices'].get.responses[200].content['application/json'].schema;
      const v2Schema = doc.paths['/api/v2/notices'].get.responses[200].content['application/json'].schema;
      expect(v1Schema.type).toBe('array');
      expect(v2Schema.required).toEqual(['pinned', 'items']);
      expect(v2Schema.properties.items.items.required).toEqual(['id', 'title', 'pinned']);
      const old = await send(srv.base, 'GET', '/api/notices');
      expect([old.headers.get('deprecation'), old.headers.get('sunset')]).toEqual([DEP, 'Mon, 01 Mar 2027 00:00:00 GMT']);
      expect(doc.paths['/api/v1/notices'].get.description).toBe('2027-03-01 에 끝나요. /api/v2/notices 로 옮기세요. 버전 없는 /api/notices 도 v1 이에요.');
      expect((await send(srv.base, 'GET', '/docs/')).body).toContain('Swagger UI');
    });
  });

  it('🔴 [응용] 시작 판 — notices.js 와 포트만 다르다', () => {
    const start = read(P('snapshots/p3-34.homework2-start.homework2.js'));
    expect(start.replace('homework2.js', 'notices.js').replaceAll('4012', '4010').replace('과제 서버', '공지 서버')).toBe(
      LAB('notices.js').replace(/\n\/\/ v1 으로 온 요청에는[^\n]*\n/, '\n').replace(/\/\/ v1 — [^\n]*\n/, '').replace(/\/\/ v2 — [^\n]*\n/, '').replace(/\/\/ 버전을 나누기 전의[^\n]*\n/, ''));
  });
});

const LECTURE = () => read(P('../../part3/6-api-design/p3-34-versioning-docs-lecture.md'));
const ANSWERS = () => read(P('../../part3/6-api-design/p3-34-versioning-docs-answers.md'));
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
const STEP6_SCHEMA = () => swap(read(B('schemas/postSchema.js')), '.max(50)', '.max(20)');

describe('축 ⑦ — 학생 파일과 교안 블록', () => {
  it('🔴 code/p3-33 에서 바뀐 학생 파일', () => {
    // 북마크가 생기면 그 판을 읽는다 — HEAD 를 읽으면 뒤 회차가 바꾼 파일까지 센다(p3-33 판정이 그랬다).
    const changed = execFileSync('git', ['diff', '--name-only', 'code/p3-33', ROUND.fromBookmark ? 'code/p3-34' : 'HEAD', '--', '.', ':(exclude)test', ':(exclude)lab', ':(exclude)snapshots'], { cwd: P('.'), encoding: 'utf8' }).trim().split('\n').sort();
    expect(changed).toEqual([
      'app.js',
      // check.js 는 p3-30 학생 검수(2026-11-08 · ec74a37)가 main 에서 지웠다 — 이 회차의 변경이 아니다.
      'check.js',
      'docs/openapi.js',
      'middlewares/legacyCursor.js',
      'package-lock.json',
      'package.json',
      'requests/cursor.http',
      // requests/uploads.http 는 p3-31 학생 검수(2026-11-08 · 3985bba)가 main 에서 고쳤다 — 이 회차의 변경이 아니다.
      'requests/uploads.http',
      'routes/posts.js',
      'schemas/postSchema.js',
      'services/postService.js',
    ]);
    expect(JSON.parse(read(R('package.json'))).dependencies['swagger-ui-express']).toBe('^5.0.1');
  });

  it('🔴 교안의 코드 블록 — 줄마다 그 파일(또는 그 Step 의 판)에 실재한다', () => {
    const react = execFileSync('git', ['show', 'main:src/hooks/usePosts.js'], { cwd: P('../instagram-react'), encoding: 'utf8' });
    const owners = {
      '// ~/instagram-api/services/postService.js': [read(R('services/postService.js'))],
      '// ~/instagram-api/middlewares/legacyCursor.js': [read(R('middlewares/legacyCursor.js')), read(P('snapshots/p3-34.step2-first.legacyCursor.js')), read(P('snapshots/p3-34.step2.legacyCursor.js'))],
      '// ~/instagram-api/routes/posts.js': [read(R('routes/posts.js'))],
      '// ~/instagram-api/app.js': [read(R('app.js')), read(P('snapshots/p3-34.step5.app.js'))],
      '// ~/instagram-api/docs/openapi.js': [read(R('docs/openapi.js')), read(P('snapshots/p3-34.step5.openapi.js'))],
      '// ~/instagram-api/schemas/postSchema.js': [read(R('schemas/postSchema.js')), STEP6_SCHEMA()],
      '// ~/instagram-api/lab/p3-34/notices.js': [LAB('notices.js'), read(P('snapshots/p3-34.step4-start.notices.js'))],
      '// ~/instagram-api/lab/p3-34/schema.js': [LAB('schema.js')],
      '// ~/instagram-api/lab/p3-34/practice1.js': [LAB('practice1.js')],
      '// ~/instagram-api/lab/p3-34/practice2.js': [LAB('practice2.js')],
      '// ~/instagram-api/lab/p3-34/practice3.js': [LAB('practice3.js')],
      '// ~/instagram-api/lab/p3-34/homework1.js': [read(P('snapshots/p3-34.homework1-start.homework1.js'))],
      '// ~/instagram-react/src/hooks/usePosts.js': [react],
    };
    let seen = 0;
    for (const f of fences(LECTURE()).filter((one) => one.lang === 'javascript')) {
      const [head, ...lines] = f.body.split('\n');
      if (!head.startsWith('// ~/')) {
        // 경로 주석이 없는 블록은 실습 데이터 배열 둘과, 파트2 화면의 Console 에 치는 지우기 한 줄 둘(Step 2 — 축 ⑧)뿐이다
        if (f.body.startsWith('fetch(')) {
          expect(f.body, `L${f.line}`).toMatch(/^fetch\('\/api\/posts\/\d+', \{ method: 'DELETE' \}\);$/);
          continue;
        }
        expect(f.body.startsWith('const members = ['), `L${f.line}`).toBe(true);
        expect(LAB('practice1.js') + LAB('practice2.js'), `L${f.line}`).toContain(f.body);
        continue;
      }
      expect(owners[head], `L${f.line}: ${head}`).toBeDefined();
      seen += 1;
      const hay = owners[head].join('\n');
      for (const line of lines.filter((one) => one.trim() !== '')) {
        expect(hay, `L${f.line}: ${line}`).toContain(line);
      }
    }
    expect(seen).toBeGreaterThanOrEqual(20);
  });

  it('🔴 교안의 요청 블록 — cursor.http 끝 두 요청 · notices.http 는 byte 같다', () => {
    const http = fences(LECTURE()).filter((f) => f.lang === 'http');
    expect(read(R('requests/cursor.http')).endsWith(`${http[0].body}\n`)).toBe(true);
    expect(`${http[1].body}\n`).toBe(LAB('notices.http'));
  });

  it('🔴 Step 7 — schema.js 를 Step 6 판 스키마로 실행한 출력이 교안 블록과 같다', () => {
    const dir = mkdtempSync(join(tmpdir(), 'p334-schema-'));
    try {
      symlinkSync(P('node_modules'), join(dir, 'node_modules'));
      mkdirSync(join(dir, 'schemas'));
      mkdirSync(join(dir, 'lab/p3-34'), { recursive: true });
      writeFileSync(join(dir, 'package.json'), '{ "type": "module" }');
      writeFileSync(join(dir, 'schemas/postSchema.js'), STEP6_SCHEMA());
      writeFileSync(join(dir, 'lab/p3-34/schema.js'), LAB('schema.js'));
      const out = execFileSync(process.execPath, ['lab/p3-34/schema.js'], { cwd: dir, encoding: 'utf8' });
      const block = fences(LECTURE()).find((f) => f.lang === 'json' && f.body.includes('"$schema"'));
      expect(out.trimEnd()).toBe(block.body);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('🔴 Step 6 — 교안의 400 본문 블록이 실제 응답과 같다(상한 20 · limit=30)', async () => {
    reseed();
    await withServer(PORT, { 'schemas/postSchema.js': swap(read(R('schemas/postSchema.js')), '.max(50)', '.max(20)') }, async (now) => {
      const res = await send(now.base, 'GET', '/api/posts?limit=30');
      const block = fences(LECTURE()).find((f) => f.lang === 'json' && f.body.includes('Too big'));
      expect(JSON.stringify(res.body, null, 2)).toBe(block.body);
    });
  });
});

describe('축 ⑦ — 답안 블록', () => {
  it('🔴 답안의 코드 블록 줄이 과제 파일에 실재하고, 요청 블록은 .http 와 byte 같다', () => {
    const blocks = fences(ANSWERS());
    let seen = 0;
    for (const f of blocks.filter((one) => one.lang === 'javascript')) {
      const name = f.body.split('\n')[0].split('/').at(-1);
      const owner = LAB(name);
      seen += 1;
      for (const line of f.body.split('\n').filter((one) => one.trim() !== '')) expect(owner, `${name}: ${line}`).toContain(line);
    }
    // homework2 는 두 블록(날짜 상수 · 문서)으로 나눠 싣는다
    expect(seen).toBe(3);
    const http = blocks.filter((f) => f.lang === 'http').map((f) => `${f.body}\n`);
    expect(http).toEqual([LAB('homework1.http'), LAB('homework2.http')]);
  });
});

// ── 축 ⑧ — 학생 상태(2026-11-09 학생 낭독 집중 검수)
// 지난 시간까지 교안을 따라온 학생의 수업 DB 에는 p3-32 Step 7 이 올린 게시물 7·8번이 있다(최신순 8·7·1·2·3·4·5).
// 교안의 번호·로그 줄은 이 상태로 적는다 — 시드 상태(1~5)로 적은 판은 학생 화면과 갈렸다(학생 낭독 FAIL 2).
// 🚨 (p3-41) 그 회차가 posts.http «게시물 올리기» 의 authorId 줄을 지웠다(글쓴이는 로그인 정보로) — 이 회차 학생이 보낸 판(code/p3-40)을 읽는다.
const httpBody = (file, title) => {
  const text = execFileSync('git', ['show', `code/p3-40:requests/${file}`], { cwd: P('.'), encoding: 'utf8' });
  const block = text.split('\n### ').find((one) => one.replace(/^### /, '').startsWith(`${title}\n`));
  return JSON.parse(block.slice(block.indexOf('{'), block.lastIndexOf('}') + 1));
};
/** 교안 언어 없는 펜스 중 needle 이 든 것의 줄을 «HTTP 메서드 · 주소 · 상태» 로 */
const logLines = (needle) => {
  const block = fences(LECTURE()).find((f) => f.lang === '' && f.body.includes(needle));
  expect(block, needle).toBeDefined();
  return block.body.split('\n').map((line) => line.split(' ').slice(0, 3).join(' '));
};
const studentState = async (base) => {
  await db.query("SELECT setval('posts_id_seq', 6)");
  const post = httpBody('rest.http', '게시물 올리기 — Location 보기');
  for (let n = 0; n < 2; n += 1) expect((await send(base, 'POST', '/api/posts', { json: post })).status).toBe(201);
};
/** 옛 화면이 «마지막 카드의 번호» 로 이어 가는 차례를 커서에서부터 끝까지 따라간다 */
const walkFrom = async (base, cursor) => {
  const pages = [];
  let next = cursor;
  while (next !== null) {
    const path = `/api/posts?limit=2&cursor=${next}`;
    const res = await send(base, 'GET', path);
    pages.push({ line: `GET ${path} ${res.status}`, ids: res.body.items.map((post) => post.id) });
    next = res.body.hasNext ? res.body.items.at(-1).id : null;
  }
  return pages;
};

describe('축 ⑧ — 학생 상태: 지난 시간까지 따라온 수업 DB 는 최신순 8·7·1·2·3·4·5', () => {
  it('🔴 오프닝·Step 1 — 앞 판에서 첫 페이지는 8·7 이고 옛 화면은 cursor=7 을 보내 400 · 교안 로그와 Network 문장이 그 번호', async () => {
    reseed();
    await withServer(PORT, {}, async (before) => {
      await studentState(before.base);
      const pages = await walkOld(before.base);
      expect(pages.map((page) => page.status)).toEqual([200, 400]);
      expect(pages[0].body.items.map((post) => post.id)).toEqual([8, 7]);
      expect(logLines('GET /api/posts?limit=2 200')).toEqual(['GET /api/posts?limit=2 200', 'GET /api/posts?limit=2&cursor=7 400']);
    }, B);
    const lecture = LECTURE();
    expect(lecture).toContain('`posts?limit=2&cursor=7` 요청이 빨간색 400');
    expect(lecture).not.toContain('시드 그대로라면');
  });

  it('🔴 Step 2 첫 판 — 옛 화면이 끝까지 내려가면 cursor=7·2·4 세 줄 · 999 에는 8번과 7번', async () => {
    reseed();
    await withServer(PORT, { 'middlewares/legacyCursor.js': read(P('snapshots/p3-34.step2-first.legacyCursor.js')) }, async (now) => {
      await studentState(now.base);
      const pages = await walkOld(now.base);
      expect(ids(pages)).toEqual([8, 7, 1, 2, 3, 4, 5]);
      const logs = pages.slice(1).map((page, index) => `GET /api/posts?limit=2&cursor=${pages[index].body.items.at(-1).id} ${page.status}`);
      expect(logLines('&cursor=2 200')).toEqual(logs);
      expect((await send(now.base, 'GET', '/api/posts?limit=2&cursor=2')).body.items.map((post) => post.id)).toEqual([3, 4]);
      expect((await send(now.base, 'GET', '/api/posts?limit=2&cursor=999')).body.items.map((post) => post.id)).toEqual([8, 7]);
    });
    expect(LECTURE()).toContain('999번 게시물은 없는데, 8번과 7번 게시물이 와요.');
  });

  it('🔴 Step 2 첫 판 — 둘째 카드(7번)를 지우고 내리면 8번이 한 번 더 붙어 게시물 6개에 카드 8장 · 교안 로그가 그 차례', async () => {
    reseed();
    await withServer(PORT, { 'middlewares/legacyCursor.js': read(P('snapshots/p3-34.step2-first.legacyCursor.js')) }, async (now) => {
      await studentState(now.base);
      const held = (await send(now.base, 'GET', '/api/posts?limit=2')).body.items.map((post) => post.id);
      expect(held).toEqual([8, 7]);
      expect((await send(now.base, 'DELETE', '/api/posts/7')).status).toBe(200);
      const pages = await walkFrom(now.base, 7);
      expect(pages.map((page) => page.ids)).toEqual([[8, 1], [2, 3], [4, 5]]);
      const cards = [...held, ...pages.flatMap((page) => page.ids)];
      // 화면의 카드는 8장(지워진 7번은 받아 둔 그대로 남는다) · 8번이 두 번 · DB 의 게시물은 6개
      expect(cards).toEqual([8, 7, 8, 1, 2, 3, 4, 5]);
      expect((await db.query('SELECT count(*)::int AS n FROM posts')).rows[0].n).toBe(6);
      expect(logLines('DELETE /api/posts/7 200')).toEqual(['DELETE /api/posts/7 200', ...pages.map((page) => page.line)]);
    });
    const lecture = LECTURE();
    expect(lecture).toContain("fetch('/api/posts/7', { method: 'DELETE' });");
    expect(lecture).toContain('게시물은 6개인데 카드는 8장이에요.');
  });

  it('🔴 Step 2 끝 판 — 9번을 올리고 둘째 카드(8번)를 지우고 내리면 cursor=8 한 줄이 빈 목록 · 교안 로그가 그 차례', async () => {
    reseed();
    await withServer(PORT, {}, async (now) => {
      await studentState(now.base);
      expect((await send(now.base, 'DELETE', '/api/posts/7')).status).toBe(200);
      const created = await send(now.base, 'POST', '/api/posts', { json: httpBody('posts.http', '게시물 올리기') });
      expect([created.status, created.body.id, created.body.content]).toEqual([201, 9, '제주 왔어요 🌊']);
      expect((await send(now.base, 'GET', '/api/posts?limit=2')).body.items.map((post) => post.id)).toEqual([9, 8]);
      expect((await send(now.base, 'DELETE', '/api/posts/8')).status).toBe(200);
      const pages = await walkFrom(now.base, 8);
      expect(pages).toEqual([{ line: 'GET /api/posts?limit=2&cursor=8 200', ids: [] }]);
      expect(logLines('DELETE /api/posts/8 200')).toEqual(['DELETE /api/posts/8 200', pages[0].line]);
      // Step 3 의 «옛 화면처럼 게시물 번호를 커서로 보내면» 은 이 상태(9·1·2·3·4·5)에서도 3번과 4번
      expect((await send(now.base, 'GET', '/api/posts?limit=2&cursor=2')).body.items.map((post) => post.id)).toEqual([3, 4]);
    });
    expect(LECTURE()).toContain("fetch('/api/posts/8', { method: 'DELETE' });");
  });

  it('🔴 Step 4 — v1.use 를 라우트 아래에 두면 v1 응답에 헤더가 안 붙는다 · 교안이 «라우트보다 위» 를 말한다', async () => {
    const block = "// v1 으로 온 요청에는 모두 알린다 — 이 라우터로 들어온 요청은 라우트보다 먼저 여기를 지난다.\nv1.use((req, res, next) => {\n  res.set('Deprecation', '@1796083200');\n  res.set('Sunset', 'Mon, 01 Mar 2027 00:00:00 GMT');\n  next();\n});\n";
    const below = swap(swap(LAB('notices.js'), block, ''), "app.use('/api/v1', v1);", `${block}\napp.use('/api/v1', v1);`);
    await withLab(below, 4010, 3812, async (srv) => {
      const res = await send(srv.base, 'GET', '/api/v1/notices');
      expect([res.status, res.headers.get('deprecation')]).toEqual([200, null]);
    });
    expect(LECTURE()).toContain('`v1.use`는 라우트보다 위에 둬요.');
  });

  it('🔴 직접 해보기 2 틀린 판 — app.use(\'/api\', v1) 을 맨 위에 두면 v2 응답에도 Deprecation · 요구사항 7 이 v2 헤더를 보게 한다', async () => {
    const top = swap(swap(LAB('practice2.js'), "app.use('/api', v1);\n", ''), "app.use('/api/v1', v1);", "app.use('/api', v1);\napp.use('/api/v1', v1);");
    await withLab(top, 4002, 3814, async (srv) => {
      const v2 = await send(srv.base, 'GET', '/api/v2/members/2');
      expect(v2.body).toEqual({ id: 2, username: 'minji', name: { family: '이', given: '민지' } });
      expect(v2.headers.get('deprecation')).toBe(DEP);
      expect((await send(srv.base, 'GET', '/api/members/2')).headers.get('deprecation')).toBe(DEP);
    });
    expect(LECTURE()).toContain('v2 응답에는 없는지까지 봐야 확인한 거예요.');
  });

  it('🔴 직접 해보기 1 — || 판도 요구사항 2~5 를 통과하고 ?keyword=&q=min 하나만 갈린다 · 해설이 그 사실을 말한다', async () => {
    const or = swap(LAB('practice1.js'), 'req.query.keyword ?? req.query.q', 'req.query.keyword || req.query.q');
    for (const [src, empty] of [[LAB('practice1.js'), 400], [or, 200]]) {
      await withLab(src, 4001, 3813, async (srv) => {
        const names = async (q) => (await send(srv.base, 'GET', `/api/members/search${q}`)).body.map((m) => m.username);
        expect(await names('?keyword=min')).toEqual(['minji', 'minsu']);
        expect(await names('?q=min')).toEqual(['minji', 'minsu']);
        expect(await names('?keyword=dahye&q=min')).toEqual(['dahye']);
        expect((await send(srv.base, 'GET', '/api/members/search')).status).toBe(400);
        expect((await send(srv.base, 'GET', '/api/members/search?keyword=&q=min')).status).toBe(empty);
      });
    }
    expect(LECTURE()).toContain('`?keyword=&q=min`');
  });

  it('🔴 Step 7 — 올리기 본문의 authorId 는 (0, 9007199254740991] · JSON 의 $schema 는 첫 키 · 교안이 Swagger UI 의 «맨 아래» 와 그 범위를 말한다', async () => {
    reseed();
    await withServer(PORT, {}, async (now) => {
      const { body: doc } = await send(now.base, 'GET', '/api/openapi.json');
      const body = doc.paths['/api/posts'].post.requestBody.content['application/json'].schema;
      expect(body.properties.authorId).toEqual({ type: 'integer', exclusiveMinimum: 0, maximum: 9007199254740991 });
      expect(Object.keys(body)[0]).toBe('$schema');
    });
    const lecture = LECTURE();
    expect(lecture).toContain('맨 아래의 `$schema` 줄');
    expect(lecture).toContain('`(0, 9007199254740991]`');
  });

  it('🔴 과제 [기초] 틀린 판 — body 를 .optional() 로 두고 parse 뒤에 붙이면 확인 넷은 같고 문서의 필수 필드에서만 갈린다 · 요구사항 5 가 필수(*)를 보게 한다', async () => {
    const withMemo = swap(LAB('homework1.js'), "{ id: 1, title: '서버 점검 안내', content:", "{ id: 1, memo: '관리자만 보는 메모', title: '서버 점검 안내', content:");
    const loose = swap(swap(withMemo,
      "  body: z.string().meta(", "  body: z.string().optional().meta("),
      'res.json(noticeSchema.parse({ ...notice, body: notice.content }));', 'res.json({ ...noticeSchema.parse(notice), body: notice.content });');
    await withLab(loose, 4011, 3816, async (srv) => {
      const res = await send(srv.base, 'GET', '/api/notices/1');
      expect(Object.keys(res.body)).toEqual(['id', 'title', 'content', 'body']);
      expect((await send(srv.base, 'GET', '/api/notices/9')).status).toBe(404);
      const { body: doc } = await send(srv.base, 'GET', '/openapi.json');
      const schema = doc.paths['/api/notices/{id}'].get.responses[200].content['application/json'].schema;
      expect(schema.properties.body.deprecated).toBe(true);
      expect(schema.required).toEqual(['id', 'title', 'content']);
    });
    expect(LECTURE()).toContain('네 필드가 모두 필수(`*`)인지');
  });

  it('🔴 앞 회차 잇기 · 주제 1 — L219 는 지난 시간 없는 번호 100006 에 · 봉투 예시는 p3-37 결정의 { data }·{ error }', () => {
    const lecture = LECTURE();
    const before = read(P('../../part3/6-api-design/p3-33-cursor-pagination-lecture.md'));
    expect(before).toContain('번호만 99980 대신 없는 번호인 100006으로 바꿔');
    expect(lecture).toContain('100006');
    expect(lecture).not.toContain('{ success, data }');
    expect(ANSWERS()).not.toContain('{ success, data }');
  });
});
