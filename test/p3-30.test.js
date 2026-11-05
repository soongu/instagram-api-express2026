// p3-30 「라우터 — 중복 제거 · 라우터 레벨 미들웨어 · 프로젝트 구조화」 게이트 — 백엔드
//
// `5-express-core` 넷째 회차다(`curriculum.md` 「`p3-30` 착수 결정」). 수업 백엔드에서 바뀌는 학생 파일 —
// `routes/posts.js`(router.param) · 새 `routes/likes.js`(mergeParams · router.use(parseId)) · 새
// `middlewares/params.js`(parseId · parseUserId) · `app.js`(likes 라우터를 `/api/posts/:id/likes` 에) ·
// `models/Post.js` 삭제 · `package.json`·`package-lock.json`(npm uninstall mongoose).
// 🔑 코드베이스는 mongoose 를 devDependencies 로 옮겼다 — Mongo 회차(p2-22~p2-26) 판정이 아직 부른다.
//    학생 package.json 에는 devDependencies 가 없다(판정 도구 전용 — 교안 0건).
// Step 2·3 의 router.use 장면과 실습·과제는 실습 서버 `lab/p3-30/` 에서 겪는다.
//
// 축 ① Step 1 — 라우터는 매개변수 셋짜리 함수
// 축 ② Step 2 — board.js: 구멍 판(역할 없이 숨기기 200) → router.use 판(403 · 없는 관리자 주소도 403)
// 축 ③ Step 3 — 같은 경로에 라우터 둘(공개 목록까지 403) → 끝 판
// 축 ④ Step 4 — parseId 를 빠뜨린 판은 어느 번호든 모든 게시물의 좋아요(200) · router.param 판은 앞 회차와 같은 응답
// 축 ⑤ Step 5 — router.param: 등록 차례와 상관없다 · 한 요청에 한 번 · router 패키지의 그 줄
// 축 ⑥ Step 6 — likes 라우터에 router.param('id') 를 적은 판: 목록은 모든 게시물 · PUT 500
// 축 ⑦ Step 7 — mergeParams 가 없는 판: 좋아요 요청 모두 404 · parseId 가 보는 req.params {} ↔ { id: '3' }
// 축 ⑧ Step 8 — Mongo 시절 파일 정리
// 축 ⑨ 수업 백엔드 — code/p3-29 와 같은 요청에 같은 응답
// 축 ⑩ 실습·과제 — 정답 판 · 확인 절차가 틀린 판을 가려낸다
// 축 ⑪ 이 회차 학생 파일 — code/p3-29 에서 바뀐 파일
// 축 ⑫ 교안·답안 코드 블록의 줄이 코드베이스에 실재한다
// 축 ⑬ 교안 🙋 · 답안의 주장
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, mkdtempSync, rmSync, cpSync, symlinkSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import pg from 'pg';
import express from 'express';
import { boot } from './helpers/boot.js';
import { roundDir } from './helpers/round.js';
import { P235_MIGRATIONS } from '../sql/p2-36/setup.mjs';

const ROOT = new URL('../', import.meta.url);
const P = (rel) => new URL(rel, ROOT).pathname;
const ADMIN = { host: 'localhost', port: 5432, database: 'postgres', user: 'postgres', password: 'postgres' };
const GATE_DB = 'p330_gate';
const GATE_URL = `postgresql://postgres:postgres@localhost:5432/${GATE_DB}`;
const STUDENT_ORIGIN = 'http://localhost:3001';
const PORT = 3702;
const SIGNUP_MIGRATION = '20261029031804_add_user_signup_fields';

const read = (p) => readFileSync(p, 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const git = (rev, path) => execFileSync('git', ['show', `${rev}:${path}`], { cwd: P('.'), encoding: 'utf8' });

// 학생 파일은 이 회차 북마크 `code/p3-30` 을 풀어서 읽는다(없으면 작업트리 — 이 회차를 짓는 동안).
const ROUND = roundDir('code/p3-30');
const R = (rel) => join(ROUND.dir, rel);
const BEFORE = roundDir('code/p3-29');
const B = (rel) => join(BEFORE.dir, rel);

const LAB = (name) => P(`lab/p3-30/${name}`);
const SNAP = (name) => P(`snapshots/p3-30.${name}`);
const rep = (src, a, b) => {
  if (src.split(a).length !== 2) throw new Error(`바꿀 글자가 정확히 한 번 있어야 해요: ${a}`);
  return src.replace(a, b);
};

const getJson = async (url, init) => {
  const res = await fetch(url, init);
  const type = res.headers.get('content-type') ?? '';
  const text = await res.text();
  // res.json(undefined) 는 JSON 머리글에 빈 본문을 보낸다 — 그때는 빈 글자 그대로
  return { status: res.status, body: type.includes('json') && text !== '' ? JSON.parse(text) : text };
};
const send = (base, method, path, { headers = {}, json } = {}) => getJson(`${base}${path}`, {
  method,
  headers: { ...headers, ...(json ? { 'Content-Type': 'application/json' } : {}) },
  body: json ? JSON.stringify(json) : undefined,
});

/** 그 서버가 지금까지 찍은 줄 중 «기다리고 있어요» 다음부터(스택의 at 줄은 뺀다). */
const linesAfterReady = (srv) => {
  const all = srv.tail().split('\n').filter((line) => line !== '' && !line.startsWith('    at '));
  return all.slice(all.findIndex((line) => line.includes('포트에서')) + 1);
};
const noMs = (line) => line.replace(/ \d+\.\dms$/, '');

// ───────── 실습 서버 — 학생 폴더 모양(lab/p3-30/ · 위로 두 단계에 middlewares/)으로 세운다 ─────────
// 🚨 실습 포트(4001~4003 · 4008 · 4011 · 4012)는 다른 세션의 실습 서버가 쥐고 있을 수 있어
//    사본의 포트 숫자를 판정 포트로 바꿔 띄운다(교안의 포트는 그대로다).
const studentLab = (files) => {
  const dir = mkdtempSync(join(tmpdir(), 'p330-lab-'));
  mkdirSync(join(dir, 'lab', 'p3-30'), { recursive: true });
  cpSync(R('middlewares'), join(dir, 'middlewares'), { recursive: true });
  cpSync(R('errors.js'), join(dir, 'errors.js'));
  writeFileSync(join(dir, 'package.json'), '{"type":"module"}');
  symlinkSync(P('node_modules'), join(dir, 'node_modules'));
  for (const [name, src] of Object.entries(files)) {
    mkdirSync(join(dir, 'lab', 'p3-30', name, '..'), { recursive: true });
    writeFileSync(join(dir, 'lab', 'p3-30', name), src);
  }
  return dir;
};
/** files: { 'board.js': 내용 } · entry: 띄울 파일 · labPort: 교안의 포트 · port: 판정 포트 */
const withLab = async ({ files, entry, labPort, port }, fn) => {
  const swapped = Object.fromEntries(Object.entries(files).map(([n, s]) => [n, s.replaceAll(String(labPort), String(port))]));
  const dir = studentLab(swapped);
  const srv = await boot(join(dir, 'lab', 'p3-30', entry), { port, ready: `${port}번 포트에서` });
  try {
    await fn(srv);
  } finally {
    await Promise.race([srv.stop(), sleep(500)]);
    rmSync(dir, { recursive: true, force: true });
  }
};
const lab = (name) => read(LAB(name));
/** .http 파일의 요청을 «하나씩» 보낸다 — 제목과 응답을 차례대로 돌려준다. */
const runHttp = async (httpText, labPort, base) => {
  const out = [];
  for (const block of httpText.split(/^### /m).filter(Boolean)) {
    const [title, ...rest] = block.split('\n');
    const lines = rest.join('\n').trim().split('\n');
    const [method, url] = lines[0].split(' ');
    const headers = {};
    let i = 1;
    for (; i < lines.length && lines[i].trim() !== ''; i += 1) {
      const [k, ...v] = lines[i].split(':');
      headers[k.trim()] = v.join(':').trim();
    }
    const body = lines.slice(i + 1).join('\n').trim() || undefined;
    const res = await getJson(url.replace(`localhost:${labPort}`, base.replace('http://', '')), { method, headers, body });
    out.push({ title: title.trim(), ...res });
  }
  return out;
};

// ───────── 수업 백엔드 — 이 회차 판과, 파일 몇 개를 바꾼 판 ─────────
let db = null;
let server = null;
let before = null;
const env = { DATABASE_URL: GATE_URL, CORS_ORIGIN: STUDENT_ORIGIN };

const withVariant = async (port, overrides, fn, from = R) => {
  const dir = mkdtempSync(join(tmpdir(), 'p330-var-'));
  for (const name of ['app.js', 'db.js', 'errors.js', 'routes', 'services', 'middlewares', 'schemas', 'package.json']) {
    cpSync(from(name), join(dir, name), { recursive: true });
  }
  symlinkSync(P('node_modules'), join(dir, 'node_modules'));
  for (const [name, src] of Object.entries(overrides)) {
    if (src === null) rmSync(join(dir, name), { force: true });
    else writeFileSync(join(dir, name), src);
  }
  const srv = await boot(join(dir, 'app.js'), { port, env: { ...env, PORT: String(port) }, ready: `${port}번 포트에서` });
  try {
    await fn(srv);
  } finally {
    await srv.stop();
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

beforeAll(async () => {
  const admin = await dropGate();
  await admin.query(`CREATE DATABASE ${GATE_DB}`);
  await admin.end();
  db = new pg.Client({ ...ADMIN, database: GATE_DB });
  await db.connect();
  for (const dir of [...P235_MIGRATIONS, SIGNUP_MIGRATION]) {
    await db.query(read(R(`prisma/migrations/${dir}/migration.sql`)));
  }
  execFileSync(process.execPath, [P('seed.js')], { cwd: P('.'), encoding: 'utf8', env: { ...process.env, ...env } });
  server = await boot(R('app.js'), { port: PORT, env: { ...env, PORT: String(PORT) }, ready: `${PORT}번 포트에서` });
  before = await boot(B('app.js'), { port: PORT + 1, env: { ...env, PORT: String(PORT + 1) }, ready: `${PORT + 1}번 포트에서` });
  // 교안 Step 4 «준비» — posts.http 의 좋아요 요청 둘(3번에 2번 사람 · 1번에 1번 사람)
  await send(server.base, 'PUT', '/api/posts/3/likes/2');
  await send(server.base, 'PUT', '/api/posts/1/likes/1');
}, 120000);

afterAll(async () => {
  if (server) await server.stop();
  if (before) await before.stop();
  if (db) await db.end();
  const admin = await dropGate();
  await admin.end();
  ROUND.cleanup();
  BEFORE.cleanup();
}, 60000);

describe('축 ① — Step 1: 라우터도 미들웨어', () => {
  it('🔴 express.Router() 가 돌려주는 것은 매개변수 셋짜리 함수다(fn.length 3 — 에러 미들웨어가 아니다)', () => {
    const router = express.Router();
    expect(typeof router).toBe('function');
    expect(router.length).toBe(3);
  });

  it('🔴 라우터 소스 — 라우터를 부르면 router.handle 로 이어진다(router/index.js)', () => {
    const src = read(P('node_modules/router/index.js'));
    expect(src).toContain('  function router (req, res, next) {\n    router.handle(req, res, next)\n  }');
    expect(JSON.parse(read(P('node_modules/router/package.json'))).version).toBe('2.2.0');
  });
});

describe('축 ② — Step 2: 관리자 라우트를 늘리다 생긴 구멍 → router.use', () => {
  const PORT_LAB = 3710;
  it('🔴 시작 판 — 역할 없이 올리기 403 · 관리자로 올리기 201', async () => {
    await withLab({ files: { 'board.js': read(SNAP('step2-start.board.js')) }, entry: 'board.js', labPort: 4008, port: PORT_LAB }, async (srv) => {
      expect((await send(srv.base, 'POST', '/api/admin/notices', { json: { title: '아무나 올린 공지' } }))).toEqual({ status: 403, body: { message: '관리자만 할 수 있어요' } });
      expect((await send(srv.base, 'POST', '/api/admin/notices', { headers: { 'X-Role': 'admin' }, json: { title: '새 공지' } }))).toEqual({ status: 201, body: { id: 4, title: '새 공지', hidden: false } });
    });
  });

  it('🔴 구멍 판 — 숨기기 라우트에 adminOnly 를 빠뜨리면 역할 없이 숨겨지고(200) 공개 목록에서 2번이 사라진다', async () => {
    await withLab({ files: { 'board.js': read(SNAP('step2-hole.board.js')) }, entry: 'board.js', labPort: 4008, port: PORT_LAB }, async (srv) => {
      expect(await send(srv.base, 'PATCH', '/api/admin/notices/2/hide')).toEqual({ status: 200, body: { id: 2, title: '새 기능 소개', hidden: true } });
      expect((await send(srv.base, 'GET', '/api/notices')).body.map((n) => n.id)).toEqual([1, 3]);
      await sleep(100);
      expect(linesAfterReady(srv).map(noMs)).toEqual(['PATCH /api/admin/notices/2/hide 200', 'GET /api/notices 200']);
    });
  });

  it('🔴 구멍 판 = 시작 판 + 숨기기 라우트 하나(adminOnly 없이)', () => {
    const start = read(SNAP('step2-start.board.js'));
    const hole = read(SNAP('step2-hole.board.js'));
    expect(hole.startsWith(start.slice(0, start.indexOf('app.use((req, res) => {\n  res.status(404)')))).toBe(true);
    expect(hole).toContain("app.patch('/api/admin/notices/:id/hide', (req, res) => {");
    expect(hole.match(/adminOnly, \(req, res\)/g)).toHaveLength(2);
  });

  it('🔴 router.use 판 — 역할 없이 숨기기 403 · 관리자 200 · 없는 관리자 주소는 역할 없이 403 / 관리자로 404 · /api/nope 404', async () => {
    await withLab({ files: { 'board.js': read(SNAP('step2.board.js')) }, entry: 'board.js', labPort: 4008, port: PORT_LAB }, async (srv) => {
      expect(await send(srv.base, 'PATCH', '/api/admin/notices/2/hide')).toEqual({ status: 403, body: { message: '관리자만 할 수 있어요' } });
      expect((await send(srv.base, 'PATCH', '/api/admin/notices/2/hide', { headers: { 'X-Role': 'admin' } })).status).toBe(200);
      expect(await send(srv.base, 'GET', '/api/admin/nope')).toEqual({ status: 403, body: { message: '관리자만 할 수 있어요' } });
      expect(await send(srv.base, 'GET', '/api/admin/nope', { headers: { 'X-Role': 'admin' } })).toEqual({ status: 404, body: { message: '그런 주소는 없어요' } });
      expect((await send(srv.base, 'GET', '/api/nope')).status).toBe(404);
    });
  });

  it('🔴 router.use 판의 관리자 라우터 — adminRouter.use(adminOnly) 한 줄 · 라우트 셋에는 adminOnly 가 없다', () => {
    const src = read(SNAP('step2.board.js'));
    expect(src).toContain("const adminRouter = express.Router();\n\n// 이 라우터에 들어온 요청은 모두 adminOnly 부터 지나간다\nadminRouter.use(adminOnly);\n");
    expect(src.match(/adminRouter\.(post|delete|patch)\('\/notices/g)).toHaveLength(3);
    expect(src.match(/adminOnly, \(req, res\)/g)).toBeNull();
    expect(src).toContain("app.use('/api/admin', adminRouter);");
  });
});

describe('축 ③ — Step 3: router.use 가 거는 범위', () => {
  const PORT_LAB = 3711;
  it('🔴 같은 경로 판(관리자 라우터도 /api 에) — 공개 목록까지 403 · /api/nope 도 403 · 관리자로는 목록 200', async () => {
    await withLab({ files: { 'board.js': read(SNAP('step3-same-path.board.js')) }, entry: 'board.js', labPort: 4008, port: PORT_LAB }, async (srv) => {
      expect(await send(srv.base, 'GET', '/api/notices')).toEqual({ status: 403, body: { message: '관리자만 할 수 있어요' } });
      expect(await send(srv.base, 'GET', '/api/nope')).toEqual({ status: 403, body: { message: '관리자만 할 수 있어요' } });
      expect((await send(srv.base, 'GET', '/api/notices', { headers: { 'X-Role': 'admin' } })).status).toBe(200);
    });
  });

  it('🔴 같은 경로 판에서 두 줄의 차례만 바꾸면 — 공개 목록은 200 · 없는 주소 /api/nope 는 여전히 403', async () => {
    const swapped = rep(read(SNAP('step3-same-path.board.js')),
      "app.use('/api', adminRouter);\napp.use('/api', noticeRouter);\n", "app.use('/api', noticeRouter);\napp.use('/api', adminRouter);\n");
    await withLab({ files: { 'board.js': swapped }, entry: 'board.js', labPort: 4008, port: PORT_LAB }, async (srv) => {
      expect((await send(srv.base, 'GET', '/api/notices')).status).toBe(200);
      expect(await send(srv.base, 'GET', '/api/nope')).toEqual({ status: 403, body: { message: '관리자만 할 수 있어요' } });
    });
  });

  it('🔴 끝 판 — 공개 목록 200 · 역할 없이 숨기기 403 · /api/nope 404 · 없는 관리자 주소 403', async () => {
    await withLab({ files: { 'board.js': lab('board.js') }, entry: 'board.js', labPort: 4008, port: PORT_LAB }, async (srv) => {
      const got = await runHttp(lab('board.http'), 4008, srv.base);
      expect(got.map((r) => [r.title, r.status])).toEqual([
        ['공지 목록', 200],
        ['역할 없이 공지 올리기', 403],
        ['관리자로 공지 올리기', 201],
        ['역할 없이 2번 공지 숨기기', 403],
        ['역할 없이 없는 관리자 주소', 403],
        ['관리자로 없는 관리자 주소', 404],
      ]);
      expect((await send(srv.base, 'GET', '/api/nope')).status).toBe(404);
    });
  });

  it('🔴 끝 판 = 같은 경로 판에서 관리자 라우트 주소의 /admin 을 떼고 붙이는 줄을 /api/admin 으로', () => {
    const same = read(SNAP('step3-same-path.board.js'));
    const fixed = rep(rep(rep(rep(same,
      "adminRouter.post('/admin/notices',", "adminRouter.post('/notices',"),
      "adminRouter.delete('/admin/notices/:id',", "adminRouter.delete('/notices/:id',"),
      "adminRouter.patch('/admin/notices/:id/hide',", "adminRouter.patch('/notices/:id/hide',"),
      "app.use('/api', adminRouter);\napp.use('/api', noticeRouter);\n", "app.use('/api', noticeRouter);\napp.use('/api/admin', adminRouter);\n");
    expect(lab('board.js')).toBe(fixed);
  });
});

describe('축 ④ — Step 4: parseId 를 빠뜨린 라우트', () => {
  it('🔴 GET /:id/likes 에서 parseId 를 빼면 3번 · 1번 · 999번 · abc 모두 200 으로 모든 게시물의 좋아요(["jaehoon","dahye"]) — 에러 없음', async () => {
    await withVariant(PORT + 10, {
      'app.js': git('code/p3-29', 'app.js'),
      'routes/posts.js': read(SNAP('step4-no-parseid.posts.js')),
      'routes/likes.js': null,
      'middlewares/params.js': null,
    }, async (v) => {
      for (const id of ['3', '1', '999', 'abc']) {
        expect(await send(v.base, 'GET', `/api/posts/${id}/likes`)).toEqual({ status: 200, body: ['jaehoon', 'dahye'] });
      }
      expect(v.tail()).not.toContain('Error');
    });
  });

  it('🔴 빠뜨린 판 = code/p3-29 의 routes/posts.js 에서 parseId 한 번만 뺀 것', () => {
    expect(read(SNAP('step4-no-parseid.posts.js'))).toBe(rep(git('code/p3-29', 'routes/posts.js'),
      "router.get('/:id/likes', parseId, async", "router.get('/:id/likes', async"));
  });

  it('🔴 likeService.getLikers 는 where: { postId } — undefined 면 조건 없이 모두 찾는다', () => {
    expect(read(R('services/likeService.js'))).toContain('  const likes = await prisma.postLike.findMany({\n    where: { postId },');
  });

  it('🔴 Step 4 판(router.param 한 줄 · 라우트 여섯에서 parseId 를 뺐다) — 3번은 jaehoon 만 · abc 404 · 999 는 []', async () => {
    const step4 = read(SNAP('step4.posts.js'));
    expect(step4.match(/parseId/g)).toHaveLength(2); // 함수 이름 · router.param 한 줄
    expect(step4.match(/parseUserId/g)).toHaveLength(3); // 함수 이름 · 라우트 둘
    await withVariant(PORT + 11, {
      'app.js': git('code/p3-29', 'app.js'),
      'routes/posts.js': step4,
      'routes/likes.js': null,
      'middlewares/params.js': null,
    }, async (v) => {
      expect(await send(v.base, 'GET', '/api/posts/3/likes')).toEqual({ status: 200, body: ['jaehoon'] });
      expect(await send(v.base, 'GET', '/api/posts/abc/likes')).toEqual({ status: 404, body: { message: '그런 게시물은 없어요' } });
      expect(await send(v.base, 'GET', '/api/posts/999/likes')).toEqual({ status: 200, body: [] });
      expect(await send(v.base, 'PATCH', '/api/posts/abc', { json: { content: 'x' } })).toEqual({ status: 404, body: { message: '그런 게시물은 없어요' } });
    });
  });
});

describe('축 ⑤ — Step 5: router.param 의 성질', () => {
  it('🔴 router.param 을 라우트들 «아래» 에 적어도 똑같이 돈다(등록 차례와 상관없다)', async () => {
    const step4 = read(SNAP('step4.posts.js'));
    const line = "router.param('id', parseId);\n\n";
    const moved = rep(rep(step4, line, ''), 'export default router;', `${line}export default router;`);
    await withVariant(PORT + 12, {
      'app.js': git('code/p3-29', 'app.js'), 'routes/posts.js': moved, 'routes/likes.js': null, 'middlewares/params.js': null,
    }, async (v) => {
      expect(await send(v.base, 'GET', '/api/posts/3/likes')).toEqual({ status: 200, body: ['jaehoon'] });
      expect((await send(v.base, 'GET', '/api/posts/abc')).status).toBe(404);
    });
  });

  it('🔴 Step 5 판 — router.param 둘 · 라우트에는 parseId·parseUserId 가 없다 · 3번/abc 사람 404', async () => {
    const step5 = read(SNAP('step5.posts.js'));
    expect(step5).toContain("router.param('id', parseId);\nrouter.param('userId', parseUserId);\n");
    expect(step5.match(/', parseUserId, |', parseId, /g)).toBeNull();
    await withVariant(PORT + 13, {
      'app.js': git('code/p3-29', 'app.js'), 'routes/posts.js': step5, 'routes/likes.js': null, 'middlewares/params.js': null,
    }, async (v) => {
      expect(await send(v.base, 'PUT', '/api/posts/3/likes/abc')).toEqual({ status: 404, body: { message: '그런 사용자는 없어요' } });
      expect(await send(v.base, 'PUT', '/api/posts/abc/likes/2')).toEqual({ status: 404, body: { message: '그런 게시물은 없어요' } });
      expect(await send(v.base, 'PUT', '/api/posts/3/likes/2')).toEqual({ status: 200, body: { liked: true, likeCount: 77 } });
    });
  });

  it('🔴 router 패키지 — 같은 값이면 다시 부르지 않는다(«한 요청에 한 번») · 돌려준 Promise 의 실패도 받는다', () => {
    const src = read(P('node_modules/router/index.js'));
    expect(src).toContain('    // param previously called with same value or error occurred\n    if (paramCalled && (paramCalled.match === paramVal ||');
    expect(src).toContain('      const ret = fn(req, res, paramCallback, paramVal, key)');
  });

  it('🔴 router.param 의 함수는 매개변수가 넷이어도 에러 미들웨어로 보지 않는다(개수를 세지 않는다) — 넷째에 값', async () => {
    const app = express();
    const r = express.Router();
    const seen = [];
    r.param('id', (req, res, next, value) => { seen.push(value); next(); });
    r.get('/:id', (req, res) => res.json({ seen }));
    app.use('/x', r);
    const s = app.listen(PORT + 14);
    try {
      expect(await send(`http://localhost:${PORT + 14}`, 'GET', '/x/7')).toEqual({ status: 200, body: { seen: ['7'] } });
    } finally {
      s.close();
    }
  });
});

describe('축 ⑥ — Step 6: 좋아요 라우터를 떼고 router.param 을 그대로 옮기면', () => {
  it('🔴 likes 라우터의 router.param("id") 는 안 불린다 — 목록은 3번도 abc 도 모든 게시물 · PUT 은 500(Argument `postId` is missing.)', async () => {
    await withVariant(PORT + 20, { 'routes/likes.js': read(SNAP('step6-param.likes.js')) }, async (v) => {
      expect(await send(v.base, 'GET', '/api/posts/3/likes')).toEqual({ status: 200, body: ['jaehoon', 'dahye'] });
      expect(await send(v.base, 'GET', '/api/posts/abc/likes')).toEqual({ status: 200, body: ['jaehoon', 'dahye'] });
      expect(await send(v.base, 'PUT', '/api/posts/3/likes/2')).toEqual({ status: 500, body: { message: '서버에서 문제가 생겼어요' } });
      await sleep(100);
      expect(v.tail()).toContain('Argument `postId` is missing.');
      expect(v.tail()).toContain('PrismaClientValidationError');
    });
  });

  it('🔴 Step 6 판 = 끝 판에서 mergeParams 를 빼고 router.use(parseId) 자리에 router.param("id", parseId)', () => {
    const fin = read(R('routes/likes.js'));
    const s6 = read(SNAP('step6-param.likes.js'));
    expect(s6).toContain("const router = express.Router();\n");
    expect(s6).toContain("router.param('id', parseId);\nrouter.param('userId', parseUserId);\n");
    expect(s6.split('\n').filter((l) => !fin.includes(l))).toEqual([
      'const router = express.Router();',
      '// 주소에 이 이름의 값이 있으면, 라우트로 들어가기 전에 이 함수부터 한 번 부른다.',
      "router.param('id', parseId);",
    ]);
  });
});

describe('축 ⑦ — Step 7: mergeParams', () => {
  it('🔴 mergeParams 가 없는 판 — 좋아요 요청은 모두 404 「그런 게시물은 없어요」 · 게시물 자체는 200', async () => {
    await withVariant(PORT + 21, { 'routes/likes.js': read(SNAP('step7-no-merge.likes.js')) }, async (v) => {
      expect(await send(v.base, 'GET', '/api/posts/3/likes')).toEqual({ status: 404, body: { message: '그런 게시물은 없어요' } });
      expect(await send(v.base, 'PUT', '/api/posts/3/likes/2')).toEqual({ status: 404, body: { message: '그런 게시물은 없어요' } });
      expect(await send(v.base, 'DELETE', '/api/posts/3/likes/2')).toEqual({ status: 404, body: { message: '그런 게시물은 없어요' } });
      expect((await send(v.base, 'GET', '/api/posts/3')).status).toBe(200);
    });
  });

  it('🔴 parseId 맨 위에 console.log(req.params) — mergeParams 없으면 {} · 있으면 { id: \'3\' }', async () => {
    const logged = read(SNAP('step7-log.params.js'));
    expect(logged).toBe(rep(read(R('middlewares/params.js')), 'export function parseId(req, res, next) {\n', 'export function parseId(req, res, next) {\n  console.log(req.params);\n'));
    await withVariant(PORT + 22, { 'routes/likes.js': read(SNAP('step7-no-merge.likes.js')), 'middlewares/params.js': logged }, async (v) => {
      await send(v.base, 'GET', '/api/posts/3/likes');
      await sleep(100);
      expect(linesAfterReady(v).map(noMs)).toEqual(['{}', 'GET /api/posts/3/likes 404']);
    });
    await withVariant(PORT + 23, { 'middlewares/params.js': logged }, async (v) => {
      await send(v.base, 'GET', '/api/posts/3/likes');
      await sleep(100);
      expect(linesAfterReady(v).map(noMs)).toEqual(["{ id: '3' }", 'GET /api/posts/3/likes 200']);
    });
  });

  it('🔴 Step 7 판 = 끝 판에서 { mergeParams: true } 와 그 위 주석만 뺀 것', () => {
    expect(read(SNAP('step7-no-merge.likes.js'))).toBe(rep(read(R('routes/likes.js')),
      "// app.js 가 붙인 주소(/api/posts/:id/likes)의 :id 까지 req.params 로 받는다.\nconst router = express.Router({ mergeParams: true });\n",
      'const router = express.Router();\n'));
  });
});

describe('축 ⑧ — Step 8: 안 쓰는 Mongo 시절 파일 정리', () => {
  it('🔴 models/Post.js 가 없다 · 학생 package.json 의 dependencies 에 mongoose 가 없다', () => {
    expect(existsSync(R('models/Post.js'))).toBe(false);
    const pkg = JSON.parse(read(R('package.json')));
    expect(Object.keys(pkg.dependencies)).not.toContain('mongoose');
    // 🔑 코드베이스만 — Mongo 회차 판정(p2-22~p2-26)이 아직 부른다. 학생 package.json 에는 devDependencies 가 없다.
    expect(pkg.devDependencies.mongoose).toBe('^9.9.5');
  });

  it('🔴 lab/ 밖에서 mongoose 를 부르는 학생 파일이 없다(교안의 grep 결과가 0줄)', () => {
    const hits = [];
    const walk = (dir) => {
      for (const name of readdirSync(dir)) {
        if (['node_modules', 'lab', 'test', 'snapshots', '.git', 'sql', 'generated'].includes(name) || name.startsWith('generated')) continue;
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (name.endsWith('.js') && read(full).includes('mongoose')) hits.push(relative(ROUND.dir, full));
      }
    };
    walk(ROUND.dir);
    expect(hits).toEqual([]);
  });

  it('🔴 이 회차 앞(code/p3-29)에는 그 grep 이 models/Post.js 하나를 찾았다', () => {
    expect(git('code/p3-29', 'models/Post.js')).toContain("import mongoose from 'mongoose';");
    const files = execFileSync('git', ['grep', '-l', 'mongoose', 'code/p3-29', '--', '*.js', ':!lab', ':!test', ':!snapshots', ':!sql'], { cwd: P('.'), encoding: 'utf8' });
    expect(files.trim().split('\n')).toEqual(['code/p3-29:models/Post.js']);
  });
});

describe('축 ⑨ — 수업 백엔드는 앞 회차와 같은 응답', () => {
  const same = [
    ['GET', '/api/posts?limit=2'], ['GET', '/api/posts/1'], ['GET', '/api/posts/abc'], ['GET', '/api/posts/999'],
    ['GET', '/api/posts/3/likes'], ['GET', '/api/posts/1/likes'], ['GET', '/api/posts/999/likes'], ['GET', '/api/posts/abc/likes'],
    ['PUT', '/api/posts/abc/likes/2'], ['PUT', '/api/posts/3/likes/abc'], ['DELETE', '/api/posts/3/likes'],
    ['GET', '/api/posts/3/likes/2/x'], ['PATCH', '/api/posts/abc'], ['GET', '/api/nope'], ['GET', '/api/auth/me'],
  ];
  it('🔴 같은 요청 열다섯에 상태 코드와 본문이 같다', async () => {
    for (const [method, path] of same) {
      const a = await send(server.base, method, path);
      const b = await send(before.base, method, path);
      expect({ method, path, ...a }).toEqual({ method, path, ...b });
    }
  });

  it('🔴 좋아요 누르기·취소도 같은 결과 — 이 회차 판으로 누르고 앞 회차 판으로 취소', async () => {
    expect(await send(server.base, 'PUT', '/api/posts/2/likes/3')).toEqual({ status: 200, body: { liked: true, likeCount: expect.any(Number) } });
    expect((await send(before.base, 'GET', '/api/posts/2/likes')).body).toEqual((await send(server.base, 'GET', '/api/posts/2/likes')).body);
    expect((await send(before.base, 'DELETE', '/api/posts/2/likes/3')).body.liked).toBe(false);
    expect(await send(server.base, 'DELETE', '/api/posts/2/likes/3')).toEqual(await send(before.base, 'DELETE', '/api/posts/2/likes/3'));
  });

  it('🔴 갈리는 곳 하나 — 없는 게시물 번호 뒤에 아무 주소나 붙이면 앞 회차는 「그런 주소는 없어요」 · 이 회차는 likes 라우터의 parseId 가 먼저 「그런 게시물은 없어요」', async () => {
    expect(await send(before.base, 'GET', '/api/posts/abc/likes/x/y')).toEqual({ status: 404, body: { message: '그런 주소는 없어요' } });
    expect(await send(server.base, 'GET', '/api/posts/abc/likes/x/y')).toEqual({ status: 404, body: { message: '그런 게시물은 없어요' } });
  });
});

describe('축 ⑩ — 실습·과제 (lab/p3-30)', () => {
  const titles = (got) => got.map((r) => [r.title, r.status]);

  describe('직접 해보기 1 — 로그인한 사람만 쓰는 라우터(4001)', () => {
    const P1 = 3720;
    const expected = [
      ['공지 목록', 200], ['이름 없이 내 정보', 401], ['이름 없이 내 북마크', 401], ['minji의 북마크', 200], ['minji로 없는 주소', 404],
      ['이름 없이 없는 주소', 404],
    ];
    it('🔴 정답 판 — 여섯 요청이 200 · 401 · 401 · 200([1,3]) · 404 · 404', async () => {
      await withLab({ files: { 'practice1.js': lab('practice1.js') }, entry: 'practice1.js', labPort: 4001, port: P1 }, async (srv) => {
        const got = await runHttp(lab('practice1.http'), 4001, srv.base);
        expect(titles(got)).toEqual(expected);
        expect(got[3].body).toEqual([1, 3]);
      });
    });
    it('🔴 틀린 판 셋을 여섯 요청이 가려낸다 — /api 에 붙인 판은 마지막 요청(이름 없이 /api/nope)에서만 401 로 갈린다', async () => {
      const src = lab('practice1.js');
      const wrong = {
        atApi: rep(rep(rep(src, "meRouter.get('/', ", "meRouter.get('/me', "), "meRouter.get('/bookmarks', ", "meRouter.get('/me/bookmarks', "), "app.use('/api/me', meRouter);", "app.use('/api', meRouter);"),
        perRoute: rep(rep(src, 'meRouter.use(requireUser);\n\n', ''), "meRouter.get('/', (req", "meRouter.get('/', requireUser, (req"),
        global: rep(src, 'meRouter.use(requireUser);\n\n', '').replace("// 누구나\napp.get", 'app.use(requireUser);\n\n// 누구나\napp.get'),
        blankApi: rep(src, "app.use('/api/me', meRouter);", "app.use('/api', meRouter);"),
      };
      for (const [name, file] of Object.entries(wrong)) {
        await withLab({ files: { 'practice1.js': file }, entry: 'practice1.js', labPort: 4001, port: P1 }, async (srv) => {
          const got = titles(await runHttp(lab('practice1.http'), 4001, srv.base));
          expect({ name, same: JSON.stringify(got) === JSON.stringify(expected) }).toEqual({ name, same: false });
        });
      }
    });
  });

  describe('직접 해보기 2 — router.param 으로 공지 찾기(4002)', () => {
    const P2 = 3721;
    it('🔴 정답 판 — 목록 200 · 2번 200 · 고치기 200 · 9번 404 · findNotice 는 세 번(목록에서는 안 불린다)', async () => {
      await withLab({ files: { 'practice2.js': lab('practice2.js') }, entry: 'practice2.js', labPort: 4002, port: P2 }, async (srv) => {
        const got = await runHttp(lab('practice2.http'), 4002, srv.base);
        expect(titles(got)).toEqual([['공지 목록', 200], ['2번 공지', 200], ['2번 공지 제목 고치기', 200], ['없는 9번 공지', 404], ['findNotice가 불린 횟수', 200]]);
        expect(got[1].body).toEqual({ id: 2, title: '새 기능 소개' });
        expect(got[4].body).toEqual({ found: 3 });
      });
    });
    it('🔴 틀린 판 — router.use(findNotice) 나 라우트 앞에 끼운 판은 넷째 매개변수 때문에 에러 미들웨어로 건너뛰어 2번 공지가 빈 본문 · 횟수 0', async () => {
      const src = lab('practice2.js');
      const wrong = {
        use: rep(src, "router.param('id', findNotice);", 'router.use(findNotice);'),
        perRoute: rep(rep(src, "router.param('id', findNotice);\n\n", ''), "router.get('/:id', (req", "router.get('/:id', findNotice, (req"),
      };
      for (const file of Object.values(wrong)) {
        await withLab({ files: { 'practice2.js': file }, entry: 'practice2.js', labPort: 4002, port: P2 }, async (srv) => {
          const got = await runHttp(lab('practice2.http'), 4002, srv.base);
          expect(got[1]).toMatchObject({ status: 200, body: '' });
          expect(got[4].body).toEqual({ found: 0 });
        });
      }
    });
  });

  describe('직접 해보기 3 — 공지 댓글 라우터(4003)', () => {
    const P3 = 3722;
    it('🔴 정답 판 — 1번 댓글 둘 · 2번에 달기 201 · 2번 댓글 둘 · 9번 404', async () => {
      await withLab({ files: { 'practice3.js': lab('practice3.js') }, entry: 'practice3.js', labPort: 4003, port: P3 }, async (srv) => {
        const got = await runHttp(lab('practice3.http'), 4003, srv.base);
        expect(titles(got)).toEqual([['1번 공지의 댓글', 200], ['2번 공지에 댓글 달기', 201], ['2번 공지의 댓글', 200], ['없는 9번 공지의 댓글', 404]]);
        expect(got[0].body.map((c) => c.id)).toEqual([1, 2]);
        expect(got[2].body.map((c) => c.id)).toEqual([3, 4]);
      });
    });
    it('🔴 틀린 판 — mergeParams 를 빠뜨리면 첫 요청부터 404 · router.param("id") 로 적으면 첫 요청이 500', async () => {
      const src = lab('practice3.js');
      const noMerge = rep(src, 'express.Router({ mergeParams: true })', 'express.Router()');
      const asParam = rep(src, 'commentRouter.use(findNotice);', "commentRouter.param('id', findNotice);");
      for (const [file, status] of [[noMerge, 404], [asParam, 500]]) {
        await withLab({ files: { 'practice3.js': file }, entry: 'practice3.js', labPort: 4003, port: P3 }, async (srv) => {
          const got = await runHttp(lab('practice3.http'), 4003, srv.base);
          expect(got[0].status).toBe(status);
        });
      }
    });
  });

  describe('과제 [기초] — 댓글 하나 지우기(4011)', () => {
    const H1 = 3723;
    it('🔴 정답 판 — 목록 200 · 1번 공지의 2번 지우기 200 · 2번 공지의 1번 404(그런 댓글) · 9번 공지 404(그런 공지) · 다시 보면 1번만', async () => {
      await withLab({ files: { 'homework1.js': lab('homework1.js') }, entry: 'homework1.js', labPort: 4011, port: H1 }, async (srv) => {
        const got = await runHttp(lab('homework1.http'), 4011, srv.base);
        expect(got.map((r) => [r.title, r.status, r.body.message ?? null])).toEqual([
          ['1번 공지의 댓글', 200, null],
          ['1번 공지의 2번 댓글 지우기', 200, null],
          ['2번 공지의 1번 댓글 지우기', 404, '그런 댓글은 없어요'],
          ['없는 9번 공지의 1번 댓글 지우기', 404, '그런 공지는 없어요'],
          ['1번 공지의 댓글 다시 보기', 200, null],
        ]);
        expect(got[4].body.map((c) => c.id)).toEqual([1]);
      });
    });
    it('🔴 homework1 = practice3 + findComment · router.param("commentId") · DELETE 라우트 · 포트', () => {
      const p3 = lab('practice3.js');
      const hw = lab('homework1.js');
      expect(hw.replace('homework1.js', 'practice3.js').replaceAll('4011', '4003')
        .replace(/\n\/\/ 주소의 :commentId[\s\S]*?\n}\);\n/, '')).toBe(p3);
    });
    it('🔴 틀린 판 둘 — 공지를 안 따지면 2번 공지의 1번이 지워진다(200) · router.use(findComment) 면 지울 때마다 맨 끝 댓글이 지워지고 본문이 빈다(«다시 보기» 만으로는 못 가른다)', async () => {
      const src = lab('homework1.js');
      const anyNotice = rep(src, ' && one.noticeId === req.notice.id', '');
      await withLab({ files: { 'homework1.js': anyNotice }, entry: 'homework1.js', labPort: 4011, port: H1 }, async (srv) => {
        const got = await runHttp(lab('homework1.http'), 4011, srv.base);
        expect(got[2].status).toBe(200);
      });
      const useVersion = rep(src, "commentRouter.param('commentId', findComment);", 'commentRouter.use(findComment);');
      await withLab({ files: { 'homework1.js': useVersion }, entry: 'homework1.js', labPort: 4011, port: H1 }, async (srv) => {
        const got = await runHttp(lab('homework1.http'), 4011, srv.base);
        // findComment 를 건너뛰어 req.comment 가 undefined — indexOf 가 -1 이라 splice(-1, 1) 이 맨 끝 댓글을 지운다.
        // 둘째 삭제(2번 공지의 1번)도 200 으로 또 맨 끝(이번엔 1번 공지의 2번)을 지워, «다시 보기» 는 정답 판과 같은 [1] 이다.
        expect(got[1]).toMatchObject({ status: 200, body: '' });
        expect(got[2]).toMatchObject({ status: 200, body: '' });
        expect(got[4].body.map((c) => c.id)).toEqual([1]);
      });
    });
  });

  describe('과제 [응용] — board.js 를 파일로 나누기(4012)', () => {
    const H2 = 3724;
    const files = () => Object.fromEntries(['app.js', 'data/notices.js', 'middlewares/adminOnly.js', 'routes/notices.js', 'routes/admin.js']
      .map((f) => [`homework2/${f}`, lab(`homework2/${f}`)]));
    const expected = [
      ['공지 목록', 200], ['역할 없이 공지 올리기', 403], ['관리자로 공지 올리기', 201], ['관리자로 2번 공지 숨기기', 200],
      ['공지 목록 다시 보기', 200], ['역할 없이 없는 관리자 주소', 403], ['없는 주소', 404],
    ];
    it('🔴 정답 판 — 일곱 요청의 상태 코드 · 다시 본 목록은 1 · 3 · 4번', async () => {
      await withLab({ files: files(), entry: 'homework2/app.js', labPort: 4012, port: H2 }, async (srv) => {
        const got = await runHttp(lab('homework2.http'), 4012, srv.base);
        expect(titles(got)).toEqual(expected);
        expect(got[4].body.map((n) => n.id)).toEqual([1, 3, 4]);
      });
    });
    it('🔴 나누기 전(board.js)과 같은 요청에 같은 응답', async () => {
      const a = [];
      await withLab({ files: { 'board.js': lab('board.js') }, entry: 'board.js', labPort: 4008, port: H2 }, async (srv) => {
        a.push(...await runHttp(lab('homework2.http').replaceAll('4012', '4008'), 4008, srv.base));
      });
      await withLab({ files: files(), entry: 'homework2/app.js', labPort: 4012, port: H2 }, async (srv) => {
        expect(await runHttp(lab('homework2.http'), 4012, srv.base)).toEqual(a);
      });
    });
    it('🔴 틀린 판 셋 — 배열을 두 라우터에 따로 둔 판(다시 본 목록에 2번이 남는다) · 관리자 라우터를 /api 에 · adminOnly 를 앱 전체에', async () => {
      const arr = "const notices = [\n  { id: 1, title: '서버 점검 안내', hidden: false },\n  { id: 2, title: '새 기능 소개', hidden: false },\n  { id: 3, title: '이용 약관 변경', hidden: false },\n];\n";
      const copied = files();
      for (const f of ['homework2/routes/notices.js', 'homework2/routes/admin.js']) {
        copied[f] = rep(copied[f], "import { notices } from '../data/notices.js';\n", '').replace('const router = express.Router();\n', `${arr}\nconst router = express.Router();\n`);
      }
      await withLab({ files: copied, entry: 'homework2/app.js', labPort: 4012, port: H2 }, async (srv) => {
        const got = await runHttp(lab('homework2.http'), 4012, srv.base);
        expect(titles(got)).toEqual(expected); // 상태 코드만 보면 못 가른다
        expect(got[4].body.map((n) => n.id)).toEqual([1, 2, 3]);
      });
      const atApi = files();
      atApi['homework2/app.js'] = rep(atApi['homework2/app.js'], "app.use('/api/admin', adminRouter);", "app.use('/api', adminRouter);");
      for (const r of ["router.post('/notices'", "router.delete('/notices/:id'", "router.patch('/notices/:id/hide'"]) {
        atApi['homework2/routes/admin.js'] = rep(atApi['homework2/routes/admin.js'], r, r.replace("'/notices", "'/admin/notices"));
      }
      atApi['homework2/app.js'] = rep(atApi['homework2/app.js'], "app.use('/api', noticeRouter);\napp.use('/api', adminRouter);", "app.use('/api', adminRouter);\napp.use('/api', noticeRouter);");
      await withLab({ files: atApi, entry: 'homework2/app.js', labPort: 4012, port: H2 }, async (srv) => {
        expect((await runHttp(lab('homework2.http'), 4012, srv.base))[0].status).toBe(403);
      });
      const global = files();
      global['homework2/routes/admin.js'] = rep(global['homework2/routes/admin.js'], 'router.use(adminOnly);\n\n', '');
      global['homework2/app.js'] = rep(rep(global['homework2/app.js'], "app.use(express.json());\n", "app.use(express.json());\napp.use(adminOnly);\n"),
        "import adminRouter from './routes/admin.js';\n", "import adminRouter from './routes/admin.js';\nimport { adminOnly } from './middlewares/adminOnly.js';\n");
      await withLab({ files: global, entry: 'homework2/app.js', labPort: 4012, port: H2 }, async (srv) => {
        expect((await runHttp(lab('homework2.http'), 4012, srv.base))[0].status).toBe(403);
      });
    });
  });
});

describe('축 ⑪ — 이 회차 학생 파일', () => {
  it('🔴 code/p3-29 에서 바뀐 학생 파일 — app.js · routes/posts.js · 새 routes/likes.js · 새 middlewares/params.js · models/Post.js 삭제 · package.json · package-lock.json', () => {
    const tip = ROUND.fromBookmark ? 'code/p3-30' : 'HEAD';
    const names = execFileSync('git', ['diff', '--name-status', 'code/p3-29', tip,
      '--', '.', ':!lab', ':!test', ':!snapshots', ':!sql'], { cwd: P('.'), encoding: 'utf8' }).trim().split('\n').sort();
    expect(names).toEqual([
      'A\tmiddlewares/params.js', 'A\troutes/likes.js', 'D\tmodels/Post.js',
      'M\tapp.js', 'M\tpackage-lock.json', 'M\tpackage.json', 'M\troutes/posts.js',
    ].sort());
  });

  it('🔴 package.json 은 mongoose 한 줄만 dependencies 에서 빠졌다(코드베이스는 devDependencies 로)', () => {
    const was = JSON.parse(git('code/p3-29', 'package.json'));
    const now = JSON.parse(read(R('package.json')));
    const { mongoose, ...rest } = was.dependencies;
    expect(mongoose).toBe('^9.9.5');
    expect(now.dependencies).toEqual(rest);
  });

  it('🔴 app.js 는 code/p3-29 에서 두 줄만 더해졌다', () => {
    const was = git('code/p3-29', 'app.js').split('\n');
    const now = read(R('app.js')).split('\n');
    expect(now.filter((l) => !was.includes(l))).toEqual([
      "import likesRouter from './routes/likes.js';",
      "app.use('/api/posts/:id/likes', likesRouter);",
    ]);
    expect(was.filter((l) => !now.includes(l))).toEqual([]);
  });

  it('🔴 middlewares/params.js 의 두 함수는 code/p3-29 routes/posts.js 의 두 함수에 export 만 붙인 것', () => {
    const was = git('code/p3-29', 'routes/posts.js');
    const fn = (src, name) => src.slice(src.indexOf(`function ${name}(`), src.indexOf('\n}\n', src.indexOf(`function ${name}(`)) + 2);
    const now = read(R('middlewares/params.js'));
    for (const name of ['parseId', 'parseUserId']) expect(now).toContain(`export ${fn(was, name)}`);
  });
});

// ───────── 축 ⑫ — 교안·답안 코드 블록 ─────────
const TRACK = new URL('../../part3/5-express-core/', ROOT).pathname;
const LECTURE = join(TRACK, 'p3-30-router-structure-lecture.md');
const ANSWERS = join(TRACK, 'p3-30-router-structure-answers.md');
const fences = (md, lang) => [...md.matchAll(/^```(\w*)\n([\s\S]*?)^```$/gm)].filter((m) => m[1] === lang).map((m) => m[2].replace(/\n$/, ''));
// 경로 주석 → 그 파일이 이 회차에 거친 판들(어느 하나에 차례대로 있으면 통과)
const versionsOf = (path) => {
  const snaps = (names) => names.map((n) => read(SNAP(n)));
  const map = {
    'app.js': [read(R('app.js')), git('code/p3-29', 'app.js')],
    'routes/posts.js': [git('code/p3-29', 'routes/posts.js'), ...snaps(['step4-no-parseid.posts.js', 'step4.posts.js', 'step5.posts.js']), read(R('routes/posts.js'))],
    'routes/likes.js': [...snaps(['step6-param.likes.js', 'step7-no-merge.likes.js']), read(R('routes/likes.js'))],
    'middlewares/params.js': [read(R('middlewares/params.js')), read(SNAP('step7-log.params.js'))],
    'services/likeService.js': [read(R('services/likeService.js'))],
    'lab/p3-30/board.js': [...snaps(['step2-start.board.js', 'step2-hole.board.js', 'step2.board.js', 'step3-same-path.board.js']), lab('board.js')],
    'lab/p3-30/homework1.js': [lab('homework1.js'), read(SNAP('homework1-guard.js'))],
  };
  if (map[path]) return map[path];
  if (path.startsWith('lab/p3-30/')) return [lab(path.slice('lab/p3-30/'.length))];
  throw new Error(`경로 주석의 파일을 모릅니다: ${path}`);
};
// 블록의 줄이 «차례대로» 그 판에 있는가 — `...` 는 건너뛴 줄 · `____` 는 아무 글자(빈칸 뼈대)
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
// 경로 없는 블록이 기댈 곳 — router 패키지 소스 · 실습 파일 · 스냅숏 · 수업 파일
const looseCorpus = () => [read(P('node_modules/router/index.js')), ...['board.js', 'practice1.js', 'practice2.js', 'practice3.js', 'homework1.js'].map(lab),
  read(SNAP('homework1-guard.js')), read(R('routes/posts.js')), read(R('routes/likes.js')), read(R('app.js'))];

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

    it(`🔴 ${name} — 경로 주석이 없는 javascript 블록은 «틀린 판» 셋과 임시 한 줄을 빼면 코드베이스에 차례대로 있다`, () => {
      // 교안이 «이렇게 적으면 틀린다» 고 일부러 보이는 줄 · 잠깐 더했다 지우는 확인용 한 줄 — 축 ⑦·⑩·⑬ 이 실행으로 잠근다
      const deliberate = new Set([
        'console.log(typeof postsRouter, postsRouter.length);',
        'const comment = comments.find((one) => one.id === Number(value));',
        'commentRouter.use(findComment);',
      ]);
      const bad = [];
      for (const b of fences(read(file), 'javascript')) {
        if (/^\/\/ ~\//.test(b)) continue;
        if (b.split('\n').every((l) => deliberate.has(l.trim()) || l.trim() === '')) continue;
        if (!looseCorpus().some((v) => inOrder(b, v))) bad.push(b.split('\n').slice(0, 2).join(' ⏎ '));
      }
      expect(bad).toEqual([]);
    });

    it(`🔴 ${name} — http 블록은 같은 이름의 실습 .http 파일에 그대로 있다`, () => {
      const https = ['board.http', 'practice1.http', 'practice2.http', 'practice3.http', 'homework1.http', 'homework2.http'].map(lab);
      const bad = fences(read(file), 'http').filter((b) => !https.some((h) => h.includes(b)));
      expect(bad).toEqual([]);
    });
  }

  it('🔴 교안 javascript 블록 수 · 경로가 있는 블록의 파일', () => {
    const paths = fences(read(LECTURE), 'javascript').map((b) => (b.match(/^\/\/ ~\/instagram-api\/(\S+)/) ?? [])[1]).filter(Boolean);
    expect([...new Set(paths)].sort()).toEqual([
      'app.js', 'lab/p3-30/board.js', 'lab/p3-30/homework1.js', 'lab/p3-30/practice1.js', 'lab/p3-30/practice2.js', 'lab/p3-30/practice3.js',
      'middlewares/params.js', 'routes/likes.js', 'routes/posts.js', 'services/likeService.js',
    ]);
  });

  it('🔴 교안 json 블록 — Step 4·6 이 인용한 좋아요 목록이 축 ④·⑥ 이 잰 값이다', () => {
    expect(fences(read(LECTURE), 'json')).toEqual(['["jaehoon"]', '["jaehoon","dahye"]', '["jaehoon","dahye"]']);
  });

  it('🔴 교안 bash 블록 — 창 1 에 찍힌 줄이 축 ⑥·⑦·⑧ 이 잰 줄이다', () => {
    const bash = fences(read(LECTURE), 'bash');
    const joined = bash.join('\n');
    for (const line of ['Argument `postId` is missing.', 'postId: undefined,', 'PrismaClientValidationError:', '{}', "{ id: '3' }",
      'grep -rl "mongoose" --include="*.js" --exclude-dir=node_modules --exclude-dir=lab .', './models/Post.js', 'npm uninstall mongoose']) {
      expect(joined).toContain(line);
    }
  });
});

describe('축 ⑬ — 교안 · 답안의 주장', () => {
  const H1 = 3730;
  it('🔴 교안 Step 2 — adminRouter.use 줄보다 «위» 에 등록한 라우트는 adminOnly 를 거치지 않는다', async () => {
    const src = read(SNAP('step2.board.js'));
    const early = rep(src, '// 이 라우터에 들어온 요청은 모두 adminOnly 부터 지나간다\nadminRouter.use(adminOnly);\n',
      "adminRouter.get('/early', (req, res) => res.json({ early: true }));\n\n// 이 라우터에 들어온 요청은 모두 adminOnly 부터 지나간다\nadminRouter.use(adminOnly);\n");
    await withLab({ files: { 'board.js': early }, entry: 'board.js', labPort: 4008, port: H1 + 5 }, async (srv) => {
      expect(await send(srv.base, 'GET', '/api/admin/early')).toEqual({ status: 200, body: { early: true } });
      expect((await send(srv.base, 'PATCH', '/api/admin/notices/2/hide')).status).toBe(403);
    });
  });

  it('🔴 교안 직접 해보기 1 해설 — 빈칸 3 을 /api 로 채운 판은 북마크 404 · 마지막 요청 401', async () => {
    const blankApi = rep(lab('practice1.js'), "app.use('/api/me', meRouter);", "app.use('/api', meRouter);");
    await withLab({ files: { 'practice1.js': blankApi }, entry: 'practice1.js', labPort: 4001, port: H1 + 6 }, async (srv) => {
      expect((await runHttp(lab('practice1.http'), 4001, srv.base)).map((r) => r.status)).toEqual([200, 401, 401, 404, 404, 401]);
    });
  });

  it("🔴 교안 직접 해보기 2 해설 — router.param(':id', …) 는 에러 없이 한 번도 안 불린다", async () => {
    const colon = rep(lab('practice2.js'), "router.param('id', findNotice);", "router.param(':id', findNotice);");
    await withLab({ files: { 'practice2.js': colon }, entry: 'practice2.js', labPort: 4002, port: H1 + 7 }, async (srv) => {
      const got = await runHttp(lab('practice2.http'), 4002, srv.base);
      expect(got[1]).toMatchObject({ status: 200, body: '' });
      expect(got[2].status).toBe(500); // req.notice 가 undefined — TypeError
      expect(got[4].body).toEqual({ found: 0 });
    });
  });

  it('🔴 교안 Step 4 — 앞 회차 좋아요가 남아 있으면(jaehoon 이 1번에도) 빠뜨린 판의 목록에 같은 이름이 두 번', async () => {
    await send(server.base, 'PUT', '/api/posts/1/likes/2');
    try {
      await withVariant(PORT + 30, {
        'app.js': git('code/p3-29', 'app.js'), 'routes/posts.js': read(SNAP('step4-no-parseid.posts.js')), 'routes/likes.js': null, 'middlewares/params.js': null,
      }, async (v) => {
        const names = (await send(v.base, 'GET', '/api/posts/3/likes')).body;
        expect(names).toHaveLength(3);
        expect(names.filter((n) => n === 'jaehoon')).toHaveLength(2);
      });
    } finally {
      await send(server.base, 'DELETE', '/api/posts/1/likes/2');
    }
  });

  it('🔴 교안 Step 7 🤔 — 게시물 라우터 «안» 에 붙이면 router.use(parseId) 를 빼고 mergeParams 없이도 동작 · 남기면 404', async () => {
    const nestedPosts = rep(read(R('routes/posts.js')), 'export default router;',
      "router.use('/:id/likes', likesRouter);\n\nexport default router;").replace("import express from 'express';\n", "import express from 'express';\nimport likesRouter from './likes.js';\n");
    const appNoMount = rep(read(R('app.js')), "app.use('/api/posts/:id/likes', likesRouter);\n", '');
    const childNoUse = rep(read(SNAP('step7-no-merge.likes.js')), '// 이 라우터에 들어온 요청은 모두 어느 게시물의 좋아요라서, 게시물 번호부터 확인한다.\nrouter.use(parseId);\n', '');
    await withVariant(PORT + 31, { 'app.js': appNoMount, 'routes/posts.js': nestedPosts, 'routes/likes.js': childNoUse }, async (v) => {
      expect(await send(v.base, 'GET', '/api/posts/3/likes')).toEqual({ status: 200, body: ['jaehoon'] });
      expect((await send(v.base, 'GET', '/api/posts/abc/likes')).status).toBe(404);
    });
    await withVariant(PORT + 32, { 'app.js': appNoMount, 'routes/posts.js': nestedPosts, 'routes/likes.js': read(SNAP('step7-no-merge.likes.js')) }, async (v) => {
      expect(await send(v.base, 'GET', '/api/posts/3/likes')).toEqual({ status: 404, body: { message: '그런 게시물은 없어요' } });
    });
  });

  it("🔴 교안 Step 7 ⚠️ — mergeParams 를 켜도 그 라우터의 router.param('id') 는 안 불린다", async () => {
    const mergedParam = rep(read(R('routes/likes.js')), 'router.use(parseId);\n', "router.param('id', parseId);\n");
    await withVariant(PORT + 33, { 'routes/likes.js': mergedParam }, async (v) => {
      expect(await send(v.base, 'GET', '/api/posts/3/likes')).toEqual({ status: 200, body: ['jaehoon', 'dahye'] });
    });
  });

  it('🔴 교안 Step 8 — models/Post 를 찾는 grep 은 그 파일 첫 줄 주석 하나(code/p3-29)', () => {
    const hits = execFileSync('git', ['grep', '-n', 'models/Post', 'code/p3-29', '--', '*.js', ':!lab', ':!test', ':!snapshots', ':!sql'], { cwd: P('.'), encoding: 'utf8' });
    expect(hits.trim().split('\n')).toEqual(['code/p3-29:models/Post.js:1:// ~/instagram-api/models/Post.js']);
    expect(read(LECTURE)).toContain('./models/Post.js:1:// ~/instagram-api/models/Post.js');
  });

  it('🔴 Step 1 — app.js 에 확인용 한 줄을 더하고 저장하면 --watch 가 «Change detected» · «Restarting» · function 3 · 시작 줄', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'p330-watch-'));
    for (const name of ['app.js', 'db.js', 'errors.js', 'routes', 'services', 'middlewares', 'schemas', 'package.json']) cpSync(R(name), join(dir, name), { recursive: true });
    symlinkSync(P('node_modules'), join(dir, 'node_modules'));
    writeFileSync(join(dir, '.env'), `DATABASE_URL=${GATE_URL}\nCORS_ORIGIN=${STUDENT_ORIGIN}\nPORT=${H1}\n`);
    const envv = { ...process.env };
    delete envv.NODE_ENV;
    const { spawn } = await import('node:child_process');
    const child = spawn(process.execPath, ['--watch', '--env-file=.env', 'app.js'], { cwd: dir, env: envv });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    try {
      for (let i = 0; i < 50 && !out.includes('기다리고'); i += 1) await sleep(100);
      await sleep(500);
      writeFileSync(join(dir, 'app.js'), rep(read(join(dir, 'app.js')), "app.use('/api/posts', postsRouter);\n",
        "console.log(typeof postsRouter, postsRouter.length);\napp.use('/api/posts', postsRouter);\n"));
      for (let i = 0; i < 50 && out.split('기다리고').length < 3; i += 1) await sleep(100);
      const after = out.slice(out.indexOf('Change detected'));
      expect(after.split('\n').slice(0, 4).map((l) => l.replace(dir, '/Users/hong/instagram-api').replace('/private', ''))).toEqual([
        "Change detected in '/Users/hong/instagram-api/app.js'", "Restarting 'app.js'", 'function 3', `서버가 ${H1}번 포트에서 기다리고 있어요.`,
      ]);
    } finally {
      child.kill();
      await sleep(200);
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('🔴 답안 [기초] — 공지를 안 따진 판은 셋째 요청에서 1번 공지의 1번 댓글을 지워 «다시 보기» 가 비어 있다', async () => {
    const anyNotice = rep(lab('homework1.js'), ' && one.noticeId === req.notice.id', '');
    await withLab({ files: { 'homework1.js': anyNotice }, entry: 'homework1.js', labPort: 4011, port: H1 + 1 }, async (srv) => {
      const got = await runHttp(lab('homework1.http'), 4011, srv.base);
      expect(got[2]).toMatchObject({ status: 200, body: { id: 1, noticeId: 1 } });
      expect(got[4].body).toEqual([]);
    });
  });

  it('🔴 답안 [기초] — router.use(findComment) 판의 둘째 요청은 3번 댓글(2번 공지)을 지운다', async () => {
    const useVersion = rep(lab('homework1.js'), "commentRouter.param('commentId', findComment);", 'commentRouter.use(findComment);');
    await withLab({ files: { 'homework1.js': useVersion }, entry: 'homework1.js', labPort: 4011, port: H1 + 2 }, async (srv) => {
      await send(srv.base, 'DELETE', '/api/notices/1/comments/2');
      expect((await send(srv.base, 'GET', '/api/notices/2/comments')).body).toEqual([]);
      expect((await send(srv.base, 'GET', '/api/notices/1/comments')).body.map((c) => c.id)).toEqual([1, 2]);
    });
  });

  it('🔴 답안 [기초] «더 좋아요» — 확인을 더한 판은 같은 실수에서 지우지 않고 500 으로 멈춘다', async () => {
    const guardUse = rep(read(SNAP('homework1-guard.js')), "commentRouter.param('commentId', findComment);", 'commentRouter.use(findComment);');
    await withLab({ files: { 'homework1.js': guardUse }, entry: 'homework1.js', labPort: 4011, port: H1 + 3 }, async (srv) => {
      const got = await runHttp(lab('homework1.http'), 4011, srv.base);
      expect(got.map((r) => r.status)).toEqual([200, 500, 500, 404, 200]);
      expect(got[4].body.map((c) => c.id)).toEqual([1, 2]);
    });
    await withLab({ files: { 'homework1.js': read(SNAP('homework1-guard.js')) }, entry: 'homework1.js', labPort: 4011, port: H1 + 3 }, async (srv) => {
      const got = await runHttp(lab('homework1.http'), 4011, srv.base);
      expect(got.map((r) => r.status)).toEqual([200, 200, 404, 404, 200]);
    });
  });

  const hw2 = () => Object.fromEntries(['app.js', 'data/notices.js', 'middlewares/adminOnly.js', 'routes/notices.js', 'routes/admin.js']
    .map((f) => [`homework2/${f}`, lab(`homework2/${f}`)]));
  it('🔴 답안 [응용] — nextId 를 데이터 파일에서 export let 으로 불러와 늘리면 서버는 뜨고, 올리는 순간 500 · TypeError: Assignment to constant variable.', async () => {
    const files = hw2();
    files['homework2/data/notices.js'] += '\nexport let nextId = 4;\n';
    files['homework2/routes/admin.js'] = rep(rep(files['homework2/routes/admin.js'],
      "import { notices } from '../data/notices.js';", "import { notices, nextId } from '../data/notices.js';"),
      '// 새 공지 번호는 공지를 올리는 이 파일만 쓴다\nlet nextId = 4;\n\n', '');
    await withLab({ files, entry: 'homework2/app.js', labPort: 4012, port: H1 + 4 }, async (srv) => {
      expect((await send(srv.base, 'GET', '/api/notices')).status).toBe(200);
      expect((await send(srv.base, 'POST', '/api/admin/notices', { headers: { 'X-Role': 'admin' }, json: { title: '새 공지' } })).status).toBe(500);
      await sleep(100);
      expect(srv.tail()).toContain('TypeError: Assignment to constant variable.');
      expect(srv.tail()).toMatch(/lab\/p3-30\/homework2\/routes\/admin\.js:12:10/);
    });
  });

  it('🔴 답안 [응용] — 로거 경로를 board.js 그대로(../../) 두면 ERR_MODULE_NOT_FOUND · 찾은 곳은 lab/middlewares/logger.js', async () => {
    const files = hw2();
    files['homework2/app.js'] = rep(files['homework2/app.js'], "'../../../middlewares/logger.js'", "'../../middlewares/logger.js'");
    const dir = studentLab(files);
    try {
      let msg = '';
      try {
        execFileSync(process.execPath, [join(dir, 'lab/p3-30/homework2/app.js')], { encoding: 'utf8', stdio: 'pipe', timeout: 5000 });
      } catch (e) {
        msg = String(e.stderr);
      }
      expect(msg).toContain('Error [ERR_MODULE_NOT_FOUND]: Cannot find module');
      expect(msg).toContain("/lab/middlewares/logger.js' imported from");
      expect(msg).toContain('/lab/p3-30/homework2/app.js');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
