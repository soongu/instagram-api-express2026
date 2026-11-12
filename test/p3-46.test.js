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

  it('🔴 동의 화면에서 취소 — 네이버는 ?state=…&error=access_denied&error_description=… · 카카오는 state 없이 — 둘 다 302 /login?error=SOCIAL_LOGIN_FAILED · 고친 state · 쿠키 없이 온 콜백도 · 행이 안 생긴다', async () => {
    await freshGate();
    await withServer(stepDir(6), async ({ base, tail }) => {
      const before = await counts();
      expect((await socialLogin(browser(base), 'naver', { tamper: 'forged' })).callback.location).toBe(LOGIN_FAILED_PAGE);
      expect((await socialLogin(browser(base), 'naver', { fresh: true })).callback.location).toBe(LOGIN_FAILED_PAGE);
      fakes.naver.state.mode = 'deny';
      fakes.kakao.state.mode = 'deny';
      const naver = await socialLogin(browser(base), 'naver');
      const back = new URL(naver.consent.location);
      expect([...back.searchParams.keys()]).toEqual(['state', 'error', 'error_description']);
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
