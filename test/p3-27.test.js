// p3-27 「Express 와 미들웨어의 구조」 게이트 — 백엔드
//
// `5-express-core` 첫 회차다. 수업 백엔드에 요청 기록 미들웨어 하나(`middlewares/logger.js`)를 더하고, 이미 붙여 둔
// `cors()`·`express.json()`·`cookieParser()` 가 사슬에서 무엇을 하는지, Express 가 매개변수 개수(`fn.length`)로
// 미들웨어를 어떻게 가르는지를 본다(`curriculum.md` 「`p3-27` 착수 결정」). 판정은 학생이 치는 `node app.js` 를 그대로
// 띄워 진짜 포트로 왕복하고, 터미널에 찍힌 줄을 잰다(`boot.js`).
//
// 축 ① Step 2 — 로거가 요청마다 «메서드 주소 상태 코드» 한 줄 · 라우터 안에서도 주소 전체(`req.originalUrl`)
// 축 ② Step 2 의 반례 — `req.url` 로 적은 판은 라우터 안 요청을 `/1` 처럼 잘라 적는다
// 축 ③ Step 3 — 아무것도 안 하는 미들웨어를 끼운 판: 응답이 안 오고 로거 줄도 없다
// 축 ④ Step 4 — 잠깐 끼운 함수가 cookieParser 위면 `undefined`, 아래면 쿠키 객체
// 축 ⑤ Step 5 — 프리플라이트는 cors 가 204 로 답하고 끝 · 로거를 cors 뒤로 옮기면 그 줄이 사라진다
// 축 ⑥ Step 6 — 깨진 JSON 은 400 · 글자(text/plain) 본문은 express.json 이 그냥 넘겨 `req.body` 가 undefined
// 축 ⑦ Step 8 — 에러 미들웨어에 기본값을 준 판은 Express 기본 처리(HTML)로 답한다
// 축 ⑧ 이 회차 학생 파일 — `app.js` 는 `code/p3-23` 에서 로거 두 줄만 더했다
// 축 ⑨ 실습·과제 — `lab/p3-27/`(학생 쪽 경로도 `~/instagram-api/lab/p3-27/…` — 2026-11-05 앞 회차 실습 파일과 이름이 겹치지 않게 옮겼다.
//   실습 파일은 북마크 `code/p3-27` 이 아니라 `main` 에서 읽는다. 북마크의 lab 은 옛 평평한 경로 주석·`../` import 그대로다)
// 축 ⑬ 학생 낭독 집중 검수(2026-11-05) — 로거 첫 판의 거짓 200 · 304 · 🙋 next() 아래 · 🙋 세 줄의 차례 · 틀린 판 · 앞 회차에 잇는 문장
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, mkdtempSync, rmSync, cpSync, symlinkSync, writeFileSync, mkdirSync } from 'node:fs';
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
const GATE_DB = 'p327_gate';
const GATE_URL = `postgresql://postgres:postgres@localhost:5432/${GATE_DB}`;
const STUDENT_ORIGIN = 'http://localhost:5173';
const PORT = 3672;
const SNAP_PORT = 3673;
const SIGNUP_MIGRATION = '20261029031804_add_user_signup_fields';

const read = (p) => readFileSync(p, 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 학생 파일은 이 회차 북마크 `code/p3-27` 을 풀어서 읽는다(없으면 작업트리 — 이 회차를 짓는 동안).
const ROUND = roundDir('code/p3-27');
const R = (rel) => join(ROUND.dir, rel);
const BEFORE = roundDir('code/p3-23');

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

// 학생 폴더를 임시 폴더에 옮겨 둔다(app.js 하나를 바꾼 판을 띄울 때).
const STUDENT = ['app.js', 'db.js', 'errors.js', 'routes', 'services', 'middlewares', 'schemas', 'package.json'];
const copyStudent = (from, prefix) => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  for (const name of STUDENT) cpSync(join(from, name), join(dir, name), { recursive: true });
  symlinkSync(P('node_modules'), join(dir, 'node_modules'));
  return dir;
};

/** app.js 를 스냅숏으로 갈아 끼운 판을 띄워 fn 을 돌린다. */
const withSnapshot = async (snap, fn) => {
  const dir = copyStudent(ROUND.dir, 'p327-snap-');
  cpSync(P(`snapshots/${snap}`), join(dir, 'app.js'));
  const app = await bootApp(dir, SNAP_PORT);
  try {
    await fn(app);
  } finally {
    await app.stop();
    rmSync(dir, { recursive: true, force: true });
  }
};

/** 그 서버가 지금까지 찍은 줄 중 «기다리고 있어요» 다음부터. */
const linesAfterReady = (app) => app.tail().split('\n').filter((line) => line !== '').slice(1);
/** 요청을 보내고, 로거가 줄을 찍을 틈을 조금 준 뒤 새로 생긴 줄만 돌려준다. */
const newLines = async (app, send) => {
  const before = linesAfterReady(app).length;
  const res = await send();
  await sleep(150);
  return { res, lines: linesAfterReady(app).slice(before) };
};

const JSON_HEADERS = { 'Content-Type': 'application/json' };
// requests/posts.http 의 중괄호를 닫지 않은 요청 — httpYac 은 본문 끝 줄바꿈을 떼고 보낸다(17바이트).
const BROKEN = '{\n  "authorId": 3';
// requests/cors.http 의 「올리기 전에 미리 물어보는 요청 — 우리 프론트」
const preflight = (base) => fetch(`${base}/api/posts`, {
  method: 'OPTIONS',
  headers: { Origin: STUDENT_ORIGIN, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' },
});

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

describe('축 ① — Step 2: 요청 기록 미들웨어', () => {
  it('🔴 게시물 목록 → «GET /api/posts?limit=2 200» 한 줄', async () => {
    const { res, lines } = await newLines(server, () => fetch(`${server.base}/api/posts?limit=2`));
    expect(res.status).toBe(200);
    expect(lines).toEqual(['GET /api/posts?limit=2 200']);
  });

  it('🔴 라우터 안 주소도 전체가 찍힌다 — «GET /api/posts/1 200» · 없는 게시물 404 · 없는 주소 404', async () => {
    expect((await newLines(server, () => fetch(`${server.base}/api/posts/1`))).lines).toEqual(['GET /api/posts/1 200']);
    expect((await newLines(server, () => fetch(`${server.base}/api/posts/999`))).lines).toEqual(['GET /api/posts/999 404']);
    expect((await newLines(server, () => fetch(`${server.base}/api/nope`))).lines).toEqual(['GET /api/nope 404']);
    expect((await newLines(server, () => fetch(`${server.base}/api/comments`))).lines).toEqual(['GET /api/comments 404']);
  });

  it('🔴 로그인 · 나는 누구(401)도 찍힌다', async () => {
    const login = await newLines(server, () => fetch(`${server.base}/api/auth/login`, {
      method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ username: 'jaehoon', password: '1' }),
    }));
    expect(login.lines).toEqual(['POST /api/auth/login 200']);
    expect((await newLines(server, () => fetch(`${server.base}/api/auth/me`))).lines).toEqual(['GET /api/auth/me 401']);
  });

  it('🔴 logger.js 는 경로 주석 + 함수 하나 · app.js 맨 위 app.use', () => {
    // 🚨 작업트리(P)와 비교하지 않는다 — `p3-28` 이 로거에 걸린 시간을 더해 작업트리 판이 바뀐다. 이 회차 판(북마크)만 본다.
    expect(read(R('middlewares/logger.js'))).toBe(read(P('snapshots/p3-27.logger.js')));
    const app = read(R('app.js')).split('\n');
    const uses = app.filter((line) => line.startsWith('app.use('));
    expect(uses[0]).toBe('app.use(logger);');
    expect(app).toContain("import { logger } from './middlewares/logger.js';");
  });
});

describe('축 ② — Step 2 의 반례: req.url 로 적으면', () => {
  it('🔴 스냅숏 logger 는 originalUrl → url 한 군데만 다르다', () => {
    const real = read(R('middlewares/logger.js')).split('\n');
    const snap = read(P('snapshots/p3-27.step2-url.logger.js')).split('\n');
    const diff = snap.map((line, i) => [real[i], line]).filter(([a, b]) => a !== b);
    expect(snap).toHaveLength(real.length);
    expect(diff).toHaveLength(1);
    expect(diff[0][1]).toBe(diff[0][0].replace('req.originalUrl', 'req.url'));
  });

  it('🔴 그 판은 라우터 «안에서» 답한 요청만 «GET /1 200»·«GET / 200» 으로 잘라 적고, 에러 미들웨어가 답한 404 와 app.js 에 바로 있는 주소는 그대로', async () => {
    const dir = copyStudent(ROUND.dir, 'p327-url-');
    cpSync(P('snapshots/p3-27.step2-url.logger.js'), join(dir, 'middlewares/logger.js'));
    const app = await bootApp(dir, SNAP_PORT);
    try {
      expect((await newLines(app, () => fetch(`${app.base}/api/posts/1`))).lines).toEqual(['GET /1 200']);
      // requests/posts.http «게시물 목록» — 라우터 안에서 답하니 잘린 주소
      expect((await newLines(app, () => fetch(`${app.base}/api/posts`))).lines).toEqual(['GET / 200']);
      // 라우터 밖 에러 미들웨어가 답한 요청은 Express 가 req.url 을 되돌려 놓은 뒤라 제대로 찍힌다
      expect((await newLines(app, () => fetch(`${app.base}/api/posts/999`))).lines).toEqual(['GET /api/posts/999 404']);
      expect((await newLines(app, () => fetch(`${app.base}/api/posts/abc`))).lines).toEqual(['GET /api/posts/abc 404']);
      expect((await newLines(app, () => fetch(`${app.base}/api/posts?limit=2`))).lines).toEqual(['GET /?limit=2 200']);
      expect((await newLines(app, () => fetch(`${app.base}/api/nope`))).lines).toEqual(['GET /api/nope 404']);
    } finally {
      await app.stop();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('축 ③ — Step 3: 아무것도 안 하는 미들웨어를 끼우면', () => {
  it('🔴 스냅숏은 cookieParser 아래에 next 없는 함수 하나만 더했다', () => {
    const real = read(R('app.js'));
    const snap = read(P('snapshots/p3-27.step3-hang.app.js'));
    expect(snap).toBe(real.replace("app.use(cookieParser());\n",
      "app.use(cookieParser());\n\napp.use((req, res, next) => {\n  console.log('요청이 들어왔어요');\n});\n"));
  });

  it('🔴 응답이 안 온다(3초 기다려도) · 터미널에는 «요청이 들어왔어요» 만 있고 로거 줄은 없다', async () => {
    await withSnapshot('p3-27.step3-hang.app.js', async (app) => {
      const before = linesAfterReady(app).length;
      await expect(fetch(`${app.base}/api/posts?limit=2`, { signal: AbortSignal.timeout(3000) }))
        .rejects.toThrow(/aborted|timeout/i);
      await sleep(150);
      expect(linesAfterReady(app).slice(before)).toEqual(['요청이 들어왔어요']);
    });
  }, 20000);
});

// 학생 폴더 모양 — lab 파일이 `../middlewares/logger.js`·`../errors.js` 를 부른다.
const LAB_DIR = 'lab/p3-27';
const studentLab = (files) => {
  const dir = mkdtempSync(join(tmpdir(), 'p327-lab-'));
  mkdirSync(join(dir, LAB_DIR), { recursive: true });
  mkdirSync(join(dir, 'middlewares'));
  cpSync(R('middlewares/logger.js'), join(dir, 'middlewares/logger.js'));
  cpSync(R('errors.js'), join(dir, 'errors.js'));
  writeFileSync(join(dir, 'package.json'), '{"type":"module"}');
  symlinkSync(P('node_modules'), join(dir, 'node_modules'));
  for (const [name, from] of Object.entries(files)) cpSync(from, join(dir, LAB_DIR, name));
  return dir;
};
const withLab = async (name, from, port, fn) => {
  const dir = studentLab({ [name]: from });
  const lab = await boot(join(dir, LAB_DIR, name), { port, ready: `${port}번 포트에서` });
  try {
    await fn(lab);
  } finally {
    await lab.stop();
    rmSync(dir, { recursive: true, force: true });
  }
};
const getJson = async (url, init) => {
  const res = await fetch(url, init);
  const type = res.headers.get('content-type') ?? '';
  return { status: res.status, type, body: type.includes('json') ? await res.json() : await res.text() };
};

describe('축 ③ — Step 3: 답한 뒤 또 넘기면 (lab/p3-27/hello.js · 4004)', () => {
  it('🔴 return 을 빠뜨린 판 — 400 은 그대로 오고, 터미널에 ERR_HTTP_HEADERS_SENT', async () => {
    const snap = read(P('snapshots/p3-27.step3-no-return.hello.js'));
    expect(snap).toBe(read(P('lab/p3-27/hello.js')).replace('    return;\n', ''));
    await withLab('hello.js', P('snapshots/p3-27.step3-no-return.hello.js'), 4004, async (lab) => {
      const res = await getJson(`${lab.base}/api/hello`);
      expect(res).toMatchObject({ status: 400, body: { message: '이름을 보내 주세요' } });
      await sleep(150);
      expect(lab.tail()).toContain('Error [ERR_HTTP_HEADERS_SENT]: Cannot set headers after they are sent to the client');
    });
  });

  it('🔴 return 을 넣은 판 — 이름 없으면 400 만 · minji 면 «안녕하세요, minji님» · 에러 없음', async () => {
    await withLab('hello.js', P('lab/p3-27/hello.js'), 4004, async (lab) => {
      expect(await getJson(`${lab.base}/api/hello`)).toMatchObject({ status: 400, body: { message: '이름을 보내 주세요' } });
      expect(await getJson(`${lab.base}/api/hello?name=minji`)).toMatchObject({ status: 200, body: { message: '안녕하세요, minji님' } });
      await sleep(150);
      expect(lab.tail()).not.toContain('ERR_HTTP_HEADERS_SENT');
    });
  });
});

describe('축 ④ — Step 4: 잠깐 끼운 함수의 자리', () => {
  const probe = "app.use((req, res, next) => {\n  console.log('쿠키:', req.cookies);\n  next();\n});\n";
  it('🔴 두 스냅숏은 cookieParser 위·아래에 같은 함수를 하나 넣은 것뿐', () => {
    const real = read(R('app.js'));
    expect(read(P('snapshots/p3-27.step4-probe-above.app.js')))
      .toBe(real.replace('app.use(cookieParser());\n', `${probe}app.use(cookieParser());\n`));
    expect(read(P('snapshots/p3-27.step4-probe-below.app.js')))
      .toBe(real.replace('app.use(cookieParser());\n', `app.use(cookieParser());\n${probe}`));
  });

  for (const [snap, expected] of [
    ['p3-27.step4-probe-above.app.js', 'undefined'],
    ['p3-27.step4-probe-below.app.js', "{ sessionId: '1' }"],
  ]) {
    it(`🔴 ${snap} — 쿠키를 실어 «나는 누구» → «쿠키: ${expected}» 다음 로거 줄`, async () => {
      await withSnapshot(snap, async (app) => {
        const { lines } = await newLines(app, () => fetch(`${app.base}/api/auth/me`, { headers: { Cookie: 'sessionId=1' } }));
        expect(lines).toEqual([`쿠키: ${expected}`, 'GET /api/auth/me 401']);
      });
    });
  }
});

describe('축 ⑤ — Step 5: 프리플라이트는 cors 가 답하고 끝낸다', () => {
  it('🔴 지금 판 — 204 · 허락 헤더 · 로거 «OPTIONS /api/posts 204»', async () => {
    const { res, lines } = await newLines(server, () => preflight(server.base));
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe(STUDENT_ORIGIN);
    expect(lines).toEqual(['OPTIONS /api/posts 204']);
  });

  it('🔴 로거를 cors 뒤로 옮긴 판 — 프리플라이트 줄은 사라지고, 게시물 목록 줄은 그대로', async () => {
    await withSnapshot('p3-27.step5-logger-after-cors.app.js', async (app) => {
      const pre = await newLines(app, () => preflight(app.base));
      expect(pre.res.status).toBe(204);
      expect(pre.lines).toEqual([]);
      expect((await newLines(app, () => fetch(`${app.base}/api/posts?limit=2`))).lines).toEqual(['GET /api/posts?limit=2 200']);
    });
  });
});

describe('축 ⑥ — Step 6: express.json 이 본문을 읽을 때와 넘길 때', () => {
  const TEXT_BODY = '{\n  "authorId": 3,\n  "content": "글자 형식으로 보냈어요"\n}';
  it('🔴 requests/middleware.http 의 요청은 그 본문을 text/plain 으로 보낸다', () => {
    expect(read(R('requests/middleware.http'))).toBe(
      `### JSON이 아닌 형식으로 올리기\nPOST http://localhost:3000/api/posts\nContent-Type: text/plain\n\n${TEXT_BODY}\n`);
  });

  it('🔴 지금 판 — 깨진 JSON 400 «보낸 내용을 읽을 수 없어요» · 글자 형식은 400 «규칙에 안 맞아요» + received undefined', async () => {
    const broken = await newLines(server, () => getJson(`${server.base}/api/posts`, { method: 'POST', headers: JSON_HEADERS, body: BROKEN }));
    expect(broken.res).toMatchObject({ status: 400, body: { message: '보낸 내용을 읽을 수 없어요' } });
    expect(broken.lines).toEqual(['POST /api/posts 400']);
    const text = await newLines(server, () => getJson(`${server.base}/api/posts`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: TEXT_BODY }));
    expect(text.res).toMatchObject({ status: 400, body: {
      message: '보낸 내용이 규칙에 안 맞아요', details: { errors: ['Invalid input: expected object, received undefined'] },
    } });
    expect(text.lines).toEqual(['POST /api/posts 400']);
  });

  it('🔴 express.json 아래에 본문을 찍는 함수를 넣은 판 — 깨진 JSON 은 거기까지 안 오고, 글자 형식은 «본문: undefined»', async () => {
    const real = read(R('app.js'));
    expect(read(P('snapshots/p3-27.step6-probe-body.app.js'))).toBe(real.replace('app.use(express.json());\n',
      "app.use(express.json());\napp.use((req, res, next) => {\n  console.log('본문:', req.body);\n  next();\n});\n"));
    await withSnapshot('p3-27.step6-probe-body.app.js', async (app) => {
      const broken = await newLines(app, () => fetch(`${app.base}/api/posts`, { method: 'POST', headers: JSON_HEADERS, body: BROKEN }));
      expect(broken.lines).toEqual(['POST /api/posts 400']);
      const text = await newLines(app, () => fetch(`${app.base}/api/posts`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: TEXT_BODY }));
      expect(text.lines).toEqual(['본문: undefined', 'POST /api/posts 400']);
    });
  });
});

describe('축 ⑦ — Step 8: 에러 미들웨어의 next 에 기본값을 주면', () => {
  it('🔴 스냅숏은 그 한 줄만 다르다', () => {
    const real = read(R('app.js'));
    expect(read(P('snapshots/p3-27.step8-default-next.app.js')))
      .toBe(real.replace('app.use((err, req, res, next) => {', 'app.use((err, req, res, next = () => {}) => {'));
  });

  it('🔴 깨진 JSON → 400 이지만 HTML(Express 기본 처리) · 터미널에 SyntaxError 스택 · 평범한 요청은 그대로', async () => {
    await withSnapshot('p3-27.step8-default-next.app.js', async (app) => {
      const res = await getJson(`${app.base}/api/posts`, { method: 'POST', headers: JSON_HEADERS, body: BROKEN });
      expect(res.status).toBe(400);
      expect(res.type).toBe('text/html; charset=utf-8');
      expect(res.body).toContain('<pre>SyntaxError: ');
      await sleep(150);
      expect(app.tail()).toContain("POST /api/posts 400\nSyntaxError: Expected ',' or '}' after property value in JSON at position 17 (line 2 column 16)\n");
      expect((await newLines(app, () => fetch(`${app.base}/api/posts?limit=2`))).lines).toEqual(['GET /api/posts?limit=2 200']);
    });
  });
});

describe('축 ⑧ — 이 회차 학생 파일', () => {
  it('🔴 app.js 는 code/p3-23 에서 import 한 줄 + app.use(logger) 한 줄만 더했다', () => {
    const before = read(join(BEFORE.dir, 'app.js'));
    const after = read(R('app.js'));
    expect(after).toBe(before
      .replace("import { HttpError } from './errors.js';\n", "import { HttpError } from './errors.js';\nimport { logger } from './middlewares/logger.js';\n")
      .replace('app.use(cors({ origin: allowedOrigins }));\n', 'app.use(logger);\napp.use(cors({ origin: allowedOrigins }));\n'));
  });
});

describe('축 ⑨ — 직접 해보기 · 과제 (lab/p3-27/)', () => {
  const LAB = (name) => P(`lab/p3-27/${name}`);
  const labVariantFile = (name, edits) => {
    let src = read(LAB(name));
    for (const [a, b] of edits) {
      if (!src.includes(a)) throw new Error(`${name} 에서 바꿀 곳을 못 찾았다: ${a}`);
      src = src.replace(a, b);
    }
    const dir = mkdtempSync(join(tmpdir(), 'p327-variant-'));
    writeFileSync(join(dir, name), src);
    return join(dir, name);
  };

  it('🔴 경로 주석은 학생 쪽 lab/p3-27/ · 서버 넷은 실습 문장으로 뜬다', () => {
    for (const name of ['hello.js', 'practice1.js', 'practice2.js', 'practice3.js', 'count.js', 'homework1.js', 'homework2.js']) {
      expect(read(LAB(name)).split('\n')[0]).toBe(`// ~/instagram-api/lab/p3-27/${name}`);
    }
  });

  it('🔴 직접 해보기 1 (4001) — 1번 200 · abc 400 · 9번 404 · 줄마다 로거 한 줄', async () => {
    await withLab('practice1.js', LAB('practice1.js'), 4001, async (lab) => {
      const one = await newLines(lab, () => getJson(`${lab.base}/api/notices/1`));
      expect(one.res).toMatchObject({ status: 200, body: { notice: { id: 1, title: '서버 점검 안내' } } });
      expect(one.lines).toEqual(['GET /api/notices/1 200']);
      const abc = await newLines(lab, () => getJson(`${lab.base}/api/notices/abc`));
      expect(abc.res).toMatchObject({ status: 400, body: { message: '공지 번호는 숫자로 보내 주세요' } });
      expect(abc.lines).toEqual(['에러 미들웨어에 들어왔어요', 'GET /api/notices/abc 400']);
      const nine = await newLines(lab, () => getJson(`${lab.base}/api/notices/9`));
      expect(nine.res).toMatchObject({ status: 404, body: { message: '그런 공지는 없어요' } });
      expect(nine.lines).toEqual(['GET /api/notices/9 404']);
    });
  });

  it('🔴 직접 해보기 1 — 맨 끝 next(); 를 지운 판은 1번이 매달리고 로거 줄도 없다 · 404 는 그대로', async () => {
    const file = labVariantFile('practice1.js', [['  req.notice = notice;\n  next();\n', '  req.notice = notice;\n']]);
    await withLab('practice1.js', file, 4001, async (lab) => {
      const before = linesAfterReady(lab).length;
      await expect(fetch(`${lab.base}/api/notices/1`, { signal: AbortSignal.timeout(2000) })).rejects.toThrow(/aborted|timeout/i);
      await sleep(150);
      expect(linesAfterReady(lab).slice(before)).toEqual([]);
      expect((await newLines(lab, () => fetch(`${lab.base}/api/notices/9`))).lines).toEqual(['GET /api/notices/9 404']);
    });
  }, 15000);

  it('🔴 직접 해보기 1 — 404 분기의 return; 을 빠뜨린 판: 브라우저엔 404, 창 3엔 ERR_HTTP_HEADERS_SENT · 로거 줄은 500', async () => {
    const file = labVariantFile('practice1.js', [["    res.status(404).json({ message: '그런 공지는 없어요' });\n    return;\n", "    res.status(404).json({ message: '그런 공지는 없어요' });\n"]]);
    await withLab('practice1.js', file, 4001, async (lab) => {
      const res = await getJson(`${lab.base}/api/notices/9`);
      expect(res).toMatchObject({ status: 404, body: { message: '그런 공지는 없어요' } });
      await sleep(200);
      expect(lab.tail()).toContain('Error [ERR_HTTP_HEADERS_SENT]: Cannot set headers after they are sent to the client');
      expect(lab.tail()).toContain('GET /api/notices/9 500');
    });
  });

  it('🔴 직접 해보기 2 (4002) — requireJson 이 없는 판은 글자 형식 메모가 500(TypeError) · 있는 판은 415', async () => {
    const body = '{\n  "text": "우유 사기"\n}';
    const plain = { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body };
    const json = { method: 'POST', headers: JSON_HEADERS, body };
    const without = labVariantFile('practice2.js', [["app.use(requireJson('JSON 형식으로 보내 주세요'));\n", '']]);
    await withLab('practice2.js', without, 4002, async (lab) => {
      const res = await getJson(`${lab.base}/api/notes`, plain);
      expect(res.status).toBe(500);
      expect(res.body).toContain("TypeError: Cannot read properties of undefined (reading &#39;text&#39;)");
    });
    await withLab('practice2.js', LAB('practice2.js'), 4002, async (lab) => {
      const created = await newLines(lab, () => getJson(`${lab.base}/api/notes`, json));
      expect(created.res).toMatchObject({ status: 201, body: { id: 1, text: '우유 사기' } });
      expect(created.lines).toEqual(['POST /api/notes 201']);
      const refused = await newLines(lab, () => getJson(`${lab.base}/api/notes`, plain));
      expect(refused.res).toMatchObject({ status: 415, body: { message: 'JSON 형식으로 보내 주세요' } });
      expect(refused.lines).toEqual(['POST /api/notes 415']);
      expect((await getJson(`${lab.base}/api/notes`)).body).toEqual([{ id: 1, text: '우유 사기' }]);
    });
  });

  it('🔴 practice2.http 는 세 요청(올리기 · 글자 형식 · 목록)', () => {
    expect(read(LAB('practice2.http')).match(/^### .+$/gm)).toEqual(['### 메모 올리기', '### 같은 메모를 글자 형식으로 올리기', '### 메모 목록']);
  });

  it('🔴 Step 7·8 count.js — «2 3 4» 다음 «3 0» · Step 7 판은 앞 줄만', () => {
    const run = (f) => execFileSync(process.execPath, [f], { encoding: 'utf8' });
    expect(run(LAB('count.js'))).toBe('2 3 4\n3 0\n');
    expect(read(P('snapshots/p3-27.step7.count.js'))).toBe(read(LAB('count.js')).split('\n').slice(0, 6).join('\n') + '\n');
    expect(run(P('snapshots/p3-27.step7.count.js'))).toBe('2 3 4\n');
  });

  it('🔴 직접 해보기 3 (4003) 시작 판 — 깨진 JSON 은 HTML 400 · 감싼 함수가 안 불린다 · 없는 주소에서 오히려 불려 500', async () => {
    await withLab('practice3.js', P('snapshots/p3-27.practice3-start.js'), 4003, async (lab) => {
      const broken = await getJson(`${lab.base}/api/echo`, { method: 'POST', headers: JSON_HEADERS, body: '{\n  "message": "안녕하세요"\n' });
      expect(broken.status).toBe(400);
      expect(broken.type).toBe('text/html; charset=utf-8');
      await sleep(150);
      expect(lab.tail()).not.toContain('에러 미들웨어에 들어왔어요');
      const nope = await getJson(`${lab.base}/api/nope`);
      expect(nope.status).toBe(500);
      expect(nope.body).toContain('TypeError: res.status is not a function');
      await sleep(150);
      expect(lab.tail()).toContain('에러 미들웨어에 들어왔어요\nTypeError: res.status is not a function');
    });
  });

  it('🔴 직접 해보기 3 고친 판 — 깨진 JSON 은 우리 JSON 400 + 한 줄 · 없는 주소는 Express 기본 404', async () => {
    await withLab('practice3.js', LAB('practice3.js'), 4003, async (lab) => {
      const ok = await getJson(`${lab.base}/api/echo`, { method: 'POST', headers: JSON_HEADERS, body: '{\n  "message": "안녕하세요"\n}' });
      expect(ok).toMatchObject({ status: 200, body: { message: '안녕하세요' } });
      const { res, lines } = await newLines(lab, () => getJson(`${lab.base}/api/echo`, { method: 'POST', headers: JSON_HEADERS, body: '{\n  "message": "안녕하세요"\n' }));
      expect(res).toMatchObject({ status: 400, body: { message: '보낸 내용을 읽을 수 없어요' } });
      expect(lines).toEqual(['에러 미들웨어에 들어왔어요']);
      const nope = await newLines(lab, () => getJson(`${lab.base}/api/nope`));
      expect(nope.res.status).toBe(404);
      expect(nope.res.body).toContain('Cannot GET /api/nope');
      expect(nope.lines).toEqual([]);
    });
    expect(read(P('snapshots/p3-27.practice3-start.js'))).toBe(read(LAB('practice3.js'))
      .replace('  return (err, req, res, next) => {', '  return (...args) => {')
      .replace('    handler(err, req, res, next);', '    handler(...args);'));
  });

  it('🔴 과제 [기초] (4011) — 점검 중이면 503 + 로거 줄 · 꺼면 200 · 로거를 아래로 옮기면 503 줄이 없다', async () => {
    await withLab('homework1.js', LAB('homework1.js'), 4011, async (lab) => {
      const { res, lines } = await newLines(lab, () => getJson(`${lab.base}/api/notices`));
      expect(res).toMatchObject({ status: 503, body: { message: '지금은 점검 중이에요. 잠시 뒤에 다시 와 주세요' } });
      expect(lines).toEqual(['GET /api/notices 503']);
    });
    await withLab('homework1.js', labVariantFile('homework1.js', [['const MAINTENANCE = true;', 'const MAINTENANCE = false;']]), 4011, async (lab) => {
      const { res, lines } = await newLines(lab, () => getJson(`${lab.base}/api/notices`));
      expect(res).toMatchObject({ status: 200, body: ['서버 점검 안내', '새 기능 소개'] });
      expect(lines).toEqual(['GET /api/notices 200']);
    });
    const swapped = labVariantFile('homework1.js', [['app.use(logger);\napp.use(maintenance(MAINTENANCE));', 'app.use(maintenance(MAINTENANCE));\napp.use(logger);']]);
    await withLab('homework1.js', swapped, 4011, async (lab) => {
      const { res, lines } = await newLines(lab, () => getJson(`${lab.base}/api/notices`));
      expect(res.status).toBe(503);
      expect(lines).toEqual([]);
    });
  });

  it('🔴 과제 [응용] (4012) — 매개변수 넷이면 뜨고 깨진 JSON 에 우리 JSON 400 · 기본값을 준 판은 뜨자마자 그 문장으로 끝난다', async () => {
    await withLab('homework2.js', LAB('homework2.js'), 4012, async (lab) => {
      const res = await getJson(`${lab.base}/api/echo`, { method: 'POST', headers: JSON_HEADERS, body: '{\n  "message": "안녕하세요"\n' });
      expect(res).toMatchObject({ status: 400, body: { message: '보낸 내용을 읽을 수 없어요' } });
    });
    const broken = labVariantFile('homework2.js', [['app.use(assertErrorHandler((err, req, res, next) => {', 'app.use(assertErrorHandler((err, req, res, next = () => {}) => {']]);
    const dir = studentLab({ 'homework2.js': broken });
    try {
      let out = '';
      try {
        execFileSync(process.execPath, [join(dir, LAB_DIR, 'homework2.js')], { encoding: 'utf8', stdio: 'pipe', timeout: 5000 });
      } catch (error) {
        out = error.stderr;
        expect(error.status).toBe(1);
      }
      expect(out).toContain('Error: 에러 미들웨어는 매개변수가 4개여야 해요 (지금은 3개)');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('축 ⑩ — 교안의 다른 주장들', () => {
  it('🔴 Step 1 — 404 미들웨어를 지운 판은 Express 가 «Cannot GET /api/comments» HTML 404 로 답한다', async () => {
    const dir = copyStudent(ROUND.dir, 'p327-no404-');
    const app = read(R('app.js'));
    const block = "app.use((req, res) => {\n  res.status(404).json({ message: '그런 주소는 없어요' });\n});\n";
    expect(app).toContain(block);
    writeFileSync(join(dir, 'app.js'), app.replace(block, ''));
    const s = await bootApp(dir, SNAP_PORT);
    try {
      const res = await getJson(`${s.base}/api/comments`);
      expect(res.status).toBe(404);
      expect(res.type).toBe('text/html; charset=utf-8');
      expect(res.body).toContain('<pre>Cannot GET /api/comments</pre>');
    } finally {
      await s.stop();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('🔴 Step 5 — requests/cors.http 의 세 요청: 우리 프론트 GET 은 줄이 남고, 모르는 곳 GET 도 200 + 게시물 + 줄(허락 헤더만 없다)', async () => {
    const cors = read(R('requests/cors.http'));
    expect(cors).toContain('### 우리 프론트에서 온 것처럼 물어보기\nGET http://localhost:3000/api/posts?limit=1\nOrigin: http://localhost:5173\n');
    expect(cors).toContain('### 우리가 모르는 곳에서 온 것처럼 물어보기\nGET http://localhost:3000/api/posts?limit=1\nOrigin: http://not-ours.example.com\n');
    const ours = await newLines(server, () => fetch(`${server.base}/api/posts?limit=1`, { headers: { Origin: STUDENT_ORIGIN } }));
    expect(ours.lines).toEqual(['GET /api/posts?limit=1 200']);
    const other = await newLines(server, () => getJson(`${server.base}/api/posts?limit=1`, { headers: { Origin: 'http://not-ours.example.com' } }));
    expect(other.res.status).toBe(200);
    expect(other.res.body.items).toHaveLength(1);
    expect(other.lines).toEqual(['GET /api/posts?limit=1 200']);
    const raw = await fetch(`${server.base}/api/posts?limit=1`, { headers: { Origin: 'http://not-ours.example.com' } });
    expect(raw.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('🔴 Step 5 — 로거를 cors 뒤로 옮긴 판에서도 우리 프론트 GET(limit=1)은 찍힌다', async () => {
    await withSnapshot('p3-27.step5-logger-after-cors.app.js', async (app) => {
      const { lines } = await newLines(app, () => fetch(`${app.base}/api/posts?limit=1`, { headers: { Origin: STUDENT_ORIGIN } }));
      expect(lines).toEqual(['GET /api/posts?limit=1 200']);
    });
  });

  it('🔴 Step 7 — 에러 미들웨어의 이름을 err→error · next→_next 로 바꿔도 우리 JSON 400', async () => {
    const dir = copyStudent(ROUND.dir, 'p327-names-');
    const app = read(R('app.js'));
    const head = 'app.use((err, req, res, next) => {\n  if (err instanceof HttpError) {\n    const body = { message: err.message };\n    if (err.details) body.details = err.details;\n    res.status(err.status).json(body);\n    return;\n  }\n\n  if (err.status) {\n    res.status(err.status).json';
    expect(app).toContain(head);
    writeFileSync(join(dir, 'app.js'), app.replace(head, head
      .replace('(err, req, res, next)', '(error, req, res, _next)')
      .replaceAll('err instanceof', 'error instanceof').replaceAll('err.', 'error.')));
    const s = await bootApp(dir, SNAP_PORT);
    try {
      const res = await getJson(`${s.base}/api/posts`, { method: 'POST', headers: JSON_HEADERS, body: BROKEN });
      expect(res).toMatchObject({ status: 400, body: { message: '보낸 내용을 읽을 수 없어요' } });
    } finally {
      await s.stop();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('🔴 직접 해보기 2 — requireJson 없는 판의 터미널 첫 에러 줄 · 넣은 판의 목록 줄', async () => {
    const without = (() => {
      const src = read(P('lab/p3-27/practice2.js')).replace("app.use(requireJson('JSON 형식으로 보내 주세요'));\n", '');
      const dir = mkdtempSync(join(tmpdir(), 'p327-variant-'));
      writeFileSync(join(dir, 'practice2.js'), src);
      return join(dir, 'practice2.js');
    })();
    await withLab('practice2.js', without, 4002, async (lab) => {
      await fetch(`${lab.base}/api/notes`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{\n  "text": "우유 사기"\n}' });
      await sleep(150);
      expect(lab.tail()).toContain("POST /api/notes 500\nTypeError: Cannot read properties of undefined (reading 'text')\n");
    });
    await withLab('practice2.js', P('lab/p3-27/practice2.js'), 4002, async (lab) => {
      expect((await newLines(lab, () => fetch(`${lab.base}/api/notes`))).lines).toEqual(['GET /api/notes 200']);
    });
  });

  it('🔴 과제 [응용] — 기본값을 준 판을 node --watch 로 띄우면 그 문장 + «Failed running … Waiting for file changes»', async () => {
    const src = read(P('lab/p3-27/homework2.js'))
      .replace('app.use(assertErrorHandler((err, req, res, next) => {', 'app.use(assertErrorHandler((err, req, res, next = () => {}) => {');
    const dir = studentLab({});
    writeFileSync(join(dir, LAB_DIR, 'homework2.js'), src);
    const { spawn } = await import('node:child_process');
    const child = spawn(process.execPath, ['--watch', `${LAB_DIR}/homework2.js`], { cwd: dir });
    let out = '';
    child.stdout.on('data', (b) => { out += b; });
    child.stderr.on('data', (b) => { out += b; });
    try {
      for (let i = 0; i < 40 && !out.includes('Waiting for file changes'); i++) await sleep(100);
      expect(out).toContain('Error: 에러 미들웨어는 매개변수가 4개여야 해요 (지금은 3개)');
      expect(out).toContain("Failed running 'lab/p3-27/homework2.js'. Waiting for file changes before restarting...");
    } finally {
      child.kill();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('🔴 과제 [응용] 요구사항 6 — 매개변수 다섯 판은 «지금은 5개» 로 멈춘다 · `< 4` 로 비교한 판은 그대로 떠서 가려진다', async () => {
    const five = read(P('lab/p3-27/homework2.js'))
      .replace('app.use(assertErrorHandler((err, req, res, next) => {', 'app.use(assertErrorHandler((err, req, res, next, extra) => {');
    const dir = studentLab({});
    writeFileSync(join(dir, LAB_DIR, 'homework2.js'), five);
    let out = '';
    try {
      execFileSync(process.execPath, [join(dir, LAB_DIR, 'homework2.js')], { encoding: 'utf8', stdio: 'pipe', timeout: 5000 });
    } catch (error) {
      out = error.stderr;
    }
    expect(out).toContain('Error: 에러 미들웨어는 매개변수가 4개여야 해요 (지금은 5개)');
    const lessThan = five.replace('if (handler.length !== 4) {', 'if (handler.length < 4) {');
    writeFileSync(join(dir, LAB_DIR, 'homework2.js'), lessThan);
    const lab = await boot(join(dir, LAB_DIR, 'homework2.js'), { port: 4012, ready: '4012번 포트에서' });
    try {
      const res = await getJson(`${lab.base}/api/echo`, { method: 'POST', headers: JSON_HEADERS, body: BROKEN });
      expect(res.status).toBe(400);
      expect(res.type).toBe('text/html; charset=utf-8');
    } finally {
      await lab.stop();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('축 ⑪ — 교안 코드 블록의 줄이 실재한다', () => {
  const LECTURE = P('../../part3/5-express-core/p3-27-middleware-structure-lecture.md');
  const ANSWERS = P('../../part3/5-express-core/p3-27-middleware-structure-answers.md');
  const blocks = (file) => {
    const out = [];
    const re = /^```(javascript|http)\n([\s\S]*?)^```$/gm;
    let m;
    const text = read(file);
    while ((m = re.exec(text))) out.push({ lang: m[1], lines: m[2].replace(/\n$/, '').split('\n') });
    return out;
  };
  // 교안 경로 → 코드베이스에서 그 블록이 나올 수 있는 파일들(이 회차 끝 판 + 중간 판 스냅숏)
  const candidates = (path) => {
    if (path.startsWith('~/instagram-api/node_modules/')) return [P(path.slice('~/instagram-api/'.length))];
    const rel = path.slice('~/instagram-api/'.length);
    if (rel.startsWith('lab/p3-27/')) {
      const name = rel.slice('lab/p3-27/'.length);
      return [P(`lab/p3-27/${name}`), ...snapshotsFor(name)];
    }
    return [R(rel), ...snapshotsFor(rel.split('/').pop())];
  };
  const snapshotsFor = (name) => {
    const base = name.replace(/\.js$/, '');
    const all = execFileSync('ls', [P('snapshots')], { encoding: 'utf8' }).split('\n');
    return all.filter((f) => f.startsWith('p3-27.') && (f.endsWith(`.${name}`) || f === `p3-27.${base}-start.js`))
      .map((f) => P(`snapshots/${f}`));
  };
  // `...` 줄은 생략, `____` 줄은 빈칸 — 나머지 줄은 그 파일 안에 «차례대로» 있어야 한다.
  const inOrder = (lines, file) => {
    const src = read(file).split('\n');
    let at = 0;
    for (const line of lines) {
      if (line.trim() === '...' || line.includes('____')) continue;
      const found = src.indexOf(line, at);
      if (found === -1) return line;
      at = found + 1;
    }
    return null;
  };

  for (const [label, file] of [['교안', LECTURE], ['답안', ANSWERS]]) {
    it(`🔴 ${label}의 javascript 블록 — 경로 주석 파일(또는 그 중간 판)에 줄이 차례대로 있다`, () => {
      const misses = [];
      let checked = 0;
      for (const { lang, lines } of blocks(file)) {
        if (lang !== 'javascript') continue;
        const m = /^\/\/ (~\/instagram-api\/\S+)$/.exec(lines[0]);
        if (!m) continue;
        checked += 1;
        const body = lines.slice(1);
        const files = candidates(m[1]);
        const miss = files.map((f) => inOrder(body, f));
        if (miss.every((x) => x !== null)) misses.push(`${m[1]}: ${miss[0]}`);
      }
      expect(checked).toBeGreaterThan(0);
      expect(misses).toEqual([]);
    });
  }

  it('🔴 교안의 middleware.http 블록 = requests/middleware.http · 답안 해설의 practice2/3.http = lab', () => {
    const http = blocks(LECTURE).filter((b) => b.lang === 'http').map((b) => b.lines.join('\n') + '\n');
    expect(http).toContain(read(R('requests/middleware.http')));
    expect(http).toContain(read(P('lab/p3-27/practice2.http')));
    expect(http).toContain(read(P('lab/p3-27/practice3.http')));
  });
});

describe('축 ⑫ — 답안의 주장', () => {
  it('🔴 과제 [기초] 흔한 실수 — return 을 빠뜨린 판: 브라우저엔 503, 창엔 ERR_HTTP_HEADERS_SENT', async () => {
    const src = read(P('lab/p3-27/homework1.js')).replace("      res.status(503).json({ message: '지금은 점검 중이에요. 잠시 뒤에 다시 와 주세요' });\n      return;\n", "      res.status(503).json({ message: '지금은 점검 중이에요. 잠시 뒤에 다시 와 주세요' });\n");
    expect(src).not.toBe(read(P('lab/p3-27/homework1.js')));
    const dir = mkdtempSync(join(tmpdir(), 'p327-variant-'));
    writeFileSync(join(dir, 'homework1.js'), src);
    await withLab('homework1.js', join(dir, 'homework1.js'), 4011, async (lab) => {
      const res = await getJson(`${lab.base}/api/notices`);
      expect(res).toMatchObject({ status: 503, body: { message: '지금은 점검 중이에요. 잠시 뒤에 다시 와 주세요' } });
      await sleep(150);
      expect(lab.tail()).toContain('Error [ERR_HTTP_HEADERS_SENT]: Cannot set headers after they are sent to the client');
    });
  });
});

describe('축 ⑬ — 학생 낭독 집중 검수(2026-11-05)', () => {
  const LECTURE_TEXT = () => read(P('../../part3/5-express-core/p3-27-middleware-structure-lecture.md'));
  const ANSWERS_TEXT = () => read(P('../../part3/5-express-core/p3-27-middleware-structure-answers.md'));
  const older = (path) => read(P(`../../${path}`));
  const LOG_LINE = '  console.log(`${req.method} ${req.originalUrl} ${res.statusCode}`);\n';
  const ON_FINISH = "  // 응답을 다 보낸 뒤에 한 줄 — 상태 코드는 그때 정해져 있다.\n  res.on('finish', () => {\n  " + LOG_LINE + '  });\n';
  const HEAD = '// ~/instagram-api/middlewares/logger.js\nexport function logger(req, res, next) {\n';

  const withLogger = async (snap, fn) => {
    const dir = copyStudent(ROUND.dir, 'p327-logger-');
    cpSync(P(`snapshots/${snap}`), join(dir, 'middlewares/logger.js'));
    const app = await bootApp(dir, SNAP_PORT);
    try {
      await fn(app);
    } finally {
      await app.stop();
      rmSync(dir, { recursive: true, force: true });
    }
  };
  const variant = (name, a, b) => {
    const src = read(P(`lab/p3-27/${name}`));
    if (!src.includes(a)) throw new Error(`${name} 에서 바꿀 곳을 못 찾았다: ${a}`);
    const dir = mkdtempSync(join(tmpdir(), 'p327-variant-'));
    writeFileSync(join(dir, name), src.replace(a, b));
    return join(dir, name);
  };

  it('🔴 logger 스냅숏 셋은 끝 판의 줄만 옮긴 것이다', () => {
    expect(read(R('middlewares/logger.js'))).toBe(`${HEAD}${ON_FINISH}\n  next();\n}\n`);
    expect(read(P('snapshots/p3-27.step2-first.logger.js'))).toBe(`${HEAD}${LOG_LINE}  next();\n}\n`);
    expect(read(P('snapshots/p3-27.step3-after-next.logger.js'))).toBe(`${HEAD}  next();\n${LOG_LINE}}\n`);
    expect(read(P('snapshots/p3-27.step3-on-after-next.logger.js'))).toBe(`${HEAD}  next();\n\n${ON_FINISH}}\n`);
  });

  it('🔴 Step 2 첫 판(next() 앞에서 찍기) — 목록은 맞아 보이고, 없는 게시물은 응답 404 인데 로거는 200', async () => {
    await withLogger('p3-27.step2-first.logger.js', async (app) => {
      expect((await newLines(app, () => fetch(`${app.base}/api/posts`))).lines).toEqual(['GET /api/posts 200']);
      const missing = await newLines(app, () => fetch(`${app.base}/api/posts/999`));
      expect(missing.res.status).toBe(404);
      expect(missing.lines).toEqual(['GET /api/posts/999 200']);
    });
  });

  it('🔴 Step 2 — 받아 둔 응답과 같으면 304 · 본문 없음 · 로거 줄도 304', async () => {
    const first = await fetch(`${server.base}/api/posts?limit=2`);
    const etag = first.headers.get('etag');
    await first.text();
    await sleep(150);
    expect(etag).toBeTruthy();
    const again = await newLines(server, () => fetch(`${server.base}/api/posts?limit=2`, {
      // 🚨 fetch 는 If-None-Match 를 직접 주면 Cache-Control: no-cache 를 스스로 붙여 Express 가 늘 200 으로 답한다 — 브라우저의 재검증 요청에는 없는 줄이다.
      headers: { 'If-None-Match': etag, 'Cache-Control': 'max-age=0' },
    }));
    expect(again.res.status).toBe(304);
    expect(await again.res.text()).toBe('');
    expect(again.lines).toEqual(['GET /api/posts?limit=2 304']);
  });

  it('🔴 Step 2 — 교안이 304 판 다섯 줄과 304 뜻 · 장면 표를 싣는다 · 답안이 그것을 받는다', () => {
    const t = LECTURE_TEXT();
    expect(t).toContain('GET /api/auth/me 401\nPOST /api/auth/login 200\nGET /api/auth/me 304\nGET /api/posts?userId=9&limit=2 304\nGET /api/posts?userId=9&limit=2&cursor=2 304\n');
    expect(t).toContain('로거가 404를 200으로 적었어요');
    expect(t).toContain('304(Not Modified)');
    expect(t).toContain('`Disable cache`');
    expect(t).toContain('백엔드에 요청을 보내는 동작만 창 1에 줄을 남겨요');
    expect(t).not.toContain('GET /api/auth/me 200\nGET /api/posts?userId=9&limit=2 200');
    expect(ANSWERS_TEXT()).toContain('Step 2에서 본 304');
  });

  it('🔴 🙋 next() 아래에서 찍는 판 — 기다리는 요청은 200 으로 찍히고 곧바로 답하는 요청은 맞다', async () => {
    await withLogger('p3-27.step3-after-next.logger.js', async (app) => {
      const missing = await newLines(app, () => fetch(`${app.base}/api/posts/999`));
      expect(missing.res.status).toBe(404);
      expect(missing.lines).toEqual(['GET /api/posts/999 200']);
      const nope = await newLines(app, () => fetch(`${app.base}/api/comments`));
      expect(nope.res.status).toBe(404);
      expect(nope.lines).toEqual(['GET /api/comments 404']);
    });
  });

  it('🔴 🙋 res.on 을 next() 아래로 옮긴 판 — 바른 판과 같다(곧바로 답하는 GET / 까지)', async () => {
    await withLogger('p3-27.step3-on-after-next.logger.js', async (app) => {
      expect((await newLines(app, () => fetch(`${app.base}/api/posts/999`))).lines).toEqual(['GET /api/posts/999 404']);
      expect((await newLines(app, () => fetch(`${app.base}/`))).lines).toEqual(['GET / 200']);
      const broken = await newLines(app, () => fetch(`${app.base}/api/posts`, { method: 'POST', headers: JSON_HEADERS, body: BROKEN }));
      expect(broken.lines).toEqual(['POST /api/posts 400']);
    });
  });

  describe('🙋 세 줄의 차례', () => {
    const broken = (base) => fetch(`${base}/api/posts`, { method: 'POST', headers: { ...JSON_HEADERS, Origin: STUDENT_ORIGIN }, body: BROKEN });
    const ALLOW = 'access-control-allow-origin';
    const ORDER = 'app.use(cors({ origin: allowedOrigins }));\napp.use(express.json());\napp.use(cookieParser());\n';

    it('🔴 스냅숏 둘은 그 두 줄의 차례만 다르다', () => {
      const real = read(R('app.js'));
      expect(real).toContain(ORDER);
      expect(read(P('snapshots/p3-27.step6-json-before-cors.app.js')))
        .toBe(real.replace(ORDER, 'app.use(express.json());\napp.use(cors({ origin: allowedOrigins }));\napp.use(cookieParser());\n'));
      expect(read(P('snapshots/p3-27.step6-cookie-before-json.app.js')))
        .toBe(real.replace(ORDER, 'app.use(cors({ origin: allowedOrigins }));\napp.use(cookieParser());\napp.use(express.json());\n'));
    });

    it('🔴 지금 판 — 깨진 본문의 400 에 허락 헤더가 있다', async () => {
      const res = await broken(server.base);
      expect(res.status).toBe(400);
      expect(res.headers.get(ALLOW)).toBe(STUDENT_ORIGIN);
      expect(await res.json()).toEqual({ message: '보낸 내용을 읽을 수 없어요' });
    });

    it('🔴 express.json 을 cors 앞에 둔 판 — 400 과 문장은 같은데 허락 헤더가 없다 · 평범한 요청에는 있다', async () => {
      await withSnapshot('p3-27.step6-json-before-cors.app.js', async (app) => {
        const res = await broken(app.base);
        expect(res.status).toBe(400);
        expect(res.headers.get(ALLOW)).toBeNull();
        expect(await res.json()).toEqual({ message: '보낸 내용을 읽을 수 없어요' });
        const ok = await fetch(`${app.base}/api/posts?limit=1`, { headers: { Origin: STUDENT_ORIGIN } });
        expect(ok.headers.get(ALLOW)).toBe(STUDENT_ORIGIN);
      });
    });

    it('🔴 cookieParser 를 express.json 앞에 둔 판 — 깨진 본문에도 허락 헤더가 있고 응답이 같다', async () => {
      await withSnapshot('p3-27.step6-cookie-before-json.app.js', async (app) => {
        const res = await broken(app.base);
        expect(res.status).toBe(400);
        expect(res.headers.get(ALLOW)).toBe(STUDENT_ORIGIN);
        expect(await res.json()).toEqual({ message: '보낸 내용을 읽을 수 없어요' });
      });
    });
  });

  it('🔴 직접 해보기 1 — abc 를 직접 답한 판은 응답이 같아도 «에러 미들웨어에 들어왔어요» 가 안 찍혀 갈린다', async () => {
    const file = variant('practice1.js', "    next(new BadRequestError('공지 번호는 숫자로 보내 주세요'));\n", "    res.status(400).json({ message: '공지 번호는 숫자로 보내 주세요' });\n");
    await withLab('practice1.js', file, 4001, async (lab) => {
      const abc = await newLines(lab, () => getJson(`${lab.base}/api/notices/abc`));
      expect(abc.res).toMatchObject({ status: 400, body: { message: '공지 번호는 숫자로 보내 주세요' } });
      expect(abc.lines).toEqual(['GET /api/notices/abc 400']);
    });
  });

  it('🔴 직접 해보기 2 — Content-Type 없는 POST: 바른 판은 415 · ?? 를 지운 판은 TypeError 500', async () => {
    const noType = async (base) => {
      const res = await fetch(`${base}/api/notes`, { method: 'POST' });
      return { status: res.status, body: await res.text() };
    };
    await withLab('practice2.js', P('lab/p3-27/practice2.js'), 4002, async (lab) => {
      expect(await noType(lab.base)).toMatchObject({ status: 415 });
    });
    const file = variant('practice2.js', "const type = req.headers['content-type'] ?? '';", "const type = req.headers['content-type'];");
    await withLab('practice2.js', file, 4002, async (lab) => {
      const res = await noType(lab.base);
      expect(res.status).toBe(500);
      expect(res.body).toContain('TypeError');
    });
  });

  it('🔴 직접 해보기 3 — 해설대로 변수에 담아 찍으면 0 · 스냅숏은 시작 판에서 그 줄만 다르다', async () => {
    const start = read(P('snapshots/p3-27.practice3-start.js'));
    const open = 'app.use(withLog((err, req, res, next) => {\n';
    const close = '}));\n';
    expect(start).toContain(open);
    expect(read(P('snapshots/p3-27.practice3-length.practice3.js'))).toBe(start
      .replace(open, 'const wrapped = withLog((err, req, res, next) => {\n')
      .replace(close, '});\n\nconsole.log(wrapped.length);\napp.use(wrapped);\n'));
    await withLab('practice3.js', P('snapshots/p3-27.practice3-length.practice3.js'), 4003, async (lab) => {
      expect(lab.tail()).toContain('0\n실습 서버가 4003번 포트에서 기다리고 있어요.');
    });
  });

  it('🔴 교안의 새 문장 — 앞 회차에 잇는 사실이 그 회차 교안에 정말 있다', () => {
    const t = LECTURE_TEXT();
    // Step 2 — 미들웨어를 처음 배울 때 심어 둔 복선
    expect(older('part2/4-node-backend/p2-23-crud-api-lecture.md')).toContain('앞으로 로그를 남기거나 로그인 여부를 확인하는 함수도 전부 여기에 등록하게 돼요');
    expect(t).toContain('로그를 남기는 함수도 앞으로 `app.use`로');
    // Step 5 — CORS 의 결론 · 프리플라이트 정의
    const p237 = older('part2/6-fullstack-join/p2-37-cors-proxy-env-lecture.md');
    expect(p237).toContain('CORS는 서버를 지키는 장치가 아니라는 것이었죠');
    expect(p237).toContain('프리플라이트(preflight)라는 이름');
    expect(older('part3/4-react-auth/p3-23-login-cookie-lecture.md')).toContain('`Content-Type: application/json` 헤더를 붙여 JSON을 다른 출처로 보낼 때는 브라우저가 실제 요청 전에');
    expect(t).toContain('CORS는 서버를 지키는 장치가 아니라고');
    expect(t).toContain('프리플라이트(preflight)');
    // Step 1 — proxy.js 와 Express 미들웨어
    expect(older('part3/1-nextjs/p3-10-streaming-proxy-lecture.md')).toContain('이 파일의 이름도 `middleware.js`였어요');
    expect(older('part3/4-react-auth/p3-22-signup-lecture.md')).toContain('라우트 가드도 페이지만 막고, API를 직접 부르는 요청은 막지 못해요');
    expect(t).toContain('`AuthGuard`');
  });

  it('🔴 교안의 새 토글·요구사항', () => {
    const t = LECTURE_TEXT();
    expect(t).toMatch(/<summary>🙋 학생 질문 — "`req\.url`/);
    expect(t).toMatch(/<summary>🙋 학생 질문 — "`next\(\)` 아래 줄도 실행된다면/);
    expect(t).toMatch(/<summary>🙋 학생 질문 — "그럼 `cors\(…\)`·`express\.json\(\)`·`cookieParser\(\)`의 차례를 바꿔도 되나요\?"/);
    expect(t).toContain('`node --watch lab/p3-27/homework2.js`');
    expect(t).not.toMatch(/~\/instagram-api\/lab\/(?!p3-27\/)/);
    expect(ANSWERS_TEXT()).not.toMatch(/~\/instagram-api\/lab\/(?!p3-27\/)/);
  });
});
