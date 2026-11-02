// p3-28 「미들웨어 사용법과 체인 — req/res 다루기」 게이트 — 백엔드
//
// `5-express-core` 둘째 회차다. 수업 백엔드에서 바뀌는 학생 파일은 넷 — 로거에 걸린 시간(`middlewares/logger.js`),
// 쿼리 문자열을 검사하는 `validateQuery`(`middlewares/validate.js` — 검사한 값은 `res.locals.query`),
// 중복 확인 라우트가 그것을 쓰게(`routes/auth.js`), 이 회차 요청 둘(`requests/middleware.http` 끝)
// (`curriculum.md` 「`p3-28` 착수 결정」). 판정은 학생이 치는 `node app.js` 를 그대로 띄워 진짜 포트로 왕복한다.
//
// 축 ① Step 7 — 로거 한 줄 끝에 걸린 시간(«N.Nms»)
// 축 ② Step 8 — 서버를 띄운 뒤 첫 DB 요청이 그 뒤보다 훨씬 느리다 · 미리 `SELECT 1` 판은 «준비» 줄
// 축 ③ Step 1 — 라우트 안 차례: parseId 가 앞이면 404, validateBody 가 앞이면 400 · 999 + 틀린 본문은 둘 다 400
// 축 ④ Step 2 — lab/notices.js: 세 라우트가 같은 배열 · 배열 안 차례를 바꾸면 있는 공지도 404
// 축 ⑤ Step 3 — validateQuery 가 `req.query` 에 넣으면 500 + TypeError
// 축 ⑥ Step 4 — `req.query` 는 읽을 때마다 새 객체 · Object.assign 판은 에러 없이 빈칸 든 이메일을 «쓸 수 있어요»
// 축 ⑦ Step 5 — res.locals 판은 «이미 가입한 이메일이에요» · 요청마다 빈 객체 · 응답에 안 실린다
// 축 ⑧ Step 6 — 우리가 안 넣은 응답 헤더(X-Powered-By · ETag) · req.get 은 대소문자를 안 가린다
// 축 ⑨ `requests/middleware.http` 를 httpYac 으로 — 이 회차 요청 둘
// 축 ⑩ 실습·과제 — `lab/p3-28/`(학생 쪽 경로 주석은 `~/instagram-api/lab/…`)
// 축 ⑪ 이 회차 학생 파일 — `code/p3-27` 에서 네 파일만 바뀌었다
// 축 ⑫ 교안·답안 코드 블록의 줄이 코드베이스에 실재한다
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
const GATE_DB = 'p328_gate';
const GATE_URL = `postgresql://postgres:postgres@localhost:5432/${GATE_DB}`;
const STUDENT_ORIGIN = 'http://localhost:3001';
const PORT = 3682;
const SNAP_PORT = 3683;
const SIGNUP_MIGRATION = '20261029031804_add_user_signup_fields';

const read = (p) => readFileSync(p, 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 학생 파일은 이 회차 북마크 `code/p3-28` 을 풀어서 읽는다(없으면 작업트리 — 이 회차를 짓는 동안).
const ROUND = roundDir('code/p3-28');
const R = (rel) => join(ROUND.dir, rel);
const BEFORE = roundDir('code/p3-27');

let db = null;
let server = null;

const env = { DATABASE_URL: GATE_URL, CORS_ORIGIN: STUDENT_ORIGIN };

const seed = () =>
  execFileSync(process.execPath, [P('seed.js')],
    { cwd: P('.'), encoding: 'utf8', env: { ...process.env, ...env } });

const dropGate = async () => {
  const admin = new pg.Client(ADMIN);
  await admin.connect();
  await admin.query(
    `select pg_terminate_backend(pid) from pg_stat_activity where datname = '${GATE_DB}' and pid <> pg_backend_pid()`);
  await admin.query(`DROP DATABASE IF EXISTS ${GATE_DB}`);
  return admin;
};

const bootApp = (dir, port) => boot(join(dir, 'app.js'), {
  port, env: { ...env, PORT: String(port) }, ready: `${port}번 포트에서`,
});

// 학생 폴더를 임시 폴더에 옮겨 둔다(파일 하나를 바꾼 판을 띄울 때).
const STUDENT = ['app.js', 'db.js', 'errors.js', 'routes', 'services', 'middlewares', 'schemas', 'package.json'];
const copyStudent = (from, prefix) => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  for (const name of STUDENT) cpSync(join(from, name), join(dir, name), { recursive: true });
  symlinkSync(P('node_modules'), join(dir, 'node_modules'));
  return dir;
};

/** 학생 파일 몇 개를 갈아 끼운 판을 띄워 fn 을 돌린다. files: { '학생 경로': '바꿔 넣을 내용' } */
const withVariant = async (files, fn) => {
  const dir = copyStudent(ROUND.dir, 'p328-var-');
  for (const [rel, text] of Object.entries(files)) writeFileSync(join(dir, rel), text);
  const app = await bootApp(dir, SNAP_PORT);
  try {
    await fn(app);
  } finally {
    await app.stop();
    rmSync(dir, { recursive: true, force: true });
  }
};

/** 그 서버가 지금까지 찍은 줄 중 «기다리고 있어요» 다음부터. */
const linesAfterReady = (app) => {
  const all = app.tail().split('\n').filter((line) => line !== '');
  return all.slice(all.findIndex((line) => line.includes('포트에서')) + 1);
};
/** 요청을 보내고, 로거가 줄을 찍을 틈을 조금 준 뒤 새로 생긴 줄만 돌려준다. */
const newLines = async (app, send) => {
  const before = linesAfterReady(app).length;
  const res = await send();
  await sleep(150);
  return { res, lines: linesAfterReady(app).slice(before) };
};

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const getJson = async (url, init) => {
  const res = await fetch(url, init);
  const type = res.headers.get('content-type') ?? '';
  return { status: res.status, type, headers: res.headers, body: type.includes('json') ? await res.json() : await res.text() };
};
const patch = (base, path, body) => getJson(`${base}${path}`, { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(body) });
// requests/middleware.http 의 «앞뒤에 빈칸이 든 이메일로 중복 확인»
const SPACED_EMAIL = '/api/auth/check-duplicate?type=email&value=%20yuna@example.com%20';
// 로거 한 줄의 모양 — «메서드 주소 상태 코드 걸린시간ms»
const LINE = /^(GET|POST|PUT|PATCH|DELETE|OPTIONS) (\S+) (\d{3}) (\d+\.\d)ms$/;
const msOf = (line) => Number(LINE.exec(line)[4]);
const withoutMs = (line) => line.replace(/ \d+\.\dms$/, '');

beforeAll(async () => {
  const admin = await dropGate();
  await admin.query(`CREATE DATABASE ${GATE_DB}`);
  await admin.end();

  db = new pg.Client({ ...ADMIN, database: GATE_DB });
  await db.connect();
  for (const dir of [...P235_MIGRATIONS, SIGNUP_MIGRATION]) {
    await db.query(read(R(`prisma/migrations/${dir}/migration.sql`)));
  }
  seed();
  // 학생 DB 처럼 가입 화면에서 가입한 yuna 가 있다(`p3-22` Step 8 — yuna@example.com).
  await db.query(`INSERT INTO users (username, name, email) VALUES ('yuna', '김유나', 'yuna@example.com')`);

  server = await bootApp(ROUND.dir, PORT);
}, 120000);

afterAll(async () => {
  if (server) await server.stop();
  if (db) await db.end();
  const admin = await dropGate();
  await admin.end();
  ROUND.cleanup();
  BEFORE.cleanup();
}, 60000);

describe('축 ① — Step 7: 로거 한 줄 끝에 걸린 시간', () => {
  it('🔴 게시물 목록 · 나는 누구(401) · 없는 주소(404) · 로그인 — 모두 «메서드 주소 상태 N.Nms»', async () => {
    const list = await newLines(server, () => fetch(`${server.base}/api/posts?userId=9&limit=2`));
    expect(list.lines).toHaveLength(1);
    expect(list.lines[0]).toMatch(LINE);
    expect(withoutMs(list.lines[0])).toBe('GET /api/posts?userId=9&limit=2 200');
    const me = await newLines(server, () => fetch(`${server.base}/api/auth/me`));
    expect(me.lines.map(withoutMs)).toEqual(['GET /api/auth/me 401']);
    const nope = await newLines(server, () => fetch(`${server.base}/api/comments`));
    expect(nope.lines.map(withoutMs)).toEqual(['GET /api/comments 404']);
    const login = await newLines(server, () => fetch(`${server.base}/api/auth/login`, {
      method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ username: 'yuna', password: 'yuna1234' }),
    }));
    expect(login.lines.map(withoutMs)).toEqual(['POST /api/auth/login 200']);
    for (const line of [...me.lines, ...nope.lines, ...login.lines]) expect(line).toMatch(LINE);
  });

  it('🔴 logger.js — 시작 시각은 함수 맨 앞(performance.now) · 줄은 finish 에서 · toFixed(1)', () => {
    const src = read(R('middlewares/logger.js'));
    expect(src).toContain('  const start = performance.now();\n');
    expect(src).toContain('    const ms = performance.now() - start;\n');
    expect(src).toContain('    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms`);\n');
    expect(src.indexOf('const start')).toBeLessThan(src.indexOf("res.on('finish'"));
  });
});

describe('축 ② — Step 8: 느린 요청 찾기', () => {
  it('🔴 서버를 띄운 뒤 첫 DB 요청은 그 뒤 네 번보다 훨씬 느리다 · DB 를 안 쓰는 요청은 1ms 남짓', async () => {
    await withVariant({}, async (app) => {
      const lines = [];
      for (let i = 0; i < 5; i++) lines.push(...(await newLines(app, () => fetch(`${app.base}/api/posts?limit=2`))).lines);
      const ms = lines.map(msOf);
      expect(ms).toHaveLength(5);
      expect(ms[0]).toBeGreaterThan(2 * Math.max(...ms.slice(1)));
      expect(ms[0]).toBeGreaterThan(40);
      const root = await newLines(app, () => fetch(`${app.base}/`));
      expect(msOf(root.lines[0])).toBeLessThan(10);
    });
  }, 30000);

  // 🤔 3 해설 — 미리 연결해 두는 판의 대가. DB 가 꺼진 자리는 아무도 안 듣는 포트(5499)로 흉내 낸다.
  const DOWN_URL = 'postgresql://postgres:postgres@localhost:5499/p328_gate';
  const bootDown = (dir) => boot(join(dir, 'app.js'), {
    port: SNAP_PORT, env: { ...env, DATABASE_URL: DOWN_URL, PORT: String(SNAP_PORT) }, ready: `${SNAP_PORT}번 포트에서`,
  });
  const withDown = async (dbText, fn) => {
    const dir = copyStudent(ROUND.dir, 'p328-down-');
    if (dbText) writeFileSync(join(dir, 'db.js'), dbText);
    try { await fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
  };

  it('🔴 DB 가 꺼져 있으면 — 미리 안 하는 판은 뜨고 DB 요청만 500 · SELECT 1 판은 ECONNREFUSED 로 아예 안 뜬다', async () => {
    await withDown(null, async (dir) => {
      const app = await bootDown(dir);
      try {
        expect((await fetch(`${app.base}/api/posts?limit=2`)).status).toBe(500);
        expect((await fetch(`${app.base}/`)).status).toBe(200);
      } finally { await app.stop(); }
    });
    await withDown(`${read(R('db.js'))}${read(P('snapshots/p3-28.step8-warm.db-tail.js'))}`, async (dir) => {
      const err = await bootDown(dir).then(() => null, (e) => e);
      expect(err?.message).toMatch(/뜨자마자 끝났습니다/);
      expect(err.message).toContain("code: 'ECONNREFUSED'");
      expect(err.message).not.toContain('포트에서 기다리고');
    });
  }, 30000);

  it('🔴 어댑터(PrismaPg)를 쓰면 prisma.$connect() 는 DB 가 꺼져 있어도 성공한다 — 실제로 연결하지 않는다', async () => {
    const tail = "\nconst start = performance.now();\nawait prisma.$connect();\nconsole.log(`준비 ${(performance.now() - start).toFixed(1)}ms`);\n";
    await withDown(`${read(R('db.js'))}${tail}`, async (dir) => {
      const app = await bootDown(dir);
      try {
        expect(app.log).toMatch(/준비 \d+\.\dms\n/);
        expect((await fetch(`${app.base}/api/posts?limit=2`)).status).toBe(500);
      } finally { await app.stop(); }
    });
  }, 30000);

  it('🔴 db.js 끝에 SELECT 1 을 넣은 판은 «준비 N.Nms» 를 먼저 찍고 뜬다', async () => {
    const warm = `${read(R('db.js'))}${read(P('snapshots/p3-28.step8-warm.db-tail.js'))}`;
    await withVariant({ 'db.js': warm }, async (app) => {
      expect(app.log).toMatch(/준비 \d+\.\dms\n/);
      expect(app.log.indexOf('준비')).toBeLessThan(app.log.indexOf('포트에서'));
      const first = await newLines(app, () => fetch(`${app.base}/api/posts?limit=2`));
      expect(withoutMs(first.lines[0])).toBe('GET /api/posts?limit=2 200');
    });
  }, 30000);
});

describe('축 ③ — Step 1: 라우트 안 차례', () => {
  it('🔴 지금 판(parseId → validateBody) — abc + 틀린 본문 404 · 999 + 틀린 본문 400 · 999 + 맞는 본문 404', async () => {
    expect(await patch(server.base, '/api/posts/abc', { likeCount: -1 })).toMatchObject({ status: 404, body: { message: '그런 게시물은 없어요' } });
    const bad = await patch(server.base, '/api/posts/999', { likeCount: -1 });
    expect(bad.status).toBe(400);
    expect(bad.body.message).toBe('보낸 내용이 규칙에 안 맞아요');
    expect(bad.body.details.properties.likeCount.errors).toEqual(['Too small: expected number to be >=0']);
    expect(await patch(server.base, '/api/posts/999', { likeCount: 7 })).toMatchObject({ status: 404, body: { message: '그런 게시물은 없어요' } });
  });

  it('🔴 스냅숏은 PATCH 줄에서 두 미들웨어의 자리만 바꿨다', () => {
    const real = read(R('routes/posts.js'));
    expect(read(P('snapshots/p3-28.step1-body-first.posts.js'))).toBe(real.replace(
      "router.patch('/:id', parseId, validateBody(postUpdateSchema), async",
      "router.patch('/:id', validateBody(postUpdateSchema), parseId, async"));
  });

  it('🔴 자리를 바꾼 판 — abc + 틀린 본문이 400 · abc + 맞는 본문은 그대로 404', async () => {
    await withVariant({ 'routes/posts.js': read(P('snapshots/p3-28.step1-body-first.posts.js')) }, async (app) => {
      const res = await newLines(app, () => patch(app.base, '/api/posts/abc', { likeCount: -1 }));
      expect(res.res.status).toBe(400);
      expect(res.lines.map(withoutMs)).toEqual(['PATCH /api/posts/abc 400']);
      expect((await patch(app.base, '/api/posts/abc', { likeCount: 7 })).status).toBe(404);
      expect((await patch(app.base, '/api/posts/999', { likeCount: -1 })).status).toBe(400);
    });
  });
});

// ── 실습 서버 — 학생 쪽 `~/instagram-api/lab/` 처럼 임시 폴더에 놓고 띄운다 ──
const studentLab = (files) => {
  const dir = mkdtempSync(join(tmpdir(), 'p328-lab-'));
  mkdirSync(join(dir, 'lab'));
  cpSync(R('middlewares'), join(dir, 'middlewares'), { recursive: true });
  cpSync(R('errors.js'), join(dir, 'errors.js'));
  writeFileSync(join(dir, 'package.json'), '{"type":"module"}');
  symlinkSync(P('node_modules'), join(dir, 'node_modules'));
  for (const [name, from] of Object.entries(files)) {
    // 여러 줄이면 파일 내용, 한 줄이면 복사할 파일 경로(학생 파일은 «// ~/…» 로 시작해 앞 글자로는 못 가른다)
    if (from.includes('\n')) writeFileSync(join(dir, 'lab', name), from);
    else cpSync(from, join(dir, 'lab', name));
  }
  return dir;
};
const LAB = (name) => P(`lab/p3-28/${name}`);
const withLab = async (name, from, port, fn) => {
  const dir = studentLab({ [name]: from });
  const lab = await boot(join(dir, 'lab', name), { port, ready: `${port}번 포트에서` });
  try {
    await fn(lab);
  } finally {
    await lab.stop();
    rmSync(dir, { recursive: true, force: true });
  }
};

describe('축 ④ — Step 2: lab/notices.js (4005) — 미들웨어 배열', () => {
  it('🔴 처음 판 — 세 라우트가 parseNoticeId, findNotice 를 따로 적는다 · 끝 판은 그 둘을 noticeTarget 하나로', () => {
    const start = read(P('snapshots/p3-28.step2-start.notices.js'));
    const end = read(LAB('notices.js'));
    expect(start.match(/parseNoticeId, findNotice, \(req, res\)/g)).toHaveLength(3);
    expect(end).toContain('const noticeTarget = [parseNoticeId, findNotice];\n');
    expect(end.match(/noticeTarget, \(req, res\)/g)).toHaveLength(3);
    // 함수와 라우트 몸통은 그대로 — 라우트 줄의 미들웨어 자리와 배열 한 줄만 다르다
    const norm = (s) => s.replace(/parseNoticeId, findNotice, \(req/g, 'noticeTarget, (req')
      .replace('const noticeTarget = [parseNoticeId, findNotice];\n\n', '');
    expect(norm(end)).toBe(norm(start));
  });

  for (const [label, from] of [['처음 판', () => P('snapshots/p3-28.step2-start.notices.js')], ['배열 판', () => LAB('notices.js')]]) {
    it(`🔴 ${label} — GET /1 · PATCH /2 · DELETE /3 · abc 와 9 는 404`, async () => {
      await withLab('notices.js', from(), 4005, async (lab) => {
        expect(await getJson(`${lab.base}/api/notices/1`)).toMatchObject({ status: 200, body: { id: 1, title: '서버 점검 안내' } });
        expect(await patch(lab.base, '/api/notices/2', { title: '새 기능 두 가지 소개' })).toMatchObject({ status: 200, body: { id: 2, title: '새 기능 두 가지 소개' } });
        expect(await getJson(`${lab.base}/api/notices/3`, { method: 'DELETE' })).toMatchObject({ status: 200, body: { id: 3, title: '이용 약관 변경' } });
        expect(await getJson(`${lab.base}/api/notices/3`)).toMatchObject({ status: 404, body: { message: '그런 공지는 없어요' } });
        expect(await getJson(`${lab.base}/api/notices/abc`)).toMatchObject({ status: 404, body: { message: '그런 공지는 없어요' } });
        expect(await getJson(`${lab.base}/api/notices/9`)).toMatchObject({ status: 404 });
      });
    });
  }

  it('🔴 배열 안 차례를 바꾸면 에러 없이 있는 공지도 404 — findNotice 가 req.noticeId 를 받기 전에 실행', async () => {
    const swapped = read(LAB('notices.js')).replace('[parseNoticeId, findNotice]', '[findNotice, parseNoticeId]');
    expect(swapped).not.toBe(read(LAB('notices.js')));
    await withLab('notices.js', swapped, 4005, async (lab) => {
      expect(await getJson(`${lab.base}/api/notices/1`)).toMatchObject({ status: 404, body: { message: '그런 공지는 없어요' } });
      await sleep(150);
      expect(lab.tail()).not.toMatch(/Error/);
      expect(lab.tail()).toMatch(/GET \/api\/notices\/1 404 \d+\.\dms/);
    });
  });
});

describe('축 ⑤ — Step 3: 검사한 값을 req.query 에 넣으면', () => {
  it('🔴 스냅숏 validate.js = 끝 판에서 «res.locals.query =» 줄을 «req.query =» 로 · 주석은 빼고', () => {
    expect(read(P('snapshots/p3-28.step3-set-query.validate.js'))).toBe(stepValidate('    req.query = result.data;\n'));
  });

  it('🔴 스냅숏 auth.js = 끝 판에서 라우트가 res.locals.query 대신 req.query 를 읽는 한 줄만 다르다', () => {
    expect(read(P('snapshots/p3-28.step3-read-query.auth.js'))).toBe(read(R('routes/auth.js'))
      .replace('  const { type, value } = res.locals.query;\n', '  const { type, value } = req.query;\n'));
  });

  it('🔴 그 판 — 중복 확인이 500 「서버에서 문제가 생겼어요」 · 창에 TypeError · type 이 틀리면 그대로 400', async () => {
    await withVariant({
      'middlewares/validate.js': read(P('snapshots/p3-28.step3-set-query.validate.js')),
      'routes/auth.js': read(P('snapshots/p3-28.step3-read-query.auth.js')),
    }, async (app) => {
      const res = await newLines(app, () => getJson(`${app.base}/api/auth/check-duplicate?type=username&value=jaehoon`));
      expect(res.res).toMatchObject({ status: 500, body: { message: '서버에서 문제가 생겼어요' } });
      expect(res.lines[0]).toBe('TypeError: Cannot set property query of #<IncomingMessage> which has only a getter');
      expect(res.lines[1]).toMatch(/^ {4}at file:\/\/\/.*\/middlewares\/validate\.js:28:15$/);
      expect(withoutMs(res.lines.at(-1))).toBe('GET /api/auth/check-duplicate?type=username&value=jaehoon 500');
      const nick = await getJson(`${app.base}/api/auth/check-duplicate?type=nickname&value=jaehoon`);
      expect(nick.status).toBe(400);
    });
  });
});

// 끝 판 validate.js 에서 validateQuery 의 «담는 줄» 만 바꾸고 그 위 주석을 뺀 판
const stepValidate = (line) => read(R('middlewares/validate.js'))
  .replace(/    \/\/ req\.query 는[^\n]*\n    res\.locals\.query = result\.data;\n/, line);

describe('축 ⑥ — Step 4: req.query 는 읽을 때마다 새로 만든다', () => {
  it('🔴 Express 5.2.1 request.js — query 는 getter · 읽을 때마다 주소에서 다시 만든다', () => {
    const src = read(P('node_modules/express/lib/request.js'));
    expect(src).toContain("defineGetter(req, 'query', function query(){");
    expect(src).toContain('  var querystring = parse(this).query;\n\n  return queryparse(querystring);\n});');
    expect(JSON.parse(read(P('node_modules/express/package.json'))).version).toBe('5.2.1');
  });

  it('🔴 req.query === req.query 는 false · 꺼낸 객체를 고쳐도 다시 읽으면 처음 값', async () => {
    const probe = `import express from 'express';
const app = express();
app.get('/q', (req, res) => {
  const first = req.query === req.query;
  Object.assign(req.query, { value: 'x' });
  res.json({ first, value: req.query.value });
});
app.listen(4006, () => console.log('4006번 포트에서'));
`;
    await withLab('probe.js', probe, 4006, async (lab) => {
      expect((await getJson(`${lab.base}/q?value=%20a%20`)).body).toEqual({ first: false, value: ' a ' });
    });
  });

  it('🔴 스냅숏 validate.js = 끝 판에서 담는 줄을 Object.assign 으로', () => {
    expect(read(P('snapshots/p3-28.step4-object-assign.validate.js'))).toBe(stepValidate('    Object.assign(req.query, result.data);\n'));
  });

  it('🔴 그 판 — 에러는 없고 앞뒤 빈칸 든 yuna@example.com 이 «쓸 수 있어요»(거짓) · 빈칸 없으면 «이미 가입한 이메일이에요»', async () => {
    await withVariant({
      'middlewares/validate.js': read(P('snapshots/p3-28.step4-object-assign.validate.js')),
      'routes/auth.js': read(P('snapshots/p3-28.step3-read-query.auth.js')),
    }, async (app) => {
      const spaced = await newLines(app, () => getJson(`${app.base}${SPACED_EMAIL}`));
      expect(spaced.res).toMatchObject({ status: 200, body: { available: true, message: '쓸 수 있어요' } });
      expect(spaced.lines.map(withoutMs)).toEqual([`GET ${SPACED_EMAIL} 200`]);
      expect(await getJson(`${app.base}/api/auth/check-duplicate?type=email&value=yuna@example.com`))
        .toMatchObject({ body: { available: false, message: '이미 가입한 이메일이에요' } });
    });
  });

  it('🔴 그 이메일로 가입하면 409 — 화면이 «쓸 수 있어요» 를 믿고 보내도 막힌다', async () => {
    const res = await getJson(`${server.base}/api/auth/signup`, {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ emailOrPhone: ' yuna@example.com ', name: '김유나', username: 'yuna2', password: 'yuna1234' }),
    });
    expect(res).toMatchObject({ status: 409, body: { message: '이미 쓰고 있는 사용자 이름이나 연락처예요' } });
  });
});

describe('축 ⑦ — Step 5: res.locals 에 담는다', () => {
  it('🔴 끝 판 — 빈칸 든 이메일도 «이미 가입한 이메일이에요» · 사용자 이름 jaehoon · 하이픈 든 휴대폰 · 틀린 type 400', async () => {
    expect(await getJson(`${server.base}${SPACED_EMAIL}`)).toMatchObject({ status: 200, body: { available: false, message: '이미 가입한 이메일이에요' } });
    expect(await getJson(`${server.base}/api/auth/check-duplicate?type=username&value=jaehoon`)).toMatchObject({ body: { available: false, message: '이미 쓰고 있는 사용자 이름이에요' } });
    expect(await getJson(`${server.base}/api/auth/check-duplicate?type=phone&value=010-1234-5678`)).toMatchObject({ body: { available: true, message: '쓸 수 있어요' } });
    const nick = await getJson(`${server.base}/api/auth/check-duplicate?type=nickname&value=jaehoon`);
    expect(nick.status).toBe(400);
    expect(nick.body.details.properties.type.errors).toEqual(['Invalid option: expected one of "email"|"phone"|"username"']);
  });

  it('🔴 validate.js — validateQuery 는 validateBody 와 담는 곳만 다르다 · auth.js 의 z · BadRequestError import 가 빠졌다', () => {
    const src = read(R('middlewares/validate.js'));
    const body = src.slice(src.indexOf('export function validateBody'), src.indexOf('export function validateQuery'));
    const query = src.slice(src.indexOf('export function validateQuery'));
    expect(query.replace(/    \/\/ req\.query 는[^\n]*\n/, '')
      .replace('validateQuery', 'validateBody').replace('safeParse(req.query)', 'safeParse(req.body)')
      .replace('res.locals.query = result.data', 'req.body = result.data')).toBe(body.replace(/\n$/, ''));
    const auth = read(R('routes/auth.js'));
    expect(auth).not.toContain("import { z } from 'zod';");
    expect(auth).toContain("import { validateBody, validateQuery } from '../middlewares/validate.js';");
    expect(auth).toContain("import { UnauthorizedError } from '../errors.js';");
    expect(auth).toContain("router.get('/check-duplicate', validateQuery(checkDuplicateSchema), async (req, res) => {\n  const { type, value } = res.locals.query;\n");
  });

  it('🔴 res.locals 는 요청마다 새로 생기는 빈 객체(null 프로토타입) · 응답 본문에도 헤더에도 안 실린다', async () => {
    const probe = `import express from 'express';
const app = express();
app.get('/a', (req, res, next) => { res.locals.who = 'a'; next(); }, (req, res) => {
  res.json({ who: res.locals.who, proto: Object.getPrototypeOf(res.locals) === null });
});
app.get('/b', (req, res) => res.json({ keys: Object.keys(res.locals) }));
app.listen(4006, () => console.log('4006번 포트에서'));
`;
    await withLab('probe.js', probe, 4006, async (lab) => {
      const a = await getJson(`${lab.base}/a`);
      expect(a.body).toEqual({ who: 'a', proto: true });
      expect([...a.headers.keys()].some((k) => k.includes('who'))).toBe(false);
      expect((await getJson(`${lab.base}/b`)).body).toEqual({ keys: [] });
    });
  });
});

describe('축 ⑧ — Step 6: 요청과 응답 펼쳐 보기', () => {
  it('🔴 중복 확인 응답 — 우리가 안 넣은 X-Powered-By: Express · ETag · Content-Type 의 charset', async () => {
    const res = await fetch(`${server.base}/api/auth/check-duplicate?type=username&value=jaehoon`);
    expect(res.headers.get('x-powered-by')).toBe('Express');
    expect(res.headers.get('etag')).toMatch(/^W\/"/);
    expect(res.headers.get('content-type')).toBe('application/json; charset=utf-8');
  });

  it('🔴 req.get 은 헤더 이름의 대소문자를 안 가리고, req.headers 는 소문자 키만 · res.set 은 응답 헤더 하나', async () => {
    const probe = `import express from 'express';
const app = express();
app.get('/h', (req, res) => {
  res.set('X-Checked', 'yes');
  res.json({ get: req.get('x-role'), upper: req.headers['X-Role'] ?? null, lower: req.headers['x-role'], path: req.path, url: req.originalUrl });
});
app.listen(4006, () => console.log('4006번 포트에서'));
`;
    await withLab('probe.js', probe, 4006, async (lab) => {
      const res = await getJson(`${lab.base}/h?a=1`, { headers: { 'X-Role': 'admin' } });
      expect(res.body).toEqual({ get: 'admin', upper: null, lower: 'admin', path: '/h', url: '/h?a=1' });
      expect(res.headers.get('x-checked')).toBe('yes');
    });
  });
});

describe('축 ⑨ — requests/middleware.http 를 httpYac 으로', () => {
  it('🔴 끝에 이 회차 요청 둘 — 번호도 본문도 틀린 수정 404 · 빈칸 든 이메일 중복 확인 «이미 가입한 이메일이에요»', () => {
    const text = read(R('requests/middleware.http'));
    expect(text.startsWith(read(BEFORE.dir ? join(BEFORE.dir, 'requests/middleware.http') : P('requests/middleware.http')))).toBe(true);
    const dir = mkdtempSync(join(tmpdir(), 'p328-http-'));
    try {
      writeFileSync(join(dir, 'middleware.http'), text.replaceAll('http://localhost:3000', `http://localhost:${PORT}`));
      const send = (name) => {
        const out = execFileSync(P('node_modules/.bin/httpyac'), ['send', 'middleware.http', '--name', name, '--json'],
          { encoding: 'utf-8', cwd: dir });
        return JSON.parse(out).requests[0].response;
      };
      const fix = send('번호도 본문도 틀린 수정');
      expect(fix.statusCode).toBe(404);
      expect(JSON.parse(fix.body)).toEqual({ message: '그런 게시물은 없어요' });
      const dup = send('앞뒤에 빈칸이 든 이메일로 중복 확인');
      expect(dup.statusCode).toBe(200);
      expect(JSON.parse(dup.body)).toEqual({ available: false, message: '이미 가입한 이메일이에요' });
      expect(dup.headers['x-powered-by']).toBe('Express');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('축 ⑩ — 실습·과제 (lab/p3-28)', () => {
  it('🔴 직접 해보기 1 (4001) — PATCH 앞 [noticeTarget, checkTitle] · abc 404 · 9 + 빈 제목 404 · 1 + 빈 제목 400 · 1 + 제목 200', async () => {
    await withLab('practice1.js', LAB('practice1.js'), 4001, async (lab) => {
      expect(await patch(lab.base, '/api/notices/1', { title: '' })).toMatchObject({ status: 400, body: { message: '제목을 적어 주세요' } });
      expect(await patch(lab.base, '/api/notices/abc', { title: '' })).toMatchObject({ status: 404, body: { message: '그런 공지는 없어요' } });
      expect(await patch(lab.base, '/api/notices/9', {})).toMatchObject({ status: 404 });
      expect(await patch(lab.base, '/api/notices/1', { title: '서버 점검 시간 변경' })).toMatchObject({ status: 200, body: { id: 1, title: '서버 점검 시간 변경' } });
    });
  });

  it('🔴 직접 해보기 1 요구사항 4 — checkTitle 을 앞에 둔 판은 9 + 빈 제목이 400', async () => {
    const swapped = read(LAB('practice1.js')).replace('noticeTarget, checkTitle, (req, res)', 'checkTitle, noticeTarget, (req, res)');
    expect(swapped).not.toBe(read(LAB('practice1.js')));
    await withLab('practice1.js', swapped, 4001, async (lab) => {
      expect((await patch(lab.base, '/api/notices/9', {})).status).toBe(400);
      expect((await patch(lab.base, '/api/notices/abc', {})).status).toBe(400);
    });
  });

  it('🔴 직접 해보기 2 (4002) — 검색어 앞뒤 빈칸을 다듬어 찾는다 · 빈칸만·없으면 400 · req.query 로 읽은 판은 0명', async () => {
    await withLab('practice2.js', LAB('practice2.js'), 4002, async (lab) => {
      expect(await getJson(`${lab.base}/api/members?keyword=%20min%20`)).toMatchObject({ status: 200, body: [{ id: 2, username: 'minji' }, { id: 4, username: 'minseo' }] });
      expect(await getJson(`${lab.base}/api/members?keyword=hye`)).toMatchObject({ status: 200, body: [{ id: 3, username: 'dahye' }] });
      expect(await getJson(`${lab.base}/api/members?keyword=%20`)).toMatchObject({ status: 400, body: { message: '보낸 내용이 규칙에 안 맞아요' } });
      expect(await getJson(`${lab.base}/api/members`)).toMatchObject({ status: 400, body: { message: '보낸 내용이 규칙에 안 맞아요' } });
    });
    const raw = read(LAB('practice2.js')).replace('const { keyword } = res.locals.query;', 'const { keyword } = req.query;');
    expect(raw).not.toBe(read(LAB('practice2.js')));
    await withLab('practice2.js', raw, 4002, async (lab) => {
      expect(await getJson(`${lab.base}/api/members?keyword=%20min%20`)).toMatchObject({ status: 200, body: [] });
    });
  });

  it('🔴 직접 해보기 3 (4003) — slowLogger(500): fast 는 줄 없음 · slow(0.8초)만 «느린 요청» · 기준 0 이면 둘 다', async () => {
    await withLab('practice3.js', LAB('practice3.js'), 4003, async (lab) => {
      expect(await getJson(`${lab.base}/api/fast`)).toMatchObject({ status: 200, body: { message: '바로 답해요' } });
      expect(await getJson(`${lab.base}/api/slow`)).toMatchObject({ status: 200, body: { message: '0.8초 뒤에 답해요' } });
      await sleep(150);
      const lines = linesAfterReady(lab);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatch(/^느린 요청 — GET \/api\/slow (8\d\d)\.\dms$/);
    });
    const zero = read(LAB('practice3.js')).replace('app.use(slowLogger(500));', 'app.use(slowLogger(0));');
    expect(zero).not.toBe(read(LAB('practice3.js')));
    await withLab('practice3.js', zero, 4003, async (lab) => {
      await fetch(`${lab.base}/api/fast`);
      await fetch(`${lab.base}/api/slow`);
      await sleep(150);
      expect(linesAfterReady(lab).map((l) => l.replace(/ \d+\.\dms$/, ''))).toEqual(['느린 요청 — GET /api/fast', '느린 요청 — GET /api/slow']);
    });
  });

  it('🔴 과제 [기초] (4011) — X-Role: admin 이면 지운다 · 없으면 403 · 배열 안 차례를 바꾸면 admin 도 403', async () => {
    await withLab('homework1.js', LAB('homework1.js'), 4011, async (lab) => {
      expect(await getJson(`${lab.base}/api/notices/1`, { method: 'DELETE' })).toMatchObject({ status: 403, body: { message: '관리자만 할 수 있어요' } });
      expect(await getJson(`${lab.base}/api/notices/1`, { method: 'DELETE', headers: { 'X-Role': 'member' } })).toMatchObject({ status: 403 });
      expect(await getJson(`${lab.base}/api/notices/1`, { method: 'DELETE', headers: { 'x-role': 'admin' } })).toMatchObject({ status: 200, body: { id: 1 } });
      expect(await getJson(`${lab.base}/api/notices`)).toMatchObject({ status: 200, body: [{ id: 2 }, { id: 3 }] });
    });
    const swapped = read(LAB('homework1.js')).replace('[readRole, requireAdmin]', '[requireAdmin, readRole]');
    expect(swapped).not.toBe(read(LAB('homework1.js')));
    await withLab('homework1.js', swapped, 4011, async (lab) => {
      expect(await getJson(`${lab.base}/api/notices/1`, { method: 'DELETE', headers: { 'X-Role': 'admin' } })).toMatchObject({ status: 403 });
    });
  });

  it('🔴 과제 [응용] (4012) — 응답마다 X-Request-Id · 로거 줄 앞에 ID 앞 8자 · 500 본문에 requestId · 창에 같은 ID', async () => {
    await withLab('homework2.js', LAB('homework2.js'), 4012, async (lab) => {
      const ok = await getJson(`${lab.base}/api/notices`);
      const id = ok.headers.get('x-request-id');
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      const boom = await getJson(`${lab.base}/api/boom`);
      expect(boom.status).toBe(500);
      expect(boom.body).toEqual({ message: '서버에서 문제가 생겼어요', requestId: boom.headers.get('x-request-id') });
      const nope = await getJson(`${lab.base}/api/nope`);
      expect(nope.status).toBe(404);
      expect(nope.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
      await sleep(150);
      const tail = lab.tail();
      expect(tail).toMatch(new RegExp(`\\[${id.slice(0, 8)}\\] GET /api/notices 200 \\d+\\.\\dms`));
      expect(tail).toContain(`[${boom.body.requestId.slice(0, 8)}] Error: 일부러 낸 에러예요`);
      expect(tail).toMatch(new RegExp(`\\[${boom.body.requestId.slice(0, 8)}\\] GET /api/boom 500`));
    });
  });

  it('🔴 과제 [응용] 요구사항 5 — requestId 를 404 미들웨어 바로 위로 옮기면 라우트가 답한 응답엔 ID 가 없다 · 404 에는 있다', async () => {
    const src = read(LAB('homework2.js'));
    const moved = src.replace('app.use(requestId);\n', '')
      .replace("app.use((req, res) => {\n  res.status(404)", "app.use(requestId);\n\napp.use((req, res) => {\n  res.status(404)");
    expect(moved).not.toBe(src);
    await withLab('homework2.js', moved, 4012, async (lab) => {
      const ok = await fetch(`${lab.base}/api/notices`);
      expect(ok.headers.get('x-request-id')).toBeNull();
      const nope = await fetch(`${lab.base}/api/nope`);
      expect(nope.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
      await sleep(150);
      expect(lab.tail()).toMatch(/\[undefined\] GET \/api\/notices 200/);
    });
  });
});

describe('축 ⑪ — 이 회차 학생 파일', () => {
  it('🔴 code/p3-27 에서 바뀐 학생 파일은 넷 — logger.js · validate.js · routes/auth.js · requests/middleware.http', () => {
    // 북마크가 있으면 두 북마크 사이, 없으면(이 회차를 짓는 중) 작업트리와 비교한다.
    const files = execFileSync('git', ['diff', '--name-only', 'code/p3-27', ...(ROUND.fromBookmark ? ['code/p3-28'] : []), '--',
      'app.js', 'db.js', 'errors.js', 'routes', 'services', 'middlewares', 'schemas', 'requests', 'package.json', 'seed.js', 'prisma'],
    { cwd: P('.'), encoding: 'utf8' }).trim().split('\n').filter(Boolean);
    expect(files.sort()).toEqual(['middlewares/logger.js', 'middlewares/validate.js', 'requests/middleware.http', 'routes/auth.js']);
  });

  it('🔴 경로 주석 — 학생 쪽 lab 파일은 ~/instagram-api/lab/… · 실습 .http 는 포트가 맞다', () => {
    for (const name of ['notices.js', 'practice1.js', 'practice2.js', 'practice3.js', 'homework1.js', 'homework2.js']) {
      expect(read(LAB(name)).split('\n')[0]).toBe(`// ~/instagram-api/lab/${name}`);
    }
    expect(existsSync(LAB('practice1.http'))).toBe(true);
    expect(read(LAB('practice1.http'))).not.toMatch(/localhost:(?!4001)\d+/);
    expect(read(LAB('homework1.http'))).not.toMatch(/localhost:(?!4011)\d+/);
  });
});
