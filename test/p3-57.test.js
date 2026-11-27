// p3-57 「해시태그 페이지」 게이트 - 백엔드(교안 Step 1 · 2 · 6 의 강의 자료 · 직접 해보기 1 · 과제 [기초])
// 내부 검증 전용 - 교안에 한 줄도 인용하지 않는다.
//
// `8-fullstack-features` 아홉째 회차다(`progress/p3-57-hashtag-page.md` 「착수 결정」 ①~⑥).
// 백엔드의 시작 판은 code/p3-56(a027d90)의 학생 파일이다.
// 커밋 - Step 1 하나(목록 API) · Step 2 셋(seed 고침 fix · 강의 자료 many-tags.sql · 인덱스) · Step 6 하나(강의 자료 sunset-posts.sql).
//        같은 «(Step N)» 표식이 여럿이면 가장 뒤 feat 커밋이 그 Step 의 끝 판이다.
// 🔑 포트 - 3965 · 3966 · `P357_PORT` 로 바꾼다. DB - `p357_api_` 로 시작하는 것만 만들고 지운다.
// 🔑 판정 DB 는 «p3-56 을 마친 학생 DB» 다 - `test/fixtures/p3-56-end.sql`(p3-56 학생 낭독 DB).
//    게시물 10개(1 2 3 4 5 9 14 26 28 29) · 태그 바다 1 · 노을 3 · sunset 0 · 한강 1 · 26번 «#노을빛 …» 은 연결 없음.
//
// 축 ⓪ 판정 DB · 축 ① Step 1 · 축 ② Step 2 시드 · 축 ③ Step 2 실행 계획(실습 DB) · 축 ④ Step 6 강의 자료와 페이지
// 축 ⑤ 직접 해보기 1 · 축 ⑥ 과제 [기초] · 축 ⑦ 학생 파일 차이
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
const PG_PORT = Number(process.env.P357_PG_PORT ?? 5432);
const ADMIN = { host: 'localhost', port: PG_PORT, database: 'postgres', user: 'postgres', password: 'postgres' };
const DB_PREFIX = process.env.P357_DB_PREFIX ?? 'p357_api';
const TPL_DB = `${DB_PREFIX}_tpl`;
const GATE_DB = `${DB_PREFIX}_gate`;
const dbUrl = (name) => `postgresql://postgres:postgres@localhost:${PG_PORT}/${name}`;
const PORT = Number(process.env.P357_PORT ?? 3965);
const PORT2 = 3966;
const SECRET = 'q2Xh0v9bGm4RkT7sYp1wLc8nZf3uJd6eHa5iVo0rQyE';
const env = {
  CORS_ORIGIN: 'http://localhost:3001', JWT_SECRET: SECRET,
  GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret', SITE_URL: `http://localhost:${PORT}`,
  KAKAO_CLIENT_ID: 'test-kakao', KAKAO_CLIENT_SECRET: 'test-kakao-secret',
  NAVER_CLIENT_ID: 'test-naver', NAVER_CLIENT_SECRET: 'test-naver-secret',
};
const STUDENT_FILES = ['app.js', 'db.js', 'errors.js', 'responses.js', 'routes', 'controllers', 'services', 'middlewares', 'schemas', 'strategies', 'docs', 'utils', 'package.json', 'requests', 'seed.js', 'data', 'prisma', 'prisma.config.js', '.env.example', 'lab'];
const FIXTURE = P('test/fixtures/p3-56-end.sql');

const git = (args) => execFileSync('git', args, { cwd: P('.'), encoding: 'utf8', maxBuffer: 1 << 28 });
const hasRef = (ref) => {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', ref], { cwd: P('.'), stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
};
// 🔑 판의 선 - 북마크 code/p3-56 이 있으면 그것, 없으면 지금 체크아웃한 선(HEAD). `P357_LINE` 으로 바꾼다.
const LINE = process.env.P357_LINE ?? (hasRef('refs/heads/code/p3-57') ? 'code/p3-57' : 'HEAD');
const WT = process.env.P357_WT ?? null;
const START = process.env.P357_BASE ?? 'code/p3-56';
/** «(Step N)» 표식이 붙은 그 회차 커밋들 - 새것부터. */
const stepCommits = (n) => {
  const log = git(['log', '-n', '200', '--format=%H %s', LINE]);
  return log.split('\n').filter((l) => / feat\(p3-57\): /.test(l) && l.endsWith(`(Step ${n})`)).map((l) => l.split(' ')[0]);
};
const dirs = [];
const refDirs = new Map();
const refDir = (ref) => {
  if (refDirs.has(ref)) return refDirs.get(ref);
  const dir = mkdtempSync(join(tmpdir(), 'p357-ref-'));
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
  if (commits.length === 0) throw new Error(`p3-57 (Step ${step}) 커밋이 없다`);
  return commits[0];
};
/** 그 Step 의 끝 판 - `P357_WT` 가 그 Step 이면 작업트리. */
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
  const dir = mkdtempSync(join(tmpdir(), 'p357-srv-'));
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

const tagsOf = (db) => onDb(db, 'SELECT name, post_count FROM hashtags ORDER BY id');
const linksOf = (db, postId) => onDb(db,
  'SELECT h.name FROM post_hashtags ph JOIN hashtags h ON h.id = ph.hashtag_id WHERE ph.post_id = $1 ORDER BY ph.id', [postId])
  .then((rows) => rows.map((row) => row.name));
const countOf = async (db, name) => (await onDb(db, 'SELECT post_count FROM hashtags WHERE name = $1', [name]))[0]?.post_count ?? null;


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

const LAB_PORT = Number(process.env.P357_LAB_PORT ?? 3967);
const LAB_DB = `${DB_PREFIX}_lab`;
/** 문장 여럿인 SQL 파일을 한 번에 - 마지막 문장의 행을 돌려준다(VS Code 확장의 마지막 결과 창). */
const runSql = async (db, sql) => {
  const client = new pg.Client({ ...ADMIN, database: db });
  await client.connect();
  try {
    const result = await client.query(sql);
    return (Array.isArray(result) ? result.at(-1) : result).rows;
  } finally {
    await client.end();
  }
};
const TAG = (name) => `/api/v2/hashtags/${encodeURIComponent(name)}/posts`;
const idsOf = (res) => res.body.data.items.map((item) => item.id);
const EXPLAIN = 'EXPLAIN (ANALYZE, COSTS OFF, BUFFERS OFF) SELECT id, created_at FROM posts WHERE EXISTS (SELECT 1 FROM post_hashtags WHERE hashtag_id = 2 AND post_id = posts.id) ORDER BY created_at DESC, id DESC LIMIT 13;';
const plan = async (db) => (await onDb(db, EXPLAIN)).map((row) => row['QUERY PLAN']).join('\n');
/** 학생 쪽 포트 4001 을 판정 포트로 - 바꾸는 곳은 app.listen 의 수와 기다린다는 문장 둘뿐이어야 한다. */
const onPort = (file, port) => {
  const source = read(file);
  expect(source.split('4001').length - 1).toBe(2);
  writeFileSync(file, source.replaceAll('4001', String(port)));
};
const labServer = async (which, db, fn) => {
  const from = version('lab');
  generateFor(from);
  const dir = studentDir(from);
  const file = join(dir, 'lab/p3-57', `${which}.js`);
  onPort(file, LAB_PORT);
  const srv = await boot(file, { port: LAB_PORT, cwd: dir, env: { ...env, DATABASE_URL: dbUrl(db) }, ready: `${LAB_PORT}번 포트에서` });
  try {
    return await fn(`http://localhost:${LAB_PORT}`);
  } finally {
    await Promise.race([srv.stop(), new Promise((r) => setTimeout(r, 500))]);
  }
};

describe('축 ⓪ 판정 DB - p3-56 을 마친 학생 DB', () => {
  it('게시물 10개 · 태그 넷과 post_count · 짝 다섯 · 26번은 연결 없음 · 인덱스는 짝 UNIQUE 하나', async () => {
    await freshDb();
    expect((await onDb(GATE_DB, 'SELECT id FROM posts ORDER BY id')).map((p) => p.id)).toEqual([1, 2, 3, 4, 5, 9, 14, 26, 28, 29]);
    expect(await tagsOf(GATE_DB)).toEqual([
      { name: '바다', post_count: 1 }, { name: '노을', post_count: 3 }, { name: 'sunset', post_count: 0 }, { name: '한강', post_count: 1 },
    ]);
    expect(await linksOf(GATE_DB, 26)).toEqual([]);
    const idx = await onDb(GATE_DB, "SELECT indexname FROM pg_indexes WHERE tablename = 'post_hashtags' ORDER BY indexname");
    expect(idx.map((i) => i.indexname)).toEqual(['post_hashtags_pkey', 'post_hashtags_post_id_hashtag_id_key']);
  });
});

describe('축 ① Step 1 - 태그 게시물 API', () => {
  it('시작 판에는 주소가 없다 - 404 ROUTE_NOT_FOUND', async () => {
    await freshDb();
    await serve('start', GATE_DB, async ({ base }) => {
      const tab = await loggedIn(base, 'jaehoon');
      const res = await tab.get(TAG('노을'));
      expect([res.status, res.body.error.code]).toEqual([404, 'ROUTE_NOT_FOUND']);
    });
  });

  it('Step 1 판 - 노을은 29 · 28 · 1(피드 차례) · 그리드용 줄 다섯 칸 · 1번은 사진 여러 장', async () => {
    await freshDb();
    await serve(1, GATE_DB, async ({ base }) => {
      const tab = await loggedIn(base, 'jaehoon');
      const res = await tab.get(TAG('노을'));
      expect(res.status).toBe(200);
      expect(idsOf(res)).toEqual([29, 28, 1]);
      expect(Object.keys(res.body.data.items[0]).sort()).toEqual(['commentCount', 'id', 'likeCount', 'multipleImages', 'thumbnailUrl']);
      expect(res.body.data.items[2]).toMatchObject({ id: 1, multipleImages: true, thumbnailUrl: 'https://picsum.photos/seed/post1/600/600', commentCount: 4 });
      expect(res.body.data.items[0].multipleImages).toBe(false);
      expect([res.body.data.hasNext, res.body.data.nextCursor]).toEqual([false, null]);
    });
  });

  it('Step 1 판 - #노을 · Sunset 도 같은 규칙으로 · sunset 은 빈 목록 · 노을빛 404 · 커서 둘 · 잘못된 커서 400 · POST 405', async () => {
    await freshDb();
    await serve(1, GATE_DB, async ({ base }) => {
      const tab = await loggedIn(base, 'jaehoon');
      expect(idsOf(await tab.get(TAG('#노을')))).toEqual([29, 28, 1]);
      const sunset = await tab.get(TAG('Sunset'));
      expect([sunset.status, sunset.body.data]).toEqual([200, { items: [], hasNext: false, nextCursor: null }]);
      const missing = await tab.get(TAG('노을빛'));
      expect([missing.status, missing.body.error.code, missing.body.error.message]).toEqual([404, 'HASHTAG_NOT_FOUND', '그런 해시태그는 없어요']);
      const first = await tab.get(`${TAG('노을')}?limit=2`);
      expect([idsOf(first), first.body.data.hasNext]).toEqual([[29, 28], true]);
      const second = await tab.get(`${TAG('노을')}?limit=2&cursor=${first.body.data.nextCursor}`);
      expect([idsOf(second), second.body.data.hasNext, second.body.data.nextCursor]).toEqual([[1], false, null]);
      const bad = await tab.get(`${TAG('노을')}?cursor=abc`);
      expect([bad.status, bad.body.error.code]).toEqual([400, 'INVALID_CURSOR']);
      const post = await tab.send('POST', TAG('노을'));
      expect(post.status).toBe(405);
      // 로그인하지 않으면 401
      expect((await browser(base).get(TAG('노을'))).status).toBe(401);
    });
  });

  it('Step 1 판 - 글에서 뽑는 규칙도 normalizeHashtag 하나를 쓴다(만들 때 #Sunset 은 sunset)', async () => {
    const from = version(1);
    expect(read(from('utils/hashtags.js'))).toContain('tags.map(normalizeHashtag)');
    await freshDb();
    await serve(1, GATE_DB, async ({ base }) => {
      const tab = await loggedIn(base, 'jaehoon');
      const made = await share(tab, '바닷가 #Sunset');
      expect(made.status).toBe(201);
      expect(await linksOf(GATE_DB, made.body.data.id)).toEqual(['sunset']);
      expect(idsOf(await tab.get(TAG('sunset')))).toEqual([made.body.data.id]);
    });
  });
});

describe('축 ② Step 2 - 시드', () => {
  it('시작 판 seed.js 는 0A000 으로 멈추고 고친 판은 «사람 5명 …» 으로 끝난다', async () => {
    await dropDb(LAB_DB);
    await admin((client) => client.query(`CREATE DATABASE ${LAB_DB} TEMPLATE ${TPL_DB}`));
    const run = (from) => {
      generateFor(from);
      const dir = studentDir(from);
      try {
        return { ok: true, out: execFileSync(process.execPath, ['seed.js'], { cwd: dir, env: { ...process.env, DATABASE_URL: dbUrl(LAB_DB) }, encoding: 'utf8', stdio: 'pipe' }) };
      } catch (error) {
        return { ok: false, out: `${error.stdout}${error.stderr}` };
      }
    };
    const before = run(version('start'));
    expect(before.ok).toBe(false);
    expect(before.out).toContain('cannot truncate a table referenced in a foreign key constraint');
    const after = run(version(2));
    expect(after.ok).toBe(true);
    expect(after.out.trim().split('\n').at(-1)).toBe('사람 5명, 게시물 5개, 사진 8장, 댓글 9개, 답글 3개를 넣었어요.');
    expect(await onDb(LAB_DB, 'SELECT count(*)::int AS n FROM hashtags')).toEqual([{ n: 0 }]);
    await dropDb(LAB_DB);
  }, 120_000);
});

describe('축 ③ Step 2 - 실습 DB 의 실행 계획', () => {
  it('migrate deploy → seed → 게시물 10만(p3-33) → many-tags.sql → Seq Scan 50000 → 인덱스 → Index Scan', async () => {
    await dropDb(LAB_DB);
    const start = version('start');
    migrate(start, LAB_DB);
    generateFor(version(2));
    execFileSync(process.execPath, ['seed.js'], { cwd: studentDir(version(2)), env: { ...process.env, DATABASE_URL: dbUrl(LAB_DB) }, stdio: 'pipe' });
    await runSql(LAB_DB, git(['show', 'code/p3-33:lab/p3-33/many-posts.sql']));
    const tags = await runSql(LAB_DB, read(version(2)('lab/p3-57/many-tags.sql')));
    expect(tags).toEqual([{ id: 1, name: '여행', post_count: 50000 }, { id: 2, name: '노을', post_count: 3 }]);
    const before = await plan(LAB_DB);
    expect(before).toMatch(/Seq Scan on post_hashtags/);
    expect(before).toMatch(/Rows Removed by Filter: 50000/);
    migrate(version(2), LAB_DB);
    const after = await plan(LAB_DB);
    expect(after).toMatch(/Index Scan using post_hashtags_hashtag_id_idx on post_hashtags/);
    expect(after).not.toMatch(/Rows Removed by Filter/);
    expect(after).toMatch(/Index Cond: \(hashtag_id = 2\)/);
    await dropDb(LAB_DB);
  }, 300_000);
});

describe('축 ④ Step 6 - 강의 자료 sunset-posts.sql 과 12개씩 페이지', () => {
  it('노을 27 = 짝 27 · 12 · 12 · 3 · 첫 페이지는 29 · 28 · 1 다음에 강의 자료 게시물(최신순)', async () => {
    await freshDb();
    migrate(version(2), GATE_DB);
    const out = await runSql(GATE_DB, read(version(6)('lab/p3-57/sunset-posts.sql')));
    expect(out).toEqual([{ name: '노을', post_count: 27, links: '27' }]);
    await serve(6, GATE_DB, async ({ base }) => {
      const tab = await loggedIn(base, 'jaehoon');
      const p1 = await tab.get(TAG('노을'));
      expect(p1.body.data.items).toHaveLength(12);
      expect(idsOf(p1).slice(0, 4)).toEqual([29, 28, 1, 30]);
      const p2 = await tab.get(`${TAG('노을')}?cursor=${p1.body.data.nextCursor}`);
      const p3 = await tab.get(`${TAG('노을')}?cursor=${p2.body.data.nextCursor}`);
      expect([p2.body.data.items.length, p3.body.data.items.length, p3.body.data.hasNext]).toEqual([12, 3, false]);
      const all = [...idsOf(p1), ...idsOf(p2), ...idsOf(p3)];
      expect(new Set(all).size).toBe(27);
      expect(all.at(-1)).toBe(53);
      expect(p1.body.data.items.find((i) => i.id === 32).multipleImages).toBe(true);
    });
  });
});

describe('축 ⑤ 직접 해보기 1 - 리뷰 서버 태그 목록', () => {
  it('가성비 12 · 10 | 4 · 2 | 1 · #가성비 · 선물 빈 목록 · 없는 태그 404', async () => {
    await labServer('practice1', GATE_DB, async (base) => {
      const get = async (path) => (await fetch(`${base}${path}`)).json();
      const ids = (page) => page.items.map((r) => r.id);
      const p1 = await get('/api/tags/%EA%B0%80%EC%84%B1%EB%B9%84/reviews?limit=2');
      const p2 = await get(`/api/tags/%EA%B0%80%EC%84%B1%EB%B9%84/reviews?limit=2&cursor=${p1.nextCursor}`);
      const p3 = await get(`/api/tags/%EA%B0%80%EC%84%B1%EB%B9%84/reviews?limit=2&cursor=${p2.nextCursor}`);
      expect([ids(p1), ids(p2), ids(p3), p3.nextCursor]).toEqual([[12, 10], [4, 2], [1], null]);
      expect(ids(await get('/api/tags/%23%EA%B0%80%EC%84%B1%EB%B9%84/reviews'))).toEqual([12, 10, 4]);
      expect(ids(await get('/api/tags/ANC/reviews'))).toEqual([7]);
      expect(await get('/api/tags/%EC%84%A0%EB%AC%BC/reviews')).toEqual({ items: [], hasNext: false, nextCursor: null });
      const missing = await fetch(`${base}/api/tags/%EB%94%94%EC%9E%90%EC%9D%B8/reviews`);
      expect([missing.status, await missing.json()]).toEqual([404, { message: '그런 태그는 없어요' }]);
    });
  });
});

describe('축 ⑤-b 직접 해보기 1 의 확인이 소문자를 안 맞춘 판을 가르는가', () => {
  it('toLowerCase 를 빼면 «대문자로 물어도 같은 태그»(ANC) 가 404', async () => {
    const from = version('lab');
    generateFor(from);
    const dir = studentDir(from);
    const file = join(dir, 'lab/p3-57/practice1.js');
    const text = read(file);
    const before = ".replace(/^#/, '').toLowerCase()";
    expect(text.split(before).length).toBe(2);
    writeFileSync(file, text.replace(before, ".replace(/^#/, '')"));
    onPort(file, LAB_PORT);
    const srv = await boot(file, { port: LAB_PORT, cwd: dir, env: { ...env, DATABASE_URL: dbUrl(GATE_DB) }, ready: `${LAB_PORT}번 포트에서` });
    try {
      expect((await fetch(`http://localhost:${LAB_PORT}/api/tags/ANC/reviews`)).status).toBe(404);
    } finally {
      await Promise.race([srv.stop(), new Promise((r) => setTimeout(r, 500))]);
    }
  });
});

describe('축 ⑥ 과제 [기초] - 태그 추천', () => {
  it('p3-57 끝 DB - 노을 27 · 바다 1 · 한강 1 (sunset 0 은 빠진다) · 노 · #노 · s · limit 2 · limit 20 은 400', async () => {
    await freshDb();
    migrate(version(2), GATE_DB);
    await runSql(GATE_DB, read(version(6)('lab/p3-57/sunset-posts.sql')));
    await labServer('homework1', GATE_DB, async (base) => {
      const get = async (q) => { const r = await fetch(`${base}/api/hashtags/suggestions${q}`); return [r.status, await r.json()]; };
      expect(await get('')).toEqual([200, [{ name: '노을', postCount: 27 }, { name: '바다', postCount: 1 }, { name: '한강', postCount: 1 }]]);
      expect(await get('?prefix=%EB%85%B8')).toEqual([200, [{ name: '노을', postCount: 27 }]]);
      expect(await get('?prefix=%23%EB%85%B8')).toEqual([200, [{ name: '노을', postCount: 27 }]]);
      expect(await get('?prefix=s')).toEqual([200, []]);
      expect((await get('?limit=2'))[1]).toHaveLength(2);
      expect(await get('?limit=20')).toEqual([400, { message: '보낸 내용이 규칙에 안 맞아요' }]);
    });
  });
});

describe('축 ⑥-b 과제 [기초] 의 확인이 틀린 판을 가르는가', () => {
  it('접두사의 # 을 안 떼면 «#노» 가 [] · post_count 0 을 안 빼면 «s» 가 sunset', async () => {
    await freshDb();
    migrate(version(2), GATE_DB);
    await runSql(GATE_DB, read(version(6)('lab/p3-57/sunset-posts.sql')));
    const variants = [
      [".replace(/^#/, '').toLowerCase()", ".toLowerCase()", '?prefix=%23%EB%85%B8', []],
      ['postCount: { gt: 0 }', 'postCount: { gte: 0 }', '?prefix=s', [{ name: 'sunset', postCount: 0 }]],
    ];
    for (const [before, after, query, wrong] of variants) {
      const from = version('lab');
      generateFor(from);
      const dir = studentDir(from);
      const file = join(dir, 'lab/p3-57/homework1.js');
      const text = read(file);
      expect(text.split(before).length).toBe(2);
      writeFileSync(file, text.replace(before, after));
      onPort(file, LAB_PORT);
      const srv = await boot(file, { port: LAB_PORT, cwd: dir, env: { ...env, DATABASE_URL: dbUrl(GATE_DB) }, ready: `${LAB_PORT}번 포트에서` });
      try {
        expect(await (await fetch(`http://localhost:${LAB_PORT}/api/hashtags/suggestions${query}`)).json()).toEqual(wrong);
      } finally {
        await Promise.race([srv.stop(), new Promise((r) => setTimeout(r, 500))]);
      }
    }
  });
});

describe('축 ⑦ 학생 파일 차이', () => {
  it('시작 판에서 바뀐 학생 파일 · 경로 주석 · 내부 어휘 없음', () => {
    // 이 회차 첫 커밋의 부모와 비교한다 - 그사이 다른 회차를 고친 커밋(선 위)이 끼어 있을 수 있다.
    const first = git(['log', '--reverse', '--format=%H %s', `${START}..${LINE}`]).split('\n').find((l) => / (feat|fix)\(p3-57\): /.test(l)).split(' ')[0];
    const changed = git(['diff', '--name-only', `${first}~1`, LINE, '--', ...STUDENT_FILES]).trim().split('\n').sort();
    expect(changed).toEqual([
      'app.js', 'controllers/hashtagController.js', 'docs/openapi.js', 'errors.js',
      'lab/p3-57/homework1.http', 'lab/p3-57/homework1.js', 'lab/p3-57/many-tags.sql', 'lab/p3-57/practice1.http', 'lab/p3-57/practice1.js', 'lab/p3-57/shop-data.js', 'lab/p3-57/sunset-posts.sql',
      'prisma/migrations/20261124085958_add_post_hashtags_hashtag_id_index/migration.sql', 'prisma/schema.prisma',
      'requests/hashtags.http', 'routes/hashtags.js', 'schemas/hashtagSchema.js', 'seed.js', 'services/postService.js', 'utils/hashtags.js',
    ]);
    const at = refDir(LINE);
    for (const f of changed.filter((n) => /\.(js|sql)$/.test(n) && !n.startsWith('prisma/') && n !== 'app.js' && n !== 'seed.js' && n !== 'errors.js' && n !== 'docs/openapi.js')) {
      expect([f, read(at(f)).split('\n')[0]]).toEqual([f, `${f.endsWith('.sql') ? '--' : '//'} ~/instagram-api/${f}`]);
    }
    for (const f of changed.filter((n) => !n.startsWith('prisma/migrations'))) {
      expect([f, /게이트|retrofit|TDD|하네스/.test(read(at(f)))]).toEqual([f, false]);
    }
  });
});

describe('축 ⑧ 다음 회차 판정 DB - test/fixtures/p3-57-end.sql(학생 낭독 DB · 마이그레이션 이름만 코드베이스 것)', () => {
  it('게시물 34(다음 54) · 노을 27 · 짝 29 · 인덱스 · 1번 좋아요 jaehoon · migrate deploy 가 적용할 것이 없다', async () => {
    const db = `${DB_PREFIX}_end`;
    const fixture = read(P('test/fixtures/p3-57-end.sql')).split('\n').filter((line) => !line.startsWith('\\')).join('\n');
    await dropDb(db);
    await admin((client) => client.query(`CREATE DATABASE ${db}`));
    await runSql(db, fixture);
    expect(await onDb(db, 'SELECT count(*)::int AS n FROM posts')).toEqual([{ n: 34 }]);
    expect(await onDb(db, "SELECT CASE WHEN is_called THEN last_value + 1 ELSE last_value END::int AS n FROM posts_id_seq")).toEqual([{ n: 54 }]);
    expect(await tagsOf(db)).toEqual([
      { name: '바다', post_count: 1 }, { name: '노을', post_count: 27 }, { name: 'sunset', post_count: 0 }, { name: '한강', post_count: 1 },
    ]);
    expect(await onDb(db, 'SELECT count(*)::int AS n FROM post_hashtags')).toEqual([{ n: 29 }]);
    expect((await onDb(db, "SELECT indexname FROM pg_indexes WHERE tablename = 'post_hashtags' ORDER BY indexname")).map((i) => i.indexname))
      .toContain('post_hashtags_hashtag_id_idx');
    expect(await onDb(db, 'SELECT p.like_count, (SELECT count(*)::int FROM post_likes l WHERE l.post_id = 1 AND l.user_id = 2) AS mine FROM posts p WHERE p.id = 1'))
      .toEqual([{ like_count: 131, mine: 1 }]);
    const out = migrate(version(2), db);
    expect(out).toMatch(/No pending migrations to apply/);
    await dropDb(db);
  }, 120_000);
});
