// p3-23 「로그인과 쿠키」 게이트 — 백엔드
//
// `4-react-auth` 둘째 회차다. 화면(`instagram-next`)이 로그인 버튼을 살리고, 세션 쿠키가 어느 요청에 실리는지를
// 화면 쪽에서 본다. 수업 백엔드는 «고치지 않는다» — Step 4·5 에서 화면이 백엔드를 직접 부르는 판을 겪으며
// `.env` 의 허락 목록과 `app.js` 의 `credentials: true` 를 잠깐 바꿨다가 Step 6 에서 되돌린다
// (`curriculum.md` 「`p3-23` 착수 결정」 ①). 브라우저 쪽 관찰(쿠키 저장 · 화면 문장)은 `instagram-next/.verify` 가 잰다.
// 판정은 학생이 치는 `node app.js` 를 그대로 띄워 진짜 포트로 왕복한다(`boot.js`).
//
// 축 ① 로그인은 이름만 본다 — 비밀번호는 아무 값이나(빈 글자도) 200 · Set-Cookie 는 p3-20 판 그대로 · 없는 이름 401.
// 축 ② Step 4 — 허락 목록이 5173 뿐이면 3001 의 preflight 에 허락 헤더가 없다 · 3001 을 더하면 출처는 허락하지만
//      Access-Control-Allow-Credentials 가 없다(브라우저는 응답의 Set-Cookie 를 버리고, include 요청은 막는다).
// 축 ③ Step 5 의 중간 판 — `snapshots/p3-23.step5-credentials.app.js` 는 `credentials: true` 한 줄만 다르고
//      preflight·응답에 Access-Control-Allow-Credentials: true.
// 축 ④ Step 6 — 이 회차의 학생 파일 `app.js` 는 `code/p3-22` 와 같다(되돌린 판).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, mkdtempSync, rmSync, cpSync, symlinkSync } from 'node:fs';
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
const GATE_DB = 'p323_gate';
const GATE_URL = `postgresql://postgres:postgres@localhost:5432/${GATE_DB}`;
const STUDENT_ORIGIN = 'http://localhost:5173';
const SCREEN = 'http://localhost:3001';
const PORT = 3632;
const WIDE_PORT = 3633;
const SNAP_PORT = 3634;
const SIGNUP_MIGRATION = '20261029031804_add_user_signup_fields';

const read = (p) => readFileSync(p, 'utf8');

// 학생 파일은 이 회차 북마크 `code/p3-23` 을 풀어서 읽는다(없으면 작업트리 — 이 회차를 짓는 동안).
const ROUND = roundDir('code/p3-23');
const R = (rel) => join(ROUND.dir, rel);

let db = null;
let server = null;

const envWith = (origins) => ({ DATABASE_URL: GATE_URL, CORS_ORIGIN: origins });

const seed = () =>
  execFileSync(process.execPath, [P('seed.js')],
    { cwd: P('.'), encoding: 'utf8', env: { ...process.env, ...envWith(STUDENT_ORIGIN) } });

const dropGate = async () => {
  const admin = new pg.Client(ADMIN);
  await admin.connect();
  await admin.query(
    `select pg_terminate_backend(pid) from pg_stat_activity where datname = '${GATE_DB}' and pid <> pg_backend_pid()`);
  await admin.query(`DROP DATABASE IF EXISTS ${GATE_DB}`);
  return admin;
};

const bootApp = (dir, port, origins = STUDENT_ORIGIN) => boot(join(dir, 'app.js'), {
  port, env: { ...envWith(origins), PORT: String(port) }, ready: `${port}번 포트에서`,
});

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const login = async (base, body, headers = {}) => {
  const res = await fetch(`${base}/api/auth/login`,
    { method: 'POST', headers: { ...JSON_HEADERS, ...headers }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json(), headers: res.headers };
};
// 브라우저가 JSON 본문을 다른 출처로 보내기 전에 묻는 preflight 와 같은 요청
const preflight = (base) => fetch(`${base}/api/auth/login`, {
  method: 'OPTIONS',
  headers: {
    Origin: SCREEN,
    'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'content-type',
  },
});

// 학생 폴더를 임시 폴더에 옮겨 둔다(파일 하나를 바꾼 판을 띄울 때).
const STUDENT = ['app.js', 'db.js', 'errors.js', 'routes', 'services', 'middlewares', 'schemas', 'package.json'];
const copyStudent = (from, prefix) => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  for (const name of STUDENT) cpSync(join(from, name), join(dir, name), { recursive: true });
  symlinkSync(P('node_modules'), join(dir, 'node_modules'));
  return dir;
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
  seed();

  server = await bootApp(ROUND.dir, PORT);

  // 지난 시간 Step 8 에서 가입한 사람 — 오늘 로그인할 yuna
  const res = await fetch(`${server.base}/api/auth/signup`, {
    method: 'POST', headers: JSON_HEADERS,
    body: JSON.stringify({ emailOrPhone: 'yuna@example.com', name: '김유나', username: 'yuna', password: 'yuna1234' }),
  });
  if (res.status !== 201) throw new Error(`yuna 가입 실패 ${res.status}`);
}, 120000);

afterAll(async () => {
  if (server) await server.stop();
  if (db) await db.end();
  const admin = await dropGate();
  await admin.end();
  ROUND.cleanup();
}, 60000);

describe('축 ① — 로그인은 아직 이름만 본다', () => {
  it('🔴 yuna + 아무 비밀번호 → 200 · 응답은 사람 정보 · Set-Cookie 는 sessionId(HttpOnly · SameSite=Lax · 7일)', async () => {
    const res = await login(server.base, { username: 'yuna', password: '1' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 6, username: 'yuna', profileImage: null });
    const cookie = res.headers.get('set-cookie');
    expect(cookie).toMatch(/^sessionId=[0-9a-f-]{36}; Max-Age=604800; Path=\/; Expires=.+; HttpOnly; SameSite=Lax$/);
  });

  it('🔴 비밀번호가 빈 글자여도 200 — loginSchema 는 username 만 받고 모르는 키를 버린다', async () => {
    expect((await login(server.base, { username: 'yuna', password: '' })).status).toBe(200);
    expect((await login(server.base, { username: 'yuna' })).status).toBe(200);
  });

  it('🔴 받은 쿠키를 실으면 /me 가 yuna · 안 실으면 401 「로그인이 필요해요」', async () => {
    const res = await login(server.base, { username: 'yuna', password: 'yuna1234' });
    const sessionId = res.headers.get('set-cookie').split(';')[0];
    const me = await fetch(`${server.base}/api/auth/me`, { headers: { Cookie: sessionId } });
    expect(me.status).toBe(200);
    expect(await me.json()).toEqual({ id: 6, username: 'yuna', profileImage: null });
    const anonymous = await fetch(`${server.base}/api/auth/me`);
    expect(anonymous.status).toBe(401);
    expect(await anonymous.json()).toEqual({ message: '로그인이 필요해요' });
  });

  it('🔴 없는 이름은 401 「그런 사용자는 없어요」 · 쿠키 없음', async () => {
    const res = await login(server.base, { username: 'yunaa', password: '아무거나' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: '그런 사용자는 없어요' });
    expect(res.headers.get('set-cookie')).toBeNull();
  });
});

describe('축 ② — Step 4: 화면(3001)이 백엔드를 직접 부르면', () => {
  it('🔴 허락 목록이 5173 뿐이면 preflight 에 Access-Control-Allow-Origin 이 없다', async () => {
    const res = await preflight(server.base);
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('🔴 3001 을 더하면 출처는 허락하지만 Access-Control-Allow-Credentials 는 없다 · 로그인 응답에 Set-Cookie 는 실려 온다', async () => {
    const wide = await bootApp(ROUND.dir, WIDE_PORT, `${STUDENT_ORIGIN},${SCREEN}`);
    try {
      const pre = await preflight(wide.base);
      expect(pre.headers.get('access-control-allow-origin')).toBe(SCREEN);
      expect(pre.headers.get('access-control-allow-credentials')).toBeNull();
      const res = await login(wide.base, { username: 'yuna', password: '1' }, { Origin: SCREEN });
      expect(res.status).toBe(200);
      expect(res.headers.get('access-control-allow-origin')).toBe(SCREEN);
      expect(res.headers.get('access-control-allow-credentials')).toBeNull();
      expect(res.headers.get('set-cookie')).toMatch(/^sessionId=/);
    } finally {
      await wide.stop();
    }
  });
});

describe('축 ③ — Step 5 중간 판: 서버가 credentials 를 허락하면', () => {
  it('🔴 스냅숏은 `code/p3-22` 의 app.js 에서 cors 한 줄만 다르다', () => {
    const before = read(R('app.js')).split('\n');
    const snap = read(P('snapshots/p3-23.step5-credentials.app.js')).split('\n');
    expect(snap).toHaveLength(before.length);
    const diff = snap.map((line, i) => [before[i], line]).filter(([a, b]) => a !== b);
    expect(diff).toEqual([[
      'app.use(cors({ origin: allowedOrigins }));',
      'app.use(cors({ origin: allowedOrigins, credentials: true }));',
    ]]);
  });

  it('🔴 그 판을 띄우면 preflight·로그인 응답에 Access-Control-Allow-Credentials: true', async () => {
    const dir = copyStudent(ROUND.dir, 'p323-step5-');
    cpSync(P('snapshots/p3-23.step5-credentials.app.js'), join(dir, 'app.js'));
    const app = await bootApp(dir, SNAP_PORT, `${STUDENT_ORIGIN},${SCREEN}`);
    try {
      const pre = await preflight(app.base);
      expect(pre.headers.get('access-control-allow-origin')).toBe(SCREEN);
      expect(pre.headers.get('access-control-allow-credentials')).toBe('true');
      const res = await login(app.base, { username: 'yuna', password: '1' }, { Origin: SCREEN });
      expect(res.headers.get('access-control-allow-credentials')).toBe('true');
      expect(res.headers.get('set-cookie')).toMatch(/^sessionId=/);
    } finally {
      await app.stop();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('축 ④ — Step 6: 되돌린 판', () => {
  it('🔴 이 회차의 app.js 는 code/p3-22 와 같다(credentials 줄이 없다)', () => {
    const p322 = execFileSync('git', ['show', 'code/p3-22:app.js'], { cwd: P('.'), encoding: 'utf8' });
    expect(read(R('app.js'))).toBe(p322);
    expect(read(R('app.js'))).not.toContain('credentials');
  });
});
