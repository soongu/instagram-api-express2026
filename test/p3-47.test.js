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
}`, `// 제공자에게 다녀온 사람(req.user)에게 로그인을 준다 — 비밀번호 로그인과 같은 로그인 기록, 같은 쿠키 둘.
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

// 소셜 로그인 전략을 만든다 — 제공자마다 다른 것만 받는다(주소 · 클라이언트 ID와 시크릿 · scope · 사용자 정보를 읽는 법).
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

      // 응답을 우리 이름(id · email · emailVerified · name)으로 맞추는 일은 제공자마다 달라서 toProfile 이 한다.
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
  // 구글이 준 사용자 정보를 우리 이름으로 맞춘다 — id 는 구글이 그 계정에 매긴, 바뀌지 않는 값(sub)이다.
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
