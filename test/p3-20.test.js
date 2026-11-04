// p3-20 「고쳐도 소용없는 값 — 세션과 토큰」 게이트 — 백엔드
//
// `3-auth-principles` 둘째 회차다. 수업 백엔드의 로그인 첫 버전(쿠키에 사람 번호)을 «세션» 판으로 갈아 끼운다
// (`services/sessionService.js` — 메모리 `Map` · `randomUUID` / `routes/auth.js` — 로그인 쿠키 `sessionId` ·
// `readSessionId` · `/me` · `POST /logout` / `requests/auth.http`). 토큰(JWT)은 `lab/` 의 스크립트·서버로만 다룬다 —
// 수업 백엔드가 JWT 로 바뀌는 것은 `p3-37` 이다(`curriculum.md` 「`p3-20` 착수 결정」).
// 판정은 학생이 치는 `node app.js` 를 그대로 띄워 진짜 포트로 왕복한다(`boot.js`).
//
// 축 ① 로그인 — 사람 번호 대신 무작위 세션 ID(UUID)를 쿠키에 · 로그인할 때마다 다른 ID · 옵션은 p3-19 그대로.
// 축 ② 나는 누구 — 서버가 기억한 세션에서 사람을 찾는다 · 한 글자만 고쳐도, 번호를 넣어도, 옛 `userId` 쿠키여도 401 ·
//      `Authorization: Bearer <세션 ID>` 도 받는다(헤더가 먼저).
// 축 ③ 로그아웃 — 서버가 세션을 지우고 쿠키를 지우라고 답한다 · 복사해 둔 ID 는 그 뒤로 401 · 로그인 안 한 채 보내도 200.
// 축 ④ 서버가 다시 뜨면 세션이 사라진다 — 끄고 켜도, `node --watch` 가 파일 저장으로 다시 띄워도.
// 축 ⑤ `requests/auth.http` 를 httpYac 으로 — 여섯 요청 · 로그아웃의 `Set-Cookie` 가 기억한 쿠키를 지운다.
// 축 ⑥ Step 별 판 — Step 1 판은 로그인만 세션(`/me` 는 아직 옛 판).
// 축 ⑦ 토큰 스크립트 다섯(`lab/p3-20/base64.js`·`token.js`·`verify.js`·`old-token.js`·`expire.js`)의 출력.
//      `verify.js` 는 가짜 토큰을 `jwt.decode` 로 먼저 연다 · `old-token.js` 는 교안 Step 5 에 실린 토큰(만료 없음)을 지금 확인한다.
// 실습·과제 — `lab/p3-20/`(학생 쪽 경로 주석은 `~/instagram-api/lab/p3-20/…`).
//
// 🔎 크롬에서만 보이는 주장(Application 탭에서 쿠키 줄 더하기·지우기 · 로그아웃 뒤 쿠키 표)은
//    이 파일이 못 본다 — 기록 `progress/p3-20-session-token.md` 「브라우저 실측」 이 헤드리스 크롬으로 쟀다.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, mkdtempSync, rmSync, cpSync, writeFileSync, symlinkSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { createHmac } from 'node:crypto';
import pg from 'pg';
import { boot } from './helpers/boot.js';
import { roundDir } from './helpers/round.js';
import { setupP236 } from '../sql/p2-36/setup.mjs';
import { applyMigrationsAfter, P234_LAST } from './helpers/tip-schema.js';

const ROOT = new URL('../', import.meta.url);
const P = (rel) => new URL(rel, ROOT).pathname;
const ADMIN = { host: 'localhost', port: 5432, database: 'postgres', user: 'postgres', password: 'postgres' };
const GATE_DB = 'p320_gate';
const GATE_URL = `postgresql://postgres:postgres@localhost:5432/${GATE_DB}`;
const ENV = { DATABASE_URL: GATE_URL, CORS_ORIGIN: 'http://localhost:5173' };
const PORT = 3591;

const read = (p) => readFileSync(p, 'utf8');

// 학생 파일은 이 회차 북마크 `code/p3-20` 을 풀어서 읽는다(없으면 작업트리 — 이 회차를 짓는 동안).
const ROUND = roundDir('code/p3-20');
const R = (rel) => join(ROUND.dir, rel);

let db = null;
let server = null;

const seed = () =>
  execFileSync(process.execPath, [P('seed.js')],
    { cwd: P('.'), encoding: 'utf8', env: { ...process.env, ...ENV } });

const dropGate = async () => {
  const admin = new pg.Client(ADMIN);
  await admin.connect();
  await admin.query(
    `select pg_terminate_backend(pid) from pg_stat_activity where datname = '${GATE_DB}' and pid <> pg_backend_pid()`);
  await admin.query(`DROP DATABASE IF EXISTS ${GATE_DB}`);
  return admin;
};

const bootApp = (dir, port) => boot(join(dir, 'app.js'), {
  port, env: { ...ENV, PORT: String(port) }, ready: `${port}번 포트에서`,
});

beforeAll(async () => {
  const admin = await dropGate();
  await admin.query(`CREATE DATABASE ${GATE_DB}`);
  await admin.end();

  db = new pg.Client({ ...ADMIN, database: GATE_DB });
  await db.connect();
  await setupP236(db);
  // 공유 Prisma 클라이언트가 tip 스키마로 만들어져 있다 — 시드가 새 컬럼을 고르니 DB 도 맞춘다(`helpers/tip-schema.js`).
  await applyMigrationsAfter(db, P234_LAST);
  seed();

  server = await bootApp(ROUND.dir, PORT);
}, 120000);

afterAll(async () => {
  if (server) await server.stop();
  if (db) await db.end();
  const admin = await dropGate();
  await admin.end();
  ROUND.cleanup();
}, 60000);

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const login = (base, username) =>
  fetch(`${base}/api/auth/login`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ username }) });
const me = async (base, headers = {}) => {
  const res = await fetch(`${base}/api/auth/me`, { headers });
  return { status: res.status, body: await res.json() };
};
const logout = (base, headers = {}) => fetch(`${base}/api/auth/logout`, { method: 'POST', headers });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const sessionCookie = (res) => res.headers.getSetCookie()[0].split(';')[0];
const sessionIdOf = (res) => sessionCookie(res).replace('sessionId=', '');

// httpYac CLI 로 `.http` 를 위에서부터 보낸다 — 학생이 VS Code 에서 차례로 누르는 것과 같다.
// 🚨 httpYac 은 실행 폴더 밖의 파일을 거부한다(`Path … is not in cwd`) — 그 폴더에서 돌린다.
const sendHttp = (file, port, name = 'auth.http') => {
  const text = read(file).replaceAll('http://localhost:3000', `http://localhost:${port}`)
    .replaceAll('http://localhost:4011', `http://localhost:${port}`);
  const dir = mkdtempSync(join(tmpdir(), 'p320-http-'));
  try {
    writeFileSync(join(dir, name), text);
    const out = execFileSync(P('node_modules/.bin/httpyac'),
      ['send', name, '--all', '--json'], { encoding: 'utf-8', cwd: dir });
    return JSON.parse(out).requests;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

// 학생 폴더를 임시 폴더에 옮겨 둔다(파일 하나를 바꾼 판 · `--watch` 판을 띄울 때).
const STUDENT = ['app.js', 'db.js', 'errors.js', 'routes', 'services', 'middlewares', 'schemas', 'requests', 'package.json'];
const copyStudent = (from, prefix) => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  for (const name of STUDENT) cpSync(join(from, name), join(dir, name), { recursive: true });
  symlinkSync(P('node_modules'), join(dir, 'node_modules'));
  return dir;
};

describe('축 ① — 로그인은 사람 번호 대신 세션 ID 를 쿠키에 담는다', () => {
  it('🔴 jaehoon 으로 로그인하면 200 · 그 사람 · `Set-Cookie: sessionId=<UUID>` 하나(옵션은 지난 시간 그대로)', async () => {
    const res = await login(server.base, 'jaehoon');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: 2, username: 'jaehoon', profileImage: 'https://picsum.photos/seed/jaehoon/40/40',
    });
    const lines = res.headers.getSetCookie();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^sessionId=[0-9a-f-]{36}; Max-Age=604800; Path=\/; Expires=.+ GMT; HttpOnly; SameSite=Lax$/);
    expect(sessionIdOf(res)).toMatch(UUID);
    expect(lines[0]).not.toContain('userId');
  });

  it('🔴 로그인할 때마다 다른 ID — 같은 사람이 두 번 로그인해도 세션은 둘', async () => {
    const a = sessionIdOf(await login(server.base, 'jaehoon'));
    const b = sessionIdOf(await login(server.base, 'jaehoon'));
    expect(a).not.toBe(b);
    expect((await me(server.base, { Cookie: `sessionId=${a}` })).body.username).toBe('jaehoon');
    expect((await me(server.base, { Cookie: `sessionId=${b}` })).body.username).toBe('jaehoon');
  });

  it('🔴 없는 이름은 401 · 쿠키를 안 준다 · 이름을 안 보내면 400', async () => {
    const res = await login(server.base, 'hana');
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ message: '그런 사용자는 없어요' });
    expect(res.headers.getSetCookie()).toEqual([]);
    const empty = await fetch(`${server.base}/api/auth/login`, { method: 'POST', headers: JSON_HEADERS, body: '{}' });
    expect(empty.status).toBe(400);
  });
});

describe('축 ② — 나는 누구: 서버가 기억한 세션에서 사람을 찾는다', () => {
  it('🔴 로그인 쿠키를 실으면 그 사람 · 쿠키가 없으면 401 「로그인이 필요해요」', async () => {
    const cookie = sessionCookie(await login(server.base, 'minji'));
    expect((await me(server.base, { Cookie: cookie })).body).toEqual({
      id: 3, username: 'minji', profileImage: 'https://picsum.photos/seed/minji/40/40',
    });
    expect(await me(server.base)).toEqual({ status: 401, body: { message: '로그인이 필요해요' } });
  });

  it('🔴 ID 를 한 글자만 고쳐도 401 · 번호를 넣어도 401 · 지난 시간의 `userId=2` 쿠키도 401', async () => {
    const id = sessionIdOf(await login(server.base, 'jaehoon'));
    const last = id.at(-1) === '0' ? '1' : '0';
    expect((await me(server.base, { Cookie: `sessionId=${id.slice(0, -1)}${last}` })).status).toBe(401);
    expect((await me(server.base, { Cookie: 'sessionId=1' })).status).toBe(401);
    expect((await me(server.base, { Cookie: 'userId=2' })).status).toBe(401);
  });

  it('🔴 다른 쿠키와 섞여 와도 sessionId 만 골라 읽는다', async () => {
    const cookie = sessionCookie(await login(server.base, 'dahye'));
    expect((await me(server.base, { Cookie: `userId=2; ${cookie}; theme=dark` })).body.username).toBe('dahye');
  });

  it('🔴 `Authorization: Bearer <세션 ID>` 도 받는다 · 헤더가 쿠키보다 먼저 · `Bearer 3` 은 401', async () => {
    const id = sessionIdOf(await login(server.base, 'nayeon'));
    const other = sessionCookie(await login(server.base, 'dahye'));
    expect((await me(server.base, { Authorization: `Bearer ${id}` })).body.username).toBe('nayeon');
    expect((await me(server.base, { Authorization: `Bearer ${id}`, Cookie: other })).body.username).toBe('nayeon');
    expect((await me(server.base, { Authorization: 'Bearer 3' })).status).toBe(401);
    // 교안 Step 2 «그 세션 ID를 한 글자만 바꿔 적으면 쿠키로 보내든 헤더로 보내든 401» — 헤더 쪽(2026-10-30 소급 뒤 낭독)
    const flipped = id.slice(0, -1) + (id.endsWith('a') ? 'b' : 'a');
    expect((await me(server.base, { Authorization: `Bearer ${flipped}` })).status).toBe(401);
    expect((await me(server.base, { Authorization: 'Basic x', Cookie: other })).body.username).toBe('dahye');
  });
});

describe('축 ③ — 로그아웃은 서버가 세션을 지운다', () => {
  it('🔴 200 「로그아웃했어요」 · 쿠키를 지우라는 `Set-Cookie` · 복사해 둔 ID 는 그 뒤로 401', async () => {
    const res = await login(server.base, 'jaehoon');
    const cookie = sessionCookie(res);
    expect((await me(server.base, { Cookie: cookie })).status).toBe(200);
    const out = await logout(server.base, { Cookie: cookie });
    expect(out.status).toBe(200);
    expect(await out.json()).toEqual({ message: '로그아웃했어요' });
    expect(out.headers.getSetCookie()).toEqual(['sessionId=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT']);
    expect(await me(server.base, { Cookie: cookie })).toEqual({ status: 401, body: { message: '로그인이 필요해요' } });
  });

  it('🔴 다른 사람·다른 기기의 세션은 그대로 · 같은 사람의 다른 세션도 그대로', async () => {
    const a = sessionCookie(await login(server.base, 'jaehoon'));
    const b = sessionCookie(await login(server.base, 'jaehoon'));
    const c = sessionCookie(await login(server.base, 'minji'));
    await logout(server.base, { Cookie: a });
    expect((await me(server.base, { Cookie: a })).status).toBe(401);
    expect((await me(server.base, { Cookie: b })).body.username).toBe('jaehoon');
    expect((await me(server.base, { Cookie: c })).body.username).toBe('minji');
  });

  it('🔴 로그인 안 한 채 보내도 200(두 번 보내도 같다) · 헤더에 실은 세션도 지운다', async () => {
    expect((await logout(server.base)).status).toBe(200);
    const id = sessionIdOf(await login(server.base, 'seungwoo'));
    expect((await logout(server.base, { Authorization: `Bearer ${id}` })).status).toBe(200);
    expect((await me(server.base, { Authorization: `Bearer ${id}` })).status).toBe(401);
    expect((await logout(server.base, { Authorization: `Bearer ${id}` })).status).toBe(200);
  });
});

describe('축 ④ — 서버가 다시 뜨면 세션이 사라진다(메모리 Map)', () => {
  it('🔴 껐다 켜면 같은 쿠키로 401', async () => {
    const dir = copyStudent(ROUND.dir, 'p320-restart-');
    try {
      let s = await bootApp(dir, 3592);
      const cookie = sessionCookie(await login(s.base, 'jaehoon'));
      expect((await me(s.base, { Cookie: cookie })).status).toBe(200);
      await s.stop();
      s = await bootApp(dir, 3592);
      try {
        expect(await me(s.base, { Cookie: cookie })).toEqual({ status: 401, body: { message: '로그인이 필요해요' } });
      } finally {
        await s.stop();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('🔴 `node --watch` 로 띄운 서버는 파일을 저장하기만 해도 다시 떠서 로그인이 풀린다(`npm run dev`)', async () => {
    const dir = copyStudent(ROUND.dir, 'p320-watch-');
    const env = { ...process.env, ...ENV, PORT: '3593' };
    delete env.NODE_ENV;
    delete env.VITEST;
    const child = spawn(process.execPath, ['--watch', 'app.js'], { cwd: dir, env });
    let log = '';
    child.stdout.on('data', (b) => { log += b.toString(); });
    child.stderr.on('data', (b) => { log += b.toString(); });
    const waitFor = async (pred, ms = 8000) => {
      const end = Date.now() + ms;
      while (Date.now() < end) {
        if (pred()) return;
        await new Promise((r) => setTimeout(r, 50));
      }
      throw new Error(`기다리던 줄이 안 나왔다:\n${log}`);
    };
    try {
      await waitFor(() => log.includes('3593번 포트에서'));
      const base = 'http://localhost:3593';
      const cookie = sessionCookie(await login(base, 'jaehoon'));
      expect((await me(base, { Cookie: cookie })).status).toBe(200);
      const before = log.split('3593번 포트에서').length;
      // 🚨 서버가 뜬 «직후»에 저장하면 --watch 가 아직 그 파일을 지켜보기 전일 수 있다(2026-10-28 한 번 놓침) —
      //    학생은 뜬 뒤 한참 있다 저장하니, 조금 기다렸다 저장하고 안 뜨면 한 번 더 저장한다.
      await new Promise((r) => setTimeout(r, 1000));
      for (let tries = 0; tries < 3 && log.split('3593번 포트에서').length === before; tries++) {
        appendFileSync(join(dir, 'routes/auth.js'), '\n');
        await waitFor(() => log.split('3593번 포트에서').length > before, 4000).catch(() => {});
      }
      expect(log.split('3593번 포트에서').length).toBeGreaterThan(before);
      expect(log).toMatch(/Restarting 'app\.js'/);
      expect((await me(base, { Cookie: cookie })).status).toBe(401);
    } finally {
      child.kill();
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30000);
});

describe('축 ⑤ — `requests/auth.http` 를 httpYac 으로', () => {
  it('🔴 여섯 요청 — 로그인 200 · 나는 누구 jaehoon · 없는 이름 401 · 고친 쿠키 401 · 번호를 실은 헤더 401 · 로그아웃 200', async () => {
    const out = sendHttp(R('requests/auth.http'), PORT);
    expect(out.map((r) => r.title)).toEqual(
      ['로그인', '나는 누구', '없는 이름으로 로그인', '쿠키를 고쳐서 보내면', '헤더로 보내면', '로그아웃']);
    expect(out.map((r) => r.response.statusCode)).toEqual([200, 200, 401, 401, 401, 200]);
    expect(out[0].response.headers['set-cookie']).toEqual([expect.stringMatching(/^sessionId=[0-9a-f-]{36}; Max-Age=604800; /)]);
    const sent = out[1].response.request.headers.cookie;
    expect(sent).toMatch(/^sessionId=[0-9a-f-]{36}$/);
    expect(JSON.parse(out[1].response.body).username).toBe('jaehoon');
    expect(out[3].response.request.headers.cookie).toBe('sessionId=1');
    expect(out[4].response.request.headers.cookie).toBeUndefined();
    expect(out[4].response.request.headers.authorization).toBe('Bearer 3');
    expect(out[5].response.request.headers.cookie).toBe(sent);
    expect(out[5].response.headers['set-cookie']).toEqual(['sessionId=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT']);
    expect(JSON.parse(out[5].response.body)).toEqual({ message: '로그아웃했어요' });
  }, 60000);

  it('🔴 로그아웃 다음에 나는 누구를 다시 보내면 httpYac 은 쿠키를 안 싣고 401(지우라는 응답을 따랐다)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'p320-http2-'));
    try {
      writeFileSync(join(dir, 'auth.http'), `${read(R('requests/auth.http'))}\n### 나는 누구\nGET http://localhost:3000/api/auth/me\n`);
      const out = sendHttp(join(dir, 'auth.http'), PORT);
      expect(out.at(-1).response.request.headers.cookie).toBeUndefined();
      expect(out.at(-1).response.statusCode).toBe(401);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60000);
});

// ── Step 별 판 — Step 커밋(제목 `feat(p3-20): … (Step N)`)을 풀어 띄운다 ──
const git = (...args) => execFileSync('git', args, { cwd: P('.'), encoding: 'utf8' });
const stepCommit = (n) => {
  const line = git('log', '--format=%H %s', 'HEAD').split('\n')
    .find((l) => l.includes(' feat(p3-20): ') && l.endsWith(`(Step ${n})`));
  return line ? line.split(' ')[0] : null;
};
const extractAt = (commit, prefix) => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  const tar = execFileSync('git', ['archive', '--format=tar', commit], { cwd: P('.'), maxBuffer: 1 << 28 });
  execFileSync('tar', ['-x', '-C', dir], { input: tar });
  symlinkSync(P('node_modules'), join(dir, 'node_modules'));
  return dir;
};

describe('축 ⑥ — Step 별 판', () => {
  it('🔴 Step 2 판 — 쿠키만 지우는 로그아웃: 쿠키 없이 401 · 복사해 둔 세션 ID 를 다시 실으면 그대로 jaehoon · 로그아웃 주소는 아직 없다', async () => {
    const commit = stepCommit(2);
    expect(commit).not.toBeNull();
    const dir = extractAt(commit, 'p320-step2-');
    try {
      const s = await bootApp(dir, 3595);
      try {
        const res = await login(s.base, 'jaehoon');
        const cookie = sessionCookie(res);
        expect((await me(s.base, { Cookie: cookie })).body.username).toBe('jaehoon');
        expect((await me(s.base)).status).toBe(401);
        const again = await me(s.base, { Cookie: cookie });
        expect(again.status).toBe(200);
        expect(again.body.username).toBe('jaehoon');
        expect((await logout(s.base, { Cookie: cookie })).status).toBe(404);
      } finally {
        await s.stop();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('🔴 Step 1 판 — 로그인은 세션 ID 쿠키를 주고, 나는 누구는 아직 옛 판이라 그 쿠키로는 401', async () => {
    const commit = stepCommit(1);
    expect(commit).not.toBeNull();
    const dir = extractAt(commit, 'p320-step1-');
    try {
      const s = await bootApp(dir, 3594);
      try {
        const res = await login(s.base, 'jaehoon');
        expect(sessionIdOf(res)).toMatch(UUID);
        expect((await me(s.base, { Cookie: sessionCookie(res) })).status).toBe(401);
      } finally {
        await s.stop();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ── 토큰 스크립트 — 학생 폴더 `~/instagram-api/lab/p3-20/` (코드베이스도 같은 `lab/p3-20/`) ──
const runLab = (file) => execFileSync(process.execPath, [P(`lab/p3-20/${file}`)], { cwd: P('.'), encoding: 'utf8' });
const b64 = (part) => JSON.parse(Buffer.from(part, 'base64url').toString());
const LAB_SECRET = 'my-lab-secret';

describe('축 ⑦ — 토큰 스크립트 다섯', () => {
  it('🔴 base64.js — 헤더 글자가 JWT 맨 앞 조각과 같다 · base64 와 base64url 의 차이(= · / · _)', () => {
    expect(runLab('base64.js')).toBe([
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
      '{"alg":"HS256","typ":"JWT"}',
      'eyJzdWIiOiIyIn0=',
      'eyJzdWIiOiIyIn0',
      'PDw/Pj4=',
      'PDw_Pj4',
      '',
    ].join('\n'));
  });

  it('🔴 token.js — 점으로 나뉜 세 조각 · 헤더·페이로드는 누구나 되돌린다 · iat 는 지금 시각(초)', () => {
    const before = Math.floor(Date.now() / 1000);
    const [token, header, payload, signature, ...rest] = runLab('token.js').split('\n');
    expect(rest).toEqual(['']);
    expect(token.split('.')).toHaveLength(3);
    expect(token.split('.')[0]).toBe('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    expect(header).toBe('{"alg":"HS256","typ":"JWT"}');
    expect(payload).toMatch(/^\{"sub":"2","iat":\d{10}\}$/);
    expect(Math.abs(JSON.parse(payload).iat - before)).toBeLessThanOrEqual(2);
    expect(signature).toBe(token.split('.')[2]);
    expect(signature).toMatch(/^[A-Za-z0-9_-]{43}$/);
    // 서명은 실습용 비밀키로 HS256 을 계산한 값이다
    const [h, p] = token.split('.');
    expect(createHmac('sha256', LAB_SECRET).update(`${h}.${p}`).digest('base64url')).toBe(signature);
  });

  it('🔴 verify.js — 진짜 토큰은 페이로드 객체 · 가짜를 jwt.decode 로 열면 { sub: \'1\' } 그대로 · 같은 가짜와 다른 비밀키는 jwt.verify 에서 invalid signature', () => {
    const lines = runLab('verify.js').split('\n');
    expect(lines[0]).toMatch(/^\{ sub: '2', iat: \d{10} \}$/);
    expect(lines.slice(1)).toEqual(["{ sub: '1' }", 'invalid signature', 'invalid signature', '']);
  });

  it('🔴 old-token.js — 교안 Step 5 에 실린 토큰(만료 없음 · 다른 컴퓨터에서 며칠 전에 만든 것)이 지금도 통과한다', () => {
    expect(runLab('old-token.js')).toBe("{ sub: '2', iat: 1793170051 }\n");
    // iat 는 2026-10-28 (한국 시각 오후 3시 47분) — 교안이 «2026년 10월 28일» 이라고 쓴다
    expect(new Date(1793170051 * 1000).toISOString()).toBe('2026-10-28T06:47:31.000Z');
  });

  it('🔴 expire.js — 처음엔 exp 가 iat + 1 인 페이로드 · 2초 뒤엔 TokenExpiredError jwt expired', () => {
    const lines = runLab('expire.js').split('\n');
    const m = lines[0].match(/^\{ sub: '2', iat: (\d{10}), exp: (\d{10}) \}$/);
    expect(m).not.toBeNull();
    expect(Number(m[2]) - Number(m[1])).toBe(1);
    expect(lines.slice(1)).toEqual(['TokenExpiredError jwt expired', '']);
  }, 10000);
});

const bootLab = (file, port) => boot(`lab/p3-20/${file}`, { port, ready: `${port}번 포트에서` });
const labVariant = async (file, port, from, to, fn) => {
  const dir = mkdtempSync(join(tmpdir(), 'p320-lab-'));
  try {
    let src = read(P(`lab/p3-20/${file}`));
    for (const [a, b] of Array.isArray(from) ? from : [[from, to]]) {
      if (!src.includes(a)) throw new Error(`${file} 에서 바꿀 곳을 못 찾았다`);
      src = src.replace(a, b);
    }
    writeFileSync(join(dir, file), src);
    symlinkSync(P('node_modules'), join(dir, 'node_modules'));
    writeFileSync(join(dir, 'package.json'), '{"type":"module"}');
    const lab = await boot(join(dir, file), { port, ready: `${port}번 포트에서` });
    try {
      await fn(lab);
    } finally {
      await lab.stop();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

describe('직접 해보기 1 — 30초 뒤 끝나는 세션', () => {
  it('🔴 로그인하면 남은 초 · 30초 안엔 그대로 · 없는 이름·쿠키 없음은 401', async () => {
    const lab2 = await bootLab('practice1.js', 4001);
    try {
      expect(lab2.log.trim()).toBe('실습 서버가 4001번 포트에서 기다리고 있어요.');
      const res = await fetch(`${lab2.base}/login`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ username: 'jaehoon' }) });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ userId: 2 });
      const cookie = sessionCookie(res);
      expect(cookie).toMatch(/^labSession=[0-9a-f-]{36}$/);
      const meRes = await fetch(`${lab2.base}/me`, { headers: { Cookie: cookie } });
      expect(await meRes.json()).toEqual({ userId: 2, leftSeconds: 30 });
      const none = await fetch(`${lab2.base}/me`);
      expect(none.status).toBe(401);
      expect(await none.json()).toEqual({ message: '로그인이 필요해요' });
      const hana = await fetch(`${lab2.base}/login`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ username: 'hana' }) });
      expect(hana.status).toBe(401);
    } finally {
      await lab2.stop();
    }
  });

  it('🔴 시간이 지나면 「로그인이 끝났어요」 401 · 그 세션은 지워져 다음엔 「로그인이 필요해요」', async () => {
    await labVariant('practice1.js', 4001, 'const SESSION_TIME = 30 * 1000;', 'const SESSION_TIME = 1 * 1000;', async (lab) => {
      const res = await fetch(`${lab.base}/login`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ username: 'minji' }) });
      const cookie = sessionCookie(res);
      await new Promise((r) => setTimeout(r, 1300));
      const first = await fetch(`${lab.base}/me`, { headers: { Cookie: cookie } });
      expect(first.status).toBe(401);
      expect(await first.json()).toEqual({ message: '로그인이 끝났어요. 다시 로그인해 주세요' });
      const second = await fetch(`${lab.base}/me`, { headers: { Cookie: cookie } });
      expect(await second.json()).toEqual({ message: '로그인이 필요해요' });
    });
  });

  // 2026-10-30 소급 뒤 학생 낭독 FAIL — 요구사항 6 «(29나 28이 나오기도 해요)» 는 floor 판을 못 가린다.
  // 확인 시점을 1초 안으로 좁히면 VS Code 로 누르는 학생 다수가 29 를 받아 맞는 판도 틀려 보여서, 교안은
  // 요구사항 5 에 «왜 ceil 인가» 를, 해설에 floor 판의 차이를 적었다 — 그 두 주장을 여기서 잰다.
  it('🔴 남은 초를 Math.floor 로 내린 판 — 로그인 직후 29(맞는 판 30) · 끝나기 직전엔 세션이 살아 있는데 0(맞는 판 1)', async () => {
    const loginMinji = async (lab) => sessionCookie(await fetch(`${lab.base}/login`,
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ username: 'minji' }) }));
    const meOf = async (lab, cookie) => {
      const res = await fetch(`${lab.base}/me`, { headers: { Cookie: cookie } });
      return { status: res.status, body: await res.json() };
    };
    await labVariant('practice1.js', 4001, 'Math.ceil(', 'Math.floor(', async (lab) => {
      const cookie = await loginMinji(lab);
      await new Promise((r) => setTimeout(r, 20));
      expect(await meOf(lab, cookie)).toEqual({ status: 200, body: { userId: 3, leftSeconds: 29 } });
    });
    const ONE = ['const SESSION_TIME = 30 * 1000;', 'const SESSION_TIME = 1 * 1000;'];
    await labVariant('practice1.js', 4001, [ONE], null, async (lab) => {
      const cookie = await loginMinji(lab);
      await new Promise((r) => setTimeout(r, 600));
      expect(await meOf(lab, cookie)).toEqual({ status: 200, body: { userId: 3, leftSeconds: 1 } });
    });
    await labVariant('practice1.js', 4001, [ONE, ['Math.ceil(', 'Math.floor(']], null, async (lab) => {
      const cookie = await loginMinji(lab);
      await new Promise((r) => setTimeout(r, 600));
      expect(await meOf(lab, cookie)).toEqual({ status: 200, body: { userId: 3, leftSeconds: 0 } });
    });
    const text = read(LECTURE);
    expect(text).toContain('남은 초는 `Math.ceil`로 올림해서 0.5초가 남았을 때도 0이 아니라 1이 되게 해요.');
    expect(text).toContain('남은 초를 `Math.floor`로 내림하면 로그인 직후에도 29가 나오고, 끝나기 직전에는 세션이 살아 있는데도 0이 나와요.');
  }, 30000);

  it('🔴 시작 판은 만료가 없는 세션 서버다 — 30초가 지나도 그대로', async () => {
    const start = read(P('snapshots/p3-20.practice1-start.js'));
    expect(start).not.toContain('expiresAt');
    expect(start).toContain('const sessions = new Map();');
  });
});

describe('직접 해보기 2 — 받은 토큰 읽어 보기', () => {
  it('🔴 헤더 · 페이로드(이메일·역할까지) · 만료 시각을 찍는다', () => {
    expect(runLab('practice2.js')).toBe([
      '{"alg":"HS256","typ":"JWT"}',
      '{"sub":"7","username":"hana","email":"hana@example.com","role":"user","iat":1793145600,"exp":1793146500}',
      '2026-10-28T00:15:00.000Z',
      '',
    ].join('\n'));
  });
});

describe('직접 해보기 3 — 토큰으로 알아보는 서버', () => {
  const tokenLogin = (base, username) =>
    fetch(`${base}/login`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ username }) });

  it('🔴 로그인하면 accessToken · 헤더로 실으면 그 사람 · 없거나 고친 토큰은 401', async () => {
    const lab = await bootLab('practice3.js', 4003);
    try {
      expect(lab.log.trim()).toBe('실습 서버가 4003번 포트에서 기다리고 있어요.');
      const res = await tokenLogin(lab.base, 'jaehoon');
      const { accessToken } = await res.json();
      expect(b64(accessToken.split('.')[1])).toMatchObject({ sub: '2' });
      expect(res.headers.getSetCookie()).toEqual([]);
      const ok = await fetch(`${lab.base}/me`, { headers: { Authorization: `Bearer ${accessToken}` } });
      expect(await ok.json()).toEqual({ userId: 2 });
      expect((await fetch(`${lab.base}/me`)).status).toBe(401);
      const [h, , s] = accessToken.split('.');
      const fake = `${h}.${Buffer.from('{"sub":"1"}').toString('base64url')}.${s}`;
      const bad = await fetch(`${lab.base}/me`, { headers: { Authorization: `Bearer ${fake}` } });
      expect(bad.status).toBe(401);
      expect(await bad.json()).toEqual({ message: '로그인이 필요해요' });
      expect((await tokenLogin(lab.base, 'hana')).status).toBe(401);
    } finally {
      await lab.stop();
    }
  });

  it('🔴 껐다 켜도 같은 토큰으로 그대로 — 서버는 아무것도 기억하지 않았다', async () => {
    let lab = await bootLab('practice3.js', 4003);
    const { accessToken } = await (await tokenLogin(lab.base, 'minji')).json();
    await lab.stop();
    lab = await bootLab('practice3.js', 4003);
    try {
      const res = await fetch(`${lab.base}/me`, { headers: { Authorization: `Bearer ${accessToken}` } });
      expect(await res.json()).toEqual({ userId: 3 });
    } finally {
      await lab.stop();
    }
  });

  it('🔴 비밀키를 바꿔 띄우면 그 전에 받은 토큰은 모두 401', async () => {
    let lab = await bootLab('practice3.js', 4003);
    const { accessToken } = await (await tokenLogin(lab.base, 'dahye')).json();
    await lab.stop();
    await labVariant('practice3.js', 4003, "const SECRET = 'my-lab-secret';", "const SECRET = 'my-new-secret';", async (v) => {
      const res = await fetch(`${v.base}/me`, { headers: { Authorization: `Bearer ${accessToken}` } });
      expect(res.status).toBe(401);
    });
  });
});

describe('과제 [기초] — 모든 기기에서 로그아웃', () => {
  it('🔴 두 «기기» 로그인 · 한쪽에서 모두 로그아웃 · 둘 다 401 · 다른 사람은 그대로 · 로그인 안 한 채면 401', async () => {
    const lab = await bootLab('homework1.js', 4011);
    try {
      expect(lab.log.trim()).toBe('과제 서버가 4011번 포트에서 기다리고 있어요.');
      const post = (path, body, headers = {}) =>
        fetch(`${lab.base}${path}`, { method: 'POST', headers: { ...JSON_HEADERS, ...headers }, body: JSON.stringify(body ?? {}) });
      const phone = sessionCookie(await post('/login', { username: 'jaehoon' }));
      const laptop = sessionCookie(await post('/login', { username: 'jaehoon' }));
      const other = sessionCookie(await post('/login', { username: 'minji' }));
      expect(await (await fetch(`${lab.base}/me`, { headers: { Cookie: phone } })).json()).toEqual({ userId: 2 });
      const all = await post('/logout-all', {}, { Cookie: laptop });
      expect(all.status).toBe(200);
      expect(await all.json()).toEqual({ message: '세션 2개를 지웠어요' });
      expect((await fetch(`${lab.base}/me`, { headers: { Cookie: phone } })).status).toBe(401);
      expect((await fetch(`${lab.base}/me`, { headers: { Cookie: laptop } })).status).toBe(401);
      expect(await (await fetch(`${lab.base}/me`, { headers: { Cookie: other } })).json()).toEqual({ userId: 3 });
      const anon = await post('/logout-all');
      expect(anon.status).toBe(401);
    } finally {
      await lab.stop();
    }
  });
});

describe('실습·과제 `.http` 를 httpYac 으로', () => {
  const sendLab = (name, port) => {
    const dir = mkdtempSync(join(tmpdir(), 'p320-labhttp-'));
    try {
      writeFileSync(join(dir, name), read(P(`lab/p3-20/${name}`)));
      return JSON.parse(execFileSync(P('node_modules/.bin/httpyac'), ['send', name, '--all', '--json'],
        { encoding: 'utf-8', cwd: dir })).requests;
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

  it('🔴 practice1.http — 로그인하면 labSession 쿠키를 기억해 나는 누구에 싣는다 · 남은 30초', async () => {
    const lab = await bootLab('practice1.js', 4001);
    try {
      const out = sendLab('practice1.http', 4001);
      expect(out.map((r) => r.title)).toEqual(['실습 로그인', '실습 나는 누구']);
      expect(out[1].response.request.headers.cookie).toMatch(/^labSession=[0-9a-f-]{36}$/);
      expect(JSON.parse(out[1].response.body)).toEqual({ userId: 2, leftSeconds: 30 });
    } finally {
      await lab.stop();
    }
  }, 60000);

  it('🔴 practice3.http — `# @name` 으로 받은 accessToken 을 헤더에 싣는다 · 쿠키는 없다', async () => {
    const lab = await bootLab('practice3.js', 4003);
    try {
      const out = sendLab('practice3.http', 4003);
      expect(out.map((r) => r.title)).toEqual(['토큰 받기', '토큰으로 나는 누구']);
      expect(out[0].response.headers['set-cookie']).toBeUndefined();
      expect(out[1].response.request.headers.authorization).toMatch(/^Bearer eyJ[\w-]+\.[\w-]+\.[\w-]+$/);
      expect(JSON.parse(out[1].response.body)).toEqual({ userId: 2 });
    } finally {
      await lab.stop();
    }
  }, 60000);

  it('🔴 homework1.http — 로그인 · 나는 누구 · 모든 기기에서 로그아웃(세션 1개)', async () => {
    const lab = await bootLab('homework1.js', 4011);
    try {
      const out = sendLab('homework1.http', 4011);
      expect(out.map((r) => r.title)).toEqual(['과제 로그인', '과제 나는 누구', '모든 기기에서 로그아웃']);
      expect(out.map((r) => r.response.statusCode)).toEqual([200, 200, 200]);
      expect(JSON.parse(out[1].response.body)).toEqual({ userId: 2 });
      expect(JSON.parse(out[2].response.body)).toEqual({ message: '세션 1개를 지웠어요' });
    } finally {
      await lab.stop();
    }
  }, 60000);
});

describe('과제 [기초] — 확인 절차가 가려내는 틀린 판', () => {
  const CLEARED = 'labSession=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT';
  const post = (base, path, body, headers = {}) =>
    fetch(`${base}${path}`, { method: 'POST', headers: { ...JSON_HEADERS, ...headers }, body: JSON.stringify(body ?? {}) });
  const run = async (lab) => {
    const local = sessionCookie(await post(lab.base, '/login', { username: 'jaehoon' }));
    const other = sessionCookie(await post(lab.base, '/login', { username: 'minji' }));
    const http = sessionCookie(await post(lab.base, '/login', { username: 'jaehoon' }));
    const res = await post(lab.base, '/logout-all', {}, { Cookie: http });
    const setCookie = res.headers.getSetCookie();
    const message = (await res.json()).message;
    const me = async (cookie) => (await fetch(`${lab.base}/me`, { headers: { Cookie: cookie } })).status;
    return { message, setCookie, local: await me(local), other: await me(other) };
  };

  it('🔴 맞는 판 — 「세션 2개」 · jaehoon 의 다른 기기 401 · minji 그대로', async () => {
    const lab = await bootLab('homework1.js', 4011);
    try {
      expect(await run(lab)).toEqual({ message: '세션 2개를 지웠어요', setCookie: [CLEARED], local: 401, other: 200 });
    } finally {
      await lab.stop();
    }
  });

  it('🔴 반복문 변수를 userId 로 지은 판 — 「세션 3개」 · minji 까지 401(요구사항 5 의 minji 가 가려낸다)', async () => {
    await labVariant('homework1.js', 4011,
      'for (const [sessionId, owner] of sessions) {\n    if (owner === userId) {',
      'for (const [sessionId, userId] of sessions) {\n    if (userId === userId) {', async (lab) => {
        expect(await run(lab)).toEqual({ message: '세션 3개를 지웠어요', setCookie: [CLEARED], local: 401, other: 401 });
      });
  });

  it('🔴 지금 기기의 세션만 지우는 판 — 「세션 1개」 · 다른 기기 그대로', async () => {
    await labVariant('homework1.js', 4011,
      `  let count = 0;
  for (const [sessionId, owner] of sessions) {
    if (owner === userId) {
      sessions.delete(sessionId);
      count += 1;
    }
  }`,
      `  sessions.delete(req.cookies.labSession);
  const count = 1;`, async (lab) => {
        expect(await run(lab)).toEqual({ message: '세션 1개를 지웠어요', setCookie: [CLEARED], local: 200, other: 200 });
      });
  });

  // 2026-10-30 소급 뒤 학생 낭독 FAIL — 이 판은 세션 개수와 두 탭이 맞는 판과 같아서, 요구사항 8 에
  // «응답 헤더의 `set-cookie` 줄» 을 더했다. 답안은 그 줄의 값을 적는다.
  it('🔴 `res.clearCookie` 를 빠뜨린 판 — 세션 수·두 탭은 맞는 판과 같고 `set-cookie` 줄만 없다(요구사항 8 의 `set-cookie` 줄이 가려낸다)', async () => {
    await labVariant('homework1.js', 4011, "  res.clearCookie('labSession');\n", '', async (lab) => {
      expect(await run(lab)).toEqual({ message: '세션 2개를 지웠어요', setCookie: [], local: 401, other: 200 });
    });
    expect(read(LECTURE)).toContain('응답에 적힌 세션 개수와 응답 헤더의 `set-cookie` 줄, 크롬의 두 탭을 다시 새로고침한 결과를 적어요.');
    expect(read(ANSWERS).split(`set-cookie: ${CLEARED}`).length - 1).toBe(2);
  });
});

describe('과제 [응용] — 라이브러리 없이 서명 확인', () => {
  it('🔴 진짜 true · 페이로드를 고친 가짜 false · 다른 비밀키로 만든 토큰 false · jwt.verify 와 같은 판정', () => {
    expect(runLab('homework2.js')).toBe(['true', 'false', 'false', 'verify 통과', 'verify invalid signature', 'verify invalid signature', ''].join('\n'));
  });
});

// ── 교안·답안의 코드 블록이 코드베이스에 «실재» 한다 ──
// 교안 Step N 의 `// ~/instagram-api/<경로>` 블록은 «그 Step 커밋» 의 그 파일 안에 줄 그대로 있어야 한다.
// `lab/` 블록은 `lab/p3-20/` 의 끝 판이나 시작 판 스냅숏과 대조한다.
const LECTURE = P('../../part3/3-auth-principles/p3-20-session-token-lecture.md');
const ANSWERS = P('../../part3/3-auth-principles/p3-20-session-token-answers.md');
const fileAt = (commit, path) => (commit ? git('show', `${commit}:${path}`) : read(R(path)));
const blocksOf = (file) => {
  const out = [];
  let step = 0;
  let zone = 'body';
  let cur = null;
  for (const line of read(file).split('\n')) {
    if (cur) {
      if (line.startsWith('```')) { out.push(cur); cur = null; } else cur.lines.push(line);
      continue;
    }
    const m = line.match(/^## Step (\d+)/);
    if (m) { step = Number(m[1]); zone = 'body'; }
    if (/^### 직접 해보기/.test(line)) zone = 'lab';
    if (/^## (과제|생각해볼|마무리)/.test(line)) zone = 'rest';
    const f = line.match(/^```(\w*)$/);
    if (f) cur = { lang: f[1], step, zone, lines: [] };
  }
  return out;
};
const contains = (hay, block) => hay.includes(block.join('\n'));
const START = { 'practice1.js': 'snapshots/p3-20.practice1-start.js' };

describe('교안·답안 블록이 코드베이스에 실재한다', () => {
  it('🔴 교안의 `~/instagram-api/` 자바스크립트 블록 — Step 커밋 · 끝 판 · 실습 파일 · 시작 판 스냅숏', () => {
    const blocks = blocksOf(LECTURE).filter((b) => b.lang === 'javascript' && /^\/\/ ~\/instagram-api\//.test(b.lines[0] ?? ''));
    expect(blocks.length).toBeGreaterThanOrEqual(12);
    const misses = [];
    for (const b of blocks) {
      const rel = b.lines[0].replace('// ~/instagram-api/', '');
      const body = b.lines.slice(1);
      if (rel.startsWith('lab/p3-20/')) {
        const name = rel.replace('lab/p3-20/', '');
        const labFile = read(P(`lab/p3-20/${name}`));
        const start = START[name] ? read(P(START[name])) : '';
        const strip = (t) => t.split('\n').slice(1).join('\n');
        if (!(contains(strip(labFile), body) || contains(strip(start), body))) misses.push(`Step ${b.step} ${rel}`);
        continue;
      }
      const text = fileAt(stepCommit(b.step), rel);
      if (!contains(text, body)) misses.push(`Step ${b.step} ${rel}`);
    }
    expect(misses).toEqual([]);
  });

  it('🔴 교안의 `.http` 블록 — 본문은 그 Step 커밋(없으면 끝 판)의 auth.http · 직접 해보기는 lab/p3-20 의 .http', () => {
    const blocks = blocksOf(LECTURE).filter((b) => b.lang === '' && b.lines[0]?.startsWith('### '));
    expect(blocks.filter((b) => b.zone === 'body').length).toBeGreaterThanOrEqual(2);
    expect(blocks.filter((b) => b.zone === 'lab').length).toBe(2);
    const labHttp = ['practice1.http', 'practice3.http'].map((n) => read(P(`lab/p3-20/${n}`))).join('\n');
    const misses = [];
    for (const b of blocks) {
      const text = b.zone === 'lab' ? labHttp : fileAt(stepCommit(b.step), 'requests/auth.http');
      if (!contains(text, b.lines)) misses.push(`Step ${b.step} ${b.lines[0]}`);
    }
    expect(misses).toEqual([]);
  });

  it('🔴 교안에 찍힌 토큰과 그림의 서명은 실습 비밀키로 계산한 값이다(Step 5) · 실습 2 토큰은 그 출력과 짝', () => {
    const text = read(LECTURE);
    const shown = text.match(/^(eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.eyJzdWIiOiIy[\w-]+\.[\w-]{43})$/m)[1];
    const [h, p, sig] = shown.split('.');
    expect(createHmac('sha256', LAB_SECRET).update(`${h}.${p}`).digest('base64url')).toBe(sig);
    expect(text).toContain(`{"sub":"2","iat":${b64(p).iat}}`);
    expect(text).toContain(` 서명       ${sig}  `);
    expect(text).toContain(` 페이로드   ${p}  `);
    expect(read(P('lab/p3-20/old-token.js'))).toContain(`const oldToken = '${shown}';`);
    const labToken = read(P('lab/p3-20/practice2.js')).match(/const token = '([^']+)'/)[1];
    expect(text.split(labToken).length - 1).toBe(2);
    expect(b64(labToken.split('.')[1]).role).toBe('user');
  });

  it('🔴 답안의 해설 블록 — 과제 두 파일', () => {
    const blocks = blocksOf(ANSWERS);
    const js = blocks.filter((b) => b.lang === 'javascript' && /^\/\/ ~\/instagram-api\/lab\//.test(b.lines[0] ?? ''));
    expect(js.map((b) => b.lines[0])).toEqual(['// ~/instagram-api/lab/p3-20/homework1.js', '// ~/instagram-api/lab/p3-20/homework2.js']);
    for (const b of js) {
      const name = b.lines[0].replace('// ~/instagram-api/lab/p3-20/', '');
      expect(b.lines.join('\n') + '\n').toBe(read(P(`lab/p3-20/${name}`)));
    }
  });
});
