// p3-32 「REST 와 URI 설계 — 제약 조건 · URI 규칙 · HTTP 메서드 · 상태 코드」 게이트 — 백엔드
//
// `6-api-design` 첫 회차다(`curriculum.md` 「`p3-32` 착수 결정」). 수업 백엔드에서 바뀌는 학생 파일 —
// `errors.js`(MethodNotAllowedError) · 새 `middlewares/methods.js`(allowOnly) · 라우터 넷(`router.all(경로, allowOnly(…))`
// 를 라우트 «아래») · `routes/posts.js`(201 에 Location) · 새 `requests/rest.http`.
// 주소 · 응답 본문 · 성공 상태 코드는 그대로다(착수 결정 ② — 계약을 안 깨는 것만).
//
// 축 ① Step 1 — 라우트 목록을 grep 으로 뽑은 출력
// 축 ④ Step 4 — 대문자 주소 · 끝 슬래시 주소도 같은 게시물(앞 판과 끝 판 둘 다)
// 축 ⑤ Step 5 — HEAD 는 GET 라우트가 답한다(본문 없음)
// 축 ⑥ Step 6 — 앞 판은 404 «그런 주소는 없어요» · 끝 판은 405 + Allow · Allow 와 실제로 받는 HTTP 메서드가 맞는다 ·
//               allowOnly 를 라우트 «위» 에 둔 판은 받는 요청까지 405
// 축 ⑦ Step 7 — 201 + Location · 그 주소로 GET 하면 같은 게시물 · 앞 판은 Location 없음
// 축 ⑨ 수업 백엔드 — code/p3-31 과 같은 요청에 같은 응답
// 축 ⑪ 이 회차 학생 파일 — code/p3-31 에서 바뀐 파일
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, mkdtempSync, rmSync, cpSync, symlinkSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import pg from 'pg';
import { boot } from './helpers/boot.js';
import { roundDir } from './helpers/round.js';
import { P235_MIGRATIONS } from '../sql/p2-36/setup.mjs';

const ROOT = new URL('../', import.meta.url);
const P = (rel) => new URL(rel, ROOT).pathname;
const ADMIN = { host: 'localhost', port: 5432, database: 'postgres', user: 'postgres', password: 'postgres' };
const GATE_DB = 'p332_gate';
const GATE_URL = `postgresql://postgres:postgres@localhost:5432/${GATE_DB}`;
const STUDENT_ORIGIN = 'http://localhost:3001';
const PORT = 3770;
const SIGNUP_MIGRATION = '20261029031804_add_user_signup_fields';

const read = (p) => readFileSync(p, 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 학생 파일은 이 회차 북마크 `code/p3-32` 을 풀어서 읽는다(없으면 작업트리 — 이 회차를 짓는 동안).
const ROUND = roundDir('code/p3-32');
const R = (rel) => join(ROUND.dir, rel);
const BEFORE = roundDir('code/p3-31');
const B = (rel) => join(BEFORE.dir, rel);

const rep = (src, a, b) => {
  if (src.split(a).length !== 2) throw new Error(`바꿀 글자가 정확히 한 번 있어야 해요: ${a}`);
  return src.replace(a, b);
};

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
const plain = ({ status, body }) => ({ status, body });

// ───────── 수업 백엔드 — 학생 폴더 모양의 임시 폴더에서 띄운다 ─────────
let db = null;
const env = { DATABASE_URL: GATE_URL, CORS_ORIGIN: STUDENT_ORIGIN };
const STUDENT_FILES = ['app.js', 'db.js', 'errors.js', 'routes', 'services', 'middlewares', 'schemas', 'package.json', 'requests'];

/** overrides: { '상대 경로': 내용 | null(지우기) } · from: 어느 판에서 복사할지(기본 이 회차) */
const withServer = async (port, overrides, fn, from = R) => {
  const dir = mkdtempSync(join(tmpdir(), 'p332-srv-'));
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
  for (const dir of [...P235_MIGRATIONS, SIGNUP_MIGRATION]) {
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

// 주소마다 «받는 HTTP 메서드» — 교안 Step 1 의 표 · Step 6 의 Allow 와 같아야 한다.
// 요청은 무엇도 바꾸지 않게 고른다(없는 번호 · 검사에 걸리는 본문).
const TARGETS = [
  { path: '/api/posts', allow: ['GET', 'POST'] },
  { path: '/api/posts/999', allow: ['GET', 'PATCH', 'DELETE'] },
  { path: '/api/posts/999/likes', allow: ['GET'] },
  { path: '/api/posts/999/likes/1', allow: ['PUT', 'DELETE'] },
  { path: '/api/auth/signup', allow: ['POST'] },
  { path: '/api/auth/check-duplicate', allow: ['GET'] },
  { path: '/api/auth/login', allow: ['POST'] },
  { path: '/api/auth/me', allow: ['GET'] },
  { path: '/api/auth/logout', allow: ['POST'] },
  { path: '/api/uploads', allow: ['POST'] },
];
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const NOT_ALLOWED = { message: '이 주소는 그 HTTP 메서드를 받지 않아요' };
const WRONG_ADDRESS = { message: '그런 주소는 없어요' };
const bodyFor = (method) => (['POST', 'PUT', 'PATCH'].includes(method) ? { json: {} } : {});

describe('축 ⑥ — Step 6: 주소는 있는데 그 HTTP 메서드를 안 받을 때', () => {
  it('🔴 앞 판(code/p3-31) — 좋아요를 POST 로 보내면 404 «그런 주소는 없어요» · Allow 없음', async () => {
    reseed();
    await withServer(PORT + 1, {}, async (before) => {
      const res = await send(before.base, 'POST', '/api/posts/1/likes/2');
      expect(plain(res)).toEqual({ status: 404, body: WRONG_ADDRESS });
      expect(res.headers.get('allow')).toBeNull();
    }, B);
  });

  it('🔴 끝 판 — 좋아요를 POST 로 보내면 405 + Allow: PUT, DELETE · 좋아요 숫자는 그대로', async () => {
    reseed();
    await withServer(PORT, {}, async (now) => {
      const before = (await send(now.base, 'GET', '/api/posts/1')).body.likeCount;
      const res = await send(now.base, 'POST', '/api/posts/1/likes/2');
      expect(plain(res)).toEqual({ status: 405, body: NOT_ALLOWED });
      expect(res.headers.get('allow')).toBe('PUT, DELETE');
      expect((await send(now.base, 'GET', '/api/posts/1')).body.likeCount).toBe(before);
    });
  });

  it('🔴 끝 판 — 주소 열 곳 × HTTP 메서드 다섯: Allow 에 든 것은 405 가 아니고, 빠진 것은 405 + 같은 Allow', async () => {
    reseed();
    await withServer(PORT, {}, async (now) => {
      for (const { path, allow } of TARGETS) {
        for (const method of METHODS) {
          const res = await send(now.base, method, path, bodyFor(method));
          if (allow.includes(method)) {
            expect(res.status, `${method} ${path}`).not.toBe(405);
            expect(res.body, `${method} ${path}`).not.toEqual(WRONG_ADDRESS);
          } else {
            expect(plain(res), `${method} ${path}`).toEqual({ status: 405, body: NOT_ALLOWED });
            expect(res.headers.get('allow'), `${method} ${path}`).toBe(allow.join(', '));
          }
        }
      }
    });
  });

  it('🔴 끝 판 — 정말 없는 주소는 그대로 404 «그런 주소는 없어요» · 번호가 아닌 게시물은 405 보다 먼저 404', async () => {
    reseed();
    await withServer(PORT, {}, async (now) => {
      expect(plain(await send(now.base, 'POST', '/api/comments', { json: {} }))).toEqual({ status: 404, body: WRONG_ADDRESS });
      expect(plain(await send(now.base, 'GET', '/api/posts/1/likes/2/x'))).toEqual({ status: 404, body: WRONG_ADDRESS });
      expect(plain(await send(now.base, 'PUT', '/api/posts/abc', { json: {} }))).toEqual({ status: 404, body: { message: '그런 게시물은 없어요' } });
    });
  });

  it('🔴 HEAD 는 GET 을 받는 주소에서 405 가 아니다 · OPTIONS 는 cors 가 먼저 204', async () => {
    reseed();
    await withServer(PORT, {}, async (now) => {
      expect((await send(now.base, 'HEAD', '/api/posts/1')).status).toBe(200);
      expect((await send(now.base, 'HEAD', '/api/auth/login')).status).toBe(405);
      const opt = await send(now.base, 'OPTIONS', '/api/posts/1/likes/2');
      expect(opt.status).toBe(204);
      expect(opt.headers.get('allow')).toBeNull();
    });
  });

  it('🔴 ⚠️ allowOnly 줄을 라우트 «위» 로 올린 판 — 받던 GET 까지 405', async () => {
    reseed();
    const src = read(R('routes/likes.js'));
    const above = rep(
      rep(src, "router.all('/:userId', allowOnly('PUT', 'DELETE'));\n", ''),
      "router.get('/', async (req, res) => {",
      "router.all('/:userId', allowOnly('PUT', 'DELETE'));\n\nrouter.get('/', async (req, res) => {",
    );
    const aboveAll = rep(
      rep(above, "router.all('/', allowOnly('GET'));\n", ''),
      "router.all('/:userId', allowOnly('PUT', 'DELETE'));\n\nrouter.get(",
      "router.all('/', allowOnly('GET'));\nrouter.all('/:userId', allowOnly('PUT', 'DELETE'));\n\nrouter.get(",
    );
    await withServer(PORT + 2, { 'routes/likes.js': aboveAll }, async (srv) => {
      const list = await send(srv.base, 'GET', '/api/posts/1/likes');
      expect(plain(list)).toEqual({ status: 405, body: NOT_ALLOWED });
      expect(list.headers.get('allow')).toBe('GET');
      expect((await send(srv.base, 'PUT', '/api/posts/1/likes/2')).status).toBe(405);
    });
  });
});

describe('축 ⑦ — Step 7: 201 에 Location', () => {
  const NEW_POST = { authorId: 3, content: '새 글', imageUrls: ['https://picsum.photos/seed/p332/600/600'] };

  it('🔴 앞 판 — 201 인데 Location 이 없다', async () => {
    reseed();
    await withServer(PORT + 1, {}, async (before) => {
      const res = await send(before.base, 'POST', '/api/posts', { json: NEW_POST });
      expect(res.status).toBe(201);
      expect(res.headers.get('location')).toBeNull();
    }, B);
  });

  it('🔴 끝 판 — 201 + Location: /api/posts/{새 번호} · 그 주소로 GET 하면 같은 게시물 · 본문은 앞 판과 같은 모양', async () => {
    reseed();
    await withServer(PORT, {}, async (now) => {
      const res = await send(now.base, 'POST', '/api/posts', { json: NEW_POST });
      expect(res.status).toBe(201);
      expect(res.headers.get('location')).toBe(`/api/posts/${res.body.id}`);
      const again = await send(now.base, 'GET', res.headers.get('location'));
      expect(again.status).toBe(200);
      expect(again.body).toEqual(res.body);
    });
  });
});

describe('축 ④ — Step 4: 대문자 주소 · 끝 슬래시', () => {
  it('🔴 /API/POSTS/1 · /api/posts/1/ 도 /api/posts/1 과 같은 200 (앞 판 · 끝 판 둘 다)', async () => {
    reseed();
    for (const from of [B, R]) {
      await withServer(PORT + 3, {}, async (srv) => {
        const base = plain(await send(srv.base, 'GET', '/api/posts/1'));
        expect(base.status).toBe(200);
        expect(plain(await send(srv.base, 'GET', '/API/POSTS/1'))).toEqual(base);
        expect(plain(await send(srv.base, 'GET', '/api/posts/1/'))).toEqual(base);
      }, from);
    }
  });
});

describe('축 ⑨ — 수업 백엔드: code/p3-31 과 같은 요청에 같은 응답', () => {
  const REQUESTS = [
    ['GET', '/api/posts'], ['GET', '/api/posts/2'], ['GET', '/api/posts/999'], ['GET', '/api/posts/abc'],
    ['GET', '/api/posts?username=minji'], ['GET', '/api/posts?limit=2'], ['GET', '/api/posts?userId=2&limit=2'],
    ['GET', '/api/posts/3/likes'], ['GET', '/api/nope'], ['GET', '/'], ['GET', '/api/auth/me'],
    ['GET', '/api/auth/check-duplicate?type=username&value=minji'],
  ];
  it('🔴 읽기 요청 열둘 — 상태와 본문이 같다', async () => {
    reseed();
    await withServer(PORT + 1, {}, async (before) => {
      await withServer(PORT, {}, async (now) => {
        for (const [method, path] of REQUESTS) {
          expect(plain(await send(now.base, method, path)), `${method} ${path}`).toEqual(plain(await send(before.base, method, path)));
        }
      });
    }, B);
  });
});

describe('축 ⑪ — 이 회차 학생 파일: code/p3-31 에서 바뀐 파일', () => {
  it('🔴 바뀐 파일은 errors.js · middlewares/methods.js(새) · 라우터 넷 · requests/rest.http(새) 뿐', () => {
    // 북마크가 있으면 두 북마크 사이를, 없으면(이 회차를 짓는 중) 작업트리를 본다 — 뒤 회차가 같은 파일을 고쳐도 안 흔들린다.
    const range = ROUND.fromBookmark ? ['code/p3-31', 'code/p3-32'] : ['code/p3-31'];
    const changed = execFileSync('git', ['diff', '--name-only', ...range, '--', '.', ':!test', ':!snapshots', ':!lab'], { cwd: P('.'), encoding: 'utf8' })
      .trim().split('\n').filter(Boolean).sort();
    const untracked = ROUND.fromBookmark ? [] : execFileSync('git', ['ls-files', '--others', '--exclude-standard', '--', '.', ':!test', ':!snapshots', ':!lab'], { cwd: P('.'), encoding: 'utf8' })
      .trim().split('\n').filter(Boolean);
    expect([...new Set([...changed, ...untracked])].sort()).toEqual([
      'errors.js', 'middlewares/methods.js', 'requests/rest.http',
      'routes/auth.js', 'routes/likes.js', 'routes/posts.js', 'routes/uploads.js',
    ]);
  });
});
