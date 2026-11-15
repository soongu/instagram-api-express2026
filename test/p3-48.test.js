// p3-48 「한 사람, 여러 로그인 방법 — 연결하기 · 거절 둘 · 목록과 끊기 · 마지막 로그인 방법 · 동시에 끊기」 게이트 — 백엔드
// 내부 검증 전용 — 교안에 한 줄도 인용하지 않는다.
//
// `7-express-auth` 열셋째 회차다(`curriculum.md` 「`p3-48` 착수 결정」 ①~⑧).
// 수업 백엔드는 Step 2~7 에서 고친다(Step 1·8 은 백엔드 코드 변경 없음).
// Step 마다의 판은 커밋 제목의 «(Step N)» 표식으로 꺼낸다(같은 표식이 여럿이면 가장 뒤 커밋). Step 1 은 `code/p3-47` 이다.
// 🔑 진짜 구글·카카오·네이버에는 요청을 보내지 않는다 — 학생 파일 사본의 제공자 주소(셋씩)만 가짜 제공자로 바꿔 띄운다.
// 🔑 판정에는 화면이 없으니 백엔드 주소를 화면 주소(`SITE_URL`)로 삼는다 — 콜백이 곧바로 백엔드로 돌아온다.
// 🔑 짓는 동안 `P348_WT=N` 을 주면 Step N 의 판을 커밋 대신 작업트리에서 읽는다(Red 를 실제 동작으로 보려고).
// 🔑 포트 — 수업 백엔드 3990 · 가짜 구글 3991 · 가짜 카카오 3992 · 가짜 네이버 3993 · 실습 서버 3994~3999.
// 🔑 DB — `p348_` 로 시작하는 것만 만들고 지운다.
//
// 축 ① Step 1(code/p3-47) — 로그인한 채 다른 제공자에 다녀오면 그 제공자의 사람으로 바뀐다
// 축 ② Step 2 — verify 함수는 프로필만 넘긴다 · code/p3-47 과 같은 요청이 같은 결과
// 축 ③ Step 3 — 연결하기(연결 표시 쿠키 · 같은 콜백) · 실패 Location · Step 3 판의 «남에게 이어진 계정»
// 축 ④ Step 4 — 거절 둘 · 제공자마다 하나(@@unique) · 마이그레이션 전후 SQL
// 축 ⑤ Step 5 — 목록 · 끊기 · 404 · 401 · 끊은 뒤 로그인
// 축 ⑥ Step 6 — 마지막 로그인 방법 409 · 비밀번호 있는 사람 · 둘 있는 사람
// 축 ⑦ Step 7 — 동시 요청 30번(판 다섯) · unlink-race.js
// 축 ⑧ 학생 파일 차이 — Step 마다 바뀐 학생 파일 목록(교안 인용 블록 대조는 교안 집필 뒤에 더한다)
// 축 ⑨ 실습·과제(lab/p3-48)
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { readFileSync, mkdtempSync, mkdirSync, rmSync, cpSync, symlinkSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import pg from 'pg';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { boot } from './helpers/boot.js';
import { roundDir } from './helpers/round.js';
import { startFakeGoogle, DEFAULT_PROFILE as GOOGLE_PROFILE } from './helpers/fake-google.js';
import { startFakeKakao, KAKAO_EMAIL_VALID } from './helpers/fake-kakao.js';
import { startFakeNaver, DEFAULT_NAVER_PROFILE } from './helpers/fake-naver.js';

// p3-37 Step 8(2026-11-15) — 새 주소의 실패 응답에는 path(쿼리를 뺀 주소)와 timestamp(ISO UTC)도 실린다.
const v2Error = (code, message) => ({ error: { code, message, path: expect.stringMatching(/^\/api\/v2\/[^?]*$/), timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/) } });

const ROOT = new URL('../', import.meta.url);
const P = (rel) => new URL(rel, ROOT).pathname;
const read = (path) => readFileSync(path, 'utf8');
const ADMIN = { host: 'localhost', port: 5432, database: 'postgres', user: 'postgres', password: 'postgres' };
const TPL_DB = 'p348_tpl';
const GATE_DB = 'p348_gate';
const GATE_URL = `postgresql://postgres:postgres@localhost:5432/${GATE_DB}`;
const PORT = 3990;
const GOOGLE_PORT = 3991;
const KAKAO_PORT = 3992;
const NAVER_PORT = 3993;
const SITE = `http://localhost:${PORT}`;

// 이 회차 북마크 `code/p3-48` 을 풀어서 읽는다(없으면 작업트리 — 이 회차를 짓는 동안).
const ROUND = roundDir('code/p3-48');

const SECRET = 'q2Xh0v9bGm4RkT7sYp1wLc8nZf3uJd6eHa5iVo0rQyE';
const GOOGLE_ENV = { GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret', SITE_URL: SITE };
const KAKAO_ENV = { KAKAO_CLIENT_ID: 'test-kakao', KAKAO_CLIENT_SECRET: 'test-kakao-secret' };
const NAVER_ENV = { NAVER_CLIENT_ID: 'test-naver', NAVER_CLIENT_SECRET: 'test-naver-secret' };
const env = { DATABASE_URL: GATE_URL, CORS_ORIGIN: 'http://localhost:3001', JWT_SECRET: SECRET, ...GOOGLE_ENV, ...KAKAO_ENV, ...NAVER_ENV };
const STUDENT_FILES = ['app.js', 'db.js', 'errors.js', 'responses.js', 'routes', 'controllers', 'services', 'middlewares', 'schemas', 'strategies', 'docs', 'package.json', 'requests', 'seed.js', 'data', 'prisma', 'prisma.config.js', '.env.example'];
const PROVIDERS = ['google', 'kakao', 'naver'];

// 학생 파일 속 진짜 제공자 주소(셋씩) — 판정은 이 글자만 가짜 제공자 주소로 바꾼다.
const REAL = {
  google: {
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    userinfo: 'https://openidconnect.googleapis.com/v1/userinfo',
  },
  kakao: {
    authorize: 'https://kauth.kakao.com/oauth/authorize',
    token: 'https://kauth.kakao.com/oauth/token',
    userinfo: 'https://kapi.kakao.com/v2/user/me',
  },
  naver: {
    authorize: 'https://nid.naver.com/oauth2/authorize',
    token: 'https://nid.naver.com/oauth2/token',
    userinfo: 'https://openapi.naver.com/v1/nid/me',
  },
};
const REAL_HOSTS = /google\.com|googleapis\.com|kakao\.com|naver\.com/;

const hasRef = (ref) => {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', ref], { cwd: P('.'), stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
};
const LINE = hasRef('refs/heads/code/p3-48') ? 'code/p3-48' : 'main';
const WT = process.env.P348_WT ? Number(process.env.P348_WT) : null;
const commitOf = (n) => {
  const log = execFileSync('git', ['log', '--format=%H %s', `code/p3-47..${LINE}`], { cwd: P('.'), encoding: 'utf8' });
  const hits = log.split('\n').filter((l) => / feat\(p3-48\): /.test(l) && l.endsWith(`(Step ${n})`));
  if (hits.length === 0) throw new Error(`(Step ${n}) 커밋이 없다`);
  return hits[0].split(' ')[0];
};
const dirs = [];
const refDirs = new Map();
/** 커밋(또는 브랜치) 하나를 임시 폴더에 풀어 둔다. */
const refDir = (ref) => {
  if (refDirs.has(ref)) return refDirs.get(ref);
  const dir = mkdtempSync(join(tmpdir(), 'p348-ref-'));
  const tar = execFileSync('git', ['archive', '--format=tar', ref], { cwd: P('.'), maxBuffer: 1 << 28 });
  execFileSync('tar', ['-x', '-C', dir], { input: tar });
  dirs.push(dir);
  const at = (rel) => join(dir, rel);
  refDirs.set(ref, at);
  return at;
};
/** Step N 의 판 — Step 1 은 지난 회차 북마크 그대로다. */
const stepDir = (n) => {
  if (n === WT) return (rel) => P(rel);
  return n === 1 ? refDir('code/p3-47') : refDir(commitOf(n));
};
/** Step N 의 커밋 — 작업트리에서 읽는 Step 이면 null(git diff 가 작업트리와 비교한다). */
const stepRef = (n) => (n === WT ? null : n === 1 ? 'code/p3-47' : commitOf(n));
const showAt = (ref, rel) => execFileSync('git', ['show', `${ref}:${rel}`], { cwd: P('.'), encoding: 'utf8' });

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
const onDb = async (name, sql, params) => {
  const client = new pg.Client({ ...ADMIN, database: name });
  await client.connect();
  try {
    return (await client.query(sql, params)).rows;
  } finally {
    await client.end();
  }
};
const gate = (sql, params) => onDb(GATE_DB, sql, params);
/** 판정 DB 를 템플릿에서 새로 만든다. `from` 판에 템플릿에 없는 마이그레이션이 있으면(Step 4 부터) 그것도 얹는다. */
const BASE_MIGRATIONS = new Set();
const newMigrations = (from) => readdirSync(from('prisma/migrations'))
  .filter((name) => name !== 'migration_lock.toml' && !BASE_MIGRATIONS.has(name)).sort();
const freshGate = async (from = stepDir(1)) => {
  await admin(async (client) => {
    await kick(client, GATE_DB);
    await client.query(`DROP DATABASE IF EXISTS ${GATE_DB}`);
    await kick(client, TPL_DB);
    await client.query(`CREATE DATABASE ${GATE_DB} TEMPLATE ${TPL_DB}`);
  });
  for (const name of newMigrations(from)) await gate(read(from(`prisma/migrations/${name}/migration.sql`)));
};
const count = async (table) => Number((await gate(`SELECT count(*) AS n FROM ${table}`))[0].n);
const userIdOf = async (username) => (await gate('SELECT id FROM users WHERE username = $1', [username]))[0]?.id;
const sessionsOf = async (userId) => Number((await gate('SELECT count(*) AS n FROM sessions WHERE user_id = $1', [userId]))[0].n);
const socialRows = () => gate('SELECT user_id, provider, provider_user_id FROM social_accounts ORDER BY id');
const socialOf = async (userId) => (await gate('SELECT provider, provider_user_id FROM social_accounts WHERE user_id = $1 ORDER BY id', [userId]))
  .map((row) => `${row.provider}:${row.provider_user_id}`);

const replaceIn = (dir, rel, a, b) => {
  const text = read(join(dir, rel));
  if (text.split(a).length !== 2) throw new Error(`${rel} 에 바꿀 글자가 없거나 여럿이다: ${a}`);
  writeFileSync(join(dir, rel), text.replace(a, b));
};
const fakes = {};
/** 제공자 주소만 가짜 제공자로 바꾼다 — 주소는 `strategies/{제공자}.js` 한 파일에 셋이 다 있다. */
const useFakes = (dir) => {
  for (const provider of PROVIDERS) {
    const rel = `strategies/${provider}.js`;
    let text = read(join(dir, rel));
    for (const key of ['authorize', 'token', 'userinfo']) {
      if (!text.includes(REAL[provider][key])) throw new Error(`${rel} 에 바꿀 글자가 없다: ${REAL[provider][key]}`);
      text = text.replaceAll(REAL[provider][key], fakes[provider].urls[key]);
    }
    if (REAL_HOSTS.test(text)) throw new Error(`${rel} 에 진짜 제공자 주소가 남았다`);
    writeFileSync(join(dir, rel), text);
  }
  for (const name of readdirSync(join(dir, 'strategies'))) {
    if (REAL_HOSTS.test(read(join(dir, 'strategies', name)))) throw new Error(`strategies/${name} 에 진짜 제공자 주소가 남았다`);
  }
};

const studentDir = (from, edit) => {
  const dir = mkdtempSync(join(tmpdir(), 'p348-srv-'));
  for (const name of STUDENT_FILES) {
    if (existsSync(from(name))) cpSync(from(name), join(dir, name), { recursive: true });
  }
  symlinkSync(P('node_modules'), join(dir, 'node_modules'));
  if (edit) edit(dir);
  dirs.push(dir);
  return dir;
};
const start = (dir, { port = PORT, extraEnv = {} } = {}) => {
  const all = { ...env, ...extraEnv, PORT: String(port) };
  return boot(join(dir, 'app.js'), { port, cwd: dir, env: all, ready: `${port}번 포트에서` });
};
const stop = (srv) => Promise.race([srv.stop(), sleep(500)]);
/** 그 판의 학생 파일 사본을 띄운다 — 제공자 주소를 가짜 제공자로 바꾼 사본. `edit` 은 가짜로 바꾼 «뒤» 에 돈다. */
const withServer = async (from, fn, { edit, port = PORT, extraEnv } = {}) => {
  const dir = studentDir(from, (d) => {
    useFakes(d);
    if (edit) edit(d);
  });
  const srv = await start(dir, { port, extraEnv });
  try {
    return await fn({ ...srv, dir, base: `http://localhost:${port}` });
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
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    // path 가 긴 쿠키를 앞에 싣는다(RFC 6265 §5.4)
    const carried = [...jar.values()].filter((c) => pathMatches(c.path, path)).sort((a, b) => b.path.length - a.path.length);
    if (carried.length > 0 && !headers.Cookie) headers.Cookie = carried.map((c) => `${c.name}=${c.value}`).join('; ');
    const res = await fetch(`${base}${path}`, { method, headers, redirect: 'manual', body: body === undefined ? undefined : JSON.stringify(body) });
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
    del: (path, extra) => send('DELETE', path, undefined, extra),
    login: (username, password = `${username}1234`) => send('POST', '/api/v2/auth/login', { username, password }),
    logout: () => send('POST', '/api/v2/auth/logout'),
    /** 쿠키 하나를 단지에 직접 넣는다. */
    put: (name, value, path) => jar.set(`${name} ${path}`, { name, value, path }),
    drop: (name, path) => jar.delete(`${name} ${path}`),
    cookie: (name) => [...jar.values()].find((c) => c.name === name)?.value,
    cookies: () => [...jar.values()].map((c) => `${c.name} ${c.path}`).sort(),
  };
};

const cookieNames = (res) => res.setCookies.map((line) => line.slice(0, line.indexOf('=')));
/** 지운다는 쿠키 줄의 이름 — `Expires=Thu, 01 Jan 1970` 인 줄. */
const clearedNames = (res) => res.setCookies.filter((line) => /Expires=Thu, 01 Jan 1970/.test(line)).map((line) => line.slice(0, line.indexOf('=')));
/** 쿠키 줄에서 값과 날짜만 지운다 — 옵션 글자를 비교하려고. */
const cookieShape = (line) => line.replace(/^([^=]+)=[^;]+/, '$1=…').replace(/Expires=(?!Thu, 01 Jan 1970)[^;]+/, 'Expires=…');
const tokenOf = (value) => JSON.parse(Buffer.from(value.split('.')[1], 'base64url').toString());
const LOGIN_FAILED_PAGE = '/login?error=SOCIAL_LOGIN_FAILED';
/** 교안에 인용할 실측 글자 — `P348_SEEN=경로` 를 주면 파일로 남긴다(보고용). */
const seen = {};
const scrub = (text, dir) => text.replaceAll(`/private${dir}`, '~/instagram-api').replaceAll(dir, '~/instagram-api').replaceAll(P('.'), '~/instagram-api/').replace(/\d+\.\d+ms/g, 'N.Nms')
  .replace(/(code|state)=[A-Za-z0-9_-]+/g, '$1=…');

/** 시작 주소를 연다 — 브라우저처럼 그 탭의 쿠키 단지로. `link` 면 연결 시작 주소. */
const begin = (tab, provider, { next, link = false } = {}) => {
  const path = `/api/v2/auth/${provider}${link ? '/link' : ''}`;
  return tab.get(next === undefined ? path : `${path}?next=${encodeURIComponent(next)}`);
};
/** (가짜) 제공자의 동의를 지나 돌아올 주소(경로 + 쿼리)를 받아 둔다 — 아직 우리 서버로 돌아가지 않는다. */
const consentOf = async (started) => {
  const consent = await fetch(started.location, { redirect: 'manual' });
  const back = new URL(consent.headers.get('location'));
  expect(back.origin).toBe(SITE);
  return `${back.pathname}${back.search}`;
};
/** 소셜 로그인(또는 연결) 한 바퀴 — 시작 → (가짜) 제공자의 동의 → 콜백. `between` 은 돌아오기 직전에 부른다. */
const social = async (tab, provider, { next, link = false, tamper, between } = {}) => {
  const started = await begin(tab, provider, { next, link });
  if (started.status !== 302 || !started.location.startsWith('http')) return { started };
  let back = await consentOf(started);
  if (tamper !== undefined) back = back.replace(/state=[^&]+/, `state=${tamper}`);
  if (between) await between();
  const callback = await tab.get(back);
  return { started, callback };
};
const whoAmI = async (tab) => (await tab.get('/api/v2/auth/me')).body.data?.username;
const subOf = (tab) => (tab.cookie('accessToken') ? Number(tokenOf(tab.cookie('accessToken')).sub) : null);

// 템플릿의 세 사람 — 학생 DB 의 52(구글) · 54(네이버) · 56(카카오) 꼴. 판정 DB 에서는 번호가 다르니 이름으로 찾는다.
const G = { username: 'minji.kim', name: '김민지', email: 'minji.kim@gmail.com', provider: 'google', providerUserId: GOOGLE_PROFILE.sub };
const N = { username: 'minji.kim4821', name: '김민지', email: null, provider: 'naver', providerUserId: DEFAULT_NAVER_PROFILE.id };
const K = { username: 'minji.kim7316', name: '민지', email: 'minji.kim@kakao.com', provider: 'kakao', providerUserId: String(KAKAO_EMAIL_VALID.id) };
/** 가짜 제공자가 «다른 계정» 으로 답하게 한다 — 제공자마다 프로필 모양이 다르다. */
const asAccount = (provider, id, extra = {}) => {
  if (provider === 'google') fakes.google.state.profile = { ...GOOGLE_PROFILE, sub: id, ...extra };
  if (provider === 'kakao') fakes.kakao.state.profile = { ...structuredClone(KAKAO_EMAIL_VALID), id: Number(id), ...extra };
  if (provider === 'naver') fakes.naver.state.profile = { ...DEFAULT_NAVER_PROFILE, id, ...extra };
};

beforeAll(async () => {
  await admin(async (client) => {
    for (const name of [GATE_DB, TPL_DB]) {
      await kick(client, name);
      await client.query(`DROP DATABASE IF EXISTS ${name}`);
    }
    await client.query(`CREATE DATABASE ${TPL_DB}`);
  });
  // 템플릿은 지난 회차(code/p3-47)의 마이그레이션까지 — Step 4 의 마이그레이션은 freshGate 가 그 판에서 얹는다.
  const base = stepDir(1);
  for (const dir of readdirSync(base('prisma/migrations')).filter((name) => name !== 'migration_lock.toml').sort()) {
    BASE_MIGRATIONS.add(dir);
    await onDb(TPL_DB, read(base(`prisma/migrations/${dir}/migration.sql`)));
  }
  const seedDir = studentDir(base);
  execFileSync(process.execPath, [join(seedDir, 'seed.js')], {
    cwd: seedDir, encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: `postgresql://postgres:postgres@localhost:5432/${TPL_DB}` },
  });
  // 이메일로 가입한 사람(p3-22 의 가입 장면과 같은 값) · 소셜로 가입한 세 사람(비밀번호 없음)
  const hash = await bcrypt.hash('yuna1234', 12);
  await onDb(TPL_DB, "INSERT INTO users (username, name, email, password_hash) VALUES ('yuna', '김유나', 'yuna@example.com', $1)", [hash]);
  for (const one of [G, N, K]) {
    const [{ id }] = await onDb(TPL_DB, 'INSERT INTO users (username, name, email) VALUES ($1, $2, $3) RETURNING id', [one.username, one.name, one.email]);
    await onDb(TPL_DB, 'INSERT INTO social_accounts (user_id, provider, provider_user_id) VALUES ($1, $2, $3)', [id, one.provider, one.providerUserId]);
  }
  fakes.google = await startFakeGoogle({ port: GOOGLE_PORT });
  fakes.kakao = await startFakeKakao({ port: KAKAO_PORT });
  fakes.naver = await startFakeNaver({ port: NAVER_PORT });
}, 120000);

afterAll(async () => {
  for (const fake of Object.values(fakes)) await fake.stop();
  await admin(async (client) => {
    for (const name of [GATE_DB, TPL_DB]) {
      await kick(client, name);
      await client.query(`DROP DATABASE IF EXISTS ${name}`);
    }
  });
  ROUND.cleanup();
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  if (process.env.P348_SEEN) writeFileSync(process.env.P348_SEEN, JSON.stringify(seen, null, 2));
});

beforeEach(() => {
  for (const fake of Object.values(fakes)) fake.reset();
  fakes.kakao.state.profile = structuredClone(KAKAO_EMAIL_VALID);
});

// ── 축 ① Step 1 — 지난 회차(code/p3-47) 그대로 ──────────────────────────────
describe('축 ① Step 1(code/p3-47) — 로그인한 채 다른 제공자에 다녀오면', () => {
  it('🔴 구글 사람으로 로그인한 쿠키 단지 그대로 카카오에 다녀오면 302 / · 새 토큰은 카카오 사람의 것 · sessions 에 카카오 사람의 행이 하나 늘고 구글 사람의 행은 그대로', async () => {
    await freshGate();
    await withServer(stepDir(1), async ({ base }) => {
      const tab = browser(base);
      const [gId, kId] = [await userIdOf(G.username), await userIdOf(K.username)];
      const first = await social(tab, 'google');
      expect([first.callback.status, first.callback.location]).toEqual([302, '/']);
      expect(subOf(tab)).toBe(gId);
      expect(await whoAmI(tab)).toBe(G.username);
      const before = [await sessionsOf(gId), await sessionsOf(kId)];
      const again = await social(tab, 'kakao');
      expect([again.callback.status, again.callback.location]).toEqual([302, '/']);
      expect(cookieNames(again.callback)).toEqual(['oauth_state_kakao', 'oauth_verifier_kakao', 'accessToken', 'refreshToken', 'oauth_next_kakao']);
      expect(subOf(tab)).toBe(kId);
      expect(await whoAmI(tab)).toBe(K.username);
      expect([await sessionsOf(gId), await sessionsOf(kId)]).toEqual([before[0], before[1] + 1]);
      expect(await socialOf(gId)).toEqual([`google:${G.providerUserId}`]);
      seen.step1 = { googleSub: gId, kakaoSub: kId, location: again.callback.location, sessionsBefore: before, sessionsAfter: [await sessionsOf(gId), await sessionsOf(kId)], whoAmI: K.username };
    });
  }, 30_000);
});

// ── 축 ② Step 2 — verify 함수는 프로필만 넘긴다 ──────────────────────────────
/** 세 제공자 로그인 요청 — 처음 온 사람 · 다시 온 사람 · EMAIL_TAKEN · 토큰 교환 실패 · state 다름. 관찰한 것을 돌려준다. */
const loginScenario = async (from) => {
  await freshGate(from);
  return withServer(from, async ({ base }) => {
    const out = [];
    const record = async (label, run) => {
      const before = [await count('users'), await count('social_accounts'), await count('sessions')];
      const tab = browser(base);
      const { started, callback } = await run(tab);
      const after = [await count('users'), await count('social_accounts'), await count('sessions')];
      out.push({
        label,
        start: [started.status, cookieNames(started)],
        callback: callback && [callback.status, callback.location, cookieNames(callback)],
        added: after.map((n, i) => n - before[i]),
        me: callback?.status === 302 && !callback.location.startsWith('/login') ? (await whoAmI(tab))?.replace(/\d{4}$/, '####') : null,
      });
    };
    for (const provider of PROVIDERS) {
      fakes[provider].reset();
      if (provider === 'kakao') fakes.kakao.state.profile = structuredClone(KAKAO_EMAIL_VALID);
      asAccount(provider, provider === 'kakao' ? '3899999999' : `new-${provider}-1`);
      if (provider === 'kakao') fakes.kakao.state.profile.kakao_account.email = 'new.kakao@kakao.com';
      if (provider === 'google') fakes.google.state.profile.email = 'new.google@gmail.com';
      await record(`${provider} 처음 온 사람`, (tab) => social(tab, provider, { next: '/jaehoon' }));
      await record(`${provider} 다시 온 사람`, (tab) => social(tab, provider));
      if (provider !== 'naver') {
        asAccount(provider, provider === 'kakao' ? '3899999998' : `new-${provider}-2`);
        if (provider === 'kakao') fakes.kakao.state.profile.kakao_account.email = 'yuna@example.com';
        if (provider === 'google') fakes.google.state.profile.email = 'yuna@example.com';
        await record(`${provider} EMAIL_TAKEN`, (tab) => social(tab, provider));
      }
      const secret = fakes[provider].state.clientSecret;
      fakes[provider].state.clientSecret = 'wrong-secret';
      await record(`${provider} 토큰 교환 실패`, (tab) => social(tab, provider));
      fakes[provider].state.clientSecret = secret;
      await record(`${provider} state 다름`, (tab) => social(tab, provider, { tamper: 'bad-state' }));
    }
    return out;
  });
};

describe('축 ② Step 2 — verify 함수에서 «사람 정하기» 를 뗀다(동작은 그대로)', () => {
  const src = (rel) => read(stepDir(2)(rel));

  it('🔴 바뀐 학생 파일은 둘 — strategies/createSocialStrategy.js · controllers/authController.js', () => {
    expect(changedStudentFiles('code/p3-47', stepRef(2))).toEqual(['controllers/authController.js', 'strategies/createSocialStrategy.js']);
  });

  it('🔴 verify 는 프로필을 그대로 넘긴다 · authService import 가 없다 · 콜백이 findOrCreateSocialUser 를 부른다', () => {
    expect(src('strategies/createSocialStrategy.js')).toContain('    (accessToken, refreshToken, profile, done) => done(null, profile),\n');
    expect(src('strategies/createSocialStrategy.js')).not.toContain('authService');
    expect(src('controllers/authController.js')).toContain('    const user = await authService.findOrCreateSocialUser(req.user);\n    const tokens = await authService.startSession(user);\n');
  });

  it('🔴 code/p3-47 과 같은 요청이 같은 결과 — 세 제공자 × (처음 · 다시 · EMAIL_TAKEN · 토큰 교환 실패 · state 다름)', async () => {
    const before = await loginScenario(stepDir(1));
    const after = await loginScenario(stepDir(2));
    expect(after).toEqual(before);
    // 몇 가지는 값으로도 못박는다
    const byLabel = Object.fromEntries(after.map((row) => [row.label, row]));
    expect(byLabel['google 처음 온 사람'].callback.slice(0, 2)).toEqual([302, '/jaehoon']);
    expect(byLabel['google 처음 온 사람'].added).toEqual([1, 1, 1]);
    expect(byLabel['kakao 다시 온 사람'].added).toEqual([0, 0, 1]);
    expect(byLabel['google EMAIL_TAKEN'].callback.slice(0, 2)).toEqual([302, '/login?error=EMAIL_TAKEN']);
    expect(byLabel['kakao EMAIL_TAKEN'].callback.slice(0, 2)).toEqual([302, '/login?error=EMAIL_TAKEN']);
    expect(byLabel['naver 토큰 교환 실패'].callback.slice(0, 2)).toEqual([302, LOGIN_FAILED_PAGE]);
    expect(byLabel['google state 다름'].callback.slice(0, 2)).toEqual([302, LOGIN_FAILED_PAGE]);
    seen.step2Scenario = after;
  }, 120_000);
});

/** 두 글의 다른 줄 — `diff` 가 지운 줄(`<`)과 더한 줄(`>`)을 차례대로 돌려준다. */
const diffLines = (a, b) => {
  const dir = mkdtempSync(join(tmpdir(), 'p348-diff-'));
  dirs.push(dir);
  writeFileSync(join(dir, 'a'), a);
  writeFileSync(join(dir, 'b'), b);
  let out = '';
  try {
    out = execFileSync('diff', ['a', 'b'], { cwd: dir, encoding: 'utf8' });
  } catch (error) {
    if (error.status !== 1) throw error;
    out = error.stdout;
  }
  const lines = out.split('\n');
  return {
    removed: lines.filter((l) => l.startsWith('< ') || l === '<').map((l) => l.slice(2)),
    added: lines.filter((l) => l.startsWith('> ') || l === '>').map((l) => l.slice(2)),
  };
};
/** 두 판 사이에 바뀐 학생 파일. */
const changedStudentFiles = (from, to) => execFileSync('git', ['diff', '--name-only', from, ...(to ? [to] : []), '--', ...STUDENT_FILES], { cwd: P('.'), encoding: 'utf8' }).trim().split('\n').filter(Boolean);

// ── 축 ③ Step 3 — 연결하기 ──────────────────────────────────────────────────
const tempShape = (name) => `${name}=…; Max-Age=600; Path=/api/v2/auth; Expires=…; HttpOnly; SameSite=Lax`;
const clearShape = (name) => `${name}=; Path=/api/v2/auth; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
/** 구글 사람으로 로그인한 탭 하나. */
const asGoogleUser = async (base) => {
  const tab = browser(base);
  const { callback } = await social(tab, 'google');
  expect([callback.status, callback.location]).toEqual([302, '/']);
  return tab;
};
/** 기한이 지난 Access 토큰 — 같은 사람 · 같은 로그인 기록(sid)으로, 서명은 맞다. */
const expiredToken = (token) => {
  const { sub, sid, role } = tokenOf(token);
  return jwt.sign({ sid, role, exp: Math.floor(Date.now() / 1000) - 60 }, SECRET, { subject: sub, algorithm: 'HS256' });
};

describe('축 ③ Step 3 — 로그인한 사람이 자기 계정에 소셜 계정을 잇는다', () => {
  const src = (rel) => read(stepDir(3)(rel));

  it('🔴 바뀐 학생 파일 — middlewares/auth.js · controllers · services 둘 · routes/auth.js (errors.js 는 그대로)', () => {
    expect(changedStudentFiles(stepRef(2), stepRef(3))).toEqual(['controllers/authController.js', 'middlewares/auth.js', 'routes/auth.js', 'services/authService.js', 'services/userService.js']);
    expect(src('middlewares/auth.js')).toContain('  res.locals.sessionId = payload.sid;\n');
  });

  it('🔴 연결 시작 — 302 카카오 · 연결 표시 쿠키(값 = 그 로그인의 sid · Path=/api/v2/auth · Max-Age=600 · HttpOnly · SameSite=Lax)와 oauth_next_kakao · state · verifier', async () => {
    await freshGate(stepDir(3));
    await withServer(stepDir(3), async ({ base }) => {
      const tab = await asGoogleUser(base);
      const sid = tokenOf(tab.cookie('accessToken')).sid;
      const res = await begin(tab, 'kakao', { next: '/', link: true });
      expect(res.status).toBe(302);
      expect(res.location.startsWith(fakes.kakao.urls.authorize)).toBe(true);
      expect(res.setCookies.map(cookieShape)).toEqual([
        tempShape('oauth_next_kakao'), clearShape('oauth_link_kakao'), tempShape('oauth_link_kakao'), tempShape('oauth_state_kakao'), tempShape('oauth_verifier_kakao'),
      ]);
      expect(tab.cookie('oauth_link_kakao')).toBe(sid);
      seen.step3LinkStartSetCookie = res.setCookies.map((line) => line.replace(/^(oauth_(?:state|verifier)_kakao)=[^;]+/, '$1=…').replace(/^(oauth_link_kakao)=[0-9a-f-]{36}/, '$1={sid}').replace(/Expires=(?!Thu, 01 Jan 1970)[^;]+/, 'Expires=…'));
      // 로그인으로 떠나는 시작 주소에도 연결 표시를 지우는 줄이 하나 더 붙는다
      const login = await begin(browser(base), 'kakao');
      expect(login.setCookies.map(cookieShape)).toEqual([tempShape('oauth_next_kakao'), clearShape('oauth_link_kakao'), tempShape('oauth_state_kakao'), tempShape('oauth_verifier_kakao')]);
    });
  }, 30_000);

  it('🔴 카카오 사람을 지운 DB 에서 구글 사람이 카카오를 이으면 302 /?linked=kakao · 행 하나 · 새 로그인 기록·토큰 쿠키 없음 · 임시 쿠키 넷을 지운다 · 로그아웃 뒤 카카오 로그인은 구글 사람', async () => {
    await freshGate(stepDir(3));
    await gate('DELETE FROM users WHERE username = $1', [K.username]);
    await withServer(stepDir(3), async ({ base }) => {
      const tab = await asGoogleUser(base);
      const gId = await userIdOf(G.username);
      const before = [await count('users'), await count('sessions')];
      const accessBefore = tab.cookie('accessToken');
      const { callback } = await social(tab, 'kakao', { next: '/', link: true });
      expect([callback.status, callback.location]).toEqual([302, '/?linked=kakao']);
      expect(cookieNames(callback)).toEqual(['oauth_state_kakao', 'oauth_verifier_kakao', 'oauth_next_kakao', 'oauth_link_kakao']);
      expect(clearedNames(callback)).toEqual(['oauth_state_kakao', 'oauth_verifier_kakao', 'oauth_next_kakao', 'oauth_link_kakao']);
      expect(tab.cookie('accessToken')).toBe(accessBefore);
      expect([await count('users'), await count('sessions')]).toEqual(before);
      expect(await socialOf(gId)).toEqual([`google:${G.providerUserId}`, `kakao:${K.providerUserId}`]);
      // 이메일은 그대로(카카오 이메일이 와도)
      expect((await gate('SELECT email FROM users WHERE id = $1', [gId]))[0].email).toBe(G.email);
      seen.step3LinkCallbackSetCookie = callback.setCookies.map(cookieShape);
      // 같은 연결을 한 번 더 — 성공 · 행 그대로
      const again = await social(tab, 'kakao', { next: '/', link: true });
      expect([again.callback.status, again.callback.location]).toEqual([302, '/?linked=kakao']);
      expect(await socialOf(gId)).toEqual([`google:${G.providerUserId}`, `kakao:${K.providerUserId}`]);
      // 로그아웃하고 카카오로 로그인하면 구글 사람
      expect((await tab.logout()).status).toBe(200);
      const login = await social(tab, 'kakao');
      expect([login.callback.status, login.callback.location]).toEqual([302, '/']);
      expect(subOf(tab)).toBe(gId);
      expect(await whoAmI(tab)).toBe(G.username);
    });
  }, 30_000);

  it('🔴 돌아갈 곳에 쿼리가 있으면 덧붙인다 — next=/jaehoon?tab=saved → /jaehoon?tab=saved&linked=kakao', async () => {
    await freshGate(stepDir(3));
    await gate('DELETE FROM users WHERE username = $1', [K.username]);
    await withServer(stepDir(3), async ({ base }) => {
      const tab = await asGoogleUser(base);
      const { callback } = await social(tab, 'kakao', { next: '/jaehoon?tab=saved', link: true });
      expect(callback.location).toBe('/jaehoon?tab=saved&linked=kakao');
    });
  }, 30_000);

  it('🔴 떠난 뒤 로그아웃하고 다른 사람(yuna)으로 로그인한 채 돌아오면 302 /?error=LOGIN_REQUIRED · 행이 안 생긴다', async () => {
    await freshGate(stepDir(3));
    await gate('DELETE FROM users WHERE username = $1', [K.username]);
    await withServer(stepDir(3), async ({ base }) => {
      const tab = await asGoogleUser(base);
      const rows = await count('social_accounts');
      const { callback } = await social(tab, 'kakao', {
        next: '/',
        link: true,
        between: async () => {
          await tab.logout();
          expect((await tab.login('yuna')).status).toBe(200);
        },
      });
      expect([callback.status, callback.location]).toEqual([302, '/?error=LOGIN_REQUIRED']);
      expect(await count('social_accounts')).toBe(rows);
      expect(await whoAmI(tab)).toBe('yuna');
      seen.step3OtherLogin = callback.location;
    });
  }, 30_000);

  it('🔎 Access 토큰 기한이 지난 채 돌아오면 302 /?error=LOGIN_REQUIRED · 연결 시작 때 기한이 지났으면 /login?error=TOKEN_EXPIRED', async () => {
    await freshGate(stepDir(3));
    await gate('DELETE FROM users WHERE username = $1', [K.username]);
    await withServer(stepDir(3), async ({ base }) => {
      const tab = await asGoogleUser(base);
      const { callback } = await social(tab, 'kakao', {
        next: '/',
        link: true,
        between: async () => tab.put('accessToken', expiredToken(tab.cookie('accessToken')), '/'),
      });
      expect([callback.status, callback.location]).toEqual([302, '/?error=LOGIN_REQUIRED']);
      expect(await count('social_accounts')).toBe(2);
      const late = await begin(tab, 'kakao', { next: '/', link: true });
      expect([late.status, late.location]).toEqual([302, '/login?error=TOKEN_EXPIRED']);
      seen.step3Expired = { callback: callback.location, start: late.location };
    });
  }, 30_000);

  it('🔴 연결로 떠났다가(표시 쿠키가 남은 채) 로그인 시작으로 다시 떠나면 표시가 지워져 콜백이 로그인으로 처리한다', async () => {
    await freshGate(stepDir(3));
    await withServer(stepDir(3), async ({ base }) => {
      const tab = await asGoogleUser(base);
      const linkStart = await begin(tab, 'kakao', { next: '/', link: true });
      expect(linkStart.status).toBe(302);
      expect(tab.cookie('oauth_link_kakao')).toBeDefined();
      const { callback } = await social(tab, 'kakao');
      expect(tab.cookie('oauth_link_kakao')).toBeUndefined();
      expect([callback.status, callback.location]).toEqual([302, '/']);
      expect(subOf(tab)).toBe(await userIdOf(K.username));
    });
  }, 30_000);

  it('🔴 로그인하지 않고 /kakao/link — 302 /login?error=LOGIN_REQUIRED (requireLogin 의 401 을 socialFailed 가 받는다) · POST 는 405', async () => {
    await freshGate(stepDir(3));
    await withServer(stepDir(3), async ({ base }) => {
      const res = await begin(browser(base), 'kakao', { link: true });
      expect([res.status, res.location, res.setCookies]).toEqual([302, '/login?error=LOGIN_REQUIRED', []]);
      const post = await browser(base).send('POST', '/api/v2/auth/kakao/link');
      expect([post.status, post.headers.get('allow')]).toEqual([405, 'GET']);
      seen.step3NoLogin = res.location;
    });
  }, 30_000);

  it('🔎 Step 3 판 — 다른 사람(네이버로 가입한 사람)에게 이어진 네이버를 구글 사람이 이으면 302 /login?error=SOCIAL_LOGIN_FAILED · 터미널에 P2002', async () => {
    await freshGate(stepDir(3));
    await withServer(stepDir(3), async ({ base, tail, dir }) => {
      const tab = await asGoogleUser(base);
      const from = tail().length;
      const rows = await socialRows();
      const { callback } = await social(tab, 'naver', { next: '/', link: true });
      await sleep(200);
      expect([callback.status, callback.location]).toEqual([302, LOGIN_FAILED_PAGE]);
      expect(await socialRows()).toEqual(rows);
      const terminal = tail().slice(from);
      expect(terminal).toContain('P2002');
      seen.step3NaverTaken = { location: callback.location, setCookie: cookieNames(callback), terminalHead: scrub(terminal, dir).split('\n').slice(0, 14) };
    });
  }, 30_000);

  it('🔴 로그인 쪽은 Step 2 와 같다 — 세 제공자 시나리오(시작 응답의 연결 표시 지우기 한 줄만 다르다)', async () => {
    const step2 = await loginScenario(stepDir(2));
    const step3 = await loginScenario(stepDir(3));
    const withoutLink = (rows) => rows.map((row) => ({ ...row, start: [row.start[0], row.start[1].filter((name) => !name.startsWith('oauth_link_'))] }));
    expect(withoutLink(step3)).toEqual(step2);
    expect(step3[0].start[1]).toEqual(['oauth_next_google', 'oauth_link_google', 'oauth_state_google', 'oauth_verifier_google']);
  }, 120_000);
});

// ── 축 ④ Step 4 — 거절 둘 · 제공자마다 하나 ─────────────────────────────────────
const MIGRATION_SQL = `/*
  Warnings:

  - A unique constraint covering the columns \`[user_id,provider]\` on the table \`social_accounts\` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "social_accounts_user_id_provider_key" ON "social_accounts"("user_id", "provider");
`;
/** pg 로 SQL 한 줄을 보내고 성공이면 'ok', 실패면 에러 코드·문장·상세를 돌려준다. */
const trySql = async (sql, params) => {
  try {
    await gate(sql, params);
    return 'ok';
  } catch (error) {
    return { code: error.code, message: error.message, detail: error.detail };
  }
};

describe('축 ④ Step 4 — 다른 사람에게 이어진 계정 · 같은 제공자의 둘째 계정은 잇지 않는다', () => {
  const src = (rel) => read(stepDir(4)(rel));

  it('🔴 바뀐 학생 파일 — errors.js · prisma(스키마 + 마이그레이션 하나) · services 둘', () => {
    expect(changedStudentFiles(stepRef(3), stepRef(4)).filter((name) => !name.startsWith('prisma/migrations/'))).toEqual(['errors.js', 'prisma/schema.prisma', 'services/authService.js', 'services/userService.js']);
    expect(newMigrations(stepDir(4))).toHaveLength(1);
    const [name] = newMigrations(stepDir(4));
    expect(name).toMatch(/^\d{14}_one_account_per_provider$/);
    expect(src(`prisma/migrations/${name}/migration.sql`)).toBe(MIGRATION_SQL);
    expect(src('prisma/schema.prisma')).toContain('  @@unique([provider, providerUserId])\n  @@unique([userId, provider])\n  @@index([userId])\n');
    expect(src('errors.js')).toContain("  SOCIAL_ACCOUNT_TAKEN: '이미 다른 계정에 연결된 소셜 계정이에요',\n  PROVIDER_ALREADY_LINKED: '같은 제공자의 계정이 이미 연결돼 있어요',\n");
    seen.step4Migration = { name, sql: src(`prisma/migrations/${name}/migration.sql`) };
  });

  it('🔴 구글 사람이 네이버로 가입한 사람의 네이버를 이으면 302 /?error=SOCIAL_ACCOUNT_TAKEN · 행 그대로 · 터미널 조용', async () => {
    await freshGate(stepDir(4));
    await withServer(stepDir(4), async ({ base, tail }) => {
      const tab = await asGoogleUser(base);
      const rows = await socialRows();
      const from = tail().length;
      const { callback } = await social(tab, 'naver', { next: '/', link: true });
      await sleep(150);
      expect([callback.status, callback.location]).toEqual([302, '/?error=SOCIAL_ACCOUNT_TAKEN']);
      expect(await socialRows()).toEqual(rows);
      expect(tail().slice(from)).not.toContain('Error');
      seen.step4Taken = callback.location;
    });
  }, 30_000);

  it('🔴 카카오가 이미 있는 구글 사람이 다른 카카오 계정을 이으면 302 /?error=PROVIDER_ALREADY_LINKED · 이미 이어진 그 카카오는 다시 이어도 /?linked=kakao', async () => {
    await freshGate(stepDir(4));
    await gate('DELETE FROM users WHERE username = $1', [K.username]);
    await withServer(stepDir(4), async ({ base }) => {
      const tab = await asGoogleUser(base);
      const gId = await userIdOf(G.username);
      expect((await social(tab, 'kakao', { next: '/', link: true })).callback.location).toBe('/?linked=kakao');
      asAccount('kakao', '3899999999');
      const second = await social(tab, 'kakao', { next: '/', link: true });
      expect([second.callback.status, second.callback.location]).toEqual([302, '/?error=PROVIDER_ALREADY_LINKED']);
      expect(await socialOf(gId)).toEqual([`google:${G.providerUserId}`, `kakao:${K.providerUserId}`]);
      asAccount('kakao', K.providerUserId);
      expect((await social(tab, 'kakao', { next: '/', link: true })).callback.location).toBe('/?linked=kakao');
      seen.step4Second = second.callback.location;
    });
  }, 30_000);

  it('🔴 확인하는 줄을 빼도(동시에 들어온 요청 흉내) DB 제약이 막고 같은 두 코드로 답한다 — P2002 를 제약 이름으로 나눈다', async () => {
    await freshGate(stepDir(4));
    await gate('DELETE FROM users WHERE username = $1', [K.username]);
    const noChecks = (dir) => {
      replaceIn(dir, 'services/authService.js', "  if (owner) throw new ConflictError('SOCIAL_ACCOUNT_TAKEN');\n", '');
      replaceIn(dir, 'services/authService.js', "  if (await userService.hasSocialAccount(userId, provider)) throw new ConflictError('PROVIDER_ALREADY_LINKED');\n", '');
    };
    await withServer(stepDir(4), async ({ base, tail }) => {
      const tab = await asGoogleUser(base);
      expect((await social(tab, 'naver', { next: '/', link: true })).callback.location).toBe('/?error=SOCIAL_ACCOUNT_TAKEN');
      expect((await social(tab, 'kakao', { next: '/', link: true })).callback.location).toBe('/?linked=kakao');
      asAccount('kakao', '3899999999');
      expect((await social(tab, 'kakao', { next: '/', link: true })).callback.location).toBe('/?error=PROVIDER_ALREADY_LINKED');
      await sleep(150);
      expect(tail()).not.toContain('P2002');
    }, { edit: noChecks });
  }, 30_000);

  it('🔴 마이그레이션 전 DB 에는 같은 사람·같은 제공자 두 행이 SQL 로 들어가고, 마이그레이션 뒤에는 23505', async () => {
    await freshGate(stepDir(3));
    const gId = await userIdOf(G.username);
    const insert = 'INSERT INTO social_accounts (user_id, provider, provider_user_id) VALUES ($1, $2, $3)';
    expect(await trySql(insert, [gId, 'kakao', '1111111111'])).toBe('ok');
    expect(await trySql(insert, [gId, 'kakao', '2222222222'])).toBe('ok');
    await freshGate(stepDir(4));
    expect(await trySql(insert, [gId, 'kakao', '1111111111'])).toBe('ok');
    const failed = await trySql(insert, [gId, 'kakao', '2222222222']);
    expect(failed).toEqual({
      code: '23505',
      message: 'duplicate key value violates unique constraint "social_accounts_user_id_provider_key"',
      detail: `Key (user_id, provider)=(${gId}, kakao) already exists.`,
    });
    seen.step4Sql23505 = failed;
  }, 30_000);

  it('🔎 같은 사람·같은 제공자 두 행이 이미 있는 DB 에 마이그레이션 SQL 을 걸면 23505 — could not create unique index', async () => {
    await freshGate(stepDir(3));
    const gId = await userIdOf(G.username);
    await gate('INSERT INTO social_accounts (user_id, provider, provider_user_id) VALUES ($1, $2, $3), ($1, $2, $4)', [gId, 'kakao', '1111111111', '2222222222']);
    const failed = await trySql(MIGRATION_SQL);
    expect(failed).toEqual({
      code: '23505',
      message: 'could not create unique index "social_accounts_user_id_provider_key"',
      detail: `Key (user_id, provider)=(${gId}, kakao) is duplicated.`,
    });
    seen.step4MigrateWithDuplicates = failed;
  }, 30_000);
});

// ── 축 ⑤ Step 5 — 내 로그인 방법 목록 · 끊기 ─────────────────────────────────────
const execFileAsync = promisify(execFile);
/** httpYac CLI 로 `.http` 한 파일을 통째로 보낸다(`--all`) — 이 프로세스의 서버가 답할 수 있게 비동기로 부른다. */
const httpyac = async (file, source) => {
  const dir = mkdtempSync(join(tmpdir(), 'p348-http-'));
  dirs.push(dir);
  writeFileSync(join(dir, file), source);
  try {
    return (await execFileAsync(P('node_modules/.bin/httpyac'), ['send', file, '--all'], { cwd: dir, encoding: 'utf8' })).stdout;
  } catch (error) {
    return `${error.stdout}${error.stderr}`;
  }
};
/** 카카오 사람을 지우고 구글 사람에게 카카오를 이어 둔 탭 — 구글 · 카카오 둘이 이어진 사람. */
const googlePlusKakao = async (base) => {
  await gate('DELETE FROM users WHERE username = $1', [K.username]);
  const tab = await asGoogleUser(base);
  expect((await social(tab, 'kakao', { next: '/', link: true })).callback.location).toBe('/?linked=kakao');
  return tab;
};
const LIST = '/api/v2/auth/social-accounts';
const providersOf = (body) => body.data.socialAccounts.map((account) => account.provider);

describe('축 ⑤ Step 5 — 내 로그인 방법 목록과 연결 끊기', () => {
  it('🔴 바뀐 학생 파일 — errors.js · controllers · services 둘 · routes/auth.js · 새 requests/social-accounts.http', () => {
    expect(changedStudentFiles(stepRef(4), stepRef(5))).toEqual(['controllers/authController.js', 'errors.js', 'requests/social-accounts.http', 'routes/auth.js', 'services/authService.js', 'services/userService.js']);
    expect(read(stepDir(5)('errors.js'))).toContain("  SOCIAL_ACCOUNT_NOT_FOUND: '연결된 소셜 계정이 없어요',\n");
  });

  it('🔴 목록 — { hasPassword, socialAccounts: [{ provider, createdAt }] } · 이은 차례 · 비밀번호로 가입한 사람은 hasPassword true 와 빈 목록', async () => {
    await freshGate(stepDir(5));
    await withServer(stepDir(5), async ({ base }) => {
      const tab = await googlePlusKakao(base);
      const list = await tab.get(LIST);
      expect(list.status).toBe(200);
      expect(list.body).toEqual({ data: { hasPassword: false, socialAccounts: [{ provider: 'google', createdAt: expect.any(String) }, { provider: 'kakao', createdAt: expect.any(String) }] } });
      const [a, b] = list.body.data.socialAccounts.map((x) => Date.parse(x.createdAt));
      expect(a).toBeLessThan(b);
      const yuna = browser(base);
      await yuna.login('yuna');
      expect((await yuna.get(LIST)).body).toEqual({ data: { hasPassword: true, socialAccounts: [] } });
      seen.step5List = list.body;
    });
  }, 30_000);

  it('🔴 끊기 — 200 «연결을 끊었어요» · 없는 제공자 404 SOCIAL_ACCOUNT_NOT_FOUND · 남의 소셜 계정은 못 끊는다(내 행만) · 토큰 없이 401 · 405 둘', async () => {
    await freshGate(stepDir(5));
    await withServer(stepDir(5), async ({ base }) => {
      const tab = await googlePlusKakao(base);
      const nId = await userIdOf(N.username);
      const done = await tab.del(`${LIST}/kakao`);
      expect([done.status, done.body]).toEqual([200, { data: { message: '연결을 끊었어요' } }]);
      expect(providersOf((await tab.get(LIST)).body)).toEqual(['google']);
      // 네이버는 네이버로 가입한 사람의 것이다 — 구글 사람의 행이 아니라 404 이고 그 행은 그대로
      const other = await tab.del(`${LIST}/naver`);
      expect([other.status, other.body]).toEqual([404, v2Error('SOCIAL_ACCOUNT_NOT_FOUND', '연결된 소셜 계정이 없어요')]);
      expect(await socialOf(nId)).toEqual([`naver:${N.providerUserId}`]);
      const noToken = await browser(base).del(`${LIST}/kakao`);
      expect([noToken.status, noToken.body.error.code]).toEqual([401, 'LOGIN_REQUIRED']);
      expect((await browser(base).get(LIST)).status).toBe(401);
      const put = await tab.send('PUT', LIST);
      expect([put.status, put.headers.get('allow')]).toEqual([405, 'GET']);
      const get = await tab.get(`${LIST}/kakao`);
      expect([get.status, get.headers.get('allow')]).toEqual([405, 'DELETE']);
      seen.step5Unlink = { done: done.body, notFound: other.body, noToken: noToken.body };
    });
  }, 30_000);

  it('🔴 끊은 뒤 그 카카오로 로그인하면 그 사람에게 가지 않는다 — 새 사람이 생긴다 · 이메일이 겹치면 EMAIL_TAKEN', async () => {
    await freshGate(stepDir(5));
    await withServer(stepDir(5), async ({ base }) => {
      const tab = await googlePlusKakao(base);
      const gId = await userIdOf(G.username);
      expect((await tab.del(`${LIST}/kakao`)).status).toBe(200);
      await tab.logout();
      const users = await count('users');
      const login = await social(tab, 'kakao');
      expect([login.callback.status, login.callback.location]).toEqual([302, '/']);
      expect(subOf(tab)).not.toBe(gId);
      expect(await count('users')).toBe(users + 1);
      expect((await whoAmI(tab)).startsWith('minji.kim')).toBe(true);
      seen.step5LoginAfterUnlink = { newUser: (await whoAmI(tab)).replace(/\d{4}$/, '####') };
    });
    // 이메일이 겹치는 경우 — 카카오 이메일이 구글 사람의 확인된 이메일과 같으면
    await freshGate(stepDir(5));
    await withServer(stepDir(5), async ({ base }) => {
      const tab = await googlePlusKakao(base);
      expect((await tab.del(`${LIST}/kakao`)).status).toBe(200);
      await tab.logout();
      fakes.kakao.state.profile.kakao_account.email = G.email;
      const login = await social(tab, 'kakao');
      expect([login.callback.status, login.callback.location]).toEqual([302, '/login?error=EMAIL_TAKEN']);
    });
  }, 60_000);

  it('🔎 Step 5 판은 마지막 로그인 방법도 끊는다 — 네이버만 있고 비밀번호가 없는 사람이 네이버를 끊으면 200 · 소셜 계정 0개', async () => {
    await freshGate(stepDir(5));
    await withServer(stepDir(5), async ({ base }) => {
      const tab = browser(base);
      await social(tab, 'naver');
      expect(await whoAmI(tab)).toBe(N.username);
      const res = await tab.del(`${LIST}/naver`);
      expect(res.status).toBe(200);
      expect((await tab.get(LIST)).body).toEqual({ data: { hasPassword: false, socialAccounts: [] } });
    });
  }, 30_000);

  it('🔴 requests/social-accounts.http — @token 한 줄을 바꿔 보내면 200 · 200 · 404 · 200 (구글 + 카카오인 사람)', async () => {
    const http = read(stepDir(5)('requests/social-accounts.http'));
    expect(http.split('\n').filter((line) => line.startsWith('### '))).toEqual(['### 내 로그인 방법', '### 카카오 연결 끊기', '### 이어지지 않은 네이버 끊기', '### 다시 내 로그인 방법']);
    expect(http.match(/^# @no-cookie-jar$/gm)).toHaveLength(4);
    await freshGate(stepDir(5));
    await withServer(stepDir(5), async ({ base }) => {
      const tab = await googlePlusKakao(base);
      const source = http.replace('@token = COPIED_TOKEN', `@token = ${tab.cookie('accessToken')}`).replaceAll('http://localhost:3000', base);
      const out = await httpyac('social-accounts.http', source);
      expect(out).toContain('4 requests processed (4 succeeded)');
      expect(out.match(/^HTTP\/1\.1 (\d+)/gm)).toEqual(['HTTP/1.1 200', 'HTTP/1.1 200', 'HTTP/1.1 404', 'HTTP/1.1 200']);
      expect(providersOf((await tab.get(LIST)).body)).toEqual(['google']);
    });
  }, 30_000);
});

// ── 축 ⑥ Step 6 — 마지막 로그인 방법은 끊지 않는다 ───────────────────────────────
describe('축 ⑥ Step 6 — 비밀번호가 없는 사람의 마지막 소셜 계정은 끊지 않는다', () => {
  it('🔴 바뀐 학생 파일 — errors.js · services/userService.js', () => {
    expect(changedStudentFiles(stepRef(5), stepRef(6))).toEqual(['errors.js', 'services/userService.js']);
    expect(read(stepDir(6)('errors.js'))).toContain("  LAST_LOGIN_METHOD: '마지막 로그인 방법은 끊을 수 없어요',\n");
  });

  it('🔴 네이버만 있고 비밀번호가 없는 사람 409 LAST_LOGIN_METHOD · 행 그대로 · 없는 제공자는 여전히 404', async () => {
    await freshGate(stepDir(6));
    await withServer(stepDir(6), async ({ base }) => {
      const tab = browser(base);
      await social(tab, 'naver');
      const res = await tab.del(`${LIST}/naver`);
      expect([res.status, res.body]).toEqual([409, v2Error('LAST_LOGIN_METHOD', '마지막 로그인 방법은 끊을 수 없어요')]);
      expect(providersOf((await tab.get(LIST)).body)).toEqual(['naver']);
      expect((await tab.del(`${LIST}/kakao`)).body.error.code).toBe('SOCIAL_ACCOUNT_NOT_FOUND');
      seen.step6Last = res.body;
    });
  }, 30_000);

  it('🔴 비밀번호가 있는 사람은 마지막 소셜 계정도 끊긴다 · 둘 있는 사람은 하나 끊기고 남은 하나는 409', async () => {
    await freshGate(stepDir(6));
    await withServer(stepDir(6), async ({ base }) => {
      // yuna(비밀번호 있음)에게 카카오를 이어 두었다가 끊는다
      await gate('DELETE FROM users WHERE username = $1', [K.username]);
      const yuna = browser(base);
      await yuna.login('yuna');
      expect((await social(yuna, 'kakao', { next: '/', link: true })).callback.location).toBe('/?linked=kakao');
      expect((await yuna.del(`${LIST}/kakao`)).status).toBe(200);
      expect((await yuna.get(LIST)).body).toEqual({ data: { hasPassword: true, socialAccounts: [] } });
      // 구글 + 카카오인 사람 — 카카오는 끊기고, 남은 구글은 409
      const tab = await asGoogleUser(base);
      expect((await social(tab, 'kakao', { next: '/', link: true })).callback.location).toBe('/?linked=kakao');
      expect((await tab.del(`${LIST}/kakao`)).status).toBe(200);
      expect((await tab.del(`${LIST}/google`)).status).toBe(409);
      expect(providersOf((await tab.get(LIST)).body)).toEqual(['google']);
    });
  }, 30_000);

  // 🔀 2026-11-15 학생 검수 — 교안 Step 6 에 «54번에게 jaehoon 의 비밀번호 해시를 잠깐 복사하고 네이버 끊기» 장면을 더했다
  //    (그전에는 «비밀번호가 있는 사람은 마지막 소셜 계정도 끊을 수 있어요» 를 보는 장면이 없어, 비밀번호를 안 보는 판도 통과했다).
  const passwordScene = async (edit) => {
    await freshGate(stepDir(6));
    return withServer(stepDir(6), async ({ base }) => {
      const tab = browser(base);
      await social(tab, 'naver');
      const [{ user_id: id }] = await gate("SELECT user_id FROM social_accounts WHERE provider = 'naver'");
      const before = await tab.del(`${LIST}/naver`);
      await gate("UPDATE users SET password_hash = (SELECT password_hash FROM users WHERE username = 'jaehoon') WHERE id = $1", [id]);
      const res = await tab.del(`${LIST}/naver`);
      const list = (await tab.get(LIST)).body;
      return { before: before.status, after: res.status, list };
    }, { edit });
  };

  it('🔴 교안 장면 — 비밀번호가 없을 때 409 · jaehoon 의 비밀번호 해시를 복사하면 같은 토큰으로 200 · «내 로그인 방법» 은 hasPassword true · 빈 목록', async () => {
    expect(await passwordScene()).toEqual({ before: 409, after: 200, list: { data: { hasPassword: true, socialAccounts: [] } } });
  }, 30_000);

  it('🔴 틀린 판 — 비밀번호를 안 보고 «하나뿐이면 409» 로만 막으면 비밀번호 해시를 복사한 장면에서도 409(이 장면이 가린다)', async () => {
    const got = await passwordScene((dir) => replaceIn(dir, 'services/userService.js', '  if (user.passwordHash === null && providers.length === 1)', '  if (providers.length === 1)'));
    expect([got.before, got.after]).toEqual([409, 409]);
    expect(got.list.data.hasPassword).toBe(true);
  }, 30_000);
});

// ── 축 ⑦ Step 7 — 동시에 끊으면 ─────────────────────────────────────────────────
const RUNS = 30;
/**
 * 동시 요청 30번 — 비밀번호 없이 구글·카카오 둘이 이어진 시험용 사람을 만들고, 그 사람의 토큰으로
 * DELETE …/google 과 DELETE …/kakao 를 함께 보낸다. 상태 코드 둘(차례대로)과 남은 소셜 계정 수를 모은다.
 */
const race = async (base, runs = RUNS, { warmOne = false } = {}) => {
  const out = [];
  for (let run = 0; run < runs; run += 1) {
    const tag = randomUUID().slice(0, 8);
    const [{ id }] = await gate("INSERT INTO users (username) VALUES ($1) RETURNING id", [`race.${tag}`]);
    await gate("INSERT INTO social_accounts (user_id, provider, provider_user_id) VALUES ($1, 'google', $2), ($1, 'kakao', $3)", [id, `race-google-${tag}`, `race-kakao-${tag}`]);
    const sid = randomUUID();
    await gate("INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, now() + interval '1 day')", [sid, id]);
    const token = jwt.sign({ sid, role: 'USER' }, SECRET, { subject: String(id), expiresIn: 900, algorithm: 'HS256' });
    const del = (provider) => fetch(`${base}${LIST}/${provider}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).then((res) => res.status);
    // 서버의 연결 풀에 연결 하나만 열어 둔 채 — 학생이 방금 화면을 한 번 쓴 서버
    if (warmOne) expect((await fetch(`${base}${LIST}`, { headers: { Authorization: `Bearer ${token}` } })).status).toBe(200);
    const statuses = await Promise.all([del('google'), del('kakao')]);
    const [{ n }] = await gate('SELECT count(*)::int AS n FROM social_accounts WHERE user_id = $1', [id]);
    out.push(`${[...statuses].sort().join('+')} → ${n}개`);
    await gate('DELETE FROM users WHERE id = $1', [id]);
  }
  return out.reduce((acc, key) => ({ ...acc, [key]: (acc[key] ?? 0) + 1 }), {});
};
const raceOn = async (from, edit) => {
  await freshGate(from);
  return withServer(from, async ({ base }) => race(base), { edit });
};
const races = {};
seen.step7Races = races;

describe('축 ⑦ Step 7 — 동시에 끊으면(트랜잭션 + 행 잠금)', () => {
  it('🔎 Step 6 판 — 동시 요청 30번', async () => {
    races.step6 = await raceOn(stepDir(6));
    expect(Object.values(races.step6).reduce((a, b) => a + b, 0)).toBe(RUNS);
  }, 120_000);
});

/** 그 판의 userService.js 를 스냅숏으로 갈아 끼운다. */
const useSnapshot = (name) => (dir) => writeFileSync(join(dir, 'services/userService.js'), read(P(`snapshots/${name}`)));
/** Step 7 판에서 잠그는 줄(과 그 주석)만 뺀 판 — 트랜잭션으로 묶기만 했다. */
const withoutLock = (dir) => replaceIn(dir, 'services/userService.js',
  '    // 같은 사람의 끊기 요청이 동시에 와도 한 번에 하나씩 세고 지우게, 그 사람 행을 먼저 잠근다 — 다른 요청은 이 트랜잭션이 끝날 때까지 기다린다.\n    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;\n\n', '');
/** unlink-race.js 를 학생 폴더 모양의 사본에서 돌린다 — 서버 주소만 판정 포트로. */
const runRace = (from, server) => {
  const dir = studentDir(from, (d) => {
    mkdirSync(join(d, 'lab/p3-48'), { recursive: true });
    writeFileSync(join(d, 'lab/p3-48/unlink-race.js'), read(stepDir(7)('lab/p3-48/unlink-race.js')).replace("const SERVER = 'http://localhost:3000';", `const SERVER = '${server}';`));
  });
  return execFileAsync(process.execPath, ['lab/p3-48/unlink-race.js'], { cwd: dir, encoding: 'utf8', env: { ...process.env, ...env } })
    .then(({ stdout }) => stdout, (error) => `${error.stdout}${error.stderr}`);
};

describe('축 ⑦ Step 7 — 판 다섯과 unlink-race.js', () => {
  it('🔴 바뀐 학생 파일 — services/userService.js · 새 lab/p3-48/unlink-race.js', () => {
    expect(changedStudentFiles(stepRef(6), stepRef(7))).toEqual(['services/userService.js']);
    expect(read(stepDir(7)('services/userService.js'))).toContain('    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;\n');
  });

  it('🔎 늦춘 판(세기와 지우기 사이 1초) — 동시 요청 30번', async () => {
    races.slow = await raceOn(stepDir(6), useSnapshot('p3-48.step7-slow.userService.js'));
    expect(races.slow).toEqual({ '200+200 → 0개': RUNS });
  }, 180_000);

  it('🔎 트랜잭션으로 감싸기만 한 판(FOR UPDATE 없음) — 동시 요청 30번', async () => {
    races.txOnly = await raceOn(stepDir(7), withoutLock);
    expect(Object.values(races.txOnly).reduce((a, b) => a + b, 0)).toBe(RUNS);
  }, 120_000);

  it('🔎 조건을 붙여 한 번에 지우는 판 — 동시 요청 30번', async () => {
    races.oneDelete = await raceOn(stepDir(6), useSnapshot('p3-48.step7-one-delete.userService.js'));
    expect(Object.values(races.oneDelete).reduce((a, b) => a + b, 0)).toBe(RUNS);
  }, 120_000);

  it('🔴 고친 판 — 30번 모두 200 하나 + 409 하나 · 1개 남음', async () => {
    races.fixed = await raceOn(stepDir(7));
    expect(races.fixed).toEqual({ '200+409 → 1개': RUNS });
  }, 120_000);

  it('🔎 연결이 하나만 열려 있는 서버(띄운 뒤 요청 하나를 보낸 서버)에서 — Step 6 판 · 늦춘 판, 띄울 때마다 한 번씩 10번', async () => {
    const warmOne = async (edit) => {
      await freshGate(stepDir(6));
      const tally = {};
      for (let i = 0; i < 10; i += 1) {
        const got = await withServer(stepDir(6), async ({ base }) => race(base, 1, { warmOne: true }), { edit });
        for (const [key, n] of Object.entries(got)) tally[key] = (tally[key] ?? 0) + n;
      }
      return tally;
    };
    races.step6WarmOne = await warmOne();
    races.slowWarmOne = await warmOne(useSnapshot('p3-48.step7-slow.userService.js'));
    expect(races.slowWarmOne).toEqual({ '200+200 → 0개': 10 });
  }, 180_000);

  it('🔴 unlink-race.js — Step 6 서버면 200 · 200 · 0개(세 번 가운데 한 번 이상), Step 7 서버면 200 하나 + 409 하나 · 1개 · 끝나면 시험용 사람이 없다 · 서버가 없으면 알아볼 문장', async () => {
    const src = read(stepDir(7)('lab/p3-48/unlink-race.js'));
    expect(src.split('\n')[0]).toBe('// ~/instagram-api/lab/p3-48/unlink-race.js');
    await freshGate(stepDir(7));
    const users = await count('users');
    // 띄운 뒤 처음 보내는 동시 요청이라 거의 언제나 둘 다 지운다 — 동시 요청 30번 판정에서 30번 가운데 29번이 그랬던 적이 있어 세 번까지 본다
    const tries = await withServer(stepDir(6), async ({ base }) => [await runRace(stepDir(7), base), await runRace(stepDir(7), base), await runRace(stepDir(7), base)]);
    const before = tries.find((out) => out.endsWith('남은 소셜 계정: 0개\n'));
    expect(before).toBe('google 끊기: 200\nkakao 끊기: 200\n남은 소셜 계정: 0개\n');
    seen.unlinkRaceStep6Tries = tries;
    const after = await withServer(stepDir(7), async ({ base }) => runRace(stepDir(7), base));
    expect(after.split('\n').slice(0, 2).map((line) => line.replace(/^\w+ /, '')).sort()).toEqual(['끊기: 200', '끊기: 409']);
    expect(after.endsWith('남은 소셜 계정: 1개\n')).toBe(true);
    expect(await count('users')).toBe(users);
    const down = await runRace(stepDir(7), 'http://localhost:3999');
    expect(down).toBe('수업 서버(http://localhost:3999)에 연결하지 못했어요. 다른 창에서 npm run dev 로 서버를 먼저 띄워 주세요.\n');
    expect(await count('users')).toBe(users);
    seen.unlinkRace = { step6: before, step7: after, down };
  }, 60_000);
});

// ── 축 ⑧ 학생 파일 차이 ────────────────────────────────────────────────────────
// 교안이 인용할 코드 블록의 줄이 각 Step 커밋에 있는지는 교안을 쓴 뒤 이 축에 더한다(지금은 바뀐 파일 목록만 잠근다).
describe('축 ⑧ 학생 파일 차이 — code/p3-47 에서 Step 마다', () => {
  it('🔴 Step 마다 바뀐 학생 파일 · 새 패키지 없음', () => {
    const changed = {};
    for (const n of [2, 3, 4, 5, 6, 7]) changed[n] = changedStudentFiles('code/p3-47', stepRef(n));
    expect(changed[2]).toEqual(['controllers/authController.js', 'strategies/createSocialStrategy.js']);
    expect(changed[7]).toEqual([
      'controllers/authController.js', 'errors.js', 'middlewares/auth.js', `prisma/migrations/${newMigrations(stepDir(7))[0]}/migration.sql`, 'prisma/schema.prisma',
      'requests/social-accounts.http', 'routes/auth.js', 'services/authService.js', 'services/userService.js', 'strategies/createSocialStrategy.js',
    ]);
    for (const n of [2, 3, 4, 5, 6, 7]) {
      expect(showAt(stepRef(n), 'package.json')).toBe(showAt('code/p3-47', 'package.json'));
      expect(showAt(stepRef(n), 'package-lock.json')).toBe(showAt('code/p3-47', 'package-lock.json'));
    }
    // 고치지 않기로 한 파일 — 문서 · 시드 · app.js
    expect(changedStudentFiles('code/p3-47', stepRef(7)).filter((name) => ['docs/openapi.js', 'seed.js', 'app.js'].includes(name))).toEqual([]);
    seen.changedFiles = changed;
  });

  it('🔴 학생 파일에 내부 어휘가 없다 — 게이트 · 판정 · TDD · Step 번호 · 회차 번호(경로 lab/p3-48/ 는 빼고)', () => {
    const labs = execFileSync('git', ['ls-tree', '--name-only', LINE, 'lab/p3-48/'], { cwd: P('.'), encoding: 'utf8' }).trim().split('\n');
    expect(labs.length).toBeGreaterThanOrEqual(10);
    const files = changedStudentFiles('code/p3-47', LINE).concat(labs);
    for (const rel of files) {
      const text = showAt(LINE, rel);
      expect([rel, /게이트|판정|TDD|Step \d|p3-\d\d/.test(text.replace(/lab\/p3-48\//g, ''))]).toEqual([rel, false]);
    }
  });
});

// ── 축 ⑨ 실습·과제(lab/p3-48) ──────────────────────────────────────────────────
// 실습 파일은 이 회차 북마크가 생기면 북마크에서, 아직 없으면 main 에서 읽는다(작업트리가 아니다).
// 짓는 동안 `P348_LAB_WT=1` 을 주면 작업트리에서 읽는다.
// 🔑 4001·4002·4003 은 남이 쓸 수 있어서 직접 띄우지 않는다 — 사본의 글자만 바꿔 띄운다
//    (톡 서버 4003→3994 · 실습용 인가 서버 4001→3995 · 서비스 4002→3996 — 등록한 돌아올 주소 · 알림 주소 · listen 모두).
const TALK_PORT = 3994;
const LAB_AS_PORT = 3995;
const LAB_PORT = 3996;
const LAB_BASE = `http://localhost:${LAB_PORT}`;
const TALK_BASE = `http://localhost:${TALK_PORT}`;
const LAB_REF = hasRef('refs/heads/code/p3-48') ? 'code/p3-48' : 'main';
const LAB_WT = process.env.P348_LAB_WT === '1';
const labFile = (rel) => (LAB_WT ? read(P(rel)) : showAt(LAB_REF, rel));
const LAB = (name) => labFile(`lab/p3-48/${name}`);
const SNAP = (name) => labFile(`snapshots/p3-48.${name}`);
/** 글자를 모두 바꾼다 — 바꿀 글자가 없으면 던진다. */
const swapAll = (text, pairs, what) => pairs.reduce((out, [a, b]) => {
  if (!out.includes(a)) throw new Error(`${what} 에 바꿀 글자가 없다: ${a}`);
  return out.replaceAll(a, b);
}, text);
const PORT_PAIRS = { 4001: String(LAB_AS_PORT), 4002: String(LAB_PORT), 4003: String(TALK_PORT) };
/** 사본의 실습 포트를 판정 포트로 바꾼다 — `ports` 에 적은 포트는 반드시 있어야 한다. */
const toLabPorts = (text, what, ports) => swapAll(text, ports.map((port) => [String(port), PORT_PAIRS[port]]), what);
/** 사본의 한 덩어리를 바꾼다 — 바꿀 글자가 없거나 여럿이면 던진다(틀린 판을 만들 때). */
const edit1 = (text, a, b) => {
  if (text.split(a).length !== 2) throw new Error(`바꿀 글자가 없거나 여럿이다: ${a}`);
  return text.replace(a, b);
};
const labSeen = {};
seen.labs = labSeen;

/** 실습 파일을 학생 폴더 모양의 사본에 놓고 `node lab/p3-48/…` 로 띄운다. */
const bootLab = (rel, source, port) => {
  const dir = studentDir(stepDir(7), (d) => {
    mkdirSync(join(d, rel, '..'), { recursive: true });
    writeFileSync(join(d, rel), source);
  });
  return boot(join(dir, rel), { port, cwd: dir, env, ready: `${port}번 포트에서` });
};
const withService = async (file, source, fn) => {
  const srv = await bootLab(`lab/p3-48/${file}`, toLabPorts(source, file, [4001, 4002, 4003]), LAB_PORT);
  try {
    return await fn({ ...srv, base: LAB_BASE });
  } finally {
    await stop(srv);
  }
};
/** DB 를 쓰는 실습 스크립트를 학생 폴더 모양의 사본에서 돌린다(`node --env-file=.env lab/p3-48/…` 와 같게 환경을 준다). */
const runDbScript = (file, source) => {
  const dir = studentDir(stepDir(7), (d) => {
    mkdirSync(join(d, 'lab/p3-48'), { recursive: true });
    writeFileSync(join(d, `lab/p3-48/${file}`), source);
  });
  return execFileAsync(process.execPath, [`lab/p3-48/${file}`], { cwd: dir, encoding: 'utf8', env: { ...process.env, ...env } })
    .then(({ stdout }) => stdout, (error) => `${error.stdout}${error.stderr}`);
};
const httpyacLab = (file, source) => httpyac(file, toLabPorts(source, file, [4002]));
const nodeCheck = (source) => {
  const dir = mkdtempSync(join(tmpdir(), 'p348-check-'));
  dirs.push(dir);
  writeFileSync(join(dir, 'file.js'), source);
  writeFileSync(join(dir, 'package.json'), '{"type":"module"}');
  execFileSync(process.execPath, ['--check', 'file.js'], { cwd: dir, stdio: 'pipe' });
};

/** 실습용 인가 서버의 동의 화면에서 아이디·비밀번호를 넣고 누른다 — 돌아올 주소(경로 + 쿼리)를 돌려준다. */
const consentLab = async (started, username) => {
  const auth = new URL(started.location);
  const form = new URLSearchParams([...auth.searchParams, ['username', username], ['password', `${username}1234`], ['decision', 'allow']]);
  const res = await fetch(`${auth.origin}/authorize`, { method: 'POST', body: form, redirect: 'manual' });
  const back = new URL(res.headers.get('location'));
  expect(back.origin).toBe(LAB_BASE);
  return `${back.pathname}${back.search}`;
};
/** 톡의 동의 화면에서 계정을 고르고 «허용»(또는 «거부») 을 누른다(닉네임 · 이메일 제공을 켠 채). */
const consentTalk = async (started, account, decision = 'allow') => {
  const auth = new URL(started.location);
  const fields = [...auth.searchParams, ['account', account], ['decision', decision], ['nickname', 'yes'], ['email', 'yes']];
  const res = await fetch(`${auth.origin}/oauth/authorize`, { method: 'POST', body: new URLSearchParams(fields), redirect: 'manual' });
  const back = new URL(res.headers.get('location'));
  expect(back.origin).toBe(LAB_BASE);
  return `${back.pathname}${back.search}`;
};
/** 한 탭으로 한 바퀴 — `path` 는 시작 주소(/login · /talk · /talk/link). 시작이 제공자로 가지 않으면 그 응답을 돌려준다. */
const labGo = async (tab, path, who) => {
  const started = await tab.get(path);
  if (!started.location?.startsWith('http')) return [started.status, started.location];
  const back = path === '/login' ? await consentLab(started, who) : await consentTalk(started, who);
  const res = await tab.get(back);
  return [res.status, res.location];
};
const meOf = async (tab) => (await tab.get('/me')).body;
const membersOf = async (base) => Object.fromEntries((await browser(base).get('/members')).body.map((m) => [m.id, m.providers]));
/** 톡 계정 페이지에서 «연결 끊기» 를 누른다 — 결과 화면의 글자를 돌려준다. */
const unlinkAtTalk = async (account) => (await fetch(`${TALK_BASE}/account/apps/lab-talk/unlink`, { method: 'POST', body: new URLSearchParams({ account }) })).text();

describe('축 ⑨ 실습·과제 — 톡 서버와 실습용 인가 서버를 띄운 채', () => {
  let talk;
  let authServer;
  beforeAll(async () => {
    talk = await bootLab('lab/p3-48/talk-server.js', toLabPorts(LAB('talk-server.js'), 'talk-server.js', [4002, 4003]), TALK_PORT);
    authServer = await bootLab('lab/p3-21/auth-server.js', toLabPorts(showAt('code/p3-47', 'lab/p3-21/auth-server.js'), 'auth-server.js', [4001, 4002]), LAB_AS_PORT);
  }, 30_000);
  afterAll(async () => {
    if (talk) await stop(talk);
    if (authServer) await stop(authServer);
  });

  describe('직접 해보기 1 — 톡 연결하기', () => {
    it('🔴 시작 파일은 지난 과제(lab/p3-47/homework1.js) 정답을 복사한 것 — 첫 줄 경로 · 1번 dahye 가 인가 서버의 dahye(10003)로 로그인하는 한 줄과 그 주석만 다르다', () => {
      const start = SNAP('practice1-start.practice1.js');
      const { removed, added } = diffLines(showAt('code/p3-47', 'lab/p3-47/homework1.js'), start);
      expect(removed).toEqual([
        '// ~/instagram-api/lab/p3-47/homework1.js',
        '// 1번 dahye 는 이메일로 먼저 가입해 둔 회원이고, 2번 소라는 톡으로 먼저 가입해 둔 회원이다.',
        "const socialAccounts = [{ provider: 'talk', providerUserId: '10001', memberId: 2 }];",
      ]);
      expect(added).toEqual([
        '// ~/instagram-api/lab/p3-48/practice1.js',
        '// 1번 dahye 는 이메일로 먼저 가입해 둔 회원이고(인가 서버의 dahye 로 로그인한다), 2번 소라는 톡으로 먼저 가입해 둔 회원이다.',
        'const socialAccounts = [',
        "  { provider: 'lab', providerUserId: '10003', memberId: 1 },",
        "  { provider: 'talk', providerUserId: '10001', memberId: 2 },",
        '];',
      ]);
      nodeCheck(start);
      nodeCheck(LAB('practice1.js'));
    });

    /** 처음 화면(`/?error=…`)에 보이는 문장. */
    const noticeOf = async (base, location) => /<p>([^<]*)<\/p>/.exec((await browser(base).get(location)).body)?.[1] ?? null;
    /**
     * 확인 절차 — 인가 서버 dahye 로그인 → 톡 연결(dahye) → 회원 목록 → 톡 dahye 로 로그인
     * → (탭 둘) 첫 탭에서 연결을 시작해 톡 동의 화면에 멈춘 채 둘째 탭에서 인가 서버 jaehoon 으로 로그인하고, 첫 탭에서 haru 로 허용
     * → 연결을 시작해 톡 화면에서 «거부» 한 뒤 처음 화면에서 «톡으로 로그인»(sora) → 로그인하지 않고 연결 시작 → 회원 목록.
     * 브라우저의 탭 둘은 쿠키 단지를 함께 쓰므로 쿠키 단지 하나로 잰다.
     */
    const observe = (source) => withService('practice1.js', source, async ({ base }) => {
      const tab = browser(base);
      const got = {};
      got.labLogin = await labGo(tab, '/login', 'dahye');
      got.meBefore = await meOf(tab);
      const sessionBeforeLink = tab.cookie('labSession');
      got.link = await labGo(tab, '/talk/link', 'dahye');
      // 🔀 2026-11-15 학생 검수 — 확인에 «연결 전후 labSession 값이 같아요» 를 더했다(요구사항 5 «로그인 기록은 새로 만들지 않은 채»)
      got.sameSessionAfterLink = tab.cookie('labSession') === sessionBeforeLink;
      got.members = await membersOf(base);
      got.talkLogin = await labGo(tab, '/talk', 'dahye');
      got.meAfter = await meOf(tab);
      // 탭 둘 — 첫 탭은 톡 동의 화면에 멈춰 있다
      const waiting = await tab.get('/talk/link');
      got.otherTabLogin = await labGo(tab, '/login', 'jaehoon');
      got.otherTabMe = await meOf(tab);
      const back = await tab.get(await consentTalk(waiting, 'haru'));
      got.otherLoginLink = [back.status, back.location];
      got.otherLoginNotice = back.location ? await noticeOf(base, back.location) : null;
      got.membersAfterOtherLogin = await membersOf(base);
      // 거부한 뒤 로그인
      const started = await tab.get('/talk/link');
      const denied = await tab.get(await consentTalk(started, 'sora', 'deny'));
      got.denied = [denied.status, denied.location];
      got.deniedNotice = denied.location ? await noticeOf(base, denied.location) : null;
      got.loginAfterDeny = await labGo(tab, '/talk', 'sora');
      got.meAfterDeny = await meOf(tab);
      got.noLogin = await labGo(browser(base), '/talk/link', 'dahye');
      got.membersAtEnd = await membersOf(base);
      return got;
    });
    const RIGHT = {
      labLogin: [302, '/me'],
      meBefore: { id: 1, nickname: 'dahye', email: 'dahye@example.com' },
      link: [302, '/members'],
      sameSessionAfterLink: true,
      members: { 1: ['lab', 'talk'], 2: ['talk'] },
      talkLogin: [302, '/me'],
      meAfter: { id: 1, nickname: 'dahye', email: 'dahye@example.com' },
      otherTabLogin: [302, '/me'],
      otherTabMe: { id: 3, nickname: 'jaehoon' },
      otherLoginLink: [302, '/?error=LOGIN_REQUIRED'],
      otherLoginNotice: '로그인이 필요해요.',
      membersAfterOtherLogin: { 1: ['lab', 'talk'], 2: ['talk'], 3: ['lab'] },
      denied: [302, '/?error=LOGIN_FAILED'],
      deniedNotice: '로그인하지 못했어요. 다시 시도해 주세요.',
      loginAfterDeny: [302, '/me'],
      meAfterDeny: { id: 2, nickname: '소라' },
      noLogin: [302, '/?error=LOGIN_REQUIRED'],
      membersAtEnd: { 1: ['lab', 'talk'], 2: ['talk'], 3: ['lab'] },
    };
    const wrongKeys = (got) => Object.keys(RIGHT).filter((key) => JSON.stringify(got[key]) !== JSON.stringify(RIGHT[key]));

    it('🔴 정답 — 연결하면 /members 에서 1번이 lab · talk · 그 뒤 톡의 dahye 로 로그인하면 /me 에 1번(지난 과제의 «이미 가입한 이메일이에요» 가 사라진다) · 로그인하지 않으면 /?error=LOGIN_REQUIRED', async () => {
      const got = await observe(LAB('practice1.js'));
      expect(got).toEqual(RIGHT);
      labSeen.practice1 = got;
    }, 60_000);

    it('🔴 시작 파일 — 톡의 dahye 로그인은 /?error=EMAIL_TAKEN(지난 과제 그대로) · /talk/link 는 없는 주소', async () => {
      await withService('practice1.js', SNAP('practice1-start.practice1.js'), async ({ base }) => {
        expect(await labGo(browser(base), '/talk', 'dahye')).toEqual([302, '/?error=EMAIL_TAKEN']);
        const tab = browser(base);
        expect(await labGo(tab, '/login', 'dahye')).toEqual([302, '/me']);
        expect((await meOf(tab)).id).toBe(1);
        expect((await tab.get('/talk/link')).status).toBe(404);
      });
    }, 60_000);

    it('🔴 틀린 판 (가) — 연결 표시 쿠키를 어디서도 지우지 않으면 다음 톡 로그인도 연결로 처리돼 /members 로 간다', async () => {
      const wrong = LAB('practice1.js').replace("  res.clearCookie('lab_link_talk');\n\n  // 떠날 때와", '\n  // 떠날 때와').replace("app.get('/talk', (req, res, next) => {\n  res.clearCookie('lab_link_talk');\n  next();\n}, ", "app.get('/talk', ");
      expect(wrong.match(/clearCookie\('lab_link_talk'\)/g)).toBeNull();
      const got = await observe(wrong);
      expect(got.talkLogin).toEqual([302, '/members']);
      expect(wrongKeys(got)).toContain('talkLogin');
    }, 60_000);

    it('🔴 틀린 판 (라) — 연결 표시 쿠키의 값과 지금 labSession 을 비교하지 않으면(로그인만 돼 있으면 잇는다) 탭 둘에서 haru 가 둘째 탭의 jaehoon 에게 이어진다', async () => {
      const wrong = edit1(LAB('practice1.js'), '  if (memberId === undefined || linkSession !== req.cookies.labSession) {', '  if (memberId === undefined) {');
      const got = await observe(wrong);
      expect(got.otherLoginLink).toEqual([302, '/members']);
      expect(got.membersAfterOtherLogin).toEqual({ 1: ['lab', 'talk'], 2: ['talk'], 3: ['lab', 'talk'] });
      // 앞의 확인(다섯 줄)은 정답과 같다 — 탭 둘 줄이 처음으로 가린다
      expect(wrongKeys(got)[0]).toBe('otherLoginLink');
      labSeen.practice1NoCompare = { otherLoginLink: got.otherLoginLink, membersAfterOtherLogin: got.membersAfterOtherLogin, wrongKeys: wrongKeys(got) };
    }, 60_000);

    it('🔴 틀린 판 (마) — 로그인 시작(/talk)에서만 연결 표시 쿠키를 안 지우면(콜백에서는 지운다) 거부한 뒤 «톡으로 로그인» 이 연결로 처리돼 sora 가 jaehoon 에게 이어진다', async () => {
      const wrong = edit1(LAB('practice1.js'), "app.get('/talk', (req, res, next) => {\n  res.clearCookie('lab_link_talk');\n  next();\n}, passport.authenticate('talk', { session: false }));", "app.get('/talk', passport.authenticate('talk', { session: false }));");
      expect(wrong.match(/clearCookie\('lab_link_talk'\)/g)).toHaveLength(1);
      const got = await observe(wrong);
      expect(got.loginAfterDeny).toEqual([302, '/members']);
      expect(got.meAfterDeny).toEqual({ id: 3, nickname: 'jaehoon' });
      expect(got.membersAtEnd).toEqual({ 1: ['lab', 'talk'], 2: ['talk'], 3: ['lab', 'talk'] });
      // 거부 줄까지는 정답과 같다 — 거부한 뒤 로그인 줄이 처음으로 가린다
      expect(wrongKeys(got)[0]).toBe('loginAfterDeny');
      labSeen.practice1StartKeepsLink = { loginAfterDeny: got.loginAfterDeny, meAfterDeny: got.meAfterDeny, membersAtEnd: got.membersAtEnd, wrongKeys: wrongKeys(got) };
    }, 60_000);

    it('🔴 틀린 판 (나) — verify 가 여전히 회원을 찾거나 만들면 톡 연결이 /?error=EMAIL_TAKEN', async () => {
      const wrong = edit1(LAB('practice1.js'), '    (accessToken, refreshToken, profile, done) => done(null, profile),\n', '    (accessToken, refreshToken, profile, done) => {\n      try {\n        findOrCreateMember(profile);\n        done(null, profile);\n      } catch (error) {\n        done(error);\n      }\n    },\n');
      const got = await observe(wrong);
      expect(got.link).toEqual([302, '/?error=EMAIL_TAKEN']);
      expect(wrongKeys(got)).toContain('link');
    }, 60_000);

    it('🔴 틀린 판 (바) — 연결하면서 새 labSession 을 주고 /members 로 보내면 다른 줄은 모두 정답과 같고, «연결 전후 labSession 값» 줄만 가린다', async () => {
      const wrong = edit1(LAB('practice1.js'), "  if (!linked) socialAccounts.push({ provider, providerUserId: id, memberId });\n\n  res.redirect('/members');", "  if (!linked) socialAccounts.push({ provider, providerUserId: id, memberId });\n\n  const sessionId = randomUUID();\n  sessions.set(sessionId, memberId);\n  res.cookie('labSession', sessionId, { httpOnly: true, sameSite: 'lax' });\n  res.redirect('/members');");
      const got = await observe(wrong);
      expect(wrongKeys(got)).toEqual(['sameSessionAfterLink']);
    }, 60_000);

    it('🔴 틀린 판 (다) — 연결하면서 새 로그인 기록을 만들면(startSession) /members 가 아니라 /me 로 간다', async () => {
      const wrong = edit1(LAB('practice1.js'), "  if (!linked) socialAccounts.push({ provider, providerUserId: id, memberId });\n\n  res.redirect('/members');", "  if (!linked) socialAccounts.push({ provider, providerUserId: id, memberId });\n\n  startSession(req, res);");
      const got = await observe(wrong);
      expect(got.link).toEqual([302, '/me']);
      expect(wrongKeys(got)).toContain('link');
    }, 60_000);
  });

  describe('직접 해보기 2 — 로그인 방법 목록 · 끊기 · 마지막 로그인 방법', () => {
    it('🔴 시작 파일은 직접 해보기 1 정답을 복사한 것 — 첫 줄 경로만 다르다', () => {
      expect(SNAP('practice2-start.practice2.js')).toBe(LAB('practice1.js').replace('// ~/instagram-api/lab/p3-48/practice1.js\n', '// ~/instagram-api/lab/p3-48/practice2.js\n'));
    });

    /** 확인 절차 — dahye(인가 서버 + 톡 연결)의 .http 다섯 요청 · 인가 서버 로그인 · 소라 409 · 없는 제공자 404 · 로그인 없이 401 · 회원 목록. */
    const observe = (source) => withService('practice2.js', source, async ({ base }) => {
      const tab = browser(base);
      await labGo(tab, '/login', 'dahye');
      await labGo(tab, '/talk/link', 'dahye');
      const http = LAB('practice2.http').replace('@session = COPIED_SESSION', `@session = ${tab.cookie('labSession')}`);
      const out = await httpyacLab('practice2.http', http);
      const got = {};
      got.http = out.match(/^HTTP\/1\.1 (\d+)/gm)?.map((line) => Number(line.slice(9)));
      got.bodies = [...out.matchAll(/^\{\s*"providers": \[[^\]]*\]\s*\}$/gm)].map((m) => JSON.stringify(JSON.parse(m[0])));
      got.labAgain = await labGo(browser(base), '/login', 'dahye');
      const sora = browser(base);
      await labGo(sora, '/talk', 'sora');
      const soraRes = await sora.del('/me/social-accounts/talk');
      got.sora = [soraRes.status, soraRes.body];
      const kakao = await tab.del('/me/social-accounts/kakao');
      got.kakao = [kakao.status, kakao.body];
      got.noLogin = (await browser(base).del('/me/social-accounts/talk')).status;
      // 🔀 2026-11-15 학생 검수 — 확인에 «@session 값을 abc로 바꾼 «내 로그인 방법»» 을 더했다(요구사항 1 «로그인하지 않았으면 401»)
      const list = await fetch(`${base}/me/login-methods`, { headers: { Cookie: 'labSession=abc' } });
      got.noLoginList = [list.status, await list.json()];
      got.members = await membersOf(base);
      return got;
    });
    const RIGHT = {
      http: [200, 200, 404, 409, 200],
      bodies: ['{"providers":["lab","talk"]}', '{"providers":["lab"]}'],
      labAgain: [302, '/me'],
      sora: [409, { message: '마지막 로그인 방법은 끊을 수 없어요' }],
      kakao: [404, { message: '연결된 소셜 계정이 없어요' }],
      noLogin: 401,
      noLoginList: [401, { message: '로그인이 필요해요' }],
      members: { 1: ['lab'], 2: ['talk'] },
    };
    const wrongKeys = (got) => Object.keys(RIGHT).filter((key) => JSON.stringify(got[key]) !== JSON.stringify(RIGHT[key]));

    it('🔴 practice2.http — 요청 다섯 · 자리표시 COPIED_SESSION · # @no-cookie-jar', () => {
      const http = LAB('practice2.http');
      expect(http.split('\n').filter((line) => line.startsWith('### '))).toEqual(['### 내 로그인 방법', '### 톡 연결 끊기', '### 톡 연결 한 번 더 끊기', '### 인가 서버 연결 끊기', '### 다시 내 로그인 방법']);
      expect(http.match(/^# @no-cookie-jar$/gm)).toHaveLength(5);
    });

    it('🔴 정답 — .http 200 · 200 · 404 · 409 · 200 · 톡을 끊어도 인가 서버로는 로그인 · 소라 409 · 없는 제공자 404 · 로그인 없이 401 · 소라의 톡은 그대로', async () => {
      const got = await observe(LAB('practice2.js'));
      labSeen.practice2Http = got.http;
      expect(got).toEqual(RIGHT);
      labSeen.practice2 = got;
    }, 60_000);

    it('🔴 틀린 판 — 연결한 차례를 거꾸로 돌려주면 상태 코드는 정답과 같고, 첫 응답 본문 {"providers":["talk","lab"]} 가 가린다', async () => {
      const got = await observe(edit1(LAB('practice2.js'), '.map((account) => account.provider);\n}', '.map((account) => account.provider).reverse();\n}'));
      expect(got.http).toEqual(RIGHT.http);
      expect(wrongKeys(got)).toEqual(['bodies']);
      expect(got.bodies[0]).toBe('{"providers":["talk","lab"]}');
    }, 60_000);

    it('🔴 틀린 판 — 로그인하지 않은 «내 로그인 방법» 에 200 빈 목록을 주면 .http 다섯은 정답과 같고, abc 줄(401)이 가린다', async () => {
      const got = await observe(edit1(LAB('practice2.js'), "  if (memberId === undefined) {\n    res.status(401).json({ message: '로그인이 필요해요' });\n    return;\n  }\n\n  res.json({ providers: providersOf(memberId) });", '  res.json({ providers: memberId === undefined ? [] : providersOf(memberId) });'));
      expect(wrongKeys(got)).toEqual(['noLoginList']);
      expect(got.noLoginList).toEqual([200, { providers: [] }]);
    }, 60_000);

    it('🔴 틀린 판 — 하나 남았을 때가 아니라 둘 남았을 때부터 막으면(<= 2) dahye 의 톡 끊기가 409', async () => {
      const got = await observe(edit1(LAB('practice2.js'), '  if (providersOf(memberId).length === 1) {', '  if (providersOf(memberId).length <= 2) {'));
      expect(got.http).toEqual([200, 409, 409, 409, 200]);
      expect(wrongKeys(got)).toContain('http');
    }, 60_000);

    it('🔴 틀린 판 — 마지막 로그인 방법 검사가 없으면 소라가 200', async () => {
      const got = await observe(edit1(LAB('practice2.js'), "  if (providersOf(memberId).length === 1) {\n    res.status(409).json({ message: '마지막 로그인 방법은 끊을 수 없어요' });\n    return;\n  }\n\n", ''));
      expect(got.sora[0]).toBe(200);
      expect(wrongKeys(got)).toEqual(expect.arrayContaining(['sora', 'members']));
    }, 60_000);

    it('🔴 틀린 판 — 제공자 이름으로만 찾으면 dahye 가 소라의 톡을 지운다(회원 목록이 가린다)', async () => {
      const got = await observe(edit1(LAB('practice2.js'), 'socialAccounts.findIndex((account) => account.memberId === memberId && account.provider === req.params.provider)', 'socialAccounts.findIndex((account) => account.provider === req.params.provider)'));
      expect(wrongKeys(got)).toContain('members');
    }, 60_000);
  });

  describe('직접 해보기 3 — 마지막 관리자 지키기(동시 요청)', () => {
    const OK = ['관리자 1 내리기: 내렸어요', '관리자 2 내리기: 마지막 관리자라 내리지 않았어요'];
    /** 스크립트를 n 번 돌려 결과(마지막 줄 · 두 줄의 차례 없는 모양)를 센다 · 끝나면 사람 수와 admin.hong 역할이 그대로인지. */
    const runs = async (source, n) => {
      const tally = {};
      for (let i = 0; i < n; i += 1) {
        const out = await runDbScript('practice3.js', source);
        const lines = out.trimEnd().split('\n');
        const key = `${lines.slice(0, 2).map((line) => line.replace(/^관리자 \d /, '')).sort().join(' / ')} → ${lines[2]}`;
        tally[key] = (tally[key] ?? 0) + 1;
      }
      return tally;
    };
    const guard = async (fn) => {
      await freshGate(stepDir(7));
      await gate("INSERT INTO users (username, role) VALUES ('admin.hong', 'ADMIN')");
      const users = await count('users');
      const result = await fn();
      expect(await count('users')).toBe(users);
      expect((await gate("SELECT role FROM users WHERE username = 'admin.hong'"))[0].role).toBe('ADMIN');
      return result;
    };

    it('🔴 시작 파일(세고 내리기) — 10번 모두 둘 다 내려 0명 · 정답 — 10번 모두 하나만 내려 1명 · 시험용 사람만 다루고 admin.hong 은 그대로', async () => {
      nodeCheck(SNAP('practice3-start.practice3.js'));
      const before = await guard(() => runs(SNAP('practice3-start.practice3.js'), 10));
      expect(before).toEqual({ '내리기: 내렸어요 / 내리기: 내렸어요 → 남은 시험용 관리자: 0명': 10 });
      const after = await guard(() => runs(LAB('practice3.js'), 10));
      expect(after).toEqual({ '내리기: 내렸어요 / 내리기: 마지막 관리자라 내리지 않았어요 → 남은 시험용 관리자: 1명': 10 });
      const sample = await guard(() => runDbScript('practice3.js', LAB('practice3.js')));
      labSeen.practice3 = { before, after, sample, startSample: await guard(() => runDbScript('practice3.js', SNAP('practice3-start.practice3.js'))) };
      expect(OK.map((line) => line.replace(/^관리자 \d /, '')).sort()).toEqual(['내리기: 내렸어요', '내리기: 마지막 관리자라 내리지 않았어요']);
    }, 120_000);

    it('🔴 정답은 시작 파일에서 demote 하나만 바뀐다 — 트랜잭션 + FOR UPDATE', () => {
      const { removed, added } = diffLines(SNAP('practice3-start.practice3.js'), LAB('practice3.js'));
      expect(removed).toContain('  const admins = await prisma.user.count({ where: { role: \'ADMIN\', username: { startsWith: PREFIX } } });');
      expect(added).toContain('    const admins = await tx.$queryRaw`SELECT id FROM users WHERE role = \'ADMIN\' AND username LIKE ${`${PREFIX}%`} FOR UPDATE`;');
    });

    // 🔀 2026-11-15 학생 검수 — 확인 끝에 «FOR UPDATE 만 지우고 한 번 실행하면 0명» 을 더했다(요구사항 3 — 정말 동시에 도는지).
    const ZERO = '내리기: 내렸어요 / 내리기: 내렸어요 → 남은 시험용 관리자: 0명';
    const ONE = '내리기: 내렸어요 / 내리기: 마지막 관리자라 내리지 않았어요 → 남은 시험용 관리자: 1명';
    const dropLock = (source) => edit1(source, '${`${PREFIX}%`} FOR UPDATE`;', '${`${PREFIX}%`}`;');
    const seqCreate = (source) => edit1(source, "const bosses = await Promise.all(['1', '2'].map((name) => prisma.user.create({\n  data: { username: `${PREFIX}${name}`, role: 'ADMIN' },\n  select: { id: true },\n})));", "const bosses = [];\nfor (const name of ['1', '2']) {\n  bosses.push(await prisma.user.create({ data: { username: `${PREFIX}${name}`, role: 'ADMIN' }, select: { id: true } }));\n}");
    const seqDemote = (source) => edit1(source, '  const results = await Promise.all(bosses.map((boss) => demote(boss.id)));', '  const results = [];\n  for (const boss of bosses) results.push(await demote(boss.id));');

    it('🔴 확인 — 정답에서 FOR UPDATE 만 지우면 5번 모두 0명(두 demote 가 정말 동시에 돈다) · 요구사항 3 을 어긴 판(만들기 차례로 · demote 차례로)은 지워도 1명이라 이 줄이 가린다', async () => {
      const noLock = await guard(() => runs(dropLock(LAB('practice3.js')), 5));
      expect(noLock).toEqual({ [ZERO]: 5 });
      const seqC = await guard(() => runs(seqCreate(LAB('practice3.js')), 5));
      expect(seqC).toEqual({ [ONE]: 5 });
      const seqCNoLock = await guard(() => runs(dropLock(seqCreate(LAB('practice3.js'))), 5));
      expect(seqCNoLock[ONE]).toBeGreaterThan(0);
      const seqDNoLock = await guard(() => runs(dropLock(seqDemote(LAB('practice3.js'))), 5));
      expect(seqDNoLock).toEqual({ [ONE]: 5 });
      labSeen.practice3DropLock = { noLock, seqC, seqCNoLock, seqDNoLock };
    }, 180_000);

    it('🔎 맞는 판 — 잠근 다음 count 로 세도 5번 모두 1명(잠금을 기다린 뒤의 세기라서)', async () => {
      const lockThenCount = edit1(LAB('practice3.js'), "    const admins = await tx.$queryRaw`SELECT id FROM users WHERE role = 'ADMIN' AND username LIKE ${`${PREFIX}%`} FOR UPDATE`;\n\n    if (admins.length <= 1)", "    await tx.$queryRaw`SELECT id FROM users WHERE role = 'ADMIN' AND username LIKE ${`${PREFIX}%`} FOR UPDATE`;\n    const admins = await tx.user.count({ where: { role: 'ADMIN', username: { startsWith: PREFIX } } });\n\n    if (admins <= 1)");
      expect(await guard(() => runs(lockThenCount, 5))).toEqual({ [ONE]: 5 });
    }, 120_000);

    it('🔴 틀린 판 둘 — 트랜잭션만(FOR UPDATE 없이 세기) · 내릴 사람 행 하나만 잠그기 — 둘 다 0명이 나온다', async () => {
      const txOnly = edit1(LAB('practice3.js'), "    const admins = await tx.$queryRaw`SELECT id FROM users WHERE role = 'ADMIN' AND username LIKE ${`${PREFIX}%`} FOR UPDATE`;\n\n    if (admins.length <= 1)", "    const admins = await tx.user.count({ where: { role: 'ADMIN', username: { startsWith: PREFIX } } });\n\n    if (admins <= 1)");
      const oneRow = edit1(LAB('practice3.js'), "    const admins = await tx.$queryRaw`SELECT id FROM users WHERE role = 'ADMIN' AND username LIKE ${`${PREFIX}%`} FOR UPDATE`;\n\n    if (admins.length <= 1)", "    await tx.$queryRaw`SELECT id FROM users WHERE id = ${id} FOR UPDATE`;\n    const admins = await tx.user.count({ where: { role: 'ADMIN', username: { startsWith: PREFIX } } });\n\n    if (admins <= 1)");
      const a = await guard(() => runs(txOnly, 10));
      const b = await guard(() => runs(oneRow, 10));
      expect(a['내리기: 내렸어요 / 내리기: 내렸어요 → 남은 시험용 관리자: 0명']).toBeGreaterThan(0);
      expect(b['내리기: 내렸어요 / 내리기: 내렸어요 → 남은 시험용 관리자: 0명']).toBeGreaterThan(0);
      labSeen.practice3Wrong = { txOnly: a, oneRow: b };
    }, 120_000);
  });

  describe('과제 [기초] — 연결 거절 둘', () => {
    it('🔴 시작 파일은 직접 해보기 2 정답을 복사한 것 — 첫 줄 경로만 다르다', () => {
      expect(SNAP('homework1-start.homework1.js')).toBe(LAB('practice2.js').replace('// ~/instagram-api/lab/p3-48/practice2.js\n', '// ~/instagram-api/lab/p3-48/homework1.js\n'));
    });

    /** 확인 절차 — dahye 가 소라의 톡 · 자기 톡 · 하루의 톡 · 자기 톡 다시 · 소라 로그인 · 회원 목록. */
    const observe = (source) => withService('homework1.js', source, async ({ base }) => {
      const tab = browser(base);
      await labGo(tab, '/login', 'dahye');
      const got = {};
      got.soraTalk = await labGo(tab, '/talk/link', 'sora');
      got.afterSora = await membersOf(base);
      got.ownTalk = await labGo(tab, '/talk/link', 'dahye');
      got.haruTalk = await labGo(tab, '/talk/link', 'haru');
      got.ownAgain = await labGo(tab, '/talk/link', 'dahye');
      const sora = browser(base);
      got.soraLogin = await labGo(sora, '/talk', 'sora');
      got.soraMe = (await meOf(sora)).id;
      got.members = await membersOf(base);
      return got;
    });
    const RIGHT = {
      soraTalk: [302, '/?error=SOCIAL_ACCOUNT_TAKEN'],
      afterSora: { 1: ['lab'], 2: ['talk'] },
      ownTalk: [302, '/members'],
      haruTalk: [302, '/?error=PROVIDER_ALREADY_LINKED'],
      ownAgain: [302, '/members'],
      soraLogin: [302, '/me'],
      soraMe: 2,
      members: { 1: ['lab', 'talk'], 2: ['talk'] },
    };
    const wrongKeys = (got) => Object.keys(RIGHT).filter((key) => JSON.stringify(got[key]) !== JSON.stringify(RIGHT[key]));

    it('🔴 정답 — 소라의 톡 계정을 dahye 가 이으면 거절 · 자기 톡은 이어지고 · 하루의 톡(둘째)은 거절 · 다시 이어도 성공 · 소라는 여전히 2번', async () => {
      const got = await observe(LAB('homework1.js'));
      expect(got).toEqual(RIGHT);
      labSeen.homework1 = got;
    }, 60_000);

    it('🔴 homework1.http — 회원 목록 200 · 로그인 없이 내 로그인 방법 401', async () => {
      const http = LAB('homework1.http');
      await withService('homework1.js', LAB('homework1.js'), async () => {
        const out = await httpyacLab('homework1.http', http);
        expect(out).toContain('2 requests processed (2 succeeded)');
        expect(out.match(/^HTTP\/1\.1 (\d+)/gm)).toEqual(['HTTP/1.1 200', 'HTTP/1.1 401']);
      });
    }, 60_000);

    it('🔴 틀린 판 — 거절하지 않고 덮어쓰면(그 톡 계정을 dahye 에게 옮기면) 소라가 톡으로 1번이 된다', async () => {
      const got = await observe(edit1(LAB('homework1.js'), "  if (owner) {\n    res.redirect('/?error=SOCIAL_ACCOUNT_TAKEN');\n    return;\n  }\n", "  if (owner) {\n    owner.memberId = memberId;\n    res.redirect('/members');\n    return;\n  }\n"));
      expect(got.soraMe).toBe(1);
      expect(wrongKeys(got)).toEqual(expect.arrayContaining(['soraTalk', 'soraMe']));
    }, 60_000);

    it('🔴 틀린 판 — 시작 파일(거절 없음) 그대로면 소라의 톡이 dahye 에게도 이어진 것처럼 보인다', async () => {
      const got = await observe(SNAP('homework1-start.homework1.js'));
      expect(got.soraTalk).toEqual([302, '/members']);
      expect(wrongKeys(got)).toEqual(expect.arrayContaining(['soraTalk', 'afterSora']));
    }, 60_000);
  });

  describe('과제 [응용] — 톡의 연결 끊기 알림 받기', () => {
    it('🔴 새 talk-server.js — 220줄 안쪽 · 첫 줄 경로 · 지난 톡 서버에 더하기만 했다 · 4003 번 포트', () => {
      const src = LAB('talk-server.js');
      expect(src.trimEnd().split('\n').length).toBeLessThanOrEqual(220);
      expect(src.split('\n')[0]).toBe('// ~/instagram-api/lab/p3-48/talk-server.js');
      expect(src).toContain('app.listen(4003, () => {');
      const { removed, added } = diffLines(showAt('code/p3-47', 'lab/p3-47/talk-server.js'), src);
      expect(removed).toEqual([
        '// ~/instagram-api/lab/p3-47/talk-server.js',
        '// 사용자 정보를 이만큼(밀리초) 늦게 답한다 — 예: TALK_DELAY=5000 node lab/p3-47/talk-server.js',
      ]);
      labSeen.talkServerDiff = { lines: src.trimEnd().split('\n').length, added: added.length };
      expect(talk.log).toBe(`톡 서버가 ${TALK_PORT}번 포트에서 기다리고 있어요.\n`);
    });

    it('🔴 시작 파일은 직접 해보기 2 정답을 복사한 것 — 첫 줄 경로만 다르다', () => {
      expect(SNAP('homework2-start.homework2.js')).toBe(LAB('practice2.js').replace('// ~/instagram-api/lab/p3-48/practice2.js\n', '// ~/instagram-api/lab/p3-48/homework2.js\n'));
    });

    /** 확인 절차 — 틀린 키 .http · 톡에서 bomi(실습 서비스 회원이 아니다) 연결 끊기 · dahye 톡 연결 · 톡에서 sora 연결 끊기 · sora 로그인 · dahye 연결 끊기 · dahye 로그인 · 같은 알림 다시 · 다른 앱 알림. */
    const observe = (source) => withService('homework2.js', source, async ({ base }) => {
      const got = {};
      const out = await httpyacLab('homework2.http', LAB('homework2.http'));
      got.http = out.match(/^HTTP\/1\.1 (\d+)/gm)?.map((line) => Number(line.slice(9)));
      got.afterWrongKey = await membersOf(base);
      // bomi 의 톡 회원번호 10003 은 인가 서버 dahye 의 값(1번의 lab 연결)과 글자가 같다
      got.bomiUnlinkPage = await unlinkAtTalk('bomi');
      got.afterBomiUnlink = await membersOf(base);
      const dahye = browser(base);
      await labGo(dahye, '/login', 'dahye');
      got.dahyeLink = await labGo(dahye, '/talk/link', 'dahye');
      got.soraUnlinkPage = await unlinkAtTalk('sora');
      got.afterSoraUnlink = await membersOf(base);
      const sora = browser(base);
      got.soraLogin = await labGo(sora, '/talk', 'sora');
      got.soraMe = await meOf(sora);
      got.dahyeUnlinkPage = await unlinkAtTalk('dahye');
      got.dahyeTalkLogin = await labGo(browser(base), '/talk', 'dahye');
      got.again = await unlinkAtTalk('dahye');
      const otherApp = await fetch(`${base}/talk/unlink-webhook`, { method: 'POST', headers: { Authorization: 'TalkAK talk-admin-key' }, body: new URLSearchParams({ app_id: 'other-app', user_id: '10002', referrer_type: 'UNLINK_FROM_APPS' }) });
      got.otherApp = otherApp.status;
      got.members = await membersOf(base);
      return got;
    });
    const RIGHT = {
      http: [401, 200],
      afterWrongKey: { 1: ['lab'], 2: ['talk'] },
      bomiUnlinkPage: '<!doctype html><meta charset="utf-8"><p>실습 서비스와의 연결을 끊었어요.</p><p>앱에 알렸어요.</p>',
      afterBomiUnlink: { 1: ['lab'], 2: ['talk'] },
      dahyeLink: [302, '/members'],
      soraUnlinkPage: '<!doctype html><meta charset="utf-8"><p>실습 서비스와의 연결을 끊었어요.</p><p>앱에 알렸어요.</p>',
      afterSoraUnlink: { 1: ['lab', 'talk'], 2: [] },
      soraLogin: [302, '/me'],
      soraMe: { id: 3, nickname: '소라', email: 'sora@talk.example' },
      dahyeUnlinkPage: '<!doctype html><meta charset="utf-8"><p>실습 서비스와의 연결을 끊었어요.</p><p>앱에 알렸어요.</p>',
      dahyeTalkLogin: [302, '/?error=EMAIL_TAKEN'],
      again: '<!doctype html><meta charset="utf-8"><p>실습 서비스와의 연결을 끊었어요.</p><p>앱에 알렸어요.</p>',
      otherApp: 400,
      members: { 1: ['lab'], 2: [], 3: ['talk'] },
    };
    const wrongKeys = (got) => Object.keys(RIGHT).filter((key) => JSON.stringify(got[key]) !== JSON.stringify(RIGHT[key]));

    it('🔴 정답 — 틀린 키 401 · 행 그대로 · 톡에서 sora 가 연결을 끊으면 소라(2번)의 톡 행이 지워지고 들어올 방법이 없다 · 톡 sora 로그인은 새 회원 · dahye 는 끊긴 뒤 톡 로그인이 EMAIL_TAKEN · 같은 알림 다시 200 · 다른 앱 400', async () => {
      const before = talk.tail().length;
      const got = await observe(LAB('homework2.js'));
      expect(got).toEqual(RIGHT);
      const talkLog = talk.tail().slice(before).split('\n').filter((line) => line.startsWith('[톡] 연결 끊기 알림'));
      expect(talkLog).toEqual(Array(4).fill(`[톡] 연결 끊기 알림 ${LAB_BASE}/talk/unlink-webhook 200`));
      labSeen.homework2 = { ...got, talkLog: talkLog.map((line) => line.replace(LAB_BASE, 'http://localhost:4002')) };
    }, 60_000);

    it('🔴 homework2.http — 틀린 관리자 키 알림 · 회원 목록', () => {
      expect(LAB('homework2.http')).toBe('### 틀린 관리자 키로 연결 끊기 알림\nPOST http://localhost:4002/talk/unlink-webhook\nAuthorization: TalkAK wrong-key\nContent-Type: application/x-www-form-urlencoded\n\napp_id=lab-talk&user_id=10001&referrer_type=UNLINK_FROM_APPS\n\n### 회원 목록\nGET http://localhost:4002/members\n');
    });

    it('🔴 틀린 판 — 관리자 키를 보지 않으면 틀린 키 알림이 200 이고 소라의 톡 행이 지워진다', async () => {
      const got = await observe(edit1(LAB('homework2.js'), "  if (req.headers.authorization !== `TalkAK ${TALK_ADMIN_KEY}`) {\n    res.status(401).json({ message: '관리자 키가 맞지 않아요' });\n    return;\n  }\n\n", ''));
      expect(got.http).toEqual([200, 200]);
      expect(wrongKeys(got)).toEqual(expect.arrayContaining(['http', 'afterWrongKey']));
    }, 60_000);

    it('🔴 틀린 판 — 이미 없으면 404 로 답하면 같은 알림을 다시 받을 때 톡 화면이 «앱이 404로 답했어요.»', async () => {
      const got = await observe(edit1(LAB('homework2.js'), '  if (index !== -1) socialAccounts.splice(index, 1);\n', "  if (index === -1) {\n    res.sendStatus(404);\n    return;\n  }\n\n  socialAccounts.splice(index, 1);\n"));
      expect(got.again).toContain('<p>앱이 404로 답했어요.</p>');
      expect(wrongKeys(got)).toContain('again');
    }, 60_000);

    it('🔴 틀린 판 — 제공자를 보지 않고 계정 번호(user_id)로만 지우면 bomi(10003)의 알림에 1번 dahye 의 인가 서버 연결(10003)이 지워진다', async () => {
      const wrong = edit1(LAB('homework2.js'), "socialAccounts.findIndex((account) => account.provider === 'talk' && account.providerUserId === req.body.user_id)", 'socialAccounts.findIndex((account) => account.providerUserId === req.body.user_id)');
      const got = await observe(wrong);
      expect(got.bomiUnlinkPage).toBe(RIGHT.bomiUnlinkPage);
      expect(got.afterBomiUnlink).toEqual({ 1: [], 2: ['talk'] });
      // bomi 줄이 처음으로 가린다(그 앞의 틀린 키 줄은 정답과 같다)
      expect(wrongKeys(got)[0]).toBe('afterBomiUnlink');
      labSeen.homework2UserIdOnly = { afterBomiUnlink: got.afterBomiUnlink, wrongKeys: wrongKeys(got) };
    }, 60_000);

    it('🔎 bomi 줄이 없던 확인 절차(열 줄)로는 위 틀린 판이 정답과 같았다 — bomi 줄 다음부터의 관찰이 모두 정답과 같다', async () => {
      const wrong = edit1(LAB('homework2.js'), "socialAccounts.findIndex((account) => account.provider === 'talk' && account.providerUserId === req.body.user_id)", 'socialAccounts.findIndex((account) => account.providerUserId === req.body.user_id)');
      const without = (source) => withService('homework2.js', source, async ({ base }) => {
        const dahye = browser(base);
        await labGo(dahye, '/login', 'dahye');
        const got = { dahyeLink: await labGo(dahye, '/talk/link', 'dahye'), soraUnlinkPage: await unlinkAtTalk('sora') };
        got.afterSoraUnlink = await membersOf(base);
        const sora = browser(base);
        got.soraLogin = await labGo(sora, '/talk', 'sora');
        got.soraMe = await meOf(sora);
        got.dahyeUnlinkPage = await unlinkAtTalk('dahye');
        got.dahyeTalkLogin = await labGo(browser(base), '/talk', 'dahye');
        got.again = await unlinkAtTalk('dahye');
        got.members = await membersOf(base);
        return got;
      });
      expect(await without(wrong)).toEqual(await without(LAB('homework2.js')));
    }, 60_000);

    it('🔴 틀린 판 — 톡 계정 번호를 보지 않고 제공자 이름(talk)으로만 지우면 bomi 의 알림이 2번 소라의 톡을 지운다(bomi 줄이 처음으로 가린다)', async () => {
      const before = talk.tail().length;
      const got = await observe(edit1(LAB('homework2.js'), "socialAccounts.findIndex((account) => account.provider === 'talk' && account.providerUserId === req.body.user_id)", "socialAccounts.findIndex((account) => account.provider === 'talk')"));
      const talkLog = talk.tail().slice(before).split('\n').filter((line) => line.startsWith('[톡] 연결 끊기 알림'));
      // 지울 때마다 «처음 만난 톡 행» 을 지운다 — bomi 알림에 소라(2번)의 것, sora 알림에 dahye(1번)의 것, dahye 알림에 새로 가입한 소라(3번)의 것
      expect(got.bomiUnlinkPage).toBe(RIGHT.bomiUnlinkPage);
      expect(got.afterBomiUnlink).toEqual({ 1: ['lab'], 2: [] });
      expect(got.afterSoraUnlink).toEqual({ 1: ['lab'], 2: [] });
      expect(got.members).toEqual({ 1: ['lab'], 2: [], 3: [] });
      expect(talkLog).toEqual(Array(4).fill(`[톡] 연결 끊기 알림 ${LAB_BASE}/talk/unlink-webhook 200`));
      expect(wrongKeys(got)[0]).toBe('afterBomiUnlink');
      labSeen.homework2ProviderOnly = { ...got, talkLog: talkLog.map((line) => line.replace(LAB_BASE, 'http://localhost:4002')), wrongKeys: wrongKeys(got) };
    }, 60_000);
  });
});
