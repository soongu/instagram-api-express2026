// p3-61 「팔로워·팔로잉 목록」 게이트 - 백엔드(교안 Step 1 · 2 · 3 · 4)
// 내부 검증 전용 - 교안에 한 줄도 인용하지 않는다.
//
// `8-fullstack-features` 열셋째(마지막) 회차다(`curriculum.md` 「`p3-61` 착수 결정」 ①~⑧).
// 백엔드의 시작 판은 code/p3-60(9754918)의 학생 파일이다.
// 커밋 - Step 1(팔로워 목록 - 한 번에 다) · Step 2 둘(겪기 판 - 참조처럼 마지막 사람 번호가 커서 / 고친 판 - follows 행의 시각과 번호)
//        · Step 3(팔로잉 방향) · Step 4(줄마다 보는 사람 기준 isFollowing).
//        같은 «(Step N)» 표식이 여럿이면 가장 뒤 feat 커밋이 그 Step 의 끝 판이다.
// 🔑 포트 - 3980 · `P361_PORT` 로 바꾼다. DB - `p361_api_` 로 시작하는 것만 만들고 지운다.
//    PostgreSQL 은 `P361_PG_PORT`(기본 5551 - 판정용 컨테이너 p360-db 를 이어 쓴다).
// 🔑 판정 DB 는 «p3-60 을 마친 학생 DB» `test/fixtures/p3-60-end.sql` 이다 - follows 33 · minji 팔로워 21.
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
const PG_PORT = Number(process.env.P361_PG_PORT ?? 5551);
const ADMIN = { host: 'localhost', port: PG_PORT, database: 'postgres', user: 'postgres', password: 'postgres' };
const DB_PREFIX = process.env.P361_DB_PREFIX ?? 'p361_api';
const TPL_DB = `${DB_PREFIX}_tpl`;
const GATE_DB = `${DB_PREFIX}_gate`;
const dbUrl = (name) => `postgresql://postgres:postgres@localhost:${PG_PORT}/${name}`;
const PORT = Number(process.env.P361_PORT ?? 3980);
const SECRET = 'q2Xh0v9bGm4RkT7sYp1wLc8nZf3uJd6eHa5iVo0rQyE';
const env = {
  CORS_ORIGIN: 'http://localhost:3001', JWT_SECRET: SECRET,
  GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret', SITE_URL: `http://localhost:${PORT}`,
  KAKAO_CLIENT_ID: 'test-kakao', KAKAO_CLIENT_SECRET: 'test-kakao-secret',
  NAVER_CLIENT_ID: 'test-naver', NAVER_CLIENT_SECRET: 'test-naver-secret',
};
const STUDENT_FILES = ['app.js', 'db.js', 'errors.js', 'responses.js', 'routes', 'controllers', 'services', 'middlewares', 'schemas', 'strategies', 'docs', 'utils', 'package.json', 'requests', 'seed.js', 'data', 'prisma', 'prisma.config.js', '.env.example', 'lab'];
const FIXTURE = P('test/fixtures/p3-60-end.sql');

const git = (args) => execFileSync('git', args, { cwd: P('.'), encoding: 'utf8', maxBuffer: 1 << 28 });
const hasRef = (ref) => {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', ref], { cwd: P('.'), stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
};
// 🔑 판의 선 - 북마크 code/p3-60 이 있으면 그것, 없으면 지금 체크아웃한 선(HEAD). `P361_LINE` 으로 바꾼다.
const LINE = process.env.P361_LINE ?? (hasRef('refs/heads/code/p3-61') ? 'code/p3-61' : 'HEAD');
const WT = process.env.P361_WT ?? null;
const START = process.env.P361_BASE ?? 'code/p3-60';
/** «(표식)» 이 붙은 그 회차 커밋들 - 새것부터. */
const markCommits = (mark) => {
  const log = git(['log', '-n', '200', '--format=%H %s', LINE]);
  return log.split('\n').filter((l) => / feat\(p3-61\): /.test(l) && l.endsWith(`(${mark})`)).map((l) => l.split(' ')[0]);
};
const MARKS = { 1: 'Step 1', '2a': 'Step 2 겪기', 2: 'Step 2', 3: 'Step 3', 4: 'Step 4' };
const dirs = [];
const refDirs = new Map();
const refDir = (ref) => {
  if (refDirs.has(ref)) return refDirs.get(ref);
  const dir = mkdtempSync(join(tmpdir(), 'p361-ref-'));
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
  if (commits.length === 0) throw new Error(`p3-61 (${MARKS[step]}) 커밋이 없다`);
  return commits[0];
};
/** 그 Step 의 끝 판 - `P361_WT` 가 그 Step 이면 작업트리. */
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
  const dir = mkdtempSync(join(tmpdir(), 'p361-srv-'));
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
const followerCountOf = async (username, db = GATE_DB) => (await onDb(db, 'SELECT follower_count FROM users WHERE username = $1', [username]))[0].follower_count;
const FOLLOWERS = (name, query = '') => `/api/v2/profiles/${name}/followers${query}`;
const FOLLOWING = (name, query = '') => `/api/v2/profiles/${name}/following${query}`;
const names = (items) => items.map((item) => item.username);

// minji 의 팔로워 21명 - 팔로우한 시각 최신순(판정 DB 실측). 사람 번호 차례와 다르다.
const MINJI_FOLLOWERS = [
  'jaehoon', 'admin.hong', 'boram', 'dahye', 'dain', 'doyun', 'haneul', 'haneul2', 'jiho', 'jiwon',
  'kim.minji', 'minji.kim', 'nayeon', 'seoyeon', 'seungwoo', 'sora', 'taeyang', 'yuna', 'yuri01b', 'yuri02b', 'yuri03',
];
// jaehoon 이 팔로우하는 여섯 - doyun 은 p3-60 Step 7 에서 minji 다음에 팔로우했다.
const JAEHOON_FOLLOWING = ['doyun', 'minji', 'dahye', 'seungwoo', 'seoyeon', 'nayeon'];

/** nextCursor 를 따라 끝까지 받는다 - 화면이 하는 것과 같다. */
const walk = async (tab, path, limit) => {
  const pages = [];
  let cursor = null;
  for (let i = 0; i < 30; i += 1) {
    const query = new URLSearchParams({ limit: String(limit), ...(cursor === null ? {} : { cursor: String(cursor) }) });
    const res = await tab.get(`${path}?${query}`);
    expect(res.status).toBe(200);
    pages.push(res.body.data);
    if (!res.body.data.hasNext) return pages;
    cursor = res.body.data.nextCursor;
  }
  throw new Error('끝나지 않는다');
};

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

describe('축 ⓪ 판정 DB - p3-60 을 마친 학생 DB', () => {
  it('follows 33 · minji 팔로워 21 · jaehoon 팔로워 4 · 팔로잉 6 · 팔로우한 시각 차례와 사람 번호 차례가 다르다', async () => {
    await freshDb();
    expect((await onDb(GATE_DB, 'SELECT count(*)::int AS n FROM follows'))[0].n).toBe(33);
    const rows = await onDb(GATE_DB, `SELECT u.username, u.id FROM follows f JOIN users u ON u.id = f.follower_id
      WHERE f.following_id = $1 ORDER BY f.created_at DESC, f.id DESC`, [MINJI_ID]);
    expect(rows.map((r) => r.username)).toEqual(MINJI_FOLLOWERS);
    expect(rows.slice(0, 6).map((r) => r.id)).toEqual([2, 45, 48, 1, 13, 44]);
    const jaehoon = await onDb(GATE_DB, `SELECT u.username FROM follows f JOIN users u ON u.id = f.following_id
      WHERE f.follower_id = $1 ORDER BY f.created_at DESC, f.id DESC`, [JAEHOON_ID]);
    expect(jaehoon.map((r) => r.username)).toEqual(JAEHOON_FOLLOWING);
    expect(await followerCountOf('jaehoon')).toBe(4);
  });
});

describe('축 ① Step 1 - 팔로워 목록(한 번에 다)', () => {
  it('minji 의 팔로워 21명이 팔로우한 시각 최신순 · 한 줄은 id · username · name · profileImage', async () => {
    await serve(1, async ({ base }) => {
      const tab = await loggedIn(base, 'jaehoon');
      const res = await tab.get(FOLLOWERS('minji'));
      expect(res.status).toBe(200);
      expect(names(res.body.data)).toEqual(MINJI_FOLLOWERS);
      expect(Object.keys(res.body.data[0])).toEqual(['id', 'username', 'name', 'profileImage']);
      expect(res.body.data[0]).toMatchObject({ id: JAEHOON_ID, username: 'jaehoon' });
    });
  }, 60_000);

  it('없는 사람 404 USER_NOT_FOUND · 로그인 없이 401 · POST 는 405 + Allow: GET · 팔로우 주소는 그대로', async () => {
    await serve(1, async ({ base }) => {
      expect(errOf(await browser(base).get(FOLLOWERS('minji')))).toEqual([401, 'LOGIN_REQUIRED']);
      const tab = await loggedIn(base, 'jaehoon');
      expect(errOf(await tab.get(FOLLOWERS('nobody')))).toEqual([404, 'USER_NOT_FOUND']);
      const post = await tab.send('POST', FOLLOWERS('minji'));
      expect([post.status, post.headers.get('allow')]).toEqual([405, 'GET']);
      expect(brief(await follow(tab, 'yuna'))).toEqual({ status: 200, body: { data: { following: true, followerCount: 1 } } });
    });
  }, 60_000);
});

describe('축 ② Step 2 - 나눠 받기와 커서', () => {
  it('겪기 판 - 마지막 사람 번호를 커서로 쓰면 jaehoon 이 세 번 나오고 doyun 은 한 번도 안 나온다', async () => {
    await serve('2a', async ({ base }) => {
      const tab = await loggedIn(base, 'jaehoon');
      const one = await tab.get(FOLLOWERS('minji', '?limit=5'));
      expect(one.body.data).toMatchObject({ hasNext: true, nextCursor: 13 });
      expect(names(one.body.data.items)).toEqual(['jaehoon', 'admin.hong', 'boram', 'dahye', 'dain']);
      const pages = await walk(tab, FOLLOWERS('minji'), 5);
      expect(pages.map((p) => names(p.items))).toEqual([
        ['jaehoon', 'admin.hong', 'boram', 'dahye', 'dain'],
        ['jaehoon', 'dahye', 'haneul', 'haneul2', 'nayeon'],
        ['jaehoon', 'dahye'],
      ]);
      const seen = pages.flatMap((p) => names(p.items));
      expect(seen.filter((n) => n === 'jaehoon')).toHaveLength(3);
      expect(seen).not.toContain('doyun');
      expect(new Set(seen).size).toBe(8);
    });
  }, 60_000);

  it('고친 판 - 다섯씩 끝까지 받으면 21명이 한 번씩 차례대로(5 · 5 · 5 · 5 · 1) · 기본 20', async () => {
    await serve(2, async ({ base }) => {
      const tab = await loggedIn(base, 'jaehoon');
      const pages = await walk(tab, FOLLOWERS('minji'), 5);
      expect(pages.map((p) => p.items.length)).toEqual([5, 5, 5, 5, 1]);
      expect(pages.flatMap((p) => names(p.items))).toEqual(MINJI_FOLLOWERS);
      expect(pages.at(-1)).toMatchObject({ hasNext: false, nextCursor: null });
      expect(typeof pages[0].nextCursor).toBe('string');
      const all = await tab.get(FOLLOWERS('minji'));
      expect([all.body.data.items.length, all.body.data.hasNext]).toEqual([20, true]);
      const rest = await tab.get(FOLLOWERS('minji', `?cursor=${all.body.data.nextCursor}`));
      expect(names(rest.body.data.items)).toEqual(['yuri03']);
    });
  }, 60_000);

  it('고친 판 - 커서가 가리키던 사람이 팔로우를 취소해도 다음 페이지가 이어진다 · 잘못된 커서 400 · limit 51 은 400', async () => {
    await serve(2, async ({ base }) => {
      const tab = await loggedIn(base, 'jaehoon');
      const one = await tab.get(FOLLOWERS('minji', '?limit=5'));
      await onDb(GATE_DB, "DELETE FROM follows WHERE follower_id = (SELECT id FROM users WHERE username = 'dain') AND following_id = $1", [MINJI_ID]);
      const two = await tab.get(FOLLOWERS('minji', `?limit=5&cursor=${one.body.data.nextCursor}`));
      expect(names(two.body.data.items)).toEqual(['doyun', 'haneul', 'haneul2', 'jiho', 'jiwon']);
      expect(errOf(await tab.get(FOLLOWERS('minji', '?cursor=abc')))).toEqual([400, 'INVALID_CURSOR']);
      expect(errOf(await tab.get(FOLLOWERS('minji', '?limit=51')))).toEqual([400, 'VALIDATION_FAILED']);
    });
  }, 60_000);

  it('인덱스 두 개 - 등호 조건 컬럼이 앞이고 시각과 번호가 내림차순', () => {
    const from = version(2);
    const dirsIn = readdirSync(from('prisma/migrations')).filter((n) => /add_follow_list_indexes$/.test(n));
    expect(dirsIn).toHaveLength(1);
    const sql = read(from(`prisma/migrations/${dirsIn[0]}/migration.sql`));
    expect(sql).toContain('CREATE INDEX "follows_following_id_created_at_id_idx" ON "follows"("following_id", "created_at" DESC, "id" DESC);');
    expect(sql).toContain('CREATE INDEX "follows_follower_id_created_at_id_idx" ON "follows"("follower_id", "created_at" DESC, "id" DESC);');
  });
});

describe('축 ③ Step 3 - 팔로잉 방향', () => {
  it('jaehoon 의 팔로잉 여섯 · minji 의 팔로잉 셋 · 404 · 팔로워 목록은 그대로', async () => {
    await serve(3, async ({ base }) => {
      const tab = await loggedIn(base, 'jaehoon');
      expect(names((await tab.get(FOLLOWING('jaehoon'))).body.data.items)).toEqual(JAEHOON_FOLLOWING);
      expect(names((await tab.get(FOLLOWING('minji'))).body.data.items)).toEqual(['jaehoon', 'dahye', 'seungwoo']);
      const pages = await walk(tab, FOLLOWING('jaehoon'), 4);
      expect(pages.map((p) => names(p.items))).toEqual([['doyun', 'minji', 'dahye', 'seungwoo'], ['seoyeon', 'nayeon']]);
      expect(errOf(await tab.get(FOLLOWING('nobody')))).toEqual([404, 'USER_NOT_FOUND']);
      expect(names((await walk(tab, FOLLOWERS('minji'), 20)).flatMap((p) => p.items))).toEqual(MINJI_FOLLOWERS);
      const post = await tab.send('POST', FOLLOWING('minji'));
      expect([post.status, post.headers.get('allow')]).toEqual([405, 'GET']);
    });
  }, 60_000);
});

describe('축 ④ Step 4 - 줄마다 보는 사람 기준', () => {
  it('jaehoon 이 보는 minji 의 팔로워 - 내가 팔로우하는 다섯만 isFollowing · 내 줄은 false', async () => {
    await serve(4, async ({ base }) => {
      const tab = await loggedIn(base, 'jaehoon');
      const items = (await walk(tab, FOLLOWERS('minji'), 50)).flatMap((p) => p.items);
      expect(Object.keys(items[0])).toEqual(['id', 'username', 'name', 'profileImage', 'isFollowing']);
      expect(items.filter((i) => i.isFollowing).map((i) => i.username)).toEqual(['dahye', 'doyun', 'nayeon', 'seoyeon', 'seungwoo']);
      expect(items[0]).toMatchObject({ username: 'jaehoon', isFollowing: false });
    });
  }, 60_000);

  it('같은 목록을 seoyeon 이 보면 jaehoon 과 doyun 만 · jaehoon 의 팔로잉을 seoyeon 이 보면 doyun 과 minji', async () => {
    await serve(4, async ({ base }) => {
      const tab = await loggedIn(base, 'seoyeon');
      const items = (await tab.get(FOLLOWERS('minji'))).body.data.items;
      expect(items.filter((i) => i.isFollowing).map((i) => i.username)).toEqual(['jaehoon', 'doyun']);
      const following = (await tab.get(FOLLOWING('jaehoon'))).body.data.items;
      expect(following.filter((i) => i.isFollowing).map((i) => i.username)).toEqual(['doyun', 'minji']);
    });
  }, 60_000);

  it('줄이 늘어도 쿼리 수가 같다 - 다섯 줄 판과 스무 줄 판', async () => {
    const counts = [];
    for (const limit of [5, 20]) {
      await serve(4, async ({ base, tail }) => {
        const tab = await loggedIn(base, 'jaehoon');
        const before = queryLines(tail()).length;
        await tab.get(FOLLOWERS('minji', `?limit=${limit}`));
        await new Promise((r) => setTimeout(r, 200));
        counts.push(queryLines(tail()).length - before);
      }, { edit: withQueryLog });
    }
    expect(counts[0]).toBe(counts[1]);
    expect(counts[0]).toBeLessThanOrEqual(3);
  }, 90_000);
});

describe('축 ⑤ 다음 회차 판정 DB - p3-61-end.sql(교안 차례대로 이어진 흐름의 끝)', () => {
  it('jaehoon 팔로잉 일곱(boram · admin.hong 을 더하고 seoyeon 을 취소) · admin.hong 1 · boram 1 · seoyeon 0 · 인덱스 둘이 들어 있다', async () => {
    const dump = read(P('test/fixtures/p3-61-end.sql')).split('\n').filter((line) => !line.startsWith('\\')).join('\n');
    const db = `${DB_PREFIX}_end`;
    await dropDb(db);
    await admin((client) => client.query(`CREATE DATABASE ${db}`));
    try {
      await runSqlFile(db, dump);
      const mine = await onDb(db, `SELECT b.username FROM follows f JOIN users a ON a.id = f.follower_id JOIN users b ON b.id = f.following_id
        WHERE a.username = 'jaehoon' ORDER BY f.created_at DESC, f.id DESC`);
      expect(mine.map((r) => r.username)).toEqual(['boram', 'admin.hong', 'doyun', 'minji', 'dahye', 'seungwoo', 'nayeon']);
      expect(await followerCountOf('admin.hong', db)).toBe(1);
      expect(await followerCountOf('boram', db)).toBe(1);
      expect(await followerCountOf('seoyeon', db)).toBe(0);
      expect(await followerCountOf('minji', db)).toBe(21);
      const idx = await onDb(db, "SELECT indexname FROM pg_indexes WHERE tablename = 'follows' ORDER BY indexname");
      expect(idx.map((r) => r.indexname)).toEqual(['follows_follower_id_created_at_id_idx', 'follows_follower_id_following_id_key', 'follows_following_id_created_at_id_idx', 'follows_pkey']);
    } finally {
      await dropDb(db);
    }
  }, 60_000);
});
