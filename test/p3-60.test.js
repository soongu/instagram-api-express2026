// p3-60 「팔로우」 게이트 - 백엔드(교안 Step 1 · 2 · 3 · 4 · 5)
// 내부 검증 전용 - 교안에 한 줄도 인용하지 않는다.
//
// `8-fullstack-features` 열둘째 회차다(`curriculum.md` 「`p3-60` 착수 결정」 ①~⑨).
// 백엔드의 시작 판은 code/p3-59(774f7ec)의 학생 파일이다.
// 커밋 - Step 1(follows 테이블) · Step 2(CHECK 마이그레이션) · Step 3(PUT·DELETE 멱등 - 숫자는 센다)
//        · Step 4 둘(겪기 판 - 컬럼을 무조건 ±1 / 고친 판 - 바뀐 행이 있을 때만) · Step 5(헤더의 세 값).
//        같은 «(Step N)» 표식이 여럿이면 가장 뒤 feat 커밋이 그 Step 의 끝 판이다.
//        Step 4 의 겪기 판은 «(Step 4 겪기)» 표식이다.
// 🔑 포트 - 3990 · 3991 · `P360_PORT` 로 바꾼다. DB - `p360_api_` 로 시작하는 것만 만들고 지운다.
//    PostgreSQL 은 `P360_PG_PORT`(기본 5551 - 판정용 컨테이너 p360-db).
// 🔑 판정 DB 는 «p3-59 를 마친 학생 DB» `test/fixtures/p3-59-end.sql` 이다 - 사람 22명 · follows 없음.
//
// 축 ⓪ 판정 DB · 축 ① Step 1 follows 테이블 · 축 ② Step 2 자기 자신 · 축 ③ Step 3 팔로우와 취소
// 축 ④ Step 4 팔로워 수 컬럼(겪기 판 · 고친 판 · 동시 요청 · 데이터 채우기 SQL) · 축 ⑤ Step 5 헤더의 세 값
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, cpSync, symlinkSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import pg from 'pg';
import { boot } from './helpers/boot.js';

const ROOT = new URL('../', import.meta.url);
const P = (rel) => new URL(rel, ROOT).pathname;
const read = (path) => readFileSync(path, 'utf8');
const PG_PORT = Number(process.env.P360_PG_PORT ?? 5551);
const ADMIN = { host: 'localhost', port: PG_PORT, database: 'postgres', user: 'postgres', password: 'postgres' };
const DB_PREFIX = process.env.P360_DB_PREFIX ?? 'p360_api';
const TPL_DB = `${DB_PREFIX}_tpl`;
const GATE_DB = `${DB_PREFIX}_gate`;
const dbUrl = (name) => `postgresql://postgres:postgres@localhost:${PG_PORT}/${name}`;
const PORT = Number(process.env.P360_PORT ?? 3990);
const SECRET = 'q2Xh0v9bGm4RkT7sYp1wLc8nZf3uJd6eHa5iVo0rQyE';
const env = {
  CORS_ORIGIN: 'http://localhost:3001', JWT_SECRET: SECRET,
  GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret', SITE_URL: `http://localhost:${PORT}`,
  KAKAO_CLIENT_ID: 'test-kakao', KAKAO_CLIENT_SECRET: 'test-kakao-secret',
  NAVER_CLIENT_ID: 'test-naver', NAVER_CLIENT_SECRET: 'test-naver-secret',
};
const STUDENT_FILES = ['app.js', 'db.js', 'errors.js', 'responses.js', 'routes', 'controllers', 'services', 'middlewares', 'schemas', 'strategies', 'docs', 'utils', 'package.json', 'requests', 'seed.js', 'data', 'prisma', 'prisma.config.js', '.env.example', 'lab'];
const FIXTURE = P('test/fixtures/p3-59-end.sql');

const git = (args) => execFileSync('git', args, { cwd: P('.'), encoding: 'utf8', maxBuffer: 1 << 28 });
const hasRef = (ref) => {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', ref], { cwd: P('.'), stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
};
// 🔑 판의 선 - 북마크 code/p3-60 이 있으면 그것, 없으면 지금 체크아웃한 선(HEAD). `P360_LINE` 으로 바꾼다.
const LINE = process.env.P360_LINE ?? (hasRef('refs/heads/code/p3-60') ? 'code/p3-60' : 'HEAD');
const WT = process.env.P360_WT ?? null;
const START = process.env.P360_BASE ?? 'code/p3-59';
/** «(표식)» 이 붙은 그 회차 커밋들 - 새것부터. */
const markCommits = (mark) => {
  const log = git(['log', '-n', '200', '--format=%H %s', LINE]);
  return log.split('\n').filter((l) => / feat\(p3-60\): /.test(l) && l.endsWith(`(${mark})`)).map((l) => l.split(' ')[0]);
};
const MARKS = { 1: 'Step 1', 2: 'Step 2', 3: 'Step 3', '4a': 'Step 4 겪기', 4: 'Step 4', 5: 'Step 5' };
const dirs = [];
const refDirs = new Map();
const refDir = (ref) => {
  if (refDirs.has(ref)) return refDirs.get(ref);
  const dir = mkdtempSync(join(tmpdir(), 'p360-ref-'));
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
  if (commits.length === 0) throw new Error(`p3-60 (${MARKS[step]}) 커밋이 없다`);
  return commits[0];
};
/** 그 Step 의 끝 판 - `P360_WT` 가 그 Step 이면 작업트리. */
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
    return { code: error.code, constraint: error.constraint, message: error.message };
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
  const dir = mkdtempSync(join(tmpdir(), 'p360-srv-'));
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
const bootIn = async (dir, db, fn, { port = PORT } = {}) => {
  const srv = await boot(join(dir, 'app.js'), {
    port, cwd: dir, env: { ...env, DATABASE_URL: dbUrl(db), PORT: String(port) }, ready: `${port}번 포트에서`,
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
const serve = async (step, fn, { edit = null, fresh = true, port = PORT } = {}) => {
  const from = version(step);
  generateFor(from);
  if (fresh) await freshDb();
  if (step !== 'start') migrate(from, GATE_DB);
  const dir = studentDir(from);
  if (edit) edit(dir);
  return bootIn(dir, GATE_DB, fn, { port });
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
const FOLLOW = (name) => `/api/v2/profiles/${name}/followers/me`;
const follow = (tab, name) => tab.send('PUT', FOLLOW(name));
const unfollow = (tab, name) => tab.send('DELETE', FOLLOW(name));
const brief = (res) => ({ status: res.status, body: res.body });
const errOf = (res) => [res.status, res.body.error?.code];

const MINJI_ID = 3;
const JAEHOON_ID = 2;
const followRows = (db = GATE_DB) => onDb(db, 'SELECT follower_id, following_id FROM follows ORDER BY id');
const followerCountOf = async (username, db = GATE_DB) => (await onDb(db, 'SELECT follower_count FROM users WHERE username = $1', [username]))[0].follower_count;

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
  await dropDb(GATE_DB);
  await dropDb(TPL_DB);
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

describe('축 ⓪ 판정 DB - p3-59 를 마친 학생 DB', () => {
  it('사람 22명 · follows 테이블이 아직 없다 · minji 는 3번 · jaehoon 은 2번', async () => {
    await freshDb();
    expect((await onDb(GATE_DB, 'SELECT count(*)::int AS n FROM users'))[0].n).toBe(22);
    expect(await onDb(GATE_DB, "SELECT to_regclass('public.follows') AS t")).toEqual([{ t: null }]);
    expect(await onDb(GATE_DB, "SELECT id, username FROM users WHERE username IN ('jaehoon', 'minji') ORDER BY id"))
      .toEqual([{ id: JAEHOON_ID, username: 'jaehoon' }, { id: MINJI_ID, username: 'minji' }]);
  });
});

describe('축 ① Step 1 - follows 테이블', () => {
  it('마이그레이션 add_follows - 두 컬럼이 모두 users 를 가리키고(Cascade) · 짝이 UNIQUE · created_at 이 있다', async () => {
    const from = version(1);
    const names = readdirSync(from('prisma/migrations')).filter((n) => /add_follows$/.test(n));
    expect(names).toHaveLength(1);
    const sql = read(from(`prisma/migrations/${names[0]}/migration.sql`));
    expect(sql).toContain('CREATE TABLE "follows"');
    expect(sql).toContain('CREATE UNIQUE INDEX "follows_follower_id_following_id_key" ON "follows"("follower_id", "following_id");');
    expect(sql).toContain('ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;');
    expect(sql).toContain('ALTER TABLE "follows" ADD CONSTRAINT "follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;');
    expect(sql).toContain('"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP');
  });

  it('같은 짝은 두 번 못 넣는다(23505) · 이 판에서는 자기 자신 행이 들어간다 · 사람을 지우면 팔로우 행도 사라진다', async () => {
    await freshDb();
    migrate(version(1), GATE_DB);
    await onDb(GATE_DB, 'INSERT INTO follows (follower_id, following_id) VALUES (2, 3)');
    const twice = await failOf(GATE_DB, 'INSERT INTO follows (follower_id, following_id) VALUES (2, 3)');
    expect([twice.code, twice.constraint]).toEqual(['23505', 'follows_follower_id_following_id_key']);
    expect(await failOf(GATE_DB, 'INSERT INTO follows (follower_id, following_id) VALUES (2, 2)')).toBe(null);
    await onDb(GATE_DB, "INSERT INTO follows (follower_id, following_id) SELECT id, 3 FROM users WHERE username = 'boram'");
    await onDb(GATE_DB, "DELETE FROM users WHERE username = 'boram'");
    expect(await followRows()).toEqual([{ follower_id: 2, following_id: 3 }, { follower_id: 2, following_id: 2 }]);
  });

  it('seed.js 의 TRUNCATE 목록에 follows 가 있다 - 빠지면 시드가 0A000 으로 멈춘다', async () => {
    const from = version(1);
    expect(read(from('seed.js'))).toMatch(/TRUNCATE TABLE follows, /);
    await freshDb();
    migrate(from, GATE_DB);
    const dir = studentDir(from);
    const childEnv = { ...process.env, DATABASE_URL: dbUrl(GATE_DB) };
    delete childEnv.NODE_ENV;
    generateFor(from);
    const out = execFileSync(process.execPath, [join(dir, 'seed.js')], { cwd: dir, env: childEnv, encoding: 'utf8' });
    expect(out).toContain('사람 ');
    // 빠진 판 - follows 를 목록에서 빼면 users 를 못 비운다.
    replaceIn(dir, 'seed.js', 'TRUNCATE TABLE follows, ', 'TRUNCATE TABLE ');
    let error = '';
    try {
      execFileSync(process.execPath, [join(dir, 'seed.js')], { cwd: dir, env: childEnv, encoding: 'utf8', stdio: 'pipe' });
    } catch (e) {
      error = String(e.stderr);
    }
    expect(error).toContain('0A000');
  }, 60_000);
});

describe('축 ② Step 2 - 자기 자신', () => {
  it('Prisma 스키마에 @@check 를 적으면 P1012 Attribute not known', () => {
    const dir = studentDir(version(2));
    replaceIn(dir, 'prisma/schema.prisma', '  @@unique([followerId, followingId])\n', '  @@unique([followerId, followingId])\n  @@check("follower_id <> following_id")\n');
    let out = '';
    try {
      execFileSync(P('node_modules/.bin/prisma'), ['validate'], { cwd: dir, env: { ...process.env, DATABASE_URL: dbUrl(GATE_DB), NO_COLOR: '1' }, encoding: 'utf8', stdio: 'pipe' });
    } catch (e) {
      out = String(e.stdout) + String(e.stderr);
    }
    expect(out).toContain('P1012');
    expect(out).toContain('Attribute not known: "@check".');
  });

  it('손으로 적은 마이그레이션 - 빈 마이그레이션에 CHECK 한 줄 · SQL 로 자기 자신을 넣으면 23514 follows_not_self', async () => {
    const from = version(2);
    const names = readdirSync(from('prisma/migrations')).filter((n) => /follows_not_self$/.test(n));
    expect(names).toHaveLength(1);
    expect(read(from(`prisma/migrations/${names[0]}/migration.sql`)))
      .toContain('ALTER TABLE "follows" ADD CONSTRAINT "follows_not_self" CHECK ("follower_id" <> "following_id");');
    await freshDb();
    migrate(from, GATE_DB);
    const self = await failOf(GATE_DB, 'INSERT INTO follows (follower_id, following_id) VALUES (2, 2)');
    expect(self.code).toBe('23514');
    expect(self.constraint).toBe('follows_not_self');
    expect(self.message).toBe('new row for relation "follows" violates check constraint "follows_not_self"');
  });

  it('서비스를 거치지 않은 prisma.follow.create 도 막힌다 - P2039 · 원인 23514', async () => {
    const from = version(2);
    await freshDb();
    migrate(from, GATE_DB);
    generateFor(from);
    const dir = studentDir(from);
    writeFileSync(join(dir, 'probe.js'), [
      "import { prisma } from './db.js';",
      'try {',
      '  await prisma.follow.create({ data: { followerId: 2, followingId: 2 } });',
      '} catch (error) {',
      '  console.log(JSON.stringify({ code: error.code, cause: error.meta.driverAdapterError.cause.code, message: error.message }));',
      '}',
      'await prisma.$disconnect();',
    ].join('\n'));
    const childEnv = { ...process.env, DATABASE_URL: dbUrl(GATE_DB) };
    delete childEnv.NODE_ENV;
    const out = JSON.parse(execFileSync(process.execPath, [join(dir, 'probe.js')], { cwd: dir, env: childEnv, encoding: 'utf8' }));
    expect([out.code, out.cause]).toEqual(['P2039', '23514']);
    expect(out.message).toContain('Database error. Code: `23514`. Message: `new row for relation "follows" violates check constraint "follows_not_self"`');
  });

  it('다음 migrate dev 는 CHECK 를 drift 로 보지 않는다 - Already in sync', async () => {
    const from = version(2);
    await freshDb();
    migrate(from, GATE_DB);
    const dir = studentDir(from);
    const out = execFileSync(P('node_modules/.bin/prisma'), ['migrate', 'dev'], {
      cwd: dir, env: { ...process.env, DATABASE_URL: dbUrl(GATE_DB), NO_COLOR: '1' }, encoding: 'utf8', stdio: 'pipe',
    });
    expect(out).toContain('Already in sync, no schema change or pending migration was found.');
  }, 60_000);
});

describe('축 ③ Step 3 - 팔로우와 취소', () => {
  it('시작 판에는 주소가 없다 - 404 ROUTE_NOT_FOUND', async () => {
    await serve('start', async ({ base }) => {
      const tab = await loggedIn(base, 'jaehoon');
      expect(errOf(await follow(tab, 'minji'))).toEqual([404, 'ROUTE_NOT_FOUND']);
    });
  });

  it('PUT 두 번 · DELETE 두 번 - 둘 다 멱등 · 행은 하나만 생기고 지워진다 · 팔로워 수는 행을 센다', async () => {
    await serve(3, async ({ base }) => {
      const tab = await loggedIn(base, 'jaehoon');
      expect(brief(await follow(tab, 'minji'))).toEqual({ status: 200, body: { data: { following: true, followerCount: 1 } } });
      expect(brief(await follow(tab, 'minji'))).toEqual({ status: 200, body: { data: { following: true, followerCount: 1 } } });
      expect(await followRows()).toEqual([{ follower_id: JAEHOON_ID, following_id: MINJI_ID }]);
      const seoyeon = await loggedIn(base, 'seoyeon');
      expect((await follow(seoyeon, 'minji')).body).toEqual({ data: { following: true, followerCount: 2 } });
      expect(brief(await unfollow(tab, 'minji'))).toEqual({ status: 200, body: { data: { following: false, followerCount: 1 } } });
      expect(brief(await unfollow(tab, 'minji'))).toEqual({ status: 200, body: { data: { following: false, followerCount: 1 } } });
      expect(await followRows()).toEqual([{ follower_id: 43, following_id: MINJI_ID }]);
    });
  });

  it('나 자신 400 CANNOT_FOLLOW_SELF(PUT · DELETE) · 없는 사람 404 USER_NOT_FOUND · 로그인 안 하면 401 · GET 은 405 Allow: PUT, DELETE', async () => {
    await serve(3, async ({ base }) => {
      const tab = await loggedIn(base, 'jaehoon');
      const self = await follow(tab, 'jaehoon');
      expect(errOf(self)).toEqual([400, 'CANNOT_FOLLOW_SELF']);
      expect(self.body.error.message).toBe('나 자신은 팔로우할 수 없어요');
      expect(errOf(await unfollow(tab, 'jaehoon'))).toEqual([400, 'CANNOT_FOLLOW_SELF']);
      const nobody = await follow(tab, 'nobody');
      expect(errOf(nobody)).toEqual([404, 'USER_NOT_FOUND']);
      expect(nobody.body.error.message).toBe('그런 사용자는 없어요');
      expect(errOf(await unfollow(tab, 'nobody'))).toEqual([404, 'USER_NOT_FOUND']);
      expect(errOf(await follow(browser(base), 'minji'))).toEqual([401, 'LOGIN_REQUIRED']);
      const get = await tab.get(FOLLOW('minji'));
      expect([get.status, get.headers.get('allow'), get.body.error.code]).toEqual([405, 'PUT, DELETE', 'METHOD_NOT_ALLOWED']);
      expect(await followRows()).toEqual([]);
    });
  });

  it('createMany skipDuplicates 는 ON CONFLICT DO NOTHING 한 문장 · deleteMany 는 DELETE 한 문장', async () => {
    await serve(3, async ({ base, tail }) => {
      const tab = await loggedIn(base, 'jaehoon');
      const before = queryLines(tail()).length;
      await follow(tab, 'minji');
      const put = queryLines(tail()).slice(before);
      await unfollow(tab, 'minji');
      const del = queryLines(tail()).slice(before + put.length);
      expect(put).toEqual([
        expect.stringMatching(/^prisma:query SELECT "public"\."users"\."id" FROM "public"\."users" WHERE \("public"\."users"\."username" = \$1 AND 1=1\) LIMIT \$2 OFFSET \$3$/),
        'prisma:query INSERT INTO "public"."follows" ("follower_id","following_id","created_at") VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
        expect.stringMatching(/^prisma:query SELECT COUNT\(\*\) AS "_count\$_all" FROM \(SELECT "public"\."follows"\."id" FROM "public"\."follows" WHERE "public"\."follows"\."following_id" = \$1 OFFSET \$2\) AS "sub"$/),
      ]);
      expect(del[1]).toBe('prisma:query DELETE FROM "public"."follows" WHERE ("public"."follows"."follower_id" = $1 AND "public"."follows"."following_id" = $2)');
      expect(del).toHaveLength(3);
    }, { edit: withQueryLog });
  });
});

const FOLLOWS_SQL = (from) => read(from('lab/p3-60/follows.sql'));
/** 같은 사람이 두 탭에서 «동시에» 같은 요청을 보낸다 - 다섯 번 해서 그때마다 끝 숫자를 모은다. */
const raceTwice = async (base, method) => {
  const results = [];
  for (let i = 0; i < 5; i += 1) {
    const a = await loggedIn(base, 'jaehoon');
    const b = await loggedIn(base, 'jaehoon');
    await unfollow(a, 'minji');
    await onDb(GATE_DB, 'UPDATE users SET follower_count = 0 WHERE id = $1', [MINJI_ID]);
    await Promise.all([a.send(method, FOLLOW('minji')), b.send(method, FOLLOW('minji'))]);
    results.push([(await followRows()).length, await followerCountOf('minji')]);
  }
  return results;
};

describe('축 ④ Step 4 - 팔로워 수는 컬럼으로', () => {
  it('마이그레이션 add_user_follower_count - ADD COLUMN follower_count INTEGER NOT NULL DEFAULT 0 · users 에는 updated_at 이 없다', async () => {
    const from = version(4);
    const names = readdirSync(from('prisma/migrations')).filter((n) => /add_user_follower_count$/.test(n));
    expect(names).toHaveLength(1);
    expect(read(from(`prisma/migrations/${names[0]}/migration.sql`)))
      .toBe('-- AlterTable\nALTER TABLE "users" ADD COLUMN     "follower_count" INTEGER NOT NULL DEFAULT 0;\n');
    await freshDb();
    migrate(from, GATE_DB);
    const cols = await onDb(GATE_DB, "SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name IN ('follower_count', 'updated_at') ORDER BY 1");
    expect(cols).toEqual([{ column_name: 'follower_count' }]);
  });

  it('겪기 판은 스냅숏과 같다 - 고친 판과는 count 를 받는 두 줄 · 넘기는 두 줄 · 주석 두 줄만 다르다', () => {
    const naive = read(version('4a')('services/followService.js'));
    expect(naive.split('\n').slice(1).join('\n')).toBe(read(P('snapshots/p3-60/followService.step4-naive.js')));
    const fixed = read(version(4)('services/followService.js')).split('\n');
    const a = naive.split('\n');
    const changed = fixed.filter((line) => !a.includes(line));
    expect(changed).toEqual([
      '// 이미 팔로우하고 있으면 행이 안 들어가고(count 0), 숫자도 오르지 않는다.',
      '    const { count } = await tx.follow.createMany({',
      '    return changeFollowerCount(tx, followingId, count);',
      '// 팔로우하고 있지 않았으면 지울 행이 없고(count 0), 숫자도 내려가지 않는다.',
      '    const { count } = await tx.follow.deleteMany({ where: { followerId, followingId } });',
      '    return changeFollowerCount(tx, followingId, -count);',
    ]);
  });

  it('겪기 판 - 같은 PUT 두 번에 팔로워가 1 → 2(행은 하나) · DELETE 두 번에 1 → 0 · PUT 한 번 뒤 DELETE 두 번이면 -1', async () => {
    await serve('4a', async ({ base }) => {
      const tab = await loggedIn(base, 'jaehoon');
      expect(brief(await follow(tab, 'minji'))).toEqual({ status: 200, body: { data: { following: true, followerCount: 1 } } });
      expect(brief(await follow(tab, 'minji'))).toEqual({ status: 200, body: { data: { following: true, followerCount: 2 } } });
      expect(await followRows()).toHaveLength(1);
      expect((await unfollow(tab, 'minji')).body.data).toEqual({ following: false, followerCount: 1 });
      expect((await unfollow(tab, 'minji')).body.data).toEqual({ following: false, followerCount: 0 });
      expect((await follow(tab, 'minji')).body.data).toEqual({ following: true, followerCount: 1 });
      expect((await unfollow(tab, 'minji')).body.data).toEqual({ following: false, followerCount: 0 });
      expect((await unfollow(tab, 'minji')).body.data).toEqual({ following: false, followerCount: -1 });
      expect(await followRows()).toEqual([]);
    });
  });

  it('고친 판 - PUT 두 번 1 · 1 · DELETE 두 번 0 · 0 · 숫자 컬럼이 행 수와 같다', async () => {
    await serve(4, async ({ base }) => {
      const tab = await loggedIn(base, 'jaehoon');
      expect(brief(await follow(tab, 'minji'))).toEqual({ status: 200, body: { data: { following: true, followerCount: 1 } } });
      expect(brief(await follow(tab, 'minji'))).toEqual({ status: 200, body: { data: { following: true, followerCount: 1 } } });
      expect(await followerCountOf('minji')).toBe(1);
      expect((await unfollow(tab, 'minji')).body.data).toEqual({ following: false, followerCount: 0 });
      expect((await unfollow(tab, 'minji')).body.data).toEqual({ following: false, followerCount: 0 });
      expect(await followerCountOf('minji')).toBe(0);
      expect(errOf(await follow(tab, 'jaehoon'))).toEqual([400, 'CANNOT_FOLLOW_SELF']);
      expect(errOf(await follow(tab, 'nobody'))).toEqual([404, 'USER_NOT_FOUND']);
    });
  });

  it('고친 판의 쿼리 - INSERT … ON CONFLICT DO NOTHING 과 UPDATE … follower_count + $1 뒤 COMMIT(BEGIN 은 로그에 안 찍힌다)', async () => {
    await serve(4, async ({ base, tail }) => {
      const tab = await loggedIn(base, 'jaehoon');
      const at = queryLines(tail()).length;
      await follow(tab, 'minji');
      const first = queryLines(tail()).slice(at);
      expect(first).toEqual([
        expect.stringMatching(/^prisma:query SELECT "public"\."users"\."id" FROM "public"\."users" WHERE/),
        'prisma:query INSERT INTO "public"."follows" ("follower_id","following_id","created_at") VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
        'prisma:query UPDATE "public"."users" SET "follower_count" = ("public"."users"."follower_count" + $1) WHERE ("public"."users"."id" = $2 AND 1=1) RETURNING "public"."users"."id", "public"."users"."follower_count"',
        'prisma:query COMMIT',
      ]);
    }, { edit: withQueryLog });
  });

  it('동시에 두 PUT(같은 사람 · 두 탭) - 겪기 판은 행 1 · 숫자 2 · 고친 판은 행 1 · 숫자 1(다섯 번 모두)', async () => {
    const naive = await serve('4a', ({ base }) => raceTwice(base, 'PUT'));
    expect(naive).toEqual(Array(5).fill([1, 2]));
    const fixed = await serve(4, ({ base }) => raceTwice(base, 'PUT'));
    expect(fixed).toEqual(Array(5).fill([1, 1]));
  }, 60_000);

  it('데이터 채우기 SQL - 겪기 판이 어긋나게 한 숫자까지 행 수로 맞춘다 · minji 팔로워 20 · jaehoon 팔로워 4 · 팔로잉 4 · 서로 팔로우 셋 · 시각은 모두 다르다 · 두 번 돌려도 같다', async () => {
    const from = version(4);
    await serve('4a', async ({ base }) => {
      const tab = await loggedIn(base, 'jaehoon');
      await follow(tab, 'minji');
      await follow(tab, 'minji');
      await unfollow(tab, 'minji');
    });
    expect([await followerCountOf('minji'), (await followRows()).length]).toEqual([1, 0]);
    const out = await runSqlFile(GATE_DB, FOLLOWS_SQL(from));
    expect(out).toEqual([
      { username: 'jaehoon', follower_count: 4, followers: '4' },
      { username: 'minji', follower_count: 20, followers: '20' },
    ]);
    const counts = async () => onDb(GATE_DB, `
      SELECT count(*)::int AS rows, count(DISTINCT created_at)::int AS times,
             (SELECT count(*)::int FROM users u WHERE u.follower_count <> (SELECT count(*) FROM follows f WHERE f.following_id = u.id)) AS wrong,
             (SELECT count(*)::int FROM follows a JOIN follows b ON a.follower_id = b.following_id AND a.following_id = b.follower_id WHERE a.follower_id < a.following_id) AS mutual,
             (SELECT count(*)::int FROM follows WHERE follower_id = ${JAEHOON_ID}) AS jaehoon_following
      FROM follows`);
    expect(await counts()).toEqual([{ rows: 30, times: 30, wrong: 0, mutual: 3, jaehoon_following: 4 }]);
    await runSqlFile(GATE_DB, FOLLOWS_SQL(from));
    expect(await counts()).toEqual([{ rows: 30, times: 30, wrong: 0, mutual: 3, jaehoon_following: 4 }]);
    expect(await onDb(GATE_DB, `SELECT count(*)::int AS n FROM follows WHERE follower_id = ${JAEHOON_ID} AND following_id = ${MINJI_ID}`)).toEqual([{ n: 0 }]);
  });

  it('데이터를 채운 뒤 jaehoon 이 minji 를 팔로우하면 21 · 취소하면 20', async () => {
    const from = version(4);
    await freshDb();
    migrate(from, GATE_DB);
    await runSqlFile(GATE_DB, FOLLOWS_SQL(from));
    await serve(4, async ({ base }) => {
      const tab = await loggedIn(base, 'jaehoon');
      expect((await follow(tab, 'minji')).body.data).toEqual({ following: true, followerCount: 21 });
      expect((await unfollow(tab, 'minji')).body.data).toEqual({ following: false, followerCount: 20 });
    }, { fresh: false });
  });
});

describe('축 ⑤ Step 5 - 헤더 응답의 세 값', () => {
  /** 데이터를 채운 판정 DB 에 Step 5 판을 띄운다. */
  const filled = async (fn, opts = {}) => {
    const from = version(5);
    await freshDb();
    migrate(from, GATE_DB);
    await runSqlFile(GATE_DB, FOLLOWS_SQL(from));
    return serve(5, fn, { ...opts, fresh: false });
  };

  it('jaehoon 이 minji 를 본다 - 팔로우 전 20 · false → 팔로우 응답 21 → 헤더 21 · true · 팔로잉 3 · 게시물 27', async () => {
    await filled(async ({ base }) => {
      const tab = await loggedIn(base, 'jaehoon');
      const before = await tab.get('/api/v2/profiles/minji');
      expect(before.status).toBe(200);
      expect(before.body.data).toEqual({
        id: MINJI_ID, username: 'minji', name: null, profileImage: 'https://picsum.photos/seed/minji/40/40',
        postCount: 27, followerCount: 20, followingCount: 3, isFollowing: false,
      });
      expect((await follow(tab, 'minji')).body.data).toEqual({ following: true, followerCount: 21 });
      const after = await tab.get('/api/v2/profiles/minji');
      expect(after.body).toEqual({ data: { ...before.body.data, followerCount: 21, isFollowing: true } });
      if (process.env.P360_HEADER_DUMP) writeFileSync(process.env.P360_HEADER_DUMP, JSON.stringify({ before: before.body, after: after.body }, null, 2));
    });
  });

  it('내 프로필은 isFollowing false · jaehoon 의 팔로워 4 · 팔로잉 4 · 다른 사람이 보면 그 사람 기준(seoyeon 은 true · doyun 도 true · admin.hong 은 false)', async () => {
    await filled(async ({ base }) => {
      const me = await loggedIn(base, 'jaehoon');
      expect((await me.get('/api/v2/profiles/jaehoon')).body.data).toMatchObject({ followerCount: 4, followingCount: 4, isFollowing: false });
      const seoyeon = await loggedIn(base, 'seoyeon');
      expect((await seoyeon.get('/api/v2/profiles/jaehoon')).body.data.isFollowing).toBe(true);
      const doyun = await loggedIn(base, 'doyun');
      expect((await doyun.get('/api/v2/profiles/jaehoon')).body.data.isFollowing).toBe(true);
      const admin = await loggedIn(base, 'admin.hong');
      expect((await admin.get('/api/v2/profiles/jaehoon')).body.data.isFollowing).toBe(false);
      expect(errOf(await me.get('/api/v2/profiles/nobody'))).toEqual([404, 'USER_NOT_FOUND']);
    });
  });

  it('헤더 한 번에 쿼리 한 줄 - 게시물 수 · 팔로잉 수 · «내가 팔로우하나» 는 같은 SELECT 의 LEFT JOIN 서브쿼리 셋', async () => {
    await filled(async ({ base, tail }) => {
      const tab = await loggedIn(base, 'jaehoon');
      const at = queryLines(tail()).length;
      await tab.get('/api/v2/profiles/minji');
      const lines = queryLines(tail()).slice(at);
      if (process.env.P360_QUERY_DUMP) writeFileSync(process.env.P360_QUERY_DUMP, lines.join('\n'));
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain('"public"."users"."follower_count"');
      expect(lines[0]).toContain('"public"."follows"."follower_id" = $');
      // 🔑 _count 는 LEFT JOIN 서브쿼리 셋이다 - 게시물 수와 팔로잉 수는 테이블 전체를 GROUP BY 한다(WHERE 1=1).
      expect(lines[0]).toContain('LEFT JOIN (SELECT "public"."posts"."author_id", COUNT(*) AS "_aggr_count_posts" FROM "public"."posts" WHERE 1=1 GROUP BY "public"."posts"."author_id")');
      expect(lines[0]).toContain('LEFT JOIN (SELECT "public"."follows"."follower_id", COUNT(*) AS "_aggr_count_following" FROM "public"."follows" WHERE 1=1 GROUP BY "public"."follows"."follower_id")');
      expect(lines[0]).toContain('LEFT JOIN (SELECT "public"."follows"."following_id", COUNT(*) AS "_aggr_count_followers" FROM "public"."follows" WHERE "public"."follows"."follower_id" = $1 GROUP BY "public"."follows"."following_id")');
    }, { edit: withQueryLog });
  });
});
