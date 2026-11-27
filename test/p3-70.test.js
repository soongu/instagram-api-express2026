// p3-70 「인증을 끝까지 잇기」 게이트 - 백엔드(교안 Step 2 · 3 · 4)
// 내부 검증 전용 - 교안에 한 줄도 인용하지 않는다.
//
// 백엔드의 시작 판은 code/p3-69(89a7ef0)의 학생 파일이다(`curriculum.md` 「`p3-70` 착수 결정」).
// 커밋 - Step 2(로그인 값을 모양으로 가른다) · Step 3(휴대폰 번호 모양의 사용자 이름을 막는다 · 실패 문장) · Step 4(.env 로 토큰 기한).
// 🔑 포트 - 3987 · `P370_PORT` 로 바꾼다. DB - `p370_api_` 로 시작하는 것만 만들고 지운다.
//    PostgreSQL 은 `P370_PG_PORT`(기본 5580 - 판정용 컨테이너 p368-db).
// 🔑 판정 DB 는 «p3-69 를 마친 학생 DB» `test/fixtures/p3-69-end.sql` 이다 - seoyeon(43) 은 이메일 seoyeon@example.com ·
//    admin.hong(45) 은 휴대폰 번호 01077771234 · 둘 다 비밀번호가 있다. jaehoon(2) 은 이메일도 휴대폰 번호도 없다.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, cpSync, symlinkSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import pg from 'pg';
import { io as connectIo } from 'socket.io-client';
import { boot } from './helpers/boot.js';

const ROOT = new URL('../', import.meta.url);
const P = (rel) => new URL(rel, ROOT).pathname;
const read = (path) => readFileSync(path, 'utf8');
const PG_PORT = Number(process.env.P370_PG_PORT ?? 5580);
const ADMIN = { host: 'localhost', port: PG_PORT, database: 'postgres', user: 'postgres', password: 'postgres' };
const DB_PREFIX = process.env.P370_DB_PREFIX ?? 'p370_api';
const TPL_DB = `${DB_PREFIX}_tpl`;
const GATE_DB = `${DB_PREFIX}_gate`;
const dbUrl = (name) => `postgresql://postgres:postgres@localhost:${PG_PORT}/${name}`;
const PORT = Number(process.env.P370_PORT ?? 3987);
const SECRET = 'q2Xh0v9bGm4RkT7sYp1wLc8nZf3uJd6eHa5iVo0rQyE';
const env = {
  CORS_ORIGIN: 'http://localhost:3001', JWT_SECRET: SECRET,
  GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret', SITE_URL: `http://localhost:${PORT}`,
  KAKAO_CLIENT_ID: 'test-kakao', KAKAO_CLIENT_SECRET: 'test-kakao-secret',
  NAVER_CLIENT_ID: 'test-naver', NAVER_CLIENT_SECRET: 'test-naver-secret',
};
const STUDENT_FILES = ['app.js', 'realtime.js', 'public', 'db.js', 'errors.js', 'responses.js', 'routes', 'controllers', 'services', 'middlewares', 'schemas', 'strategies', 'docs', 'utils', 'package.json', 'requests', 'seed.js', 'data', 'prisma', 'prisma.config.js', '.env.example', 'lab'];
const FIXTURE = P('test/fixtures/p3-69-end.sql');

const git = (args) => execFileSync('git', args, { cwd: P('.'), encoding: 'utf8', maxBuffer: 1 << 28 });
const hasRef = (ref) => {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', ref], { cwd: P('.'), stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
};
// 🔑 판의 선 - 북마크 code/p3-70 가 있으면 그것, 없으면 지금 체크아웃한 선(HEAD). `P370_LINE` 으로 바꾼다.
const LINE = process.env.P370_LINE ?? (hasRef('refs/heads/code/p3-70') ? 'code/p3-70' : 'HEAD');
const WT = process.env.P370_WT ?? null;
const START = process.env.P370_BASE ?? 'code/p3-69';
/** «(표식)» 이 붙은 그 회차 커밋들 - 새것부터. */
const markCommits = (mark) => {
  const log = git(['log', '-n', '200', '--format=%H %s', LINE]);
  return log.split('\n').filter((l) => / feat\(p3-70\): /.test(l) && l.endsWith(`(${mark})`)).map((l) => l.split(' ')[0]);
};
const MARKS = { 2: 'Step 2', 3: 'Step 3', 4: 'Step 4' };
const dirs = [];
const refDirs = new Map();
const refDir = (ref) => {
  if (refDirs.has(ref)) return refDirs.get(ref);
  const dir = mkdtempSync(join(tmpdir(), 'p370-ref-'));
  const tar = execFileSync('git', ['archive', '--format=tar', ref], { cwd: P('.'), maxBuffer: 1 << 28 });
  execFileSync('tar', ['-x', '-C', dir], { input: tar });
  dirs.push(dir);
  const at = (rel) => join(dir, rel);
  refDirs.set(ref, at);
  return at;
};
const worktree = (rel) => P(rel);
const versionRef = (step) => {
  if (step === 'start') return START;
  const commits = markCommits(MARKS[step]);
  if (commits.length === 0) throw new Error(`p3-70 (${MARKS[step]}) 커밋이 없다`);
  return commits[0];
};
/** 그 Step 의 끝 판 - `P370_WT` 가 그 Step 이면 작업트리. */
const version = (step) => (WT === String(step) ? worktree : refDir(step === 'lab' ? LINE : versionRef(step)));

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
/** 여러 문장을 한 번에 보낸다 - VS Code 확장에서 파일을 통째로 실행하는 것과 같다. 마지막 문장의 결과를 돌려준다. */
const runSqlFile = async (name, sql) => {
  const client = new pg.Client({ ...ADMIN, database: name });
  await client.connect();
  try {
    const results = await client.query(sql);
    return [results].flat().at(-1).rows;
  } finally {
    await client.end();
  }
};
/** SQL 을 보내고 실패면 그 에러를 돌려준다 - 성공이면 null. */
const failOf = async (name, sql) => {
  try {
    await onDb(name, sql);
    return null;
  } catch (error) {
    return { code: error.code, constraint: error.constraint, message: error.message, detail: error.detail };
  }
};
const dropDb = (name) => admin(async (client) => {
  await kick(client, name);
  await client.query(`DROP DATABASE IF EXISTS ${name}`);
});
/** 템플릿 DB 를 복사한 판정 DB - 판마다 새로 세운다. */
const freshDb = (name = GATE_DB) => admin(async (client) => {
  await kick(client, name);
  await client.query(`DROP DATABASE IF EXISTS ${name}`);
  await kick(client, TPL_DB);
  await client.query(`CREATE DATABASE ${name} TEMPLATE ${TPL_DB}`);
});

const studentDir = (from) => {
  const dir = mkdtempSync(join(tmpdir(), 'p370-srv-'));
  for (const name of STUDENT_FILES) {
    if (existsSync(from(name))) cpSync(from(name), join(dir, name), { recursive: true });
  }
  symlinkSync(P('node_modules'), join(dir, 'node_modules'));
  dirs.push(dir);
  return dir;
};
/** 그 판의 마이그레이션을 판정 DB 에 건다 - 학생이 `npx prisma migrate dev` 로 거는 것과 같은 SQL 파일들. */
const migrate = (from, db) => execFileSync(P('node_modules/.bin/prisma'), ['migrate', 'deploy'], {
  cwd: studentDir(from), env: { ...process.env, DATABASE_URL: dbUrl(db) }, encoding: 'utf8', stdio: 'pipe',
});
const replaceIn = (dir, rel, a, b) => {
  const file = join(dir, rel);
  const source = read(file);
  if (source.split(a).length !== 2) throw new Error(`${rel} 에서 바꿀 글자가 없거나 여럿이다: ${a}`);
  writeFileSync(file, source.replace(a, b));
};
/** 쿼리 로그를 켠 사본 - db.js 한 줄만 바꾼다. */
const withQueryLog = (dir) => replaceIn(dir, 'db.js', 'new PrismaClient({ adapter })', "new PrismaClient({ adapter, log: ['query'] })");
const queryLines = (text) => text.split('\n').filter((line) => line.startsWith('prisma:query'));

/** 학생 폴더 사본 `dir` 의 app.js 를 `db` 로 띄운다. */
const bootIn = async (dir, db, fn, { port = PORT, extraEnv = {} } = {}) => {
  const srv = await boot(join(dir, 'app.js'), {
    port, cwd: dir, env: { ...env, DATABASE_URL: dbUrl(db), PORT: String(port), ...extraEnv }, ready: `${port}번 포트에서`,
  });
  try {
    return await fn({ ...srv, dir, base: `http://localhost:${port}` });
  } finally {
    await Promise.race([srv.stop(), new Promise((r) => setTimeout(r, 500))]);
  }
};
// 🚨 Prisma 클라이언트는 node_modules 안에 하나뿐이다 - 판마다 그 판의 schema.prisma 로 다시 만든다.
let generated = null;
const generateFor = (from) => {
  const schema = read(from('prisma/schema.prisma'));
  if (generated === schema) return;
  execFileSync(P('node_modules/.bin/prisma'), ['generate'], {
    cwd: studentDir(from), env: { ...process.env, DATABASE_URL: dbUrl(GATE_DB) }, stdio: 'pipe',
  });
  generated = schema;
};
/** 그 Step 의 판 - 판정 DB 를 새로 세우고 그 판의 마이그레이션을 건 뒤 띄운다. `edit(dir)` 로 사본을 고칠 수 있다. */
const serve = async (step, fn, { edit = null, fresh = true, port = PORT, env: extraEnv = {} } = {}) => {
  const from = version(step);
  generateFor(from);
  if (fresh) await freshDb();
  if (step !== 'start') migrate(from, GATE_DB);
  const dir = studentDir(from);
  if (edit) edit(dir);
  return bootIn(dir, GATE_DB, fn, { port, extraEnv });
};

const PASSWORDS = { jaehoon: 'jaehoon1234', seoyeon: 'instagram1234', doyun: 'instagram1234', boram: 'boram1234', jiwon: 'jiwon1234', 'admin.hong': 'admin1234!' };
/** 쿠키를 기억하는 탭 하나 - Access 토큰 쿠키만 기억한다. */
const browser = (url) => {
  const jar = new Map();
  const send = async (method, path, body) => {
    const headers = {};
    let payload;
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    if (jar.size > 0) headers.Cookie = [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
    const res = await fetch(`${url}${path}`, { method, headers, redirect: 'manual', body: payload });
    for (const line of res.headers.getSetCookie()) {
      const [pair] = line.split(';');
      const at = pair.indexOf('=');
      const [name, value] = [pair.slice(0, at), pair.slice(at + 1)];
      if (name !== 'accessToken') continue;
      if (value === '' || /Expires=Thu, 01 Jan 1970/.test(line)) jar.delete(name);
      else jar.set(name, value);
    }
    const text = await res.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = text; }
    return { status: res.status, headers: res.headers, body: parsed };
  };
  return { send, get: (path) => send('GET', path), cookie: () => [...jar].map(([n, v]) => `${n}=${v}`).join('; ') };
};
const loggedIn = async (url, username) => {
  const tab = browser(url);
  const res = await tab.send('POST', '/api/v2/auth/login', { username, password: PASSWORDS[username] });
  expect([username, res.status]).toEqual([username, 200]);
  return tab;
};
const brief = (res) => ({ status: res.status, body: res.body });
// 판마다 컬럼이 다르다(Step 3 · 4 가 원인 컬럼을 더한다) - 없는 컬럼은 undefined 로 둔다.
const notifRows = async (db = GATE_DB) => (await onDb(db, 'SELECT *, type::text AS type FROM notifications ORDER BY id'))
  .map(({ id, type, receiver_id, sender_id, post_id, post_like_id, comment_id, follow_id, is_read }) => ({ id, type, receiver_id, sender_id, post_id, post_like_id, comment_id, follow_id, is_read }));
const short = (rows) => rows.map((r) => [r.id, r.type, r.receiver_id, r.sender_id]);
const seen = {};

beforeAll(async () => {
  const fixture = read(FIXTURE).split('\n').filter((line) => !line.startsWith('\\')).join('\n');
  await dropDb(GATE_DB);
  await admin(async (client) => {
    await kick(client, TPL_DB);
    await client.query(`DROP DATABASE IF EXISTS ${TPL_DB}`);
    await client.query(`CREATE DATABASE ${TPL_DB}`);
  });
  const client = new pg.Client({ ...ADMIN, database: TPL_DB });
  await client.connect();
  try {
    await client.query(fixture);
  } finally {
    await client.end();
  }
}, 60_000);

afterAll(async () => {
  if (process.env.P370_SEEN) writeFileSync(process.env.P370_SEEN, JSON.stringify(seen, null, 2));
  if (!process.env.P370_KEEP) await dropDb(GATE_DB);
  await dropDb(TPL_DB);
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});



const OLD_MESSAGE = '사용자 이름이나 비밀번호가 맞지 않아요';
const NEW_MESSAGE = '계정이나 비밀번호가 맞지 않아요';
const login = (url, username, password) => browser(url).send('POST', '/api/v2/auth/login', { username, password });
const signup = (url, body) => browser(url).send('POST', '/api/v2/auth/signup', body);
const HANA = { emailOrPhone: 'hana@example.com', name: '한하나', username: '01012345678', password: 'hana1234' };

describe('축 ⓪ 판정 DB - p3-69 를 마친 학생 DB', () => {
  it('seoyeon 은 이메일 · admin.hong 은 휴대폰 번호 · 둘 다 비밀번호가 있다', async () => {
    await freshDb();
    const rows = await onDb(GATE_DB, "SELECT username, email, phone, password_hash IS NOT NULL AS has_hash FROM users WHERE username IN ('seoyeon', 'admin.hong', 'jaehoon') ORDER BY id");
    expect(rows).toEqual([
      { username: 'jaehoon', email: null, phone: null, has_hash: true },
      { username: 'seoyeon', email: 'seoyeon@example.com', phone: null, has_hash: true },
      { username: 'admin.hong', email: null, phone: '01077771234', has_hash: true },
    ]);
  });
});

describe('축 ① 이어진 흐름 - Step 2 → 3', () => {
  it('시작 판 - 이메일로는 401(사용자 이름으로만 찾는다) · 사용자 이름으로는 200', async () => {
    await serve('start', async ({ base }) => {
      const byEmail = await login(base, 'seoyeon@example.com', 'instagram1234');
      expect(brief(byEmail)).toMatchObject({ status: 401, body: { error: { code: 'LOGIN_FAILED', message: OLD_MESSAGE } } });
      const byPhone = await login(base, '010-7777-1234', 'admin1234!');
      expect(byPhone.status).toBe(401);
      expect((await login(base, 'seoyeon', 'instagram1234')).status).toBe(200);
    });
  });

  it('Step 2 - 이메일 · 하이픈 있는 번호 · 하이픈 없는 번호 · 사용자 이름 모두 200 · 틀리면 401', async () => {
    await serve(2, async ({ base }) => {
      const byEmail = await login(base, 'seoyeon@example.com', 'instagram1234');
      expect([byEmail.status, byEmail.body.data.username]).toEqual([200, 'seoyeon']);
      const byPhone = await login(base, '010-7777-1234', 'admin1234!');
      expect([byPhone.status, byPhone.body.data.username]).toEqual([200, 'admin.hong']);
      expect((await login(base, '01077771234', 'admin1234!')).body.data.username).toBe('admin.hong');
      expect((await login(base, 'jaehoon', 'jaehoon1234')).status).toBe(200);
      expect((await login(base, 'seoyeon@example.com', 'instagram1235')).status).toBe(401);
      expect((await login(base, 'nobody@example.com', 'instagram1234')).status).toBe(401);
      expect((await login(base, '010-0000-0000', 'admin1234!')).status).toBe(401);
    });
  });

  it('Step 2 - 낮은 cost 해시도 이메일 로그인에서 다시 만든다(setPassword 는 사용자 이름으로)', async () => {
    await serve(2, async ({ base }) => {
      const bcrypt = (await import('bcrypt')).default;
      const low = await bcrypt.hash('instagram1234', 4);
      await onDb(GATE_DB, "UPDATE users SET password_hash = $1 WHERE username = 'seoyeon'", [low]);
      const res = await login(base, 'seoyeon@example.com', 'instagram1234');
      expect(res.status).toBe(200);
      const [{ password_hash: hash }] = await onDb(GATE_DB, "SELECT password_hash FROM users WHERE username = 'seoyeon'");
      expect(bcrypt.getRounds(hash)).toBe(12);
    });
  });

  it('Step 2 판 - 휴대폰 번호 모양의 사용자 이름으로 가입은 되는데 그 이름으로는 로그인이 안 된다', async () => {
    await serve(2, async ({ base }) => {
      const res = await signup(base, HANA);
      expect(res.status).toBe(201);
      expect((await login(base, '01012345678', 'hana1234')).status).toBe(401);
      expect((await login(base, 'hana@example.com', 'hana1234')).status).toBe(200);
    });
  });

  it('Step 3 - (Step 2 판 겪기를 마친 DB 그대로) 휴대폰 번호 모양의 사용자 이름은 400 · 이미 든 행은 그대로 · 숫자만이어도 번호 모양이 아니면 된다 · 실패 문장', async () => {
    await serve(3, async ({ base }) => {
      const res = await signup(base, HANA);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
      expect(res.body.error.details.properties.username.errors).toEqual(['휴대폰 번호 모양은 사용자 이름으로 쓸 수 없어요']);
      // 규칙은 앞으로 들어올 값만 막는다 - 겪기 때 들어간 행은 남아 있고, 이메일로는 로그인된다.
      expect(await onDb(GATE_DB, "SELECT username FROM users WHERE email = 'hana@example.com'")).toEqual([{ username: '01012345678' }]);
      expect((await login(base, '01012345678', 'hana1234')).status).toBe(401);
      expect((await login(base, 'hana@example.com', 'hana1234')).status).toBe(200);
      const digits = await signup(base, { ...HANA, emailOrPhone: 'hana2@example.com', username: '12345678' });
      expect(digits.status).toBe(201);
      expect((await login(base, '12345678', 'hana1234')).status).toBe(200);
      const fail = await login(base, 'seoyeon@example.com', 'wrong-password');
      expect(brief(fail)).toMatchObject({ status: 401, body: { error: { code: 'LOGIN_FAILED', message: NEW_MESSAGE } } });
    }, { fresh: false });
  });
});

/** 그 탭의 쿠키로 연결을 연다 - 연결되면 socket, 거절되면 그 에러(err.data 포함)를 돌려준다. */
const tryConnect = (base, cookie) => new Promise((done) => {
  const socket = connectIo(base, { extraHeaders: { cookie }, transports: ['websocket'], reconnection: false });
  socket.on('connect', () => done({ socket, error: null }));
  socket.on('connect_error', (error) => done({ socket, error }));
});
const fullJar = async (url, username) => {
  const jar = new Map();
  const send = async (method, path, body) => {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (jar.size > 0) headers.Cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
    const res = await fetch(`${url}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    for (const line of res.headers.getSetCookie()) {
      const [pair] = line.split(';');
      const at = pair.indexOf('=');
      jar.set(pair.slice(0, at), pair.slice(at + 1));
    }
    let parsed = null;
    try { parsed = await res.json(); } catch { /* 본문 없음 */ }
    return { status: res.status, body: parsed };
  };
  await send('POST', '/api/v2/auth/login', { username, password: PASSWORDS[username] });
  return { send, cookie: () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ') };
};
const tokenSpan = (cookie) => {
  const token = cookie.split('; ').find((c) => c.startsWith('accessToken=')).slice('accessToken='.length);
  const { iat, exp } = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  return exp - iat;
};

describe('축 ② Step 4 - .env 의 ACCESS_TOKEN_SECONDS', () => {
  it('Step 3 판(값 없음) 토큰은 900초 · Step 4 판도 값이 없으면 900초', async () => {
    await serve(3, async ({ base }) => {
      expect(tokenSpan((await fullJar(base, 'jaehoon')).cookie())).toBe(900);
    });
    await serve(4, async ({ base }) => {
      expect(tokenSpan((await fullJar(base, 'jaehoon')).cookie())).toBe(900);
    });
  });

  it('Step 4 판 2초 - 열린 연결은 그대로 · 새 연결은 TOKEN_EXPIRED 로 거절 · 재발급 뒤에는 열린다', async () => {
    await serve(4, async ({ base }) => {
      const tab = await fullJar(base, 'jaehoon');
      expect(tokenSpan(tab.cookie())).toBe(2);
      const first = await tryConnect(base, tab.cookie());
      expect(first.error).toBe(null);
      await new Promise((r) => setTimeout(r, 3000));
      expect(first.socket.connected).toBe(true);
      expect((await tab.send('GET', '/api/v2/auth/me')).body.error.code).toBe('TOKEN_EXPIRED');
      const second = await tryConnect(base, tab.cookie());
      expect([second.error?.message, second.error?.data]).toEqual(['토큰의 기한이 지났어요', { code: 'TOKEN_EXPIRED' }]);
      expect(second.socket.active).toBe(false);
      expect((await tab.send('POST', '/api/v2/auth/reissue')).status).toBe(200);
      const third = await tryConnect(base, tab.cookie());
      expect(third.error).toBe(null);
      for (const s of [first, second, third]) s.socket.close();
    }, { env: { ACCESS_TOKEN_SECONDS: '2' } });
  });
});
