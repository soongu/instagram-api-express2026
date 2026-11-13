// p3-47 「제공자 셋 정리 — 탭 둘과 임시 쿠키 · 콜백 주소 · 전략 만드는 함수 · 카카오 이메일」 게이트 — 백엔드
// 내부 검증 전용 — 교안에 한 줄도 인용하지 않는다.
//
// `7-express-auth` 열두째 회차다(`curriculum.md` 「`p3-47` 착수 결정」).
// 수업 백엔드는 Step 2 · Step 4 · Step 6 에서만 고친다(Step 1·3·5·7 은 코드 변경 없음).
// Step 마다의 판은 커밋 제목의 «(Step N)» 표식으로 꺼낸다(같은 표식이 여럿이면 가장 뒤 커밋). Step 1 은 `code/p3-46` 이다.
// 🔑 진짜 구글·카카오·네이버에는 요청을 보내지 않는다 — 학생 파일 사본의 제공자 주소(셋씩)만 가짜 제공자로 바꿔 띄운다
//    (`replaceAll` · 바꿀 글자가 없으면 던진다 · 바꾼 뒤 진짜 주소가 남아 있으면 던진다).
// 🔑 판정에는 화면이 없으니 백엔드 주소를 화면 주소(`SITE_URL`)로 삼는다 — 콜백이 곧바로 백엔드로 돌아온다.
// 🔑 «탭 둘» 은 쿠키 단지 하나(`browser`)로 잰다 — 브라우저의 탭 둘은 쿠키 단지를 함께 쓴다.
// 🔑 짓는 동안 `P347_WT=N` 을 주면 Step N 의 판을 커밋 대신 작업트리에서 읽는다(Red 를 실제 동작으로 보려고).
// 🔑 포트 — 수업 백엔드 3980 · 가짜 구글 3981 · 가짜 카카오 3982 · 가짜 네이버 3983 · 실습 서버 3984~3989.
//
// 축 ① Step 1(code/p3-46) — 임시 쿠키 셋 · 탭 둘 차례 ①·② · 돌아갈 곳
// 축 ② Step 2 — 임시 쿠키 이름에 제공자 · 탭 둘이 둘 다 로그인 · 틀린 판 셋
// 축 ③ Step 4 — 전략 만드는 함수 하나 + 제공자 설정 셋 · Step 2 와 같은 동작 · 틀린 판 둘
// 축 ④ Step 6 — 카카오 이메일 · 확인 여부 · 이미 가입한 카카오 사람 · EMAIL_TAKEN · 틀린 판 셋
// 축 ⑤ 파생 대조 — 세 전략 파일의 줄 수 · 같은 줄 · Step 6 은 한 파일
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
import { startFakeGoogle, DEFAULT_PROFILE as DEFAULT_GOOGLE_PROFILE } from './helpers/fake-google.js';
import {
  startFakeKakao, DEFAULT_KAKAO_PROFILE, KAKAO_EMAIL_VALID, KAKAO_EMAIL_INVALID, KAKAO_EMAIL_UNVERIFIED, KAKAO_EMAIL_NOT_AGREED, KAKAO_NO_ACCOUNT,
} from './helpers/fake-kakao.js';
import { startFakeNaver } from './helpers/fake-naver.js';

const ROOT = new URL('../', import.meta.url);
const P = (rel) => new URL(rel, ROOT).pathname;
const read = (path) => readFileSync(path, 'utf8');
const ADMIN = { host: 'localhost', port: 5432, database: 'postgres', user: 'postgres', password: 'postgres' };
const TPL_DB = 'p347_tpl';
const GATE_DB = 'p347_gate';
const GATE_URL = `postgresql://postgres:postgres@localhost:5432/${GATE_DB}`;
const PORT = 3980;
const GOOGLE_PORT = 3981;
const KAKAO_PORT = 3982;
const NAVER_PORT = 3983;
const SITE = `http://localhost:${PORT}`;

// 이 회차 북마크 `code/p3-47` 을 풀어서 읽는다(없으면 작업트리 — 이 회차를 짓는 동안).
const ROUND = roundDir('code/p3-47');
const R = (rel) => join(ROUND.dir, rel);

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
const LINE = hasRef('refs/heads/code/p3-47') ? 'code/p3-47' : 'main';
const WT = process.env.P347_WT ? Number(process.env.P347_WT) : null;
const commitOf = (n) => {
  const log = execFileSync('git', ['log', '--format=%H %s', `code/p3-46..${LINE}`], { cwd: P('.'), encoding: 'utf8' });
  const hits = log.split('\n').filter((l) => / feat\(p3-47\): /.test(l) && l.endsWith(`(Step ${n})`));
  if (hits.length === 0) throw new Error(`(Step ${n}) 커밋이 없다`);
  return hits[0].split(' ')[0];
};
const dirs = [];
const refDirs = new Map();
/** 커밋(또는 브랜치) 하나를 임시 폴더에 풀어 둔다. */
const refDir = (ref) => {
  if (refDirs.has(ref)) return refDirs.get(ref);
  const dir = mkdtempSync(join(tmpdir(), 'p347-ref-'));
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
  return n === 1 ? refDir('code/p3-46') : refDir(commitOf(n));
};
const stepRef = (n) => (n === 1 ? 'code/p3-46' : commitOf(n));
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
const counts = async () => [await count('users'), await count('social_accounts'), await count('sessions')];
const lastUserId = async () => Number((await gate('SELECT last_value FROM users_id_seq'))[0].last_value);

const replaceIn = (dir, rel, a, b) => {
  const text = read(join(dir, rel));
  if (text.split(a).length !== 2) throw new Error(`${rel} 에 바꿀 글자가 없거나 여럿이다: ${a}`);
  writeFileSync(join(dir, rel), text.replace(a, b));
};
const fakes = {};
/**
 * 제공자 주소만 가짜 제공자로 바꾼다 — 주소는 Step 1·2 에는 전략 파일에, Step 4 부터는 제공자 설정 파일에 있다.
 * 어느 꼴이든 `strategies/{제공자}.js` 한 파일에 셋이 다 있어야 하고, 그 밖의 전략 폴더 파일에는 진짜 주소가 없어야 한다.
 */
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
  const dir = mkdtempSync(join(tmpdir(), 'p347-srv-'));
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
/** 그 판의 학생 파일 사본을 띄운다 — `fake` 면 제공자 주소를 가짜 제공자로 바꾼 사본. `edit` 은 가짜로 바꾼 «뒤» 에 돈다. */
const withServer = async (from, fn, { edit, fake = true, port = PORT, extraEnv, without } = {}) => {
  const dir = studentDir(from, (d) => {
    if (fake) useFakes(d);
    if (edit) edit(d);
  });
  const srv = await start(dir, { port, extraEnv, without });
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
    login: (username, password = `${username}1234`) => send('POST', '/api/v2/auth/login', { username, password }),
    /** 쿠키 하나를 단지에 직접 넣는다 — 지난 버전의 서버가 남겨 둔 쿠키를 흉내 낼 때. */
    put: (name, value, path) => jar.set(`${name} ${path}`, { name, value, path }),
    cookie: (name) => [...jar.values()].find((c) => c.name === name)?.value,
    cookies: () => [...jar.values()].map((c) => `${c.name} ${c.path}`).sort(),
  };
};

const cookieNames = (res) => res.setCookies.map((line) => line.slice(0, line.indexOf('=')));
/** 지운다는 쿠키 줄의 이름 — `Expires=Thu, 01 Jan 1970` 인 줄. */
const clearedNames = (res) => res.setCookies.filter((line) => /Expires=Thu, 01 Jan 1970/.test(line)).map((line) => line.slice(0, line.indexOf('=')));
/** 쿠키 줄에서 값과 날짜만 지운다 — 옵션 글자를 비교하려고. */
const cookieShape = (line) => line.replace(/^([^=]+)=[^;]+/, '$1=…').replace(/Expires=(?!Thu, 01 Jan 1970)[^;]+/, 'Expires=…');
const s256 = (verifier) => createHash('sha256').update(verifier).digest('base64url');
/** 시작 주소의 Location 을 쿼리째 나눈다. */
const authorizeQuery = (location) => {
  const url = new URL(location);
  return { origin: `${url.origin}${url.pathname}`, query: Object.fromEntries(url.searchParams), keys: [...url.searchParams.keys()] };
};
const callbackOf = (provider) => `${SITE}/api/v2/auth/${provider}/callback`;
const LOGIN_FAILED_PAGE = '/login?error=SOCIAL_LOGIN_FAILED';
const userRow = async (id) => (await gate('SELECT id, username, email, name, password_hash, role FROM users WHERE id = $1', [id]))[0];
const socialRows = () => gate('SELECT user_id, provider, provider_user_id FROM social_accounts ORDER BY id');
/** 터미널 글자에서 실행마다 다른 것(임시 폴더 · 걸린 시간 · 값)만 지운다 — 교안에 인용할 글자를 보고에 남기려고. */
const seen = {};
const scrub = (text, dir) => text.replaceAll(`/private${dir}`, '~/instagram-api').replaceAll(dir, '~/instagram-api').replace(/\d+\.\d+ms/g, 'N.Nms')
  .replace(/(code|state)=[A-Za-z0-9_-]+/g, '$1=…');

/** 시작 주소를 연다 — 브라우저처럼 그 탭의 쿠키 단지로. */
const begin = (tab, provider, next) => tab.get(next === undefined ? `/api/v2/auth/${provider}` : `/api/v2/auth/${provider}?next=${encodeURIComponent(next)}`);
/** (가짜) 제공자의 동의를 지나 돌아올 주소(경로 + 쿼리)를 받아 둔다 — 아직 우리 서버로 돌아가지 않는다. */
const consentOf = async (started) => {
  const consent = await fetch(started.location, { redirect: 'manual' });
  const back = new URL(consent.headers.get('location'));
  expect(back.origin).toBe(SITE);
  return `${back.pathname}${back.search}`;
};
/** 소셜 로그인 한 바퀴 — 시작 → (가짜) 제공자의 동의 → 콜백. `tamper` 는 돌아오는 주소의 state 를 바꾼다. */
const socialLogin = async (tab, provider, { next, tamper } = {}) => {
  const started = await begin(tab, provider, next);
  if (started.status !== 302) return { started };
  let back = await consentOf(started);
  if (tamper !== undefined) back = back.replace(/state=[^&]+/, `state=${tamper}`);
  const callback = await tab.get(back);
  return { started, callback };
};
const whoAmI = async (tab) => (await tab.get('/api/v2/auth/me')).body.data?.username;
/**
 * 탭 둘 — 탭 A 는 구글(?next=/jaehoon), 탭 B 는 카카오(?next=/). 둘 다 동의 화면까지 다녀온 뒤 `order` 차례로 돌아온다.
 * 브라우저의 탭 둘은 쿠키 단지를 함께 쓰므로 브라우저 하나로 잰다.
 */
const twoTabs = async (base, order, { a = 'google', b = 'kakao', aNext = '/jaehoon', bNext = '/' } = {}) => {
  const tab = browser(base);
  const out = { steps: [] };
  const record = (label, res) => out.steps.push({ label, status: res.status, location: res.location, setCookie: cookieNames(res), cleared: clearedNames(res), jar: tab.cookies() });
  const startA = await begin(tab, a, aNext);
  record(`${a} 시작(탭 A)`, startA);
  out.stateA = authorizeQuery(startA.location).query.state;
  const startB = await begin(tab, b, bNext);
  record(`${b} 시작(탭 B)`, startB);
  out.stateB = authorizeQuery(startB.location).query.state;
  out.jarAfterStarts = Object.fromEntries(tab.cookies().map((key) => [key, tab.cookie(key.split(' ')[0])]));
  const [backA, backB] = [await consentOf(startA), await consentOf(startB)];
  const backs = { A: backA, B: backB };
  for (const which of order) {
    const res = await tab.get(backs[which]);
    record(`${which === 'A' ? a : b} 콜백(탭 ${which})`, res);
    out[which] = { status: res.status, location: res.location };
    if (res.status === 302 && !res.location.startsWith('/login')) out[`${which}User`] = await whoAmI(tab);
  }
  out.jarAtEnd = tab.cookies();
  return out;
};

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
  // 이번 회차는 스키마를 안 고친다 — 마이그레이션은 `code/p3-46` 과 같다.
  for (const dir of readdirSync(R('prisma/migrations')).filter((name) => name !== 'migration_lock.toml').sort()) {
    await tpl.query(read(R(`prisma/migrations/${dir}/migration.sql`)));
  }
  await tpl.end();
  execFileSync(process.execPath, [R('seed.js')], {
    cwd: ROUND.dir, encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: `postgresql://postgres:postgres@localhost:5432/${TPL_DB}` },
  });
  // 이메일로 가입한 사람(p3-22 의 가입 장면과 같은 값)
  const hash = await bcrypt.hash('yuna1234', 12);
  const after = new pg.Client({ ...ADMIN, database: TPL_DB });
  await after.connect();
  await after.query("INSERT INTO users (username, name, email, password_hash) VALUES ('yuna', '김유나', 'yuna@example.com', $1)", [hash]);
  await after.end();
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
  // 교안에 인용할 실측 글자 — `P347_SEEN=경로` 를 주면 파일로 남긴다(보고용).
  if (process.env.P347_SEEN) writeFileSync(process.env.P347_SEEN, JSON.stringify(seen, null, 2));
});

beforeEach(() => {
  for (const fake of Object.values(fakes)) fake.reset();
});

// ── 축 ① Step 1 — 지난 회차(code/p3-46) 그대로 ──────────────────────────────
describe('축 ① Step 1(code/p3-46) — 로그인 한 번에 오가는 임시 쿠키 셋 · 탭 둘', () => {
  it('🔴 시작 응답의 임시 쿠키 셋 — oauth_next · oauth_state · oauth_verifier · 셋 다 Path=/api/v2/auth · Max-Age=600 · HttpOnly · SameSite=Lax', async () => {
    await withServer(stepDir(1), async ({ base }) => {
      const tab = browser(base);
      const res = await begin(tab, 'google', '/jaehoon');
      expect(res.status).toBe(302);
      expect(res.setCookies.map(cookieShape)).toEqual([
        'oauth_next=…; Max-Age=600; Path=/api/v2/auth; Expires=…; HttpOnly; SameSite=Lax',
        'oauth_state=…; Max-Age=600; Path=/api/v2/auth; Expires=…; HttpOnly; SameSite=Lax',
        'oauth_verifier=…; Max-Age=600; Path=/api/v2/auth; Expires=…; HttpOnly; SameSite=Lax',
      ]);
      // 돌아갈 곳은 주소 글자로 담긴다(/ 가 %2F)
      expect(tab.cookie('oauth_next')).toBe('%2Fjaehoon');
      expect(tab.cookie('oauth_state')).toBe(authorizeQuery(res.location).query.state);
      expect(s256(tab.cookie('oauth_verifier'))).toBe(authorizeQuery(res.location).query.code_challenge);
      seen.step1StartSetCookie = res.setCookies.map((line) => line.replace(/^([^=]+)=([^;]*)/, (all, name, value) => (name === 'oauth_next' ? all : `${name}=…`)).replace(/Expires=[^;]+/, 'Expires=…'));
    });
  }, 30_000);

  it('🔴 로그인 한 번 — 콜백 응답이 임시 쿠키 셋을 지우고 토큰 쿠키 둘을 준다(차례: oauth_state · oauth_verifier 지움 → accessToken · refreshToken → oauth_next 지움)', async () => {
    await freshGate();
    await withServer(stepDir(1), async ({ base }) => {
      const tab = browser(base);
      const { callback } = await socialLogin(tab, 'google', { next: '/jaehoon' });
      expect([callback.status, callback.location]).toEqual([302, '/jaehoon']);
      expect(cookieNames(callback)).toEqual(['oauth_state', 'oauth_verifier', 'accessToken', 'refreshToken', 'oauth_next']);
      expect(clearedNames(callback)).toEqual(['oauth_state', 'oauth_verifier', 'oauth_next']);
      expect(tab.cookies()).toEqual(['accessToken /', 'refreshToken /api/v2/auth']);
      seen.step1CallbackSetCookie = callback.setCookies.map(cookieShape);
    });
  }, 30_000);

  it('🔴 차례 ① 구글 시작(A) → 카카오 시작(B) → 카카오 콜백(B) → 구글 콜백(A) — B 는 302 / 로 카카오 사람 · A 는 302 /login?error=SOCIAL_LOGIN_FAILED · 토큰을 묻지도 않는다', async () => {
    await freshGate();
    await withServer(stepDir(1), async ({ base }) => {
      const before = await counts();
      const got = await twoTabs(base, ['B', 'A']);
      // 카카오를 시작한 순간 세 쿠키가 모두 카카오 것으로 바뀐다 — 구글 탭의 state 는 단지에 없다
      expect(got.jarAfterStarts).toEqual({ 'oauth_next /api/v2/auth': '%2F', 'oauth_state /api/v2/auth': got.stateB, 'oauth_verifier /api/v2/auth': expect.any(String) });
      expect(got.stateA).not.toBe(got.stateB);
      expect(got.B).toEqual({ status: 302, location: '/' });
      expect(got.BUser).toBe('kakao');
      expect(got.A).toEqual({ status: 302, location: LOGIN_FAILED_PAGE });
      expect(got.steps.map((s) => [s.label, s.setCookie])).toEqual([
        ['google 시작(탭 A)', ['oauth_next', 'oauth_state', 'oauth_verifier']],
        ['kakao 시작(탭 B)', ['oauth_next', 'oauth_state', 'oauth_verifier']],
        ['kakao 콜백(탭 B)', ['oauth_state', 'oauth_verifier', 'accessToken', 'refreshToken', 'oauth_next']],
        ['google 콜백(탭 A)', ['oauth_state', 'oauth_verifier']],
      ]);
      expect(got.jarAtEnd).toEqual(['accessToken /', 'refreshToken /api/v2/auth']);
      expect(fakes.google.state.log.token).toEqual([]);
      expect(fakes.kakao.state.log.token).toHaveLength(1);
      expect(await counts()).toEqual([before[0] + 1, before[1] + 1, before[2] + 1]);
      seen.step1Order1 = got;
    });
  }, 30_000);

  it('🔴 차례 ② 구글 시작(A) → 카카오 시작(B) → 구글 콜백(A) → 카카오 콜백(B) — 둘 다 302 /login?error=SOCIAL_LOGIN_FAILED · 행이 안 생긴다 · oauth_next 는 남는다', async () => {
    await freshGate();
    await withServer(stepDir(1), async ({ base }) => {
      const before = await counts();
      const got = await twoTabs(base, ['A', 'B']);
      expect(got.A).toEqual({ status: 302, location: LOGIN_FAILED_PAGE });
      expect(got.B).toEqual({ status: 302, location: LOGIN_FAILED_PAGE });
      // A 가 먼저 돌아와 쿠키의 state(카카오 것)와 맞지 않는다 — 그때 state·verifier 를 지워서 B 는 쿠키가 없다
      expect(got.steps[2].setCookie).toEqual(['oauth_state', 'oauth_verifier']);
      expect(got.steps[2].jar).toEqual(['oauth_next /api/v2/auth']);
      expect(got.steps[3].setCookie).toEqual(['oauth_state', 'oauth_verifier']);
      expect(got.jarAtEnd).toEqual(['oauth_next /api/v2/auth']);
      expect(fakes.google.state.log.token).toEqual([]);
      expect(fakes.kakao.state.log.token).toEqual([]);
      expect(await counts()).toEqual(before);
      seen.step1Order2 = got;
    });
  }, 30_000);

  it('🔎 돌아갈 곳(oauth_next)도 덮어쓰지만 지금 판에서는 겉으로 안 보인다 — 살아남는 쪽은 늘 «나중에 시작한» 탭이라 자기 next 로 간다', async () => {
    await freshGate();
    await withServer(stepDir(1), async ({ base }) => {
      // 카카오(/)를 먼저, 구글(/jaehoon)을 나중에 시작하고 구글이 먼저 돌아온다 — 살아남은 구글은 자기 /jaehoon 으로
      const got = await twoTabs(base, ['B', 'A'], { a: 'kakao', b: 'google', aNext: '/', bNext: '/jaehoon' });
      expect(got.jarAfterStarts['oauth_next /api/v2/auth']).toBe('%2Fjaehoon');
      expect(got.A).toEqual({ status: 302, location: LOGIN_FAILED_PAGE });
      expect(got.B).toEqual({ status: 302, location: '/jaehoon' });
      expect(got.BUser).toBe('minji.kim');
      seen.step1NextHidden = { order: 'kakao(/) 시작 → google(/jaehoon) 시작 → google 콜백 → kakao 콜백', A: got.A, B: got.B, BUser: got.BUser };
    });
  }, 30_000);
});

// ── 축 ② Step 2 ──────────────────────────────────────────────────────────────
const STEP2_STORE = `// ~/instagram-api/strategies/stateStore.js
import { randomBytes } from 'node:crypto';

// 제공자에 다녀오는 동안만 쓰는 쿠키 — 10분 뒤에 사라지고, 인증 주소로 가는 요청에만 실려 간다.
export const tempCookie = { httpOnly: true, sameSite: 'lax', path: '/api/v2/auth', maxAge: 1000 * 60 * 10 };

// state 와 PKCE 의 code_verifier 를 쿠키에 맡겨 두는 저장소를 만든다 — 우리 서버에는 세션이 없어서 직접 만든다.
// 쿠키 이름에 제공자 이름을 붙인다 — 두 제공자에 함께 다녀와도 서로의 값을 덮어쓰지 않게.
export function createStateStore(provider) {
  const stateCookie = \`oauth_state_\${provider}\`;
  const verifierCookie = \`oauth_verifier_\${provider}\`;

  return {
    // 제공자로 보내기 직전에 불린다 — state 를 새로 만들어 code_verifier 와 함께 쿠키에 둔다.
    store(req, verifier, state, meta, callback) {
      const value = randomBytes(16).toString('base64url');

      req.res.cookie(stateCookie, value, tempCookie);
      req.res.cookie(verifierCookie, verifier, tempCookie);
      callback(null, value);
    },

    // 제공자에서 돌아왔을 때 불린다 — 주소의 state 가 쿠키의 것과 같을 때만 code_verifier 를 돌려준다.
    verify(req, state, callback) {
      const saved = req.cookies[stateCookie];
      const verifier = req.cookies[verifierCookie];

      // 한 번 쓴 값은 지운다 — 쿠키는 이름과 path 가 같아야 같은 쿠키다.
      req.res.clearCookie(stateCookie, { path: tempCookie.path });
      req.res.clearCookie(verifierCookie, { path: tempCookie.path });

      if (!saved || saved !== state) {
        callback(null, false, { message: 'state가 달라요' });
        return;
      }

      callback(null, verifier);
    },
  };
}
`;
const changedStudentFiles = (from, to) => execFileSync('git', ['diff', '--name-only', from, to, '--', ...STUDENT_FILES], { cwd: P('.'), encoding: 'utf8' }).trim().split('\n').filter(Boolean);
/** 두 글의 다른 줄 — `diff` 가 지운 줄(`<`)과 더한 줄(`>`)을 차례대로 돌려준다. */
const diffLines = (a, b) => {
  const dir = mkdtempSync(join(tmpdir(), 'p347-diff-'));
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
    raw: out,
  };
};
const tempShape = (name) => `${name}=…; Max-Age=600; Path=/api/v2/auth; Expires=…; HttpOnly; SameSite=Lax`;
const clearShape = (name) => `${name}=; Path=/api/v2/auth; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;

describe('축 ② Step 2 — 임시 쿠키 이름에 제공자를 붙인다', () => {
  const src = (rel) => read(stepDir(2)(rel));

  it('🔴 stateStore.js — 저장소 객체 대신 createStateStore(provider) · 쿠키 이름 oauth_state_{제공자} · oauth_verifier_{제공자} · store 는 인자 다섯 그대로', () => {
    expect(src('strategies/stateStore.js')).toBe(STEP2_STORE);
  });

  it('🔴 authController.js — rememberNext·socialCallback 이 제공자 이름을 받아 미들웨어를 돌려준다 · 쿠키 이름 oauth_next_{제공자} · 그 밖의 줄은 그대로', () => {
    const before = showAt('code/p3-46', 'controllers/authController.js');
    const expected = [
      [`// 구글로 떠나기 전에, 다녀온 뒤 돌아갈 곳(주소의 ?next=)을 쿠키에 맡겨 둔다.
export function rememberNext(req, res, next) {
  res.cookie('oauth_next', safeNextPath(req.query.next), tempCookie);
  next();
}`, `// 제공자로 떠나기 전에, 다녀온 뒤 돌아갈 곳(주소의 ?next=)을 쿠키에 맡겨 둔다.
// 쿠키 이름에 제공자 이름을 붙인다 — 두 제공자에 함께 다녀와도 돌아갈 곳이 섞이지 않게.
export function rememberNext(provider) {
  const nextCookie = \`oauth_next_\${provider}\`;

  return (req, res, next) => {
    res.cookie(nextCookie, safeNextPath(req.query.next), tempCookie);
    next();
  };
}`],
      [`// 구글을 다녀온 사람(req.user)에게 로그인을 준다 — 비밀번호 로그인과 같은 로그인 기록, 같은 쿠키 둘.
// 브라우저가 문서로 연 주소라 JSON 대신 보던 곳으로 보낸다.
export async function socialCallback(req, res) {
  const tokens = await authService.startSession(req.user);

  setTokenCookies(res, tokens);
  res.clearCookie('oauth_next', { path: tempCookie.path });
  res.redirect(safeNextPath(req.cookies.oauth_next));
}`, `// 제공자에게 다녀온 사람(req.user)을 로그인시킨다 — 비밀번호 로그인과 같은 로그인 기록을 남기고, 같은 쿠키 둘을 준다.
// 브라우저가 문서로 연 주소라 JSON 대신 보던 곳으로 보낸다.
export function socialCallback(provider) {
  const nextCookie = \`oauth_next_\${provider}\`;

  return async (req, res) => {
    const tokens = await authService.startSession(req.user);

    setTokenCookies(res, tokens);
    res.clearCookie(nextCookie, { path: tempCookie.path });
    res.redirect(safeNextPath(req.cookies[nextCookie]));
  };
}`],
    ].reduce((text, [a, b]) => {
      expect(text.split(a)).toHaveLength(2);
      return text.replace(a, b);
    }, before);
    expect(src('controllers/authController.js')).toBe(expected);
  });

  it('🔴 routes/auth.js — 여섯 줄만 바꿨다(제공자마다 rememberNext(이름) · socialCallback(이름))', () => {
    const { removed, added } = diffLines(showAt('code/p3-46', 'routes/auth.js'), src('routes/auth.js'));
    expect(removed).toHaveLength(6);
    expect(added).toEqual(PROVIDERS.flatMap((p) => [
      `router.get('/${p}', authController.rememberNext('${p}'), passport.authenticate('${p}', { session: false }));`,
      `  authController.socialCallback('${p}'),`,
    ]));
  });

  it('🔴 전략 파일 셋 — import 줄과 store 줄, 두 줄씩만 바꿨다', () => {
    for (const p of PROVIDERS) {
      const { removed, added } = diffLines(showAt('code/p3-46', `strategies/${p}.js`), src(`strategies/${p}.js`));
      expect([p, removed]).toEqual([p, ["import { stateStore } from './stateStore.js';", '    store: stateStore,']]);
      expect([p, added]).toEqual([p, ["import { createStateStore } from './stateStore.js';", `    store: createStateStore('${p}'),`]]);
    }
  });

  it('🔴 Step 2 가 고친 학생 파일은 여섯 — 전략 셋 · stateStore · 컨트롤러 · 라우터 · 새 패키지 0 · 마이그레이션 0', () => {
    expect(changedStudentFiles('code/p3-46', stepRef(2))).toEqual([
      'controllers/authController.js', 'routes/auth.js', 'strategies/google.js', 'strategies/kakao.js', 'strategies/naver.js', 'strategies/stateStore.js',
    ]);
  });

  it('🔴 시작 응답의 임시 쿠키 셋에 제공자 이름이 붙는다 — 옵션은 그대로(Path=/api/v2/auth · Max-Age=600 · HttpOnly · SameSite=Lax)', async () => {
    await withServer(stepDir(2), async ({ base }) => {
      for (const p of PROVIDERS) {
        const tab = browser(base);
        const res = await begin(tab, p, '/jaehoon');
        expect(res.setCookies.map(cookieShape)).toEqual([tempShape(`oauth_next_${p}`), tempShape(`oauth_state_${p}`), tempShape(`oauth_verifier_${p}`)]);
        expect(tab.cookie(`oauth_state_${p}`)).toBe(authorizeQuery(res.location).query.state);
        expect(s256(tab.cookie(`oauth_verifier_${p}`))).toBe(authorizeQuery(res.location).query.code_challenge);
        if (p === 'google') seen.step2StartSetCookie = res.setCookies.map((line) => line.replace(/^([^=]+)=([^;]*)/, (all, name) => (name.startsWith('oauth_next') ? all : `${name}=…`)).replace(/Expires=[^;]+/, 'Expires=…'));
      }
    });
  }, 30_000);

  it('🔴 차례 ① — 둘 다 로그인된다 · 카카오 탭은 / · 구글 탭은 /jaehoon · 콜백마다 그 제공자의 임시 쿠키 셋만 지운다', async () => {
    await freshGate();
    await withServer(stepDir(2), async ({ base }) => {
      const before = await counts();
      const got = await twoTabs(base, ['B', 'A']);
      expect(got.jarAfterStarts).toMatchObject({ 'oauth_state_google /api/v2/auth': got.stateA, 'oauth_state_kakao /api/v2/auth': got.stateB, 'oauth_next_google /api/v2/auth': '%2Fjaehoon', 'oauth_next_kakao /api/v2/auth': '%2F' });
      expect(Object.keys(got.jarAfterStarts)).toHaveLength(6);
      expect(got.B).toEqual({ status: 302, location: '/' });
      expect(got.BUser).toBe('kakao');
      expect(got.A).toEqual({ status: 302, location: '/jaehoon' });
      expect(got.AUser).toBe('minji.kim');
      expect(got.steps[2].setCookie).toEqual(['oauth_state_kakao', 'oauth_verifier_kakao', 'accessToken', 'refreshToken', 'oauth_next_kakao']);
      expect(got.steps[2].cleared).toEqual(['oauth_state_kakao', 'oauth_verifier_kakao', 'oauth_next_kakao']);
      // 카카오 콜백 뒤에도 구글의 임시 쿠키 셋은 그대로다
      expect(got.steps[2].jar).toEqual(['accessToken /', 'oauth_next_google /api/v2/auth', 'oauth_state_google /api/v2/auth', 'oauth_verifier_google /api/v2/auth', 'refreshToken /api/v2/auth']);
      expect(got.steps[3].cleared).toEqual(['oauth_state_google', 'oauth_verifier_google', 'oauth_next_google']);
      expect(got.jarAtEnd).toEqual(['accessToken /', 'refreshToken /api/v2/auth']);
      expect(await counts()).toEqual([before[0] + 2, before[1] + 2, before[2] + 2]);
      seen.step2Order1 = got;
    });
  }, 30_000);

  it('🔴 차례 ② — 둘 다 로그인된다 · 구글 탭은 /jaehoon · 카카오 탭은 / · 마지막에 로그인한 사람(카카오)의 토큰이 단지에 남는다', async () => {
    await freshGate();
    await withServer(stepDir(2), async ({ base }) => {
      const got = await twoTabs(base, ['A', 'B']);
      expect(got.A).toEqual({ status: 302, location: '/jaehoon' });
      expect(got.AUser).toBe('minji.kim');
      expect(got.B).toEqual({ status: 302, location: '/' });
      expect(got.BUser).toBe('kakao');
      expect(got.steps[2].cleared).toEqual(['oauth_state_google', 'oauth_verifier_google', 'oauth_next_google']);
      expect(got.steps[3].cleared).toEqual(['oauth_state_kakao', 'oauth_verifier_kakao', 'oauth_next_kakao']);
      expect(got.jarAtEnd).toEqual(['accessToken /', 'refreshToken /api/v2/auth']);
      seen.step2Order2 = got;
    });
  }, 30_000);

  it('🔴 한 제공자 안에서 고친 state 는 여전히 302 /login?error=SOCIAL_LOGIN_FAILED · 토큰을 묻지 않는다 · 쿠키 없이 온 콜백도', async () => {
    await freshGate();
    await withServer(stepDir(2), async ({ base }) => {
      const before = await counts();
      for (const p of PROVIDERS) {
        const tampered = await socialLogin(browser(base), p, { tamper: 'forged' });
        expect([p, tampered.callback.status, tampered.callback.location]).toEqual([p, 302, LOGIN_FAILED_PAGE]);
        expect(clearedNames(tampered.callback)).toEqual([`oauth_state_${p}`, `oauth_verifier_${p}`]);
        const started = await begin(browser(base), p);
        const noCookie = await browser(base).get(await consentOf(started));
        expect([p, noCookie.status, noCookie.location]).toEqual([p, 302, LOGIN_FAILED_PAGE]);
      }
      for (const p of PROVIDERS) expect([p, fakes[p].state.log.token]).toEqual([p, []]);
      expect(await counts()).toEqual(before);
    });
  }, 30_000);

  it('🔴 옛 이름의 쿠키(oauth_state · oauth_verifier · oauth_next)가 남아 있어도 로그인에 영향이 없다 — 새 판은 그 쿠키를 읽지도 지우지도 않는다', async () => {
    await freshGate();
    await withServer(stepDir(2), async ({ base }) => {
      const tab = browser(base);
      tab.put('oauth_state', 'old-state', '/api/v2/auth');
      tab.put('oauth_verifier', 'old-verifier', '/api/v2/auth');
      tab.put('oauth_next', '%2Fminji', '/api/v2/auth');
      const { callback } = await socialLogin(tab, 'kakao', { next: '/' });
      expect([callback.status, callback.location]).toEqual([302, '/']);
      expect(cookieNames(callback)).not.toContain('oauth_state');
      expect(tab.cookies()).toEqual(['accessToken /', 'oauth_next /api/v2/auth', 'oauth_state /api/v2/auth', 'oauth_verifier /api/v2/auth', 'refreshToken /api/v2/auth']);
    });
  }, 30_000);

  it('🔎 같은 제공자를 탭 둘에서 시작하면 여전히 먼저 시작한 탭이 실패한다 — 이름에 제공자를 붙여도 같은 제공자끼리는 같은 쿠키다', async () => {
    await freshGate();
    await withServer(stepDir(2), async ({ base }) => {
      const got = await twoTabs(base, ['B', 'A'], { a: 'google', b: 'google', aNext: '/jaehoon', bNext: '/' });
      expect(got.B).toEqual({ status: 302, location: '/' });
      expect(got.A).toEqual({ status: 302, location: LOGIN_FAILED_PAGE });
      seen.step2SameProviderTwoTabs = { A: got.A, B: got.B };
    });
  }, 30_000);

  it('🔴 콜백 응답의 Set-Cookie 원문 — 성공 콜백(카카오)과 실패 콜백(고친 state)', async () => {
    await freshGate();
    await withServer(stepDir(2), async ({ base }) => {
      const ok = (await socialLogin(browser(base), 'kakao')).callback;
      expect(ok.setCookies.map(cookieShape)).toEqual([
        clearShape('oauth_state_kakao'),
        clearShape('oauth_verifier_kakao'),
        'accessToken=…; Max-Age=604800; Path=/; Expires=…; HttpOnly; SameSite=Lax',
        'refreshToken=…; Max-Age=604800; Path=/api/v2/auth; Expires=…; HttpOnly; SameSite=Lax',
        clearShape('oauth_next_kakao'),
      ]);
      const failed = (await socialLogin(browser(base), 'kakao', { tamper: 'forged' })).callback;
      expect(failed.setCookies).toEqual([clearShape('oauth_state_kakao'), clearShape('oauth_verifier_kakao')]);
      seen.step2CallbackSetCookie = { ok: ok.setCookies.map(cookieShape), failed: failed.setCookies };
    });
  }, 30_000);

  // 틀린 판 — 「저장소만 고치고 하나를 빠뜨렸다」 꼴
  const sharedVerifier = (d) => {
    replaceIn(d, 'strategies/stateStore.js', '  const verifierCookie = `oauth_verifier_${provider}`;\n', "  const verifierCookie = 'oauth_verifier';\n");
  };
  const sharedNext = (d) => {
    replaceIn(d, 'controllers/authController.js', 'export function rememberNext(provider) {\n  const nextCookie = `oauth_next_${provider}`;\n', "export function rememberNext(provider) {\n  const nextCookie = 'oauth_next';\n");
    replaceIn(d, 'controllers/authController.js', 'export function socialCallback(provider) {\n  const nextCookie = `oauth_next_${provider}`;\n', "export function socialCallback(provider) {\n  const nextCookie = 'oauth_next';\n");
  };

  it('🔴 틀린 판 (가) — oauth_verifier 만 하나로 둔 판: 차례 ② 에서 구글은 토큰 교환(PKCE)에서, 카카오는 verifier 가 없어 저장소에서 실패한다 · 차례 ① 은 카카오만 로그인된다', async () => {
    await freshGate();
    await withServer(stepDir(2), async ({ base, tail, dir }) => {
      const order2 = await twoTabs(base, ['A', 'B']);
      expect(order2.A).toEqual({ status: 302, location: LOGIN_FAILED_PAGE });
      expect(order2.B).toEqual({ status: 302, location: LOGIN_FAILED_PAGE });
      // 구글은 토큰 주소까지 갔다가 PKCE 로 거절됐다 — 카카오는 토큰 주소에 가지 않았다
      expect(fakes.google.state.log.token).toHaveLength(1);
      expect(fakes.kakao.state.log.token).toEqual([]);
      await sleep(150);
      const log = tail();
      expect(log).toContain('TokenError: Invalid code verifier.');
      seen.wrongSharedVerifier = { order2: { A: order2.A, B: order2.B }, terminal: scrub(log.slice(log.indexOf('TokenError')).split('\n').slice(0, 3).join('\n'), dir) };
      fakes.google.reset();
      fakes.kakao.reset();
      const order1 = await twoTabs(base, ['B', 'A']);
      expect(order1.B).toEqual({ status: 302, location: '/' });
      expect(order1.A).toEqual({ status: 302, location: LOGIN_FAILED_PAGE });
      expect(fakes.google.state.log.token).toEqual([]);
      seen.wrongSharedVerifier.order1 = { A: order1.A, B: order1.B };
    }, { edit: sharedVerifier });
  }, 30_000);

  it('🔴 틀린 판 (나) — oauth_next 만 하나로 둔 판: 둘 다 로그인되지만 구글 탭이 /jaehoon 대신 / 로 간다(차례 ①·② 모두)', async () => {
    await freshGate();
    await withServer(stepDir(2), async ({ base }) => {
      const order1 = await twoTabs(base, ['B', 'A']);
      expect([order1.A, order1.B]).toEqual([{ status: 302, location: '/' }, { status: 302, location: '/' }]);
      expect([order1.AUser, order1.BUser]).toEqual(['minji.kim', 'kakao']);
      const order2 = await twoTabs(base, ['A', 'B']);
      expect([order2.A, order2.B]).toEqual([{ status: 302, location: '/' }, { status: 302, location: '/' }]);
      seen.wrongSharedNext = { order1: [order1.A, order1.B], order2: [order2.A, order2.B] };
    }, { edit: sharedNext });
  }, 30_000);

  it('🔴 틀린 판 (다) — store(req, ...rest) 로 받은 판: 시작은 302(challenge 도 있다)인데 verifier 쿠키가 글자 «undefined» 라 콜백이 토큰 교환에서 실패한다', async () => {
    await freshGate();
    await withServer(stepDir(2), async ({ base, tail, dir }) => {
      const tab = browser(base);
      const started = await begin(tab, 'kakao');
      expect(started.status).toBe(302);
      expect(authorizeQuery(started.location).query.code_challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(tab.cookie('oauth_verifier_kakao')).toBe('undefined');
      const callback = await tab.get(await consentOf(started));
      expect([callback.status, callback.location]).toEqual([302, LOGIN_FAILED_PAGE]);
      expect(fakes.kakao.state.log.token.map((t) => t.body.code_verifier)).toEqual(['undefined']);
      await sleep(150);
      seen.wrongRestArgs = { callback: [callback.status, callback.location], terminalFirst: scrub(tail().slice(tail().indexOf('TokenError')).split('\n')[0], dir) };
    }, { edit: (d) => replaceIn(d, 'strategies/stateStore.js', '    store(req, verifier, state, meta, callback) {\n', '    store(req, ...rest) {\n      const callback = rest.pop();\n      const [verifier] = rest;\n') });
  }, 30_000);
});

// ── 축 ③ Step 4 ──────────────────────────────────────────────────────────────
const STEP4 = {
  'strategies/createSocialStrategy.js': `// ~/instagram-api/strategies/createSocialStrategy.js
import OAuth2Strategy from 'passport-oauth2';
import { createStateStore } from './stateStore.js';
import * as authService from '../services/authService.js';

// 소셜 로그인 전략을 만든다 — 제공자마다 다른 것만 받는다(주소 · 클라이언트 ID와 비밀값 · scope · 사용자 정보를 읽는 법).
// 나머지(state 저장소 · PKCE · 돌아올 주소의 모양 · 사람을 찾거나 만드는 일)는 세 제공자가 같다.
export function createSocialStrategy({ provider, authorizationURL, tokenURL, clientID, clientSecret, scope, userInfoURL, toProfile }) {
  const strategy = new OAuth2Strategy(
    {
      authorizationURL,
      tokenURL,
      clientID,
      clientSecret,
      // 돌아올 주소는 브라우저가 여는 화면의 주소다 — 화면이 이 주소로 온 요청을 우리 서버에 넘겨준다.
      callbackURL: \`\${process.env.SITE_URL}/api/v2/auth/\${provider}/callback\`,
      scope,
      store: createStateStore(provider),
      pkce: true,
    },
    // 제공자가 확인해 준 사람(profile)을 users 의 사람으로 바꾸는 곳 — 여기서 넘긴 값이 req.user 가 된다.
    async (accessToken, refreshToken, profile, done) => {
      try {
        done(null, await authService.findOrCreateSocialUser(profile));
      } catch (error) {
        done(error);
      }
    },
  );

  // 제공자에게 «이 Access 토큰의 주인이 누구인지» 묻는다 — 토큰은 주소가 아니라 Authorization 헤더에 싣는다.
  strategy.userProfile = async (accessToken, done) => {
    try {
      const response = await fetch(userInfoURL, {
        headers: { Authorization: \`Bearer \${accessToken}\` },
      });

      if (!response.ok) throw new Error(\`사용자 정보를 받지 못했어요 (\${provider} · \${response.status})\`);

      // 응답을 우리가 정한 이름(id · email · emailVerified · name)으로 맞추는 일은 제공자마다 달라서 toProfile 이 한다.
      done(null, { provider, ...toProfile(await response.json()) });
    } catch (error) {
      done(error);
    }
  };

  return strategy;
}
`,
  'strategies/google.js': `// ~/instagram-api/strategies/google.js
import { createSocialStrategy } from './createSocialStrategy.js';

// 구글 로그인 전략 — 구글의 주소 둘과, 구글 콘솔에서 받은 클라이언트 ID·비밀값을 넣어 만든다.
export const googleStrategy = createSocialStrategy({
  provider: 'google',
  authorizationURL: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenURL: 'https://oauth2.googleapis.com/token',
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  scope: ['email', 'profile'],
  userInfoURL: 'https://openidconnect.googleapis.com/v1/userinfo',
  // 구글이 준 사용자 정보를 우리가 정한 이름으로 맞춘다 — id 는 구글이 그 계정에 매긴, 바뀌지 않는 값(sub)이다.
  toProfile: (info) => ({
    id: info.sub,
    email: info.email,
    emailVerified: info.email_verified === true,
    name: info.name,
  }),
});
`,
  'strategies/kakao.js': `// ~/instagram-api/strategies/kakao.js
import { createSocialStrategy } from './createSocialStrategy.js';

// 카카오 로그인 전략 — 카카오의 주소 둘과, 카카오 콘솔에서 받은 REST API 키·클라이언트 시크릿을 넣어 만든다.
export const kakaoStrategy = createSocialStrategy({
  provider: 'kakao',
  authorizationURL: 'https://kauth.kakao.com/oauth/authorize',
  tokenURL: 'https://kauth.kakao.com/oauth/token',
  clientID: process.env.KAKAO_CLIENT_ID,
  clientSecret: process.env.KAKAO_CLIENT_SECRET,
  scope: ['profile_nickname'],
  userInfoURL: 'https://kapi.kakao.com/v2/user/me',
  // 카카오는 같은 뜻의 값을 다른 이름, 다른 위치에 준다 — id 는 카카오가 이 앱에서 그 계정에 매긴 회원번호(숫자)다.
  // 동의항목에 닉네임만 넣었으니 이메일은 오지 않는다.
  toProfile: (info) => ({
    id: String(info.id),
    email: undefined,
    emailVerified: false,
    name: info.kakao_account?.profile?.nickname,
  }),
});
`,
  'strategies/naver.js': `// ~/instagram-api/strategies/naver.js
import { createSocialStrategy } from './createSocialStrategy.js';

// 네이버 로그인 전략 — 네이버의 주소 둘과, 네이버 개발자 센터에서 받은 클라이언트 ID·시크릿을 넣어 만든다.
export const naverStrategy = createSocialStrategy({
  provider: 'naver',
  authorizationURL: 'https://nid.naver.com/oauth2/authorize',
  tokenURL: 'https://nid.naver.com/oauth2/token',
  clientID: process.env.NAVER_CLIENT_ID,
  clientSecret: process.env.NAVER_CLIENT_SECRET,
  scope: ['openid'],
  userInfoURL: 'https://openapi.naver.com/v1/nid/me',
  // 네이버는 사용자 정보를 response 라는 키 안에 담아 준다 — id 는 네이버가 이 애플리케이션에서 그 계정에 매긴 값이다.
  // 네이버는 이메일을 확인했는지 알려 주는 값을 주지 않는다 — 확인되지 않은 이메일로 다룬다.
  toProfile: ({ response: info }) => ({
    id: info.id,
    email: info.email,
    emailVerified: false,
    name: info.name,
  }),
});
`,
};
const APP_COMMENT_BEFORE = "// 어떤 방법으로 로그인을 확인할지 등록한다 — 라우트에서 이름 'google' 로 꺼내 쓴다.";
const APP_COMMENT_AFTER = "// 어떤 방법으로 로그인을 확인할지 등록한다 — 라우트에서 이 이름('google' · 'kakao' · 'naver')으로 꺼내 쓴다.";
/** 주석과 빈 줄을 뺀 줄. */
const codeLines = (text) => text.split('\n').filter((line) => line.trim() !== '' && !/^\s*\/\//.test(line));
/** 사용자 이름 끝의 무작위 숫자 넷은 실행마다 달라서 지운다. */
const noDigits = (name) => name?.replace(/\d{4}$/, '####');

/**
 * 같은 요청을 차례대로 보내고 관찰한 것 — Step 2 판과 Step 4 판에 똑같이 보내 축마다 대조한다.
 * 상태 코드 · Location · Set-Cookie 이름 · 로그인된 사람 · 만들어진 행(토큰 값과 무작위 숫자는 뺀다).
 */
const scenario = async (from) => {
  await freshGate();
  const out = {};
  await withServer(from, async ({ base }) => {
    const mask = (location) => location?.replace(/(state|code_challenge)=[A-Za-z0-9_-]+/g, '$1=…');
    const view = (res) => [res.status, mask(res.location), cookieNames(res).join(',')];
    for (const p of PROVIDERS) {
      const tab = browser(base);
      const { started, callback } = await socialLogin(tab, p, { next: '/jaehoon' });
      const { query, keys } = authorizeQuery(started.location);
      out[`${p} 시작`] = [...view(started), keys.join(','), query.scope, query.redirect_uri];
      out[`${p} 콜백`] = view(callback);
      out[`${p} 사람`] = noDigits(await whoAmI(tab));
    }
    const order1 = await twoTabs(base, ['B', 'A']);
    out['탭 둘 ①'] = order1.steps.map((s) => [s.label, s.status, mask(s.location), s.setCookie.join(',')]);
    const order2 = await twoTabs(base, ['A', 'B']);
    out['탭 둘 ②'] = order2.steps.map((s) => [s.label, s.status, mask(s.location), s.setCookie.join(',')]);
    for (const p of PROVIDERS) out[`${p} 고친 state`] = view((await socialLogin(browser(base), p, { tamper: 'forged' })).callback);
    for (const p of PROVIDERS) {
      fakes[p].state.userinfoFails = true;
      out[`${p} 사용자 정보 실패`] = view((await socialLogin(browser(base), p)).callback);
      fakes[p].state.userinfoFails = false;
    }
    out['GET 만'] = [];
    for (const p of PROVIDERS) out['GET 만'].push((await browser(base).post(`/api/v2/auth/${p}`, {})).status);
    out.users = (await gate('SELECT id, username, email, name, password_hash FROM users ORDER BY id')).map((u) => ({ ...u, username: noDigits(u.username) }));
    out.social = await socialRows();
    out.sessions = await count('sessions');
  });
  return out;
};

describe('축 ③ Step 4 — 세 전략 파일을 전략 만드는 함수 하나와 제공자 설정 셋으로', () => {
  const src = (rel) => read(stepDir(4)(rel));

  it('🔴 strategies/createSocialStrategy.js — 새 파일 · new OAuth2Strategy 와 fetch 는 여기 한 곳', () => {
    expect(src('strategies/createSocialStrategy.js')).toBe(STEP4['strategies/createSocialStrategy.js']);
    expect(src('strategies/createSocialStrategy.js').match(/new OAuth2Strategy/g)).toHaveLength(1);
    expect(REAL_HOSTS.test(src('strategies/createSocialStrategy.js'))).toBe(false);
  });

  it('🔴 제공자 파일 셋 — createSocialStrategy({ … }) 하나씩 · new OAuth2Strategy 0 · fetch 0 · 진짜 주소 셋은 여기에', () => {
    for (const p of PROVIDERS) {
      const text = src(`strategies/${p}.js`);
      expect([p, text]).toEqual([p, STEP4[`strategies/${p}.js`]]);
      expect([p, /new OAuth2Strategy/.test(text), /fetch\(/.test(text), /passport-oauth2/.test(text)]).toEqual([p, false, false, false]);
      for (const key of ['authorize', 'token', 'userinfo']) expect(text).toContain(`'${REAL[p][key]}'`);
    }
  });

  it("🔴 app.js 는 등록 주석 한 줄만 고쳤다 — «이름 'google' 로» 가 세 이름으로 · 등록 셋과 import 셋은 그대로", () => {
    const { removed, added } = diffLines(showAt(stepRef(2), 'app.js'), src('app.js'));
    expect([removed, added]).toEqual([[APP_COMMENT_BEFORE], [APP_COMMENT_AFTER]]);
  });

  it('🔴 Step 4 가 고친 학생 파일은 다섯 — app.js(주석) · createSocialStrategy.js(새 파일) · 제공자 파일 셋 · stateStore·컨트롤러·라우터는 Step 2 그대로', () => {
    expect(changedStudentFiles(stepRef(2), stepRef(4))).toEqual(['app.js', 'strategies/createSocialStrategy.js', 'strategies/google.js', 'strategies/kakao.js', 'strategies/naver.js']);
  });

  it('🔴 Step 2 판에 보낸 요청을 그대로 보내면 축마다 같다 — 상태 코드 · Location · Set-Cookie 이름 · 로그인된 사람 · 만들어진 행', async () => {
    const before = await scenario(stepDir(2));
    const after = await scenario(stepDir(4));
    for (const key of Object.keys(before)) expect([key, after[key]]).toEqual([key, before[key]]);
    expect(Object.keys(after)).toEqual(Object.keys(before));
    // 이 대조가 무언가를 재고 있다 — 로그인 셋 · 탭 둘에서 둘 다 · 실패는 실패
    expect(before['탭 둘 ①'].slice(2).map((s) => s[2])).toEqual(['/', '/jaehoon']);
    expect(before['kakao 사용자 정보 실패']).toEqual([302, LOGIN_FAILED_PAGE, 'oauth_state_kakao,oauth_verifier_kakao']);
    expect(before.users.length).toBe(9);
    seen.step4SameAsStep2 = after;
  }, 120_000);

  it('🔴 제공자가 사용자 정보를 주지 않으면 터미널 첫 줄 «Error: 사용자 정보를 받지 못했어요 (kakao · 401)» — 제공자 이름과 상태 코드가 함께 보인다(Step 2 판은 «카카오가 사용자 정보를 주지 않았어요 (401)»)', async () => {
    await freshGate();
    const firstLine = async (n, p) => {
      let line;
      await withServer(stepDir(n), async ({ base, tail, dir }) => {
        fakes[p].state.userinfoFails = true;
        const { callback } = await socialLogin(browser(base), p);
        expect([callback.status, callback.location]).toEqual([302, LOGIN_FAILED_PAGE]);
        await sleep(150);
        const log = tail();
        line = scrub(log.slice(log.indexOf('Error: ')).split('\n').slice(0, 2).join('\n'), dir);
      });
      return line;
    };
    const lines = {};
    for (const p of PROVIDERS) lines[p] = await firstLine(4, p);
    expect(lines.kakao.split('\n')[0]).toBe('Error: 사용자 정보를 받지 못했어요 (kakao · 401)');
    expect(lines.google.split('\n')[0]).toBe('Error: 사용자 정보를 받지 못했어요 (google · 401)');
    expect(lines.naver.split('\n')[0]).toBe('Error: 사용자 정보를 받지 못했어요 (naver · 401)');
    // 스택 둘째 줄은 전략 만드는 함수의 그 줄을 가리킨다
    expect(lines.kakao.split('\n')[1]).toMatch(/strategies\/createSocialStrategy\.js:\d+:\d+/);
    lines.step2Kakao = await firstLine(2, 'kakao');
    expect(lines.step2Kakao.split('\n')[0]).toBe('Error: 카카오가 사용자 정보를 주지 않았어요 (401)');
    seen.step4UserinfoError = lines;
  }, 60_000);

  it('🔴 제공자 설정 셋의 줄 수 — 주석·빈 줄을 빼면 16줄씩(묶기 전 40줄씩) · 전략 만드는 함수는 36줄', () => {
    const counts4 = Object.fromEntries(['createSocialStrategy', ...PROVIDERS].map((name) => [name, codeLines(src(`strategies/${name}.js`)).length]));
    const all = Object.fromEntries(['createSocialStrategy', ...PROVIDERS].map((name) => [name, src(`strategies/${name}.js`).trimEnd().split('\n').length]));
    expect(counts4).toEqual({ createSocialStrategy: 36, google: 16, kakao: 16, naver: 16 });
    seen.step4LineCounts = { codeLines: counts4, allLines: all };
  });

  it('🔴 틀린 판 (가) — 함수가 제공자 이름 없이 저장소를 만들면(createStateStore()) 쿠키 이름이 oauth_state_undefined 하나로 겹쳐 탭 둘이 다시 깨진다', async () => {
    await freshGate();
    await withServer(stepDir(4), async ({ base }) => {
      const tab = browser(base);
      const started = await begin(tab, 'google');
      expect(cookieNames(started)).toEqual(['oauth_next_google', 'oauth_state_undefined', 'oauth_verifier_undefined']);
      const order2 = await twoTabs(base, ['A', 'B']);
      expect([order2.A, order2.B]).toEqual([{ status: 302, location: LOGIN_FAILED_PAGE }, { status: 302, location: LOGIN_FAILED_PAGE }]);
      const order1 = await twoTabs(base, ['B', 'A']);
      expect([order1.A, order1.B]).toEqual([{ status: 302, location: LOGIN_FAILED_PAGE }, { status: 302, location: '/' }]);
      seen.wrongNoProviderStore = { startCookies: cookieNames(started), order1: [order1.A, order1.B], order2: [order2.A, order2.B] };
    }, { edit: (d) => replaceIn(d, 'strategies/createSocialStrategy.js', 'store: createStateStore(provider),', 'store: createStateStore(),') });
  }, 30_000);

  it('🔴 틀린 판 (나) — 함수가 provider 를 붙이지 않으면(done(null, toProfile(…))) 제공자 파일의 toProfile 에는 provider 가 없어서 로그인이 안 된다 — 지금 판은 함수가 붙여서 된다', async () => {
    await freshGate();
    let wrong;
    await withServer(stepDir(4), async ({ base, tail, dir }) => {
      const { callback } = await socialLogin(browser(base), 'kakao');
      await sleep(150);
      wrong = { callback: [callback.status, callback.location], terminal: scrub(tail(), dir) };
    }, { edit: (d) => replaceIn(d, 'strategies/createSocialStrategy.js', 'done(null, { provider, ...toProfile(await response.json()) });', 'done(null, toProfile(await response.json()));') });
    expect(wrong.callback).toEqual([302, LOGIN_FAILED_PAGE]);
    expect(wrong.terminal).toContain('Argument `provider` is missing.');
    await withServer(stepDir(4), async ({ base }) => {
      expect((await socialLogin(browser(base), 'kakao')).callback.location).toBe('/');
    });
    expect((await socialRows()).map((r) => r.provider)).toEqual(['kakao']);
    seen.wrongNoProvider = wrong.callback;
  }, 60_000);

  it('🔎 toProfile 이 provider 를 돌려주면 그 값이 함수가 붙인 것을 덮는다({ provider, ...toProfile() }) — 카카오 파일에 provider: "google" 을 적으면 카카오 사람이 구글 계정으로 들어간다', async () => {
    await freshGate();
    await withServer(stepDir(4), async ({ base }) => {
      expect((await socialLogin(browser(base), 'kakao')).callback.location).toBe('/');
    }, { edit: (d) => replaceIn(d, 'strategies/kakao.js', '  toProfile: (info) => ({\n    id: String(info.id),\n', "  toProfile: (info) => ({\n    provider: 'google',\n    id: String(info.id),\n") });
    expect((await socialRows()).map((r) => `${r.provider} ${r.provider_user_id}`)).toEqual(['google 3812345678']);
  }, 30_000);
});

// ── 축 ④ Step 6 ──────────────────────────────────────────────────────────────
const STEP6_KAKAO = `// ~/instagram-api/strategies/kakao.js
import { createSocialStrategy } from './createSocialStrategy.js';

// 카카오 로그인 전략 — 카카오의 주소 둘과, 카카오 콘솔에서 받은 REST API 키·클라이언트 시크릿을 넣어 만든다.
export const kakaoStrategy = createSocialStrategy({
  provider: 'kakao',
  authorizationURL: 'https://kauth.kakao.com/oauth/authorize',
  tokenURL: 'https://kauth.kakao.com/oauth/token',
  clientID: process.env.KAKAO_CLIENT_ID,
  clientSecret: process.env.KAKAO_CLIENT_SECRET,
  scope: ['profile_nickname', 'account_email'],
  userInfoURL: 'https://kapi.kakao.com/v2/user/me',
  // 카카오는 같은 뜻의 값을 다른 이름, 다른 위치에 준다 — id 는 카카오가 이 앱에서 그 계정에 매긴 회원번호(숫자)다.
  // 이메일은 이메일 제공에 동의한 사람에게만 kakao_account 안에 온다.
  toProfile: (info) => ({
    id: String(info.id),
    email: info.kakao_account?.email,
    // 카카오는 이메일이 지금도 그 계정의 것인지(is_email_valid)와 확인을 거쳤는지(is_email_verified)를 따로 알려 준다 — 둘 다 true 일 때만 확인된 이메일로 본다.
    emailVerified: info.kakao_account?.is_email_valid === true && info.kakao_account?.is_email_verified === true,
    name: info.kakao_account?.profile?.nickname,
  }),
});
`;
/** 가짜 카카오가 내줄 사람을 정하고 카카오로 로그인 한 바퀴 — 콜백 응답과 로그인된 사람을 돌려준다. */
const asKakao = async (base, profile, opts) => {
  fakes.kakao.state.profile = structuredClone(profile);
  const tab = browser(base);
  const { started, callback } = await socialLogin(tab, 'kakao', opts);
  const me = callback.location === '/' ? (await tab.get('/api/v2/auth/me')).body.data : null;
  return { started, callback, me };
};
const userByKakao = async (kakaoId) => (await gate(
  "SELECT u.id, u.username, u.email, u.name FROM users u JOIN social_accounts s ON s.user_id = u.id WHERE s.provider = 'kakao' AND s.provider_user_id = $1", [String(kakaoId)]))[0];
const EMAIL_CASES = [
  ['유효 + 확인', KAKAO_EMAIL_VALID],
  ['유효하지 않음(마스킹)', KAKAO_EMAIL_INVALID],
  ['확인 안 됨', KAKAO_EMAIL_UNVERIFIED],
  ['이메일 동의 안 함', KAKAO_EMAIL_NOT_AGREED],
  ['카카오계정 정보 없음', KAKAO_NO_ACCOUNT],
];
/** 처음 온 카카오 사람 다섯(회원번호를 하나씩 다르게) — 경우마다 users 행을 돌려준다. */
const emailCases = async (from, edit) => {
  await freshGate();
  const out = {};
  await withServer(from, async ({ base, tail, dir }) => {
    let id = 4100000001;
    for (const [label, profile] of EMAIL_CASES) {
      const { callback } = await asKakao(base, { ...profile, id });
      const row = await userByKakao(id);
      out[label] = { callback: [callback.status, callback.location], user: row ? { username: row.username, email: row.email, name: row.name } : null };
      id += 1;
    }
    await sleep(150);
    out.terminal = scrub(tail(), dir);
  }, { edit });
  return out;
};

describe('축 ④ Step 6 — 카카오에서 이메일과 확인 여부를 받는다(카카오 설정 하나만)', () => {
  const src = (rel) => read(stepDir(6)(rel));

  it('🔴 strategies/kakao.js 만 바꿨다 — scope 에 account_email · toProfile 의 email·emailVerified · 주석', () => {
    expect(changedStudentFiles(stepRef(4), stepRef(6))).toEqual(['strategies/kakao.js']);
    expect(src('strategies/kakao.js')).toBe(STEP6_KAKAO);
    const { removed, added } = diffLines(showAt(stepRef(4), 'strategies/kakao.js'), STEP6_KAKAO);
    expect(removed).toEqual([
      "  scope: ['profile_nickname'],",
      '  // 동의항목에 닉네임만 넣었으니 이메일은 오지 않는다.',
      '    email: undefined,',
      '    emailVerified: false,',
    ]);
    expect(added).toEqual([
      "  scope: ['profile_nickname', 'account_email'],",
      '  // 이메일은 이메일 제공에 동의한 사람에게만 kakao_account 안에 온다.',
      '    email: info.kakao_account?.email,',
      '    // 카카오는 이메일이 지금도 그 계정의 것인지(is_email_valid)와 확인을 거쳤는지(is_email_verified)를 따로 알려 준다 — 둘 다 true 일 때만 확인된 이메일로 본다.',
      '    emailVerified: info.kakao_account?.is_email_valid === true && info.kakao_account?.is_email_verified === true,',
    ]);
    // scopeSeparator 는 넣지 않았다 — passport-oauth2 기본(공백)으로 잇는다
    expect(src('strategies/kakao.js')).not.toContain('scopeSeparator');
    expect(src('strategies/createSocialStrategy.js')).not.toContain('scopeSeparator');
  });

  it('🔴 인가 요청의 scope — 배열을 공백으로 이어 «profile_nickname account_email»(주소 글자로는 %20)', async () => {
    await withServer(stepDir(6), async ({ base }) => {
      const res = await begin(browser(base), 'kakao');
      expect(authorizeQuery(res.location).query.scope).toBe('profile_nickname account_email');
      expect(res.location).toContain('&scope=profile_nickname%20account_email&');
      const fake = await fetch(res.location, { redirect: 'manual' });
      expect(fake.status).toBe(302);
      expect(fakes.kakao.state.log.authorize[0].scope).toBe('profile_nickname account_email');
      seen.step6AuthorizeLocation = res.location.replace(/(state|code_challenge)=[A-Za-z0-9_-]+/g, '$1=…').replace(`http://localhost:${KAKAO_PORT}`, 'https://kauth.kakao.com');
    });
  }, 30_000);

  it('🔴 처음 온 카카오 사람 — 유효 + 확인이면 users.email 에 들어가고, 유효하지 않음 · 확인 안 됨 · 동의 안 함 · 계정 정보 없음이면 NULL · 다섯 다 로그인된다', async () => {
    const got = await emailCases(stepDir(6));
    expect(Object.fromEntries(EMAIL_CASES.map(([label]) => [label, got[label]]))).toEqual({
      '유효 + 확인': { callback: [302, '/'], user: { username: 'minji.kim', email: 'minji.kim@kakao.com', name: '민지' } },
      '유효하지 않음(마스킹)': { callback: [302, '/'], user: { username: 'mi', email: null, name: '민지' } },
      '확인 안 됨': { callback: [302, '/'], user: { username: 'haru', email: null, name: '민지' } },
      '이메일 동의 안 함': { callback: [302, '/'], user: { username: 'kakao', email: null, name: '민지' } },
      '카카오계정 정보 없음': { callback: [302, '/'], user: { username: expect.stringMatching(/^kakao\d{4}$/), email: null, name: null } },
    });
    expect(got.terminal).not.toMatch(/Error/);
    seen.step6EmailCases = got;
  }, 60_000);

  it('🔴 Step 4 판은 같은 응답을 받아도 이메일을 안 넣는다 — 다섯 다 users.email NULL(scope 에 account_email 도 없다)', async () => {
    const got = await emailCases(stepDir(4));
    for (const [label] of EMAIL_CASES) expect([label, got[label].callback, got[label].user.email]).toEqual([label, [302, '/'], null]);
  }, 60_000);

  it('🔴 이미 가입한 카카오 사람은 이메일이 «유효 + 확인» 으로 와도 users.email 이 그대로 NULL — 찾기만 하고 고치지 않는다', async () => {
    await freshGate();
    await withServer(stepDir(6), async ({ base }) => {
      const first = await asKakao(base, DEFAULT_KAKAO_PROFILE);
      expect(first.callback.location).toBe('/');
      const before = await counts();
      const again = await asKakao(base, KAKAO_EMAIL_VALID);
      expect([again.callback.status, again.callback.location]).toEqual([302, '/']);
      expect(again.me.id).toBe(first.me.id);
      expect(await userByKakao(DEFAULT_KAKAO_PROFILE.id)).toEqual({ id: first.me.id, username: 'kakao', email: null, name: '민지' });
      const after = await counts();
      expect([after[0], after[1]]).toEqual([before[0], before[1]]);
      seen.step6ExistingKakao = { first: first.me, again: again.me };
    });
  }, 30_000);

  it('🔴 처음 온 카카오 사람의 확인된 이메일이 이미 구글로 가입한 사람의 것이면 302 /login?error=EMAIL_TAKEN — 사람도 소셜 계정도 안 생긴다 · 실패한 넣기가 users 의 id 를 쓴다', async () => {
    await freshGate();
    await withServer(stepDir(6), async ({ base, tail, dir }) => {
      const google = browser(base);
      expect((await socialLogin(google, 'google')).callback.location).toBe('/');
      const googleUser = (await google.get('/api/v2/auth/me')).body.data;
      expect([googleUser.username, (await userRow(googleUser.id)).email]).toEqual(['minji.kim', DEFAULT_GOOGLE_PROFILE.email]);
      const before = { counts: await counts(), lastId: await lastUserId() };
      const taken = await asKakao(base, { ...KAKAO_EMAIL_VALID, kakao_account: { ...KAKAO_EMAIL_VALID.kakao_account, email: DEFAULT_GOOGLE_PROFILE.email } });
      expect([taken.callback.status, taken.callback.location]).toEqual([302, '/login?error=EMAIL_TAKEN']);
      const after = { counts: await counts(), lastId: await lastUserId() };
      expect(after.counts).toEqual(before.counts);
      // 사용자 이름(minji.kim)도 겹쳐서 이름에 숫자를 붙여 한 번 더 넣다가 이메일에서 막힌다 — 실패한 넣기 둘이 번호를 둘 쓴다
      expect(after.lastId - before.lastId).toBe(2);
      // 다음에 가입하는 사람의 번호는 그만큼 건너뛴다
      const next = await asKakao(base, { ...DEFAULT_KAKAO_PROFILE, id: 4200000001 });
      expect(next.me.id).toBe(before.lastId + 3);
      await sleep(150);
      // 이메일 겹침은 우리가 아는 실패라 터미널에 에러를 찍지 않는다
      expect(scrub(tail(), dir)).not.toMatch(/Error/);
      seen.step6EmailTaken = { googleUser: googleUser.id, lastIdBefore: before.lastId, lastIdAfter: after.lastId, nextKakaoId: next.me.id };
    });
  }, 30_000);

  it('🔎 사용자 이름은 겹치지 않고 이메일만 겹치면 실패한 넣기가 번호를 하나 쓴다', async () => {
    await freshGate();
    await gate("UPDATE users SET email = 'jh.dev@example.com' WHERE username = 'jaehoon'");
    await withServer(stepDir(6), async ({ base }) => {
      const before = await lastUserId();
      const taken = await asKakao(base, { ...KAKAO_EMAIL_VALID, kakao_account: { ...KAKAO_EMAIL_VALID.kakao_account, email: 'jh.dev@example.com' } });
      expect(taken.callback.location).toBe('/login?error=EMAIL_TAKEN');
      expect(await lastUserId() - before).toBe(1);
      seen.step6EmailTakenSingle = { lastIdBefore: before, lastIdAfter: await lastUserId() };
    });
  }, 30_000);

  it('🔴 구글 · 네이버 · 이메일 없는 카카오는 Step 4 판과 같다(카카오 시작 주소의 scope 만 다르다)', async () => {
    const before = await scenario(stepDir(4));
    const after = await scenario(stepDir(6));
    for (const key of Object.keys(before)) {
      if (key === 'kakao 시작') continue;
      // 탭 둘의 카카오 시작 주소도 scope 만 다르다
      const same = (value) => JSON.parse(JSON.stringify(value).replaceAll('scope=profile_nickname%20account_email', 'scope=profile_nickname'));
      expect([key, same(after[key])]).toEqual([key, before[key]]);
    }
    expect([before['kakao 시작'][4], after['kakao 시작'][4]]).toEqual(['profile_nickname', 'profile_nickname account_email']);
  }, 120_000);

  it('🔴 틀린 판 (가) — && 대신 || 면 유효하지 않은 마스킹 이메일과 확인 안 된 이메일이 users.email 에 들어간다', async () => {
    const got = await emailCases(stepDir(6), (d) => replaceIn(d, 'strategies/kakao.js', 'is_email_valid === true && info', 'is_email_valid === true || info'));
    expect(got['유효하지 않음(마스킹)'].user.email).toBe('mi***@kakao.com');
    expect(got['확인 안 됨'].user.email).toBe('haru@kakao.com');
    expect(got['유효 + 확인'].user.email).toBe('minji.kim@kakao.com');
    expect(got['이메일 동의 안 함'].user.email).toBeNull();
    seen.wrongOr = { invalid: got['유효하지 않음(마스킹)'], unverified: got['확인 안 됨'] };
  }, 60_000);

  it('🔴 틀린 판 (나) — is_email_verified 만 보면 유효하지 않은 마스킹 이메일이 users.email 에 들어간다(확인 안 된 것은 NULL)', async () => {
    const got = await emailCases(stepDir(6), (d) => replaceIn(d, 'strategies/kakao.js', 'info.kakao_account?.is_email_valid === true && info.kakao_account?.is_email_verified === true', 'info.kakao_account?.is_email_verified === true'));
    expect(got['유효하지 않음(마스킹)'].user.email).toBe('mi***@kakao.com');
    expect(got['확인 안 됨'].user.email).toBeNull();
    expect(got['유효 + 확인'].user.email).toBe('minji.kim@kakao.com');
  }, 60_000);

  it('🔴 틀린 판 (다) — ?. 없이 info.kakao_account.email 이면 카카오계정 정보가 없는 응답에서 TypeError → 302 /login?error=SOCIAL_LOGIN_FAILED · 나머지 넷은 된다', async () => {
    const got = await emailCases(stepDir(6), (d) => replaceIn(d, 'strategies/kakao.js', '    email: info.kakao_account?.email,', '    email: info.kakao_account.email,'));
    expect(got['카카오계정 정보 없음']).toEqual({ callback: [302, LOGIN_FAILED_PAGE], user: null });
    for (const [label] of EMAIL_CASES.slice(0, 4)) expect([label, got[label].callback]).toEqual([label, [302, '/']]);
    const at = got.terminal.indexOf('TypeError');
    const lines = got.terminal.slice(at).split('\n');
    expect(lines[0]).toBe("TypeError: Cannot read properties of undefined (reading 'email')");
    expect(lines[1]).toMatch(/^ {4}at toProfile \(file:\/\/.*strategies\/kakao\.js:17:\d+\)$/);
    seen.wrongNoOptional = { terminal: lines.slice(0, 4).join('\n') };
  }, 60_000);
});

// ── 축 ⑤ 파생 대조 ───────────────────────────────────────────────────────────
describe('축 ⑤ 파생 대조 — 세 전략 파일의 줄 수와 같은 줄', () => {
  it('🔴 묶기 전(code/p3-46) 세 파일은 주석·빈 줄을 빼면 40줄씩이고, 그중 24줄이 세 파일에 글자까지 같다', () => {
    const [g, k, n] = PROVIDERS.map((p) => codeLines(showAt('code/p3-46', `strategies/${p}.js`)));
    expect([g.length, k.length, n.length]).toEqual([40, 40, 40]);
    // 파일마다 «나머지 두 파일에도 글자까지 같은 줄이 있는» 줄을 센다 — 셋 다 24
    const files = [g, k, n];
    expect(files.map((lines, i) => lines.filter((line) => files.every((other, j) => j === i || other.includes(line))).length)).toEqual([24, 24, 24]);
    const same = g.filter((line) => k.includes(line) && n.includes(line));
    // 24줄 가운데 둘은 한 파일 안에서 두 번 나오는 줄이다(«  },» · «    });») — 서로 다른 글자로는 22종
    expect(new Set(same).size).toBe(22);
    expect(Object.entries(same.reduce((acc, line) => ({ ...acc, [line]: (acc[line] ?? 0) + 1 }), {})).filter(([, times]) => times > 1)).toEqual([['  },', 2], ['    });', 2]]);
    seen.sameLinesBefore = same;
  });

  it('🔴 묶은 뒤(Step 4) 제공자 파일 셋에 글자까지 같은 줄 — 주석·빈 줄을 빼면 셋(import · toProfile 의 닫는 줄 · 끝 줄)', () => {
    const [g, k, n] = PROVIDERS.map((p) => codeLines(showAt(stepRef(4), `strategies/${p}.js`)));
    const same = g.filter((line) => k.includes(line) && n.includes(line));
    seen.sameLinesAfter = same;
    expect(same).toEqual(["import { createSocialStrategy } from './createSocialStrategy.js';", '  }),', '});']);
  });
});

// ── 실습·과제(lab/p3-47) ───────────────────────────────────────────────────────
// 실습 파일은 이 회차 북마크가 생기면 북마크에서, 아직 없으면 main 에서 읽는다(작업트리가 아니다).
// 짓는 동안 `P347_LAB_WT=1` 을 주면 작업트리에서 읽는다.
// 🔑 4001·4002·4003 은 남이 쓸 수 있어서 직접 띄우지 않는다 — 사본의 글자만 바꿔 띄운다
//    (톡 서버 4003→3984 · 실습용 인가 서버 4001→3985 · 서비스 4002→3986 — 등록한 돌아올 주소 · listen 모두).
const TALK_PORT = 3984;
const LAB_AS_PORT = 3985;
const LAB_PORT = 3986;
const LAB_BASE = `http://localhost:${LAB_PORT}`;
const LAB_REF = hasRef('refs/heads/code/p3-47') ? 'code/p3-47' : 'main';
const LAB_WT = process.env.P347_LAB_WT === '1';
const labFile = (rel) => (LAB_WT ? read(P(rel)) : showAt(LAB_REF, rel));
const LAB = (name) => labFile(`lab/p3-47/${name}`);
const SNAP = (name) => labFile(`snapshots/p3-47.${name}`);
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

/** 실습 파일을 학생 폴더 모양의 사본에 놓고 `node lab/p3-47/…` 로 띄운다. */
const bootLab = (rel, source, port, extraEnv = {}) => {
  const dir = studentDir(stepDir(6), (d) => {
    mkdirSync(join(d, rel, '..'), { recursive: true });
    writeFileSync(join(d, rel), source);
  });
  return boot(join(dir, rel), { port, cwd: dir, env: { ...env, ...extraEnv }, ready: `${port}번 포트에서` });
};
const startTalk = () => bootLab('lab/p3-47/talk-server.js', toLabPorts(LAB('talk-server.js'), 'talk-server.js', [4002, 4003]), TALK_PORT);
const startAuthServer = () => bootLab('lab/p3-21/auth-server.js', toLabPorts(showAt('code/p3-46', 'lab/p3-21/auth-server.js'), 'auth-server.js', [4001, 4002]), LAB_AS_PORT);
/** 서비스(실습·과제 파일)를 띄운 채 `fn` 을 부른다 — `source` 는 학생 파일(또는 틀린 판) 원문. */
const withService = async (file, source, fn) => {
  const srv = await bootLab(`lab/p3-47/${file}`, toLabPorts(source, file, [4001, 4002, 4003]), LAB_PORT);
  try {
    return await fn({ ...srv, base: LAB_BASE });
  } finally {
    await stop(srv);
  }
};
const runLabScript = (file, source) => {
  const dir = mkdtempSync(join(tmpdir(), 'p347-script-'));
  dirs.push(dir);
  mkdirSync(join(dir, 'lab/p3-47'), { recursive: true });
  writeFileSync(join(dir, `lab/p3-47/${file}`), source);
  writeFileSync(join(dir, 'package.json'), '{ "type": "module" }\n');
  try {
    return { code: 0, out: execFileSync(process.execPath, [`lab/p3-47/${file}`], { cwd: dir, encoding: 'utf8', stdio: 'pipe' }) };
  } catch (error) {
    return { code: error.status, out: `${error.stdout}${error.stderr}`.replaceAll(`/private${dir}`, '~/instagram-api').replaceAll(dir, '~/instagram-api') };
  }
};
const nodeCheck = (source) => {
  const dir = mkdtempSync(join(tmpdir(), 'p347-check-'));
  dirs.push(dir);
  writeFileSync(join(dir, 'file.js'), source);
  writeFileSync(join(dir, 'package.json'), '{"type":"module"}');
  execFileSync(process.execPath, ['--check', 'file.js'], { cwd: dir, stdio: 'pipe' });
};
const execFileAsync = promisify(execFile);
/** httpYac CLI 로 `.http` 한 파일을 통째로 보낸다(`--all`) — 이 프로세스의 서버들이 답할 수 있게 비동기로 부른다. */
const httpyac = async (file, source) => {
  const dir = mkdtempSync(join(tmpdir(), 'p347-http-'));
  dirs.push(dir);
  writeFileSync(join(dir, file), toLabPorts(source, file, [4002]));
  try {
    return (await execFileAsync(P('node_modules/.bin/httpyac'), ['send', file, '--all'], { cwd: dir, encoding: 'utf8' })).stdout;
  } catch (error) {
    return `${error.stdout}${error.stderr}`;
  }
};

/** 실습용 인가 서버의 동의 화면에서 아이디·비밀번호를 넣고 누른다 — 돌아올 주소(경로 + 쿼리)를 돌려준다. */
const consentLab = async (started, username, decision = 'allow') => {
  const auth = new URL(started.location);
  const form = new URLSearchParams([...auth.searchParams, ['username', username], ['password', `${username}1234`], ['decision', decision]]);
  const res = await fetch(`${auth.origin}/authorize`, { method: 'POST', body: form, redirect: 'manual' });
  const back = new URL(res.headers.get('location'));
  expect(back.origin).toBe(LAB_BASE);
  return `${back.pathname}${back.search}`;
};
/** 톡의 동의 화면에서 계정을 고르고 누른다 — `nickname`·`email` 은 그 체크를 켜 둘지. */
const consentTalk = async (started, account, { decision = 'allow', nickname = true, email = true } = {}) => {
  const auth = new URL(started.location);
  const fields = [...auth.searchParams, ['account', account], ['decision', decision]];
  if (nickname) fields.push(['nickname', 'yes']);
  if (email) fields.push(['email', 'yes']);
  const res = await fetch(`${auth.origin}/oauth/authorize`, { method: 'POST', body: new URLSearchParams(fields), redirect: 'manual' });
  const back = new URL(res.headers.get('location'));
  expect(back.origin).toBe(LAB_BASE);
  return `${back.pathname}${back.search}`;
};
/** 한 탭으로 로그인 한 바퀴 — 시작 → 동의 → 콜백. 콜백 응답과 /me 를 돌려준다. */
const labLogin = async (base, provider, who, opts) => {
  const tab = browser(base);
  const started = await tab.get(provider === 'lab' ? '/login' : '/talk');
  const back = provider === 'lab' ? await consentLab(started, who) : await consentTalk(started, who, opts);
  const callback = await tab.get(back);
  const me = callback.location === '/me' ? (await tab.get('/me')).body : null;
  return { tab, started, back, callback: [callback.status, callback.location], me };
};
/**
 * 탭 둘 — 탭 A 는 인가 서버(/login · jaehoon), 탭 B 는 톡(/talk · sora). 둘 다 동의 화면에 멈춰 둔 채
 * `order` 차례로 «허용» 을 누른다(누르면 그 탭이 곧바로 돌아온다). 탭 둘은 쿠키 단지 하나다.
 */
const labTwoTabs = async (base, order = ['A', 'B']) => {
  const tab = browser(base);
  const startA = await tab.get('/login');
  const startB = await tab.get('/talk');
  const out = { jarAfterStarts: tab.cookies() };
  out.stateA = new URL(startA.location).searchParams.get('state');
  out.stateB = new URL(startB.location).searchParams.get('state');
  const backs = { A: () => consentLab(startA, 'jaehoon'), B: () => consentTalk(startB, 'sora') };
  for (const which of order) {
    const res = await tab.get(await backs[which]());
    out[which] = [res.status, res.location];
  }
  out.jarAtEnd = tab.cookies();
  out.me = (await tab.get('/me')).body;
  out.members = (await browser(base).get('/members')).body;
  return out;
};

describe('직접 해보기·과제 — 톡 서버와 실습용 인가 서버를 띄운 채', () => {
  let talk;
  let authServer;
  beforeAll(async () => {
    talk = await startTalk();
    authServer = await startAuthServer();
  }, 30_000);
  afterAll(async () => {
    if (talk) await stop(talk);
    if (authServer) await stop(authServer);
  });
  const talkLogSince = (from) => talk.tail().slice(from);

  describe('축 ⑥ 나눠 주는 talk-server.js — 돌아올 주소 둘 · 이메일 동의항목', () => {
    const TALK = `http://localhost:${TALK_PORT}`;
    const query = (extra = {}) => new URLSearchParams({ response_type: 'code', client_id: 'lab-talk', redirect_uri: `${LAB_BASE}/talk/callback`, state: 'st4te', ...extra });
    const tokenFor = async (fields) => {
      const consent = await fetch(`${TALK}/oauth/authorize`, { method: 'POST', body: new URLSearchParams({ ...Object.fromEntries(query()), ...fields }), redirect: 'manual' });
      const code = new URL(consent.headers.get('location')).searchParams.get('code');
      const res = await fetch(`${TALK}/oauth/token`, { method: 'POST', body: new URLSearchParams({ grant_type: 'authorization_code', client_id: 'lab-talk', client_secret: 'talk-secret', redirect_uri: fields.redirect_uri ?? `${LAB_BASE}/talk/callback`, code }) });
      return (await res.json()).access_token;
    };
    const me = async (token) => (await fetch(`${TALK}/v2/me`, { headers: { Authorization: `Bearer ${token}` } })).json();

    it('🔴 180줄 안쪽 · 첫 줄은 경로 주석 · 4003 번 포트 · 새 패키지 없이 · 지난 시간 톡 서버와 같은 import', () => {
      const src = LAB('talk-server.js');
      expect(src.trimEnd().split('\n').length).toBeLessThanOrEqual(180);
      expect(src.split('\n')[0]).toBe('// ~/instagram-api/lab/p3-47/talk-server.js');
      expect(src).toContain('app.listen(4003, () => {');
      expect([...src.matchAll(/^import .* from '(.*)';$/gm)].map((m) => m[1])).toEqual(['express', 'node:crypto', 'node:timers/promises']);
      expect(talk.log).toBe(`톡 서버가 ${TALK_PORT}번 포트에서 기다리고 있어요.\n`);
      const { removed, added } = diffLines(showAt('code/p3-46', 'lab/p3-46/talk-server.js'), src);
      labSeen.talkServerDiff = { lines: src.trimEnd().split('\n').length, removed: removed.length, added: added.length };
    });

    it('🔴 돌아올 주소 둘을 받는다 — /talk/callback · /callback · 그 밖은 400', async () => {
      for (const path of ['/talk/callback', '/callback']) {
        const page = await fetch(`${TALK}/oauth/authorize?${query({ redirect_uri: `${LAB_BASE}${path}` })}`);
        expect([path, page.status]).toEqual([path, 200]);
      }
      const bad = await fetch(`${TALK}/oauth/authorize?${query({ redirect_uri: `${LAB_BASE}/kakao/callback` })}`);
      expect(bad.status).toBe(400);
      expect(await bad.text()).toContain('<p>등록하지 않은 redirect_uri예요</p>');
    }, 30_000);

    it('🔴 동의 화면 — 계정 넷(sora 가 골라져 있다) · «이메일 제공» 체크는 scope 에 talk_email 이 있을 때만(켜져 있다)', async () => {
      const plain = await (await fetch(`${TALK}/oauth/authorize?${query()}`)).text();
      for (const line of ['value="sora" checked> sora (소라)', 'value="haru"> haru (하루)', 'value="bomi"> bomi (보미)', 'value="dahye"> dahye (다혜)']) expect(plain).toContain(line);
      expect(plain).toContain('<input type="checkbox" name="nickname" value="yes" checked> 닉네임 제공');
      expect(plain).not.toContain('이메일 제공');
      const withEmail = await (await fetch(`${TALK}/oauth/authorize?${query({ scope: 'talk_email' })}`)).text();
      expect(withEmail).toContain('<input type="checkbox" name="email" value="yes" checked> 이메일 제공');
      expect(withEmail).toContain('<input type="hidden" name="scope" value="talk_email">');
      labSeen.talkConsentWithEmail = withEmail;
    }, 30_000);

    it('🔴 /v2/me — talk_email 을 달라고 안 했으면 이메일 칸이 없다 · 달라고 하고 동의했으면 email_agreed · email · email_checked · 동의 안 했으면 email_agreed: false 만', async () => {
      expect(await me(await tokenFor({ account: 'sora', nickname: 'yes', email: 'yes', decision: 'allow' }))).toEqual(
        { id: 10001, joined_at: '2026-03-02T09:00:00Z', account: { nickname_agreed: true, profile: { nickname: '소라' } } });
      expect(await me(await tokenFor({ account: 'sora', nickname: 'yes', email: 'yes', decision: 'allow', scope: 'talk_email' }))).toEqual(
        { id: 10001, joined_at: '2026-03-02T09:00:00Z', account: { nickname_agreed: true, profile: { nickname: '소라' }, email_agreed: true, email: 'sora@talk.example', email_checked: true } });
      expect(await me(await tokenFor({ account: 'haru', nickname: 'yes', email: 'yes', decision: 'allow', scope: 'talk_email' }))).toEqual(
        { id: 10002, joined_at: '2026-05-17T14:30:00Z', account: { nickname_agreed: true, profile: { nickname: '하루' }, email_agreed: true, email: 'haru@talk.example', email_checked: false } });
      expect(await me(await tokenFor({ account: 'bomi', decision: 'allow', scope: 'talk_email' }))).toEqual(
        { id: 10003, joined_at: '2026-07-08T11:15:00Z', account: { nickname_agreed: false, email_agreed: false } });
      const dahye = await me(await tokenFor({ account: 'dahye', email: 'yes', decision: 'allow', scope: 'talk_email', redirect_uri: `${LAB_BASE}/callback` }));
      expect(dahye.account).toEqual({ nickname_agreed: false, email_agreed: true, email: 'dahye@example.com', email_checked: true });
    }, 30_000);
  });

  describe('축 ⑦ 나눠 주는 one-callback.js(교안 Step 3) — 돌아올 주소 하나 + 쿠키 lab_provider', () => {
    it('🔴 한 탭씩이면 둘 다 된다 — 인가 서버 jaehoon 302 /me · 톡 sora 302 /me', async () => {
      await withService('one-callback.js', LAB('one-callback.js'), async ({ base }) => {
        const lab = await labLogin(base, 'lab', 'jaehoon');
        expect([lab.callback, lab.me]).toEqual([[302, '/me'], { id: 3, nickname: 'jaehoon', email: 'jaehoon@example.com' }]);
        const sora = await labLogin(base, 'talk', 'sora');
        expect([sora.callback, sora.me]).toEqual([[302, '/me'], { id: 2, nickname: '소라' }]);
      });
    }, 30_000);

    it('🔴 탭 둘(인가 서버 A 시작 → 톡 B 시작 → A 허용 → B 허용) — 둘 다 /?error=LOGIN_FAILED · 콜백 로그 두 줄이 모두 lab_provider=talk · A 의 코드는 state 비교에서 멈춰 토큰 교환까지 안 간다', async () => {
      const before = talk.tail().length;
      await withService('one-callback.js', LAB('one-callback.js'), async ({ base, tail }) => {
        const got = await labTwoTabs(base, ['A', 'B']);
        expect(got.A).toEqual([302, '/?error=LOGIN_FAILED']);
        expect(got.B).toEqual([302, '/?error=LOGIN_FAILED']);
        expect(got.jarAfterStarts).toEqual(['lab_provider /', 'lab_state_lab /', 'lab_state_talk /', 'lab_verifier_lab /', 'lab_verifier_talk /']);
        await sleep(150);
        const lines = tail().split('\n').filter((line) => line.startsWith('[콜백]'));
        expect(lines).toEqual([`[콜백] lab_provider=talk · 돌아온 state=${got.stateA}`, `[콜백] lab_provider=talk · 돌아온 state=${got.stateB}`]);
        // 톡 서버에는 토큰 요청이 오지 않았다 — A 의 코드는 톡 전략의 state 비교에서 멈췄고, B 는 그 비교가 쿠키를 지운 뒤라 쿠키가 없었다
        expect(talkLogSince(before)).not.toContain('POST /oauth/token');
        expect(tail()).not.toContain('Error');
        expect(got.members).toHaveLength(2);
        labSeen.oneCallbackTwoTabs = { A: got.A, B: got.B, log: lines.map((line) => line.replace(/state=.*$/, 'state=…')), jarAtEnd: got.jarAtEnd, talkLog: talkLogSince(before) };
      });
    }, 30_000);

    it('🔎 탭 둘이어도 톡(B)을 먼저 허용하면 톡은 된다 — 인가 서버(A)만 실패(그 코드도 톡 전략이 받는다)', async () => {
      await withService('one-callback.js', LAB('one-callback.js'), async ({ base, tail }) => {
        const got = await labTwoTabs(base, ['B', 'A']);
        expect(got.B).toEqual([302, '/me']);
        expect(got.A).toEqual([302, '/?error=LOGIN_FAILED']);
        await sleep(150);
        expect(tail().split('\n').filter((line) => line.startsWith('[콜백]')).map((line) => line.replace(/state=.*$/, 'state=…'))).toEqual([
          '[콜백] lab_provider=talk · 돌아온 state=…', '[콜백] lab_provider=talk · 돌아온 state=…',
        ]);
        labSeen.oneCallbackTalkFirst = { A: got.A, B: got.B };
      });
    }, 30_000);
  });

  describe('축 ⑧ 직접 해보기 1 — 임시 쿠키 이름을 제공자마다', () => {
    it('🔴 시작 파일은 지난 과제(lab/p3-46/homework1.js)를 복사한 것 — 첫 줄 경로만 다르다 · 문법 검사 통과', () => {
      const start = SNAP('practice1-start.practice1.js');
      expect(start).toBe(showAt('code/p3-46', 'lab/p3-46/homework1.js').replace('// ~/instagram-api/lab/p3-46/homework1.js\n', '// ~/instagram-api/lab/p3-47/practice1.js\n'));
      nodeCheck(start);
    });

    it('🔴 정답은 시작 파일에서 저장소를 함수(createStateStore)로 바꾸고 store 두 줄만 고쳤다', () => {
      const { removed, added } = diffLines(SNAP('practice1-start.practice1.js'), LAB('practice1.js'));
      expect(removed).toContain('const stateStore = {');
      expect(added).toContain('function createStateStore(provider) {');
      expect(added).toEqual(expect.arrayContaining(["    store: createStateStore('lab'),", "    store: createStateStore('talk'),", '  const stateCookie = `lab_state_${provider}`;', '  const verifierCookie = `lab_verifier_${provider}`;']));
      expect(LAB('practice1.js').split('\n')[0]).toBe('// ~/instagram-api/lab/p3-47/practice1.js');
    });

    const check = (source) => withService('practice1.js', source, async ({ base, tail }) => {
      const got = await labTwoTabs(base, ['A', 'B']);
      await sleep(150);
      return { A: got.A, B: got.B, jarAtEnd: got.jarAtEnd, members: got.members.map((m) => `${m.id} ${m.nickname} ${m.providers.join(',')}`), terminal: tail() };
    });

    it('🔴 확인 — 고치기 전(시작 파일)에는 탭 둘이 둘 다 /?error=LOGIN_FAILED · 고친 뒤에는 둘 다 /me · /members 에 둘 · 다 끝난 뒤 쿠키는 labSession 하나', async () => {
      const before = await check(SNAP('practice1-start.practice1.js'));
      expect([before.A, before.B]).toEqual([[302, '/?error=LOGIN_FAILED'], [302, '/?error=LOGIN_FAILED']]);
      const after = await check(LAB('practice1.js'));
      expect([after.A, after.B]).toEqual([[302, '/me'], [302, '/me']]);
      expect(after.members).toEqual(['1 dahye ', '2 소라 talk', '3 jaehoon lab']);
      expect(after.jarAtEnd).toEqual(['labSession /']);
      labSeen.practice1 = { before: [before.A, before.B], after: [after.A, after.B], jarAtEnd: after.jarAtEnd, members: after.members };
    }, 60_000);

    it('🔴 틀린 판 (가) — lab_state 만 나누고 lab_verifier 는 하나: 둘 다 실패 · 인가 서버가 PKCE 로 거절한다(톡은 verifier 가 없어 토큰을 묻지도 않는다)', async () => {
      const before = talk.tail().length;
      const got = await check(edit1(LAB('practice1.js'), '  const verifierCookie = `lab_verifier_${provider}`;', "  const verifierCookie = 'lab_verifier';"));
      expect([got.A, got.B]).toEqual([[302, '/?error=LOGIN_FAILED'], [302, '/?error=LOGIN_FAILED']]);
      expect(got.terminal).toContain('TokenError: code_verifier가 맞지 않아요');
      expect(talkLogSince(before)).not.toContain('POST /oauth/token');
      labSeen.practice1SharedVerifier = { A: got.A, B: got.B, terminalFirst: got.terminal.slice(got.terminal.indexOf('TokenError')).split('\n')[0] };
    }, 60_000);

    it('🔴 틀린 판 (나) — 지우는 쪽(clearCookie)만 옛 이름: 로그인은 둘 다 되고 다음 로그인도 안 망가지지만, 다 끝난 뒤 쿠키에 lab_state_·lab_verifier_ 넷이 남는다(확인의 «쿠키는 labSession 하나» 가 가린다)', async () => {
      const wrong = edit1(LAB('practice1.js'), '      req.res.clearCookie(stateCookie);\n      req.res.clearCookie(verifierCookie);\n', "      req.res.clearCookie('lab_state');\n      req.res.clearCookie('lab_verifier');\n");
      const got = await check(wrong);
      expect([got.A, got.B]).toEqual([[302, '/me'], [302, '/me']]);
      expect(got.jarAtEnd).toEqual(['labSession /', 'lab_state_lab /', 'lab_state_talk /', 'lab_verifier_lab /', 'lab_verifier_talk /']);
      // 남은 쿠키가 다음 로그인을 망치는지 — 같은 탭으로 두 제공자에 한 번 더 다녀와도 된다(시작할 때 새 값으로 덮어쓴다)
      const again = await withService('practice1.js', wrong, async ({ base }) => {
        const tab = browser(base);
        const out = [];
        for (const [path, consent] of [['/login', (s) => consentLab(s, 'jaehoon')], ['/talk', (s) => consentTalk(s, 'sora')], ['/login', (s) => consentLab(s, 'minji')]]) {
          const res = await tab.get(await consent(await tab.get(path)));
          out.push([res.status, res.location]);
        }
        return out;
      });
      expect(again).toEqual([[302, '/me'], [302, '/me'], [302, '/me']]);
      labSeen.practice1OldClear = { jarAtEnd: got.jarAtEnd, againSameTab: again };
    }, 60_000);
  });

  describe('축 ⑨ 직접 해보기 2 — 두 전략을 createLabStrategy 하나로', () => {
    it('🔴 시작 파일은 직접 해보기 1 정답을 복사한 것 — 첫 줄 경로만 다르다', () => {
      expect(SNAP('practice2-start.practice2.js')).toBe(LAB('practice1.js').replace('// ~/instagram-api/lab/p3-47/practice1.js\n', '// ~/instagram-api/lab/p3-47/practice2.js\n'));
    });

    it('🔴 확인 — grep -c "new OAuth2Strategy" lab/p3-47/practice2.js 는 1 (시작 파일은 2)', () => {
      const dir = mkdtempSync(join(tmpdir(), 'p347-grep-'));
      dirs.push(dir);
      mkdirSync(join(dir, 'lab/p3-47'), { recursive: true });
      writeFileSync(join(dir, 'lab/p3-47/practice2.js'), LAB('practice2.js'));
      expect(execFileSync('/usr/bin/grep', ['-c', 'new OAuth2Strategy', 'lab/p3-47/practice2.js'], { cwd: dir, encoding: 'utf8' })).toBe('1\n');
      writeFileSync(join(dir, 'lab/p3-47/practice2.js'), SNAP('practice2-start.practice2.js'));
      expect(execFileSync('/usr/bin/grep', ['-c', 'new OAuth2Strategy', 'lab/p3-47/practice2.js'], { cwd: dir, encoding: 'utf8' })).toBe('2\n');
    });

    it('🔴 확인 — 직접 해보기 1 의 탭 둘 차례 그대로 둘 다 /me · 한 탭씩도 된다', async () => {
      const got = await withService('practice2.js', LAB('practice2.js'), async ({ base }) => {
        const twoTabs = await labTwoTabs(base, ['A', 'B']);
        const single = await labLogin(base, 'lab', 'minji');
        return { twoTabs: [twoTabs.A, twoTabs.B], single: [single.callback, single.me] };
      });
      expect(got).toEqual({ twoTabs: [[302, '/me'], [302, '/me']], single: [[302, '/me'], { id: 4, nickname: 'minji', email: 'minji@example.com' }] });
    }, 60_000);

    it('🔴 틀린 판 — 저장소를 함수 밖에서 하나만 만들어 두 전략에 넘기면 탭 둘이 다시 둘 다 /?error=LOGIN_FAILED(확인이 가린다)', async () => {
      const wrong = edit1(edit1(LAB('practice2.js'),
        'function createLabStrategy({',
        "const sharedStore = createStateStore('lab');\n\nfunction createLabStrategy({"),
        'store: createStateStore(provider), pkce: true', 'store: sharedStore, pkce: true');
      const got = await withService('practice2.js', wrong, async ({ base }) => labTwoTabs(base, ['A', 'B']));
      expect([got.A, got.B]).toEqual([[302, '/?error=LOGIN_FAILED'], [302, '/?error=LOGIN_FAILED']]);
    }, 60_000);

    it('🔎 톡 userInfoURL 을 틀린 경로(/v2/user/me)로 바꾸면 302 /?error=LOGIN_FAILED · 서비스 터미널 첫 줄 «Error: 사용자 정보를 받지 못했어요 (talk · 404)»(톡 서버는 없는 주소에 404)', async () => {
      const wrong = edit1(LAB('practice2.js'), "  userInfoURL: `${TALK_SERVER}/v2/me`,", "  userInfoURL: `${TALK_SERVER}/v2/user/me`,");
      const got = await withService('practice2.js', wrong, async ({ base, tail }) => {
        const before = tail().length;
        const sora = await labLogin(base, 'talk', 'sora');
        await sleep(150);
        return { callback: sora.callback, terminal: tail().slice(before) };
      });
      expect(got.callback).toEqual([302, '/?error=LOGIN_FAILED']);
      const lines = got.terminal.split('\n').filter(Boolean);
      expect(lines[0]).toBe('Error: 사용자 정보를 받지 못했어요 (talk · 404)');
      expect(lines[1]).toMatch(/^ {4}at strategy\.userProfile \(file:\/\/.*lab\/p3-47\/practice2\.js:\d+:\d+\)$/);
      labSeen.practice2WrongUserInfo = lines.slice(0, 2).map((l) => l.replace(/file:\/\/\S*\/lab\//, 'file://~/instagram-api/lab/'));
    }, 60_000);

    it('🔎 사용자 정보 실패 문장 — «사용자 정보를 받지 못했어요 (talk · 401)» 꼴(수업 함수와 같다)', () => {
      expect(LAB('practice2.js')).toContain('throw new Error(`사용자 정보를 받지 못했어요 (${provider} · ${response.status})`);');
    });
  });

  describe('축 ⑩ 직접 해보기 3 — readEmail(provider, info)', () => {
    const RIGHT = [
      'google  minji.kim@gmail.com   확인됨',
      'google  minji.kim@gmail.com   확인 안 됨',
      'kakao   minji.kim@kakao.com   확인됨',
      'kakao   haru@kakao.com        확인 안 됨',
      'kakao   mi***@kakao.com       확인 안 됨',
      'kakao   -                     확인 안 됨',
      'kakao   -                     확인 안 됨',
      'naver   minji.kim@naver.com   확인 안 됨',
    ];
    const run = (source) => runLabScript('practice3.js', source);

    it('🔴 정답 — 여덟 줄', () => {
      const { code, out } = run(LAB('practice3.js'));
      expect(code).toBe(0);
      expect(out.trimEnd().split('\n')).toEqual(RIGHT);
      labSeen.practice3 = out;
    });

    it('🔴 시작 파일 — 비운 채로 문법 검사를 통과하고 여덟 줄 모두 «-  확인 안 됨» · 정답과는 함수 하나만 다르다', () => {
      const start = SNAP('practice3-start.practice3.js');
      nodeCheck(start);
      expect(run(start).out.trimEnd().split('\n')).toEqual(RIGHT.map((line) => `${line.slice(0, 8)}${'-'.padEnd(22)}확인 안 됨`));
      const from = '// 제공자의 응답에서 이메일과, 확인된 이메일인지를 꺼낸다';
      const to = 'for (const [provider, info] of samples)';
      expect(start.slice(0, start.indexOf(from))).toBe(LAB('practice3.js').slice(0, LAB('practice3.js').indexOf(from)));
      expect(start.slice(start.indexOf(to))).toBe(LAB('practice3.js').slice(LAB('practice3.js').indexOf(to)));
    });

    it('🔴 틀린 판 — || 면 넷째·다섯째 줄이 «확인됨»', () => {
      const out = run(edit1(LAB('practice3.js'), 'is_email_valid === true && info', 'is_email_valid === true || info')).out.trimEnd().split('\n');
      expect(out.filter((line, i) => line !== RIGHT[i])).toEqual(['kakao   haru@kakao.com        확인됨', 'kakao   mi***@kakao.com       확인됨']);
    });

    it('🔴 틀린 판 — is_email_verified 만 보면 다섯째 줄(유효하지 않은 마스킹 이메일)이 «확인됨»', () => {
      const out = run(edit1(LAB('practice3.js'), 'info.kakao_account?.is_email_valid === true && info.kakao_account?.is_email_verified === true', 'info.kakao_account?.is_email_verified === true')).out.trimEnd().split('\n');
      expect(out.filter((line, i) => line !== RIGHT[i])).toEqual(['kakao   mi***@kakao.com       확인됨']);
    });

    it('🔴 틀린 판 — ?. 없이 info.kakao_account.email 이면 여섯 줄을 찍고 일곱째 샘플에서 TypeError 로 멈춘다', () => {
      const { code, out } = run(edit1(LAB('practice3.js'), '      email: info.kakao_account?.email,', '      email: info.kakao_account.email,'));
      expect(code).toBe(1);
      const lines = out.split('\n');
      expect(lines.slice(0, 6)).toEqual(RIGHT.slice(0, 6));
      expect(out).toContain("TypeError: Cannot read properties of undefined (reading 'email')");
      labSeen.practice3NoOptional = out.slice(out.indexOf(RIGHT[5]) + RIGHT[5].length + 1);
    });

    it('🔴 틀린 판 — 네이버를 맨 위에서 읽으면(info.email) 여덟째 줄의 이메일이 «-»', () => {
      const out = run(edit1(LAB('practice3.js'), '  return { email: info.response.email, emailVerified: false };', '  return { email: info.email, emailVerified: false };')).out.trimEnd().split('\n');
      expect(out.filter((line, i) => line !== RIGHT[i])).toEqual([`naver   ${'-'.padEnd(22)}확인 안 됨`]);
    });
  });

  describe('축 ⑪ 과제 [기초] — 톡에서 이메일을 받는다', () => {
    /** 확인 절차를 차례대로 돌려 관찰한 것을 돌려준다 — 정답 판과 틀린 판을 같은 절차로 잰다. */
    const observe = (source) => withService('homework1.js', source, async ({ base, tail }) => {
      const got = {};
      got.bomi = (await labLogin(base, 'talk', 'bomi')).me;
      got.haru = (await labLogin(base, 'talk', 'haru')).me;
      got.dahyeEmailOn = (await labLogin(base, 'talk', 'dahye')).callback;
      got.membersAfterTaken = (await browser(base).get('/members')).body.length;
      got.dahyeEmailOff = (await labLogin(base, 'talk', 'dahye', { email: false })).me;
      got.soraAgain = (await labLogin(base, 'talk', 'sora')).me;
      got.jaehoonLab = (await labLogin(base, 'lab', 'jaehoon')).me;
      // ⑦ 인가 서버 dahye — 1번 dahye 와 이메일이 같지만, 인가 서버의 이메일은 확인되지 않은 것이라 비교하지 않는다
      const dahyeLab = await labLogin(base, 'lab', 'dahye');
      got.dahyeLabCallback = dahyeLab.callback;
      got.dahyeLab = dahyeLab.me;
      got.members = (await browser(base).get('/members')).body;
      await sleep(150);
      got.terminal = tail();
      return got;
    });
    const RIGHT = {
      bomi: { id: 3, nickname: '보미', email: 'bomi@talk.example' },
      haru: { id: 4, nickname: '하루' },
      dahyeEmailOn: [302, '/?error=EMAIL_TAKEN'],
      membersAfterTaken: 4,
      dahyeEmailOff: { id: 5, nickname: '다혜' },
      soraAgain: { id: 2, nickname: '소라' },
      jaehoonLab: { id: 6, nickname: 'jaehoon' },
      dahyeLabCallback: [302, '/me'],
      dahyeLab: { id: 7, nickname: 'dahye' },
      members: [
        { id: 1, nickname: 'dahye', email: 'dahye@example.com', providers: [] },
        { id: 2, nickname: '소라', providers: ['talk'] },
        { id: 3, nickname: '보미', email: 'bomi@talk.example', providers: ['talk'] },
        { id: 4, nickname: '하루', providers: ['talk'] },
        { id: 5, nickname: '다혜', providers: ['talk'] },
        { id: 6, nickname: 'jaehoon', providers: ['lab'] },
        { id: 7, nickname: 'dahye', providers: ['lab'] },
      ],
    };
    const withoutTerminal = ({ terminal, ...rest }) => rest;
    const wrongKeys = (got) => Object.keys(RIGHT).filter((key) => JSON.stringify(got[key]) !== JSON.stringify(RIGHT[key]));

    it('🔴 시작 파일은 직접 해보기 2 정답을 복사한 것 — 첫 줄 경로만 다르다', () => {
      expect(SNAP('homework1-start.homework1.js')).toBe(LAB('practice2.js').replace('// ~/instagram-api/lab/p3-47/practice2.js\n', '// ~/instagram-api/lab/p3-47/homework1.js\n'));
    });

    it('🔴 정답 — 보미(확인됨)는 이메일과 함께 · 하루(확인 안 됨)는 이메일 없이 · 다혜는 이메일을 켜면 EMAIL_TAKEN, 끄면 이메일 없이 · 이미 가입한 소라는 그대로 · 인가 서버의 이메일은 확인 여부가 없어 적지 않는다', async () => {
      const got = await observe(LAB('homework1.js'));
      expect(withoutTerminal(got)).toEqual(RIGHT);
      expect(got.terminal).not.toContain('Error');
      labSeen.homework1 = withoutTerminal(got);
    }, 60_000);

    it('🔴 톡 설정은 scope 에 talk_email · toProfile 이 email · emailVerified(email_checked) 를 읽는다', () => {
      const src = LAB('homework1.js');
      expect(src).toContain("  scope: ['talk_email'],\n");
      expect(src).toContain('    email: info.account?.email,\n    emailVerified: info.account?.email_checked === true,\n');
    });

    it('🔴 homework1.http — 요청 둘 · 회원 목록 200(처음에는 둘) · 로그인하지 않은 «나는 누구» 401', async () => {
      const http = LAB('homework1.http');
      expect(http).toBe('### 회원 목록\nGET http://localhost:4002/members\n\n### 로그인하지 않고 나는 누구\nGET http://localhost:4002/me\n');
      await withService('homework1.js', LAB('homework1.js'), async () => {
        const out = await httpyac('homework1.http', http);
        expect(out).toContain('2 requests processed (2 succeeded)');
        expect(out.match(/^HTTP\/1\.1 (\d+)/gm)).toEqual(['HTTP/1.1 200', 'HTTP/1.1 401']);
      });
    }, 60_000);

    it('🔴 (a) 확인 여부를 안 보고 넣는 판 — 하루(확인 안 됨)와 인가 서버 jaehoon 의 이메일이 회원에 적힌다', async () => {
      const got = await observe(edit1(LAB('homework1.js'), '  const verifiedEmail = emailVerified ? email : undefined;', '  const verifiedEmail = email;'));
      expect(got.haru).toEqual({ id: 4, nickname: '하루', email: 'haru@talk.example' });
      expect(wrongKeys(got)).toEqual(expect.arrayContaining(['haru', 'members']));
      labSeen.homework1NoCheck = { haru: got.haru, jaehoonLab: got.jaehoonLab };
    }, 60_000);

    it('🔴 (d) 확인 안 된 이메일까지 비교하는 판(시작 파일의 if (email && members.some(…)) 그대로) — 인가 서버 dahye 가 /?error=EMAIL_TAKEN · 나머지 차례는 정답과 같다', async () => {
      const got = await observe(edit1(LAB('homework1.js'),
        '  if (verifiedEmail && members.some((member) => member.email === verifiedEmail)) {',
        '  if (email && members.some((member) => member.email === email)) {'));
      expect(got.dahyeLabCallback).toEqual([302, '/?error=EMAIL_TAKEN']);
      expect(got.dahyeLab).toBeNull();
      expect(wrongKeys(got)).toEqual(['dahyeLabCallback', 'dahyeLab', 'members']);
      // 시작 파일에 있던 줄 그대로다
      expect(SNAP('homework1-start.homework1.js')).toContain('  if (email && members.some((member) => member.email === email)) {');
      labSeen.homework1CompareUnverified = { dahyeLabCallback: got.dahyeLabCallback };
    }, 60_000);

    it('🔴 (b) 겹치는 이메일을 그 회원에 잇는 판(자동 연결) — 톡의 다혜가 1번 dahye 로 로그인된다', async () => {
      const got = await observe(edit1(LAB('homework1.js'),
        "  if (verifiedEmail && members.some((member) => member.email === verifiedEmail)) {\n    throw Object.assign(new Error('이미 가입한 이메일이에요'), { code: 'EMAIL_TAKEN' });\n  }\n",
        '  const sameEmail = members.find((member) => verifiedEmail && member.email === verifiedEmail);\n\n  if (sameEmail) {\n    socialAccounts.push({ provider, providerUserId: id, memberId: sameEmail.id });\n    return sameEmail;\n  }\n'));
      expect(got.dahyeEmailOn).toEqual([302, '/me']);
      expect(wrongKeys(got)).toContain('dahyeEmailOn');
      expect(got.members.find((m) => m.id === 1)).toEqual({ id: 1, nickname: 'dahye', email: 'dahye@example.com', providers: ['talk'] });
    }, 60_000);

    it('🔴 (c) 톡의 이름 대신 카카오의 이름(is_email_verified)으로 읽은 판 — 늘 확인 안 됨이라 보미도 이메일 없이 · 다혜도 EMAIL_TAKEN 이 아니다', async () => {
      const got = await observe(edit1(LAB('homework1.js'), 'emailVerified: info.account?.email_checked === true,', 'emailVerified: info.account?.is_email_verified === true,'));
      expect(got.bomi).toEqual({ id: 3, nickname: '보미' });
      expect(got.dahyeEmailOn).toEqual([302, '/me']);
      expect(wrongKeys(got)).toEqual(expect.arrayContaining(['bomi', 'dahyeEmailOn']));
    }, 60_000);
  });

  describe('축 ⑫ 과제 [응용] — 돌아올 주소를 제공자마다', () => {
    it('🔴 시작 파일은 나눠 준 one-callback.js 를 복사한 것 — 첫 줄 경로만 다르다', () => {
      expect(SNAP('homework2-start.homework2.js')).toBe(LAB('one-callback.js').replace('// ~/instagram-api/lab/p3-47/one-callback.js\n', '// ~/instagram-api/lab/p3-47/homework2.js\n'));
      expect(LAB('homework2.js')).not.toContain('lab_provider');
    });

    const twoTabsWithLog = (source) => withService('homework2.js', source, async ({ base, tail }) => {
      const got = await labTwoTabs(base, ['A', 'B']);
      await sleep(150);
      return { A: got.A, B: got.B, stateA: got.stateA, stateB: got.stateB, log: tail().split('\n').filter((line) => line.startsWith('[콜백]')), jarAfterStarts: got.jarAfterStarts };
    });

    it('🔴 확인 — 탭 둘(교안 Step 3 와 같은 차례) 둘 다 /me · 콜백 로그가 «주소가 고른 전략» 을 찍는다', async () => {
      const got = await twoTabsWithLog(LAB('homework2.js'));
      expect([got.A, got.B]).toEqual([[302, '/me'], [302, '/me']]);
      expect(got.log).toEqual([`[콜백] /callback · 전략 lab · 돌아온 state=${got.stateA}`, `[콜백] /talk/callback · 전략 talk · 돌아온 state=${got.stateB}`]);
      expect(got.jarAfterStarts).toEqual(['lab_state_lab /', 'lab_state_talk /', 'lab_verifier_lab /', 'lab_verifier_talk /']);
      labSeen.homework2TwoTabs = { A: got.A, B: got.B, log: got.log.map((line) => line.replace(/state=.*$/, 'state=…')) };
    }, 60_000);

    it('🔴 homework2.http — 쿠키 없이 톡 콜백 · 인가 서버 콜백 주소로 오면 둘 다 302 Location: /?error=LOGIN_FAILED', async () => {
      const http = LAB('homework2.http');
      expect(http).toBe('### 쿠키 없이 톡 콜백 주소로\n# @no-redirect\nGET http://localhost:4002/talk/callback?code=x&state=y\n\n### 쿠키 없이 인가 서버 콜백 주소로\n# @no-redirect\nGET http://localhost:4002/callback?code=x&state=y\n');
      await withService('homework2.js', LAB('homework2.js'), async () => {
        const out = await httpyac('homework2.http', http);
        expect(out).toContain('2 requests processed (2 succeeded)');
        expect(out.match(/^HTTP\/1\.1 (\d+)/gm)).toEqual(['HTTP/1.1 302', 'HTTP/1.1 302']);
        expect(out.match(/^location: (.*)$/gim)).toEqual(['location: /?error=LOGIN_FAILED', 'location: /?error=LOGIN_FAILED']);
        labSeen.homework2Http = out.replace(/^(date|etag|x-powered-by|connection|keep-alive): .*\n/gim, '');
      });
    }, 60_000);

    it('🔴 인가 서버의 코드를 톡 콜백 주소로 가져가면 302 /?error=LOGIN_FAILED — 톡 전략의 state 비교에서 멈춰 톡에 토큰을 묻지 않는다 · 원래 주소(/callback)로 가져가면 그대로 로그인된다', async () => {
      const before = talk.tail().length;
      const got = await withService('homework2.js', LAB('homework2.js'), async ({ base, tail }) => {
        const tab = browser(base);
        const back = await consentLab(await tab.get('/login'), 'jaehoon');
        const moved = await tab.get(back.replace('/callback?', '/talk/callback?'));
        const original = await tab.get(back);
        await sleep(150);
        return { moved: [moved.status, moved.location], original: [original.status, original.location], log: tail().split('\n').filter((line) => line.startsWith('[콜백]')).map((line) => line.replace(/state=.*$/, 'state=…')) };
      });
      expect(got.moved).toEqual([302, '/?error=LOGIN_FAILED']);
      expect(got.original).toEqual([302, '/me']);
      expect(got.log).toEqual(['[콜백] /talk/callback · 전략 talk · 돌아온 state=…', '[콜백] /callback · 전략 lab · 돌아온 state=…']);
      expect(talkLogSince(before)).not.toContain('POST /oauth/token');
      labSeen.homework2MovedCode = got;
    }, 60_000);

    // 확인 하나 더 — 톡 설정의 clientSecret 을 잠깐 talk-secret-x 로 바꿔 «톡 콜백에서 에러가 나는» 장면을 만든다.
    const secretSceneRaw = async (source) => withService('homework2.js', edit1(source, "    clientSecret: 'talk-secret',", "    clientSecret: 'talk-secret-x',"), async ({ base, tail }) => {
      const tab = browser(base);
      const back = await consentTalk(await tab.get('/talk'), 'sora');
      const res = await fetch(`${base}${back}`, { redirect: 'manual', headers: { Cookie: ['lab_state_talk', 'lab_verifier_talk'].map((n) => `${n}=${tab.cookie(n)}`).join('; ') } });
      const body = await res.text();
      await sleep(150);
      return { status: res.status, location: res.headers.get('location'), contentType: res.headers.get('content-type'), body, terminal: tail() };
    });
    const MIDDLEWARE_BOTH = "app.use(['/callback', '/talk/callback'], (err, req, res, next) => {";
    const MIDDLEWARE_ONE = "app.use('/callback', (err, req, res, next) => {";

    it('🔴 확인 — 톡 설정의 clientSecret 을 talk-secret-x 로 바꾸고 sora 로 허용하면 302 /?error=LOGIN_FAILED · 서비스 터미널에 콜백 줄 다음 «TokenError: 앱을 확인하지 못했어요»', async () => {
      const got = await secretSceneRaw(LAB('homework2.js'));
      expect([got.status, got.location]).toEqual([302, '/?error=LOGIN_FAILED']);
      const lines = got.terminal.split('\n');
      const at = lines.findIndex((line) => line.startsWith('[콜백] /talk/callback · 전략 talk · 돌아온 state='));
      expect(at).toBeGreaterThan(0);
      expect(lines[at + 1]).toBe('TokenError: 앱을 확인하지 못했어요');
      expect(got.terminal).toContain("  code: 'invalid_client',");
      labSeen.homework2WrongSecret = { status: got.status, location: got.location, terminal: lines.slice(at, at + 4).join('\n').replace(/state=\S+/, 'state=…').replace(/\(\/[^)]*node_modules/g, '(…/node_modules') };
    }, 60_000);

    it('🔴 (다) 에러 미들웨어를 /callback 에만 둔 판(나눠 준 one-callback 그대로의 app.use) — 탭 둘 · .http 확인은 정답과 같아 못 가리고, clientSecret 장면에서 500 · text/html · Express 기본 에러 화면', async () => {
      expect(LAB('one-callback.js')).toContain(MIDDLEWARE_ONE);
      const wrong = edit1(LAB('homework2.js'), MIDDLEWARE_BOTH, MIDDLEWARE_ONE);
      // 다른 확인으로는 안 가려진다
      const twoTabs = await twoTabsWithLog(wrong);
      expect([twoTabs.A, twoTabs.B]).toEqual([[302, '/me'], [302, '/me']]);
      const got = await secretSceneRaw(wrong);
      expect(got.status).toBe(500);
      expect(got.location).toBeNull();
      expect(got.contentType).toBe('text/html; charset=utf-8');
      expect(got.body.startsWith('<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>Error</title>\n</head>\n<body>\n<pre>TokenError: 앱을 확인하지 못했어요<br>')).toBe(true);
      labSeen.homework2WrongSecretOneMiddleware = { status: got.status, contentType: got.contentType, bodyHead: got.body.split('<br>')[0], bodyLines: got.body.split('\n').slice(0, 8), terminalHead: got.terminal.split('\n').filter((l) => l && !l.startsWith('3986')).slice(0, 3) };
    }, 60_000);

    it('🔴 틀린 판 (가) — 콜백은 나눴지만 lab_provider 쿠키로 전략을 고르는 줄이 남은 판: 탭 둘이 둘 다 /?error=LOGIN_FAILED(확인이 가린다)', async () => {
      const wrong = LAB('homework2.js')
        .replace("app.get('/login', passport.authenticate('lab', { session: false }));", "app.get('/login', (req, res, next) => {\n  res.cookie('lab_provider', 'lab', tempCookie);\n  next();\n}, passport.authenticate('lab', { session: false }));")
        .replace("app.get('/talk', passport.authenticate('talk', { session: false }));", "app.get('/talk', (req, res, next) => {\n  res.cookie('lab_provider', 'talk', tempCookie);\n  next();\n}, passport.authenticate('talk', { session: false }));")
        .replaceAll("passport.authenticate('lab', { session: false, failureRedirect: '/?error=LOGIN_FAILED' })", "(req, res, next) => passport.authenticate(req.cookies.lab_provider, { session: false, failureRedirect: '/?error=LOGIN_FAILED' })(req, res, next)")
        .replaceAll("passport.authenticate('talk', { session: false, failureRedirect: '/?error=LOGIN_FAILED' })", "(req, res, next) => passport.authenticate(req.cookies.lab_provider, { session: false, failureRedirect: '/?error=LOGIN_FAILED' })(req, res, next)");
      expect(wrong.match(/req\.cookies\.lab_provider/g)).toHaveLength(2);
      const got = await twoTabsWithLog(wrong);
      expect([got.A, got.B]).toEqual([[302, '/?error=LOGIN_FAILED'], [302, '/?error=LOGIN_FAILED']]);
    }, 60_000);

    it('🔴 틀린 판 (나) — 톡 콜백 주소만 바꾸고 톡 설정의 callbackURL 은 /callback 그대로 둔 판: 톡이 /callback 으로 돌려보내(그 주소도 톡에 등록돼 있다) 인가 서버 전략이 받고 state 에서 멈춘다 — 톡 로그인 302 /?error=LOGIN_FAILED', async () => {
      const before = talk.tail().length;
      const wrong = edit1(LAB('homework2.js'), "    clientSecret: 'talk-secret',\n    callbackURL: 'http://localhost:4002/talk/callback',", "    clientSecret: 'talk-secret',\n    callbackURL: 'http://localhost:4002/callback',");
      const got = await withService('homework2.js', wrong, async ({ base, tail }) => {
        const sora = await labLogin(base, 'talk', 'sora');
        await sleep(150);
        return { back: sora.back.split('?')[0], callback: sora.callback, log: tail().split('\n').filter((line) => line.startsWith('[콜백]')).map((line) => line.replace(/state=.*$/, 'state=…')) };
      });
      expect(got).toEqual({ back: '/callback', callback: [302, '/?error=LOGIN_FAILED'], log: ['[콜백] /callback · 전략 lab · 돌아온 state=…'] });
      expect(talkLogSince(before)).not.toContain('POST /oauth/token');
      labSeen.homework2OldTalkCallback = got;
    }, 60_000);
  });
});
