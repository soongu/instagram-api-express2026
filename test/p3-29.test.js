// p3-29 「에러 처리 · 내장 미들웨어 · 서드파티 미들웨어」 게이트 — 백엔드
//
// `5-express-core` 셋째 회차다. 수업 백엔드에서 바뀌는 학생 파일은 셋 — 에러 미들웨어 맨 앞의 `res.headersSent`
// (`app.js`)와 `npm install morgan`·`npm install helmet` 이 고친 `package.json`·`package-lock.json`
// (`curriculum.md` 「`p3-29` 착수 결정」). 나머지 장면은 모두 실습 서버 `lab/p3-29/board.js`(4006) · `lab/p3-29/parsers.js`(4007)에서 겪는다.
// 판정은 학생이 치는 `node lab/p3-29/….js` 를 그대로 띄워 진짜 포트로 왕복한다.
//
// 축 ① Step 1 — return 을 빠뜨린 판: 클라이언트는 404 · 로거는 500 · 창에 ERR_HTTP_HEADERS_SENT 두 번(사이에 로거 줄)
// 축 ② Step 2 — morgan('dev') 를 옆에 세우면 morgan 도 500 · 주소는 둘 다 req.originalUrl · 크기 칸은 처음 보낸 404 본문
// 축 ③ Step 3 — headersSent 판: 둘 다 404 · 에러는 한 번(Express 기본 처리) · 연결을 끊는다 · return 판: 에러 없음
// 축 ④ Step 4 — await 한 판: 3번 500 · await 를 뺀 판: 200 이 먼저 가고 서버가 꺼진다(--watch 는 Failed running)
// 축 ⑤ Step 5 — layer.js 의 «돌려준 Promise» 줄 · asyncHandler 판도 같은 500 · Express 4.22.3 은 같은 파일에서 서버가 꺼진다
// 축 ⑥ Step 6 — 기록용 → 응답용: [에러] 줄 + 500 · 차례를 바꾸면 창에 아무것도 안 남는다 · 응답 뒤 에러는 두 번
// 축 ⑦ Step 7 — parsers.js: JSON · 폼(값은 글자) · 글자 · json 만 있으면 나머지 둘은 null
// 축 ⑧ Step 8 — helmet: 헤더 12개가 더해지고 X-Powered-By 가 사라진다
// 축 ⑨ 수업 백엔드 — app.js 는 code/p3-28 에서 다섯 줄만 · 평범한 요청은 그대로
// 축 ⑩ 실습·과제 — `lab/p3-29/`(학생 쪽 경로 주석도 `~/instagram-api/lab/p3-29/…`)
// 축 ⑪ 이 회차 학생 파일 — `code/p3-28` 에서 app.js · package.json · package-lock.json 만 바뀌었다
// 축 ⑫ 교안·답안 코드 블록의 줄이 코드베이스에 실재한다
// 축 ⑬ 답안의 주장
// 축 ⑭ 교안이 기대는 앞 회차 사실 — 잇는 문장이 그 회차에 정말 있는가 · 틀렸던 문장이 돌아오지 않는가
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, mkdtempSync, rmSync, cpSync, symlinkSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import http from 'node:http';
import pg from 'pg';
import { boot } from './helpers/boot.js';
import { roundDir } from './helpers/round.js';
import { P235_MIGRATIONS } from '../sql/p2-36/setup.mjs';

const ROOT = new URL('../', import.meta.url);
const P = (rel) => new URL(rel, ROOT).pathname;
const ADMIN = { host: 'localhost', port: 5432, database: 'postgres', user: 'postgres', password: 'postgres' };
const GATE_DB = 'p329_gate';
const GATE_URL = `postgresql://postgres:postgres@localhost:5432/${GATE_DB}`;
const STUDENT_ORIGIN = 'http://localhost:3001';
const PORT = 3692;
const SIGNUP_MIGRATION = '20261029031804_add_user_signup_fields';

const read = (p) => readFileSync(p, 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 학생 파일은 이 회차 북마크 `code/p3-29` 을 풀어서 읽는다(없으면 작업트리 — 이 회차를 짓는 동안).
const ROUND = roundDir('code/p3-29');
const R = (rel) => join(ROUND.dir, rel);
const BEFORE = roundDir('code/p3-28');

const LAB_DIR = 'lab/p3-29';
const LAB = (name) => P(`${LAB_DIR}/${name}`);
const SNAP = (name) => P(`snapshots/p3-29.${name}`);
const ERR_SENT = 'Error [ERR_HTTP_HEADERS_SENT]: Cannot set headers after they are sent to the client';

// 학생 폴더를 흉내 낸다 — lab/p3-29/ 아래 파일이 ../../middlewares · ../../errors.js 를 그대로 찾게.
const studentLab = (files, modules = P('node_modules')) => {
  const dir = mkdtempSync(join(tmpdir(), 'p329-lab-'));
  mkdirSync(join(dir, LAB_DIR), { recursive: true });
  cpSync(R('middlewares'), join(dir, 'middlewares'), { recursive: true });
  cpSync(R('errors.js'), join(dir, 'errors.js'));
  writeFileSync(join(dir, 'package.json'), '{"type":"module"}');
  symlinkSync(modules, join(dir, 'node_modules'));
  for (const [name, from] of Object.entries(files)) {
    // 여러 줄이면 파일 내용, 한 줄이면 복사할 파일 경로
    if (from.includes('\n')) writeFileSync(join(dir, LAB_DIR, name), from);
    else cpSync(from, join(dir, LAB_DIR, name));
  }
  return dir;
};
const withLab = async (name, from, port, fn, { env = { NO_COLOR: '1' }, modules } = {}) => {
  const dir = studentLab({ [name]: from }, modules);
  const lab = await boot(join(dir, LAB_DIR, name), { port, ready: `${port}번 포트에서`, env });
  try {
    await fn(lab);
  } finally {
    // 이미 꺼진 프로세스는 'exit' 를 다시 내지 않아 lab.stop() 이 끝나지 않는다 — 기다림에 상한을 둔다.
    await Promise.race([lab.stop(), sleep(500)]);
    rmSync(dir, { recursive: true, force: true });
  }
};

/** 그 서버가 지금까지 찍은 줄 중 «기다리고 있어요» 다음부터(스택의 at 줄은 뺀다). */
const linesAfterReady = (lab) => {
  const all = lab.tail().split('\n').filter((line) => line !== '' && !line.startsWith('    at '));
  return all.slice(all.findIndex((line) => line.includes('포트에서')) + 1);
};
const newLines = async (lab, send, wait = 200) => {
  const before = linesAfterReady(lab).length;
  const res = await send();
  await sleep(wait);
  return { res, lines: linesAfterReady(lab).slice(before) };
};
const getJson = async (url, init) => {
  const res = await fetch(url, init);
  const type = res.headers.get('content-type') ?? '';
  return { status: res.status, headers: res.headers, body: type.includes('json') ? await res.json() : await res.text() };
};
const post = (url) => getJson(url, { method: 'POST' });
// 로거 줄의 걸린 시간을 지운다 — 손 로거 «N.Nms» · morgan dev «N.NNN ms - 크기»
const noMs = (line) => line.replace(/ \d+\.\dms$/, '').replace(/ \d+\.\d{3} ms( - \S+)?$/, ' ms$1');
const count = (text, needle) => text.split(needle).length - 1;

let db = null;
let server = null;
const env = { DATABASE_URL: GATE_URL, CORS_ORIGIN: STUDENT_ORIGIN };

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
}, 120000);

afterAll(async () => {
  if (server) await server.stop();
  if (db) await db.end();
  const admin = await dropGate();
  await admin.end();
  ROUND.cleanup();
  BEFORE.cleanup();
}, 60000);

describe('축 ① — Step 1: return 을 빠뜨린 판의 거짓 500', () => {
  it('🔴 1번은 200 · 9번은 클라이언트에 404 인데 로거는 500 · 창에 ERR_HTTP_HEADERS_SENT 두 번(첫째만 code 블록 · 로거 줄은 첫째 뒤 — 둘째와의 차례는 경주)', async () => {
    await withLab('board.js', SNAP('step1.board.js'), 4006, async (lab) => {
      const one = await newLines(lab, () => getJson(`${lab.base}/api/notices/1`));
      expect(one.res).toMatchObject({ status: 200, body: { notice: { id: 1, title: '서버 점검 안내' } } });
      expect(one.lines.map(noMs)).toEqual(['GET /api/notices/1 200']);
      const nine = await newLines(lab, () => getJson(`${lab.base}/api/notices/9`));
      expect(nine.res).toMatchObject({ status: 404, body: { message: '그런 공지는 없어요' } });
      // 첫째(우리 console.error)는 같은 틱이라 늘 로거보다 앞 · 둘째(Express 기본 처리)는 setImmediate 로 미뤄 찍어 'finish' 와 경주한다
      const got = nine.lines.map(noMs);
      expect(got.slice(0, 3)).toEqual([ERR_SENT, "  code: 'ERR_HTTP_HEADERS_SENT'", '}']);
      expect(got.slice(3).sort()).toEqual([ERR_SENT, 'GET /api/notices/9 500'].sort());
    });
  });

  it('🔴 Step 1 판은 code/p3-27 직접 해보기 1 의 return 누락과 같은 자리 — 404 분기에 return 이 없다', () => {
    const src = read(SNAP('step1.board.js'));
    expect(src).toContain("    res.status(404).json({ message: '그런 공지는 없어요' });\n  }\n\n  req.notice = notice;\n  next();");
    expect(src).toContain("app.use(logger);\n\nconst notices");
  });
});

describe('축 ② — Step 2: morgan 을 옆에 세우면', () => {
  it('🔴 morgan 도 500 · 크기 칸은 처음 보낸 404 본문(40바이트) · 손 로거 줄 다음에 morgan 줄', async () => {
    await withLab('board.js', SNAP('step2.board.js'), 4006, async (lab) => {
      const one = await newLines(lab, () => getJson(`${lab.base}/api/notices/1`));
      expect(one.lines.map(noMs)).toEqual(['GET /api/notices/1 200', 'GET /api/notices/1 200 ms - 50']);
      const nine = await newLines(lab, () => getJson(`${lab.base}/api/notices/9`));
      expect(nine.lines.map(noMs).filter((l) => l.startsWith('GET'))).toEqual(['GET /api/notices/9 500', 'GET /api/notices/9 500 ms - 40']);
      const typo = await newLines(lab, () => getJson(`${lab.base}/api/notice`));
      expect(typo.lines.map(noMs)).toEqual(['GET /api/notice 404', 'GET /api/notice 404 ms - 40']);
    });
  });

  it('🔴 morgan 소스 — :url 은 req.originalUrl || req.url · dev 의 시간은 :response-time(헤더를 쓴 순간까지) · 줄은 onFinished', () => {
    const src = read(P('node_modules/morgan/index.js'));
    expect(src).toContain("morgan.token('url', function getUrlToken (req) {\n  return req.originalUrl || req.url\n})");
    expect(src).toContain(":status\\x1b[0m :response-time ms - :res[content-length]\\x1b[0m'");
    expect(src).toContain('      onHeaders(res, recordStartTime)\n\n      // log when response finished\n      onFinished(res, logRequest)');
    expect(JSON.parse(read(P('node_modules/morgan/package.json'))).version).toBe('1.12.1');
  });

  it('🔴 Step 2 판 = Step 1 판 + import 한 줄 + app.use(morgan) 한 줄', () => {
    const before = read(SNAP('step1.board.js'));
    expect(read(SNAP('step2.board.js'))).toBe(before
      .replace("import express from 'express';\n", "import express from 'express';\nimport morgan from 'morgan';\n")
      .replace('app.use(logger);\n', "app.use(logger);\napp.use(morgan('dev'));\n"));
  });
});

describe('축 ③ — Step 3: res.headersSent', () => {
  it('🔴 headersSent 판 — 두 로거 모두 404 · 에러는 Express 기본 처리가 한 번(code 블록 없이)', async () => {
    await withLab('board.js', SNAP('step3-guard.board.js'), 4006, async (lab) => {
      const nine = await newLines(lab, () => getJson(`${lab.base}/api/notices/9`));
      expect(nine.res).toMatchObject({ status: 404, body: { message: '그런 공지는 없어요' } });
      expect(nine.lines.map(noMs).sort()).toEqual(['GET /api/notices/9 404', 'GET /api/notices/9 404 ms - 40', ERR_SENT].sort());
      expect(count(lab.tail(), 'ERR_HTTP_HEADERS_SENT')).toBe(1);
    });
  });

  it('🔴 응답을 이미 보낸 요청을 Express 에 넘기면 그 연결을 끊는다(keep-alive 소켓이 닫힌다)', async () => {
    await withLab('board.js', SNAP('step3-guard.board.js'), 4006, async (lab) => {
      const closedAfter = (path) => new Promise((resolve) => {
        const agent = new http.Agent({ keepAlive: true });
        const req = http.get(`${lab.base}${path}`, { agent }, (res) => {
          res.resume();
          res.on('end', () => {
            const timer = setTimeout(() => { agent.destroy(); resolve(false); }, 300);
            req.socket.on('close', () => { clearTimeout(timer); agent.destroy(); resolve(true); });
            if (req.socket.destroyed) { clearTimeout(timer); agent.destroy(); resolve(true); }
          });
        });
      });
      expect(await closedAfter('/api/notices/9')).toBe(true);
      expect(await closedAfter('/api/notices/1')).toBe(false);
    });
  });

  it('🔴 Step 3 — 응답이 끝까지 나간 9번은 연결이 끊겨도 404 본문을 그대로 받는다', async () => {
    await withLab('board.js', SNAP('step3-guard.board.js'), 4006, async (lab) => {
      const raw = await new Promise((resolve) => {
        const agent = new http.Agent({ keepAlive: true });
        http.get(`${lab.base}/api/notices/9`, { agent }, (res) => {
          let body = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => { body += chunk; });
          res.on('end', () => { agent.destroy(); resolve({ status: res.statusCode, complete: res.complete, body }); });
        });
      });
      expect(raw).toEqual({ status: 404, complete: true, body: '{"message":"그런 공지는 없어요"}' });
    });
  });

  it('🔴 Step 3 🙋 — 헤더만 보내고 던지면 클라이언트는 본문을 못 읽는다 · 창에 morgan 줄은 있고 손 로거 줄은 없다(finish 가 안 온다)', async () => {
    expect(read(SNAP('step3-half.board.js'))).toBe(read(SNAP('step3-return.board.js')).replace("app.use((req, res) => {\n  res.status(404)",
      "app.get('/api/half', (req, res) => {\n  res.flushHeaders();\n  throw new Error('본문을 보내기 전에 난 에러예요');\n});\n\napp.use((req, res) => {\n  res.status(404)"));
    await withLab('board.js', SNAP('step3-half.board.js'), 4006, async (lab) => {
      const { res, lines } = await newLines(lab, () => fetch(`${lab.base}/api/half`).then(
        (r) => r.text().then(() => `read ${r.status}`, () => `aborted ${r.status}`), () => 'no answer'));
      expect(res).toBe('aborted 200');
      expect(lines.map(noMs)).toContain('GET /api/half 200 ms - -');
      expect(lines.some((line) => /^GET \/api\/half 200 \d+\.\dms$/.test(line))).toBe(false);
      expect(lab.tail()).toContain('Error: 본문을 보내기 전에 난 에러예요');
    });
  });

  it('🔴 Step 3 🙋 — httpYac 에는 The server aborted pending request', async () => {
    await withLab('board.js', SNAP('step3-half.board.js'), 4006, async () => {
      const dir = mkdtempSync(join(tmpdir(), 'p329-half-'));
      try {
        writeFileSync(join(dir, 'half.http'), '### half\nGET http://localhost:4006/api/half\n');
        let out = '';
        try {
          out = execFileSync(P('node_modules/.bin/httpyac'), ['send', 'half.http', '--all'], { encoding: 'utf-8', cwd: dir });
        } catch (e) {
          out = `${e.stdout}${e.stderr}`;
        }
        expect(out).toContain('The server aborted pending request');
        expect(out).toContain('1 requests processed (1 errored)');
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  }, 30000);

  it('🔴 return 판 — 창에 에러가 없다 · 둘 다 404', async () => {
    await withLab('board.js', SNAP('step3-return.board.js'), 4006, async (lab) => {
      const nine = await newLines(lab, () => getJson(`${lab.base}/api/notices/9`));
      expect(nine.lines.map(noMs)).toEqual(['GET /api/notices/9 404', 'GET /api/notices/9 404 ms - 40']);
    });
  });

  it('🔴 스냅숏 — guard 판은 에러 미들웨어 맨 앞에 다섯 줄 · return 판은 404 분기에 return; 과 주석 한 줄 삭제', () => {
    const two = read(SNAP('step2.board.js'));
    const guard = read(SNAP('step3-guard.board.js'));
    expect(guard).toBe(two.replace('app.use((err, req, res, next) => {\n',
      'app.use((err, req, res, next) => {\n  if (res.headersSent) {\n    next(err);\n    return;\n  }\n\n'));
    expect(read(SNAP('step3-return.board.js'))).toBe(guard
      .replace("// 일부러 404 분기에 return; 을 빠뜨렸다\n", '')
      .replace("    res.status(404).json({ message: '그런 공지는 없어요' });\n  }\n",
        "    res.status(404).json({ message: '그런 공지는 없어요' });\n    return;\n  }\n"));
  });
});

describe('축 ④ — Step 4: Express 5 가 받는 async 에러 · 못 받는 async 에러', () => {
  it('🔴 await 한 판 — 1번 200(100ms 남짓) · 3번 500 + 창에 에러(at saveView · at async) · 9번 404', async () => {
    await withLab('board.js', SNAP('step4.board.js'), 4006, async (lab) => {
      const one = await newLines(lab, () => post(`${lab.base}/api/notices/1/views`));
      expect(one.res).toMatchObject({ status: 200, body: { message: '조회 수를 남겼어요' } });
      expect(Number(/ (\d+\.\d)ms$/.exec(one.lines[0])[1])).toBeGreaterThanOrEqual(100);
      const three = await newLines(lab, () => post(`${lab.base}/api/notices/3/views`));
      expect(three.res).toMatchObject({ status: 500, body: { message: '서버에서 문제가 생겼어요' } });
      expect(three.lines.map(noMs)).toEqual(['Error: 3번 공지의 조회 수를 저장하지 못했어요',
        'POST /api/notices/3/views 500', 'POST /api/notices/3/views 500 ms - 49']);
      expect(lab.tail()).toMatch(/at saveView \(file:\/\/\/\S+\/lab\/p3-29\/board\.js:35:11\)\n {4}at async file:\/\/\/\S+\/lab\/p3-29\/board\.js:44:3/);
      const nine = await post(`${lab.base}/api/notices/9/views`);
      expect(nine).toMatchObject({ status: 404, body: { message: '그런 공지는 없어요' } });
    });
  });

  it('🔴 await 를 뺀 판 — 1번 · 3번 모두 200 이 바로 가고(10ms 안쪽) 그 뒤 서버가 꺼진다 · 다음 요청은 연결 거부', async () => {
    const dir = studentLab({ 'board.js': SNAP('step4-no-await.board.js') });
    const lab = await boot(join(dir, LAB_DIR, 'board.js'), { port: 4006, ready: '4006번 포트에서', env: { NO_COLOR: '1' } });
    try {
      const one = await newLines(lab, () => post(`${lab.base}/api/notices/1/views`), 50);
      expect(one.res.status).toBe(200);
      expect(Number(/ (\d+\.\d)ms$/.exec(one.lines[0])[1])).toBeLessThan(50);
      expect((await post(`${lab.base}/api/notices/3/views`))).toMatchObject({ status: 200, body: { message: '조회 수를 남겼어요' } });
      await sleep(400);
      expect(lab.tail()).toContain("    throw new Error(`${id}번 공지의 조회 수를 저장하지 못했어요`);\n          ^\n\nError: 3번 공지의 조회 수를 저장하지 못했어요");
      expect(lab.tail()).toMatch(/\n\nNode\.js v24\.\d+\.\d+\n/);
      expect(await fetch(`${lab.base}/api/notices/1`).then(() => 'answered', () => 'refused')).toBe('refused');
    } finally {
      await Promise.race([lab.stop(), sleep(500)]);
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('🔴 --watch 로 띄우면 꺼진 뒤 «Failed running \'lab/p3-29/board.js\'. Waiting for file changes before restarting...»', async () => {
    const dir = studentLab({ 'board.js': SNAP('step4-no-await.board.js') });
    const envNoTest = { ...process.env, NO_COLOR: '1' };
    delete envNoTest.NODE_ENV;
    delete envNoTest.VITEST;
    const child = spawn(process.execPath, ['--watch', `${LAB_DIR}/board.js`], { cwd: dir, env: envNoTest });
    let log = '';
    child.stdout.on('data', (b) => { log += b; });
    child.stderr.on('data', (b) => { log += b; });
    try {
      for (let i = 0; i < 40 && !log.includes('4006번 포트에서'); i += 1) await sleep(100);
      await fetch('http://localhost:4006/api/notices/3/views', { method: 'POST' });
      await sleep(600);
      expect(log).toContain("Failed running 'lab/p3-29/board.js'. Waiting for file changes before restarting...");
    } finally {
      child.kill();
      await sleep(200);
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('축 ⑤ — Step 5: 돌려준 Promise · asyncHandler · Express 4', () => {
  it('🔴 router 2.2.0 layer.js — 함수가 돌려준 값이 Promise 면 실패할 때 next(error)', () => {
    const src = read(P('node_modules/router/lib/layer.js'));
    const block = "    // invoke function\n    const ret = fn(req, res, next)\n\n    // wait for returned promise\n    if (isPromise(ret)) {\n"
      + "      if (!(ret instanceof Promise)) {\n        deprecate('handlers that are Promise-like are deprecated, use a native Promise instead')\n      }\n\n"
      + "      ret.then(null, function (error) {\n        next(error || new Error('Rejected promise'))\n      })\n    }\n  } catch (err) {\n    next(err)\n  }";
    expect(src).toContain(block);
    expect(JSON.parse(read(P('node_modules/router/package.json'))).version).toBe('2.2.0');
  });

  it('🔴 asyncHandler 로 감싼 판도 3번은 같은 500 · 감싼 함수의 length 는 3', async () => {
    await withLab('board.js', SNAP('step5-async-handler.board.js'), 4006, async (lab) => {
      expect(await post(`${lab.base}/api/notices/3/views`)).toMatchObject({ status: 500, body: { message: '서버에서 문제가 생겼어요' } });
      expect(await post(`${lab.base}/api/notices/1/views`)).toMatchObject({ status: 200 });
    });
    const asyncHandler = (fn) => (req, res, next) => { fn(req, res, next).catch(next); };
    expect(asyncHandler(async (req, res) => {}).length).toBe(3);
  });

  it('🔴 Express 4.22.3 — 같은 Step 4 판(await 한 판)에서 3번 조회 수를 남기면 서버가 꺼진다 · 5.2.1 은 500', async () => {
    const dir4 = mkdtempSync(join(tmpdir(), 'p329-e4-'));
    try {
      writeFileSync(join(dir4, 'package.json'), '{"type":"module","private":true}');
      execFileSync('npm', ['install', 'express@4.22.3', 'morgan@1.12.1', '--prefer-offline', '--no-audit', '--no-fund'],
        { cwd: dir4, encoding: 'utf8' });
      expect(JSON.parse(read(join(dir4, 'node_modules/express/package.json'))).version).toBe('4.22.3');
      const dir = studentLab({ 'board.js': SNAP('step4.board.js') }, join(dir4, 'node_modules'));
      const lab = await boot(join(dir, LAB_DIR, 'board.js'), { port: 4006, ready: '4006번 포트에서', env: { NO_COLOR: '1' } });
      try {
        const res = await fetch(`${lab.base}/api/notices/3/views`, { method: 'POST' }).then((r) => r.status, () => 'no answer');
        expect(res).toBe('no answer');
        await sleep(200);
        expect(lab.tail()).toContain('Error: 3번 공지의 조회 수를 저장하지 못했어요');
        expect(lab.tail()).toMatch(/\n\nNode\.js v24\.\d+\.\d+\n/);
        expect(await fetch(`${lab.base}/api/notices/1`).then(() => 'answered', () => 'refused')).toBe('refused');
      } finally {
        await Promise.race([lab.stop(), sleep(500)]);
        rmSync(dir, { recursive: true, force: true });
      }
    } finally {
      rmSync(dir4, { recursive: true, force: true });
    }
  }, 120000);

  it('🔴 Step 5 겪기 — express4 별칭: 안 감싼 판은 응답 없이 서버가 꺼지고 · asyncHandler 판은 500 · (...args) 판도 500', async () => {
    const dir4 = mkdtempSync(join(tmpdir(), 'p329-alias-'));
    try {
      writeFileSync(join(dir4, 'package.json'), '{"type":"module","private":true}');
      execFileSync('npm', ['install', 'express@5.2.1', 'express4@npm:express@4.22.3', 'morgan@1.12.1', '--prefer-offline', '--no-audit', '--no-fund'],
        { cwd: dir4, encoding: 'utf8' });
      const modules = join(dir4, 'node_modules');
      expect(JSON.parse(read(join(modules, 'express/package.json'))).version).toBe('5.2.1');
      expect(JSON.parse(read(join(modules, 'express4/package.json'))).version).toBe('4.22.3');
      const dir = studentLab({ 'board.js': SNAP('step5-express4.board.js') }, modules);
      const lab = await boot(join(dir, LAB_DIR, 'board.js'), { port: 4006, ready: '4006번 포트에서', env: { NO_COLOR: '1' } });
      try {
        expect(await fetch(`${lab.base}/api/notices/3/views`, { method: 'POST' }).then((r) => r.status, () => 'no answer')).toBe('no answer');
        await sleep(200);
        expect(lab.tail()).toContain('at saveView (');
        expect(lab.tail()).toMatch(/board\.js:35:11\)\n    at async .*board\.js:44:3/);
        expect(await fetch(`${lab.base}/api/notices/1`).then(() => 'answered', () => 'refused')).toBe('refused');
      } finally {
        await Promise.race([lab.stop(), sleep(500)]);
        rmSync(dir, { recursive: true, force: true });
      }
      await withLab('board.js', SNAP('step5-express4-wrapped.board.js'), 4006, async (wrapped) => {
        expect(await post(`${wrapped.base}/api/notices/3/views`)).toMatchObject({ status: 500, body: { message: '서버에서 문제가 생겼어요' } });
        expect(await post(`${wrapped.base}/api/notices/1/views`)).toMatchObject({ status: 200 });
        expect(wrapped.tail()).toMatch(/board\.js:35:11\)\n    at async .*board\.js:50:3/);
      }, { modules });
      await withLab('board.js', read(SNAP('step5-rest-args.board.js')).replace("from 'express';", "from 'express4';"), 4006, async (rest) => {
        expect(await post(`${rest.base}/api/notices/3/views`)).toMatchObject({ status: 500, body: { message: '서버에서 문제가 생겼어요' } });
        expect(await post(`${rest.base}/api/notices/1/views`)).toMatchObject({ status: 200 });
      }, { modules });
    } finally {
      rmSync(dir4, { recursive: true, force: true });
    }
  }, 120000);

  it('🔴 Step 5 — (...args) 판도 Express 5 에서 같은 결과(length 0 이어도 라우트로는 불린다)', async () => {
    await withLab('board.js', SNAP('step5-rest-args.board.js'), 4006, async (lab) => {
      expect(await post(`${lab.base}/api/notices/3/views`)).toMatchObject({ status: 500, body: { message: '서버에서 문제가 생겼어요' } });
      expect(await post(`${lab.base}/api/notices/1/views`)).toMatchObject({ status: 200, body: { message: '조회 수를 남겼어요' } });
      expect((await post(`${lab.base}/api/notices/9/views`)).status).toBe(404);
    });
    const rest = (fn) => (...args) => fn(...args).catch(args[2]);
    expect(rest(async (req, res) => {}).length).toBe(0);
  });

  it('🔴 Step 5 — .catch 에 console.log 를 넣은 판: 에러 위에 «asyncHandler가 받았어요»', async () => {
    await withLab('board.js', SNAP('step5-catch-log.board.js'), 4006, async (lab) => {
      const { res, lines } = await newLines(lab, () => post(`${lab.base}/api/notices/3/views`));
      expect(res).toMatchObject({ status: 500 });
      expect(lines.indexOf('asyncHandler가 받았어요')).toBeGreaterThanOrEqual(0);
      expect(lines.indexOf('asyncHandler가 받았어요')).toBeLessThan(lines.indexOf('Error: 3번 공지의 조회 수를 저장하지 못했어요'));
    });
  });

  it('🔴 Step 5 스냅숏 — Express 4 판은 import 한 줄만 · 감싼 판은 asyncHandler 판에서 import 한 줄만 · console.log 판은 .catch 만', () => {
    const swap = (text) => text.replace("import express from 'express';", "import express from 'express4';");
    expect(read(SNAP('step5-express4.board.js'))).toBe(swap(read(SNAP('step4.board.js'))));
    expect(read(SNAP('step5-express4-wrapped.board.js'))).toBe(swap(read(SNAP('step5-async-handler.board.js'))));
    expect(read(SNAP('step5-catch-log.board.js'))).toBe(read(SNAP('step5-async-handler.board.js')).replace('fn(req, res, next).catch(next);',
      "fn(req, res, next).catch((err) => {\n      console.log('asyncHandler가 받았어요');\n      next(err);\n    });"));
  });

  it('🔴 Step 5 — express4 를 깔면 패키지 25개가 더해지고, 지우면 package.json · package-lock.json 이 그대로 돌아온다', () => {
    const dir = mkdtempSync(join(tmpdir(), 'p329-lock-'));
    try {
      cpSync(R('package.json'), join(dir, 'package.json'));
      cpSync(R('package-lock.json'), join(dir, 'package-lock.json'));
      const before = { pkg: read(join(dir, 'package.json')), lock: read(join(dir, 'package-lock.json')) };
      const keys = () => Object.keys(JSON.parse(read(join(dir, 'package-lock.json'))).packages);
      const start = new Set(keys());
      const npm = (...args) => execFileSync('npm', [...args, '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: dir, encoding: 'utf8' });
      npm('install', 'express4@npm:express@4.22.3');
      expect(keys().filter((k) => !start.has(k))).toHaveLength(25);
      npm('uninstall', 'express4');
      expect(read(join(dir, 'package.json'))).toBe(before.pkg);
      expect(read(join(dir, 'package-lock.json'))).toBe(before.lock);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60000);
});

describe('축 ⑥ — Step 6: 에러 미들웨어 여러 개', () => {
  it('🔴 기록용 → 응답용 — 창에 «[에러] POST /api/notices/3/views» 와 에러 · 응답은 500', async () => {
    await withLab('board.js', SNAP('step6.board.js'), 4006, async (lab) => {
      const three = await newLines(lab, () => post(`${lab.base}/api/notices/3/views`));
      expect(three.res).toMatchObject({ status: 500, body: { message: '서버에서 문제가 생겼어요' } });
      expect(three.lines.map(noMs)).toEqual(['[에러] POST /api/notices/3/views', 'Error: 3번 공지의 조회 수를 저장하지 못했어요',
        'POST /api/notices/3/views 500', 'POST /api/notices/3/views 500 ms - 49']);
    });
  });

  it('🔴 차례를 바꾼 판 — 응답은 같은 500 인데 창에 에러가 하나도 안 남는다', async () => {
    await withLab('board.js', SNAP('step6-swapped.board.js'), 4006, async (lab) => {
      const three = await newLines(lab, () => post(`${lab.base}/api/notices/3/views`));
      expect(three.res).toMatchObject({ status: 500, body: { message: '서버에서 문제가 생겼어요' } });
      expect(three.lines.map(noMs)).toEqual(['POST /api/notices/3/views 500', 'POST /api/notices/3/views 500 ms - 49']);
    });
  });

  it('🔴 둘로 나눈 판에서 응답 뒤 에러(return 누락)는 두 번 찍힌다 — 기록용 한 번 · Express 기본 처리 한 번', async () => {
    await withLab('board.js', SNAP('step6-no-return.board.js'), 4006, async (lab) => {
      const nine = await newLines(lab, () => getJson(`${lab.base}/api/notices/9`));
      expect(nine.res.status).toBe(404);
      const got = nine.lines.map(noMs);
      expect(got.slice(0, 4)).toEqual(['[에러] GET /api/notices/9', ERR_SENT, "  code: 'ERR_HTTP_HEADERS_SENT'", '}']);
      expect(got.slice(4).sort()).toEqual(['GET /api/notices/9 404', 'GET /api/notices/9 404 ms - 40', ERR_SENT].sort());
    });
  });

  it('🔴 스냅숏 — Step 6 판 = Step 4 판에서 에러 미들웨어 하나를 둘로 · 바꾼 판은 둘의 차례만', () => {
    const six = read(SNAP('step6.board.js'));
    const rec = six.slice(six.indexOf('// 에러를 기록한다'), six.indexOf('// 에러에 답한다'));
    const resp = six.slice(six.indexOf('// 에러에 답한다'), six.indexOf('app.listen('));
    expect(read(SNAP('step6-swapped.board.js'))).toBe(six.replace(rec + resp, resp + rec));
    expect(rec).toContain('  next(err);\n');
    expect(resp).not.toContain('console.error');
  });
});

describe('축 ⑦ — Step 7: 내장 미들웨어 (lab/p3-29/parsers.js 4007)', () => {
  const send = (base, type, body) => getJson(`${base}/api/echo`, { method: 'POST', headers: { 'Content-Type': type }, body });
  it('🔴 json · urlencoded · text — 폼으로 보낸 true 는 글자 "true"', async () => {
    await withLab('parsers.js', LAB('parsers.js'), 4007, async (lab) => {
      expect((await send(lab.base, 'application/json', '{"title": "서버 점검 안내", "pinned": true}')).body)
        .toEqual({ contentType: 'application/json', body: { title: '서버 점검 안내', pinned: true } });
      expect((await send(lab.base, 'application/x-www-form-urlencoded', 'title=서버 점검 안내&pinned=true')).body)
        .toEqual({ contentType: 'application/x-www-form-urlencoded', body: { title: '서버 점검 안내', pinned: 'true' } });
      expect((await send(lab.base, 'text/plain', '서버 점검 안내')).body)
        .toEqual({ contentType: 'text/plain', body: '서버 점검 안내' });
      // Express 5 의 urlencoded 는 extended 가 기본 false — 대괄호 이름을 객체로 펼치지 않는다
      expect((await send(lab.base, 'application/x-www-form-urlencoded', 'user[name]=yuna')).body.body).toEqual({ 'user[name]': 'yuna' });
      // 읽을 미들웨어가 없는 형식은 그대로 null
      expect((await send(lab.base, 'application/xml', '<title>서버 점검</title>')).body).toEqual({ contentType: 'application/xml', body: null });
    });
  });

  it('🔴 express.json() 만 있는 처음 판 — 폼 · 글자는 body 가 null(에러 없이 그냥 넘긴다)', async () => {
    await withLab('parsers.js', SNAP('step7-json-only.parsers.js'), 4007, async (lab) => {
      const form = await newLines(lab, () => send(lab.base, 'application/x-www-form-urlencoded', 'title=서버 점검 안내&pinned=true'));
      expect(form.res.body).toEqual({ contentType: 'application/x-www-form-urlencoded', body: null });
      expect(form.lines.map(noMs)).toEqual(['POST /api/echo 200']);
      expect((await send(lab.base, 'text/plain', '서버 점검 안내')).body).toEqual({ contentType: 'text/plain', body: null });
    });
    expect(read(SNAP('step7-json-only.parsers.js'))).toBe(read(LAB('parsers.js')).replace('app.use(express.urlencoded());\napp.use(express.text());\n', ''));
  });

  it('🔴 parsers.http 세 요청을 httpYac 으로 — 읽힌 본문', () => {
    const dir = studentLab({ 'parsers.js': LAB('parsers.js') });
    const child = spawn(process.execPath, [`${LAB_DIR}/parsers.js`], { cwd: dir });
    try {
      execFileSync('sleep', ['0.8']);
      cpSync(LAB('parsers.http'), join(dir, 'parsers.http'));
      const out = JSON.parse(execFileSync(P('node_modules/.bin/httpyac'), ['send', 'parsers.http', '--all', '--json'], { encoding: 'utf-8', cwd: dir }));
      expect(out.requests.map((r) => JSON.parse(r.response.body).body)).toEqual([
        { title: '서버 점검 안내', pinned: true }, { title: '서버 점검 안내', pinned: 'true' }, '서버 점검 안내']);
    } finally {
      child.kill();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('🔴 p3-21 인가 서버도 폼을 express.urlencoded 로 읽었다', () => {
    expect(read(P('lab/p3-21/auth-server.js'))).toContain('app.use(express.urlencoded({ extended: false }));');
  });
});

describe('축 ⑧ — Step 8: helmet', () => {
  const HELMET = ['content-security-policy', 'cross-origin-opener-policy', 'cross-origin-resource-policy', 'origin-agent-cluster',
    'referrer-policy', 'strict-transport-security', 'x-content-type-options', 'x-dns-prefetch-control', 'x-download-options',
    'x-frame-options', 'x-permitted-cross-domain-policies', 'x-xss-protection'];
  const headerNames = (url) => new Promise((resolve) => {
    http.get(url, (res) => { res.resume(); resolve(res.rawHeaders.filter((_, i) => i % 2 === 0)); });
  });
  it('🔴 helmet 전(Step 6 판) — X-Powered-By 가 있고 위 12개는 없다 · 후(끝 판) — 12개가 더해지고 X-Powered-By 가 사라진다', async () => {
    let before;
    await withLab('board.js', SNAP('step6.board.js'), 4006, async (lab) => { before = await headerNames(`${lab.base}/api/notices/1`); });
    expect(before).toEqual(['X-Powered-By', 'Content-Type', 'Content-Length', 'ETag', 'Date', 'Connection', 'Keep-Alive']);
    let after;
    await withLab('board.js', LAB('board.js'), 4006, async (lab) => { after = await headerNames(`${lab.base}/api/notices/1`); });
    expect(after.map((h) => h.toLowerCase())).toEqual([...HELMET, 'content-type', 'content-length', 'etag', 'date', 'connection', 'keep-alive']);
    expect(JSON.parse(read(P('node_modules/helmet/package.json'))).version).toBe('8.3.0');
  });

  it('🔴 끝 판 = Step 6 판 + import 한 줄 + app.use(helmet()) 한 줄(morgan 다음)', () => {
    expect(read(LAB('board.js'))).toBe(read(SNAP('step6.board.js'))
      .replace("import morgan from 'morgan';\n", "import morgan from 'morgan';\nimport helmet from 'helmet';\n")
      .replace("app.use(morgan('dev'));\n", "app.use(morgan('dev'));\napp.use(helmet());\n"));
  });

  it('🔴 Step 8 겪기 — other-site.js(4008)는 4006 의 공지를 <iframe> 으로 띄운다', async () => {
    await withLab('other-site.js', LAB('other-site.js'), 4008, async (lab) => {
      const res = await getJson(`${lab.base}/`);
      expect(res.status).toBe(200);
      expect(res.body).toContain('<iframe src="http://localhost:4006/api/notices/1"');
    });
  });

  it('🔴 Step 8 — 끝 판 응답에 frame-ancestors · SAMEORIGIN · script-src-attr · 같은 ETag 로 다시 물으면 304 에도 그 헤더가 실린다(브라우저가 막는 근거)', async () => {
    await withLab('board.js', SNAP('step6.board.js'), 4006, async (plain) => {
      const res = await fetch(`${plain.base}/api/notices/1`);
      expect(res.headers.get('content-security-policy')).toBeNull();
      expect(res.headers.get('x-frame-options')).toBeNull();
    });
    await withLab('board.js', LAB('board.js'), 4006, async (lab) => {
      const first = await fetch(`${lab.base}/api/notices/1`);
      const csp = first.headers.get('content-security-policy');
      expect(csp).toContain("frame-ancestors 'self'");
      expect(csp).toContain("script-src-attr 'none'");
      expect(first.headers.get('x-frame-options')).toBe('SAMEORIGIN');
      const again = await fetch(`${lab.base}/api/notices/1`, { headers: { 'If-None-Match': first.headers.get('etag'), 'Cache-Control': 'max-age=0' } });
      expect(again.status).toBe(304);
      expect(again.headers.get('content-security-policy')).toContain("frame-ancestors 'self'");
      await sleep(100);
      expect(lab.tail()).toMatch(/GET \/api\/notices\/1 304 \d+\.\dms/);
    });
  });

  it('🔴 helmet 의 Cross-Origin-Resource-Policy 는 same-origin', async () => {
    await withLab('board.js', LAB('board.js'), 4006, async (lab) => {
      const res = await fetch(`${lab.base}/api/notices/1`);
      expect(res.headers.get('cross-origin-resource-policy')).toBe('same-origin');
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    });
  });
});

describe('축 ⑨ — 수업 백엔드', () => {
  it('🔴 app.js 는 code/p3-28 에서 에러 미들웨어 맨 앞 다섯 줄만 더했다', () => {
    const before = read(join(BEFORE.dir, 'app.js'));
    expect(read(R('app.js'))).toBe(before.replace('app.use((err, req, res, next) => {\n',
      'app.use((err, req, res, next) => {\n  if (res.headersSent) {\n    next(err);\n    return;\n  }\n\n'));
  });

  it('🔴 평범한 요청은 그대로 — 게시물 목록 200 · 없는 주소 404 · 깨진 JSON 400 · 없는 게시물 404 · 나는 누구 401', async () => {
    expect((await fetch(`${server.base}/api/posts?limit=1`)).status).toBe(200);
    expect(await getJson(`${server.base}/api/comments`)).toMatchObject({ status: 404, body: { message: '그런 주소는 없어요' } });
    expect(await getJson(`${server.base}/api/posts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"broken' }))
      .toMatchObject({ status: 400, body: { message: '보낸 내용을 읽을 수 없어요' } });
    expect((await getJson(`${server.base}/api/posts/999`)).status).toBe(404);
    expect((await getJson(`${server.base}/api/auth/me`)).status).toBe(401);
  });

  it('🔴 package.json — dependencies 에 helmet ^8.3.0 · morgan ^1.12.1 이 더해졌다(나머지 그대로)', () => {
    const before = JSON.parse(read(join(BEFORE.dir, 'package.json')));
    const after = JSON.parse(read(R('package.json')));
    expect(after.dependencies).toEqual({ ...before.dependencies, helmet: '^8.3.0', morgan: '^1.12.1' });
    expect(Object.keys(after.dependencies)).toEqual(Object.keys(after.dependencies).toSorted());
    expect(after.devDependencies).toEqual(before.devDependencies);
  });
});

describe('축 ⑩ — 실습·과제 (lab/p3-29)', () => {
  it('🔴 직접 해보기 1 (4001) — :response-time 판은 헤더를 먼저 보낸 slow 에서 1ms 아래 · 손 로거는 500ms 남짓(확인 절차가 틀린 판을 가려낸다)', async () => {
    const wrong = read(LAB('practice1.js')).replace(':total-time[1]ms', ':response-time[1]ms');
    await withLab('practice1.js', wrong, 4001, async (lab) => {
      const slow = await newLines(lab, () => getJson(`${lab.base}/api/slow`));
      const ms = slow.lines.map((l) => Number(/ (\d+\.\d)ms$/.exec(l)[1]));
      expect(ms[0]).toBeGreaterThanOrEqual(500);
      expect(ms[1]).toBeLessThan(10);
    });
    expect(read(SNAP('practice1-blank.js'))).toBe(read(LAB('practice1.js')).replace("app.use(morgan(':method :url :status :total-time[1]ms'));", 'app.use(morgan(____));'));
    execFileSync(process.execPath, ['--check', SNAP('practice1-blank.js')]);
  });

  it('🔴 직접 해보기 1 (4001) — morgan 형식 문자열로 손 로거와 같은 모양 · slow 는 둘 다 500ms 남짓', async () => {
    await withLab('practice1.js', LAB('practice1.js'), 4001, async (lab) => {
      const fast = await newLines(lab, () => getJson(`${lab.base}/api/fast`));
      expect(fast.res.body).toEqual({ message: '바로 답했어요' });
      expect(fast.lines).toHaveLength(2);
      for (const line of fast.lines) expect(line).toMatch(/^GET \/api\/fast 200 \d+\.\dms$/);
      const slow = await newLines(lab, () => getJson(`${lab.base}/api/slow`));
      for (const line of slow.lines) {
        expect(line).toMatch(/^GET \/api\/slow 200 \d+\.\dms$/);
        expect(Number(/ (\d+\.\d)ms$/.exec(line)[1])).toBeGreaterThanOrEqual(500);
      }
    });
  });

  it('🔴 직접 해보기 2 (4002) — 처음 판을 하나씩: [1,2] 200 · [4,3] 200(거짓) · 0.1초 뒤 서버가 꺼져 «읽은 공지 번호» 는 연결 거부', async () => {
    const dir = studentLab({ 'practice2.js': SNAP('practice2-start.js') });
    const lab = await boot(join(dir, LAB_DIR, 'practice2.js'), { port: 4002, ready: '4002번 포트에서' });
    const send = (ids) => getJson(`${lab.base}/api/notices/read`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) });
    try {
      expect(await send([1, 2])).toMatchObject({ status: 200, body: { message: '읽음으로 표시했어요' } });
      await sleep(300);
      expect(await send([4, 3])).toMatchObject({ status: 200, body: { message: '읽음으로 표시했어요' } });
      await sleep(400);
      expect(lab.tail()).toContain('Error: 3번 공지를 읽음으로 표시하지 못했어요');
      expect(await fetch(`${lab.base}/api/notices/read`).then(() => 'answered', () => 'refused')).toBe('refused');
    } finally {
      await Promise.race([lab.stop(), sleep(500)]);
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('🔴 직접 해보기 2 해설 — forEach 앞에 await 을 붙인 판도 처음 판과 같다: [1,2] 200 · [4,3] 200 · 0.1초 뒤 서버가 꺼진다', async () => {
    expect(read(SNAP('practice2-await-foreach.js'))).toBe(read(SNAP('practice2-start.js'))
      .replace("app.post('/api/notices/read', (req, res) => {\n  req.body.ids.forEach(", "app.post('/api/notices/read', async (req, res) => {\n  await req.body.ids.forEach("));
    const dir = studentLab({ 'practice2.js': SNAP('practice2-await-foreach.js') });
    const lab = await boot(join(dir, LAB_DIR, 'practice2.js'), { port: 4002, ready: '4002번 포트에서' });
    const send = (ids) => getJson(`${lab.base}/api/notices/read`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) });
    try {
      expect(await send([1, 2])).toMatchObject({ status: 200 });
      await sleep(300);
      expect(await send([4, 3])).toMatchObject({ status: 200, body: { message: '읽음으로 표시했어요' } });
      await sleep(400);
      expect(lab.tail()).toContain('Error: 3번 공지를 읽음으로 표시하지 못했어요');
      expect(await fetch(`${lab.base}/api/notices/read`).then(() => 'answered', () => 'refused')).toBe('refused');
    } finally {
      await Promise.race([lab.stop(), sleep(500)]);
      rmSync(dir, { recursive: true, force: true });
    }
  });

  for (const [label, from, minMs, maxMs] of [['for…of(해설)', LAB('practice2.js'), 200, 300], ['Promise.all(더 좋아요)', SNAP('practice2-all.js'), 100, 180]]) {
    it(`🔴 직접 해보기 2 — ${label}: [1,2] 200 · [4,3] 500 · 서버가 산다 · readIds [1, 2, 4](4번만 표시된 채) · 걸린 시간 ${minMs}ms 대`, async () => {
      await withLab('practice2.js', from, 4002, async (lab) => {
        const send = (ids) => newLines(lab, () => getJson(`${lab.base}/api/notices/read`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) }));
        const ok = await send([1, 2]);
        expect(ok.res).toMatchObject({ status: 200, body: { message: '읽음으로 표시했어요' } });
        const ms = Number(/ (\d+\.\d)ms$/.exec(ok.lines.at(-1))[1]);
        expect(ms).toBeGreaterThanOrEqual(minMs);
        expect(ms).toBeLessThan(maxMs);
        const bad = await send([4, 3]);
        expect(bad.res).toMatchObject({ status: 500, body: { message: '서버에서 문제가 생겼어요' } });
        expect(bad.lines.map(noMs)).toEqual(['Error: 3번 공지를 읽음으로 표시하지 못했어요', 'POST /api/notices/read 500']);
        expect((await getJson(`${lab.base}/api/notices/read`)).body).toEqual({ readIds: [1, 2, 4] });
      });
    });
  }

  it('🔴 직접 해보기 3 (4003) — 폼으로 올리면 303 → 목록 · 빈 제목 400 · urlencoded 를 빼면 500 TypeError(reading \'title\')', async () => {
    await withLab('practice3.js', LAB('practice3.js'), 4003, async (lab) => {
      const page = await getJson(`${lab.base}/`);
      expect(page.body).toContain('<form method="post" action="/api/notices">');
      const res = await fetch(`${lab.base}/api/notices`, { method: 'POST', redirect: 'manual',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ title: '새 기능 소개 ' }) });
      expect(res.status).toBe(303);
      expect(res.headers.get('location')).toBe('/api/notices');
      expect((await getJson(`${lab.base}/api/notices`)).body).toEqual([{ id: 1, title: '서버 점검 안내' }, { id: 2, title: '새 기능 소개' }]);
      expect(await getJson(`${lab.base}/api/notices`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'title=%20%20' }))
        .toMatchObject({ status: 400, body: { message: '제목을 적어 주세요' } });
    });
    await withLab('practice3.js', SNAP('practice3-no-parser.js'), 4003, async (lab) => {
      const res = await newLines(lab, () => getJson(`${lab.base}/api/notices`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'title=abc' }));
      expect(res.res.status).toBe(500);
      expect(res.lines.map(noMs)).toEqual(['POST /api/notices 500', "TypeError: Cannot read properties of undefined (reading 'title')"]);
    });
  });

  it('🔴 직접 해보기 3 뼈대 — 빈칸 셋 · 비운 채로 node --check 통과 · 채우면 해설 판', () => {
    const blank = read(SNAP('practice3-blank.js'));
    expect(count(blank, '____')).toBe(3);
    execFileSync(process.execPath, ['--check', SNAP('practice3-blank.js')]);
    expect(blank.replace('app.use(____);', 'app.use(express.urlencoded());').replace('req.body.____.trim()', 'req.body.title.trim()')
      .replace("res.redirect(____, '/api/notices');", "res.redirect(303, '/api/notices');")).toBe(read(LAB('practice3.js')));
  });

  it('🔴 과제 [기초] (4011) — 1번(200)은 줄이 없고 abc(400) · 9번(404) · boom(500)만 morgan 줄 · <= 400 판은 abc 줄이 빠진다', async () => {
    await withLab('homework1.js', LAB('homework1.js'), 4011, async (lab) => {
      const one = await newLines(lab, () => getJson(`${lab.base}/api/notices/1`));
      expect(one.res.body).toEqual({ id: 1, title: '서버 점검 안내' });
      expect(one.lines).toEqual([]);
      const abc = await newLines(lab, () => getJson(`${lab.base}/api/notices/abc`));
      expect(abc.res).toMatchObject({ status: 400, body: { message: '공지 번호는 숫자로 보내 주세요' } });
      expect(abc.lines.map(noMs)).toEqual(['GET /api/notices/abc 400 ms - 57']);
      const nine = await newLines(lab, () => getJson(`${lab.base}/api/notices/9`));
      expect(nine.lines.map(noMs)).toEqual(['GET /api/notices/9 404 ms - 40']);
      const boom = await newLines(lab, () => getJson(`${lab.base}/api/boom`));
      expect(boom.lines.map(noMs)).toEqual(['Error: 일부러 낸 에러예요', 'GET /api/boom 500 ms - 49']);
    });
    await withLab('homework1.js', read(LAB('homework1.js')).replace('res.statusCode < 400,', 'res.statusCode <= 400,'), 4011, async (lab) => {
      expect((await newLines(lab, () => getJson(`${lab.base}/api/notices/abc`))).lines).toEqual([]);
    });
    const blank = read(SNAP('homework1-blank.js'));
    expect(count(blank, '____')).toBe(1);
    execFileSync(process.execPath, ['--check', SNAP('homework1-blank.js')]);
    expect(blank.replace('  skip: ____,', '  skip: (req, res) => res.statusCode < 400,')).toBe(read(LAB('homework1.js')));
  });

  it('🔴 과제 [응용] (4012) — 하나씩: 에러 넷이 기록(쿼리 문자열까지) · 404 는 기록 안 됨 · late 는 200 + 로거 200 · 차례를 바꾸면 late 하나만 · req.path 판은 쿼리가 빠진다', async () => {
    const urls = ['/api/boom', '/api/slow-boom', '/api/late', '/api/boom?from=homework', '/api/nope'];
    const run = async (from, expected) => {
      await withLab('homework2.js', from, 4012, async (lab) => {
        const got = [];
        for (const u of urls) {
          const r = await newLines(lab, () => getJson(`${lab.base}${u}`));
          got.push(r.res.status);
          if (u === '/api/late') {
            expect(r.res.body).toEqual({ message: '먼저 답했어요' });
            expect(r.lines.map(noMs).sort()).toEqual(['Error: 답한 뒤에 낸 에러예요', 'GET /api/late 200']);
          }
        }
        expect(got).toEqual([500, 500, 200, 500, 404]);
        expect((await getJson(`${lab.base}/api/errors`)).body.map((e) => e.url)).toEqual(expected);
      });
    };
    await run(LAB('homework2.js'), ['/api/boom', '/api/slow-boom', '/api/late', '/api/boom?from=homework']);
    await run(SNAP('homework2-swapped.js'), ['/api/late']);
    await run(read(LAB('homework2.js')).replace('url: req.originalUrl', 'url: req.path'), ['/api/boom', '/api/slow-boom', '/api/late', '/api/boom']);
  });

  it('🔴 과제 [응용] 요구사항 8 — 다섯 요청 뒤 바로 던지는 에러를 세 번 더 보내면 가장 오래된 둘(boom · slow-boom)이 빠진다', async () => {
    await withLab('homework2.js', LAB('homework2.js'), 4012, async (lab) => {
      for (const u of ['/api/boom', '/api/slow-boom', '/api/late', '/api/boom?from=homework', '/api/nope', '/api/boom', '/api/boom', '/api/boom']) {
        await fetch(`${lab.base}${u}`);
        await sleep(150);
      }
      expect((await getJson(`${lab.base}/api/errors`)).body.map((e) => e.url))
        .toEqual(['/api/late', '/api/boom?from=homework', '/api/boom', '/api/boom', '/api/boom']);
    });
  });

  it('🔴 경로 주석 — 학생 쪽 lab 파일은 ~/instagram-api/lab/p3-29/… · 실습 .http 는 포트가 맞다', () => {
    const files = { 'board.js': 4006, 'parsers.js': 4007, 'practice1.js': 4001, 'practice2.js': 4002, 'practice3.js': 4003, 'homework1.js': 4011, 'homework2.js': 4012 };
    for (const [name, port] of Object.entries(files)) {
      const src = read(LAB(name));
      expect(src.split('\n')[0]).toBe(`// ~/instagram-api/${LAB_DIR}/${name}`);
      expect(src).toContain(`app.listen(${port}, () => {`);
      const httpFile = LAB(name.replace('.js', '.http'));
      if (existsSync(httpFile)) {
        for (const line of read(httpFile).split('\n').filter((l) => /^(GET|POST) /.test(l))) expect(line).toContain(`http://localhost:${port}/`);
      }
    }
  });
});

describe('축 ⑪ — 이 회차 학생 파일', () => {
  it('🔴 code/p3-28 에서 바뀐 학생 파일은 셋 — app.js · package.json · package-lock.json', () => {
    // 북마크가 있으면 두 북마크 사이, 없으면(이 회차를 짓는 중) 작업트리와 비교한다.
    const out = execFileSync('git', ['diff', '--name-only', 'code/p3-28', ...(ROUND.fromBookmark ? ['code/p3-29'] : []), '--',
      'app.js', 'db.js', 'errors.js', 'routes', 'services', 'middlewares', 'schemas', 'requests', 'package.json', 'package-lock.json', 'seed.js', 'prisma'],
    { cwd: P('.'), encoding: 'utf8' }).trim().split('\n').filter(Boolean);
    expect(out.sort()).toEqual(['app.js', 'package-lock.json', 'package.json']);
  });
});

describe('축 ⑫ — 교안·답안 코드 블록', () => {
  it('🔴 학생 쪽 실습 경로는 lab/p3-29/ — 교안·답안에 평평한 경로가 없고, 회차 폴더를 만드는 법을 말한다', () => {
    const flat = /\blab\/(board|parsers|practice\d|homework\d|hook)\b/;
    const texts = [P('../../part3/5-express-core/p3-29-error-builtin-thirdparty-lecture.md'), P('../../part3/5-express-core/p3-29-error-builtin-thirdparty-answers.md')].map(read);
    for (const text of texts) expect(text.split('\n').filter((l) => flat.test(l))).toEqual([]);
    expect(texts[0]).toContain('경로째 적으면');
    expect(texts[0]).toContain('두 단계를 올라가요');
  });

  it('🔴 실습 파일 · 스냅숏은 수업 백엔드를 ../../ 로 부른다 — 한 단계만 올라가는 줄이 없다', () => {
    const snaps = execFileSync('ls', [P('snapshots')], { encoding: 'utf8' }).split('\n').filter((f) => /^p3-29\..*\.js$/.test(f)).map((f) => P(`snapshots/${f}`));
    const labs = execFileSync('ls', [P(LAB_DIR)], { encoding: 'utf8' }).split('\n').filter((f) => f.endsWith('.js')).map((f) => LAB(f));
    const lines = [...labs, ...snaps].flatMap((f) => read(f).split('\n').map((l) => [f, l]));
    expect(lines.filter(([, l]) => /from '\.\.\/(?!\.\.\/)/.test(l))).toEqual([]);
    expect(lines.filter(([, l]) => l.startsWith('// ~/instagram-api/lab/') && !l.startsWith(`// ~/instagram-api/${LAB_DIR}/`))).toEqual([]);
  });

  const LECTURE = P('../../part3/5-express-core/p3-29-error-builtin-thirdparty-lecture.md');
  const ANSWERS = P('../../part3/5-express-core/p3-29-error-builtin-thirdparty-answers.md');
  const blocks = (file) => {
    const out = [];
    const re = /^```(\w*)\n([\s\S]*?)^```$/gm;
    let m;
    const text = read(file);
    while ((m = re.exec(text))) out.push({ lang: m[1], lines: m[2].replace(/\n$/, '').split('\n') });
    return out;
  };
  const snapshotsFor = (name) => {
    const all = execFileSync('ls', [P('snapshots')], { encoding: 'utf8' }).split('\n');
    return all.filter((f) => f.startsWith('p3-29.') && (f.endsWith(`.${name}`) || f.startsWith(`p3-29.${name.replace('.js', '')}`)))
      .map((f) => P(`snapshots/${f}`));
  };
  const candidates = (path) => {
    if (path.startsWith('~/instagram-api/node_modules/')) return [P(path.slice('~/instagram-api/'.length))];
    const rel = path.slice('~/instagram-api/'.length);
    if (rel.startsWith(`${LAB_DIR}/`)) {
      const name = rel.slice(`${LAB_DIR}/`.length);
      return [LAB(name), ...snapshotsFor(name)];
    }
    if (rel.startsWith('lab/')) return [P(rel)]; // 교안이 앞 회차 파일을 `lab/p3-21/…` 로 부른다
    return [R(rel), join(BEFORE.dir, rel)];
  };
  // `...` 줄은 생략, `____` 줄은 빈칸 — 나머지 줄은 그 파일 안에 «차례대로» 있어야 한다.
  const inOrder = (lines, file) => {
    if (!existsSync(file)) return '(파일 없음)';
    const src = read(file).split('\n');
    let at = 0;
    for (const line of lines) {
      if (line.trim() === '...') continue;
      const found = src.indexOf(line, at);
      if (found === -1) return line;
      at = found + 1;
    }
    return null;
  };

  for (const [label, file] of [['교안', LECTURE], ['답안', ANSWERS]]) {
    it(`🔴 ${label}의 javascript 블록 — 경로 주석 파일(또는 중간 판·빈칸 판)에 줄이 차례대로 있다`, () => {
      const misses = [];
      let checked = 0;
      for (const { lang, lines } of blocks(file)) {
        if (lang !== 'javascript') continue;
        const m = /^\/\/ (~\/instagram-api\/\S+)$/.exec(lines[0]);
        if (!m) continue;
        checked += 1;
        const miss = candidates(m[1]).map((f) => inOrder(lines.slice(1), f));
        if (miss.every((x) => x !== null)) misses.push(`${m[1]}: ${miss[0]}`);
      }
      expect(checked).toBeGreaterThan(0);
      expect(misses).toEqual([]);
    });
  }

  it('🔴 경로 주석 없는 javascript 블록 — Express 4 예제 · Promise.all · 흔한 실수 둘(skip · setTimeout)은 스냅숏·실습 파일에 있다', () => {
    const pool = [SNAP('step5-async-handler.board.js'), SNAP('practice2-all.js'), LAB('homework1.js'), SNAP('homework2-settimeout.js')].map(read).join('\n');
    const noPath = [...blocks(LECTURE), ...blocks(ANSWERS)].filter((b) => b.lang === 'javascript' && !b.lines[0].startsWith('// ~/'));
    expect(noPath).toHaveLength(4);
    for (const { lines } of noPath) {
      const body = lines.map((l) => l.replace('skip: res.statusCode < 400,', 'skip: (req, res) => res.statusCode < 400,'));
      expect(body.every((l) => pool.includes(l)), lines[0]).toBe(true);
    }
  });

  it('🔴 교안·답안의 http 블록 — 실습 요청 파일에 그대로 있다 · 교안 Step 1 + Step 4 블록을 이으면 board.http', () => {
    const pool = ['board.http', 'parsers.http', 'practice1.http', 'practice2.http', 'homework1.http', 'homework2.http'].map((n) => read(LAB(n))).join('\n');
    const http = [...blocks(LECTURE), ...blocks(ANSWERS)].filter((b) => b.lang === 'http');
    for (const { lines } of http) expect(pool.includes(lines.join('\n')), lines[0]).toBe(true);
    const board = blocks(LECTURE).filter((b) => b.lang === 'http' && b.lines.some((l) => l.includes(':4006/')));
    expect(`${board.map((b) => b.lines.join('\n')).join('\n\n')}\n`).toBe(read(LAB('board.http')));
  });

  it('🔴 Step 8 — 교안의 응답 헤더 블록 둘은 httpYac 이 보여 주는 헤더 이름 · 차례와 같다(date 값만 다르다)', () => {
    const heads = blocks(LECTURE).filter((b) => b.lang === '' && b.lines[0] === 'HTTP/1.1 200 OK');
    expect(heads).toHaveLength(2);
    const names = (b) => b.lines.slice(1).map((l) => l.split(':')[0]);
    const before = ['connection', 'content-length', 'content-type', 'date', 'etag', 'keep-alive', 'x-powered-by'];
    expect(names(heads[0])).toEqual(before);
    const helmetNames = ['content-security-policy', 'cross-origin-opener-policy', 'cross-origin-resource-policy', 'origin-agent-cluster',
      'referrer-policy', 'strict-transport-security', 'x-content-type-options', 'x-dns-prefetch-control', 'x-download-options',
      'x-frame-options', 'x-permitted-cross-domain-policies', 'x-xss-protection'];
    expect(names(heads[1])).toEqual([...before.filter((n) => n !== 'x-powered-by'), ...helmetNames].sort());
  });

  it('🔴 Step 1 · 3 · 4 · 6 — 교안이 인용한 로거 줄의 «메서드 주소 상태» 가 판정이 본 줄과 같다', () => {
    const text = read(LECTURE);
    for (const line of ['GET /api/notices/9 500 1.1ms', 'GET /api/notices/9 500 0.288 ms - 40', 'GET /api/notices/9 404 1.071 ms - 40',
      'POST /api/notices/3/views 500 102.5ms', 'POST /api/notices/3/views 200 0.5ms', '[에러] POST /api/notices/3/views',
      'at saveView (file:///Users/hong/instagram-api/lab/p3-29/board.js:35:11)', 'at async file:///Users/hong/instagram-api/lab/p3-29/board.js:44:3',
      "Failed running 'lab/p3-29/board.js'. Waiting for file changes before restarting...", 'at file:///Users/hong/instagram-api/lab/p3-29/board.js:29:7',
      'at file:///Users/hong/instagram-api/lab/p3-29/board.js:43:19', 'npm install express4@npm:express@4', 'npm uninstall express4',
      '`added 25 packages`', 'at async file:///Users/hong/instagram-api/lab/p3-29/board.js:50:3', 'asyncHandler가 받았어요',
      'The server aborted pending request', 'GET /api/notices/1 304 ', "frame-ancestors 'self'", '`http://localhost:4008`',
      'node lab/p3-29/other-site.js']) {
      expect(text, line).toContain(line);
    }
  });

  it('🔴 낭독이 잡은 문장 — 사실이 아니거나 학생이 안 해 본 것을 해 봤다고 하던 문장이 돌아오지 않는다', () => {
    const text = read(LECTURE);
    for (const line of ['매개변수 셋을 적은 함수를 돌려줘야 해요', '끄는 방법도 봤죠', '직접 해보기 1에서 겪은 장면', '제가 Express 4(4.22 버전)', '감싸기 전과 같은 결과예요',
      '`GET`으로 다시 요청하게 하는 상태 코드', '«기록한 에러»', '«바로 던지는 에러»를']) {
      expect(text, line).not.toContain(line);
    }
    expect(read(ANSWERS)).not.toContain('진짜 해결이에요');
  });

  it('🔴 Step 8 표 — 헤더마다 «막으려는 일» 칸 · 브라우저가 지키는 약속 · 서버 쪽 일은 안 막는다', () => {
    const text = read(LECTURE);
    expect(text).toContain('| 헤더 | 브라우저에게 알려 주는 것 | 막으려는 일 |');
    for (const line of ['클릭재킹(clickjacking)', 'XSS', '**이 헤더들은 모두 브라우저가 지키는 약속이에요.**', 'SQL 인젝션']) expect(text, line).toContain(line);
  });
});

describe('축 ⑬ — 교안 🙋 · 답안의 주장', () => {
  it('🔴 Step 4 🙋 — 기다리지 않을 Promise 에 .catch 를 붙이면 3번도 200 · 창에 에러 · 서버는 산다', async () => {
    expect(read(SNAP('step4-catch.board.js'))).toBe(read(SNAP('step4.board.js'))
      .replace('  await saveView(req.notice.id);\n', '  saveView(req.notice.id).catch((err) => {\n    console.error(err);\n  });\n'));
    await withLab('board.js', SNAP('step4-catch.board.js'), 4006, async (lab) => {
      expect(await post(`${lab.base}/api/notices/3/views`)).toMatchObject({ status: 200, body: { message: '조회 수를 남겼어요' } });
      await sleep(300);
      expect(lab.tail()).toContain('Error: 3번 공지의 조회 수를 저장하지 못했어요');
      expect((await getJson(`${lab.base}/api/notices/1`)).status).toBe(200);
    });
  });

  it('🔴 Step 7 🙋 — 라우트에 붙인 express.raw 는 app.use(express.json()) 보다 «위» 에 등록해야 Buffer · 아래면 이미 객체', async () => {
    const make = (rawFirst) => [
      '// ~/instagram-api/lab/p3-29/hook.js',
      "import express from 'express';",
      'const app = express();',
      "const hook = (req, res) => { res.json({ isBuffer: Buffer.isBuffer(req.body) }); };",
      rawFirst ? "app.post('/api/hook', express.raw({ type: 'application/json' }), hook);" : '',
      'app.use(express.json());',
      rawFirst ? '' : "app.post('/api/hook', express.raw({ type: 'application/json' }), hook);",
      "app.listen(4007, () => { console.log('실습 서버가 4007번 포트에서 기다리고 있어요.'); });",
      '',
    ].join('\n');
    for (const [rawFirst, expected] of [[true, true], [false, false]]) {
      await withLab('hook.js', make(rawFirst), 4007, async (lab) => {
        const r = await getJson(`${lab.base}/api/hook`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"a":1}' });
        expect(r.body).toEqual({ isBuffer: expected });
      });
    }
  });

  it('🔴 Step 8 🤔 — helmet 의 crossOriginResourcePolicy 옵션으로 그 헤더만 cross-origin', async () => {
    const src = read(LAB('board.js')).replace('app.use(helmet());', "app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));");
    await withLab('board.js', src, 4006, async (lab) => {
      const res = await fetch(`${lab.base}/api/notices/1`);
      expect(res.headers.get('cross-origin-resource-policy')).toBe('cross-origin');
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    });
  });

  it('🔴 과제 [기초] — 기준을 뒤집으면(>= 400) 1번만 morgan 줄 · abc · 9번은 줄 없음 · 에러 줄은 그대로', async () => {
    const src = read(LAB('homework1.js')).replace('res.statusCode < 400,', 'res.statusCode >= 400,');
    await withLab('homework1.js', src, 4011, async (lab) => {
      const one = await newLines(lab, () => getJson(`${lab.base}/api/notices/1`));
      expect(one.lines.map(noMs)).toEqual(['GET /api/notices/1 200 ms - 39']);
      expect((await newLines(lab, () => getJson(`${lab.base}/api/notices/abc`))).lines).toEqual([]);
      expect((await newLines(lab, () => getJson(`${lab.base}/api/notices/9`))).lines).toEqual([]);
      expect((await newLines(lab, () => getJson(`${lab.base}/api/boom`))).lines).toEqual(['Error: 일부러 낸 에러예요']);
    });
  });

  it('🔴 과제 [기초] 흔한 실수 — skip 에 조건식을 적으면 뜨자마자 ReferenceError: res is not defined', () => {
    const dir = studentLab({ 'homework1.js': read(LAB('homework1.js')).replace('  skip: (req, res) => res.statusCode < 400,', '  skip: res.statusCode < 400,') });
    try {
      let out = '';
      try {
        execFileSync(process.execPath, [`${LAB_DIR}/homework1.js`], { cwd: dir, encoding: 'utf8', stdio: 'pipe', timeout: 5000 });
      } catch (e) {
        out = `${e.stdout}${e.stderr}`;
      }
      expect(out).toContain("  skip: res.statusCode < 400,\n        ^\n\nReferenceError: res is not defined");
      expect(out).toContain('lab/p3-29/homework1.js:9');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('🔴 과제 [기초] — 에러 줄의 위치는 homework1.js:36:9', async () => {
    await withLab('homework1.js', LAB('homework1.js'), 4011, async (lab) => {
      await fetch(`${lab.base}/api/boom`);
      await sleep(150);
      expect(lab.tail()).toMatch(/at file:\/\/\/\S+\/lab\/p3-29\/homework1\.js:36:9/);
    });
  });

  it('🔴 과제 [응용] 흔한 실수 — 기록하는 쪽에서 next(err) 를 빠뜨리면 기록은 남고 요청은 매달린다 · 로거 줄도 없다', async () => {
    const src = read(LAB('homework2.js')).replace('  if (errorLog.length > 5) {\n    errorLog.shift();\n  }\n\n  next(err);\n', '  if (errorLog.length > 5) {\n    errorLog.shift();\n  }\n');
    expect(src).not.toBe(read(LAB('homework2.js')));
    await withLab('homework2.js', src, 4012, async (lab) => {
      const hung = await fetch(`${lab.base}/api/boom`, { signal: AbortSignal.timeout(1500) }).then(() => 'answered', () => 'no answer');
      expect(hung).toBe('no answer');
      expect((await getJson(`${lab.base}/api/errors`)).body).toEqual([{ method: 'GET', url: '/api/boom', message: '일부러 낸 에러예요' }]);
      expect(lab.tail()).not.toContain('GET /api/boom');
    });
  });

  it('🔴 과제 [응용] 흔한 실수 — setTimeout 안에서 던지면 응답 없이 서버가 꺼진다', async () => {
    const src = read(SNAP('homework2-settimeout.js'));
    expect(src).toBe(read(LAB('homework2.js')).replace(
      "app.get('/api/slow-boom', async (req, res) => {\n  await new Promise((resolve) => setTimeout(resolve, 100));\n  throw new Error('기다렸다가 낸 에러예요');\n});",
      "app.get('/api/slow-boom', (req, res) => {\n  setTimeout(() => {\n    throw new Error('기다렸다가 낸 에러예요');\n  }, 100);\n});"));
    const dir = studentLab({ 'homework2.js': src });
    const lab = await boot(join(dir, LAB_DIR, 'homework2.js'), { port: 4012, ready: '4012번 포트에서' });
    try {
      expect(await fetch(`${lab.base}/api/slow-boom`).then((r) => r.status, () => 'no answer')).toBe('no answer');
      await sleep(200);
      expect(lab.tail()).toContain("    throw new Error('기다렸다가 낸 에러예요');\n    ^\n\nError: 기다렸다가 낸 에러예요");
      expect(await fetch(`${lab.base}/api/errors`).then(() => 'answered', () => 'refused')).toBe('refused');
    } finally {
      await Promise.race([lab.stop(), sleep(500)]);
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('🔴 과제 [응용] 🙋 — httpYac 으로 네 요청을 한꺼번에 보내면 /api/late 뒤 요청이 socket hang up(Express 가 그 연결을 끊는다)', async () => {
    await withLab('homework2.js', LAB('homework2.js'), 4012, async () => {
      const dir = mkdtempSync(join(tmpdir(), 'p329-http-'));
      try {
        cpSync(LAB('homework2.http'), join(dir, 'homework2.http'));
        let out = '';
        try {
          out = execFileSync(P('node_modules/.bin/httpyac'), ['send', 'homework2.http', '--all'], { encoding: 'utf-8', cwd: dir });
        } catch (e) {
          out = `${e.stdout}${e.stderr}`;
        }
        expect(out).toContain('socket hang up');
        expect(out).toContain('먼저 답했어요');
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  }, 30000);
});

describe('축 ⑭ — 교안이 기대는 앞 회차 사실', () => {
  const part = (rel) => read(P(`../../${rel}`));
  const LECTURE = () => part('part3/5-express-core/p3-29-error-builtin-thirdparty-lecture.md');
  const ANSWER = () => part('part3/5-express-core/p3-29-error-builtin-thirdparty-answers.md');

  it('🔴 Step 4 · 주제 1 ↔ p2-25 과제 [응용] — 세 주소 · 답안의 까닭 · uncaughtException', () => {
    const lecture = part('part2/4-node-backend/p2-25-deploy-lecture.md');
    expect(lecture).toContain('하나는 함수 안에서 바로 `throw`하고, 하나는 `await`을 한 번 한 뒤에 `throw`하고, 하나는 `setTimeout` 안에서 `throw`하세요.');
    const answer = part('part2/4-node-backend/p2-25-deploy-answers.md');
    expect(answer).toContain('아무도 안 받은 에러는 Node가 프로그램을 끝내는 것으로 처리하고요.');
    expect(answer).toContain("process.on('uncaughtException')");
    expect(answer).toContain("app.get('/boom/sync', (req, res) => {"); // Step 4 «바로 던진 에러는 catch 가» — async 가 아니어야 맞는 문장
    expect(answer).toContain('다만 이건 「고치는 것」이 아니라 「죽기 전에 기록이라도 남기는 것」이에요.');
    expect(LECTURE()).toContain('배포를 배울 때 과제에서');
    expect(ANSWER()).toContain('«고치는 것»이 아니라 «죽기 전에 기록이라도 남기는 것»');
  });

  it('🔴 Step 3 ↔ p3-27 — 에러 미들웨어의 next 에 기본값을 붙여 Express 기본 처리가 답하게 한 장면', () => {
    const text = part('part3/5-express-core/p3-27-middleware-structure-lecture.md');
    expect(text).toContain('`app.js` 맨 아래 에러 미들웨어의 `next`에 기본값을 붙이고 저장해요.');
    expect(text).toContain('Express의 기본 에러 처리가 답한 거예요.');
    expect(LECTURE()).toContain('에러 미들웨어의 `next`에 기본값을 붙였더니');
  });

  it('🔴 Step 1 ↔ p3-27 — 거짓 500 은 직접 해보기 1 의 해설 안에 있었다(요구사항이 아니다)', () => {
    const text = part('part3/5-express-core/p3-27-middleware-structure-lecture.md');
    expect(text).toContain('로거 줄도 404가 아니라 `GET /api/notices/9 500`으로 찍혀요.');
    expect(LECTURE()).toContain('직접 해보기 1의 해설에서 읽기만 한 장면');
  });

  it('🔴 직접 해보기 2 ↔ p1-44 — 규칙 문장이 그 회차에 그대로 있다', () => {
    const rule = '비동기를 반복문으로 돌릴 거면 `for...of`를 쓰세요';
    expect(part('part1/7-js-async/p1-44-js-async-await-lecture.md')).toContain(rule);
    expect(LECTURE()).toContain(rule);
  });

  it('🔴 직접 해보기 3 ↔ p3-21 — authorize 줄의 303 은 본문에 있다', () => {
    expect(part('part3/3-auth-principles/p3-21-oauth-oidc-lecture.md')).toContain('`authorize`(303)');
    expect(LECTURE()).toContain('Network 탭의 `authorize` 줄에서 봤어요');
  });

  it('🔴 Step 8 ↔ p3-21 · p3-19 · p2-25 · p2-34 — 클릭재킹 · XSS · 막는 주체는 브라우저 · SQL 인젝션', () => {
    const oauth = part('part3/3-auth-principles/p3-21-oauth-oidc-lecture.md');
    expect(oauth).toContain('클릭재킹(clickjacking)이라고 불러요');
    expect(part('part3/3-auth-principles/p3-19-cookie-auth-lecture.md')).toContain('XSS(Cross-Site Scripting)라고 불러요');
    expect(part('part2/4-node-backend/p2-25-deploy-lecture.md')).toContain('막는 주체가 브라우저이기 때문이에요.');
    expect(part('part2/5-db-prisma/p2-34-more-relations-lecture.md')).toContain('SQL 인젝션(SQL injection)이라고 불러요');
    expect(LECTURE()).toContain('OAuth를 배울 때 이야기한 클릭재킹(clickjacking)이에요.');
  });
});
