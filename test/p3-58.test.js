// p3-58 「프로필을 서버에서」 게이트 - 백엔드(교안 Step 1 · 2 · 6)
// 내부 검증 전용 - 교안에 한 줄도 인용하지 않는다.
//
// `8-fullstack-features` 열째 회차다(`curriculum.md` 「`p3-58` 착수 결정」 ①~⑦).
// 백엔드의 시작 판은 code/p3-57(a9f498c)의 학생 파일이다.
// 커밋 - Step 1 하나(프로필 헤더 API) · Step 2 하나(프로필 그리드 API) · Step 6 하나(사람 찾기 API).
//        같은 «(Step N)» 표식이 여럿이면 가장 뒤 feat 커밋이 그 Step 의 끝 판이다.
// 🔑 포트 - 3985 · 3986 · `P358_PORT` 로 바꾼다. DB - `p358_api_` 로 시작하는 것만 만들고 지운다.
// 🔑 판정 DB 는 «p3-57 을 마친 학생 DB» 다 - `test/fixtures/p3-57-end.sql`(p3-57 학생 낭독 DB).
//    사람 22명 · 게시물 34개(minji 27 · jaehoon 5 · dahye 1 · seungwoo 1) · 시드 세 사람의 name 은 NULL.
//
// 축 ⓪ 판정 DB · 축 ① Step 1 헤더 · 축 ② Step 2 그리드 · 축 ③ Step 6 사람 찾기
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, cpSync, symlinkSync, existsSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { boot } from './helpers/boot.js';

const ROOT = new URL('../', import.meta.url);
const P = (rel) => new URL(rel, ROOT).pathname;
const read = (path) => readFileSync(path, 'utf8');
const PG_PORT = Number(process.env.P358_PG_PORT ?? 5432);
const ADMIN = { host: 'localhost', port: PG_PORT, database: 'postgres', user: 'postgres', password: 'postgres' };
const DB_PREFIX = process.env.P358_DB_PREFIX ?? 'p358_api';
const TPL_DB = `${DB_PREFIX}_tpl`;
const GATE_DB = `${DB_PREFIX}_gate`;
const dbUrl = (name) => `postgresql://postgres:postgres@localhost:${PG_PORT}/${name}`;
const PORT = Number(process.env.P358_PORT ?? 3985);
const PORT2 = 3986;
const SECRET = 'q2Xh0v9bGm4RkT7sYp1wLc8nZf3uJd6eHa5iVo0rQyE';
const env = {
  CORS_ORIGIN: 'http://localhost:3001', JWT_SECRET: SECRET,
  GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret', SITE_URL: `http://localhost:${PORT}`,
  KAKAO_CLIENT_ID: 'test-kakao', KAKAO_CLIENT_SECRET: 'test-kakao-secret',
  NAVER_CLIENT_ID: 'test-naver', NAVER_CLIENT_SECRET: 'test-naver-secret',
};
const STUDENT_FILES = ['app.js', 'db.js', 'errors.js', 'responses.js', 'routes', 'controllers', 'services', 'middlewares', 'schemas', 'strategies', 'docs', 'utils', 'package.json', 'requests', 'seed.js', 'data', 'prisma', 'prisma.config.js', '.env.example', 'lab'];
const FIXTURE = P('test/fixtures/p3-57-end.sql');

const git = (args) => execFileSync('git', args, { cwd: P('.'), encoding: 'utf8', maxBuffer: 1 << 28 });
const hasRef = (ref) => {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', ref], { cwd: P('.'), stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
};
// 🔑 판의 선 - 북마크 code/p3-58 이 있으면 그것, 없으면 지금 체크아웃한 선(HEAD). `P358_LINE` 으로 바꾼다.
const LINE = process.env.P358_LINE ?? (hasRef('refs/heads/code/p3-58') ? 'code/p3-58' : 'HEAD');
const WT = process.env.P358_WT ?? null;
const START = process.env.P358_BASE ?? 'code/p3-57';
/** «(Step N)» 표식이 붙은 그 회차 커밋들 - 새것부터. */
const stepCommits = (n) => {
  const log = git(['log', '-n', '200', '--format=%H %s', LINE]);
  return log.split('\n').filter((l) => / feat\(p3-58\): /.test(l) && l.endsWith(`(Step ${n})`)).map((l) => l.split(' ')[0]);
};
const dirs = [];
const refDirs = new Map();
const refDir = (ref) => {
  if (refDirs.has(ref)) return refDirs.get(ref);
  const dir = mkdtempSync(join(tmpdir(), 'p358-ref-'));
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
  const commits = stepCommits(step);
  if (commits.length === 0) throw new Error(`p3-58 (Step ${step}) 커밋이 없다`);
  return commits[0];
};
/** 그 Step 의 끝 판 - `P358_WT` 가 그 Step 이면 작업트리. */
const version = (step) => (WT === String(step) ? worktree : refDir(step === 'lab' ? LINE : versionRef(step)));
const hasStep = (step) => WT === String(step) || step === 'start' || stepCommits(step).length > 0;

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

/** 그 판의 마이그레이션을 판정 DB 에 건다 - 학생이 `npx prisma migrate dev` 로 거는 것과 같은 SQL 파일들. */
// 🚨 풀어 둔 판에는 node_modules 가 없어 prisma.config.js 가 `prisma/config` 를 못 찾는다 - 학생 사본(링크 있음)에서 돈다.
const migrate = (from, db) => execFileSync(P('node_modules/.bin/prisma'), ['migrate', 'deploy'], {
  cwd: studentDir(from), env: { ...process.env, DATABASE_URL: dbUrl(db) }, encoding: 'utf8', stdio: 'pipe',
});

const studentDir = (from) => {
  const dir = mkdtempSync(join(tmpdir(), 'p358-srv-'));
  for (const name of STUDENT_FILES) {
    if (existsSync(from(name))) cpSync(from(name), join(dir, name), { recursive: true });
  }
  symlinkSync(P('node_modules'), join(dir, 'node_modules'));
  dirs.push(dir);
  return dir;
};
/** 그 판의 학생 파일 사본을 `db` 로 띄운다. 🚨 그 판의 스키마로 클라이언트를 만든 node_modules 가 필요하다 - 아래 `generateFor`. */
const withServer = async (from, db, fn, { port = PORT } = {}) => {
  const dir = studentDir(from);
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
//    시작 판(테이블 없음)과 Step 2 뒤 판(테이블 있음)은 다른 클라이언트다.
let generated = null;
const generateFor = (from) => {
  const schema = read(from('prisma/schema.prisma'));
  if (generated === schema) return;
  execFileSync(P('node_modules/.bin/prisma'), ['generate'], {
    cwd: studentDir(from), env: { ...process.env, DATABASE_URL: dbUrl(GATE_DB) }, stdio: 'pipe',
  });
  generated = schema;
};
const serve = async (step, db, fn, opts) => {
  const from = version(step);
  generateFor(from);
  return withServer(from, db, fn, opts);
};

const PASSWORDS = { jaehoon: 'jaehoon1234', seoyeon: 'instagram1234' };
/** 쿠키를 기억하는 탭 하나 - Access 토큰 쿠키만 기억한다. */
const browser = (url) => {
  const jar = new Map();
  const send = async (method, path, body) => {
    const headers = {};
    let payload;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) {
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
    return { status: res.status, body: parsed };
  };
  return { send, get: (path) => send('GET', path) };
};
const loggedIn = async (url, username) => {
  const tab = browser(url);
  const res = await tab.send('POST', '/api/v2/auth/login', { username, password: PASSWORDS[username] });
  expect([username, res.status]).toEqual([username, 200]);
  return tab;
};

const photo = () => readFileSync(P('requests/photos/beach.jpg'));
/** 화면 «공유하기» 처럼 - 사진을 먼저 올리고 그 주소로 게시물을 만든다. 만들기 응답을 그대로 돌려준다. */
const share = async (tab, content) => {
  const form = new FormData();
  form.append('images', new Blob([photo()], { type: 'image/jpeg' }), 'beach.jpg');
  const uploaded = await tab.send('POST', '/api/v2/uploads', form);
  expect(uploaded.status).toBe(201);
  return tab.send('POST', '/api/v2/posts', { imageUrls: uploaded.body.data.imageUrls, postAlt: '', content });
};
/** 화면 «고치기» 처럼 - 글만 보낸다. */
const edit = (tab, id, content) => tab.send('PATCH', `/api/v2/posts/${id}`, { content });

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

const PROFILE = (name) => `/api/v2/profiles/${encodeURIComponent(name)}`;
const POSTS = (name, query = '') => `${PROFILE(name)}/posts${query}`;
const SEARCH = (keyword) => `/api/v2/members/search${keyword === undefined ? '' : `?keyword=${encodeURIComponent(keyword)}`}`;
const idsOf = (res) => res.body.data.items.map((item) => item.id);
const MINJI = [9, 2, 4, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53];

describe('축 ⓪ 판정 DB - p3-57 을 마친 학생 DB', () => {
  it('사람 22명 · 게시물 34개 · 사람마다 게시물 수 · 시드 세 사람의 name 은 NULL', async () => {
    await freshDb();
    expect((await onDb(GATE_DB, 'SELECT count(*)::int AS n FROM users'))[0].n).toBe(22);
    expect((await onDb(GATE_DB, 'SELECT count(*)::int AS n FROM posts'))[0].n).toBe(34);
    const counts = await onDb(GATE_DB,
      'SELECT u.username, count(p.id)::int AS n FROM users u JOIN posts p ON p.author_id = u.id GROUP BY u.username ORDER BY u.username');
    expect(counts).toEqual([
      { username: 'dahye', n: 1 }, { username: 'jaehoon', n: 5 }, { username: 'minji', n: 27 }, { username: 'seungwoo', n: 1 },
    ]);
    const seeded = await onDb(GATE_DB, "SELECT username, name FROM users WHERE username IN ('jaehoon', 'minji', 'seungwoo') ORDER BY id");
    expect(seeded.map((u) => u.name)).toEqual([null, null, null]);
  });
});

describe('축 ① Step 1 - 프로필 헤더 API', () => {
  it('시작 판에는 주소가 없다 - 404 ROUTE_NOT_FOUND', async () => {
    await freshDb();
    await serve('start', GATE_DB, async ({ base }) => {
      const tab = await loggedIn(base, 'jaehoon');
      const res = await tab.get(PROFILE('minji'));
      expect([res.status, res.body.error.code]).toEqual([404, 'ROUTE_NOT_FOUND']);
    });
  });

  it.runIf(hasStep(1))('Step 1 판 - minji 27 · 가입한 sora 0 · 없는 사람 404 · POST 405 · 로그인 없이 401', async () => {
    await freshDb();
    await serve(1, GATE_DB, async ({ base }) => {
      const tab = await loggedIn(base, 'jaehoon');
      expect(await tab.get(PROFILE('minji'))).toEqual({
        status: 200,
        body: { data: { id: 3, username: 'minji', name: null, profileImage: 'https://picsum.photos/seed/minji/40/40', postCount: 27 } },
      });
      expect((await tab.get(PROFILE('jaehoon'))).body.data.postCount).toBe(5);
      expect(await tab.get(PROFILE('sora'))).toEqual({
        status: 200, body: { data: { id: 6, username: 'sora', name: '한소라', profileImage: null, postCount: 0 } },
      });
      const none = await tab.get(PROFILE('nobody'));
      expect([none.status, none.body.error.code, none.body.error.message]).toEqual([404, 'USER_NOT_FOUND', '그런 사용자는 없어요']);
      const post = await tab.send('POST', PROFILE('minji'), {});
      expect(post.status).toBe(405);
      expect((await browser(base).get(PROFILE('minji'))).status).toBe(401);
    });
  });
});

describe('축 ② Step 2 - 프로필 그리드 API', () => {
  it.runIf(hasStep(2))('Step 2 판 - minji 12 · 12 · 3(최신순) · jaehoon 다섯 줄 · sora 빈 목록 · 없는 사람 404 · limit 400 · 잘못된 커서 400', async () => {
    await freshDb();
    await serve(2, GATE_DB, async ({ base }) => {
      const tab = await loggedIn(base, 'jaehoon');
      const first = await tab.get(POSTS('minji'));
      expect([first.status, idsOf(first), first.body.data.hasNext]).toEqual([200, MINJI.slice(0, 12), true]);
      const second = await tab.get(POSTS('minji', `?cursor=${first.body.data.nextCursor}`));
      expect([idsOf(second), second.body.data.hasNext]).toEqual([MINJI.slice(12, 24), true]);
      const third = await tab.get(POSTS('minji', `?cursor=${second.body.data.nextCursor}`));
      expect([idsOf(third), third.body.data.hasNext, third.body.data.nextCursor]).toEqual([MINJI.slice(24), false, null]);

      const jaehoon = await tab.get(POSTS('jaehoon'));
      expect(jaehoon.body.data.items.map((item) => [item.id, item.multipleImages, item.likeCount, item.commentCount])).toEqual([
        [29, false, 0, 0], [28, false, 0, 0], [26, false, 0, 0], [14, false, 1, 0], [1, true, 131, 4],
      ]);
      expect(Object.keys(jaehoon.body.data.items[0])).toEqual(['id', 'thumbnailUrl', 'multipleImages', 'likeCount', 'commentCount']);

      expect(await tab.get(POSTS('sora'))).toEqual({ status: 200, body: { data: { items: [], hasNext: false, nextCursor: null } } });
      const none = await tab.get(POSTS('nobody'));
      expect([none.status, none.body.error.code]).toEqual([404, 'USER_NOT_FOUND']);
      expect((await tab.get(POSTS('minji', '?limit=0'))).status).toBe(400);
      const bad = await tab.get(POSTS('minji', '?cursor=abc'));
      expect(bad.status).toBe(400);
      expect(idsOf(await tab.get(POSTS('minji', '?limit=3')))).toEqual([9, 2, 4]);
      expect((await browser(base).get(POSTS('minji'))).status).toBe(401);
    });
  });
});

describe('축 ③ Step 6 - 사람 찾기 API', () => {
  it.runIf(hasStep(6))('Step 6 판 - mi 넷(이름 차례 · admin.hong 도) · 대문자도 같다 · 검색어가 없으면 빈 배열 · 줄 모양', async () => {
    await freshDb();
    await serve(6, GATE_DB, async ({ base }) => {
      const tab = await loggedIn(base, 'jaehoon');
      const mi = await tab.get(SEARCH('mi'));
      expect([mi.status, mi.body.data.map((m) => m.username)]).toEqual([200, ['admin.hong', 'kim.minji', 'minji', 'minji.kim']]);
      expect((await tab.get(SEARCH('MI'))).body.data.map((m) => m.username)).toEqual(['admin.hong', 'kim.minji', 'minji', 'minji.kim']);
      expect((await tab.get(SEARCH('sora'))).body.data).toEqual([{ id: 6, username: 'sora', name: '한소라', profileImage: null }]);
      expect(await tab.get(SEARCH(undefined))).toEqual({ status: 200, body: { data: [] } });
      expect((await tab.get(SEARCH(''))).body.data).toEqual([]);
      expect((await browser(base).get(SEARCH('mi'))).status).toBe(401);
    });
  });
});

const LAB_PORT = Number(process.env.P358_LAB_PORT ?? 3987);
/** 학생 쪽 포트 4001 을 판정 포트로 - 바꾸는 곳은 app.listen 의 수와 기다린다는 문장 둘뿐이어야 한다. */
const onPort = (file, port) => {
  const source = read(file);
  expect(source.split('4001').length - 1).toBe(2);
  writeFileSync(file, source.replaceAll('4001', String(port)));
};
/** 실습 서버를 띄운다 - `patch(source)` 를 주면 그 판으로 바꿔 띄운다(틀린 판). */
const labServer = async (which, fn, patch = null) => {
  const from = version('lab');
  const dir = studentDir(from);
  const file = join(dir, 'lab/p3-58', `${which}.js`);
  onPort(file, LAB_PORT);
  if (patch) writeFileSync(file, patch(read(file)));
  const srv = await boot(file, { port: LAB_PORT, cwd: dir, env: { ...env, DATABASE_URL: dbUrl(GATE_DB) }, ready: `${LAB_PORT}번 포트에서` });
  try {
    return await fn(browser(`http://localhost:${LAB_PORT}`));
  } finally {
    await Promise.race([srv.stop(), new Promise((r) => setTimeout(r, 500))]);
  }
};

describe('축 ④ 직접 해보기 1 - 리뷰 글쓴이', () => {
  it('yuna 4 · 12 10 5 다음 1 · jaehoon 2 · jisoo 0 과 빈 목록 · 없는 사람 404 둘', async () => {
    await labServer('practice1', async (tab) => {
      expect(await tab.get('/api/users/yuna')).toEqual({ status: 200, body: { id: 1, username: 'yuna', reviewCount: 4 } });
      const first = await tab.get('/api/users/yuna/reviews');
      expect([first.body.items.map((r) => r.id), first.body.hasNext]).toEqual([[12, 10, 5], true]);
      expect(Object.keys(first.body.items[0])).toEqual(['id', 'content', 'createdAt']);
      const second = await tab.get(`/api/users/yuna/reviews?cursor=${first.body.nextCursor}`);
      expect([second.body.items.map((r) => r.id), second.body.hasNext, second.body.nextCursor]).toEqual([[1], false, null]);
      expect((await tab.get('/api/users/jaehoon')).body.reviewCount).toBe(2);
      expect((await tab.get('/api/users/jisoo')).body.reviewCount).toBe(0);
      expect(await tab.get('/api/users/jisoo/reviews')).toEqual({ status: 200, body: { items: [], hasNext: false, nextCursor: null } });
      expect(await tab.get('/api/users/minho')).toEqual({ status: 404, body: { message: '그런 사용자는 없어요' } });
      expect(await tab.get('/api/users/minho/reviews')).toEqual({ status: 404, body: { message: '그런 사용자는 없어요' } });
    });
  });
});

describe('축 ⑤ 과제 [기초] - 사람 찾기', () => {
  it('j 셋(이름 차례 · sujin 도) · J 같음 · u 둘 · minho 와 빈 검색어는 [] · 글쓴이 주소는 그대로', async () => {
    await labServer('homework1', async (tab) => {
      const names = async (q) => (await tab.get(`/api/users/search${q}`)).body.map((u) => u.username);
      expect(await names('?keyword=j')).toEqual(['jaehoon', 'jisoo', 'sujin']);
      expect(await names('?keyword=J')).toEqual(['jaehoon', 'jisoo', 'sujin']);
      expect(await names('?keyword=u')).toEqual(['sujin', 'yuna']);
      expect(await tab.get('/api/users/search?keyword=minho')).toEqual({ status: 200, body: [] });
      expect(await tab.get('/api/users/search')).toEqual({ status: 200, body: [] });
      expect((await tab.get('/api/users/yuna')).body.reviewCount).toBe(4);
    });
  });

  it('틀린 판 - 사람 찾기를 /api/users/:username 아래에 두면 search 를 사용자 이름으로 읽어 404', async () => {
    const moveDown = (source) => {
      const start = source.indexOf('// 사람 찾기의 쿼리 문자열');
      const end = source.indexOf('// 글쓴이 한 사람 - 리뷰 수는');
      const block = source.slice(start, end);
      const rest = source.slice(0, start) + source.slice(end);
      const at = rest.indexOf('// 이 서버의 실패는');
      return rest.slice(0, at) + block + rest.slice(at);
    };
    await labServer('homework1', async (tab) => {
      expect(await tab.get('/api/users/search?keyword=j')).toEqual({ status: 404, body: { message: '그런 사용자는 없어요' } });
    }, moveDown);
  });
});
