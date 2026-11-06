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

// ───────── 축 ⑩ — 실습·과제: 정답 판 · 확인 절차가 틀린 판을 가려낸다 ─────────
const LAB = (name) => P(`lab/p3-32/${name}`);
const SNAP = (name) => P(`snapshots/p3-32.${name}`);
const lab = (name) => read(LAB(name));

/** 학생 폴더 모양(errors.js · middlewares/methods.js · lab/p3-32/)의 임시 폴더에서 실습 서버를 띄운다. */
const withLab = async ({ src, labPort, port }, fn) => {
  const dir = mkdtempSync(join(tmpdir(), 'p332-lab-'));
  mkdirSync(join(dir, 'lab', 'p3-32'), { recursive: true });
  mkdirSync(join(dir, 'middlewares'), { recursive: true });
  cpSync(R('errors.js'), join(dir, 'errors.js'));
  cpSync(R('middlewares/methods.js'), join(dir, 'middlewares', 'methods.js'));
  writeFileSync(join(dir, 'package.json'), '{"type":"module"}');
  symlinkSync(P('node_modules'), join(dir, 'node_modules'));
  writeFileSync(join(dir, 'lab', 'p3-32', 'server.js'), src.replaceAll(String(labPort), String(port)));
  const srv = await boot(join(dir, 'lab', 'p3-32', 'server.js'), { port, cwd: dir, ready: `${port}번 포트에서` });
  try {
    await fn(srv);
  } finally {
    await Promise.race([srv.stop(), sleep(500)]);
    rmSync(dir, { recursive: true, force: true });
  }
};

/** .http 파일을 요청 목록으로 읽는다(### 제목 · 요청 줄 · 헤더 · 본문). 포트는 바꿔 보낸다. */
const httpRequests = (text) => text.split(/^### /m).filter((x) => x.trim()).map((chunk) => {
  const lines = chunk.split('\n');
  const title = lines[0].trim();
  const [method, url] = lines[1].split(' ');
  const blank = lines.indexOf('', 2);
  const headers = Object.fromEntries(lines.slice(2, blank === -1 ? undefined : blank).filter((l) => l.includes(':')).map((l) => l.split(/:\s*/)));
  const body = blank === -1 ? undefined : lines.slice(blank + 1).join('\n').trim() || undefined;
  return { title, method, url, headers, body };
});
const sendAll = async (text, labPort, port) => {
  const out = [];
  for (const r of httpRequests(text)) {
    const res = await fetch(r.url.replace(`:${labPort}`, `:${port}`), { method: r.method, headers: r.headers, body: r.body });
    const raw = await res.text();
    const type = res.headers.get('content-type') ?? '';
    out.push({ title: r.title, status: res.status, allow: res.headers.get('allow'), location: res.headers.get('location'), type, raw,
      body: type.includes('json') && raw !== '' ? JSON.parse(raw) : raw });
  }
  return out;
};
const statuses = (results) => results.map((r) => r.status);

describe('축 ⑩ — 직접 해보기 1: 공지 서버의 주소 고치기', () => {
  const P1 = 3771;
  it('🔴 정답 판 — 일곱 요청 200 · 200 · 200 · 201 · 200 · 404 · 404 · 목록 3개 · 고정된 것 1·3 · 옛 주소는 Express HTML 404', async () => {
    await withLab({ src: lab('practice1.js'), labPort: 4001, port: P1 }, async () => {
      const r = await sendAll(lab('practice1.http'), 4001, P1);
      expect(statuses(r)).toEqual([200, 200, 200, 201, 200, 404, 404]);
      expect(r[0].body).toHaveLength(3);
      expect(r[1].body.map((n) => n.id)).toEqual([1, 3]);
      expect(r[6].raw).toContain('Cannot GET /api/getNotices');
    });
  });

  it('🔴 처음 판(교안의 뼈대) — 새 주소는 하나도 없다', async () => {
    await withLab({ src: read(SNAP('practice1-start.practice1.js')), labPort: 4001, port: P1 }, async () => {
      const r = await sendAll(lab('practice1.http'), 4001, P1);
      expect(statuses(r).slice(0, 6)).toEqual([404, 404, 404, 404, 404, 404]);
      expect(r[6].status).toBe(200);
    });
  });

  it('🔴 틀린 판 셋 — 고정된 것을 /pinned 경로로(둘째 요청에 3개) · 번호를 req.query 로(셋째 404) · 옛 주소를 남김(마지막 200)', async () => {
    const answer = lab('practice1.js');
    const pinnedPath = rep(
      rep(answer, "  if (req.query.pinned === 'true') {\n    res.json(notices.filter((notice) => notice.pinned));\n    return;\n  }\n\n", ''),
      "app.post('/api/notices'",
      "app.get('/api/notices/pinned', (req, res) => {\n  res.json(notices.filter((notice) => notice.pinned));\n});\n\napp.post('/api/notices'");
    await withLab({ src: pinnedPath, labPort: 4001, port: P1 }, async (srv) => {
      const r = await sendAll(lab('practice1.http'), 4001, P1);
      expect(r[1].body).toHaveLength(3);
      // 해설의 주장 — :id 라우트가 위에 있으면 /pinned 를 공지 번호로 읽어 404
      expect((await send(srv.base, 'GET', '/api/notices/pinned')).status).toBe(404);
    });
    const queryId = rep(answer, "app.get('/api/notices/:id', (req, res) => {\n  const notice = notices.find((one) => one.id === Number(req.params.id));",
      "app.get('/api/notices/:id', (req, res) => {\n  const notice = notices.find((one) => one.id === Number(req.query.id));");
    await withLab({ src: queryId, labPort: 4001, port: P1 }, async () => {
      expect((await sendAll(lab('practice1.http'), 4001, P1))[2].status).toBe(404);
    });
    // 해설의 주장 — 지우기에서 req.body.id 를 남기면 다섯째 요청이 500(본문 없는 DELETE 의 req.body 는 undefined)
    const bodyId = rep(answer, "const index = notices.findIndex((one) => one.id === Number(req.params.id));",
      "const index = notices.findIndex((one) => one.id === Number(req.body.id));");
    await withLab({ src: bodyId, labPort: 4001, port: P1 }, async (srv) => {
      expect((await sendAll(lab('practice1.http'), 4001, P1))[4].status).toBe(500);
      await sleep(100);
      expect(srv.tail()).toContain("TypeError: Cannot read properties of undefined (reading 'id')");
    });
    const keepOld = rep(answer, "app.listen(4001", "app.get('/api/getNotices', (req, res) => {\n  res.json(notices);\n});\n\napp.listen(4001");
    await withLab({ src: keepOld, labPort: 4001, port: P1 }, async () => {
      expect((await sendAll(lab('practice1.http'), 4001, P1))[6].status).toBe(200);
    });
  });
});

describe('축 ⑩ — 직접 해보기 2: 공지 서버에 405 붙이기', () => {
  const P2 = 3772;
  // 직접 해보기 1 의 정답을 복사해 경로 주석과 포트만 바꾼 판 — 요구사항 1·2
  const before = () => rep(lab('practice1.js'), '// ~/instagram-api/lab/p3-32/practice1.js', '// ~/instagram-api/lab/p3-32/practice2.js').replaceAll('4001', '4002');

  it('🔴 빈칸을 넣기 전 — Express 가 OPTIONS 에 200 + Allow: DELETE, GET, HEAD (본문도 같은 글자)', async () => {
    await withLab({ src: before(), labPort: 4002, port: P2 }, async (srv) => {
      const res = await send(srv.base, 'OPTIONS', '/api/notices/1');
      expect(res.status).toBe(200);
      expect(res.headers.get('allow')).toBe('DELETE, GET, HEAD');
      expect(res.body).toBe('DELETE, GET, HEAD');
    });
  });

  it('🔴 정답 판 — OPTIONS 405 · PUT 405(GET, DELETE) · 목록 DELETE 405(GET, POST) · 목록 200 · 지우기 200 · 없는 주소 HTML 404', async () => {
    await withLab({ src: lab('practice2.js'), labPort: 4002, port: P2 }, async () => {
      const r = await sendAll(lab('practice2.http'), 4002, P2);
      expect(statuses(r)).toEqual([405, 405, 405, 200, 200, 404]);
      expect(r.map((x) => x.allow)).toEqual(['GET, DELETE', 'GET, DELETE', 'GET, POST', null, null, null]);
      expect(r[1].body).toEqual(NOT_ALLOWED);
      expect(r[5].raw).toContain('Cannot PATCH /api/notice');
    });
  });

  it('🔴 틀린 판 — /api/notices/:id 목록을 GET, POST 로 잘못 적으면 상태 코드는 같고 allow 만 다르다(요구사항 4 가 목록과 대조하게 한다)', async () => {
    const wrong = rep(lab('practice2.js'), "app.all('/api/notices/:id', allowOnly('GET', 'DELETE'));", "app.all('/api/notices/:id', allowOnly('GET', 'POST'));");
    await withLab({ src: wrong, labPort: 4002, port: P2 }, async () => {
      const r = await sendAll(lab('practice2.http'), 4002, P2);
      expect(statuses(r)).toEqual([405, 405, 405, 200, 200, 404]);
      expect(r[1].allow).toBe('GET, POST');
    });
  });

  it('🔴 틀린 판 — app.all 두 줄을 라우트 위에 두면 넷째 요청(목록)부터 405', async () => {
    const src = lab('practice2.js');
    const lines = "app.all('/api/notices', allowOnly('GET', 'POST'));\napp.all('/api/notices/:id', allowOnly('GET', 'DELETE'));\n";
    const above = rep(rep(src, lines, ''), "app.get('/api/notices', (req, res) => {", `${lines}\napp.get('/api/notices', (req, res) => {`);
    await withLab({ src: above, labPort: 4002, port: P2 }, async () => {
      expect(statuses(await sendAll(lab('practice2.http'), 4002, P2)).slice(3, 5)).toEqual([405, 405]);
    });
  });
});

describe('축 ⑩ — 직접 해보기 3: 상태 코드로 말하게 고치기', () => {
  const P3 = 3773;
  it('🔴 처음 판 — 여섯 요청이 모두 200', async () => {
    await withLab({ src: read(SNAP('practice3-start.practice3.js')), labPort: 4003, port: P3 }, async () => {
      expect(statuses(await sendAll(lab('practice3.http'), 4003, P3))).toEqual([200, 200, 200, 200, 200, 200]);
    });
  });

  it('🔴 정답 판 — 201 · 400 · 409 · 404 · 204 · 404 · Location /api/notices/3 · 본문은 공지 그대로 · 204 는 빈 본문', async () => {
    await withLab({ src: lab('practice3.js'), labPort: 4003, port: P3 }, async () => {
      const r = await sendAll(lab('practice3.http'), 4003, P3);
      expect(statuses(r)).toEqual([201, 400, 409, 404, 204, 404]);
      expect(r[0].location).toBe('/api/notices/3');
      expect(r[0].body).toEqual({ id: 3, title: '스터디 모집' });
      expect(r[1].body).toEqual({ message: '제목을 적어 주세요' });
      expect(r[4].raw).toBe('');
    });
  });

  it('🔴 틀린 판 둘 — Location 을 빠뜨린 판 · 성공 본문을 { ok, notice } 로 남긴 판은 상태 코드가 같아 요구사항 5 의 헤더·본문 확인으로만 갈린다', async () => {
    const noLocation = rep(lab('practice3.js'), 'res.status(201).location(`/api/notices/${notice.id}`).json(notice);', 'res.status(201).json(notice);');
    await withLab({ src: noLocation, labPort: 4003, port: P3 }, async () => {
      const r = await sendAll(lab('practice3.http'), 4003, P3);
      expect(statuses(r)).toEqual([201, 400, 409, 404, 204, 404]);
      expect(r[0].location).toBeNull();
    });
    const wrapped = rep(lab('practice3.js'), 'res.status(201).location(`/api/notices/${notice.id}`).json(notice);',
      'res.status(201).location(`/api/notices/${notice.id}`).json({ ok: true, notice });');
    await withLab({ src: wrapped, labPort: 4003, port: P3 }, async () => {
      const r = await sendAll(lab('practice3.http'), 4003, P3);
      expect(statuses(r)).toEqual([201, 400, 409, 404, 204, 404]);
      expect(r[0].body).toEqual({ ok: true, notice: { id: 3, title: '스터디 모집' } });
    });
  });

  it('🔴 해설의 주장 — 204 에 .json({ ok: true }) 를 남겨도 본문이 빈다', async () => {
    const src = rep(lab('practice3.js'), 'res.status(204).end();', 'res.status(204).json({ ok: true });');
    await withLab({ src, labPort: 4003, port: P3 }, async () => {
      expect((await sendAll(lab('practice3.http'), 4003, P3))[4]).toMatchObject({ status: 204, raw: '' });
    });
  });
});

describe('축 ⑩ — 과제 [기초]: 저장 API', () => {
  const H1 = 3774;
  it('🔴 정답 판 — 아홉 요청 201 · 200 · 201 · 200 · 200 · 200 · 200 · 404 · 405 · 목록 [1, 3] → [3]', async () => {
    await withLab({ src: lab('homework1.js'), labPort: 4011, port: H1 }, async () => {
      const r = await sendAll(lab('homework1.http'), 4011, H1);
      expect(statuses(r)).toEqual([201, 200, 201, 200, 200, 200, 200, 404, 405]);
      expect(r[3].body.map((p) => p.id)).toEqual([1, 3]);
      expect(r[6].body.map((p) => p.id)).toEqual([3]);
      expect(r[7].body).toEqual({ message: '그런 게시물은 없어요' });
      expect(r[8].allow).toBe('PUT, DELETE');
    });
  });

  it('🔴 틀린 판 — 누를 때마다 뒤집는 판은 넷째 요청 목록에서 1번이 빠진다 · app.all 을 위에 두면 첫 요청부터 405', async () => {
    const src = lab('homework1.js');
    const toggle = rep(src,
      "  if (saves.some((save) => save.postId === post.id && save.userId === userId)) {\n    res.json({ saved: true });\n    return;\n  }",
      "  const index = saves.findIndex((save) => save.postId === post.id && save.userId === userId);\n  if (index !== -1) {\n    saves.splice(index, 1);\n    res.json({ saved: false });\n    return;\n  }");
    await withLab({ src: toggle, labPort: 4011, port: H1 }, async () => {
      expect((await sendAll(lab('homework1.http'), 4011, H1))[3].body.map((p) => p.id)).toEqual([3]);
    });
    const lines = "app.all('/api/users/:userId/saves', allowOnly('GET'));\napp.all('/api/posts/:postId/saves/:userId', allowOnly('PUT', 'DELETE'));\n";
    const above = rep(rep(src, lines, ''), '// 내가 저장한 게시물 목록', `${lines}\n// 내가 저장한 게시물 목록`);
    await withLab({ src: above, labPort: 4011, port: H1 }, async () => {
      expect((await sendAll(lab('homework1.http'), 4011, H1))[0].status).toBe(405);
    });
  });
});

describe('축 ⑩ — 과제 [응용]: 문제 상세', () => {
  const H2 = 3775;
  const PROBLEM = 'application/problem+json; charset=utf-8';
  it('🔴 정답 판 — 성공은 JSON 그대로 · 실패 다섯은 problem+json · 다섯 멤버 · 405 의 Allow', async () => {
    await withLab({ src: lab('homework2.js'), labPort: 4012, port: H2 }, async () => {
      const r = await sendAll(lab('homework2.http'), 4012, H2);
      expect(statuses(r)).toEqual([200, 404, 404, 405, 404, 400]);
      expect(r[0].type).toBe('application/json; charset=utf-8');
      expect(r.slice(1).map((x) => x.type)).toEqual([PROBLEM, PROBLEM, PROBLEM, PROBLEM, PROBLEM]);
      expect(r[1].body).toEqual({ type: 'about:blank', title: 'Not Found', status: 404, detail: '그런 공지는 없어요', instance: '/api/notices/99' });
      expect(r[3].allow).toBe('GET, DELETE');
      expect(r[3].body.title).toBe('Method Not Allowed');
      expect(r[4].body).toMatchObject({ detail: '그런 주소는 없어요', instance: '/api/notice' });
      expect(r[5].body).toMatchObject({ title: 'Bad Request', detail: '보낸 내용을 읽을 수 없어요' });
    });
  });

  it('🔴 틀린 판 둘 — 라우트 안 res.status(404).json 을 남기면 둘째 요청이 application/json · 상태를 HttpError 에서만 꺼내면 깨진 JSON 이 500', async () => {
    const src = lab('homework2.js');
    const direct = rep(src, "  if (!notice) {\n    throw new NotFoundError('그런 공지는 없어요');\n  }",
      "  if (!notice) {\n    res.status(404).json({ message: '그런 공지는 없어요' });\n    return;\n  }");
    await withLab({ src: direct, labPort: 4012, port: H2 }, async () => {
      const r = await sendAll(lab('homework2.http'), 4012, H2);
      expect(r[1]).toMatchObject({ status: 404, type: 'application/json; charset=utf-8', body: { message: '그런 공지는 없어요' } });
    });
    const onlyHttp = rep(src, 'const status = err.status ?? 500;', 'const status = err instanceof HttpError ? err.status : 500;');
    await withLab({ src: onlyHttp, labPort: 4012, port: H2 }, async () => {
      expect((await sendAll(lab('homework2.http'), 4012, H2))[5]).toMatchObject({ status: 500, body: { detail: '서버에서 문제가 생겼어요' } });
    });
  });
});

// ───────── 축 ⑫ — 교안·답안 코드 블록 ─────────
const TRACK = new URL('../../part3/6-api-design/', ROOT).pathname;
const LECTURE = join(TRACK, 'p3-32-rest-uri-design-lecture.md');
const ANSWERS = join(TRACK, 'p3-32-rest-uri-design-answers.md');
const fences = (md, lang) => [...md.matchAll(/^```(\w*)\n([\s\S]*?)^```$/gm)].filter((m) => m[1] === lang).map((m) => m[2].replace(/\n$/, ''));
const versionsOf = (path) => {
  const map = {
    'errors.js': [read(R('errors.js'))],
    'middlewares/methods.js': [read(R('middlewares/methods.js'))],
    'routes/posts.js': [read(R('routes/posts.js'))],
    'routes/likes.js': [read(R('routes/likes.js'))],
    'routes/auth.js': [read(R('routes/auth.js'))],
    'routes/uploads.js': [read(R('routes/uploads.js'))],
    'lab/p3-32/practice1.js': [read(SNAP('practice1-start.practice1.js')), lab('practice1.js')],
    'lab/p3-32/practice3.js': [read(SNAP('practice3-start.practice3.js')), lab('practice3.js')],
  };
  if (map[path]) return map[path];
  if (path.startsWith('lab/p3-32/')) return [lab(path.slice('lab/p3-32/'.length))];
  throw new Error(`경로 주석의 파일을 모릅니다: ${path}`);
};
const inOrder = (block, source) => {
  const src = source.split('\n');
  let at = 0;
  for (const line of block.split('\n')) {
    if (line.trim() === '...' || line.trim() === '') continue;
    const re = new RegExp('^' + line.split('____').map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.+') + '$');
    while (at < src.length && !re.test(src[at])) at += 1;
    if (at === src.length) return false;
    at += 1;
  }
  return true;
};
const looseCorpus = () => ['practice1.js', 'practice2.js', 'practice3.js', 'homework1.js', 'homework2.js'].map(lab);

describe('축 ⑫ — 교안·답안 코드 블록의 줄이 코드베이스에 차례대로 있다', () => {
  for (const [name, file] of [['교안', LECTURE], ['답안', ANSWERS]]) {
    it(`🔴 ${name} — 경로 주석이 있는 javascript 블록은 그 파일의 어느 판에 차례대로 있다`, () => {
      const bad = [];
      for (const b of fences(read(file), 'javascript')) {
        const m = b.match(/^\/\/ ~\/instagram-api\/(\S+)\n/);
        if (!m) continue;
        if (!versionsOf(m[1]).some((v) => inOrder(b.slice(m[0].length), v))) bad.push(b.split('\n').slice(0, 3).join(' ⏎ '));
      }
      expect(bad).toEqual([]);
    });

    it(`🔴 ${name} — 경로 주석이 없는 javascript 블록은 실습·과제 정답 판에 차례대로 있다`, () => {
      const bad = [];
      for (const b of fences(read(file), 'javascript')) {
        if (/^\/\/ ~\//.test(b)) continue;
        if (!looseCorpus().some((v) => inOrder(b, v))) bad.push(b.split('\n').slice(0, 2).join(' ⏎ '));
      }
      expect(bad).toEqual([]);
    });

    it(`🔴 ${name} — http 블록은 수업 requests/rest.http 나 실습 .http 파일에 그대로 있다`, () => {
      const https = [read(R('requests/rest.http')), ...['practice1.http', 'practice2.http', 'practice3.http', 'homework1.http', 'homework2.http'].map(lab)];
      const bad = fences(read(file), 'http').filter((b) => !https.some((h) => h.includes(b)));
      expect(bad).toEqual([]);
    });
  }

  it('🔴 교안 Step 1 — grep 두 명령의 출력이 code/p3-31 학생 파일에서 뽑은 것과 같다(BSD·GNU grep 은 인자 차례대로)', () => {
    const md = read(LECTURE);
    const bash = fences(md, 'bash');
    const routes = ['routes/auth.js', 'routes/likes.js', 'routes/posts.js', 'routes/uploads.js'];
    const expectRoutes = routes.flatMap((f) => read(B(f)).split('\n').map((line, i) => [line, i + 1])
      .filter(([line]) => /^router\.(get|post|put|patch|delete)\('/.test(line))
      .map(([line, n]) => `${f}:${n}:${line.match(/^router\.(?:get|post|put|patch|delete)\('[^']*'/)[0]}`)).join('\n');
    expect(bash).toContain(expectRoutes);
    const expectApp = read(B('app.js')).split('\n').map((line, i) => [line, i + 1]).filter(([line]) => line.includes("app.use('/api"))
      .map(([line, n]) => `${n}:${line}`).join('\n');
    expect(bash).toContain(expectApp);
  });

  it('🔴 교안 Step 1 표 — 주소 14줄의 HTTP 메서드·주소가 TARGETS 와 같다', () => {
    const table = read(LECTURE).split('\n').filter((l) => /^ (GET|POST|PUT|PATCH|DELETE) +\/api\//.test(l))
      .map((l) => l.trim().split(/\s+/).slice(0, 2).join(' '));
    const fromTargets = TARGETS.flatMap(({ path, allow }) => allow.map((m) => `${m} ${path.replace('/999/likes/1', '/:id/likes/:userId').replace('/999/likes', '/:id/likes').replace('/999', '/:id')}`));
    expect([...new Set(table)].sort()).toEqual([...new Set(fromTargets)].sort());
  });
});
