// p3-45 「Passport와 구글 로그인」 게이트 — 백엔드
// 내부 검증 전용 — 교안에 한 줄도 인용하지 않는다.
//
// `7-express-auth` 열째 회차다(`curriculum.md` 「`p3-45` 착수 결정」 ①~⑨).
// Step 1~7 본문은 수업 백엔드. Step 마다의 판은 커밋 제목의 «(Step N)» 표식으로 꺼낸다(같은 표식이 여럿이면 가장 뒤 커밋).
// 🔑 진짜 구글에는 요청을 보내지 않는다 — 학생 파일 사본의 구글 주소 셋만 가짜 구글(`helpers/fake-google.js`)로 바꿔 띄운다
//    (`replaceAll` · 바꿀 글자가 없으면 던진다 · 바꾼 뒤 구글 주소가 남아 있으면 던진다).
//    시작 요청의 302 는 따라가지 않으므로(`redirect: 'manual'`) 바꾸지 않은 판도 띄워 `Location` 글자를 그대로 잰다.
// 🔑 판정에는 화면이 없으니 백엔드 주소를 화면 주소(`SITE_URL`)로 삼는다 — 콜백이 곧바로 백엔드로 돌아온다.
// 🔑 짓는 동안 `P345_WT=N` 을 주면 Step N 의 판을 커밋 대신 작업트리에서 읽는다(Red 를 실제 동작으로 보려고).
//
// 축 ① Step 1 — `.env.example` 에 이름 셋
// 축 ② Step 2 — 세 값 없이는 안 뜬다 · 시작 302 에 state 가 없다 · `npm install` 의 판
// 축 ③ Step 3 — `state: true` 스냅숏은 500 · 저장소 판은 state·challenge·쿠키 둘
// 축 ④ Step 4 — 콜백 200 프로필 · 고친 state · `/token`·`/userinfo` 가 받은 것
// 축 ⑤ Step 5 — 마이그레이션 SQL · 시드가 `social_accounts` 를 비운다
// 축 ⑥ Step 6 — 찾거나 만들기
// 축 ⑦ Step 7 — 로그인 기록과 토큰 둘 · 302 · `?next=` · 실패는 로그인 화면으로
// 축 ⑧ 리팩터링 — 비밀번호 로그인 응답이 `code/p3-44` 와 같다
// 축 ⑨ 틀린 판 넷이 판정에 걸린다
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { readFileSync, mkdtempSync, mkdirSync, rmSync, cpSync, symlinkSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import pg from 'pg';
import bcrypt from 'bcrypt';
import { boot } from './helpers/boot.js';
import { roundDir } from './helpers/round.js';
import { startFakeGoogle } from './helpers/fake-google.js';

const ROOT = new URL('../', import.meta.url);
const P = (rel) => new URL(rel, ROOT).pathname;
const read = (path) => readFileSync(path, 'utf8');
const ADMIN = { host: 'localhost', port: 5432, database: 'postgres', user: 'postgres', password: 'postgres' };
const TPL_DB = 'p345_tpl';
const GATE_DB = 'p345_gate';
const GATE_URL = `postgresql://postgres:postgres@localhost:5432/${GATE_DB}`;
const PORT = 3960;
const GOOGLE_PORT = 3961;
const OLD_PORT = 3962;
const SITE = `http://localhost:${PORT}`;

// 이 회차 북마크 `code/p3-45` 를 풀어서 읽는다(없으면 작업트리 — 이 회차를 짓는 동안).
const ROUND = roundDir('code/p3-45');
const R = (rel) => join(ROUND.dir, rel);

const SECRET = 'q2Xh0v9bGm4RkT7sYp1wLc8nZf3uJd6eHa5iVo0rQyE';
const GOOGLE_ENV = { GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret', SITE_URL: SITE };
const env = { DATABASE_URL: GATE_URL, CORS_ORIGIN: 'http://localhost:3001', JWT_SECRET: SECRET, ...GOOGLE_ENV };
const STUDENT_FILES = ['app.js', 'db.js', 'errors.js', 'responses.js', 'routes', 'controllers', 'services', 'middlewares', 'schemas', 'strategies', 'docs', 'package.json', 'requests', 'seed.js', 'data', 'prisma', 'prisma.config.js', '.env.example'];

// 학생 파일 속 진짜 구글 주소 셋 — 판정은 이 글자만 가짜 구글 주소로 바꾼다.
const REAL_GOOGLE = {
  authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
  token: 'https://oauth2.googleapis.com/token',
  userinfo: 'https://openidconnect.googleapis.com/v1/userinfo',
};

const hasRef = (ref) => {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', ref], { cwd: P('.'), stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
};
const LINE = hasRef('refs/heads/code/p3-45') ? 'code/p3-45' : 'main';
const WT = process.env.P345_WT ? Number(process.env.P345_WT) : null;
const commitOf = (n) => {
  const log = execFileSync('git', ['log', '--format=%H %s', `code/p3-44..${LINE}`], { cwd: P('.'), encoding: 'utf8' });
  const hits = log.split('\n').filter((l) => / feat\(p3-45\): /.test(l) && l.endsWith(`(Step ${n})`));
  if (hits.length === 0) throw new Error(`(Step ${n}) 커밋이 없다`);
  return hits[0].split(' ')[0];
};
const dirs = [];
const refDirs = new Map();
/** 커밋(또는 브랜치) 하나를 임시 폴더에 풀어 둔다. */
const refDir = (ref) => {
  if (refDirs.has(ref)) return refDirs.get(ref);
  const dir = mkdtempSync(join(tmpdir(), 'p345-ref-'));
  const tar = execFileSync('git', ['archive', '--format=tar', ref], { cwd: P('.'), maxBuffer: 1 << 28 });
  execFileSync('tar', ['-x', '-C', dir], { input: tar });
  dirs.push(dir);
  const at = (rel) => join(dir, rel);
  refDirs.set(ref, at);
  return at;
};
const stepDir = (n) => (n === WT ? (rel) => P(rel) : refDir(commitOf(n)));

const admin = async (fn) => {
  const client = new pg.Client(ADMIN);
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
};
const kick = (client, name) => client.query(
  `select pg_terminate_backend(pid) from pg_stat_activity where datname = '${name}' and pid <> pg_backend_pid()`);
const gate = async (sql, params) => {
  const client = new pg.Client({ ...ADMIN, database: GATE_DB });
  await client.connect();
  try {
    return (await client.query(sql, params)).rows;
  } finally {
    await client.end();
  }
};
/** 판정 DB 를 템플릿에서 새로 만든다 — 시드 다섯(비밀번호 «이름1234») · yuna(이메일 yuna@example.com · yuna1234). */
const freshGate = () => admin(async (client) => {
  await kick(client, GATE_DB);
  await client.query(`DROP DATABASE IF EXISTS ${GATE_DB}`);
  await kick(client, TPL_DB);
  await client.query(`CREATE DATABASE ${GATE_DB} TEMPLATE ${TPL_DB}`);
});
const count = async (table) => Number((await gate(`SELECT count(*) AS n FROM ${table}`))[0].n);

const replaceIn = (dir, rel, a, b) => {
  const text = read(join(dir, rel));
  if (!text.includes(a)) throw new Error(`${rel} 에 바꿀 글자가 없다: ${a}`);
  writeFileSync(join(dir, rel), text.replace(a, b));
};
/** 구글 주소만 가짜 구글로 바꾼다 — 인가·토큰 주소는 반드시 있어야 하고, 사용자 정보 주소는 그 판에 있을 때만. */
const useFakeGoogle = (dir, google) => {
  const rel = 'strategies/google.js';
  let text = read(join(dir, rel));
  for (const key of ['authorize', 'token', 'userinfo']) {
    if (!text.includes(REAL_GOOGLE[key])) {
      if (key === 'userinfo') continue;
      throw new Error(`${rel} 에 바꿀 글자가 없다: ${REAL_GOOGLE[key]}`);
    }
    text = text.replaceAll(REAL_GOOGLE[key], google.urls[key]);
  }
  if (/google\.com|googleapis\.com/.test(text)) throw new Error(`${rel} 에 진짜 구글 주소가 남았다`);
  writeFileSync(join(dir, rel), text);
};

const studentDir = (from, edit) => {
  const dir = mkdtempSync(join(tmpdir(), 'p345-srv-'));
  for (const name of STUDENT_FILES) {
    if (existsSync(from(name))) cpSync(from(name), join(dir, name), { recursive: true });
  }
  symlinkSync(P('node_modules'), join(dir, 'node_modules'));
  if (edit) edit(dir);
  dirs.push(dir);
  return dir;
};
const start = (dir, { port = PORT, extraEnv = {}, without = [] } = {}) => {
  const all = { ...env, ...extraEnv, PORT: String(port) };
  for (const name of without) delete all[name];
  return boot(join(dir, 'app.js'), { port, cwd: dir, env: all, ready: `${port}번 포트에서` });
};
const stop = (srv) => Promise.race([srv.stop(), sleep(500)]);
/** 서버가 «뜨지 않아야» 하는 판 — 뜨지 못한 로그를 돌려준다. 떠 버렸으면 끄고 던진다(포트를 남기지 않게). */
const bootFailure = async (dir, opts) => {
  let srv;
  try {
    srv = await start(dir, opts);
  } catch (error) {
    return error.message;
  }
  await stop(srv);
  throw new Error('서버가 떴다 — 뜨지 않아야 하는 판이다');
};
let google;
/** 그 판의 학생 파일 사본을 띄운다 — `fake` 면 구글 주소를 가짜 구글로 바꾼 사본. */
const withServer = async (from, fn, { edit, fake = true, port = PORT, extraEnv } = {}) => {
  const dir = studentDir(from, (d) => {
    if (fake) useFakeGoogle(d, google);
    if (edit) edit(d);
  });
  const srv = await start(dir, { port, extraEnv });
  try {
    await fn({ ...srv, dir, base: `http://localhost:${port}` });
  } finally {
    await stop(srv);
  }
};

/** 쿠키를 이름과 Path 마다 기억하는 브라우저 하나 — 리다이렉트는 따라가지 않는다(Location 을 잰다). */
const pathMatches = (cookiePath, path) => {
  const reqPath = path.split('?')[0];
  return reqPath === cookiePath || reqPath.startsWith(cookiePath.endsWith('/') ? cookiePath : `${cookiePath}/`);
};
const browser = (base) => {
  const jar = new Map();
  const send = async (method, path, body, extra = {}) => {
    const headers = { ...extra };
    // 폼(URLSearchParams)은 브라우저의 <form> 처럼 urlencoded 로, 그 밖의 본문은 JSON 으로 보낸다.
    const isForm = body instanceof URLSearchParams;
    if (body !== undefined) headers['Content-Type'] = isForm ? 'application/x-www-form-urlencoded' : 'application/json';
    // path 가 긴 쿠키를 앞에 싣는다(RFC 6265 §5.4)
    const carried = [...jar.values()].filter((c) => pathMatches(c.path, path)).sort((a, b) => b.path.length - a.path.length);
    if (carried.length > 0 && !headers.Cookie) headers.Cookie = carried.map((c) => `${c.name}=${c.value}`).join('; ');
    const res = await fetch(`${base}${path}`, { method, headers, redirect: 'manual', body: body === undefined ? undefined : isForm ? body.toString() : JSON.stringify(body) });
    const sets = res.headers.getSetCookie();
    for (const line of sets) {
      const [pair] = line.split(';');
      const at = pair.indexOf('=');
      const [name, value] = [pair.slice(0, at), pair.slice(at + 1)];
      const cookiePath = /;\s*Path=([^;]+)/i.exec(line)?.[1] ?? '/';
      const key = `${name} ${cookiePath}`;
      if (value === '' || /Expires=Thu, 01 Jan 1970/.test(line)) jar.delete(key);
      else jar.set(key, { name, value, path: cookiePath });
    }
    const text = await res.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = text; }
    return { status: res.status, headers: res.headers, location: res.headers.get('location'), body: parsed, setCookies: sets };
  };
  return {
    send,
    get: (path, extra) => send('GET', path, undefined, extra),
    post: (path, body) => send('POST', path, body),
    login: (username, password = `${username}1234`, prefix = '/api/v2') => send('POST', `${prefix}/auth/login`, { username, password }),
    cookie: (name) => [...jar.values()].find((c) => c.name === name)?.value,
    cookies: () => [...jar.values()].map((c) => `${c.name} ${c.path}`).sort(),
  };
};

/**
 * 구글 로그인 한 바퀴 — 시작 → (가짜) 구글의 동의 → 콜백.
 * `tamper` 는 돌아오는 주소의 state 를 바꾼다 · `fresh` 는 쿠키 없는 다른 브라우저로 콜백을 연다.
 */
const googleLogin = async (tab, { start = '/api/v2/auth/google', next, tamper, fresh } = {}) => {
  const begin = await tab.get(next === undefined ? start : `${start}?next=${encodeURIComponent(next)}`);
  if (begin.status !== 302) return { begin };
  const consent = await fetch(begin.location, { redirect: 'manual' });
  const back = new URL(consent.headers.get('location'));
  if (tamper !== undefined) back.searchParams.set('state', tamper);
  expect(back.origin).toBe(SITE);
  const callback = await (fresh ? browser(SITE) : tab).get(`${back.pathname}${back.search}`);
  return { begin, consent: { status: consent.status, location: back.href }, callback };
};
const cookieLine = (res, name) => res.setCookies.find((line) => line.startsWith(`${name}=`));
/** 쿠키 줄에서 값과 날짜만 지운다 — 옵션 글자를 비교하려고. */
const cookieShape = (line) => line.replace(/^([^=]+)=[^;]*/, '$1=…').replace(/Expires=[^;]+/, 'Expires=…');

beforeAll(async () => {
  await admin(async (client) => {
    for (const name of [GATE_DB, TPL_DB]) {
      await kick(client, name);
      await client.query(`DROP DATABASE IF EXISTS ${name}`);
    }
    await client.query(`CREATE DATABASE ${TPL_DB}`);
  });
  const tpl = new pg.Client({ ...ADMIN, database: TPL_DB });
  await tpl.connect();
  // 마이그레이션은 이 회차 끝 판(tip)까지 — 앞 Step 판은 social_accounts 테이블을 안 쓰니 같은 DB 로 돈다.
  for (const dir of readdirSync(R('prisma/migrations')).filter((name) => name !== 'migration_lock.toml').sort()) {
    await tpl.query(read(R(`prisma/migrations/${dir}/migration.sql`)));
  }
  await tpl.end();
  execFileSync(process.execPath, [R('seed.js')], {
    cwd: ROUND.dir, encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: `postgresql://postgres:postgres@localhost:5432/${TPL_DB}` },
  });
  // 이메일로 가입한 사람 — 같은 이메일의 구글 계정이 올 때를 재려고(p3-22 의 가입 장면과 같은 값)
  const hash = await bcrypt.hash('yuna1234', 12);
  const after = new pg.Client({ ...ADMIN, database: TPL_DB });
  await after.connect();
  await after.query("INSERT INTO users (username, name, email, password_hash) VALUES ('yuna', '김유나', 'yuna@example.com', $1)", [hash]);
  await after.end();
  google = await startFakeGoogle({ port: GOOGLE_PORT });
}, 120000);

afterAll(async () => {
  await google?.stop();
  await admin(async (client) => {
    for (const name of [GATE_DB, TPL_DB]) {
      await kick(client, name);
      await client.query(`DROP DATABASE IF EXISTS ${name}`);
    }
  });
  ROUND.cleanup();
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => google?.reset());

describe('축 ① Step 1 — .env.example 에 구글 클라이언트와 화면 주소', () => {
  it('🔴 이름 셋이 끝에 값 없이 — GOOGLE_CLIENT_ID · GOOGLE_CLIENT_SECRET · SITE_URL', () => {
    const lines = read(stepDir(1)('.env.example')).trimEnd().split('\n');
    expect(lines.slice(-3)).toEqual(['GOOGLE_CLIENT_ID=', 'GOOGLE_CLIENT_SECRET=', 'SITE_URL=']);
    // 앞 회차의 줄은 그대로
    expect(lines.slice(0, -3)).toEqual(execFileSync('git', ['show', 'code/p3-44:.env.example'], { cwd: P('.'), encoding: 'utf8' }).trimEnd().split('\n'));
  });
});

/** 시작 주소의 Location 을 쿼리째 나눈다. */
const authorizeQuery = (location) => {
  const url = new URL(location);
  return { origin: `${url.origin}${url.pathname}`, query: Object.fromEntries(url.searchParams), keys: [...url.searchParams.keys()] };
};
const CALLBACK = `${SITE}/api/v2/auth/google/callback`;

describe('축 ② Step 2 — Passport 전략과 시작 라우트(state 없이)', () => {
  it('🔴 .env 에 세 값이 없으면 서버가 뜨지 않는다 — OAuth2Strategy 생성자가 clientID 를 요구한다', async () => {
    const dir = studentDir(stepDir(2));
    expect(await bootFailure(dir, { without: Object.keys(GOOGLE_ENV) })).toMatch(/TypeError: OAuth2Strategy requires a clientID option/);
  }, 30_000);

  // 🔎 Passport 는 프로토콜 없는 돌아올 주소를 «요청이 온 주소» 기준으로 풀어 쓴다 — 그래서 `undefined/…` 가 백엔드 주소 밑으로 붙는다.
  it('🔴 SITE_URL 하나만 빠지면 서버는 뜨고, 돌아올 주소가 «http://localhost:3960/undefined/api/v2/auth/google/callback» 이 된다', async () => {
    const dir = studentDir(stepDir(2));
    const srv = await start(dir, { without: ['SITE_URL'] });
    try {
      const res = await browser(SITE).get('/api/v2/auth/google');
      expect(res.status).toBe(302);
      expect(authorizeQuery(res.location).query.redirect_uri).toBe(`${SITE}/undefined/api/v2/auth/google/callback`);
    } finally {
      await stop(srv);
    }
  }, 30_000);

  it('🔴 시작 요청은 302 — 구글 인가 주소 + response_type=code · redirect_uri · scope=email%20profile · client_id · state 와 code_challenge 는 없다 · 쿠키도 없다', async () => {
    await withServer(stepDir(2), async ({ base }) => {
      const res = await browser(base).get('/api/v2/auth/google');
      expect(res.status).toBe(302);
      const { origin, query, keys } = authorizeQuery(res.location);
      expect(origin).toBe(REAL_GOOGLE.authorize);
      expect(keys).toEqual(['response_type', 'redirect_uri', 'scope', 'client_id']);
      expect(query).toEqual({ response_type: 'code', redirect_uri: CALLBACK, scope: 'email profile', client_id: 'test-client' });
      expect(res.location).toContain('scope=email%20profile');
      expect(res.setCookies).toEqual([]);
    }, { fake: false });
  }, 30_000);

  it('🔴 시작 주소는 GET 만 — POST 는 405 + Allow: GET', async () => {
    await withServer(stepDir(2), async ({ base }) => {
      const res = await browser(base).post('/api/v2/auth/google', {});
      expect(res.status).toBe(405);
      expect(res.headers.get('allow')).toBe('GET');
      expect(res.body.error.code).toBe('METHOD_NOT_ALLOWED');
    }, { fake: false });
  }, 30_000);

  it('🔴 package.json·lock 은 code/p3-44 에서 npm install passport passport-oauth2 한 그대로 — passport ^0.7.0 · passport-oauth2 ^1.8.0', () => {
    const dir = mkdtempSync(join(tmpdir(), 'p345-npm-'));
    dirs.push(dir);
    for (const name of ['package.json', 'package-lock.json']) {
      writeFileSync(join(dir, name), execFileSync('git', ['show', `code/p3-44:${name}`], { cwd: P('.'), encoding: 'utf8' }));
    }
    execFileSync('npm', ['install', 'passport', 'passport-oauth2', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund', '--prefer-offline'], { cwd: dir, encoding: 'utf8', stdio: 'pipe' });
    const step = stepDir(2);
    expect(read(step('package.json'))).toBe(read(join(dir, 'package.json')));
    expect(read(step('package-lock.json'))).toBe(read(join(dir, 'package-lock.json')));
    const deps = Object.keys(JSON.parse(read(step('package.json'))).dependencies);
    expect(deps).toEqual([...deps].sort());
    expect(JSON.parse(read(step('package.json'))).dependencies).toMatchObject({ passport: '^0.7.0', 'passport-oauth2': '^1.8.0' });
  }, 60_000);

  it('🔴 학생 조건(devDependencies 없는 package.json)에서 npm install passport passport-oauth2 는 «added 8 packages»', () => {
    const dir = mkdtempSync(join(tmpdir(), 'p345-npm-student-'));
    dirs.push(dir);
    const pkg = JSON.parse(execFileSync('git', ['show', 'code/p3-44:package.json'], { cwd: P('.'), encoding: 'utf8' }));
    delete pkg.devDependencies;
    writeFileSync(join(dir, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);
    writeFileSync(join(dir, 'package-lock.json'), execFileSync('git', ['show', 'code/p3-44:package-lock.json'], { cwd: P('.'), encoding: 'utf8' }));
    const npm = (...args) => execFileSync('npm', [...args, '--prefer-offline', '--ignore-scripts'], { cwd: dir, encoding: 'utf8', stdio: 'pipe' });
    npm('install');
    const out = npm('install', 'passport', 'passport-oauth2');
    expect(out.trim().split('\n')[0]).toMatch(/^added 8 packages, and audited 273 packages in /);
    const lock = JSON.parse(read(join(dir, 'package-lock.json')));
    const added = ['base64url', 'oauth', 'passport', 'passport-oauth2', 'passport-strategy', 'pause', 'uid2', 'utils-merge'];
    for (const name of added) expect(lock.packages[`node_modules/${name}`]).toBeDefined();
  }, 180_000);
});

const SNAP = (name) => P(`snapshots/p3-45.${name}`);
const s256 = (verifier) => createHash('sha256').update(verifier).digest('base64url');

describe('축 ③ Step 3 — state·PKCE 를 쿠키에', () => {
  it('🔴 겪기 판(스냅숏)은 Step 2 판에 «state: true,» 한 줄만 더한 것', () => {
    const before = read(stepDir(2)('strategies/google.js')).split('\n');
    const after = read(SNAP('step3-state-true.google.js')).split('\n');
    expect(after.length).toBe(before.length + 1);
    const at = after.findIndex((line, i) => line !== before[i]);
    expect(after[at]).toBe('    state: true,');
    expect([...after.slice(0, at), ...after.slice(at + 1)]).toEqual(before);
  });

  it('🔴 state: true 판은 시작 요청이 500 — 세션이 없다는 에러가 터미널에 · 응답은 우리 에러 미들웨어의 INTERNAL_ERROR', async () => {
    await withServer(stepDir(2), async ({ base, tail }) => {
      const res = await browser(base).get('/api/v2/auth/google');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: { code: 'INTERNAL_ERROR', message: '서버에서 문제가 생겼어요' } });
      await sleep(100);
      expect(tail()).toContain('Error: OAuth 2.0 authentication requires session support when using state. Did you forget to use express-session middleware?');
      expect(tail()).toContain('GET /api/v2/auth/google 500');
    }, { fake: false, edit: (d) => cpSync(SNAP('step3-state-true.google.js'), join(d, 'strategies/google.js')) });
  }, 30_000);

  it('🔴 pkce: true 만 있고 store 가 없으면 서버가 뜨지 않는다 — 생성자가 state: true 를 요구한다', async () => {
    const dir = studentDir(stepDir(3), (d) => replaceIn(d, 'strategies/google.js', '    store: stateStore,\n', ''));
    expect(await bootFailure(dir)).toMatch(/TypeError: OAuth2Strategy requires `state: true` option when PKCE is enabled/);
  }, 30_000);

  it('🔴 시작 302 의 Location 에 state(22자) · code_challenge(43자) · S256 · 쿠키 둘(Path=/api/v2/auth · HttpOnly · SameSite=Lax · Max-Age=600) — 쿠키의 state 와 같고 verifier 의 S256 이 challenge', async () => {
    await withServer(stepDir(3), async ({ base }) => {
      const tab = browser(base);
      const res = await tab.get('/api/v2/auth/google');
      expect(res.status).toBe(302);
      const { origin, query, keys } = authorizeQuery(res.location);
      expect(origin).toBe(REAL_GOOGLE.authorize);
      expect(keys).toEqual(['response_type', 'redirect_uri', 'scope', 'code_challenge', 'code_challenge_method', 'state', 'client_id']);
      expect(query.state).toMatch(/^[A-Za-z0-9_-]{22}$/);
      expect(query.code_challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(query.code_challenge_method).toBe('S256');
      expect(res.setCookies.map(cookieShape)).toEqual([
        'oauth_state=…; Max-Age=600; Path=/api/v2/auth; Expires=…; HttpOnly; SameSite=Lax',
        'oauth_verifier=…; Max-Age=600; Path=/api/v2/auth; Expires=…; HttpOnly; SameSite=Lax',
      ]);
      expect(tab.cookie('oauth_state')).toBe(query.state);
      expect(s256(tab.cookie('oauth_verifier'))).toBe(query.code_challenge);
      // 시작할 때마다 새 값
      const again = authorizeQuery((await tab.get('/api/v2/auth/google')).location).query;
      expect(again.state).not.toBe(query.state);
      expect(again.code_challenge).not.toBe(query.code_challenge);
    }, { fake: false });
  }, 30_000);
});

describe('축 ④ Step 4 — 콜백과 프로필(req.user 는 아직 «구글의 사람»)', () => {
  it('🔴 시작 → 동의 → 콜백 200 — { data: { provider, id(sub), email, emailVerified, name } } · 돌아오면 임시 쿠키 둘을 지운다', async () => {
    await withServer(stepDir(4), async ({ base }) => {
      const tab = browser(base);
      const { begin, consent, callback } = await googleLogin(tab);
      expect(begin.status).toBe(302);
      expect(consent.status).toBe(302);
      expect(callback.status).toBe(200);
      expect(callback.body).toEqual({ data: { provider: 'google', id: '108123456789012345678', email: 'minji.kim@gmail.com', emailVerified: true, name: '김민지' } });
      expect(callback.setCookies.map(cookieShape)).toEqual([
        'oauth_state=…; Path=/api/v2/auth; Expires=…',
        'oauth_verifier=…; Path=/api/v2/auth; Expires=…',
      ]);
      expect(tab.cookies()).toEqual([]);
      // 확인 안 된 이메일이면 emailVerified 가 false
      google.state.profile = { ...google.state.profile, email_verified: false };
      expect((await googleLogin(browser(base))).callback.body.data.emailVerified).toBe(false);
    });
  }, 30_000);

  it('🔴 토큰 주소가 받은 것 — 폼 본문에 grant_type=authorization_code · code · redirect_uri · code_verifier(그 S256 이 시작 때의 challenge) · client_id · client_secret', async () => {
    await withServer(stepDir(4), async ({ base }) => {
      const { consent, callback } = await googleLogin(browser(base));
      expect(callback.status).toBe(200);
      const [{ body, contentType, authorization }] = google.state.log.token;
      expect(contentType).toBe('application/x-www-form-urlencoded');
      expect(authorization).toBeUndefined();
      expect(Object.keys(body).sort()).toEqual(['client_id', 'client_secret', 'code', 'code_verifier', 'grant_type', 'redirect_uri']);
      expect(body).toMatchObject({
        grant_type: 'authorization_code',
        redirect_uri: CALLBACK,
        client_id: 'test-client',
        client_secret: 'test-secret',
        code: new URL(consent.location).searchParams.get('code'),
      });
      expect(s256(body.code_verifier)).toBe(google.state.log.authorize[0].code_challenge);
    });
  }, 30_000);

  it('🔴 사용자 정보는 Authorization: Bearer 헤더로 묻는다 — 주소에 access_token 이 없다', async () => {
    await withServer(stepDir(4), async ({ base }) => {
      await googleLogin(browser(base));
      const [{ url, authorization }] = google.state.log.userinfo;
      expect(url).toBe('/userinfo');
      expect(authorization).toMatch(/^Bearer ya29\./);
      expect(google.state.tokens.has(authorization.slice('Bearer '.length))).toBe(true);
    });
  }, 30_000);

  it('🔴 고친 state · 쿠키 없이 온 콜백은 403 Forbidden(Passport 기본 — state 저장소가 false 를 넘기면 403) · 구글에 토큰을 묻지 않는다', async () => {
    await withServer(stepDir(4), async ({ base }) => {
      const tampered = await googleLogin(browser(base), { tamper: 'forged' });
      expect(tampered.callback.status).toBe(403);
      expect(tampered.callback.body).toBe('Forbidden');
      const fresh = await googleLogin(browser(base), { fresh: true });
      expect(fresh.callback.status).toBe(403);
      expect(fresh.callback.body).toBe('Forbidden');
      expect(google.state.log.token).toEqual([]);
    });
  }, 30_000);

  it('🔴 동의 화면에서 거부(?error=access_denied)하면 401 Unauthorized(Passport 기본) · 토큰을 묻지 않는다', async () => {
    await withServer(stepDir(4), async ({ base }) => {
      google.state.mode = 'deny';
      const { consent, callback } = await googleLogin(browser(base));
      expect(new URL(consent.location).searchParams.get('error')).toBe('access_denied');
      expect(callback.status).toBe(401);
      expect(callback.body).toBe('Unauthorized');
      expect(google.state.log.token).toEqual([]);
    });
  }, 30_000);

  it('🔴 구글이 사용자 정보를 주지 않으면(401) 우리 에러 미들웨어의 500 · 터미널에 «구글이 사용자 정보를 주지 않았어요 (401)»', async () => {
    await withServer(stepDir(4), async ({ base, tail }) => {
      google.state.userinfoFails = true;
      const { callback } = await googleLogin(browser(base));
      expect(callback.status).toBe(500);
      expect(callback.body).toEqual({ error: { code: 'INTERNAL_ERROR', message: '서버에서 문제가 생겼어요' } });
      await sleep(100);
      expect(tail()).toContain('Error: 구글이 사용자 정보를 주지 않았어요 (401)');
    });
  }, 30_000);

  it('🔴 req.session 은 없다 — 세션 미들웨어 없이 session: false 로 돈다', async () => {
    await withServer(stepDir(4), async ({ base }) => {
      const { callback } = await googleLogin(browser(base));
      expect(callback.body.data.hasSession).toBe(false);
      expect(callback.setCookies.some((line) => line.startsWith('connect.sid='))).toBe(false);
    }, { edit: (d) => replaceIn(d, 'controllers/authController.js', 'sendData(res, req.user);', "sendData(res, { ...req.user, hasSession: 'session' in req });") });
  }, 30_000);

  it('🔴 콜백 주소는 GET 만 — POST 는 405 + Allow: GET', async () => {
    await withServer(stepDir(4), async ({ base }) => {
      const res = await browser(base).post('/api/v2/auth/google/callback', {});
      expect(res.status).toBe(405);
      expect(res.headers.get('allow')).toBe('GET');
    });
  }, 30_000);
});

const PREV_TIP = '20261112052312_add_previous_refresh_token_hash';
// `npx prisma migrate dev --name add_social_accounts` 가 만든 SQL 그대로(실측).
const SOCIAL_SQL = `-- CreateTable
CREATE TABLE "social_accounts" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "provider" VARCHAR(20) NOT NULL,
    "provider_user_id" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "social_accounts_user_id_idx" ON "social_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "social_accounts_provider_provider_user_id_key" ON "social_accounts"("provider", "provider_user_id");

-- AddForeignKey
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
`;
// 스키마 파일 끝에 더한 모델(설계 명세 그대로 · prisma format 과도 같다).
const SOCIAL_MODEL = `
// 소셜 계정 — «어느 제공자의 누구» 한 쌍이 한 행이고, 우리 사람 한 명을 가리킨다.
// 같은 쌍은 한 번만 들어간다 — 같은 구글 계정으로 다시 오면 이 행으로 그 사람을 찾는다.
// 사람을 지우면 그 사람의 소셜 계정도 함께 지운다(onDelete: Cascade).
model SocialAccount {
  id             Int      @id @default(autoincrement())
  userId         Int      @map("user_id")
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  provider       String   @db.VarChar(20)
  providerUserId String   @map("provider_user_id") @db.VarChar(255)
  createdAt      DateTime @default(now()) @map("created_at")

  @@unique([provider, providerUserId])
  @@index([userId])
  @@map("social_accounts")
}
`;
// 시드의 출력은 한 줄 그대로다(테이블 하나를 목록에 더했을 뿐).
const SEED_LINE = '사람 5명, 게시물 5개, 사진 8장, 댓글 9개, 답글 3개를 넣었어요.';
const socialMigration = (n) => readdirSync(stepDir(n)('prisma/migrations')).find((name) => name.endsWith('_add_social_accounts'));
/** 그 판의 seed.js 를 판정 DB 에 돌린다(edit 로 사본을 고칠 수 있다). */
const runSeed = (n, edit) => {
  const dir = studentDir(stepDir(n), edit);
  try {
    return { code: 0, out: execFileSync(process.execPath, ['seed.js'], { cwd: dir, encoding: 'utf8', stdio: 'pipe', env: { ...process.env, DATABASE_URL: GATE_URL } }) };
  } catch (error) {
    return { code: error.status, out: `${error.stdout}${error.stderr}` };
  }
};

describe('축 ⑤ Step 5 — social_accounts 테이블', () => {
  it('🔴 마이그레이션 add_social_accounts 하나 — 직전 마이그레이션보다 뒤 · 테이블 · UNIQUE(provider, provider_user_id) · user_id 인덱스 · FK ON DELETE CASCADE', () => {
    const dir = socialMigration(5);
    expect(dir).toBeDefined();
    expect(dir > PREV_TIP).toBe(true);
    expect(dir.startsWith('20261112')).toBe(true);
    const before = readdirSync(stepDir(4)('prisma/migrations'));
    expect(readdirSync(stepDir(5)('prisma/migrations')).filter((name) => !before.includes(name))).toEqual([dir]);
    expect(read(stepDir(5)(`prisma/migrations/${dir}/migration.sql`))).toBe(SOCIAL_SQL);
  });

  it('🔴 스키마 — code/p3-44 의 스키마에 User 한 줄(sessions 아래 socialAccounts)과 SocialAccount 모델만 더해졌다(다른 줄은 정렬까지 그대로)', () => {
    const before = execFileSync('git', ['show', 'code/p3-44:prisma/schema.prisma'], { cwd: P('.'), encoding: 'utf8' });
    const after = read(stepDir(5)('prisma/schema.prisma'));
    const line = '  sessions     Session[]\n';
    expect(before.split(line)).toHaveLength(2);
    expect(after).toBe(before.replace(line, `${line}  socialAccounts SocialAccount[]\n`).trimEnd() + '\n' + SOCIAL_MODEL);
  });

  it('🔴 같은 «제공자 + 그 계정» 은 한 번만(23505) · 사람을 지우면 그 사람의 소셜 계정도 지워진다', async () => {
    await freshGate();
    await gate("INSERT INTO social_accounts (user_id, provider, provider_user_id) VALUES (2, 'google', 'abc')");
    await expect(gate("INSERT INTO social_accounts (user_id, provider, provider_user_id) VALUES (3, 'google', 'abc')")).rejects.toMatchObject({ code: '23505' });
    await gate("INSERT INTO social_accounts (user_id, provider, provider_user_id) VALUES (3, 'kakao', 'abc')");
    await gate('DELETE FROM sessions WHERE user_id = 2');
    await gate('DELETE FROM post_likes WHERE user_id = 2');
    await gate('DELETE FROM comments WHERE author_id = 2 OR post_id IN (SELECT id FROM posts WHERE author_id = 2)');
    await gate('DELETE FROM posts WHERE author_id = 2');
    await gate('DELETE FROM users WHERE id = 2');
    expect(await gate('SELECT user_id, provider FROM social_accounts ORDER BY id')).toEqual([{ user_id: 3, provider: 'kakao' }]);
  }, 30_000);

  it('🔴 시드는 TRUNCATE 목록 맨 앞에 social_accounts — 소셜 계정이 있어도 다시 넣을 수 있다 · 목록에서 빼면 0A000', async () => {
    expect(read(stepDir(5)('seed.js'))).toContain('TRUNCATE TABLE social_accounts, sessions, post_likes, post_images, comments, posts, users RESTART IDENTITY');
    await freshGate();
    await gate("INSERT INTO social_accounts (user_id, provider, provider_user_id) VALUES (2, 'google', 'abc')");
    const ok = runSeed(5);
    expect(ok.code).toBe(0);
    expect(ok.out.trim()).toBe(SEED_LINE);
    expect(await count('social_accounts')).toBe(0);
    const missing = runSeed(5, (d) => replaceIn(d, 'seed.js', 'TRUNCATE TABLE social_accounts, ', 'TRUNCATE TABLE '));
    expect(missing.code).not.toBe(0);
    expect(missing.out).toContain('0A000');
    expect(missing.out).toContain('cannot truncate a table referenced in a foreign key constraint');
  }, 60_000);
});

const profileOf = (over) => ({ sub: '108123456789012345678', email: 'minji.kim@gmail.com', email_verified: true, name: '김민지', ...over });
/** 구글 로그인을 한 바퀴 돌고 콜백 응답을 돌려준다 — 가짜 구글이 내줄 사람을 먼저 정한다. */
const asGoogle = async (base, over, opts) => {
  google.state.profile = profileOf(over);
  return (await googleLogin(browser(base), opts)).callback;
};
const userRow = async (id) => (await gate('SELECT id, username, email, name, password_hash, role FROM users WHERE id = $1', [id]))[0];
const socialRows = () => gate('SELECT user_id, provider, provider_user_id FROM social_accounts ORDER BY id');

describe('축 ⑥ Step 6 — 찾거나 만들기(req.user 가 «우리 사람»)', () => {
  it('🔴 처음 온 구글 사람 — 콜백 200 { data: { id, username, profileImage: null, role: USER } } · users 한 행(password_hash NULL · 확인된 이메일) + social_accounts 한 행 · 다시 오면 같은 id', async () => {
    await freshGate();
    await withServer(stepDir(6), async ({ base }) => {
      const users = await count('users');
      const first = await asGoogle(base);
      expect(first.status).toBe(200);
      const { id } = first.body.data;
      expect(first.body).toEqual({ data: { id, username: 'minji.kim', profileImage: null, role: 'USER' } });
      expect(await userRow(id)).toEqual({ id, username: 'minji.kim', email: 'minji.kim@gmail.com', name: '김민지', password_hash: null, role: 'USER' });
      expect(await socialRows()).toEqual([{ user_id: id, provider: 'google', provider_user_id: '108123456789012345678' }]);
      expect(await count('users')).toBe(users + 1);
      // 같은 사람이 다시 오면 같은 사람 · 행이 늘지 않는다
      expect((await asGoogle(base)).body.data.id).toBe(id);
      // 구글에서 이메일을 바꾼 뒤(같은 sub) 와도 같은 사람 — 우리 users.email 은 그대로
      expect((await asGoogle(base, { email: 'minji.new@gmail.com' })).body.data.id).toBe(id);
      expect((await userRow(id)).email).toBe('minji.kim@gmail.com');
      expect(await count('users')).toBe(users + 1);
      expect(await count('social_accounts')).toBe(1);
    });
  }, 30_000);

  it('🔴 확인 안 된 이메일은 넣지 않는다 — users.email NULL', async () => {
    await freshGate();
    await withServer(stepDir(6), async ({ base }) => {
      const res = await asGoogle(base, { sub: '2001', email: 'somebody@example.com', email_verified: false, name: '누군가' });
      expect(res.status).toBe(200);
      expect(await userRow(res.body.data.id)).toMatchObject({ username: 'somebody', email: null, password_hash: null });
    });
  }, 30_000);

  it('🔴 사용자 이름 — 이메일 앞부분이 이미 있는 이름이면 «이름 + 숫자 넷» · 쓸 수 있는 글자가 없으면 google(두 번째는 google + 숫자 넷) · 기호는 빼고 26자까지', async () => {
    await freshGate();
    await withServer(stepDir(6), async ({ base }) => {
      expect((await asGoogle(base, { sub: '3001', email: 'jaehoon@gmail.com' })).body.data.username).toMatch(/^jaehoon\d{4}$/);
      expect((await asGoogle(base, { sub: '3002', email: '김민지@example.kr' })).body.data.username).toBe('google');
      expect((await asGoogle(base, { sub: '3003', email: '++@example.kr' })).body.data.username).toMatch(/^google\d{4}$/);
      expect((await asGoogle(base, { sub: '3004', email: 'a-b+c.d_e@gmail.com' })).body.data.username).toBe('abc.d_e');
      expect((await asGoogle(base, { sub: '3005', email: `${'x'.repeat(40)}@gmail.com` })).body.data.username).toBe('x'.repeat(26));
    });
  }, 30_000);

  it('🔴 이미 가입한 이메일(확인된 것)이면 지금은 409 JSON — EMAIL_TAKEN 봉투 · users·social_accounts 행 수 그대로', async () => {
    await freshGate();
    await withServer(stepDir(6), async ({ base }) => {
      const [users, socials] = [await count('users'), await count('social_accounts')];
      const res = await asGoogle(base, { sub: '4001', email: 'yuna@example.com', name: '김유나' });
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ error: { code: 'EMAIL_TAKEN', message: '이미 가입한 이메일이에요' } });
      expect([await count('users'), await count('social_accounts')]).toEqual([users, socials]);
    });
  }, 30_000);

  it('🔴 사람과 소셜 계정은 함께 들어가거나 함께 안 들어간다 — 소셜 계정 쪽에서 실패하면(provider_user_id 256자) 사람도 없다', async () => {
    await freshGate();
    await withServer(stepDir(6), async ({ base }) => {
      const [users, socials] = [await count('users'), await count('social_accounts')];
      const res = await asGoogle(base, { sub: 'x'.repeat(256), email: 'long.sub@gmail.com' });
      expect(res.status).toBe(500);
      expect([await count('users'), await count('social_accounts')]).toEqual([users, socials]);
      expect(await gate("SELECT id FROM users WHERE username = 'long.sub'")).toEqual([]);
    });
  }, 30_000);

  it('🔎 토큰 교환이 실패하면(비밀값 거절) 우리 에러 미들웨어가 err.status(500) 를 보고 «보낸 내용을 읽을 수 없어요» 로 답한다', async () => {
    await freshGate();
    await withServer(stepDir(6), async ({ base }) => {
      google.state.clientSecret = 'another-secret';
      const res = await asGoogle(base);
      expect(google.state.log.token).toHaveLength(1);
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: { code: 'INVALID_BODY', message: '보낸 내용을 읽을 수 없어요' } });
      expect(await count('social_accounts')).toBe(0);
    });
  }, 30_000);
});

const sessionsOf = (userId) => gate('SELECT id, refresh_token_hash FROM sessions WHERE user_id = $1', [userId]);
const LOGIN_FAILED_PAGE = '/login?error=SOCIAL_LOGIN_FAILED';

describe('축 ⑦ Step 7 — 로그인 기록과 토큰 둘 · 302 · ?next= · 실패는 로그인 화면으로', () => {
  it('🔴 처음 온 사람 — 콜백 302 Location: / · 쿠키 둘(옵션이 비밀번호 로그인과 글자까지 같다) · 임시 쿠키 셋을 지운다 · sessions 한 행 · me·reissue·logout 200', async () => {
    await freshGate();
    await withServer(stepDir(7), async ({ base }) => {
      const tab = browser(base);
      google.state.profile = profileOf();
      const { begin, callback } = await googleLogin(tab);
      expect(begin.setCookies.map(cookieShape)).toEqual([
        'oauth_next=…; Max-Age=600; Path=/api/v2/auth; Expires=…; HttpOnly; SameSite=Lax',
        'oauth_state=…; Max-Age=600; Path=/api/v2/auth; Expires=…; HttpOnly; SameSite=Lax',
        'oauth_verifier=…; Max-Age=600; Path=/api/v2/auth; Expires=…; HttpOnly; SameSite=Lax',
      ]);
      expect(callback.status).toBe(302);
      expect(callback.location).toBe('/');
      expect(callback.setCookies.map(cookieShape)).toEqual([
        'oauth_state=…; Path=/api/v2/auth; Expires=…',
        'oauth_verifier=…; Path=/api/v2/auth; Expires=…',
        'accessToken=…; Max-Age=604800; Path=/; Expires=…; HttpOnly; SameSite=Lax',
        'refreshToken=…; Max-Age=604800; Path=/api/v2/auth; Expires=…; HttpOnly; SameSite=Lax',
        'oauth_next=…; Path=/api/v2/auth; Expires=…',
      ]);
      expect(tab.cookies()).toEqual(['accessToken /', 'refreshToken /api/v2/auth']);
      // 비밀번호 로그인과 같은 쿠키 옵션(같은 setTokenCookies)
      const password = await browser(base).login('jaehoon');
      for (const name of ['accessToken', 'refreshToken']) {
        expect(cookieShape(cookieLine(callback, name))).toBe(cookieShape(cookieLine(password, name)));
      }
      const me = await tab.get('/api/v2/auth/me');
      expect(me.status).toBe(200);
      expect(me.body.data.username).toBe('minji.kim');
      const rows = await sessionsOf(me.body.data.id);
      expect(rows).toHaveLength(1);
      expect(rows[0].refresh_token_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(tab.cookie('refreshToken').split('.')[0]).toBe(rows[0].id);
      expect((await tab.post('/api/v2/auth/reissue')).status).toBe(200);
      expect((await tab.get('/api/v2/posts?limit=1')).status).toBe(200);
      expect((await tab.post('/api/v2/auth/logout')).status).toBe(200);
      expect(await sessionsOf(me.body.data.id)).toEqual([]);
    });
  }, 30_000);

  it('🔴 ?next= — 우리 화면 안의 경로면 그곳으로, 아니면 피드로(https://evil.example/x · //evil.example · /.//evil.example)', async () => {
    await freshGate();
    await withServer(stepDir(7), async ({ base }) => {
      const cases = [
        ['/jaehoon', '/jaehoon'],
        ['/jaehoon/saved?tab=1', '/jaehoon/saved?tab=1'],
        ['https://evil.example/x', '/'],
        ['//evil.example', '/'],
        ['/.//evil.example', '/'],
        ['javascript:alert(1)', '/'],
      ];
      for (const [next, expected] of cases) {
        const tab = browser(base);
        const { callback } = await googleLogin(tab, { next });
        expect([next, callback.status, callback.location]).toEqual([next, 302, expected]);
        expect(tab.cookies()).toEqual(['accessToken /', 'refreshToken /api/v2/auth']);
      }
    });
  }, 30_000);

  it('🔴 고친 state · 동의 화면에서 거부 · 쿠키 없이 온 콜백 → 302 /login?error=SOCIAL_LOGIN_FAILED · sessions 행이 안 생긴다', async () => {
    await freshGate();
    await withServer(stepDir(7), async ({ base }) => {
      const before = await count('sessions');
      expect((await googleLogin(browser(base), { tamper: 'forged' })).callback.location).toBe(LOGIN_FAILED_PAGE);
      expect((await googleLogin(browser(base), { fresh: true })).callback.location).toBe(LOGIN_FAILED_PAGE);
      google.state.mode = 'deny';
      const denied = await googleLogin(browser(base));
      expect(denied.callback.status).toBe(302);
      expect(denied.callback.location).toBe(LOGIN_FAILED_PAGE);
      expect(await count('sessions')).toBe(before);
      expect(await count('social_accounts')).toBe(0);
    });
  }, 30_000);

  it('🔴 이미 가입한 이메일 → 302 /login?error=EMAIL_TAKEN · 행 수 그대로 · 터미널에 에러를 찍지 않는다(우리가 던진 에러)', async () => {
    await freshGate();
    await withServer(stepDir(7), async ({ base, tail }) => {
      const [users, socials, sessions] = [await count('users'), await count('social_accounts'), await count('sessions')];
      const res = await asGoogle(base, { sub: '4001', email: 'yuna@example.com' });
      expect(res.status).toBe(302);
      expect(res.location).toBe('/login?error=EMAIL_TAKEN');
      expect([await count('users'), await count('social_accounts'), await count('sessions')]).toEqual([users, socials, sessions]);
      await sleep(100);
      expect(tail()).not.toContain('ConflictError');
    });
  }, 30_000);

  it('🔴 토큰 교환 실패(비밀값 거절) → 302 /login?error=SOCIAL_LOGIN_FAILED + 터미널에 TokenError', async () => {
    await freshGate();
    await withServer(stepDir(7), async ({ base, tail }) => {
      google.state.clientSecret = 'another-secret';
      const res = await asGoogle(base);
      expect(res.status).toBe(302);
      expect(res.location).toBe(LOGIN_FAILED_PAGE);
      await sleep(100);
      expect(tail()).toContain('TokenError: Unauthorized');
      expect(await count('social_accounts')).toBe(0);
    });
  }, 30_000);

  it('🔴 405 는 그대로 JSON — 구글 주소 둘의 에러 미들웨어가 받지 않는다', async () => {
    await withServer(stepDir(7), async ({ base }) => {
      for (const path of ['/api/v2/auth/google', '/api/v2/auth/google/callback']) {
        const res = await browser(base).post(path, {});
        expect([path, res.status, res.headers.get('allow'), res.body.error?.code]).toEqual([path, 405, 'GET', 'METHOD_NOT_ALLOWED']);
      }
    });
  }, 30_000);

  it('🔴 소셜로만 가입한 사람의 이름으로 비밀번호 로그인을 보내면 401 LOGIN_FAILED — 없는 사람과 같은 본문', async () => {
    await freshGate();
    await withServer(stepDir(7), async ({ base }) => {
      await asGoogle(base);
      const social = await browser(base).login('minji.kim', 'anything1234');
      const nobody = await browser(base).login('nobody', 'anything1234');
      expect(social.status).toBe(401);
      expect(social.body).toEqual({ error: { code: 'LOGIN_FAILED', message: '사용자 이름이나 비밀번호가 맞지 않아요' } });
      expect(social.body).toEqual(nobody.body);
    });
  }, 30_000);

  it('🔎 옛 주소 /api/auth/google 도 같은 라우터라 열린다 — 시작 302 · 돌아올 주소는 새 주소 · 그대로 로그인까지 간다', async () => {
    await freshGate();
    await withServer(stepDir(7), async ({ base }) => {
      const tab = browser(base);
      const { begin, callback } = await googleLogin(tab, { start: '/api/auth/google' });
      expect(begin.status).toBe(302);
      expect(authorizeQuery(begin.location).query.redirect_uri).toBe(CALLBACK);
      expect(begin.headers.get('deprecation')).toBe('@1796083200');
      expect(callback.status).toBe(302);
      expect(callback.location).toBe('/');
    });
  }, 30_000);

  it('🔎 실패한 뒤 남는 임시 쿠키 — 거부(state 확인 전)면 셋 다 남고, 고친 state 면 oauth_next 만 남는다(10분 뒤 사라지고 다음 시작이 덮어쓴다)', async () => {
    await freshGate();
    await withServer(stepDir(7), async ({ base }) => {
      const tampered = browser(base);
      await googleLogin(tampered, { tamper: 'forged' });
      expect(tampered.cookies()).toEqual(['oauth_next /api/v2/auth']);
      google.state.mode = 'deny';
      const denied = browser(base);
      await googleLogin(denied);
      expect(denied.cookies()).toEqual(['oauth_next /api/v2/auth', 'oauth_state /api/v2/auth', 'oauth_verifier /api/v2/auth']);
    });
  }, 30_000);
});

describe('축 ⑦-c .env 의 값이 하나씩 빠지면', () => {
  it('🔎 GOOGLE_CLIENT_SECRET 만 빠지면 서버는 뜨고 시작도 302 — 토큰 주소에 빈 client_secret 이 가서 콜백이 /login?error=SOCIAL_LOGIN_FAILED', async () => {
    await freshGate();
    const dir = studentDir(stepDir(7), (d) => useFakeGoogle(d, google));
    const srv = await start(dir, { without: ['GOOGLE_CLIENT_SECRET'] });
    try {
      const { begin, callback } = await googleLogin(browser(SITE));
      expect(begin.status).toBe(302);
      expect(callback.location).toBe(LOGIN_FAILED_PAGE);
      expect(google.state.log.token[0].body.client_secret).toBe('');
      await sleep(100);
      expect(srv.tail()).toContain('TokenError: Unauthorized');
    } finally {
      await stop(srv);
    }
  }, 30_000);
});

describe('축 ⑦-b 에러 미들웨어의 차례', () => {
  it('🔎 router.use(\'/google\', socialFailed) 를 router.all 줄들 «아래» 로 내리면 405 까지 잡아 302 /login?error=METHOD_NOT_ALLOWED 로 바꾼다 — 그래서 라우트 둘 바로 아래에 둔다', async () => {
    const line = "router.use('/google', authController.socialFailed);\n";
    await withServer(stepDir(7), async ({ base }) => {
      const res = await browser(base).post('/api/v2/auth/google', {});
      expect(res.status).toBe(302);
      expect(res.location).toBe('/login?error=METHOD_NOT_ALLOWED');
    }, {
      edit: (d) => {
        replaceIn(d, 'routes/auth.js', line, '');
        replaceIn(d, 'routes/auth.js', "router.all('/google/callback', allowOnly('GET'));\n", `router.all('/google/callback', allowOnly('GET'));\n${line}`);
      },
    });
  }, 30_000);
});

/** 판정 DB 하나에 두 판을 나란히 띄운다. */
const withTwo = async (fromA, fromB, fn) => {
  const a = studentDir(fromA);
  const b = studentDir(fromB, (d) => useFakeGoogle(d, google));
  const srvA = await start(a, { port: OLD_PORT });
  try {
    const srvB = await start(b);
    try {
      await fn(`http://localhost:${OLD_PORT}`, SITE);
    } finally {
      await stop(srvB);
    }
  } finally {
    await stop(srvA);
  }
};
const claimsOf = (token) => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());

describe('축 ⑧ 리팩터링 — 비밀번호 로그인은 code/p3-44 와 같다(startSession 으로 뺐을 뿐)', () => {
  it('🔴 새 주소·옛 주소의 로그인 성공·실패 — 상태 코드 · 본문 · 쿠키 옵션 · 헤더 · 토큰에 담긴 이름이 같다', async () => {
    await freshGate();
    await withTwo(refDir('code/p3-44'), stepDir(7), async (before, after) => {
      const cases = [
        ['/api/v2', 'jaehoon', 'jaehoon1234'],
        ['/api/v2', 'jaehoon', 'wrong-password'],
        ['/api/v2', 'nobody', 'anything1234'],
        ['/api', 'seoyeon', 'seoyeon1234'],
        ['/api', 'seoyeon', 'nope'],
      ];
      for (const [prefix, username, password] of cases) {
        const [x, y] = [await browser(before).login(username, password, prefix), await browser(after).login(username, password, prefix)];
        const view = (r) => ({
          status: r.status,
          body: r.body,
          cookies: r.setCookies.map(cookieShape),
          deprecation: r.headers.get('deprecation'),
          contentType: r.headers.get('content-type'),
          cacheControl: r.headers.get('cache-control'),
        });
        expect([prefix, username, view(y)]).toEqual([prefix, username, view(x)]);
        const token = (r) => r.setCookies.find((l) => l.startsWith('accessToken='))?.split(';')[0].slice('accessToken='.length);
        if (x.status === 200) {
          const [cx, cy] = [claimsOf(token(x)), claimsOf(token(y))];
          expect(Object.keys(cy).sort()).toEqual(Object.keys(cx).sort());
          expect([cy.sub, cy.role, cy.exp - cy.iat]).toEqual([cx.sub, cx.role, cx.exp - cx.iat]);
        }
      }
    });
  }, 60_000);
});

describe('축 ⑨ 틀린 판 넷이 판정에 걸린다', () => {
  it('🔴 store(req, ...rest) 로 받은 저장소 — 시작은 멀쩡해 보이지만(challenge 있음) verifier 가 «undefined» 로 저장돼 콜백이 /login?error=SOCIAL_LOGIN_FAILED', async () => {
    await freshGate();
    const run = async (edit) => {
      let seen;
      await withServer(stepDir(7), async ({ base }) => {
        google.reset();
        const tab = browser(base);
        const { begin, callback } = await googleLogin(tab);
        const [token] = google.state.log.token;
        seen = { challenge: Boolean(authorizeQuery(begin.location).query.code_challenge), location: callback.location, verifier: token?.body.code_verifier };
      }, { edit });
      return seen;
    };
    const right = await run();
    expect(right).toMatchObject({ challenge: true, location: '/' });
    const wrong = await run((d) => replaceIn(d, 'strategies/stateStore.js', '  store(req, verifier, state, meta, callback) {\n',
      '  store(req, ...rest) {\n    const callback = rest.pop();\n    const [verifier] = rest;\n'));
    expect(wrong).toEqual({ challenge: true, location: LOGIN_FAILED_PAGE, verifier: 'undefined' });
  }, 60_000);

  it('🔴 verify 가 쿠키를 안 지우는 판 — 로그인한 뒤에도 oauth_state·oauth_verifier 가 남는다', async () => {
    await freshGate();
    const run = async (edit) => {
      let left;
      await withServer(stepDir(7), async ({ base }) => {
        const tab = browser(base);
        expect((await googleLogin(tab)).callback.location).toBe('/');
        left = tab.cookies();
      }, { edit });
      return left;
    };
    expect(await run()).toEqual(['accessToken /', 'refreshToken /api/v2/auth']);
    const wrong = await run((d) => {
      replaceIn(d, 'strategies/stateStore.js', "    req.res.clearCookie('oauth_state', { path: tempCookie.path });\n", '');
      replaceIn(d, 'strategies/stateStore.js', "    req.res.clearCookie('oauth_verifier', { path: tempCookie.path });\n", '');
    });
    expect(wrong).toEqual(['accessToken /', 'oauth_state /api/v2/auth', 'oauth_verifier /api/v2/auth', 'refreshToken /api/v2/auth']);
  }, 60_000);

  it('🔴 emailVerified 를 안 보는 판 — 확인 안 된 이메일이 users.email 에 들어간다', async () => {
    const run = async (edit) => {
      await freshGate();
      let email;
      await withServer(stepDir(7), async ({ base }) => {
        expect((await asGoogle(base, { sub: '6001', email: 'not.mine@example.com', email_verified: false })).location).toBe('/');
        [{ email }] = await gate("SELECT email FROM users WHERE username = 'not.mine'");
      }, { edit });
      return email;
    };
    expect(await run()).toBeNull();
    expect(await run((d) => replaceIn(d, 'services/userService.js', '    email: emailVerified ? email : undefined,\n', '    email,\n'))).toBe('not.mine@example.com');
  }, 60_000);

  it('🔴 이메일로 사람을 찾아 잇는 판 — 같은 이메일을 댄 구글 계정이 yuna 로 로그인된다(확인 안 된 이메일이어도)', async () => {
    const run = async (edit, over) => {
      await freshGate();
      let who;
      await withServer(stepDir(7), async ({ base }) => {
        google.state.profile = profileOf(over);
        const tab = browser(base);
        const { callback } = await googleLogin(tab);
        who = callback.location === '/' ? (await tab.get('/api/v2/auth/me')).body.data.username : callback.location;
      }, { edit });
      return who;
    };
    const byEmail = (d) => {
      replaceIn(d, 'services/authService.js', '  const user = await userService.findUserBySocialAccount(profile.provider, profile.id);\n',
        '  const user = (await userService.findUserBySocialAccount(profile.provider, profile.id)) ?? (await userService.findUserByEmail(profile.email));\n');
      writeFileSync(join(d, 'services/userService.js'), `${read(join(d, 'services/userService.js'))}\nexport function findUserByEmail(email) {\n  return prisma.user.findUnique({ where: { email }, select: userFields });\n}\n`);
    };
    const unverified = { sub: '7001', email: 'yuna@example.com', email_verified: false, name: '가짜 유나' };
    const verified = { sub: '7002', email: 'yuna@example.com', email_verified: true, name: '김유나' };
    // 바른 판 — 확인 안 된 이메일이면 새 사람(이름이 겹쳐 yuna + 숫자 넷) · 확인된 이메일이면 EMAIL_TAKEN
    expect(await run(undefined, unverified)).toMatch(/^yuna\d{4}$/);
    expect(await run(undefined, verified)).toBe('/login?error=EMAIL_TAKEN');
    expect(await run(byEmail, unverified)).toBe('yuna');
    expect(await run(byEmail, verified)).toBe('yuna');
  }, 90_000);
});

// ── 직접 해보기·과제(lab/p3-45) ────────────────────────────────────────────
// 실습 파일은 이 회차 북마크가 생기면 북마크에서, 아직 없으면 main 에서 읽는다(작업트리가 아니다).
// 🔑 4001·4002 는 남이 쓸 수 있어서 직접 띄우지 않는다 — 사본의 글자 4001→3963 · 4002→3964 만 바꿔 띄운다
//    (실습 서버 · 나눠 주는 인가 서버 `lab/p3-21/auth-server.js` 의 발급자·등록한 돌아올 주소·listen 모두).
const LAB_AS_PORT = 3963;
const LAB_PORT = 3964;
const LAB_BASE = `http://localhost:${LAB_PORT}`;
const LAB_REF = hasRef('refs/heads/code/p3-45') ? 'code/p3-45' : 'main';
const showAt = (ref, rel) => execFileSync('git', ['show', `${ref}:${rel}`], { cwd: P('.'), encoding: 'utf8' });
const LAB = (name) => showAt(LAB_REF, `lab/p3-45/${name}`);
/** 글자를 모두 바꾼다 — 바꿀 글자가 없으면 던진다. */
const swapAll = (text, pairs, what) => pairs.reduce((out, [a, b]) => {
  if (!out.includes(a)) throw new Error(`${what} 에 바꿀 글자가 없다: ${a}`);
  return out.replaceAll(a, b);
}, text);
const toLabPorts = (text, what) => swapAll(text, [['4001', String(LAB_AS_PORT)], ['4002', String(LAB_PORT)]], what);
/** 사본의 한 덩어리를 바꾼다 — 바꿀 글자가 없으면 던진다(틀린 판을 만들 때). */
const edit1 = (text, a, b) => {
  if (!text.includes(a)) throw new Error(`바꿀 글자가 없다: ${a}`);
  return text.replace(a, b);
};

/** 나눠 주는 인가 서버를 포트만 바꿔 띄운다. */
const startAuthServer = () => {
  const dir = studentDir(stepDir(7), (d) => {
    mkdirSync(join(d, 'lab/p3-21'), { recursive: true });
    writeFileSync(join(d, 'lab/p3-21/auth-server.js'), toLabPorts(showAt(LAB_REF, 'lab/p3-21/auth-server.js'), 'auth-server.js'));
  });
  return boot(join(dir, 'lab/p3-21/auth-server.js'), { port: LAB_AS_PORT, cwd: dir, env, ready: `${LAB_AS_PORT}번 포트에서` });
};
/** 실습 서버를 띄운다 — `source` 는 학생 파일(또는 틀린 판) 원문, 포트만 바꾼다. 학생처럼 프로젝트 폴더에서 `node lab/p3-45/…`. */
const withLab = async (file, source, fn) => {
  const dir = studentDir(stepDir(7), (d) => {
    mkdirSync(join(d, 'lab/p3-45'), { recursive: true });
    writeFileSync(join(d, `lab/p3-45/${file}`), toLabPorts(source, file));
  });
  const srv = await boot(join(dir, `lab/p3-45/${file}`), { port: LAB_PORT, cwd: dir, env, ready: `${LAB_PORT}번 포트에서` });
  try {
    await fn({ ...srv, base: LAB_BASE });
  } finally {
    await stop(srv);
  }
};
/** 스크립트를 학생처럼 `node lab/p3-45/…` 로 돌려 출력을 돌려준다. */
const runLabScript = (file, source) => {
  const dir = mkdtempSync(join(tmpdir(), 'p345-script-'));
  dirs.push(dir);
  mkdirSync(join(dir, 'lab/p3-45'), { recursive: true });
  writeFileSync(join(dir, `lab/p3-45/${file}`), source);
  return execFileSync(process.execPath, [`lab/p3-45/${file}`], { cwd: dir, encoding: 'utf8' });
};
/**
 * 인가 서버로 로그인 한 바퀴 — /login → 동의 화면에서 아이디·비밀번호를 넣고 허용(또는 거부) → /callback.
 * 동의 화면은 다른 출처(127.0.0.1)라 쿠키 없이 폼만 보낸다. `tamper` 는 돌아오는 주소의 state 를 바꾼다.
 */
const labLogin = async (tab, username, { decision = 'allow', tamper } = {}) => {
  const begin = await tab.get('/login');
  if (begin.status !== 302) return { begin };
  const auth = new URL(begin.location);
  const form = new URLSearchParams([...auth.searchParams, ['username', username], ['password', `${username}1234`], ['decision', decision]]);
  const consent = await fetch(`${auth.origin}/authorize`, { method: 'POST', body: form, redirect: 'manual' });
  const back = new URL(consent.headers.get('location'));
  if (tamper !== undefined) back.searchParams.set('state', tamper);
  expect(back.origin).toBe(LAB_BASE);
  const callback = await tab.get(`${back.pathname}${back.search}`);
  return { begin, consentStatus: consent.status, callback };
};
/** 같은 서버 안의 302 를 따라간다 — 지나간 주소와 마지막 응답. */
const followIn = async (tab, res) => {
  const path = [];
  let cur = res;
  while (cur.status >= 300 && cur.status < 400 && cur.location.startsWith('/')) {
    path.push(cur.location);
    cur = await tab.get(cur.location);
  }
  return { path, res: cur };
};

/**
 * httpYac CLI 로 `.http` 한 파일을 통째로 보낸다(`--all` — 없으면 묻고 멈춘다).
 * 🚨 execFileSync 로 부르면 이 프로세스의 이벤트 루프가 멈춰 같은 프로세스에 띄운 가짜 구글이 답하지 못한다 — 비동기로 부른다.
 */
const execFileAsync = promisify(execFile);
const httpyac = async (dir, file) => {
  try {
    return (await execFileAsync(P('node_modules/.bin/httpyac'), ['send', file, '--all'], { cwd: dir, encoding: 'utf8' })).stdout;
  } catch (error) {
    return `${error.stdout}${error.stderr}`;
  }
};

describe('축 ⑮ requests/google.http — 시작 주소가 보내는 곳을 리다이렉트를 따라가지 않고 읽는다', () => {
  const GOOGLE_HTTP = '### 구글 로그인 시작\n# @no-redirect\nGET http://localhost:3000/api/v2/auth/google\n';

  it('🔴 파일 글자 그대로', () => {
    expect(showAt(LAB_REF, 'requests/google.http')).toBe(GOOGLE_HTTP);
  });

  it('🔴 Step 7 판에 httpYac 으로 보내면 302 · location 이 (가짜) 구글 인가 주소로 시작한다 · 리다이렉트를 따라가지 않는다', async () => {
    await withServer(stepDir(7), async () => {
      const dir = mkdtempSync(join(tmpdir(), 'p345-http-'));
      dirs.push(dir);
      writeFileSync(join(dir, 'google.http'), swapAll(showAt(LAB_REF, 'requests/google.http'), [['localhost:3000', `localhost:${PORT}`]], 'google.http'));
      const out = await httpyac(dir, 'google.http');
      expect(out).toContain('1 requests processed (1 succeeded)');
      expect(out).toMatch(/^HTTP\/1\.1 302 /m);
      const location = out.match(/^location: (.*)$/m)?.[1];
      expect(location.startsWith(`${google.urls.authorize}?response_type=code&redirect_uri=`)).toBe(true);
      // 따라가지 않았으니 가짜 구글은 요청을 받지 않았다
      expect(google.state.log.authorize).toEqual([]);
      labWrongSeen.googleHttp = out.replace(/(state|code_challenge)=[A-Za-z0-9_-]+/g, '$1=…').replace(/=[A-Za-z0-9_-]{20,}/g, '=…');
    });
  }, 30_000);
});

describe('직접 해보기·과제 — 실습용 인가 서버를 띄운 채', () => {
  let authServer;
  beforeAll(async () => {
    authServer = await startAuthServer();
  }, 30_000);
  afterAll(async () => {
    if (authServer) await stop(authServer);
  });

  describe('축 ⑩ 직접 해보기 1 — 실습용 인가 서버를 제공자로 삼는 전략 lab', () => {
    // 요구사항 4 의 판 — 파일 안의 저장소 대신 수업의 stateStore 를 불러 쓴다(판정이 정답 판에서 만든다).
    const classStore = () => {
      const src = LAB('practice1.js');
      const from = src.indexOf('// 인가 서버를 다녀오는 동안만 쓰는 쿠키');
      const to = src.indexOf('const labStrategy = new OAuth2Strategy(');
      expect(from).toBeGreaterThan(0);
      expect(to).toBeGreaterThan(from);
      return edit1(src.slice(0, from) + src.slice(to), "import OAuth2Strategy from 'passport-oauth2';\n",
        "import OAuth2Strategy from 'passport-oauth2';\nimport { stateStore } from '../../strategies/stateStore.js';\n");
    };

    it('🔴 정답 판 — 허용하면 /callback 200 { provider: lab, id: 10001, email } · 인가 서버에 GET /userinfo 200 · state 를 고치면 403 Forbidden · 거부하면 401 Unauthorized', async () => {
      await withLab('practice1.js', LAB('practice1.js'), async ({ base }) => {
        const before = authServer.tail().length;
        const ok = await labLogin(browser(base), 'jaehoon');
        expect(ok.consentStatus).toBe(303);
        expect(ok.callback.status).toBe(200);
        expect(ok.callback.body).toEqual({ provider: 'lab', id: '10001', email: 'jaehoon@example.com' });
        await sleep(100);
        expect(authServer.tail().slice(before)).toContain('GET /userinfo 200');
        const tampered = await labLogin(browser(base), 'jaehoon', { tamper: 'forged' });
        expect([tampered.callback.status, tampered.callback.body]).toEqual([403, 'Forbidden']);
        const denied = await labLogin(browser(base), 'jaehoon', { decision: 'deny' });
        expect([denied.callback.status, denied.callback.body]).toEqual([401, 'Unauthorized']);
      });
    }, 30_000);

    it('🔴 요구사항 4 — 수업의 stateStore 를 불러 쓰면 쿠키 둘이 Path=/api/v2/auth 라 /callback 에 안 실려 403 Forbidden', async () => {
      await withLab('practice1.js', classStore(), async ({ base }) => {
        const tab = browser(base);
        const { begin, callback } = await labLogin(tab, 'jaehoon');
        expect(begin.setCookies.map(cookieShape)).toEqual([
          'oauth_state=…; Max-Age=600; Path=/api/v2/auth; Expires=…; HttpOnly; SameSite=Lax',
          'oauth_verifier=…; Max-Age=600; Path=/api/v2/auth; Expires=…; HttpOnly; SameSite=Lax',
        ]);
        expect([callback.status, callback.body]).toEqual([403, 'Forbidden']);
      });
    }, 30_000);
  });

  describe('축 ⑬ 과제 [기초] — 인가 서버로 로그인한 사람을 회원으로(1번 dahye 는 이메일로 먼저 가입한 회원)', () => {
    /** 확인 절차를 차례대로 돌려 관찰한 것을 돌려준다 — 정답 판과 틀린 판을 같은 절차로 잰다. */
    const observe = (source) => {
      let seen;
      return withLab('homework1.js', source, async ({ base, tail }) => {
        const out = {};
        const a = browser(base);
        const first = await labLogin(a, 'jaehoon');
        out.firstCallback = [first.callback.status, first.callback.location];
        out.first = (await followIn(a, first.callback)).res.body;
        const b = browser(base);
        out.minji = (await followIn(b, (await labLogin(b, 'minji')).callback)).res.body;
        const c = browser(base);
        out.again = (await followIn(c, (await labLogin(c, 'jaehoon')).callback)).res.body;
        const e = browser(base);
        const dahye = (await labLogin(e, 'dahye')).callback;
        out.dahyeCallback = [dahye.status, dahye.location ?? (typeof dahye.body === 'string' ? dahye.body.split('\n')[0] : dahye.body)];
        out.dahyeEnd = dahye.status === 302 ? (await followIn(e, dahye)).res.body : null;
        if (dahye.status !== 302) out.dahyeRaw = { contentType: dahye.headers.get('content-type'), body: dahye.body };
        const d = browser(base);
        const denied = await labLogin(d, 'jaehoon', { decision: 'deny' });
        out.deniedCallback = [denied.callback.status, denied.callback.location ?? denied.callback.body];
        if (denied.callback.status === 302) {
          out.deniedPage = (await followIn(d, denied.callback)).res.body.includes('<p>로그인하지 못했어요. 다시 시도해 주세요.</p>');
        }
        const notice = async (query) => (await browser(base).get(`/?error=${query}`)).body.match(/<p>(.*?)<\/p>/)?.[1];
        out.constructorNotice = await notice('constructor');
        out.injectedNotice = await notice(encodeURIComponent('<b>x</b>'));
        out.injectedTagInBody = (await browser(base).get(`/?error=${encodeURIComponent('<b>x</b>')}`)).body.includes('<b>x</b>');
        out.members = (await browser(base).get('/members')).body;
        const nobody = await browser(base).get('/me');
        out.nobody = [nobody.status, nobody.body];
        await sleep(100);
        out.terminal = tail();
        seen = out;
      }).then(() => seen);
    };
    const LOGIN_FAILED_TEXT = '로그인하지 못했어요. 다시 시도해 주세요.';
    const RIGHT = {
      firstCallback: [302, '/me'],
      first: { id: 2, nickname: 'jaehoon', email: 'jaehoon@example.com' },
      minji: { id: 3, nickname: 'minji', email: 'minji@example.com' },
      again: { id: 2, nickname: 'jaehoon', email: 'jaehoon@example.com' },
      dahyeCallback: [302, '/?error=EMAIL_TAKEN'],
      dahyeEnd: '<!doctype html><meta charset="utf-8"><p>이미 가입한 이메일이에요.</p><a href="/login">인가 서버로 로그인</a>',
      deniedCallback: [302, '/?error=LOGIN_FAILED'],
      deniedPage: true,
      constructorNotice: LOGIN_FAILED_TEXT,
      injectedNotice: LOGIN_FAILED_TEXT,
      injectedTagInBody: false,
      members: [
        { id: 1, nickname: 'dahye', email: 'dahye@example.com' },
        { id: 2, nickname: 'jaehoon', email: 'jaehoon@example.com' },
        { id: 3, nickname: 'minji', email: 'minji@example.com' },
      ],
      nobody: [401, { message: '로그인이 필요해요' }],
    };
    const withoutTerminal = ({ terminal, ...rest }) => rest;

    it('🔴 정답 판 — jaehoon id 2 · minji id 3 · jaehoon 다시 id 2 · dahye → /?error=EMAIL_TAKEN «이미 가입한 이메일이에요.» · 거부 → LOGIN_FAILED 문장 · 표에 없는 코드(constructor · <b>x</b>)도 LOGIN_FAILED 문장 · 회원 셋 · 쿠키 없으면 401', async () => {
      const seen = await observe(LAB('homework1.js'));
      expect(withoutTerminal(seen)).toEqual(RIGHT);
      // 이메일 겹침은 우리가 아는 실패라 터미널에 찍지 않는다
      expect(seen.terminal).not.toContain('이미 가입한 이메일이에요');
    }, 60_000);

    it('🔴 (a) 이메일로 회원을 찾는 판 — dahye 가 1번 dahye 로 로그인된다', async () => {
      const wrong = edit1(LAB('homework1.js'),
        '  const account = socialAccounts.find((item) => item.provider === provider && item.providerUserId === id);\n\n  if (account) return members.find((member) => member.id === account.memberId);\n',
        '  const found = members.find((member) => member.email === email);\n\n  if (found) return found;\n');
      const seen = await observe(wrong);
      expect(seen.dahyeCallback).toEqual([302, '/me']);
      expect(seen.dahyeEnd).toEqual({ id: 1, nickname: 'dahye', email: 'dahye@example.com' });
      labWrongSeen.hw1ByEmail = withoutTerminal(seen);
    }, 60_000);

    it('🔴 (b) failureRedirect 를 빠뜨린 판 — 거부하면 401 Unauthorized 글자', async () => {
      const seen = await observe(edit1(LAB('homework1.js'), "{ session: false, failureRedirect: '/?error=LOGIN_FAILED' }", '{ session: false }'));
      expect(seen.deniedCallback).toEqual([401, 'Unauthorized']);
    }, 60_000);

    it('🔴 (c) 에러 미들웨어를 빠뜨린 판 — dahye 의 콜백이 Express 기본 에러 응답(500 · HTML)', async () => {
      const src = LAB('homework1.js');
      const from = src.indexOf('// 콜백에서 난 에러는 여기서 받는다');
      const to = src.indexOf('app.get(\'/me\'');
      expect(from).toBeGreaterThan(0);
      expect(to).toBeGreaterThan(from);
      const seen = await observe(src.slice(0, from) + src.slice(to));
      expect(seen.dahyeCallback[0]).toBe(500);
      expect(seen.dahyeRaw.contentType).toBe('text/html; charset=utf-8');
      expect(seen.dahyeRaw.body).toContain('<pre>Error: 이미 가입한 이메일이에요<br>');
      labWrongSeen.hw1NoErrorMiddleware = { dahyeCallback: seen.dahyeCallback, raw: seen.dahyeRaw, terminal: seen.terminal };
    }, 60_000);

    it('🔴 (d) ?error= 의 글자를 그대로 넣는 판 — /?error=<b>x</b> 의 태그가 본문에 그대로 들어간다', async () => {
      const seen = await observe(edit1(LAB('homework1.js'),
        "  const text = Object.hasOwn(NOTICES, error ?? '') ? NOTICES[error] : NOTICES.LOGIN_FAILED;\n",
        '  const text = NOTICES[error] ?? error;\n'));
      expect(seen.injectedNotice).toBe('<b>x</b>');
      expect(seen.injectedTagInBody).toBe(true);
      labWrongSeen.hw1Raw = { constructorNotice: seen.constructorNotice, injectedNotice: seen.injectedNotice };
    }, 60_000);

    it('🔎 (e) Object.hasOwn 없이 표에서 꺼내는 판(NOTICES[error] ?? LOGIN_FAILED) — /?error=constructor 에 Object 의 함수 글자가 나온다', async () => {
      const seen = await observe(edit1(LAB('homework1.js'),
        "  const text = Object.hasOwn(NOTICES, error ?? '') ? NOTICES[error] : NOTICES.LOGIN_FAILED;\n",
        '  const text = NOTICES[error] ?? NOTICES.LOGIN_FAILED;\n'));
      expect(seen.injectedNotice).toBe(LOGIN_FAILED_TEXT);
      expect(seen.constructorNotice).not.toBe(LOGIN_FAILED_TEXT);
      labWrongSeen.hw1NoHasOwn = { constructorNotice: seen.constructorNotice };
    }, 60_000);
  });

  describe('축 ⑭ 과제 [응용] — 처음 온 사람은 별명을 직접 고른다', () => {
    const form = (nickname) => new URLSearchParams({ nickname });
    // homework2.http 둘째 요청의 본문 — 민지의 별명에 jaehoon 의 id·이메일을 함께 싣는다
    const MIXED_BODY = 'nickname=민지&provider=lab&id=10001&email=jaehoon@example.com';
    const observe = (source) => {
      let seen;
      return withLab('homework2.js', source, async ({ base }) => {
        const out = {};
        const a = browser(base);
        const first = await labLogin(a, 'jaehoon');
        out.firstCallback = [first.callback.status, first.callback.location];
        const page = await a.get('/nickname');
        out.formShown = page.status === 200 && page.body.includes('<form method="post" action="/nickname">');
        out.membersAtForm = (await browser(base).get('/members')).body.map((m) => `${m.id} ${m.nickname}`);
        const pendingCookie = a.cookie('labPending');
        const short = await a.send('POST', '/nickname', form('재'));
        out.short = [short.status, short.body.includes('별명은 2자에서 10자까지 쓸 수 있어요')];
        const done = await a.send('POST', '/nickname', form('재훈'));
        out.done = [done.status, done.location];
        out.me = (await followIn(a, done)).res.body;
        const twice = await a.send('POST', '/nickname', form('재훈2'));
        out.sameBrowserAgain = [twice.status, twice.location];
        // 복사해 둔 labPending 값을 그대로 실어 한 번 더 — 서버가 임시 기록을 지웠는지
        const replay = await browser(base).send('POST', '/nickname', form('재훈3'), { Cookie: `labPending=${pendingCookie}` });
        out.copiedCookieAgain = [replay.status, replay.location];
        const b = browser(base);
        const minjiFirst = await labLogin(b, 'minji');
        out.minjiCallback = [minjiFirst.callback.status, minjiFirst.callback.location];
        const taken = await b.send('POST', '/nickname', form('재훈'));
        out.taken = [taken.status, taken.body.includes('이미 쓰고 있는 별명이에요')];
        // 시크릿 창의 minji — 그 창의 labPending 값을 복사해, 본문에 jaehoon 의 id·이메일을 함께 실어 보낸다(homework2.http 둘째 요청)
        const minjiPending = b.cookie('labPending');
        const mixed = await browser(base).send('POST', '/nickname', new URLSearchParams(MIXED_BODY), { Cookie: `labPending=${minjiPending}` });
        out.mixed = [mixed.status, mixed.location];
        out.member3 = (await browser(base).get('/members')).body.find((m) => m.id === 3) ?? null;
        const b2 = browser(base);
        const minjiAgain = (await labLogin(b2, 'minji')).callback;
        out.minjiAgainCallback = [minjiAgain.status, minjiAgain.location];
        out.minjiAgain = minjiAgain.location === '/me' ? (await followIn(b2, minjiAgain)).res.body : null;
        const c = browser(base);
        const again = await labLogin(c, 'jaehoon');
        out.againCallback = [again.callback.status, again.callback.location];
        out.again = (await followIn(c, again.callback)).res.body;
        const e = browser(base);
        const dahye = await labLogin(e, 'dahye');
        out.dahyeCallback = [dahye.callback.status, dahye.callback.location];
        const nobody = await browser(base).get('/nickname');
        out.nobody = [nobody.status, nobody.location];
        out.members = (await browser(base).get('/members')).body.map((m) => `${m.id} ${m.nickname}`);
        seen = out;
      }).then(() => seen);
    };
    const RIGHT = {
      firstCallback: [302, '/nickname'],
      formShown: true,
      membersAtForm: ['1 dahye'],
      short: [400, true],
      done: [302, '/me'],
      me: { id: 2, nickname: '재훈', email: 'jaehoon@example.com' },
      sameBrowserAgain: [302, '/'],
      copiedCookieAgain: [302, '/'],
      minjiCallback: [302, '/nickname'],
      taken: [409, true],
      mixed: [302, '/me'],
      member3: { id: 3, nickname: '민지', email: 'minji@example.com' },
      minjiAgainCallback: [302, '/me'],
      minjiAgain: { id: 3, nickname: '민지', email: 'minji@example.com' },
      againCallback: [302, '/me'],
      again: { id: 2, nickname: '재훈', email: 'jaehoon@example.com' },
      dahyeCallback: [302, '/?error=EMAIL_TAKEN'],
      nobody: [302, '/'],
      members: ['1 dahye', '2 재훈', '3 민지'],
    };

    it('🔴 정답 판 — 처음엔 /nickname 폼(회원은 dahye 하나) · 재 400 · 재훈 → /me id 2 · 같은 브라우저·복사해 둔 labPending 으로 다시 내면 / · minji 재훈 409 → 복사해 둔 labPending 으로 «민지 + jaehoon 의 id·이메일» 본문 → 302 /me · 3번은 민지·minji@example.com · minji 다시 → 폼 없이 /me · jaehoon 다시 → 폼 없이 /me · dahye → /?error=EMAIL_TAKEN · 쿠키 없이 /nickname → /', async () => {
      expect(await observe(LAB('homework2.js'))).toEqual(RIGHT);
    }, 60_000);

    it('🔴 콜백에서 곧바로 회원을 만드는 판 — 폼을 내기 전에 /members 에 jaehoon 이 있다', async () => {
      const wrong = edit1(LAB('homework2.js'), '    const pendingId = randomUUID();\n',
        "    createMember(req.user.pending, req.user.pending.email.split('@')[0]);\n    const pendingId = randomUUID();\n");
      const seen = await observe(wrong);
      expect(seen.membersAtForm).toEqual(['1 dahye', '2 jaehoon']);
      labWrongSeen.early = seen;
    }, 60_000);

    it('🔴 임시 기록을 지우는 두 줄을 다 뺀 판 — 같은 브라우저로 폼을 한 번 더 내면 회원이 하나 더 생긴다', async () => {
      const seen = await observe(edit1(LAB('homework2.js'), "  pendings.delete(req.cookies.labPending);\n  res.clearCookie('labPending');\n", ''));
      expect(seen.sameBrowserAgain).toEqual([302, '/me']);
      expect(seen.members.length).toBeGreaterThan(RIGHT.members.length);
      labWrongSeen.noDelete = seen;
    }, 60_000);

    it('🔴 서버의 pendings.delete 만 뺀 판 — 같은 브라우저 확인은 / 지만, 복사해 둔 labPending 으로 내면 회원이 하나 더 생긴다', async () => {
      const seen = await observe(edit1(LAB('homework2.js'), '  pendings.delete(req.cookies.labPending);\n', ''));
      expect(seen.sameBrowserAgain).toEqual([302, '/']);
      expect(seen.copiedCookieAgain).toEqual([302, '/me']);
      expect(seen.members).toContain('3 재훈3');
      labWrongSeen.recordOnly = seen;
    }, 60_000);

    it('🔴 폼 본문의 provider·id·email 을 믿는 판(createMember({ ...profile, ...req.body }, nickname)) — 3번의 이메일이 jaehoon@example.com 이 된다', async () => {
      const seen = await observe(edit1(LAB('homework2.js'), '  startSession(res, createMember(profile, nickname));\n',
        '  startSession(res, createMember({ ...profile, ...req.body }, nickname));\n'));
      expect(seen.mixed).toEqual([302, '/me']);
      expect(seen.member3).toEqual({ id: 3, nickname: '민지', email: 'jaehoon@example.com' });
      expect(seen).not.toEqual(RIGHT);
      labWrongSeen.trustBody = seen;
    }, 60_000);

    it('🔴 별명을 묻기 전에 이메일 겹침을 안 보는 판 — dahye 가 별명 폼까지 간다', async () => {
      const src = LAB('homework2.js');
      const block = "    // 이메일이 같은 회원이 이미 있으면 별명을 묻기 전에 돌려보낸다.\n    if (members.some((item) => item.email === profile.email)) {\n      done(Object.assign(new Error('이미 가입한 이메일이에요'), { code: 'EMAIL_TAKEN' }));\n      return;\n    }\n\n";
      const seen = await observe(edit1(src, block, ''));
      expect(seen.dahyeCallback).toEqual([302, '/nickname']);
      labWrongSeen.noEmailCheck = { dahyeCallback: seen.dahyeCallback };
    }, 60_000);
  });

  describe('축 ⑭-b homework2.http — 복사해 둔 쿠키로 별명 다시 내기 · 본문에 다른 사람의 id 를 실어 내기(httpYac 으로 실제로 보낸다)', () => {
    const HW2_HTTP = '### 복사해 둔 쿠키로 별명 다시 내기\n# @no-redirect\nPOST http://localhost:4002/nickname\nContent-Type: application/x-www-form-urlencoded\nCookie: labPending=COPIED_PENDING\n\nnickname=재훈3\n\n### 본문에 다른 사람의 id를 함께 실어 별명 내기\n# @no-redirect\nPOST http://localhost:4002/nickname\nContent-Type: application/x-www-form-urlencoded\nCookie: labPending=MINJI_PENDING\n\nnickname=민지&provider=lab&id=10001&email=jaehoon@example.com\n';
    /**
     * 그 판을 띄워 장면 차례대로 — jaehoon 이 재훈으로 가입(그때의 labPending 을 복사) → minji 가 별명 폼까지(그 창의 labPending 을 복사) →
     * 자리표시 둘을 진짜 값으로 바꾼 사본을 httpYac 한 파일 --all 로 보낸다.
     */
    const sendBoth = (source) => {
      let seen;
      return withLab('homework2.js', source, async ({ base, tail }) => {
        const a = browser(base);
        await labLogin(a, 'jaehoon');
        const pending = a.cookie('labPending');
        await a.send('POST', '/nickname', new URLSearchParams({ nickname: '재훈' }));
        const b = browser(base);
        await labLogin(b, 'minji');
        const minjiPending = b.cookie('labPending');
        const dir = mkdtempSync(join(tmpdir(), 'p345-http-'));
        dirs.push(dir);
        writeFileSync(join(dir, 'homework2.http'), swapAll(LAB('homework2.http'), [['4002', String(LAB_PORT)], ['COPIED_PENDING', pending], ['MINJI_PENDING', minjiPending]], 'homework2.http'));
        const mark = tail().length;
        const out = await httpyac(dir, 'homework2.http');
        await sleep(100);
        const second = out.slice(out.indexOf('=== 본문에 다른 사람의 id를 함께 실어 별명 내기 ==='));
        seen = {
          out,
          statuses: [...out.matchAll(/^HTTP\/1\.1 (\d+)/gm)].map((m) => m[1]),
          locations: [...out.matchAll(/^location: (.*)$/gm)].map((m) => m[1]),
          sentCookies: [...out.matchAll(/^cookie: labPending=(.*)$/gm)].map((m) => m[1]),
          secondSentBody: second.split('\n').find((l) => l.startsWith('nickname=')),
          members: (await browser(base).get('/members')).body,
          serverLog: tail().slice(mark),
        };
      }).then(() => seen);
    };

    it('🔴 파일 글자 그대로 — 요청 둘(복사해 둔 쿠키로 재훈3 · MINJI_PENDING 으로 민지 + jaehoon 의 id·이메일)', () => {
      expect(LAB('homework2.http')).toBe(HW2_HTTP);
    });

    it('🔴 정답 판 — 첫 요청 302 / (회원이 안 는다) · 둘째 요청 302 /me 로 3번 민지·minji@example.com / 서버의 pendings.delete 만 뺀 판은 첫 요청이 302 /me 로 3번 «재훈3»', async () => {
      const right = await sendBoth(LAB('homework2.js'));
      expect(right.out).toContain('2 requests processed (2 succeeded)');
      expect(right.statuses).toEqual(['302', '302']);
      expect(right.locations).toEqual(['/', '/me']);
      expect(right.sentCookies).toHaveLength(2);
      for (const value of right.sentCookies) expect(value).toMatch(/^[0-9a-f-]{36}$/);
      expect(right.members).toEqual([
        { id: 1, nickname: 'dahye', email: 'dahye@example.com' },
        { id: 2, nickname: '재훈', email: 'jaehoon@example.com' },
        { id: 3, nickname: '민지', email: 'minji@example.com' },
      ]);
      const recordOnly = await sendBoth(edit1(LAB('homework2.js'), '  pendings.delete(req.cookies.labPending);\n', ''));
      expect(recordOnly.locations).toEqual(['/me', '/me']);
      expect(recordOnly.members.map((m) => `${m.id} ${m.nickname}`)).toEqual(['1 dahye', '2 재훈', '3 재훈3', '4 민지']);
      labWrongSeen.hw2Http = { right: right.out, secondSentBody: right.secondSentBody, recordOnlyMembers: recordOnly.members };
    }, 60_000);

    it('🔎 폼 본문을 믿는 판에 httpYac 으로 보내면 — 서버가 받은 본문의 @·& 와 3번의 이메일', async () => {
      const wrong = edit1(edit1(LAB('homework2.js'), '  startSession(res, createMember(profile, nickname));\n',
        '  startSession(res, createMember({ ...profile, ...req.body }, nickname));\n'),
      "app.post('/nickname', (req, res) => {\n", "app.post('/nickname', (req, res) => {\n  console.log('받은 본문', JSON.stringify(req.body));\n");
      const seen = await sendBoth(wrong);
      expect(seen.locations).toEqual(['/', '/me']);
      expect(seen.members[2]).toEqual({ id: 3, nickname: '민지', email: 'jaehoon@example.com' });
      const received = seen.serverLog.split('\n').filter((l) => l.startsWith('받은 본문 ')).map((l) => JSON.parse(l.slice('받은 본문 '.length)));
      expect(received.at(-1)).toEqual({ nickname: '민지', provider: 'lab', id: '10001', email: 'jaehoon@example.com' });
      labWrongSeen.hw2HttpTrustBody = { secondSentBody: seen.secondSentBody, received, members: seen.members };
    }, 60_000);
  });
});

/** 틀린 판의 관찰 — 보고서용으로 실행 뒤 파일에 남긴다(판정 결과와 무관). */
const labWrongSeen = {};
afterAll(() => {
  if (process.env.P345_DUMP) writeFileSync(process.env.P345_DUMP, JSON.stringify(labWrongSeen, null, 2));
});

describe('축 ⑪ 직접 해보기 2 — 메모리에서 찾거나 만들기', () => {
  const RIGHT = [
    'google 100 → 2번 minji (새로 만듦) 이메일 minji@gmail.com',
    'google 100 → 2번 minji (다시 옴) 이메일 minji@gmail.com',
    'kakao 100 → 3번 kakao (새로 만듦) 이메일 없음',
    'google 200 → 4번 minji2 (새로 만듦) 이메일 없음',
    'google 300 → 이미 가입한 이메일이에요',
    '사람 4명 · 소셜 계정 3개',
  ];
  const run = (source) => runLabScript('practice2.js', source).trimEnd().split('\n');

  it('🔴 정답 판 출력 6줄', () => {
    expect(run(LAB('practice2.js'))).toEqual(RIGHT);
  });

  it('🔴 시작 코드는 정답 판에서 findOrCreate 본문(과 그 위 주석 한 줄)만 다르다 · 그대로 돌리면 다섯 줄이 «Cannot destructure property \'user\' …»', () => {
    const start = read(SNAP('practice2-start.practice2.js'));
    const right = LAB('practice2.js');
    const body = (text) => {
      const from = text.indexOf('function findOrCreate(');
      return [text.slice(0, from), text.slice(text.indexOf('\n}\n', from))];
    };
    const [startHead, startTail] = body(start);
    const [rightHead, rightTail] = body(right);
    expect(startTail).toBe(rightTail);
    expect(startHead).toBe(rightHead.replace('// 소셜 계정으로 우리 사람을 찾고, 처음 온 사람이면 만든다.\n',
      '// 소셜 계정으로 우리 사람을 찾고, 처음 온 사람이면 만든다.\n// 돌려주는 값은 { user, created } — 새로 만들었으면 created 가 true 다.\n'));
    expect(start.slice(start.indexOf('function findOrCreate('), start.indexOf('\n}\n', start.indexOf('function findOrCreate(')) + 3))
      .toBe('function findOrCreate({ provider, id, email, emailVerified }) {\n  // 여기를 채워요.\n}\n');
    const lines = run(start);
    expect(lines).toHaveLength(6);
    for (const line of lines.slice(0, 5)) expect(line).toMatch(/ → Cannot destructure property 'user' of /);
    expect(lines[5]).toBe('사람 1명 · 소셜 계정 0개');
    labWrongSeen.practice2Start = lines;
  });

  it('🔴 틀린 판 셋이 확인의 6줄과 어긋난다 — (a) 이메일로 먼저 찾기 (b) id 만으로 찾기 (c) 확인 안 된 이메일 넣기', () => {
    const right = LAB('practice2.js');
    const byEmail = run(edit1(right, '  // 찾는 기준은 «어느 제공자의 누구» 뿐이다 — 이메일로 찾지 않는다.\n',
      '  const sameEmail = users.find((user) => user.email === email);\n\n  if (sameEmail) {\n    return { user: sameEmail, created: false };\n  }\n\n'));
    const idOnly = run(edit1(right, 'item.provider === provider && item.providerUserId === id', 'item.providerUserId === id'));
    const unverified = run(edit1(right, 'const verifiedEmail = emailVerified ? email : undefined;', 'const verifiedEmail = email;'));
    for (const lines of [byEmail, idOnly, unverified]) expect(lines).not.toEqual(RIGHT);
    expect(idOnly[2]).toBe('kakao 100 → 2번 minji (다시 옴) 이메일 minji@gmail.com');
    expect(unverified[3]).toBe('google 200 → 4번 minji2 (새로 만듦) 이메일 minji@naver.com');
    labWrongSeen.practice2 = { byEmail, idOnly, unverified };
  });
});

const PRACTICE3_RIGHT = [
  '통과  /jaehoon  →  http://localhost:3001/jaehoon',
  '통과  /jaehoon/saved?tab=1  →  http://localhost:3001/jaehoon/saved?tab=1',
  '거절  https://evil.example/login  →  https://evil.example/login',
  '거절  //evil.example/login  →  http://evil.example/login',
  '거절  /\\evil.example/login  →  http://evil.example/login',
  '거절  javascript:alert(1)  →  javascript:alert(1)',
];

describe('축 ⑫ 직접 해보기 3 — 돌아갈 주소 검사', () => {
  const run = (source) => runLabScript('practice3.js', source).trimEnd().split('\n');

  it('🔴 시작 코드(startsWith 만 보는 판)는 //evil.example/login · /\\evil.example/login 을 통과시키고 둘 다 http://evil.example/login 으로 간다', () => {
    const start = read(SNAP('practice3-start.practice3.js'));
    expect(start).toBe(edit1(LAB('practice3.js'),
      "  if (typeof next !== 'string' || !URL.canParse(next, SITE)) return false;\n\n  return new URL(next, SITE).origin === SITE;\n",
      "  return typeof next === 'string' && next.startsWith('/');\n"));
    const lines = run(start);
    expect(lines.filter((line) => line.startsWith('통과') && line.endsWith('→  http://evil.example/login'))).toEqual([
      '통과  //evil.example/login  →  http://evil.example/login',
      '통과  /\\evil.example/login  →  http://evil.example/login',
    ]);
    labWrongSeen.practice3Start = lines;
  });

  it('🔴 정답 판 출력 6줄 — 통과 둘 · 거절 넷', () => {
    const lines = run(LAB('practice3.js'));
    expect(lines).toEqual(PRACTICE3_RIGHT);
    expect(lines.filter((line) => line.startsWith('통과'))).toHaveLength(2);
    expect(lines.filter((line) => line.startsWith('거절'))).toHaveLength(4);
  });
});
