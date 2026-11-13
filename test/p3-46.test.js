// p3-46 「카카오·네이버 로그인 — 전략 둘 붙이기」 게이트 — 백엔드
// 내부 검증 전용 — 교안에 한 줄도 인용하지 않는다.
//
// `7-express-auth` 열한째 회차다(`curriculum.md` 「`p3-46` 착수 결정」).
// Step 2~6 본문은 수업 백엔드(Step 1 은 읽기 · Step 7 은 화면). Step 마다의 판은 커밋 제목의 «(Step N)» 표식으로 꺼낸다
// (같은 표식이 여럿이면 가장 뒤 커밋).
// 🔑 진짜 카카오·네이버·구글에는 요청을 보내지 않는다 — 학생 파일 사본의 제공자 주소(셋씩)만 가짜 제공자
//    (`helpers/fake-kakao.js` · `fake-naver.js` · `fake-google.js`)로 바꿔 띄운다
//    (`replaceAll` · 바꿀 글자가 없으면 던진다 · 바꾼 뒤 진짜 주소가 남아 있으면 던진다).
// 🔑 판정에는 화면이 없으니 백엔드 주소를 화면 주소(`SITE_URL`)로 삼는다 — 콜백이 곧바로 백엔드로 돌아온다.
// 🔑 짓는 동안 `P346_WT=N` 을 주면 Step N 의 판을 커밋 대신 작업트리에서 읽는다(Red 를 실제 동작으로 보려고).
//
// 축 ① Step 2 — `.env.example` 에 카카오 이름 둘
// 축 ② Step 3 — 카카오 전략 첫 판(구글 파일을 복사해 주소와 키만 바꿨다) — 시작은 되고 로그인은 안 된다
// 축 ③ Step 4 — 카카오 프로필을 우리 모양으로 — 로그인이 된다 · 틀린 판 둘
// 축 ④ Step 5 — `.env.example` 에 네이버 이름 둘
// 축 ⑤ Step 6 — 네이버 전략(새 OIDC 경로)과 프로필 · 틀린 판
// 축 ⑥ 파생 대조 — 전략 파일 셋의 다른 줄 · 학생 파일 가운데 바뀐 것
// 축 ⑦ 세 제공자가 함께 — 구글 회귀 · 이름 겹침 · 탭 둘(지금은 둘 다 실패 — 다음 회차가 뒤집는다) · 에러 미들웨어의 차례
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
import { startFakeKakao, DEFAULT_KAKAO_PROFILE, KAKAO_NO_NICKNAME } from './helpers/fake-kakao.js';
import { startFakeNaver, DEFAULT_NAVER_PROFILE } from './helpers/fake-naver.js';

const ROOT = new URL('../', import.meta.url);
const P = (rel) => new URL(rel, ROOT).pathname;
const read = (path) => readFileSync(path, 'utf8');
const ADMIN = { host: 'localhost', port: 5432, database: 'postgres', user: 'postgres', password: 'postgres' };
const TPL_DB = 'p346_tpl';
const GATE_DB = 'p346_gate';
const GATE_URL = `postgresql://postgres:postgres@localhost:5432/${GATE_DB}`;
const PORT = 3970;
const KAKAO_PORT = 3971;
const NAVER_PORT = 3972;
const GOOGLE_PORT = 3973;
const SITE = `http://localhost:${PORT}`;

// 이 회차 북마크 `code/p3-46` 을 풀어서 읽는다(없으면 작업트리 — 이 회차를 짓는 동안).
const ROUND = roundDir('code/p3-46');
const R = (rel) => join(ROUND.dir, rel);

const SECRET = 'q2Xh0v9bGm4RkT7sYp1wLc8nZf3uJd6eHa5iVo0rQyE';
const GOOGLE_ENV = { GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret', SITE_URL: SITE };
const KAKAO_ENV = { KAKAO_CLIENT_ID: 'test-kakao', KAKAO_CLIENT_SECRET: 'test-kakao-secret' };
const NAVER_ENV = { NAVER_CLIENT_ID: 'test-naver', NAVER_CLIENT_SECRET: 'test-naver-secret' };
const env = { DATABASE_URL: GATE_URL, CORS_ORIGIN: 'http://localhost:3001', JWT_SECRET: SECRET, ...GOOGLE_ENV, ...KAKAO_ENV, ...NAVER_ENV };
const STUDENT_FILES = ['app.js', 'db.js', 'errors.js', 'responses.js', 'routes', 'controllers', 'services', 'middlewares', 'schemas', 'strategies', 'docs', 'package.json', 'requests', 'seed.js', 'data', 'prisma', 'prisma.config.js', '.env.example'];

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
const LINE = hasRef('refs/heads/code/p3-46') ? 'code/p3-46' : 'main';
const WT = process.env.P346_WT ? Number(process.env.P346_WT) : null;
const commitOf = (n) => {
  const log = execFileSync('git', ['log', '--format=%H %s', `code/p3-45..${LINE}`], { cwd: P('.'), encoding: 'utf8' });
  const hits = log.split('\n').filter((l) => / feat\(p3-46\): /.test(l) && l.endsWith(`(Step ${n})`));
  if (hits.length === 0) throw new Error(`(Step ${n}) 커밋이 없다`);
  return hits[0].split(' ')[0];
};
const dirs = [];
const refDirs = new Map();
/** 커밋(또는 브랜치) 하나를 임시 폴더에 풀어 둔다. */
const refDir = (ref) => {
  if (refDirs.has(ref)) return refDirs.get(ref);
  const dir = mkdtempSync(join(tmpdir(), 'p346-ref-'));
  const tar = execFileSync('git', ['archive', '--format=tar', ref], { cwd: P('.'), maxBuffer: 1 << 28 });
  execFileSync('tar', ['-x', '-C', dir], { input: tar });
  dirs.push(dir);
  const at = (rel) => join(dir, rel);
  refDirs.set(ref, at);
  return at;
};
const stepDir = (n) => (n === WT ? (rel) => P(rel) : refDir(commitOf(n)));
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

const replaceIn = (dir, rel, a, b) => {
  const text = read(join(dir, rel));
  if (!text.includes(a)) throw new Error(`${rel} 에 바꿀 글자가 없다: ${a}`);
  writeFileSync(join(dir, rel), text.replace(a, b));
};
const fakes = {};
/** 제공자 주소만 가짜 제공자로 바꾼다 — 그 판에 있는 전략 파일마다 주소 셋이 반드시 있어야 한다. */
const useFakes = (dir) => {
  for (const provider of ['google', 'kakao', 'naver']) {
    const rel = `strategies/${provider}.js`;
    if (!existsSync(join(dir, rel))) {
      if (provider === 'google') throw new Error(`${rel} 이 없다`);
      continue;
    }
    let text = read(join(dir, rel));
    for (const key of ['authorize', 'token', 'userinfo']) {
      if (!text.includes(REAL[provider][key])) throw new Error(`${rel} 에 바꿀 글자가 없다: ${REAL[provider][key]}`);
      text = text.replaceAll(REAL[provider][key], fakes[provider].urls[key]);
    }
    if (REAL_HOSTS.test(text)) throw new Error(`${rel} 에 진짜 제공자 주소가 남았다`);
    writeFileSync(join(dir, rel), text);
  }
};

const studentDir = (from, edit) => {
  const dir = mkdtempSync(join(tmpdir(), 'p346-srv-'));
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
/** 그 판의 학생 파일 사본을 띄운다 — `fake` 면 제공자 주소를 가짜 제공자로 바꾼 사본. */
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
 * 소셜 로그인 한 바퀴 — 시작 → (가짜) 제공자의 동의 → 콜백.
 * `tamper` 는 돌아오는 주소의 state 를 바꾼다 · `fresh` 는 쿠키 없는 다른 브라우저로 콜백을 연다.
 */
const socialLogin = async (tab, provider, { start: startPath = `/api/v2/auth/${provider}`, next, tamper, fresh } = {}) => {
  const begin = await tab.get(next === undefined ? startPath : `${startPath}?next=${encodeURIComponent(next)}`);
  if (begin.status !== 302) return { begin };
  const consent = await fetch(begin.location, { redirect: 'manual' });
  if (consent.status !== 302) return { begin, consent: { status: consent.status, body: await consent.text() } };
  const back = new URL(consent.headers.get('location'));
  if (tamper !== undefined) back.searchParams.set('state', tamper);
  expect(back.origin).toBe(SITE);
  const callback = await (fresh ? browser(SITE) : tab).get(`${back.pathname}${back.search}`);
  return { begin, consent: { status: consent.status, location: consent.headers.get('location') }, callback };
};
const cookieLine = (res, name) => res.setCookies.find((line) => line.startsWith(`${name}=`));
/** 쿠키 줄에서 값과 날짜만 지운다 — 옵션 글자를 비교하려고. */
const cookieShape = (line) => line.replace(/^([^=]+)=[^;]*/, '$1=…').replace(/Expires=[^;]+/, 'Expires=…');
const s256 = (verifier) => createHash('sha256').update(verifier).digest('base64url');
/** 시작 주소의 Location 을 쿼리째 나눈다. */
const authorizeQuery = (location) => {
  const url = new URL(location);
  return { origin: `${url.origin}${url.pathname}`, query: Object.fromEntries(url.searchParams), keys: [...url.searchParams.keys()] };
};
const callbackOf = (provider) => `${SITE}/api/v2/auth/${provider}/callback`;
const LOGIN_FAILED_PAGE = '/login?error=SOCIAL_LOGIN_FAILED';
const START_COOKIES = [
  'oauth_next=…; Max-Age=600; Path=/api/v2/auth; Expires=…; HttpOnly; SameSite=Lax',
  'oauth_state=…; Max-Age=600; Path=/api/v2/auth; Expires=…; HttpOnly; SameSite=Lax',
  'oauth_verifier=…; Max-Age=600; Path=/api/v2/auth; Expires=…; HttpOnly; SameSite=Lax',
];
const LOGGED_IN_COOKIES = ['accessToken /', 'refreshToken /api/v2/auth'];
const userRow = async (id) => (await gate('SELECT id, username, email, name, password_hash, role FROM users WHERE id = $1', [id]))[0];
const socialRows = () => gate('SELECT user_id, provider, provider_user_id FROM social_accounts ORDER BY id');
/** 터미널 글자에서 실행마다 다른 것(임시 폴더 · 걸린 시간)만 지운다 — 교안에 인용할 글자를 보고에 남기려고. */
const seen = {};
const scrub = (text, dir) => text.replaceAll(`/private${dir}`, '~/instagram-api').replaceAll(dir, '~/instagram-api').replaceAll(P('.').replace(/\/$/, ''), '~/instagram-api').replace(/\d+\.\d+ms/g, 'N.Nms');

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
  // 이번 회차는 스키마를 안 고친다 — 마이그레이션은 `code/p3-45` 와 같다.
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
  // 교안에 인용할 실측 글자 — `P346_SEEN=경로` 를 주면 파일로 남긴다(보고용).
  if (process.env.P346_SEEN) writeFileSync(process.env.P346_SEEN, JSON.stringify(seen, null, 2));
});

beforeEach(() => {
  for (const fake of Object.values(fakes)) fake.reset();
});

describe('축 ① Step 2 — .env.example 에 카카오 REST API 키와 클라이언트 시크릿', () => {
  it('🔴 이름 둘이 끝에 값 없이 — KAKAO_CLIENT_ID · KAKAO_CLIENT_SECRET · 앞 줄은 code/p3-45 그대로', () => {
    const lines = read(stepDir(2)('.env.example')).trimEnd().split('\n');
    expect(lines.slice(-2)).toEqual(['KAKAO_CLIENT_ID=', 'KAKAO_CLIENT_SECRET=']);
    expect(lines.slice(0, -2)).toEqual(showAt('code/p3-45', '.env.example').trimEnd().split('\n'));
    expect(read(stepDir(2)('.env.example')).endsWith('KAKAO_CLIENT_SECRET=\n')).toBe(true);
  });

  it('🔴 Step 2 는 .env.example 한 파일만 고쳤다', () => {
    const names = execFileSync('git', ['diff', '--name-only', 'code/p3-45', commitOf(2), '--', ...STUDENT_FILES], { cwd: P('.'), encoding: 'utf8' }).trim().split('\n');
    expect(names).toEqual(['.env.example']);
  });
});

// ── 파생 대조 도우미 ─────────────────────────────────────────────────────────
/** 두 글의 다른 줄 — `diff` 가 지운 줄(`<`)과 더한 줄(`>`)을 차례대로 돌려준다. */
const diffLines = (a, b) => {
  const dir = mkdtempSync(join(tmpdir(), 'p346-diff-'));
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
const GOOGLE_JS = showAt('code/p3-45', 'strategies/google.js');
const googleLine = (n) => GOOGLE_JS.split('\n')[n - 1];
// 구글 파일에서 «카카오 파일로 복사했을 때 바꿔야 하는 줄» — 줄 번호는 code/p3-45 의 strategies/google.js.
const KAKAO_FIRST = {
  1: '// ~/instagram-api/strategies/kakao.js',
  6: '// 카카오 로그인 전략 — 카카오의 주소 둘과, 카카오 콘솔에서 받은 REST API 키·클라이언트 시크릿을 넣어 만든다.',
  8: 'export const kakaoStrategy = new OAuth2Strategy(',
  10: "    authorizationURL: 'https://kauth.kakao.com/oauth/authorize',",
  11: "    tokenURL: 'https://kauth.kakao.com/oauth/token',",
  12: '    clientID: process.env.KAKAO_CLIENT_ID,',
  13: '    clientSecret: process.env.KAKAO_CLIENT_SECRET,',
  14: '    callbackURL: `${process.env.SITE_URL}/api/v2/auth/kakao/callback`,',
  15: "    scope: ['profile_nickname'],",
  19: '  // 카카오가 확인해 준 사람(profile)을 users 의 사람으로 바꾸는 곳 — 여기서 넘긴 값이 req.user 가 된다.',
  29: '// 카카오에 «이 Access 토큰의 주인이 누구인지» 묻는다 — 토큰은 주소가 아니라 Authorization 헤더에 싣는다.',
  30: 'kakaoStrategy.userProfile = async (accessToken, done) => {',
  32: "    const response = await fetch('https://kapi.kakao.com/v2/user/me', {",
  36: '    if (!response.ok) throw new Error(`카카오가 사용자 정보를 주지 않았어요 (${response.status})`);',
  40: null, // 구글의 «제공자마다 다른 이름을 …» 주석 한 줄은 첫 판에서 뺀다
  42: "      provider: 'kakao',",
};
/** 구글 파일의 줄을 표대로 바꿔 만든 글 — 값이 null 이면 그 줄을 빼고, 배열이면 여러 줄로 바꾼다. */
const derive = (source, table) => source.split('\n').flatMap((line, i) => {
  if (!Object.hasOwn(table, i + 1)) return [line];
  const to = table[i + 1];
  return to === null ? [] : [].concat(to);
}).join('\n');
const KAKAO_STEP3 = derive(GOOGLE_JS, KAKAO_FIRST);
const changedStudentFiles = (from, to) => execFileSync('git', ['diff', '--name-only', from, to, '--', ...STUDENT_FILES], { cwd: P('.'), encoding: 'utf8' }).trim().split('\n');
/** 가짜 카카오로 로그인 한 바퀴를 돌고 콜백 응답을 돌려준다 — 내줄 사람을 먼저 정한다. */
const asKakao = async (base, profile, opts) => {
  if (profile) fakes.kakao.state.profile = structuredClone(profile);
  return (await socialLogin(browser(base), 'kakao', opts)).callback;
};

describe('축 ② Step 3 — 카카오 전략 첫 판(구글 파일을 복사해 주소와 키만 바꿨다)', () => {
  it('🔴 strategies/kakao.js 는 구글 파일에서 열여섯 줄만 다르다 — 주소 셋 · 키 이름 둘 · 돌아올 주소 · scope · 이름 · 주석 · 에러 문장 · provider · (주석 한 줄은 뺐다)', () => {
    const kakao = read(stepDir(3)('strategies/kakao.js'));
    expect(kakao).toBe(KAKAO_STEP3);
    const { removed, added } = diffLines(GOOGLE_JS, kakao);
    expect(removed).toEqual(Object.keys(KAKAO_FIRST).map((n) => googleLine(Number(n))));
    expect(added).toEqual(Object.values(KAKAO_FIRST).filter((line) => line !== null));
    expect([removed.length, added.length]).toEqual([16, 15]);
    // 프로필을 읽는 다섯 줄 가운데 provider 만 바꿨다 — 구글의 이름(sub · email · email_verified · name)이 그대로다
    expect(kakao).toContain("      provider: 'kakao',\n      id: info.sub,\n      email: info.email,\n      emailVerified: info.email_verified === true,\n      name: info.name,\n");
  });

  it('🔴 app.js 는 두 줄만 더했다 — 구글 import 아래 · 구글 passport.use 아래', () => {
    const [before, after] = [showAt('code/p3-45', 'app.js'), read(stepDir(3)('app.js'))];
    const { removed, added } = diffLines(before, after);
    expect(removed).toEqual([]);
    expect(added).toEqual(["import { kakaoStrategy } from './strategies/kakao.js';", "passport.use('kakao', kakaoStrategy);"]);
    expect(after).toContain("import { googleStrategy } from './strategies/google.js';\nimport { kakaoStrategy } from './strategies/kakao.js';\n");
    expect(after).toContain("passport.use('google', googleStrategy);\npassport.use('kakao', kakaoStrategy);\n");
  });

  it('🔴 routes/auth.js 는 카카오 블록(주석 + 라우트 둘 + 에러 미들웨어)과 router.all 둘만 더했다 — 에러 미들웨어는 router.all 들보다 위', () => {
    const [before, after] = [showAt('code/p3-45', 'routes/auth.js'), read(stepDir(3)('routes/auth.js'))];
    const { removed, added } = diffLines(before, after);
    expect(removed).toEqual([]);
    expect(added).toEqual([
      '// 카카오 로그인 — 구글과 같은 주소 둘이다. 전략의 이름만 다르다.',
      "router.get('/kakao', authController.rememberNext, passport.authenticate('kakao', { session: false }));",
      'router.get(',
      "  '/kakao/callback',",
      "  passport.authenticate('kakao', { session: false, failureRedirect: '/login?error=SOCIAL_LOGIN_FAILED' }),",
      '  authController.socialCallback,',
      ');',
      "router.use('/kakao', authController.socialFailed);",
      "router.all('/kakao', allowOnly('GET'));",
      "router.all('/kakao/callback', allowOnly('GET'));",
    ]);
    expect(after).toContain("router.use('/google', authController.socialFailed);\n// 카카오 로그인 — 구글과 같은 주소 둘이다. 전략의 이름만 다르다.\n");
    expect(after).toContain("router.use('/kakao', authController.socialFailed);\n\nrouter.all('/signup', allowOnly('POST'));\n");
    expect(after.endsWith("router.all('/google/callback', allowOnly('GET'));\nrouter.all('/kakao', allowOnly('GET'));\nrouter.all('/kakao/callback', allowOnly('GET'));\n\nexport default router;\n")).toBe(true);
  });

  it('🔴 Step 3 이 고친 학생 파일은 셋 — app.js · routes/auth.js · strategies/kakao.js(새 파일) · 새 패키지 0', () => {
    expect(changedStudentFiles(commitOf(2), commitOf(3))).toEqual(['app.js', 'routes/auth.js', 'strategies/kakao.js']);
    expect(showAt(commitOf(3), 'package.json')).toBe(showAt('code/p3-45', 'package.json'));
    expect(showAt(commitOf(3), 'package-lock.json')).toBe(showAt('code/p3-45', 'package-lock.json'));
  });

  it('🔴 .env 에 KAKAO_CLIENT_ID 가 없으면 서버가 뜨지 않는다 — OAuth2Strategy 생성자가 clientID 를 요구한다', async () => {
    const dir = studentDir(stepDir(3));
    const log = await bootFailure(dir, { without: Object.keys(KAKAO_ENV) });
    expect(log).toMatch(/TypeError: OAuth2Strategy requires a clientID option/);
    // 어느 파일인지는 스택에 나온다 — strategies/kakao.js
    expect(log).toMatch(/strategies\/kakao\.js:8:\d+/);
    seen.noKakaoClientId = scrub(log.split('\n').slice(1).join('\n'), dir);
  }, 30_000);

  it('🔎 KAKAO_CLIENT_SECRET 만 빠지면 서버는 뜨고 시작도 302 다', async () => {
    await withServer(stepDir(3), async ({ base }) => {
      expect((await browser(base).get('/api/v2/auth/kakao')).status).toBe(302);
    }, { fake: false, without: ['KAKAO_CLIENT_SECRET'] });
  }, 30_000);

  it('🔴 시작 요청은 302 — 카카오 인가 주소 + response_type · redirect_uri · scope=profile_nickname · code_challenge · S256 · state · client_id · 쿠키 셋', async () => {
    await withServer(stepDir(3), async ({ base }) => {
      const tab = browser(base);
      const res = await tab.get('/api/v2/auth/kakao');
      expect(res.status).toBe(302);
      const { origin, query, keys } = authorizeQuery(res.location);
      expect(origin).toBe(REAL.kakao.authorize);
      expect(keys).toEqual(['response_type', 'redirect_uri', 'scope', 'code_challenge', 'code_challenge_method', 'state', 'client_id']);
      expect(query).toMatchObject({ response_type: 'code', redirect_uri: callbackOf('kakao'), scope: 'profile_nickname', code_challenge_method: 'S256', client_id: 'test-kakao' });
      expect(query.state).toMatch(/^[A-Za-z0-9_-]{22}$/);
      expect(query.code_challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(res.setCookies.map(cookieShape)).toEqual(START_COOKIES);
      expect(tab.cookie('oauth_state')).toBe(query.state);
      expect(s256(tab.cookie('oauth_verifier'))).toBe(query.code_challenge);
      seen.kakaoStartLocation = res.location.replace(/(state|code_challenge)=[A-Za-z0-9_-]+/g, '$1=…');
    }, { fake: false });
  }, 30_000);

  it('🔴 카카오 주소 둘은 GET 만 — POST 는 405 + Allow: GET(JSON 그대로)', async () => {
    await withServer(stepDir(3), async ({ base }) => {
      for (const path of ['/api/v2/auth/kakao', '/api/v2/auth/kakao/callback']) {
        const res = await browser(base).post(path, {});
        expect([path, res.status, res.headers.get('allow'), res.body.error?.code]).toEqual([path, 405, 'GET', 'METHOD_NOT_ALLOWED']);
      }
    }, { fake: false });
  }, 30_000);

  it('🔴 콜백까지 가면 로그인이 안 된다 — 토큰도 사용자 정보도 받았는데 302 /login?error=SOCIAL_LOGIN_FAILED · 터미널에 Prisma 검증 에러(Argument `providerUserId` is missing.) · 행 수 그대로', async () => {
    await freshGate();
    await withServer(stepDir(3), async ({ base, tail, dir }) => {
      const before = await counts();
      const tab = browser(base);
      const { begin, consent, callback } = await socialLogin(tab, 'kakao');
      expect(begin.status).toBe(302);
      expect(consent.status).toBe(302);
      // 카카오와의 주고받기는 끝까지 됐다 — 토큰 요청 하나 · 사용자 정보 요청 하나(둘 다 성공)
      expect(fakes.kakao.state.log.token).toHaveLength(1);
      expect(fakes.kakao.state.log.userinfo).toHaveLength(1);
      expect(fakes.kakao.state.tokens.size).toBe(1);
      expect(callback.status).toBe(302);
      expect(callback.location).toBe(LOGIN_FAILED_PAGE);
      expect(tab.cookies()).toEqual(['oauth_next /api/v2/auth']);
      expect(await counts()).toEqual(before);
      await sleep(150);
      const log = tail();
      expect(log).toContain('PrismaClientValidationError');
      expect(log).toContain('Invalid `prisma.socialAccount.findUnique()` invocation:');
      expect(log).toContain('Argument `providerUserId` is missing.');
      expect(log).toMatch(/GET \/api\/v2\/auth\/kakao\/callback\?code=[^ ]+ 302 /);
      seen.step3Callback = scrub(log.slice(log.indexOf('\n', log.indexOf('GET /api/v2/auth/kakao 302')) + 1), dir).replace(/(code|state)=[A-Za-z0-9_-]+/g, '$1=…');
    });
  }, 30_000);

  it('🔴 응답을 찍어 보는 판(스냅숏)은 Step 3 판에 «console.log(info);» 한 줄만 더한 것 — 터미널에 카카오가 준 객체가 찍힌다(sub·email·name 이 없다)', async () => {
    const before = read(stepDir(3)('strategies/kakao.js'));
    const after = read(P('snapshots/p3-46.step3-log.kakao.js'));
    const { removed, added } = diffLines(before, after);
    expect(removed).toEqual([]);
    expect(added).toEqual(['    console.log(info);']);
    expect(after).toContain('    const info = await response.json();\n    console.log(info);\n');
    await freshGate();
    await withServer(stepDir(3), async ({ base, tail }) => {
      const { callback } = await socialLogin(browser(base), 'kakao');
      expect(callback.location).toBe(LOGIN_FAILED_PAGE);
      await sleep(150);
      const log = tail();
      const at = log.indexOf('{\n  id: 3812345678,');
      expect(at).toBeGreaterThan(0);
      const printed = log.slice(at, log.indexOf('\n}\n', at) + 2);
      expect(printed).toBe(`{
  id: 3812345678,
  connected_at: '2026-11-12T05:21:08Z',
  properties: { nickname: '민지' },
  kakao_account: {
    profile_nickname_needs_agreement: false,
    profile_image_needs_agreement: true,
    profile: { nickname: '민지', is_default_nickname: false }
  }
}`);
      seen.step3InfoLog = printed;
    }, { fake: false, edit: (d) => { cpSync(P('snapshots/p3-46.step3-log.kakao.js'), join(d, 'strategies/kakao.js')); useFakes(d); } });
  }, 30_000);

  it('🔴 토큰 주소가 받은 것 — POST · 폼 본문에 grant_type · code · redirect_uri · code_verifier(그 S256 이 challenge) · client_id · client_secret', async () => {
    await freshGate();
    await withServer(stepDir(3), async ({ base }) => {
      const { consent } = await socialLogin(browser(base), 'kakao');
      const [{ body, contentType, authorization }] = fakes.kakao.state.log.token;
      expect(contentType).toBe('application/x-www-form-urlencoded');
      expect(authorization).toBeUndefined();
      expect(Object.keys(body).sort()).toEqual(['client_id', 'client_secret', 'code', 'code_verifier', 'grant_type', 'redirect_uri']);
      expect(body).toMatchObject({
        grant_type: 'authorization_code',
        redirect_uri: callbackOf('kakao'),
        client_id: 'test-kakao',
        client_secret: 'test-kakao-secret',
        code: new URL(consent.location).searchParams.get('code'),
      });
      expect(s256(body.code_verifier)).toBe(fakes.kakao.state.log.authorize[0].code_challenge);
      const [{ url, authorization: bearer }] = fakes.kakao.state.log.userinfo;
      expect(url).toBe('/v2/user/me');
      expect(bearer).toMatch(/^Bearer /);
    });
  }, 30_000);
});

// Step 4 — 프로필을 읽는 블록만 바꾼다(구글 파일 기준 40번 줄의 주석 자리 + 43~46번 줄).
const KAKAO_FINAL = {
  ...KAKAO_FIRST,
  40: [
    '    // 카카오는 같은 뜻의 값을 다른 이름, 다른 위치에 준다 — id 는 카카오가 이 앱에서 그 계정에 매긴 회원번호(숫자)다.',
    '    // 동의항목에 닉네임만 넣었으니 이메일은 오지 않는다.',
  ],
  43: '      id: String(info.id),',
  44: '      email: undefined,',
  45: '      emailVerified: false,',
  46: '      name: info.kakao_account?.profile?.nickname,',
};
const KAKAO_STEP4 = derive(GOOGLE_JS, KAKAO_FINAL);
const sessionsOf = (userId) => gate('SELECT id, refresh_token_hash FROM sessions WHERE user_id = $1', [userId]);

describe('축 ③ Step 4 — 카카오 프로필을 우리 모양으로', () => {
  it('🔴 strategies/kakao.js 는 Step 3 판에서 프로필을 읽는 블록만 바꿨다 — 주석 두 줄을 더하고 네 줄(id · email · emailVerified · name)을 바꿨다', () => {
    const [before, after] = [read(stepDir(3)('strategies/kakao.js')), read(stepDir(4)('strategies/kakao.js'))];
    expect(after).toBe(KAKAO_STEP4);
    const { removed, added } = diffLines(before, after);
    expect(removed).toEqual(['      id: info.sub,', '      email: info.email,', '      emailVerified: info.email_verified === true,', '      name: info.name,']);
    expect(added).toEqual([...KAKAO_FINAL[40], KAKAO_FINAL[43], KAKAO_FINAL[44], KAKAO_FINAL[45], KAKAO_FINAL[46]]);
  });

  it('🔴 Step 4 가 고친 학생 파일은 strategies/kakao.js 하나', () => {
    expect(changedStudentFiles(commitOf(3), commitOf(4))).toEqual(['strategies/kakao.js']);
  });

  it('🔴 처음 온 카카오 사람 — 콜백 302 Location: / · 쿠키 둘 · users 한 행(username kakao · name 닉네임 · email NULL · password_hash NULL) + social_accounts 한 행(kakao · 회원번호 글자) · sessions 한 행 · me 200', async () => {
    await freshGate();
    await withServer(stepDir(4), async ({ base, tail }) => {
      const before = await counts();
      const tab = browser(base);
      const { begin, callback } = await socialLogin(tab, 'kakao');
      expect(begin.setCookies.map(cookieShape)).toEqual(START_COOKIES);
      expect(callback.status).toBe(302);
      expect(callback.location).toBe('/');
      expect(callback.setCookies.map(cookieShape)).toEqual([
        'oauth_state=…; Path=/api/v2/auth; Expires=…',
        'oauth_verifier=…; Path=/api/v2/auth; Expires=…',
        'accessToken=…; Max-Age=604800; Path=/; Expires=…; HttpOnly; SameSite=Lax',
        'refreshToken=…; Max-Age=604800; Path=/api/v2/auth; Expires=…; HttpOnly; SameSite=Lax',
        'oauth_next=…; Path=/api/v2/auth; Expires=…',
      ]);
      expect(tab.cookies()).toEqual(LOGGED_IN_COOKIES);
      const me = await tab.get('/api/v2/auth/me');
      expect(me.status).toBe(200);
      const { id } = me.body.data;
      expect(me.body).toEqual({ data: { id, username: 'kakao', profileImage: null, role: 'USER' } });
      expect(await userRow(id)).toEqual({ id, username: 'kakao', email: null, name: '민지', password_hash: null, role: 'USER' });
      expect(await socialRows()).toEqual([{ user_id: id, provider: 'kakao', provider_user_id: '3812345678' }]);
      const rows = await sessionsOf(id);
      expect(rows).toHaveLength(1);
      expect(tab.cookie('refreshToken').split('.')[0]).toBe(rows[0].id);
      expect(await counts()).toEqual([before[0] + 1, before[1] + 1, before[2] + 1]);
      // 비밀번호 로그인과 같은 쿠키 옵션
      const password = await browser(base).login('jaehoon');
      for (const name of ['accessToken', 'refreshToken']) {
        expect(cookieShape(cookieLine(callback, name))).toBe(cookieShape(cookieLine(password, name)));
      }
      expect((await tab.post('/api/v2/auth/reissue')).status).toBe(200);
      expect((await tab.get('/api/v2/posts?limit=1')).status).toBe(200);
      expect((await tab.post('/api/v2/auth/logout')).status).toBe(200);
      await sleep(100);
      expect(tail()).not.toContain('Error');
    });
  }, 30_000);

  it('🔴 같은 카카오 사람이 다시 오면 행이 안 는다 · 다른 카카오 사람은 username 이 kakao + 숫자 넷 · 회원번호가 큰 수여도 글자로 들어간다', async () => {
    await freshGate();
    await withServer(stepDir(4), async ({ base }) => {
      const tab = browser(base);
      await socialLogin(tab, 'kakao');
      const { id } = (await tab.get('/api/v2/auth/me')).body.data;
      const after = await counts();
      const again = browser(base);
      expect((await socialLogin(again, 'kakao')).callback.location).toBe('/');
      expect((await again.get('/api/v2/auth/me')).body.data.id).toBe(id);
      // 닉네임을 바꾼 뒤(같은 회원번호) 와도 같은 사람 — users.name 은 그대로
      const renamed = browser(base);
      fakes.kakao.state.profile = { ...structuredClone(DEFAULT_KAKAO_PROFILE), kakao_account: { profile_nickname_needs_agreement: false, profile: { nickname: '새 닉네임', is_default_nickname: false } } };
      await socialLogin(renamed, 'kakao');
      expect((await renamed.get('/api/v2/auth/me')).body.data.id).toBe(id);
      expect((await userRow(id)).name).toBe('민지');
      expect([await count('users'), await count('social_accounts')]).toEqual([after[0], after[1]]);
      // 다른 사람
      const other = browser(base);
      fakes.kakao.state.profile = { ...structuredClone(DEFAULT_KAKAO_PROFILE), id: 4123456789, kakao_account: { profile_nickname_needs_agreement: false, profile: { nickname: '서준', is_default_nickname: false } } };
      expect((await socialLogin(other, 'kakao')).callback.location).toBe('/');
      const otherMe = (await other.get('/api/v2/auth/me')).body.data;
      expect(otherMe.username).toMatch(/^kakao\d{4}$/);
      expect(await socialRows()).toEqual([
        { user_id: id, provider: 'kakao', provider_user_id: '3812345678' },
        { user_id: otherMe.id, provider: 'kakao', provider_user_id: '4123456789' },
      ]);
    });
  }, 30_000);

  it('🔴 닉네임 제공에 동의하지 않은 응답(kakao_account.profile 없음) · kakao_account 가 아예 없는 응답이어도 가입된다 — name NULL', async () => {
    await freshGate();
    await withServer(stepDir(4), async ({ base }) => {
      const tab = browser(base);
      fakes.kakao.state.profile = structuredClone(KAKAO_NO_NICKNAME);
      expect((await socialLogin(tab, 'kakao')).callback.location).toBe('/');
      const { id } = (await tab.get('/api/v2/auth/me')).body.data;
      expect(await userRow(id)).toMatchObject({ username: 'kakao', name: null, email: null });
      const bare = browser(base);
      fakes.kakao.state.profile = { id: 3900000001, connected_at: '2026-11-12T05:21:08Z' };
      expect((await socialLogin(bare, 'kakao')).callback.location).toBe('/');
      expect(await userRow((await bare.get('/api/v2/auth/me')).body.data.id)).toMatchObject({ name: null, email: null });
    });
  }, 30_000);

  it('🔴 ?next= — 우리 화면 안의 경로면 그곳으로, 아니면 피드로', async () => {
    await freshGate();
    await withServer(stepDir(4), async ({ base }) => {
      for (const [next, expected] of [['/jaehoon', '/jaehoon'], ['https://evil.example/x', '/'], ['//evil.example', '/']]) {
        const tab = browser(base);
        const { callback } = await socialLogin(tab, 'kakao', { next });
        expect([next, callback.status, callback.location]).toEqual([next, 302, expected]);
        expect(tab.cookies()).toEqual(LOGGED_IN_COOKIES);
      }
    });
  }, 30_000);

  it('🔴 동의 화면에서 취소(?error=access_denied&error_description=User%20denied%20access — state 없이) · 고친 state · 쿠키 없이 온 콜백 → 302 /login?error=SOCIAL_LOGIN_FAILED · 행이 안 생긴다 · 토큰을 묻지 않는다', async () => {
    await freshGate();
    await withServer(stepDir(4), async ({ base }) => {
      const before = await counts();
      expect((await socialLogin(browser(base), 'kakao', { tamper: 'forged' })).callback.location).toBe(LOGIN_FAILED_PAGE);
      expect((await socialLogin(browser(base), 'kakao', { fresh: true })).callback.location).toBe(LOGIN_FAILED_PAGE);
      fakes.kakao.state.mode = 'deny';
      const denied = await socialLogin(browser(base), 'kakao');
      expect(denied.consent.location).toBe(`${callbackOf('kakao')}?error=access_denied&error_description=User%20denied%20access`);
      expect(denied.callback.status).toBe(302);
      expect(denied.callback.location).toBe(LOGIN_FAILED_PAGE);
      expect(fakes.kakao.state.log.token).toEqual([]);
      expect(await counts()).toEqual(before);
    });
  }, 30_000);

  it('🔴 틀린 판 — String() 을 뺀 판(스냅숏 · id: info.id)은 로그인이 안 된다 — 302 /login?error=SOCIAL_LOGIN_FAILED + 터미널에 Prisma 검증 에러 · 행 수 그대로', async () => {
    const [right, wrong] = [read(stepDir(4)('strategies/kakao.js')), read(P('snapshots/p3-46.step4-number-id.kakao.js'))];
    const { removed, added } = diffLines(right, wrong);
    expect(removed).toEqual(['      id: String(info.id),']);
    expect(added).toEqual(['      id: info.id,']);
    await freshGate();
    await withServer(stepDir(4), async ({ base, tail, dir }) => {
      const before = await counts();
      const { callback } = await socialLogin(browser(base), 'kakao');
      expect(callback.status).toBe(302);
      expect(callback.location).toBe(LOGIN_FAILED_PAGE);
      expect(await counts()).toEqual(before);
      await sleep(150);
      const log = tail();
      expect(log).toContain('PrismaClientValidationError');
      expect(log).toContain('providerUserId: 3812345678');
      expect(log).toContain('Argument `providerUserId`: Invalid value provided. Expected String, provided Int.');
      seen.step4NumberId = scrub(log.slice(log.indexOf('\n', log.indexOf('GET /api/v2/auth/kakao 302')) + 1), dir).replace(/(code|state)=[A-Za-z0-9_-]+/g, '$1=…');
    }, { fake: false, edit: (d) => { cpSync(P('snapshots/p3-46.step4-number-id.kakao.js'), join(d, 'strategies/kakao.js')); useFakes(d); } });
  }, 30_000);

  it('🔴 틀린 판 — ?. 를 뺀 판은 닉네임에 동의한 사람은 로그인되고, 동의하지 않은 사람은 302 /login?error=SOCIAL_LOGIN_FAILED + 터미널에 TypeError', async () => {
    await freshGate();
    await withServer(stepDir(4), async ({ base, tail, dir }) => {
      expect((await socialLogin(browser(base), 'kakao')).callback.location).toBe('/');
      const before = await counts();
      fakes.kakao.state.profile = { ...structuredClone(KAKAO_NO_NICKNAME), id: 3900000002 };
      const { callback } = await socialLogin(browser(base), 'kakao');
      expect(callback.status).toBe(302);
      expect(callback.location).toBe(LOGIN_FAILED_PAGE);
      expect(await counts()).toEqual(before);
      await sleep(150);
      const log = tail();
      expect(log).toContain("TypeError: Cannot read properties of undefined (reading 'nickname')");
      seen.step4NoOptionalChaining = scrub(log.slice(log.indexOf('TypeError')), dir).replace(/(code|state)=[A-Za-z0-9_-]+/g, '$1=…');
    }, { edit: (d) => replaceIn(d, 'strategies/kakao.js', 'info.kakao_account?.profile?.nickname', 'info.kakao_account.profile.nickname') });
  }, 30_000);

  it('🔴 구글 로그인은 code/p3-45 와 같다 — 302 / · users 한 행(minji.kim · 확인된 이메일) · social_accounts(google · sub)', async () => {
    await freshGate();
    await withServer(stepDir(4), async ({ base }) => {
      const tab = browser(base);
      const { begin, callback } = await socialLogin(tab, 'google');
      expect(authorizeQuery(begin.location).query).toMatchObject({ redirect_uri: callbackOf('google'), scope: 'email profile', client_id: 'test-client' });
      expect(callback.status).toBe(302);
      expect(callback.location).toBe('/');
      const { id, username } = (await tab.get('/api/v2/auth/me')).body.data;
      expect(username).toBe('minji.kim');
      expect(await userRow(id)).toMatchObject({ email: 'minji.kim@gmail.com', name: '김민지', password_hash: null });
      expect(await socialRows()).toEqual([{ user_id: id, provider: 'google', provider_user_id: '108123456789012345678' }]);
    });
  }, 30_000);

  it('🔴 strategies/google.js · stateStore.js · controllers · services · prisma · seed.js 는 code/p3-45 그대로다', () => {
    const names = execFileSync('git', ['diff', '--name-only', 'code/p3-45', commitOf(4), '--', 'strategies/google.js', 'strategies/stateStore.js', 'controllers', 'services', 'prisma', 'seed.js', 'docs', 'errors.js', 'package.json', 'package-lock.json'], { cwd: P('.'), encoding: 'utf8' }).trim();
    expect(names).toBe('');
  });
});

describe('축 ④ Step 5 — .env.example 에 네이버 클라이언트 ID와 시크릿', () => {
  it('🔴 이름 둘이 끝에 값 없이 — NAVER_CLIENT_ID · NAVER_CLIENT_SECRET · 앞 줄은 Step 4 판 그대로 · 고친 파일은 하나', () => {
    const text = read(stepDir(5)('.env.example'));
    expect(text).toBe(`${read(stepDir(4)('.env.example'))}NAVER_CLIENT_ID=\nNAVER_CLIENT_SECRET=\n`);
    expect(text.trimEnd().split('\n').slice(-7)).toEqual(['GOOGLE_CLIENT_ID=', 'GOOGLE_CLIENT_SECRET=', 'SITE_URL=', 'KAKAO_CLIENT_ID=', 'KAKAO_CLIENT_SECRET=', 'NAVER_CLIENT_ID=', 'NAVER_CLIENT_SECRET=']);
    expect(changedStudentFiles(commitOf(4), commitOf(5))).toEqual(['.env.example']);
  });
});

// 카카오 파일(Step 4)에서 «네이버 파일로 복사했을 때 바꿔야 하는 줄» — 줄 번호는 Step 4 의 strategies/kakao.js.
const NAVER_FROM_KAKAO = {
  1: '// ~/instagram-api/strategies/naver.js',
  6: '// 네이버 로그인 전략 — 네이버의 주소 둘과, 네이버 개발자 센터에서 받은 클라이언트 ID·시크릿을 넣어 만든다.',
  8: 'export const naverStrategy = new OAuth2Strategy(',
  10: "    authorizationURL: 'https://nid.naver.com/oauth2/authorize',",
  11: "    tokenURL: 'https://nid.naver.com/oauth2/token',",
  12: '    clientID: process.env.NAVER_CLIENT_ID,',
  13: '    clientSecret: process.env.NAVER_CLIENT_SECRET,',
  14: '    callbackURL: `${process.env.SITE_URL}/api/v2/auth/naver/callback`,',
  15: "    scope: ['openid'],",
  19: '  // 네이버가 확인해 준 사람(profile)을 users 의 사람으로 바꾸는 곳 — 여기서 넘긴 값이 req.user 가 된다.',
  29: '// 네이버에 «이 Access 토큰의 주인이 누구인지» 묻는다 — 토큰은 주소가 아니라 Authorization 헤더에 싣는다.',
  30: 'naverStrategy.userProfile = async (accessToken, done) => {',
  32: "    const response = await fetch('https://openapi.naver.com/v1/nid/me', {",
  36: '    if (!response.ok) throw new Error(`네이버가 사용자 정보를 주지 않았어요 (${response.status})`);',
  38: ['    // 네이버는 사용자 정보를 response 라는 키 안에 담아 준다.', '    const { response: info } = await response.json();'],
  40: '    // id 는 네이버가 이 애플리케이션에서 그 계정에 매긴 값이다.',
  41: '    // 네이버는 이메일을 확인했는지 알려 주는 값을 주지 않는다 — 확인되지 않은 이메일로 다룬다.',
  43: "      provider: 'naver',",
  44: '      id: info.id,',
  45: '      email: info.email,',
  47: '      name: info.name,',
};
const NAVER_JS = derive(KAKAO_STEP4, NAVER_FROM_KAKAO);
/** 가짜 네이버로 로그인 한 바퀴를 돌고 콜백 응답과 그 브라우저를 돌려준다. */
const asNaver = async (base, profile, opts) => {
  if (profile) fakes.naver.state.profile = { ...profile };
  const tab = browser(base);
  const { callback } = await socialLogin(tab, 'naver', opts);
  return { callback, tab, me: callback.location === '/' ? (await tab.get('/api/v2/auth/me')).body.data : null };
};

describe('축 ⑤ Step 6 — 네이버 전략(새 OIDC 경로)과 프로필', () => {
  it('🔴 strategies/naver.js 는 카카오 파일(Step 4)에서 표의 줄만 다르다 — 지운 줄 21 · 더한 줄 22', () => {
    const naver = read(stepDir(6)('strategies/naver.js'));
    expect(naver).toBe(NAVER_JS);
    const { removed, added } = diffLines(KAKAO_STEP4, naver);
    const kakaoLine = (n) => KAKAO_STEP4.split('\n')[n - 1];
    expect(removed).toEqual(Object.keys(NAVER_FROM_KAKAO).map((n) => kakaoLine(Number(n))));
    expect(added).toEqual(Object.values(NAVER_FROM_KAKAO).flat());
    expect([removed.length, added.length]).toEqual([21, 22]);
  });

  it('🔴 app.js 는 Step 4 판에 두 줄 · routes/auth.js 는 네이버 블록과 router.all 둘만 더했다 — 에러 미들웨어는 router.all 들보다 위', () => {
    const app = diffLines(read(stepDir(4)('app.js')), read(stepDir(6)('app.js')));
    expect(app.removed).toEqual([]);
    expect(app.added).toEqual(["import { naverStrategy } from './strategies/naver.js';", "passport.use('naver', naverStrategy);"]);
    expect(read(stepDir(6)('app.js'))).toContain("import { kakaoStrategy } from './strategies/kakao.js';\nimport { naverStrategy } from './strategies/naver.js';\n");
    expect(read(stepDir(6)('app.js'))).toContain("passport.use('kakao', kakaoStrategy);\npassport.use('naver', naverStrategy);\n");
    const after = read(stepDir(6)('routes/auth.js'));
    const routes = diffLines(read(stepDir(4)('routes/auth.js')), after);
    expect(routes.removed).toEqual([]);
    expect(routes.added).toEqual([
      '// 네이버 로그인 — 구글, 카카오와 같은 주소 둘이다. 전략의 이름만 다르다.',
      "router.get('/naver', authController.rememberNext, passport.authenticate('naver', { session: false }));",
      'router.get(',
      "  '/naver/callback',",
      "  passport.authenticate('naver', { session: false, failureRedirect: '/login?error=SOCIAL_LOGIN_FAILED' }),",
      '  authController.socialCallback,',
      ');',
      "router.use('/naver', authController.socialFailed);",
      "router.all('/naver', allowOnly('GET'));",
      "router.all('/naver/callback', allowOnly('GET'));",
    ]);
    expect(after).toContain("router.use('/kakao', authController.socialFailed);\n// 네이버 로그인 — 구글, 카카오와 같은 주소 둘이다. 전략의 이름만 다르다.\n");
    expect(after).toContain("router.use('/naver', authController.socialFailed);\n\nrouter.all('/signup', allowOnly('POST'));\n");
    expect(after.endsWith("router.all('/kakao/callback', allowOnly('GET'));\nrouter.all('/naver', allowOnly('GET'));\nrouter.all('/naver/callback', allowOnly('GET'));\n\nexport default router;\n")).toBe(true);
  });

  it('🔴 Step 6 이 고친 학생 파일은 셋 — app.js · routes/auth.js · strategies/naver.js(새 파일) · 이 회차 전체로는 다섯 · 새 패키지 0', () => {
    expect(changedStudentFiles(commitOf(5), commitOf(6))).toEqual(['app.js', 'routes/auth.js', 'strategies/naver.js']);
    expect(changedStudentFiles('code/p3-45', commitOf(6))).toEqual(['.env.example', 'app.js', 'routes/auth.js', 'strategies/kakao.js', 'strategies/naver.js']);
    expect(showAt(commitOf(6), 'package.json')).toBe(showAt('code/p3-45', 'package.json'));
    expect(showAt(commitOf(6), 'package-lock.json')).toBe(showAt('code/p3-45', 'package-lock.json'));
  });

  it('🔴 .env 에 NAVER_CLIENT_ID 가 없으면 서버가 뜨지 않는다 — 스택이 strategies/naver.js 를 가리킨다', async () => {
    const dir = studentDir(stepDir(6));
    const log = await bootFailure(dir, { without: Object.keys(NAVER_ENV) });
    expect(log).toMatch(/TypeError: OAuth2Strategy requires a clientID option/);
    expect(log).toMatch(/strategies\/naver\.js:8:\d+/);
    seen.noNaverClientId = scrub(log.split('\n').slice(1).join('\n'), dir);
  }, 30_000);

  it('🔴 시작 요청은 302 — 네이버 새 인가 주소(/oauth2/authorize) + scope=openid · state · code_challenge · S256 · 쿠키 셋', async () => {
    await withServer(stepDir(6), async ({ base }) => {
      const tab = browser(base);
      const res = await tab.get('/api/v2/auth/naver');
      expect(res.status).toBe(302);
      const { origin, query, keys } = authorizeQuery(res.location);
      expect(origin).toBe(REAL.naver.authorize);
      expect(keys).toEqual(['response_type', 'redirect_uri', 'scope', 'code_challenge', 'code_challenge_method', 'state', 'client_id']);
      expect(query).toMatchObject({ response_type: 'code', redirect_uri: callbackOf('naver'), scope: 'openid', code_challenge_method: 'S256', client_id: 'test-naver' });
      expect(query.state).toMatch(/^[A-Za-z0-9_-]{22}$/);
      expect(query.code_challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(res.setCookies.map(cookieShape)).toEqual(START_COOKIES);
      expect(s256(tab.cookie('oauth_verifier'))).toBe(query.code_challenge);
      seen.naverStartLocation = res.location.replace(/(state|code_challenge)=[A-Za-z0-9_-]+/g, '$1=…');
    }, { fake: false });
  }, 30_000);

  it('🔴 토큰 주소가 받은 것 — POST · 폼 본문에 grant_type · redirect_uri · code_verifier · client_id · client_secret · code · 사용자 정보는 Bearer 헤더로 /v1/nid/me', async () => {
    await freshGate();
    await withServer(stepDir(6), async ({ base }) => {
      const { consent, callback } = await socialLogin(browser(base), 'naver');
      expect(callback.location).toBe('/');
      const [{ method, body, contentType, authorization }] = fakes.naver.state.log.token;
      expect(method).toBe('POST');
      expect(contentType).toBe('application/x-www-form-urlencoded');
      expect(authorization).toBeUndefined();
      expect(Object.keys(body)).toEqual(['grant_type', 'redirect_uri', 'code_verifier', 'client_id', 'client_secret', 'code']);
      expect(body).toMatchObject({
        grant_type: 'authorization_code',
        redirect_uri: callbackOf('naver'),
        client_id: 'test-naver',
        client_secret: 'test-naver-secret',
        code: new URL(consent.location).searchParams.get('code'),
      });
      expect(s256(body.code_verifier)).toBe(fakes.naver.state.log.authorize[0].code_challenge);
      const [{ url, authorization: bearer }] = fakes.naver.state.log.userinfo;
      expect(url).toBe('/v1/nid/me');
      expect(bearer).toMatch(/^Bearer AAAAN/);
    });
  }, 30_000);

  it('🔴 처음 온 네이버 사람 — 302 / · users 한 행(username 은 이메일 앞부분 · email NULL — 네이버가 이메일을 줬어도 · name) + social_accounts(naver · id) · 다시 오면 같은 사람', async () => {
    await freshGate();
    await withServer(stepDir(6), async ({ base, tail }) => {
      const before = await counts();
      const { callback, tab, me } = await asNaver(base);
      expect(callback.status).toBe(302);
      expect(callback.setCookies.map(cookieShape)).toEqual([
        'oauth_state=…; Path=/api/v2/auth; Expires=…',
        'oauth_verifier=…; Path=/api/v2/auth; Expires=…',
        'accessToken=…; Max-Age=604800; Path=/; Expires=…; HttpOnly; SameSite=Lax',
        'refreshToken=…; Max-Age=604800; Path=/api/v2/auth; Expires=…; HttpOnly; SameSite=Lax',
        'oauth_next=…; Path=/api/v2/auth; Expires=…',
      ]);
      expect(tab.cookies()).toEqual(LOGGED_IN_COOKIES);
      expect(me).toEqual({ id: me.id, username: 'minji.kim', profileImage: null, role: 'USER' });
      expect(await userRow(me.id)).toEqual({ id: me.id, username: 'minji.kim', email: null, name: '김민지', password_hash: null, role: 'USER' });
      expect(await socialRows()).toEqual([{ user_id: me.id, provider: 'naver', provider_user_id: DEFAULT_NAVER_PROFILE.id }]);
      expect(await counts()).toEqual([before[0] + 1, before[1] + 1, before[2] + 1]);
      expect((await asNaver(base)).me.id).toBe(me.id);
      expect([await count('users'), await count('social_accounts')]).toEqual([before[0] + 1, before[1] + 1]);
      await sleep(100);
      expect(tail()).not.toContain('Error');
    });
  }, 30_000);

  it('🔴 구글로 가입한 minji.kim 이 있으면 네이버 minji.kim@naver.com 은 minji.kim + 숫자 넷 · 이메일·이름 제공에 동의하지 않은 응답(id 만)은 username naver · name NULL', async () => {
    await freshGate();
    await withServer(stepDir(6), async ({ base }) => {
      const google = browser(base);
      expect((await socialLogin(google, 'google')).callback.location).toBe('/');
      expect((await google.get('/api/v2/auth/me')).body.data.username).toBe('minji.kim');
      const { me } = await asNaver(base);
      expect(me.username).toMatch(/^minji\.kim\d{4}$/);
      const onlyId = await asNaver(base, { id: 'onlyIdOnlyIdOnlyIdOnlyIdOnlyIdOnlyIdOnlyId1' });
      expect(onlyId.callback.location).toBe('/');
      expect(await userRow(onlyId.me.id)).toMatchObject({ username: 'naver', email: null, name: null });
      expect((await asNaver(base, { id: 'onlyIdOnlyIdOnlyIdOnlyIdOnlyIdOnlyIdOnlyId2' })).me.username).toMatch(/^naver\d{4}$/);
    });
  }, 30_000);

  it('🔎 네이버 이메일이 이미 가입한 사람의 이메일(yuna@example.com)이어도 EMAIL_TAKEN 이 아니다 — 확인되지 않은 이메일은 넣지도 대조하지도 않는다(새 사람 yuna + 숫자 넷 · email NULL)', async () => {
    await freshGate();
    await withServer(stepDir(6), async ({ base }) => {
      const { callback, me } = await asNaver(base, { id: 'yunaYunaYunaYunaYunaYunaYunaYunaYunaYunaYun', email: 'yuna@example.com', name: '김유나' });
      expect(callback.location).toBe('/');
      expect(me.username).toMatch(/^yuna\d{4}$/);
      expect((await userRow(me.id)).email).toBeNull();
    });
  }, 30_000);

  it('🔴 동의 화면에서 취소 — 네이버는 ?error=access_denied&error_description=Canceled%20By%20User&state=… · 카카오는 state 없이 — 둘 다 302 /login?error=SOCIAL_LOGIN_FAILED · 고친 state · 쿠키 없이 온 콜백도 · 행이 안 생긴다', async () => {
    await freshGate();
    await withServer(stepDir(6), async ({ base, tail }) => {
      const before = await counts();
      expect((await socialLogin(browser(base), 'naver', { tamper: 'forged' })).callback.location).toBe(LOGIN_FAILED_PAGE);
      expect((await socialLogin(browser(base), 'naver', { fresh: true })).callback.location).toBe(LOGIN_FAILED_PAGE);
      fakes.naver.state.mode = 'deny';
      fakes.kakao.state.mode = 'deny';
      const naver = await socialLogin(browser(base), 'naver');
      const back = new URL(naver.consent.location);
      expect([...back.searchParams.keys()]).toEqual(['error', 'error_description', 'state']);
      expect(back.search.startsWith('?error=access_denied&error_description=Canceled%20By%20User&state=')).toBe(true);
      expect(back.searchParams.get('error')).toBe('access_denied');
      expect([naver.callback.status, naver.callback.location]).toEqual([302, LOGIN_FAILED_PAGE]);
      const kakao = await socialLogin(browser(base), 'kakao');
      expect([...new URL(kakao.consent.location).searchParams.keys()]).toEqual(['error', 'error_description']);
      expect([kakao.callback.status, kakao.callback.location]).toEqual([302, LOGIN_FAILED_PAGE]);
      expect(fakes.naver.state.log.token).toEqual([]);
      expect(fakes.kakao.state.log.token).toEqual([]);
      expect(await counts()).toEqual(before);
      // 취소는 에러가 아니라 «실패» 다 — 터미널에 아무것도 찍히지 않는다
      await sleep(100);
      expect(tail()).not.toContain('Error');
    });
  }, 30_000);

  it('🔴 틀린 시크릿 — 가짜 네이버 401 { error: invalid_client } · 가짜 카카오 401 KOE010 → 둘 다 302 /login?error=SOCIAL_LOGIN_FAILED + 터미널에 TokenError', async () => {
    await freshGate();
    for (const provider of ['naver', 'kakao']) {
      await withServer(stepDir(6), async ({ base, tail, dir }) => {
        fakes[provider].state.clientSecret = 'another-secret';
        const { callback } = await socialLogin(browser(base), provider);
        expect(fakes[provider].state.log.token).toHaveLength(1);
        expect([provider, callback.status, callback.location]).toEqual([provider, 302, LOGIN_FAILED_PAGE]);
        await sleep(150);
        const log = tail();
        const error = log.slice(log.indexOf('TokenError'));
        expect(error.startsWith('TokenError')).toBe(true);
        seen[`wrongSecret_${provider}`] = scrub(error, dir).replace(/(code|state)=[A-Za-z0-9_-]+/g, '$1=…');
      });
    }
    expect(seen.wrongSecret_kakao.split('\n')[0]).toBe('TokenError: Bad client credentials');
    expect(seen.wrongSecret_naver.split('\n')[0]).toBe('TokenError');
    expect(await count('social_accounts')).toBe(0);
  }, 60_000);

  it('🔴 제공자가 사용자 정보를 주지 않으면(401) → 302 /login?error=SOCIAL_LOGIN_FAILED + 터미널에 «네이버가/카카오가 사용자 정보를 주지 않았어요 (401)»', async () => {
    await freshGate();
    await withServer(stepDir(6), async ({ base, tail }) => {
      fakes.naver.state.userinfoFails = true;
      fakes.kakao.state.userinfoFails = true;
      expect((await socialLogin(browser(base), 'naver')).callback.location).toBe(LOGIN_FAILED_PAGE);
      expect((await socialLogin(browser(base), 'kakao')).callback.location).toBe(LOGIN_FAILED_PAGE);
      await sleep(150);
      expect(tail()).toContain('Error: 네이버가 사용자 정보를 주지 않았어요 (401)');
      expect(tail()).toContain('Error: 카카오가 사용자 정보를 주지 않았어요 (401)');
    });
  }, 30_000);

  it('🔴 틀린 판 — 사용자 정보를 response 밖(맨 위)에서 읽는 판은 로그인이 안 된다 — 302 /login?error=SOCIAL_LOGIN_FAILED + 터미널에 Prisma 검증 에러(Argument `providerUserId` is missing.)', async () => {
    await freshGate();
    await withServer(stepDir(6), async ({ base, tail, dir }) => {
      const before = await counts();
      const { callback } = await socialLogin(browser(base), 'naver');
      expect([callback.status, callback.location]).toEqual([302, LOGIN_FAILED_PAGE]);
      expect(await counts()).toEqual(before);
      await sleep(150);
      const log = tail();
      expect(log).toContain('PrismaClientValidationError');
      expect(log).toContain('provider: "naver"');
      expect(log).toContain('Argument `providerUserId` is missing.');
      seen.naverTopLevel = scrub(log.slice(log.indexOf('PrismaClientValidationError')), dir).replace(/(code|state)=[A-Za-z0-9_-]+/g, '$1=…');
    }, { edit: (d) => replaceIn(d, 'strategies/naver.js', '    const { response: info } = await response.json();', '    const info = await response.json();') });
  }, 30_000);

  // 카카오 파일을 복사해 네이버 파일을 만들 때 손이 가기 쉬운 틀린 판 — 응답을 맨 바깥에서 읽고 `id: String(info.id),` 를 그대로 둔다.
  // `info.id` 가 없어도 `String(undefined)` 는 글자 "undefined" 라서 Prisma 가 막지 않는다 — 에러 없이 가입되고, 네이버 사람이 모두 한 사람이 된다.
  const naverKeptString = (d) => {
    replaceIn(d, 'strategies/naver.js', '    const { response: info } = await response.json();', '    const info = await response.json();');
    replaceIn(d, 'strategies/naver.js', '      id: info.id,', '      id: String(info.id),');
  };

  it('🔴 틀린 판 — 응답을 맨 바깥에서 읽고 id: String(info.id) 를 그대로 둔 판은 에러 없이 가입된다(provider_user_id 가 글자 «undefined» · username naver · name NULL) · 다른 네이버 사람이 와도 그 첫 사람으로 로그인된다', async () => {
    await freshGate();
    await withServer(stepDir(6), async ({ base, tail }) => {
      const before = await counts();
      const first = await asNaver(base);
      expect([first.callback.status, first.callback.location]).toEqual([302, '/']);
      expect(await userRow(first.me.id)).toEqual({ id: first.me.id, username: 'naver', email: null, name: null, password_hash: null, role: 'USER' });
      expect(await socialRows()).toEqual([{ user_id: first.me.id, provider: 'naver', provider_user_id: 'undefined' }]);
      expect(await counts()).toEqual([before[0] + 1, before[1] + 1, before[2] + 1]);
      // 다른 네이버 사람 — id · 이메일 · 이름이 모두 다르다
      const second = await asNaver(base, { id: 'zY9xW7vU5tS3rQ1pO9nM7lK5jI3hG1fE9dC7bA5zY3x', email: 'seojun.park@naver.com', name: '박서준' });
      expect([second.callback.status, second.callback.location]).toEqual([302, '/']);
      expect(second.me).toEqual(first.me);
      expect(await socialRows()).toEqual([{ user_id: first.me.id, provider: 'naver', provider_user_id: 'undefined' }]);
      expect(await counts()).toEqual([before[0] + 1, before[1] + 1, before[2] + 2]);
      await sleep(100);
      expect(tail()).not.toContain('Error');
      seen.naverKeptString = { firstMe: first.me, secondMe: second.me, user: await userRow(first.me.id), social: await socialRows() };
    }, { edit: naverKeptString });
  }, 30_000);

  it('🔎 response 안에서 맞게 읽고 id: String(info.id) 만 남긴 판은 정답과 결과가 같다 — 네이버의 id 는 원래 글자다', async () => {
    const run = async (edit) => {
      await freshGate();
      let got;
      await withServer(stepDir(6), async ({ base }) => {
        const { callback, me } = await asNaver(base);
        const { id, ...user } = await userRow(me.id);
        got = { location: callback.location, username: me.username, user, social: (await socialRows()).map(({ provider, provider_user_id }) => `${provider} ${provider_user_id}`) };
      }, { edit });
      return got;
    };
    const right = await run();
    expect(right.social).toEqual([`naver ${DEFAULT_NAVER_PROFILE.id}`]);
    expect(await run((d) => replaceIn(d, 'strategies/naver.js', '      id: info.id,', '      id: String(info.id),'))).toEqual(right);
  }, 60_000);

  it('🔴 네이버 주소 둘은 GET 만 — POST 는 405 + Allow: GET(JSON 그대로)', async () => {
    await withServer(stepDir(6), async ({ base }) => {
      for (const path of ['/api/v2/auth/naver', '/api/v2/auth/naver/callback', '/api/v2/auth/kakao', '/api/v2/auth/google']) {
        const res = await browser(base).post(path, {});
        expect([path, res.status, res.headers.get('allow'), res.body.error?.code]).toEqual([path, 405, 'GET', 'METHOD_NOT_ALLOWED']);
      }
    }, { fake: false });
  }, 30_000);
});

describe('축 ⑦ 세 제공자가 함께', () => {
  it('🔴 구글·카카오·네이버로 차례로 로그인 — 세 사람 · social_accounts 세 행 · 비밀번호 로그인도 그대로', async () => {
    await freshGate();
    await withServer(stepDir(6), async ({ base }) => {
      const before = await counts();
      const names = [];
      for (const provider of ['google', 'kakao', 'naver']) {
        const tab = browser(base);
        const { callback } = await socialLogin(tab, provider);
        expect([provider, callback.status, callback.location]).toEqual([provider, 302, '/']);
        names.push((await tab.get('/api/v2/auth/me')).body.data.username);
      }
      expect(names[0]).toBe('minji.kim');
      expect(names[1]).toBe('kakao');
      expect(names[2]).toMatch(/^minji\.kim\d{4}$/);
      expect((await socialRows()).map((row) => `${row.provider} ${row.provider_user_id}`)).toEqual([
        'google 108123456789012345678', 'kakao 3812345678', `naver ${DEFAULT_NAVER_PROFILE.id}`,
      ]);
      expect(await counts()).toEqual([before[0] + 3, before[1] + 3, before[2] + 3]);
      expect((await browser(base).login('jaehoon')).status).toBe(200);
    });
  }, 30_000);

  // 🔑 지금은 그렇다 — 임시 쿠키 이름(oauth_state · oauth_verifier · oauth_next)이 제공자와 상관없이 하나다.
  //    다음 회차(p3-47)가 임시 쿠키를 제공자마다 두어 이 판정을 뒤집는다.
  it('🔎 탭 둘에서 카카오와 네이버를 함께 시작하면 둘 다 로그인이 안 된다 — 뒤에 시작한 쪽이 쿠키를 덮어쓰고, 먼저 돌아온 쪽이 쿠키를 지운다', async () => {
    await freshGate();
    await withServer(stepDir(6), async ({ base }) => {
      const before = await counts();
      const tab = browser(base);
      const kakaoBegin = await tab.get('/api/v2/auth/kakao');
      const kakaoState = tab.cookie('oauth_state');
      const naverBegin = await tab.get('/api/v2/auth/naver');
      expect(tab.cookie('oauth_state')).not.toBe(kakaoState);
      expect(tab.cookies()).toEqual(['oauth_next /api/v2/auth', 'oauth_state /api/v2/auth', 'oauth_verifier /api/v2/auth']);
      const backOf = async (begin) => {
        const consent = await fetch(begin.location, { redirect: 'manual' });
        const back = new URL(consent.headers.get('location'));
        return `${back.pathname}${back.search}`;
      };
      const [kakaoBack, naverBack] = [await backOf(kakaoBegin), await backOf(naverBegin)];
      // 카카오 탭이 먼저 돌아온다 — 쿠키의 state 는 네이버 것이라 다르다 · 이때 쿠키 둘을 지운다
      const first = await tab.get(kakaoBack);
      expect([first.status, first.location]).toEqual([302, LOGIN_FAILED_PAGE]);
      expect(tab.cookies()).toEqual(['oauth_next /api/v2/auth']);
      // 네이버 탭 — 맞는 state 였는데 쿠키가 이미 없다
      const second = await tab.get(naverBack);
      expect([second.status, second.location]).toEqual([302, LOGIN_FAILED_PAGE]);
      expect(fakes.kakao.state.log.token).toEqual([]);
      expect(fakes.naver.state.log.token).toEqual([]);
      expect(await counts()).toEqual(before);
    });
  }, 30_000);

  it('🔎 탭 둘이어도 뒤에 시작한 쪽이 «먼저» 돌아오면 그쪽은 로그인된다 — 먼저 시작한 쪽만 실패한다', async () => {
    await freshGate();
    await withServer(stepDir(6), async ({ base }) => {
      const tab = browser(base);
      const kakaoBegin = await tab.get('/api/v2/auth/kakao');
      const naverBegin = await tab.get('/api/v2/auth/naver');
      const backOf = async (begin) => {
        const consent = await fetch(begin.location, { redirect: 'manual' });
        const back = new URL(consent.headers.get('location'));
        return `${back.pathname}${back.search}`;
      };
      const [kakaoBack, naverBack] = [await backOf(kakaoBegin), await backOf(naverBegin)];
      const naver = await tab.get(naverBack);
      expect([naver.status, naver.location]).toEqual([302, '/']);
      const kakao = await tab.get(kakaoBack);
      expect([kakao.status, kakao.location]).toEqual([302, LOGIN_FAILED_PAGE]);
    });
  }, 30_000);

  it("🔴 틀린 판 — router.use('/kakao', socialFailed) 를 router.all 줄들 «아래» 로 내리면 405 까지 잡아 302 /login?error=METHOD_NOT_ALLOWED 로 바꾼다", async () => {
    const line = "router.use('/kakao', authController.socialFailed);\n";
    const run = async (edit) => {
      let got;
      await withServer(stepDir(6), async ({ base }) => {
        const res = await browser(base).post('/api/v2/auth/kakao', {});
        got = [res.status, res.location, res.headers.get('allow')];
      }, { fake: false, edit });
      return got;
    };
    expect(await run()).toEqual([405, null, 'GET']);
    expect(await run((d) => {
      replaceIn(d, 'routes/auth.js', line, '');
      replaceIn(d, 'routes/auth.js', "router.all('/naver/callback', allowOnly('GET'));\n", `router.all('/naver/callback', allowOnly('GET'));\n${line}`);
    })).toEqual([302, '/login?error=METHOD_NOT_ALLOWED', 'GET']);
  }, 60_000);

  it('🔎 옛 주소 /api/auth/kakao · /api/auth/naver 도 같은 라우터라 열린다 — 돌아올 주소는 새 주소 · 그대로 로그인까지 간다', async () => {
    await freshGate();
    await withServer(stepDir(6), async ({ base }) => {
      for (const provider of ['kakao', 'naver']) {
        const tab = browser(base);
        const { begin, callback } = await socialLogin(tab, provider, { start: `/api/auth/${provider}` });
        expect(authorizeQuery(begin.location).query.redirect_uri).toBe(callbackOf(provider));
        expect(begin.headers.get('deprecation')).toBe('@1796083200');
        expect([provider, callback.status, callback.location]).toEqual([provider, 302, '/']);
      }
    });
  }, 30_000);
});

describe('축 ⑥ 파생 대조 — 전략 파일 셋의 다른 줄(교안이 «다른 줄은 이것뿐» 이라고 말한다)', () => {
  it('🔴 google.js ↔ kakao.js(Step 4) — 지운 줄 20 · 더한 줄 21 · google.js ↔ naver.js — 지운 줄 19 · 더한 줄 21 · kakao.js ↔ naver.js — 지운 줄 21 · 더한 줄 22 · 세 파일의 줄 수 51 · 52 · 53', () => {
    const [kakao, naver] = [read(stepDir(6)('strategies/kakao.js')), read(stepDir(6)('strategies/naver.js'))];
    expect(read(stepDir(6)('strategies/google.js'))).toBe(GOOGLE_JS);
    const gk = diffLines(GOOGLE_JS, kakao);
    const gn = diffLines(GOOGLE_JS, naver);
    const kn = diffLines(kakao, naver);
    const lineCount = (text) => text.trimEnd().split('\n').length;
    expect([lineCount(GOOGLE_JS), lineCount(kakao), lineCount(naver)]).toEqual([51, 52, 53]);
    expect([gk.removed.length, gk.added.length]).toEqual([20, 21]);
    expect([gn.removed.length, gn.added.length]).toEqual([19, 21]);
    expect([kn.removed.length, kn.added.length]).toEqual([21, 22]);
    // 구글 파일에서 다른 줄의 번호(diff 의 머리 줄 그대로)
    const heads = (raw) => raw.split('\n').filter((line) => /^\d/.test(line));
    expect(heads(gk.raw)).toEqual(['1c1', '6c6', '8c8', '10,15c10,15', '19c19', '29,30c29,30', '32c32', '36c36', '40c40,41', '42,46c43,47']);
    expect(heads(gn.raw)).toEqual(['1c1', '6c6', '8c8', '10,15c10,15', '19c19', '29,30c29,30', '32c32', '36c36', '38c38,39', '40c41,42', '42,43c44,45', '45c47']);
    expect(heads(kn.raw)).toEqual(['1c1', '6c6', '8c8', '10,15c10,15', '19c19', '29,30c29,30', '32c32', '36c36', '38c38,39', '40,41c41,42', '43,45c44,46', '47c48']);
    seen.diffGoogleKakao = gk.raw;
    seen.diffGoogleNaver = gn.raw;
    seen.diffKakaoNaver = kn.raw;
    // 세 파일에서 글자까지 같은 줄 — verify 함수와 try/catch 틀
    const same = GOOGLE_JS.split('\n').filter((line, i) => kakao.split('\n').includes(line) && naver.split('\n').includes(line));
    expect(same).toContain('      done(null, await authService.findOrCreateSocialUser(profile));');
    expect(same).toContain('    store: stateStore,');
    expect(same).toContain('    pkce: true,');
  });
});

// ── 직접 해보기·과제(lab/p3-46) ────────────────────────────────────────────
// 실습 파일은 이 회차 북마크가 생기면 북마크에서, 아직 없으면 main 에서 읽는다(작업트리가 아니다).
// 짓는 동안 `P346_LAB_WT=1` 을 주면 작업트리에서 읽는다.
// 🔑 4001·4002·4003 은 남이 쓸 수 있어서 직접 띄우지 않는다 — 사본의 글자만 바꿔 띄운다
//    (톡 서버 4003→3974 · 과제 서버 4002→3970 · 실습용 인가 서버 4001→3973 — 등록한 돌아올 주소·listen 모두).
// 🚨 3975~3979 는 화면 쪽 판정(`instagram-next/.verify` 의 p3-46)이 쓴다 — 이 파일은 3970~3974 다섯만 쓴다.
//    그래서 과제 서버는 수업 백엔드의 포트(3970 — 실습 축에서는 수업 백엔드를 띄우지 않는다)를,
//    실습용 인가 서버는 가짜 구글의 포트(3973 — 그 축에 들어가며 가짜 구글을 끈다)를 물려받는다.
const TALK_PORT = 3974;
const LAB_PORT = PORT;
const LAB_AS_PORT = GOOGLE_PORT;
const LAB_BASE = `http://localhost:${LAB_PORT}`;
const LAB_REF = hasRef('refs/heads/code/p3-46') ? 'code/p3-46' : 'main';
const LAB_WT = process.env.P346_LAB_WT === '1';
const labFile = (rel) => (LAB_WT ? read(P(rel)) : showAt(LAB_REF, rel));
const LAB = (name) => labFile(`lab/p3-46/${name}`);
const SNAP = (name) => labFile(`snapshots/p3-46.${name}`);
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

/** 스크립트를 학생처럼 `node lab/p3-46/…` 로 돌려 출력(실패하면 stdout + stderr)을 돌려준다. */
const runLabScript = (file, source) => {
  const dir = mkdtempSync(join(tmpdir(), 'p346-script-'));
  dirs.push(dir);
  mkdirSync(join(dir, 'lab/p3-46'), { recursive: true });
  writeFileSync(join(dir, `lab/p3-46/${file}`), source);
  // 학생 프로젝트처럼 ESM 으로 돌린다 — 이 줄이 없으면 CommonJS 로 돌아 에러의 스택 모양이 학생 것과 다르다.
  writeFileSync(join(dir, 'package.json'), '{ "type": "module" }\n');
  try {
    return { code: 0, out: execFileSync(process.execPath, [`lab/p3-46/${file}`], { cwd: dir, encoding: 'utf8', stdio: 'pipe' }) };
  } catch (error) {
    return { code: error.status, out: `${error.stdout}${error.stderr}`.replaceAll(`/private${dir}`, '~/instagram-api').replaceAll(dir, '~/instagram-api') };
  }
};
const nodeCheck = (source) => {
  const dir = mkdtempSync(join(tmpdir(), 'p346-check-'));
  dirs.push(dir);
  writeFileSync(join(dir, 'file.js'), source);
  writeFileSync(join(dir, 'package.json'), '{"type":"module"}');
  execFileSync(process.execPath, ['--check', 'file.js'], { cwd: dir, stdio: 'pipe' });
};
/** 시작 파일은 정답 파일에서 `from` 부터 `to` 앞까지만 다르다 — 나머지(샘플 · 출력하는 줄)는 글자까지 같다. */
const sameOutside = (answer, start, from, to) => {
  expect(answer.indexOf(from)).toBeGreaterThan(0);
  expect(start.slice(0, start.indexOf(from))).toBe(answer.slice(0, answer.indexOf(from)));
  expect(start.slice(start.indexOf(to))).toBe(answer.slice(answer.indexOf(to)));
};

describe('축 ⑩ 직접 해보기 1 — 닉네임으로 사용자 이름 정하기(pickUsername)', () => {
  const RIGHT = [
    'minsu_dev  ← minsu_dev',
    'kakao5679  ← 민수',
    'MinSu  ← Min Su!',
    'kakao5681  ← undefined',
    'naver  ← js',
    'minsu_dev5683  ← minsu_dev',
    'thequick_brown_fox_jumps_o  ← the quick_brown_fox_jumps_over',
    'kim  ← kim',
  ];
  const run = (source) => runLabScript('practice1.js', source);
  /** 정답과 다른 줄만(줄 번호와 함께). */
  const wrongLines = (out) => out.trimEnd().split('\n').map((line, i) => (line === RIGHT[i] ? null : `${i + 1}: ${line}`)).filter(Boolean);

  it('🔴 정답 판 — 여덟 줄 · 닉네임을 쓸 수 있으면 닉네임(26자까지) · 아니면 제공자 이름 · 이미 쓰는 이름이면 회원번호 끝 네 글자', () => {
    const { code, out } = run(LAB('practice1.js'));
    expect(code).toBe(0);
    expect(out.trimEnd().split('\n')).toEqual(RIGHT);
    // 일곱째 사람의 닉네임은 빈칸 하나가 든 30자이고, 사용자 이름은 빈칸을 지운 29자의 앞 26자다
    const [username, nickname] = RIGHT[6].split('  ← ');
    expect([nickname.length, username.length, nickname.replace(' ', '').slice(0, 26)]).toEqual([30, 26, username]);
    // 여덟째 사람의 닉네임은 딱 3자다
    expect(RIGHT[7].split('  ← ')[1]).toHaveLength(3);
    labSeen.practice1 = out;
  });

  it('🔴 쓸 수 없는 글자의 정규식은 수업 파일(services/userService.js)의 NOT_ALLOWED 와 글자까지 같다', () => {
    const line = 'const NOT_ALLOWED = /[^A-Za-z0-9_.]/g;';
    expect(read(stepDir(6)('services/userService.js'))).toContain(`\n${line}\n`);
    expect(LAB('practice1.js')).toContain(`\n${line}\n`);
    expect(SNAP('practice1-start.practice1.js')).toContain(`\n${line}\n`);
  });

  it('🔴 시작 파일 — 비운 채로 문법 검사를 통과하고 줄마다 «undefined» · 정답과는 함수 하나만 다르다', () => {
    const start = SNAP('practice1-start.practice1.js');
    nodeCheck(start);
    sameOutside(LAB('practice1.js'), start, 'function pickUsername(profile, taken) {', 'for (const profile of visitors) {');
    expect(start).toContain('function pickUsername(profile, taken) {\n  // 여기를 채워요.\n}\n');
    const { code, out } = run(start);
    expect(code).toBe(0);
    expect(out.trimEnd().split('\n')).toEqual(RIGHT.map((line) => line.replace(/^\S+/, 'undefined')));
  });

  it('🔴 틀린 판 ① — 닉네임이 없을 수 있다는 것을 안 보면(profile.name.replace) 넷째 사람에서 TypeError', () => {
    const { code, out } = run(edit1(LAB('practice1.js'), "(profile.name ?? '').replace(NOT_ALLOWED, '')", "profile.name.replace(NOT_ALLOWED, '')"));
    expect(code).toBe(1);
    expect(out.split('\n').slice(0, 3)).toEqual(RIGHT.slice(0, 3));
    expect(out).toContain("TypeError: Cannot read properties of undefined (reading 'replace')");
    expect(out).not.toContain(RIGHT[3]);
    // 넷째 사람에서 멈추니 다섯째~여덟째 줄은 없다
    for (const line of RIGHT.slice(3)) expect(out).not.toContain(line);
    labSeen.practice1NoName = out;
  });

  it('🔴 틀린 판 ② — 정규식에서 g 를 빼면 셋째 줄이 «MinSu!»(첫 글자 하나만 지운다)', () => {
    const { code, out } = run(edit1(LAB('practice1.js'), 'const NOT_ALLOWED = /[^A-Za-z0-9_.]/g;', 'const NOT_ALLOWED = /[^A-Za-z0-9_.]/;'));
    expect(code).toBe(0);
    expect(wrongLines(out)).toEqual(['3: MinSu!  ← Min Su!']);
    labSeen.practice1NoGlobal = out;
  });

  it('🔴 틀린 판 ③ — 이미 쓰는 이름인지 안 보면 둘째·넷째 줄이 «kakao», 여섯째 줄이 «minsu_dev»', () => {
    const src = LAB('practice1.js');
    const from = src.indexOf('  return taken.has(base)');
    expect(from).toBeGreaterThan(0);
    const wrong = `${src.slice(0, from)}  return base;\n${src.slice(src.indexOf('\n', from) + 1)}`;
    const { code, out } = run(wrong);
    expect(code).toBe(0);
    expect(wrongLines(out)).toEqual(['2: kakao  ← 민수', '4: kakao  ← undefined', '6: minsu_dev  ← minsu_dev']);
    labSeen.practice1NoTaken = out;
  });

  it('🔴 틀린 판 ④ — 3자 미만 규칙을 빼먹으면 다섯째 줄이 «js»', () => {
    const { code, out } = run(edit1(LAB('practice1.js'), 'letters.length >= 3 ? letters : profile.provider', 'letters || profile.provider'));
    expect(code).toBe(0);
    expect(wrongLines(out)).toEqual(['5: js  ← js']);
    labSeen.practice1NoMinLength = out;
  });

  it('🔴 틀린 판 ⑤ — 26자까지만 남기는 것을 빼먹으면(.slice(0, 26) 없음) 일곱째 줄만 다르다 — 빈칸만 지운 29자가 그대로 사용자 이름이 된다', () => {
    const { code, out } = run(edit1(LAB('practice1.js'), ".replace(NOT_ALLOWED, '').slice(0, 26)", ".replace(NOT_ALLOWED, '')"));
    expect(code).toBe(0);
    expect(wrongLines(out)).toEqual(['7: thequick_brown_fox_jumps_over  ← the quick_brown_fox_jumps_over']);
    labSeen.practice1NoSlice = out;
  });

  it('🔴 틀린 판 (가) — 3자 «이상» 을 3자 «초과» 로 적으면(letters.length > 3) 여덟째 줄만 다르다 — 3자짜리 닉네임 kim 이 제공자 이름으로 밀린다', () => {
    const { code, out } = run(edit1(LAB('practice1.js'), 'letters.length >= 3 ? letters : profile.provider', 'letters.length > 3 ? letters : profile.provider'));
    expect(code).toBe(0);
    expect(wrongLines(out)).toEqual(['8: naver9kL1  ← kim']);
    labSeen.practice1GreaterThan = out;
  });

  it('🔴 틀린 판 (나) — 26자로 자르기를 글자 지우기보다 먼저 하면(slice 가 replace 앞) 일곱째 줄만 다르다 — 빈칸을 지우고 나면 25자만 남는다', () => {
    const { code, out } = run(edit1(LAB('practice1.js'), ".replace(NOT_ALLOWED, '').slice(0, 26)", ".slice(0, 26).replace(NOT_ALLOWED, '')"));
    expect(code).toBe(0);
    expect(wrongLines(out)).toEqual(['7: thequick_brown_fox_jumps_  ← the quick_brown_fox_jumps_over']);
    expect(out.split('\n')[6].split('  ← ')[0]).toHaveLength(25);
    labSeen.practice1SliceFirst = out;
  });
});

describe('축 ⑪ 직접 해보기 2 — 제공자 셋의 응답을 한 함수로(toProfile · READERS)', () => {
  const RIGHT = [
    '{"provider":"google","id":"108123456789012345678","email":"minji.kim@gmail.com","emailVerified":true,"name":"김민지"}',
    '{"provider":"kakao","id":"3812345678","emailVerified":false,"name":"민지"}',
    '{"provider":"naver","id":"aB3dE5fG7hI9jK1lM3nO5pQ7rS9tU1vW3xY5zA7bC9d","email":"minji.kim@naver.com","emailVerified":false,"name":"김민지"}',
    '모르는 제공자예요: github',
  ];
  const run = (source) => runLabScript('practice2.js', source);

  it('🔴 정답 판 — 네 줄 · 넷째 줄은 잡은 에러의 문장', () => {
    const { code, out } = run(LAB('practice2.js'));
    expect(code).toBe(0);
    expect(out.trimEnd().split('\n')).toEqual(RIGHT);
    labSeen.practice2 = out;
  });

  it('🔴 시작 파일 — 비운 채로 문법 검사를 통과하고 «undefined» 네 줄 · 정답과는 READERS 와 함수만 다르다', () => {
    const start = SNAP('practice2-start.practice2.js');
    nodeCheck(start);
    sameOutside(LAB('practice2.js'), start, '// 제공자마다 응답을 읽는 함수', 'for (const [provider, info] of samples) {');
    const { code, out } = run(start);
    expect([code, out]).toEqual([0, 'undefined\nundefined\nundefined\nundefined\n']);
  });

  it('🔴 틀린 판 — 네이버를 맨 위에서 읽으면 셋째 줄에 id·email·name 이 빠진다', () => {
    const wrong = edit1(LAB('practice2.js'),
      'naver: (info) => ({ id: info.response.id, email: info.response.email, emailVerified: false, name: info.response.name }),',
      'naver: (info) => ({ id: info.id, email: info.email, emailVerified: false, name: info.name }),');
    const { code, out } = run(wrong);
    expect(code).toBe(0);
    expect(out.trimEnd().split('\n')).toEqual([RIGHT[0], RIGHT[1], '{"provider":"naver","emailVerified":false}', RIGHT[3]]);
    labSeen.practice2NaverTop = out;
  });

  it('🔴 틀린 판 — 모르는 제공자를 확인하지 않으면 넷째 줄이 «READERS[provider] is not a function»', () => {
    const wrong = edit1(LAB('practice2.js'), "  if (!Object.hasOwn(READERS, provider)) throw new Error(`모르는 제공자예요: ${provider}`);\n\n", '');
    const { code, out } = run(wrong);
    expect(code).toBe(0);
    expect(out.trimEnd().split('\n')).toEqual([...RIGHT.slice(0, 3), 'READERS[provider] is not a function']);
    labSeen.practice2NoCheck = out;
  });

  it('🔴 틀린 판 — 네이버 이메일을 확인된 것으로 두면 셋째 줄이 emailVerified:true', () => {
    const wrong = edit1(LAB('practice2.js'), 'email: info.response.email, emailVerified: false,', 'email: info.response.email, emailVerified: true,');
    expect(run(wrong).out.split('\n')[2]).toBe(RIGHT[2].replace('"emailVerified":false', '"emailVerified":true'));
  });
});

describe('축 ⑫ 직접 해보기 3 — 콜백 주소 읽기(readCallback)', () => {
  const RIGHT = [
    'ok  구글에서 허용',
    'denied  state 없이 온 취소',
    'denied  네이버에서 취소',
    'forged  state를 고친 주소',
    'failed  네이버 쪽 문제',
    'failed  code도 error도 없는 주소',
    'ok  state에 error라는 글자가 든 성공',
    'forged  쿠키도 state도 없는 주소',
  ];
  const BODY_FROM = '  const query = new URL(url).searchParams;';
  const BODY_TO = "\n  return 'ok';\n}\n";
  /** 함수 본문을 통째로 갈아 끼운다. */
  const withBody = (body) => {
    const src = LAB('practice3.js');
    const [from, to] = [src.indexOf(BODY_FROM), src.indexOf(BODY_TO) + BODY_TO.length - 2];
    expect(from).toBeGreaterThan(0);
    expect(to).toBeGreaterThan(from);
    return `${src.slice(0, from)}${body}${src.slice(to)}`;
  };
  const results = (source) => {
    const { code, out } = runLabScript('practice3.js', source);
    expect(code).toBe(0);
    return out.trimEnd().split('\n');
  };

  it('🔴 정답 판 — 여덟 줄', () => {
    expect(results(LAB('practice3.js'))).toEqual(RIGHT);
    // 주석의 낱말 — 교안 본문과 같은 «저장해 둔» · «제공자에게 다녀온»
    for (const src of [LAB('practice3.js'), SNAP('practice3-start.practice3.js')]) {
      expect(src).toContain('// 제공자에게 다녀온 브라우저가 연 콜백 주소들 — saved 는 떠나기 전에 쿠키에 저장해 둔 state 다.\n');
      expect(src).not.toContain('맡겨 둔');
    }
    expect(LAB('practice3.js')).toContain('  // 저장해 둔 state 가 없거나 주소의 state 와 다르면 우리가 보낸 요청의 답이 아니다.\n');
    labSeen.practice3 = `${RIGHT.join('\n')}\n`;
  });

  it('🔴 시작 파일 — 비운 채로 문법 검사를 통과하고 줄마다 «undefined» · 정답과는 함수 하나만 다르다', () => {
    const start = SNAP('practice3-start.practice3.js');
    nodeCheck(start);
    sameOutside(LAB('practice3.js'), start, 'function readCallback(url, savedState) {', 'for (const { label, saved, url } of arrivals) {');
    expect(results(start)).toEqual(RIGHT.map((line) => line.replace(/^\w+/, 'undefined')));
  });

  it('🔴 틀린 판 — state 부터 보면 카카오의 취소가 forged 로 읽힌다(카카오는 취소했을 때 state 를 붙이지 않는다)', () => {
    const got = results(withBody(`  const query = new URL(url).searchParams;
  const error = query.get('error');

  if (!savedState || query.get('state') !== savedState) return 'forged';
  if (error === 'access_denied') return 'denied';
  if (error !== null || !query.has('code')) return 'failed';

  return 'ok';
`));
    expect(got[1]).toBe('forged  state 없이 온 취소');
    expect(got.filter((line, i) => line !== RIGHT[i])).toEqual(['forged  state 없이 온 취소']);
    labSeen.practice3StateFirst = got.join('\n');
  });

  it('🔴 틀린 판 — 주소 글자에 error 가 들었는지로 보면 state 에 error 가 든 성공이 failed 로 읽힌다', () => {
    const got = results(withBody(`  const query = new URL(url).searchParams;

  if (url.includes('error=access_denied')) return 'denied';
  if (url.includes('error') || !query.has('code')) return 'failed';
  if (!savedState || query.get('state') !== savedState) return 'forged';

  return 'ok';
`));
    expect(got.filter((line, i) => line !== RIGHT[i])).toEqual(['failed  state에 error라는 글자가 든 성공']);
    labSeen.practice3Includes = got.join('\n');
  });

  it('🔴 틀린 판 — code 가 있는지 안 보면 code도 error도 없는 주소가 ok · state 를 != 로 견주면 쿠키도 state도 없는 주소가 ok', () => {
    const noCode = results(edit1(LAB('practice3.js'), "  if (error !== null || !query.has('code')) return 'failed';", "  if (error !== null) return 'failed';"));
    expect(noCode.filter((line, i) => line !== RIGHT[i])).toEqual(['ok  code도 error도 없는 주소']);
    const loose = results(edit1(LAB('practice3.js'), "  if (!savedState || query.get('state') !== savedState) return 'forged';", "  if (query.get('state') != savedState) return 'forged';"));
    expect(loose.filter((line, i) => line !== RIGHT[i])).toEqual(['ok  쿠키도 state도 없는 주소']);
  });
});

// ── 실습 서버들 ────────────────────────────────────────────────────────────
/** 실습 파일 하나를 학생처럼 프로젝트 폴더에서 `node lab/…` 로 띄운다 — 포트만 바꾼 사본. */
const bootLab = (rel, source, port, extraEnv = {}) => {
  const dir = studentDir(stepDir(6), (d) => {
    mkdirSync(join(d, rel, '..'), { recursive: true });
    writeFileSync(join(d, rel), source);
  });
  return boot(join(dir, rel), { port, cwd: dir, env: { ...env, ...extraEnv }, ready: `${port}번 포트에서` });
};
/** 나눠 주는 톡 서버 — `delay` 를 주면 `TALK_DELAY` 로 띄운다. */
const startTalk = (delay) => bootLab('lab/p3-46/talk-server.js', toLabPorts(LAB('talk-server.js'), 'talk-server.js', [4002, 4003]), TALK_PORT, delay ? { TALK_DELAY: String(delay) } : {});
/** 지난 회차에 나눠 준 실습용 인가 서버. */
const startAuthServer = () => bootLab('lab/p3-21/auth-server.js', toLabPorts(showAt('code/p3-45', 'lab/p3-21/auth-server.js'), 'auth-server.js', [4001, 4002]), LAB_AS_PORT);
/** 과제 서버를 띄운다 — `source` 는 학생 파일(또는 틀린 판) 원문. */
const withHomework = async (file, source, fn) => {
  const srv = await bootLab(`lab/p3-46/${file}`, toLabPorts(source, file, [4001, 4002, 4003]), LAB_PORT);
  try {
    await fn({ ...srv, base: LAB_BASE });
  } finally {
    await stop(srv);
  }
};
const TALK_BASE = `http://localhost:${TALK_PORT}`;
const TALK_CALLBACK = `${LAB_BASE}/talk/callback`;
/**
 * 톡으로 로그인 한 바퀴 — /talk → 동의 화면에서 계정을 고르고 허용(또는 거부) → /talk/callback.
 * `nickname: false` 는 «닉네임 제공» 체크를 끈다 · `tamper` 는 돌아오는 주소의 state 를 바꾼다 · `openPage` 는 동의 화면을 GET 으로 먼저 연다.
 */
const talkLogin = async (tab, account, { decision = 'allow', nickname = true, tamper, openPage = false } = {}) => {
  const begin = await tab.get('/talk');
  if (begin.status !== 302) return { begin };
  const auth = new URL(begin.location);
  // 브라우저처럼 동의 화면을 먼저 열고, 브라우저가 저절로 보내는 아이콘 요청도 한 번 보낸다(톡 서버의 로그에는 GET 줄 하나만 찍힌다).
  if (openPage) {
    await (await fetch(begin.location)).text();
    await fetch(`${auth.origin}/favicon.ico`);
  }
  const fields = [...auth.searchParams, ['account', account], ['decision', decision]];
  if (nickname) fields.push(['nickname', 'yes']);
  const consent = await fetch(`${auth.origin}/oauth/authorize`, { method: 'POST', body: new URLSearchParams(fields), redirect: 'manual' });
  const location = consent.headers.get('location');
  const back = new URL(location);
  if (tamper !== undefined) back.searchParams.set('state', tamper);
  expect(back.origin).toBe(LAB_BASE);
  const started = Date.now();
  const callback = await tab.get(`${back.pathname}${back.search}`);
  return { begin, consentStatus: consent.status, consentLocation: location, callback, took: Date.now() - started };
};
/** 실습용 인가 서버로 로그인 한 바퀴 — /login → 아이디·비밀번호를 넣고 허용 → /callback. */
const labLogin = async (tab, username, { decision = 'allow' } = {}) => {
  const begin = await tab.get('/login');
  if (begin.status !== 302) return { begin };
  const auth = new URL(begin.location);
  const form = new URLSearchParams([...auth.searchParams, ['username', username], ['password', `${username}1234`], ['decision', decision]]);
  const consent = await fetch(`${auth.origin}/authorize`, { method: 'POST', body: form, redirect: 'manual' });
  const back = new URL(consent.headers.get('location'));
  expect(back.origin).toBe(LAB_BASE);
  const callback = await tab.get(`${back.pathname}${back.search}`);
  return { begin, consentStatus: consent.status, callback };
};
/** 같은 서버 안의 302 를 따라간다 — 마지막 응답의 본문. */
const endOf = async (tab, res) => {
  let cur = res;
  while (cur.status >= 300 && cur.status < 400 && cur.location.startsWith('/')) cur = await tab.get(cur.location);
  return cur.body;
};
const noticeOf = (body) => (typeof body === 'string' ? body.match(/<p>(.*?)<\/p>/)?.[1] : undefined);
const execFileAsync = promisify(execFile);
/** httpYac CLI 로 `.http` 한 파일을 통째로 보낸다(`--all`) — 이 프로세스의 서버들이 답할 수 있게 비동기로 부른다. */
const httpyac = async (file, source) => {
  const dir = mkdtempSync(join(tmpdir(), 'p346-http-'));
  dirs.push(dir);
  writeFileSync(join(dir, file), toLabPorts(source, file, [4002]));
  try {
    return (await execFileAsync(P('node_modules/.bin/httpyac'), ['send', file, '--all'], { cwd: dir, encoding: 'utf8' })).stdout;
  } catch (error) {
    return `${error.stdout}${error.stderr}`;
  }
};

describe('축 ⑬ 나눠 주는 talk-server.js — 실습용 제공자 «톡»', () => {
  let talk;
  beforeAll(async () => { talk = await startTalk(); }, 30_000);
  afterAll(async () => { if (talk) await stop(talk); });
  const AUTHORIZE = { response_type: 'code', client_id: 'lab-talk', redirect_uri: TALK_CALLBACK, state: 'st4te' };
  const consent = (fields) => fetch(`${TALK_BASE}/oauth/authorize`, { method: 'POST', body: new URLSearchParams({ ...AUTHORIZE, ...fields }), redirect: 'manual' });
  const codeOf = async (fields) => new URL((await consent({ account: 'sora', nickname: 'yes', decision: 'allow', ...fields })).headers.get('location')).searchParams.get('code');
  const token = (fields) => fetch(`${TALK_BASE}/oauth/token`, { method: 'POST', body: new URLSearchParams({ grant_type: 'authorization_code', client_id: 'lab-talk', client_secret: 'talk-secret', redirect_uri: TALK_CALLBACK, ...fields }) });
  const me = (accessToken) => fetch(`${TALK_BASE}/v2/me`, { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} });

  it('🔴 150줄 안쪽 · 첫 줄은 경로 주석 · 4003 번 포트 · 새 패키지 없이(express 와 node:crypto 만)', () => {
    const src = LAB('talk-server.js');
    expect(src.trimEnd().split('\n').length).toBeLessThanOrEqual(150);
    expect(src.split('\n')[0]).toBe('// ~/instagram-api/lab/p3-46/talk-server.js');
    expect(src).toContain('app.listen(4003, () => {');
    expect([...src.matchAll(/^import .* from '(.*)';$/gm)].map((m) => m[1])).toEqual(['express', 'node:crypto', 'node:timers/promises']);
    expect(talk.log).toBe(`톡 서버가 ${TALK_PORT}번 포트에서 기다리고 있어요.\n`);
  });

  it('🔴 동의 화면 — 계정 둘(sora 가 골라져 있다) · «닉네임 제공» 체크(켜져 있다) · 허용/거부 · 받은 쿼리를 숨은 입력칸으로 · 등록하지 않은 앱·주소는 400', async () => {
    const page = await fetch(`${TALK_BASE}/oauth/authorize?${new URLSearchParams({ ...AUTHORIZE, code_challenge: 'abc', code_challenge_method: 'S256' })}`);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('<input type="radio" name="account" value="sora" checked> sora (소라)');
    expect(html).toContain('<input type="radio" name="account" value="haru"> haru (하루)');
    expect(html).toContain('<input type="checkbox" name="nickname" value="yes" checked> 닉네임 제공');
    expect(html).toContain('<button name="decision" value="allow">허용</button>');
    expect(html).toContain('<button name="decision" value="deny">거부</button>');
    expect(html).toContain('<input type="hidden" name="state" value="st4te">');
    expect(html).toContain('<input type="hidden" name="code_challenge" value="abc">');
    const badClient = await fetch(`${TALK_BASE}/oauth/authorize?${new URLSearchParams({ ...AUTHORIZE, client_id: 'constructor' })}`);
    expect([badClient.status, noticeOf(await badClient.text())]).toEqual([400, '등록되지 않은 앱이에요']);
    const badUri = await fetch(`${TALK_BASE}/oauth/authorize?${new URLSearchParams({ ...AUTHORIZE, redirect_uri: 'http://evil.example/cb' })}`);
    expect([badUri.status, noticeOf(await badUri.text())]).toEqual([400, '등록하지 않은 redirect_uri예요']);
  }, 30_000);

  it('🔴 /favicon.ico 는 204 로 답하고 요청 로그에 찍지 않는다 — 브라우저로 동의 화면을 열어도 로그가 한 줄(GET /oauth/authorize 200)뿐이다', async () => {
    await sleep(100);
    const before = talk.tail().length;
    expect((await fetch(`${TALK_BASE}/oauth/authorize?${new URLSearchParams(AUTHORIZE)}`)).status).toBe(200);
    const icon = await fetch(`${TALK_BASE}/favicon.ico`);
    expect([icon.status, await icon.text()]).toEqual([204, '']);
    await sleep(100);
    expect(talk.tail().slice(before)).toBe('[톡] GET /oauth/authorize 200\n');
    // 그 밖의 없는 주소는 그대로 404 로 찍힌다
    expect((await fetch(`${TALK_BASE}/nope`)).status).toBe(404);
    await sleep(100);
    expect(talk.tail().slice(before)).toBe('[톡] GET /oauth/authorize 200\n[톡] GET /nope 404\n');
  }, 30_000);

  it('🔴 허용하면 303 ?code=…&state=… · 거부하면 303 ?error=access_denied&error_description=User%20denied%20access(state 없이)', async () => {
    const allow = await consent({ account: 'sora', nickname: 'yes', decision: 'allow' });
    expect(allow.status).toBe(303);
    expect([...new URL(allow.headers.get('location')).searchParams.keys()]).toEqual(['code', 'state']);
    const deny = await consent({ account: 'sora', nickname: 'yes', decision: 'deny' });
    expect([deny.status, deny.headers.get('location')]).toEqual([303, `${TALK_CALLBACK}?error=access_denied&error_description=User%20denied%20access`]);
  }, 30_000);

  it('🔴 토큰 주소 — 성공 { token_type: bearer, access_token, expires_in } · 틀린 시크릿 401 TALK-010 · 틀린(이미 쓴) 코드 400 TALK-320 · 돌아올 주소가 다르면 400 TALK-303 · PKCE 는 받았으면 확인', async () => {
    const ok = await token({ code: await codeOf() });
    expect(ok.status).toBe(200);
    const body = await ok.json();
    expect(Object.keys(body)).toEqual(['token_type', 'access_token', 'expires_in']);
    expect([body.token_type, body.expires_in]).toEqual(['bearer', 3600]);
    const wrongSecret = await token({ code: await codeOf(), client_secret: 'nope' });
    expect([wrongSecret.status, await wrongSecret.json()]).toEqual([401, { error: 'invalid_client', error_description: '앱을 확인하지 못했어요', error_code: 'TALK-010' }]);
    const code = await codeOf();
    expect((await token({ code })).status).toBe(200);
    const used = await token({ code });
    expect([used.status, await used.json()]).toEqual([400, { error: 'invalid_grant', error_description: '쓸 수 없는 인가 코드예요', error_code: 'TALK-320' }]);
    const wrongUri = await token({ code: await codeOf(), redirect_uri: `${LAB_BASE}/callback` });
    expect([wrongUri.status, await wrongUri.json()]).toEqual([400, { error: 'invalid_grant', error_description: 'redirect_uri가 인가 요청 때와 달라요', error_code: 'TALK-303' }]);
    const pkce = { code_challenge: s256('verifier-1'), code_challenge_method: 'S256' };
    const wrongVerifier = await token({ code: await codeOf(pkce), code_verifier: 'verifier-2' });
    expect([wrongVerifier.status, (await wrongVerifier.json()).error_code]).toEqual([400, 'TALK-320']);
    expect((await token({ code: await codeOf(pkce), code_verifier: 'verifier-1' })).status).toBe(200);
  }, 30_000);

  it('🔴 사용자 정보 /v2/me — { id(숫자), joined_at, account: { nickname_agreed: true, profile: { nickname } } } · 닉네임 제공을 끄면 account: { nickname_agreed: false } · 토큰이 없거나 틀리면 401', async () => {
    const sora = await (await token({ code: await codeOf() })).json();
    expect(await (await me(sora.access_token)).json()).toEqual({ id: 10001, joined_at: '2026-03-02T09:00:00Z', account: { nickname_agreed: true, profile: { nickname: '소라' } } });
    const haru = await (await token({ code: await codeOf({ account: 'haru', nickname: '' }) })).json();
    expect(await (await me(haru.access_token)).json()).toEqual({ id: 10002, joined_at: '2026-05-17T14:30:00Z', account: { nickname_agreed: false } });
    const none = await me();
    expect([none.status, await none.json()]).toEqual([401, { message: '토큰을 확인하지 못했어요', code: 'TALK-401' }]);
    expect((await me('nope')).status).toBe(401);
    await sleep(100);
    expect(talk.tail()).toContain('[톡] POST /oauth/token 200\n[톡] GET /v2/me 200\n');
    expect(talk.tail()).toContain('[톡] GET /v2/me 401\n');
  }, 30_000);
});

describe('직접 해보기·과제 — 톡 서버와 실습용 인가 서버를 띄운 채', () => {
  let talk;
  let authServer;
  beforeAll(async () => {
    // 가짜 구글의 포트를 실습용 인가 서버가 물려받는다 — 이 뒤의 축은 가짜 구글을 쓰지 않는다.
    if (fakes.google) {
      await fakes.google.stop();
      delete fakes.google;
    }
    talk = await startTalk();
    authServer = await startAuthServer();
  }, 30_000);
  afterAll(async () => {
    if (talk) await stop(talk);
    if (authServer) await stop(authServer);
  });

  describe('축 ⑭ 과제 [기초] — 지난 과제 서버에 «톡으로 로그인» 을 더한다', () => {
    /** 확인 절차를 차례대로 돌려 관찰한 것을 돌려준다 — 정답 판과 틀린 판을 같은 절차로 잰다. */
    const observe = (source) => {
      let out;
      return withHomework('homework1.js', source, async ({ base, tail }) => {
        const got = {};
        got.home = (await browser(base).get('/')).body;
        // ① 톡 sora — 먼저 가입해 둔 2번 소라
        const a = browser(base);
        const sora = await talkLogin(a, 'sora');
        got.soraCallback = [sora.callback.status, sora.callback.location];
        got.sora = await endOf(a, sora.callback);
        // ② 인가 서버 jaehoon — 톡의 소라와 번호(10001)가 같지만 다른 회원
        const b = browser(base);
        got.jaehoon = await endOf(b, (await labLogin(b, 'jaehoon')).callback);
        got.membersAfterTwo = (await browser(base).get('/members')).body;
        // ③ 톡에서 닉네임 제공을 끄고 haru — 별명 없이 가입된다
        const c = browser(base);
        const haru = await talkLogin(c, 'haru', { nickname: false });
        got.haruCallback = [haru.callback.status, haru.callback.location];
        got.haru = await endOf(c, haru.callback);
        // ④ 톡 sora 다시 — 같은 회원
        const d = browser(base);
        got.soraAgain = await endOf(d, (await talkLogin(d, 'sora')).callback);
        // ⑤ 톡 haru 다시(이번에는 닉네임 제공을 켜고) — 같은 회원 · 별명은 그대로 없다
        const e = browser(base);
        got.haruAgain = await endOf(e, (await talkLogin(e, 'haru')).callback);
        // ⑥ 거부 · 고친 state
        const f = browser(base);
        const denied = await talkLogin(f, 'sora', { decision: 'deny' });
        got.deniedBack = denied.consentLocation;
        got.denied = [denied.callback.status, denied.callback.location ?? denied.callback.body];
        got.deniedNotice = denied.callback.status === 302 ? noticeOf(await endOf(f, denied.callback)) : null;
        const tampered = await talkLogin(browser(base), 'sora', { tamper: 'forged' });
        got.tampered = [tampered.callback.status, tampered.callback.location ?? tampered.callback.body];
        // ⑦ 지난 과제의 동작 — 이메일로 먼저 가입한 dahye 는 돌려보낸다
        const dahye = await labLogin(browser(base), 'dahye');
        got.dahye = [dahye.callback.status, dahye.callback.location];
        got.members = (await browser(base).get('/members')).body;
        const nobody = await browser(base).get('/me');
        got.nobody = [nobody.status, nobody.body];
        await sleep(100);
        got.terminal = tail();
        out = got;
      }).then(() => out);
    };
    const RIGHT = {
      home: '<!doctype html><meta charset="utf-8"><a href="/login">인가 서버로 로그인</a> <a href="/talk">톡으로 로그인</a>',
      soraCallback: [302, '/me'],
      sora: { id: 2, nickname: '소라' },
      jaehoon: { id: 3, nickname: 'jaehoon', email: 'jaehoon@example.com' },
      membersAfterTwo: [
        { id: 1, nickname: 'dahye', email: 'dahye@example.com', providers: [] },
        { id: 2, nickname: '소라', providers: ['talk'] },
        { id: 3, nickname: 'jaehoon', email: 'jaehoon@example.com', providers: ['lab'] },
      ],
      haruCallback: [302, '/me'],
      haru: { id: 4 },
      soraAgain: { id: 2, nickname: '소라' },
      haruAgain: { id: 4 },
      deniedBack: `${TALK_CALLBACK}?error=access_denied&error_description=User%20denied%20access`,
      denied: [302, '/?error=LOGIN_FAILED'],
      deniedNotice: '로그인하지 못했어요. 다시 시도해 주세요.',
      tampered: [302, '/?error=LOGIN_FAILED'],
      dahye: [302, '/?error=EMAIL_TAKEN'],
      members: [
        { id: 1, nickname: 'dahye', email: 'dahye@example.com', providers: [] },
        { id: 2, nickname: '소라', providers: ['talk'] },
        { id: 3, nickname: 'jaehoon', email: 'jaehoon@example.com', providers: ['lab'] },
        { id: 4, providers: ['talk'] },
      ],
      nobody: [401, { message: '로그인이 필요해요' }],
    };
    const withoutTerminal = ({ terminal, ...rest }) => rest;
    /** 정답과 다른 칸의 이름. */
    const wrongKeys = (got) => Object.keys(RIGHT).filter((key) => JSON.stringify(got[key]) !== JSON.stringify(RIGHT[key]));

    it('🔴 정답 판 — sora 는 2번 소라 · jaehoon 은 3번(번호가 같아도 다른 회원) · 닉네임을 끈 haru 는 별명 없는 4번 · 다시 와도 같은 회원 · 거부·고친 state 는 LOGIN_FAILED · 회원 넷에 제공자가 함께', async () => {
      const got = await observe(LAB('homework1.js'));
      expect(withoutTerminal(got)).toEqual(RIGHT);
      // 거부·이메일 겹침은 터미널에 에러를 찍지 않는다
      expect(got.terminal).not.toContain('Error');
      labSeen.homework1 = withoutTerminal(got);
    }, 60_000);

    it('🔴 톡의 프로필은 받지 않은 이메일도 빼지 않고 적는다 — { provider, id(글자), email: undefined, name } · 과제 [응용] 도 같다', () => {
      const block = "    done(null, {\n      provider: 'talk',\n      id: String(info.id),\n      email: undefined,\n      name: info.account?.profile?.nickname,\n    });\n";
      expect(LAB('homework1.js').split(block)).toHaveLength(2);
      expect(LAB('homework2.js').split(block)).toHaveLength(2);
    });

    it('🔴 지난 과제(lab/p3-45/homework1.js)를 복사해 고쳤다 — diff 로 지운 줄 24 · 전략 · 저장소 · 첫 화면의 표는 그대로', () => {
      const { removed } = diffLines(showAt('code/p3-45', 'lab/p3-45/homework1.js'), LAB('homework1.js'));
      labSeen.homework1RemovedFromLast = removed;
      expect(removed.length).toBe(24);
      // 지난 과제의 전략 · 저장소 · 첫 화면의 표는 그대로다
      for (const kept of ["    callbackURL: 'http://localhost:4002/callback',", "    req.res.cookie('lab_state', value, tempCookie);", "  EMAIL_TAKEN: '이미 가입한 이메일이에요.',", "    done(null, { provider: 'lab', id: info.sub, email: info.email });"]) {
        expect(LAB('homework1.js')).toContain(kept);
      }
    });

    it('🔴 (a) 회원번호를 숫자 그대로 넘기는 판 — 먼저 가입해 둔 소라를 못 찾아 새 회원(5번이 아니라 3번 소라)이 생긴다', async () => {
      const got = await observe(edit1(LAB('homework1.js'), '      id: String(info.id),\n', '      id: info.id,\n'));
      expect(got.sora).toEqual({ id: 3, nickname: '소라' });
      expect(wrongKeys(got)).toContain('sora');
      expect(wrongKeys(got)).toContain('members');
      labSeen.homework1NumberId = { sora: got.sora, soraAgain: got.soraAgain, members: got.members };
    }, 60_000);

    it('🔴 (b) 제공자를 안 보고 번호만으로 찾는 판 — 인가 서버의 jaehoon(10001)이 톡의 소라(10001)로 로그인된다', async () => {
      const got = await observe(edit1(LAB('homework1.js'),
        'socialAccounts.find((item) => item.provider === provider && item.providerUserId === id);',
        'socialAccounts.find((item) => item.providerUserId === id);'));
      expect(got.jaehoon).toEqual({ id: 2, nickname: '소라' });
      expect(wrongKeys(got)).toEqual(expect.arrayContaining(['jaehoon', 'membersAfterTwo', 'members']));
      labSeen.homework1IdOnly = { jaehoon: got.jaehoon, membersAfterTwo: got.membersAfterTwo };
    }, 60_000);

    it('🔴 (c) ?. 없이 닉네임을 읽는 판 — 닉네임 제공을 끈 haru 가 /?error=LOGIN_FAILED 로 돌아오고 터미널에 TypeError', async () => {
      const got = await observe(edit1(LAB('homework1.js'), 'info.account?.profile?.nickname', 'info.account.profile.nickname'));
      expect(got.haruCallback).toEqual([302, '/?error=LOGIN_FAILED']);
      expect(got.terminal).toContain("TypeError: Cannot read properties of undefined (reading 'nickname')");
      expect(got.sora).toEqual(RIGHT.sora);
      labSeen.homework1NoOptional = { haruCallback: got.haruCallback, terminalFirstLine: got.terminal.slice(got.terminal.indexOf('TypeError')).split('\n')[0] };
    }, 60_000);

    it('🔴 (d) 별명을 지난 과제처럼 이메일에서만 정하는 판(email.split) — 이메일이 없는 톡 사람은 새로 가입하지 못한다(먼저 가입해 둔 소라는 된다)', async () => {
      const got = await observe(edit1(LAB('homework1.js'), "nickname: name ?? email?.split('@')[0], email", "nickname: email.split('@')[0], email"));
      expect(got.sora).toEqual(RIGHT.sora);
      expect(got.haruCallback).toEqual([302, '/?error=LOGIN_FAILED']);
      expect(got.terminal).toContain("TypeError: Cannot read properties of undefined (reading 'split')");
    }, 60_000);

    it('🔴 (e) 에러 미들웨어를 /callback 에만 둔 판 — 톡 콜백에서 난 에러가 Express 기본 에러 응답(500 · HTML)으로 나간다', async () => {
      const wrong = edit1(edit1(LAB('homework1.js'), "app.use(['/callback', '/talk/callback'], (err, req, res, next) => {", "app.use('/callback', (err, req, res, next) => {"),
        'info.account?.profile?.nickname', 'info.account.profile.nickname');
      let seenRes;
      await withHomework('homework1.js', wrong, async ({ base }) => {
        seenRes = (await talkLogin(browser(base), 'haru', { nickname: false })).callback;
      });
      expect(seenRes.status).toBe(500);
      expect(seenRes.headers.get('content-type')).toBe('text/html; charset=utf-8');
      expect(seenRes.body).toContain('<pre>TypeError: Cannot read properties of undefined');
    }, 60_000);

    // 확인 절차 하나 더 — 틀린 판 (e)(에러 미들웨어를 /callback 에만)는 정상 경로로는 드러나지 않는다.
    // 톡 전략의 clientSecret 을 잠깐 틀리게 바꿔 «톡의 콜백에서 에러가 나는» 장면을 일부러 만든다.
    const wrongSecret = (source) => edit1(source, "    clientSecret: 'talk-secret',", "    clientSecret: 'talk-secret-x',");
    const secretScene = async (source) => {
      let got;
      await withHomework('homework1.js', wrongSecret(source), async ({ base, tail }) => {
        const before = talk.tail().length;
        const tab = browser(base);
        const { callback } = await talkLogin(tab, 'sora');
        await sleep(150);
        got = {
          status: callback.status,
          location: callback.location,
          contentType: callback.headers.get('content-type'),
          body: callback.body,
          notice: callback.status === 302 ? noticeOf(await endOf(tab, callback)) : null,
          terminal: tail().replace(/^.*번 포트에서 과제 서버가 돌아가요\n/, ''),
          talkLog: talk.tail().slice(before),
          members: (await browser(base).get('/members')).body.length,
        };
      });
      return got;
    };

    it('🔴 확인 — 톡 전략의 clientSecret 을 talk-secret-x 로 바꾸고 sora 로 허용하면 302 /?error=LOGIN_FAILED · 문장 · 터미널 첫 줄은 «TokenError: 앱을 확인하지 못했어요» · 회원은 그대로 둘', async () => {
      const got = await secretScene(LAB('homework1.js'));
      expect([got.status, got.location]).toEqual([302, '/?error=LOGIN_FAILED']);
      expect(got.notice).toBe('로그인하지 못했어요. 다시 시도해 주세요.');
      expect(got.terminal.split('\n')[0]).toBe('TokenError: 앱을 확인하지 못했어요');
      expect(got.terminal).toContain("  code: 'invalid_client',");
      // 톡 서버는 토큰 요청을 401 로 거절했고, 사용자 정보는 묻지도 않았다
      expect(got.talkLog).toBe('[톡] POST /oauth/authorize 303\n[톡] POST /oauth/token 401\n');
      expect(got.members).toBe(2);
      labSeen.homework1WrongSecret = { status: got.status, location: got.location, terminal: scrub(got.terminal, '(없음)'), talkLog: got.talkLog };
    }, 60_000);

    it('🔴 (e) 를 이 확인이 가려낸다 — 에러 미들웨어를 /callback 에만 둔 판은 같은 장면에서 500 · text/html · Express 기본 에러 화면(<pre>TokenError: 앱을 확인하지 못했어요 …)', async () => {
      const wrong = edit1(LAB('homework1.js'), "app.use(['/callback', '/talk/callback'], (err, req, res, next) => {", "app.use('/callback', (err, req, res, next) => {");
      const got = await secretScene(wrong);
      expect(got.status).toBe(500);
      expect(got.location).toBeNull();
      expect(got.contentType).toBe('text/html; charset=utf-8');
      expect(got.body.startsWith('<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>Error</title>\n</head>\n<body>\n<pre>TokenError: 앱을 확인하지 못했어요<br>')).toBe(true);
      expect(got.terminal.split('\n')[0]).toBe('TokenError: 앱을 확인하지 못했어요');
      labSeen.homework1WrongSecretNoMiddleware = { status: got.status, contentType: got.contentType, bodyHead: got.body.slice(0, 400), terminalHead: got.terminal.split('\n').slice(0, 3) };
    }, 60_000);

    it('🔴 homework1.http — 요청 둘 · httpYac 으로 보내면 회원 목록 200(처음에는 둘) · 로그인하지 않은 «나는 누구» 401', async () => {
      const http = LAB('homework1.http');
      expect(http).toBe('### 회원 목록\nGET http://localhost:4002/members\n\n### 로그인하지 않고 나는 누구\nGET http://localhost:4002/me\n');
      await withHomework('homework1.js', LAB('homework1.js'), async () => {
        const out = await httpyac('homework1.http', http);
        expect(out).toContain('2 requests processed (2 succeeded)');
        expect(out.match(/^HTTP\/1\.1 (\d+)/gm)).toEqual(['HTTP/1.1 200', 'HTTP/1.1 401']);
        expect(out).toContain('"nickname": "소라"');
        expect(out).toContain('"message": "로그인이 필요해요"');
        labSeen.homework1Http = out.replace(/^(date|etag|x-powered-by|connection|keep-alive): .*\n/gim, '');
      });
    }, 60_000);
  });
});

describe('축 ⑮ 과제 [응용] — 제공자가 늦게 답할 때(AbortSignal.timeout · PROVIDER_TIMEOUT)', () => {
  const TIMEOUT_TEXT = '로그인하는 곳이 제때 답하지 않았어요. 잠시 뒤에 다시 시도해 주세요.';
  const LOGIN_FAILED_TEXT = '로그인하지 못했어요. 다시 시도해 주세요.';
  const START_MEMBERS = [
    { id: 1, nickname: 'dahye', email: 'dahye@example.com', providers: [] },
    { id: 2, nickname: '소라', providers: ['talk'] },
  ];
  // 톡의 응답을 읽는 쪽(둘째 userProfile)의 catch — 틀린 판을 만들 때 여기를 바꾼다.
  const TALK_CATCH = "      name: info.account?.profile?.nickname,\n    });\n  } catch (error) {\n    done(error);\n  }\n";

  it('🔴 homework2.js 는 [기초] 정답에서 세 줄을 지우고 열다섯 줄을 더했다 — 상수 · fetch 둘의 signal · 문장 하나 · 에러 미들웨어', () => {
    const { removed, added } = diffLines(LAB('homework1.js'), LAB('homework2.js'));
    expect(removed).toEqual([
      '// ~/instagram-api/lab/p3-46/homework1.js',
      "  if (err.code !== 'EMAIL_TAKEN') console.error(err);",
      "  res.redirect(`/?error=${err.code === 'EMAIL_TAKEN' ? 'EMAIL_TAKEN' : 'LOGIN_FAILED'}`);",
    ]);
    expect(added).toEqual([
      '// ~/instagram-api/lab/p3-46/homework2.js',
      '// 제공자가 사용자 정보를 이 시간(밀리초) 안에 주지 않으면 기다리기를 그만둔다.',
      'const PROVIDER_TIMEOUT = 3000;',
      '      signal: AbortSignal.timeout(PROVIDER_TIMEOUT),',
      '      signal: AbortSignal.timeout(PROVIDER_TIMEOUT),',
      "  PROVIDER_TIMEOUT: '로그인하는 곳이 제때 답하지 않았어요. 잠시 뒤에 다시 시도해 주세요.',",
      '  // 무엇 때문에 실패했는지에 따라 에러 코드를 정한다 — 시간 안에 답을 못 받으면 fetch 가 이름이 TimeoutError 인 에러를 던진다.',
      "  let code = 'LOGIN_FAILED';",
      "  if (err.code === 'EMAIL_TAKEN') code = 'EMAIL_TAKEN';",
      "  if (err.name === 'TimeoutError') code = 'PROVIDER_TIMEOUT';",
      '',
      '  // 우리가 아는 실패가 아닐 때만 터미널에 남긴다.',
      "  if (code === 'LOGIN_FAILED') console.error(err);",
      '',
      '  res.redirect(`/?error=${code}`);',
    ]);
    expect(LAB('homework2.js')).toContain(TALK_CATCH);
  });

  describe('톡 서버를 TALK_DELAY=5000 으로 띄운 채', () => {
    let talk;
    beforeAll(async () => { talk = await startTalk(5000); }, 30_000);
    afterAll(async () => { if (talk) await stop(talk); });
    /**
     * 톡 haru 로 로그인해 보고 관찰한 것 — 콜백 응답 · 걸린 시간 · 그 뒤의 회원 목록 · 두 터미널.
     * haru 는 처음 온 사람이다(미리 넣어 둔 회원이 아니다) — «회원을 만들지 않는다» 가 회원 목록에서 바로 보인다.
     * `thenSora` 를 주면 이어서 sora 로도 로그인해 본다(그 사람의 /me).
     */
    const observe = (source, { thenSora = false } = {}) => {
      let out;
      return withHomework('homework2.js', source, async ({ base, tail }) => {
        const before = talk.tail().length;
        const tab = browser(base);
        const { callback, took } = await talkLogin(tab, 'haru');
        const end = await endOf(tab, callback);
        const members = (await browser(base).get('/members')).body;
        let sora;
        if (thenSora) {
          const other = browser(base);
          const second = await talkLogin(other, 'sora');
          sora = { callback: [second.callback.status, second.callback.location], end: await endOf(other, second.callback), members: (await browser(base).get('/members')).body };
        }
        // 톡 서버가 5초 뒤에 답을 쓰려다 그만두는 것까지 기다린다
        if (!thenSora) await sleep(Math.max(0, 5300 - took));
        out = {
          callback: [callback.status, callback.location],
          took,
          notice: noticeOf(end),
          end,
          members,
          sora,
          terminal: tail(),
          talkLog: talk.tail().slice(before),
        };
      }).then(() => out);
    };

    it('🔴 톡 서버가 뜰 때 늦게 답한다고 알린다', async () => {
      await sleep(100);
      expect(talk.tail().startsWith(`톡 서버가 ${TALK_PORT}번 포트에서 기다리고 있어요.\n사용자 정보는 5000ms 늦게 답해요.\n`)).toBe(true);
    });

    it('🔴 정답 판 — haru 로 허용하면 3초쯤 뒤 /?error=PROVIDER_TIMEOUT · 문장 · 회원은 dahye·소라 둘 그대로(haru 를 만들지 않는다) · 터미널에 에러를 찍지 않는다 · 톡 쪽 로그는 토큰 200 뒤에 «받는 쪽이 먼저 끊었어요»', async () => {
      const got = await observe(LAB('homework2.js'));
      expect(got.callback).toEqual([302, '/?error=PROVIDER_TIMEOUT']);
      expect(got.took).toBeGreaterThanOrEqual(2900);
      expect(got.took).toBeLessThan(4500);
      expect(got.notice).toBe(TIMEOUT_TEXT);
      expect(got.members).toEqual(START_MEMBERS);
      expect(got.terminal).not.toContain('Error');
      // 토큰 교환은 곧바로 끝났고, 사용자 정보만 늦다
      expect(got.talkLog).toBe('[톡] POST /oauth/authorize 303\n[톡] POST /oauth/token 200\n[톡] GET /v2/me (받는 쪽이 먼저 끊었어요)\n');
      labSeen.homework2Timeout = { callback: got.callback, took: got.took, members: got.members, talkLog: got.talkLog };
    }, 60_000);

    it('🔴 틀린 판 (a) — 기다리는 시간을 정하지 않은 판은 5초 뒤 로그인된다(/me 에 3번 하루) · 회원이 셋', async () => {
      const src = LAB('homework2.js');
      const wrong = src.replaceAll('      signal: AbortSignal.timeout(PROVIDER_TIMEOUT),\n', '');
      expect(wrong.length).toBe(src.length - 2 * '      signal: AbortSignal.timeout(PROVIDER_TIMEOUT),\n'.length);
      const got = await observe(wrong);
      expect(got.callback).toEqual([302, '/me']);
      expect(got.took).toBeGreaterThanOrEqual(4900);
      expect(got.end).toEqual({ id: 3, nickname: '하루' });
      expect(got.members).toEqual([...START_MEMBERS, { id: 3, nickname: '하루', providers: ['talk'] }]);
      expect(got.talkLog).toContain('[톡] GET /v2/me 200\n');
      labSeen.homework2NoLimit = { callback: got.callback, took: got.took, end: got.end, members: got.members };
    }, 60_000);

    it('🔴 틀린 판 (b) — 시간 초과를 잡고도 빈 프로필을 넘기는 판은 3초쯤 뒤 /me 로 가고 별명 없는 3번이 생긴다 · 이어서 sora 가 와도 같은 3번으로 로그인된다(번호 없는 소셜 계정을 함께 쓴다)', async () => {
      const wrong = edit1(LAB('homework2.js'), TALK_CATCH, TALK_CATCH.replace('    done(error);\n', "    if (error.name === 'TimeoutError') {\n      done(null, { provider: 'talk' });\n      return;\n    }\n\n    done(error);\n"));
      const got = await observe(wrong, { thenSora: true });
      expect(got.callback).toEqual([302, '/me']);
      expect(got.took).toBeLessThan(4500);
      expect(got.end).toEqual({ id: 3 });
      expect(got.members).toEqual([...START_MEMBERS, { id: 3, providers: ['talk'] }]);
      // 둘째로 온 sora — 미리 넣어 둔 2번 소라가 아니라 방금 생긴 3번으로 로그인된다 · 회원은 더 늘지 않는다
      expect(got.sora.callback).toEqual([302, '/me']);
      expect(got.sora.end).toEqual({ id: 3 });
      expect(got.sora.members).toEqual(got.members);
      labSeen.homework2CreatesAnyway = { callback: got.callback, end: got.end, members: got.members, sora: got.sora };
    }, 60_000);

    it('🔴 틀린 판 (c) — 에러의 이름을 AbortError 로 견주면 /?error=LOGIN_FAILED 로 가고 터미널에 DOMException [TimeoutError] 가 찍힌다 · 회원은 그대로', async () => {
      const got = await observe(edit1(LAB('homework2.js'), "  if (err.name === 'TimeoutError') code = 'PROVIDER_TIMEOUT';", "  if (err.name === 'AbortError') code = 'PROVIDER_TIMEOUT';"));
      expect(got.callback).toEqual([302, '/?error=LOGIN_FAILED']);
      expect(got.notice).toBe(LOGIN_FAILED_TEXT);
      expect(got.members).toEqual(START_MEMBERS);
      // 스택 없이 대괄호로 싸인 한 줄로 찍힌다(이 흐름에서 실측 — 세 번 모두 같았다)
      expect(got.terminal.split('\n')).toContain('[DOMException [TimeoutError]: The operation was aborted due to timeout]');
      // 터미널에 찍힌 에러 전체(첫 줄의 포트 안내만 뺀다) — 보고에 원문으로 남긴다
      labSeen.homework2AbortErrorTerminal = scrub(got.terminal.replace(/^.*번 포트에서 과제 서버가 돌아가요\n/, ''), '(없음)');
    }, 60_000);
  });

  describe('톡 서버를 TALK_DELAY 없이 띄운 채', () => {
    let talk;
    beforeAll(async () => { talk = await startTalk(); }, 30_000);
    afterAll(async () => { if (talk) await stop(talk); });

    it('🔴 정답 판 — 늦지 않으면 haru 가 로그인된다(/me 에 3번 하루) · 미리 넣어 둔 sora 는 2번 소라', async () => {
      await withHomework('homework2.js', LAB('homework2.js'), async ({ base }) => {
        const a = browser(base);
        const haru = await talkLogin(a, 'haru');
        expect([haru.callback.status, haru.callback.location]).toEqual([302, '/me']);
        expect(haru.took).toBeLessThan(1500);
        expect(await endOf(a, haru.callback)).toEqual({ id: 3, nickname: '하루' });
        const b = browser(base);
        expect(await endOf(b, (await talkLogin(b, 'sora')).callback)).toEqual({ id: 2, nickname: '소라' });
        expect((await browser(base).get('/members')).body).toEqual([...START_MEMBERS, { id: 3, nickname: '하루', providers: ['talk'] }]);
        const denied = await talkLogin(browser(base), 'sora', { decision: 'deny' });
        expect([denied.callback.status, denied.callback.location]).toEqual([302, '/?error=LOGIN_FAILED']);
      });
    }, 60_000);

    it('🔴 첫 화면 — 코드마다 다른 문장 · 표에 없는 코드(<b>x</b> · constructor)는 기본 문장이고 주소의 글자가 본문에 없다', async () => {
      await withHomework('homework2.js', LAB('homework2.js'), async ({ base }) => {
        const page = async (query) => (await browser(base).get(`/?error=${query}`)).body;
        expect(noticeOf(await page('PROVIDER_TIMEOUT'))).toBe(TIMEOUT_TEXT);
        expect(noticeOf(await page('EMAIL_TAKEN'))).toBe('이미 가입한 이메일이에요.');
        expect(noticeOf(await page('LOGIN_FAILED'))).toBe(LOGIN_FAILED_TEXT);
        const injected = await page(encodeURIComponent('<b>x</b>'));
        expect(noticeOf(injected)).toBe(LOGIN_FAILED_TEXT);
        expect(injected).not.toContain('<b>x</b>');
        expect(noticeOf(await page('constructor'))).toBe(LOGIN_FAILED_TEXT);
        expect((await browser(base).get('/')).body).not.toContain('<p>');
      });
    }, 60_000);

    it('🔴 틀린 판 — ?error= 의 글자를 그대로 그리는 판은 /?error=<b>x</b> 의 태그가 본문에 들어간다 · Object.hasOwn 없이 꺼내는 판은 constructor 에 함수 글자', async () => {
      const line = "  const text = Object.hasOwn(NOTICES, error ?? '') ? NOTICES[error] : NOTICES.LOGIN_FAILED;\n";
      await withHomework('homework2.js', edit1(LAB('homework2.js'), line, '  const text = NOTICES[error] ?? error;\n'), async ({ base }) => {
        expect((await browser(base).get(`/?error=${encodeURIComponent('<b>x</b>')}`)).body).toContain('<p><b>x</b></p>');
      });
      await withHomework('homework2.js', edit1(LAB('homework2.js'), line, '  const text = NOTICES[error] ?? NOTICES.LOGIN_FAILED;\n'), async ({ base }) => {
        expect(noticeOf((await browser(base).get('/?error=constructor')).body)).not.toBe(LOGIN_FAILED_TEXT);
      });
    }, 60_000);

    it('🔴 homework2.http — 요청 셋 · httpYac 으로 보내면 셋 다 200 · 둘째는 PROVIDER_TIMEOUT 문장 · 셋째는 기본 문장(태그 없음)', async () => {
      const http = LAB('homework2.http');
      expect(http).toBe('### 회원 목록\nGET http://localhost:4002/members\n\n### 제때 답하지 않았을 때의 첫 화면\nGET http://localhost:4002/?error=PROVIDER_TIMEOUT\n\n### 문장 목록에 없는 에러 코드로 연 첫 화면\nGET http://localhost:4002/?error=%3Cb%3Ex%3C%2Fb%3E\n');
      await withHomework('homework2.js', LAB('homework2.js'), async () => {
        const out = await httpyac('homework2.http', http);
        expect(out).toContain('3 requests processed (3 succeeded)');
        expect(out.match(/^HTTP\/1\.1 (\d+)/gm)).toEqual(['HTTP/1.1 200', 'HTTP/1.1 200', 'HTTP/1.1 200']);
        expect(out).toContain(`<p>${TIMEOUT_TEXT}</p>`);
        expect(out).toContain(`<p>${LOGIN_FAILED_TEXT}</p>`);
        expect(out).not.toContain('<b>x</b>');
        // 보낸 주소가 파일에 적은 그대로다(퍼센트 인코딩이 바뀌지 않는다)
        expect(out).toContain(`GET ${LAB_BASE}/?error=%3Cb%3Ex%3C%2Fb%3E`);
      });
    }, 60_000);
  });
});

// ── 축 ⑯ 교안·답안이 말한 글자 = 실제 ──────────────────────────────────────
// 원고는 읽기만 한다. 경로는 앞 회차 판정(`p3-44`)처럼 트랙 폴더에서 찾고, `P346_LECTURE`·`P346_ANSWERS` 로 바꿀 수 있다.
// 🚨 원고가 없으면 건너뛰지 않고 실패한다(읽는 순간 ENOENT).
// 🔎 잠그지 않는 것 — 교안 Step 3 의 카카오 `console.log(info)` 출력 · SQL 결과 표 · 틀린 시크릿의 `TokenError` 첫 줄
//    (사용자가 진짜 제공자로 재서 바꿀 값이다).
const DOC_DIR = new URL('../../part3/7-express-auth/', ROOT).pathname;
const LECTURE_MD = process.env.P346_LECTURE ?? join(DOC_DIR, 'p3-46-kakao-naver-strategies-lecture.md');
const ANSWERS_MD = process.env.P346_ANSWERS ?? join(DOC_DIR, 'p3-46-kakao-naver-strategies-answers.md');
/**
 * 원고의 펜스를 차례대로 — 언어 · 본문(줄들) · 시작 줄 번호 · 그 펜스가 속한 Step(`## Step N`) ·
 * 직접 해보기 번호(`### 직접 해보기 N`) · `**확인**` 뒤 몇째 펜스인지 · 해설(`💡 해설`) 안인지.
 */
const fencesOf = (file) => {
  const out = [];
  let cur = null;
  let step = null;
  let practice = null;
  let sinceCheck = null;
  let solution = false;
  read(file).split('\n').forEach((line, i) => {
    if (cur) {
      if (line.startsWith('```')) { out.push(cur); cur = null; } else cur.body.push(line);
      return;
    }
    if (line.startsWith('```')) {
      cur = { lang: line.slice(3).trim(), body: [], line: i + 1, step, practice, afterCheck: sinceCheck, solution };
      if (sinceCheck !== null) sinceCheck += 1;
      return;
    }
    const stepHead = /^## Step (\d+)/.exec(line);
    if (/^## /.test(line)) { step = stepHead ? Number(stepHead[1]) : null; practice = null; sinceCheck = null; solution = false; }
    if (/^### /.test(line)) {
      const head = /^### 직접 해보기 (\d+)/.exec(line);
      practice = head ? Number(head[1]) : null;
      sinceCheck = null;
      solution = false;
    }
    if (line.startsWith('**확인**')) sinceCheck = 0;
    if (line.includes('<summary>💡 해설</summary>')) solution = true;
    if (line.startsWith('</details>')) solution = false;
  });
  if (cur) throw new Error(`${file} — 닫히지 않은 펜스(${cur.line}번 줄)`);
  return out;
};
const API_PATH = '// ~/instagram-api/';
/** `...` 과 빈 줄을 뺀 줄이 `haystack`(줄들)에 차례대로 있는가 — 없으면 처음 못 찾은 줄을 돌려준다. */
const firstMissing = (wanted, haystack) => {
  let at = 0;
  for (const line of wanted.filter((one) => one.trim() !== '' && one.trim() !== '...')) {
    const found = haystack.indexOf(line, at);
    if (found === -1) return line;
    at = found + 1;
  }
  return null;
};
const where = (name, fence) => `${name} ${fence.line}번 줄의 펜스`;

describe('축 ⑯ 교안·답안이 말한 글자 = 실제', () => {
  const docs = () => [['교안', fencesOf(LECTURE_MD)], ['답안', fencesOf(ANSWERS_MD)]];
  const practiceFence = (n, pick) => {
    const found = fencesOf(LECTURE_MD).filter((fence) => fence.practice === n).filter(pick);
    if (found.length !== 1) throw new Error(`교안 직접 해보기 ${n} 에서 펜스를 하나로 못 찾았다(${found.length}개)`);
    return found[0];
  };
  /** `**확인**` 바로 아래의 언어 없는 펜스 — 기대 출력. */
  const expectedOutput = (n) => practiceFence(n, (fence) => fence.afterCheck === 0 && fence.lang === '' && !fence.solution);
  /** `**확인**` 뒤의 첫 javascript 펜스 — 시작 코드. */
  const startCode = (n) => practiceFence(n, (fence) => fence.afterCheck === 1 && fence.lang === 'javascript' && !fence.solution);

  it('🔴 javascript 펜스는 모두 경로 주석(// ~/instagram-api/…)으로 시작한다 — 교안 14개 · 답안 8개가 수업 파일 넷과 실습·과제 파일 다섯을 가리킨다', () => {
    const paths = {};
    for (const [name, fences] of docs()) {
      const js = fences.filter((fence) => fence.lang === 'javascript');
      const bad = js.filter((fence) => !(fence.body[0] ?? '').startsWith(API_PATH)).map((fence) => where(name, fence));
      expect(bad).toEqual([]);
      paths[name] = [...new Set(js.map((fence) => fence.body[0].slice(API_PATH.length)))].sort();
    }
    expect(paths['교안']).toEqual(['app.js', 'lab/p3-46/practice1.js', 'lab/p3-46/practice2.js', 'lab/p3-46/practice3.js', 'routes/auth.js', 'strategies/kakao.js', 'strategies/naver.js']);
    expect(paths['답안']).toEqual(['lab/p3-46/homework1.js', 'lab/p3-46/homework2.js']);
  });

  it('🔴 교안의 수업 파일 블록 — ... 과 빈 줄을 뺀 모든 줄이 그 Step 의 커밋에 든 그 파일에 차례대로 있다(Step 3 의 console.log(info) 블록은 스냅숏에)', () => {
    const problems = [];
    let checked = 0;
    for (const fence of fencesOf(LECTURE_MD).filter((one) => one.lang === 'javascript' && one.body[0].startsWith(API_PATH))) {
      const rel = fence.body[0].slice(API_PATH.length);
      if (rel.startsWith('lab/')) continue;
      let source;
      if (rel === 'strategies/kakao.js' && fence.body.includes('    console.log(info);')) {
        if (fence.step !== 3) problems.push(`${where('교안', fence)} — console.log(info) 블록이 Step 3 이 아니다(Step ${fence.step})`);
        source = SNAP('step3-log.kakao.js');
      } else if (fence.step >= 2 && fence.step <= 6) {
        source = read(stepDir(fence.step)(rel));
      } else {
        problems.push(`${where('교안', fence)} — ${rel} 블록이 Step 2~6 밖에 있다(Step ${fence.step})`);
        continue;
      }
      const missing = firstMissing(fence.body, source.split('\n'));
      if (missing !== null) problems.push(`${where('교안', fence)}(Step ${fence.step} · ${rel}) — 이 줄이 그 판에 (차례대로) 없다: ${missing}`);
      checked += 1;
    }
    expect(problems).toEqual([]);
    expect(checked).toBeGreaterThanOrEqual(8);
  });

  it('🔴 교안·답안의 실습·과제 블록 — 시작 코드는 시작 파일 스냅숏과 통째로 같고, 나머지는 모든 줄이 정답 파일에 차례대로 있다', () => {
    const problems = [];
    let checked = 0;
    for (const [name, fences] of docs()) {
      for (const fence of fences.filter((one) => one.lang === 'javascript' && one.body[0].startsWith(`${API_PATH}lab/`))) {
        const rel = fence.body[0].slice(API_PATH.length);
        const file = /^lab\/p3-46\/([\w.]+)$/.exec(rel)?.[1];
        if (!file) { problems.push(`${where(name, fence)} — lab/p3-46 밖의 파일이다: ${rel}`); continue; }
        const isStart = name === '교안' && fence.practice !== null && !fence.solution;
        if (isStart) {
          if (fence.line !== startCode(fence.practice).line) problems.push(`${where(name, fence)} — 해설 밖의 javascript 펜스인데 «확인» 뒤 첫 javascript 펜스가 아니다`);
          const snapshot = SNAP(`practice${fence.practice}-start.${file}`);
          if (`${fence.body.join('\n')}\n` !== snapshot) {
            const [got, want] = [fence.body, snapshot.trimEnd().split('\n')];
            const at = got.findIndex((line, i) => line !== want[i]);
            problems.push(`${where(name, fence)} — 시작 파일 스냅숏과 다르다(교안 ${got.length}줄 · 스냅숏 ${want.length}줄) · 처음 다른 곳은 블록의 ${at === -1 ? got.length + 1 : at + 1}번째 줄: 교안 «${got[at] ?? '(없음)'}» ↔ 스냅숏 «${want[at === -1 ? got.length : at] ?? '(없음)'}»`);
          }
        } else {
          const missing = firstMissing(fence.body, LAB(file).split('\n'));
          if (missing !== null) problems.push(`${where(name, fence)}(${rel}) — 이 줄이 정답 파일에 (차례대로) 없다: ${missing}`);
        }
        checked += 1;
      }
    }
    expect(problems).toEqual([]);
    expect(checked).toBeGreaterThanOrEqual(14);
    // 직접 해보기 셋 모두 시작 코드와 해설 코드가 하나씩 있다
    for (const n of [1, 2, 3]) {
      expect(startCode(n).body[0]).toBe(`${API_PATH}lab/p3-46/practice${n}.js`);
      expect(practiceFence(n, (fence) => fence.solution && fence.lang === 'javascript').body[0]).toBe(`${API_PATH}lab/p3-46/practice${n}.js`);
    }
  });

  it('🔴 직접 해보기 1~3 의 «확인» 바로 아래 펜스는 정답 스크립트의 실제 출력과 통째로 같다', () => {
    const problems = [];
    for (const n of [1, 2, 3]) {
      const { code, out } = runLabScript(`practice${n}.js`, LAB(`practice${n}.js`));
      const fence = expectedOutput(n);
      if (code !== 0 || `${fence.body.join('\n')}\n` !== out) problems.push(`${where('교안', fence)}(직접 해보기 ${n}) — 실제 출력과 다르다:\n--- 교안\n${fence.body.join('\n')}\n--- 실제\n${out}`);
    }
    expect(problems).toEqual([]);
  });

  // 틀린 판의 출력 자체는 축 ⑩(직접 해보기 1 — ①·②)·축 ⑪(직접 해보기 2 — 네이버를 맨 위에서 · 확인하지 않음)이 잠갔다.
  // 여기서는 «교안의 해설이 인용한 글자» 가 그 틀린 판에서 실제로 나온 글자인지를 잇는다.
  it('🔴 해설이 인용한 틀린 판의 글자 — 실습 1 의 TypeError(reading replace) · «MinSu!» · 실습 2 의 {"provider":"naver","emailVerified":false} · «READERS[provider] is not a function» 가 그 틀린 판에서 실제로 나온다', () => {
    const lecture = read(LECTURE_MD);
    const p1 = LAB('practice1.js');
    const p2 = LAB('practice2.js');
    const noName = runLabScript('practice1.js', edit1(p1, "(profile.name ?? '').replace(NOT_ALLOWED, '')", "profile.name.replace(NOT_ALLOWED, '')")).out;
    const noGlobal = runLabScript('practice1.js', edit1(p1, 'const NOT_ALLOWED = /[^A-Za-z0-9_.]/g;', 'const NOT_ALLOWED = /[^A-Za-z0-9_.]/;')).out;
    const naverTop = runLabScript('practice2.js', edit1(p2,
      'naver: (info) => ({ id: info.response.id, email: info.response.email, emailVerified: false, name: info.response.name }),',
      'naver: (info) => ({ id: info.id, email: info.email, emailVerified: false, name: info.name }),')).out;
    const noCheck = runLabScript('practice2.js', edit1(p2, "  if (!Object.hasOwn(READERS, provider)) throw new Error(`모르는 제공자예요: ${provider}`);\n\n", '')).out;
    const quotes = [
      ["TypeError: Cannot read properties of undefined (reading 'replace')", noName.split('\n').find((line) => line.startsWith('TypeError'))],
      ['MinSu!', noGlobal.split('\n')[2].split('  ← ')[0]],
      ['{"provider":"naver","emailVerified":false}', naverTop.split('\n')[2]],
      ['READERS[provider] is not a function', noCheck.split('\n')[3]],
    ];
    for (const [quoted, actual] of quotes) {
      expect(actual).toBe(quoted);
      expect(lecture).toContain(quoted);
    }
    // 실습 2 해설의 펜스는 그 한 줄뿐이다
    const fence = practiceFence(2, (one) => one.solution && one.lang === '');
    expect(fence.body).toEqual(['{"provider":"naver","emailVerified":false}']);
  });

  describe('수업 백엔드를 띄워서', () => {
    beforeAll(async () => {
      // 실습 축이 가짜 구글을 껐다 — 수업 백엔드의 사본을 띄우려면 다시 필요하다.
      if (!fakes.google) fakes.google = await startFakeGoogle({ port: GOOGLE_PORT });
    }, 30_000);
    /** 터미널 글자를 교안의 발췌와 견줄 수 있게 — 경로 · 걸린 시간 · code·state 값만 바꾼다(줄 끝의 빈칸은 버린다). */
    const terminalLines = (text) => text
      .replaceAll('/Users/hong/instagram-api', '~/instagram-api')
      .replace(/\d+(\.\d+)?ms/g, 'N.Nms')
      .replace(/(code|state)=[A-Za-z0-9_-]+/g, '$1=…')
      .split('\n').map((line) => line.trimEnd());

    it('🔴 Step 3 의 터미널 발췌(PrismaClientValidationError: 로 시작하는 펜스) — ... 을 뺀 모든 줄이 Step 3 판의 실제 터미널에 차례대로 있다', async () => {
      const fence = fencesOf(LECTURE_MD).filter((one) => one.step === 3 && one.lang === '' && one.body[0].startsWith('PrismaClientValidationError:'));
      expect(fence).toHaveLength(1);
      await freshGate();
      let actual;
      await withServer(stepDir(3), async ({ base, tail, dir }) => {
        const { callback } = await socialLogin(browser(base), 'kakao');
        expect(callback.location).toBe(LOGIN_FAILED_PAGE);
        await sleep(150);
        actual = terminalLines(scrub(tail(), dir));
      });
      expect(firstMissing(terminalLines(fence[0].body.join('\n')), actual)).toBeNull();
      // 발췌의 마지막 줄은 콜백 요청의 로그 한 줄이다
      expect(terminalLines(fence[0].body.at(-1))[0]).toBe('GET /api/v2/auth/kakao/callback?code=…&state=… 302 N.Nms');
    }, 30_000);

    it('🔴 Step 4 의 한 줄(Argument `providerUserId`: Invalid value provided. Expected String, provided Int.) — String() 을 뺀 판의 실제 터미널에 그 줄이 있다', async () => {
      const fence = fencesOf(LECTURE_MD).filter((one) => one.step === 4 && one.lang === '' && one.body[0].startsWith('Argument `providerUserId`'));
      expect(fence).toHaveLength(1);
      expect(fence[0].body).toHaveLength(1);
      await freshGate();
      await withServer(stepDir(4), async ({ base, tail }) => {
        const { callback } = await socialLogin(browser(base), 'kakao');
        expect(callback.location).toBe(LOGIN_FAILED_PAGE);
        await sleep(150);
        expect(tail().split('\n')).toContain(fence[0].body[0]);
      }, { fake: false, edit: (d) => { cpSync(P('snapshots/p3-46.step4-number-id.kakao.js'), join(d, 'strategies/kakao.js')); useFakes(d); } });
    }, 30_000);
  });

  it('🔴 과제의 http 블록 둘은 lab/p3-46/homework1.http · homework2.http 와 통째로 같다', () => {
    const http = fencesOf(LECTURE_MD).filter((fence) => fence.lang === 'http').map((fence) => `${fence.body.join('\n')}\n`);
    expect(http).toEqual([LAB('homework1.http'), LAB('homework2.http')]);
  });

  it('🔴 과제 [응용] 의 톡 서버 네 줄 — 동의 화면을 GET 으로 열고(/favicon.ico 요청도 한 번) haru 로 허용한 흐름에서(TALK_DELAY=5000 · 과제 [응용] 정답) 그대로 찍힌다', async () => {
    const fence = fencesOf(LECTURE_MD).filter((one) => one.lang === '' && one.body[0] === '[톡] GET /oauth/authorize 200');
    expect(fence).toHaveLength(1);
    const talk = await startTalk(5000);
    try {
      await sleep(100);
      const before = talk.tail().length;
      await withHomework('homework2.js', LAB('homework2.js'), async ({ base }) => {
        const { callback } = await talkLogin(browser(base), 'haru', { openPage: true });
        expect(callback.location).toBe('/?error=PROVIDER_TIMEOUT');
        await sleep(300);
      });
      expect(talk.tail().slice(before)).toBe(`${fence[0].body.join('\n')}\n`);
    } finally {
      await stop(talk);
    }
  }, 60_000);

  it('🔴 답안의 console.log(info) 출력(id: 10001 …) — 과제 [기초] 정답에 그 한 줄을 넣고 톡 sora 로 로그인했을 때 과제 서버 터미널에 찍히는 객체와 같다', async () => {
    const fence = fencesOf(ANSWERS_MD).filter((one) => one.lang === '' && one.body[0] === '{' && one.body[1] === '  id: 10001,');
    expect(fence).toHaveLength(1);
    const src = LAB('homework1.js');
    const line = '    const info = await response.json();\n';
    // 둘째(톡 전략의 userProfile) 줄 아래에 넣는다
    const at = src.indexOf(line, src.indexOf(line) + 1);
    expect(at).toBeGreaterThan(src.indexOf('talkStrategy.userProfile'));
    const logging = `${src.slice(0, at + line.length)}    console.log(info);\n${src.slice(at + line.length)}`;
    const talk = await startTalk();
    try {
      await withHomework('homework1.js', logging, async ({ base, tail }) => {
        const tab = browser(base);
        expect(await endOf(tab, (await talkLogin(tab, 'sora')).callback)).toEqual({ id: 2, nickname: '소라' });
        await sleep(100);
        const log = tail();
        const from = log.indexOf('{\n  id: 10001,');
        expect(from).toBeGreaterThan(0);
        expect(log.slice(from, log.indexOf('\n}\n', from) + 2)).toBe(fence[0].body.join('\n'));
      });
    } finally {
      await stop(talk);
    }
  }, 60_000);
});
