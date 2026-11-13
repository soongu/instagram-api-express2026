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
      expect([other.status, other.body]).toEqual([404, { error: { code: 'SOCIAL_ACCOUNT_NOT_FOUND', message: '연결된 소셜 계정이 없어요' } }]);
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
      expect([res.status, res.body]).toEqual([409, { error: { code: 'LAST_LOGIN_METHOD', message: '마지막 로그인 방법은 끊을 수 없어요' } }]);
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
});

// ── 축 ⑦ Step 7 — 동시에 끊으면 ─────────────────────────────────────────────────
const RUNS = 30;
/**
 * 동시 요청 30번 — 비밀번호 없이 구글·카카오 둘이 이어진 시험용 사람을 만들고, 그 사람의 토큰으로
 * DELETE …/google 과 DELETE …/kakao 를 함께 보낸다. 상태 코드 둘(차례대로)과 남은 소셜 계정 수를 모은다.
 */
const race = async (base) => {
  const out = [];
  for (let run = 0; run < RUNS; run += 1) {
    const tag = randomUUID().slice(0, 8);
    const [{ id }] = await gate("INSERT INTO users (username) VALUES ($1) RETURNING id", [`race.${tag}`]);
    await gate("INSERT INTO social_accounts (user_id, provider, provider_user_id) VALUES ($1, 'google', $2), ($1, 'kakao', $3)", [id, `race-google-${tag}`, `race-kakao-${tag}`]);
    const sid = randomUUID();
    await gate("INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, now() + interval '1 day')", [sid, id]);
    const token = jwt.sign({ sid, role: 'USER' }, SECRET, { subject: String(id), expiresIn: 900, algorithm: 'HS256' });
    const del = (provider) => fetch(`${base}${LIST}/${provider}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).then((res) => res.status);
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

  it('🔴 unlink-race.js — Step 6 서버면 200 · 200 · 0개, Step 7 서버면 200 하나 + 409 하나 · 1개 · 끝나면 시험용 사람이 없다 · 서버가 없으면 알아볼 문장', async () => {
    const src = read(stepDir(7)('lab/p3-48/unlink-race.js'));
    expect(src.split('\n')[0]).toBe('// ~/instagram-api/lab/p3-48/unlink-race.js');
    await freshGate(stepDir(7));
    const users = await count('users');
    const before = await withServer(stepDir(6), async ({ base }) => runRace(stepDir(7), base));
    expect(before).toBe('google 끊기: 200\nkakao 끊기: 200\n남은 소셜 계정: 0개\n');
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

  it('🔴 학생 파일에 내부 어휘가 없다 — 게이트 · 판정 · TDD · Step 번호 · 회차 번호', () => {
    const files = changedStudentFiles('code/p3-47', stepRef(7)).concat(['lab/p3-48/unlink-race.js']);
    for (const rel of files) {
      const text = showAt(stepRef(7), rel);
      expect([rel, /게이트|판정|TDD|Step \d|p3-\d\d/.test(text.replace(/lab\/p3-48\//g, ''))]).toEqual([rel, false]);
    }
  });
});
