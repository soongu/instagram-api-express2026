// p3-56 「해시태그 저장」 게이트 — 백엔드(교안 Step 1~5 · 화면 코드는 바뀌지 않는다)
// 내부 검증 전용 — 교안에 한 줄도 인용하지 않는다.
//
// `8-fullstack-features` 여덟째 회차다(`curriculum.md` 「`p3-56` 착수 결정」 ①~⑦).
// 백엔드의 시작 판은 code/p3-55(ccbf0fb)의 학생 파일이다.
// 커밋 — Step 2 하나(테이블 둘 · 마이그레이션) · Step 3 하나(utils/hashtags.js · 만들 때 뽑아서 터미널에 찍기) ·
//        Step 4 하나(만들 때 저장) · Step 5 하나(고칠 때 · 지울 때). Step 1 은 코드가 바뀌지 않는다.
//        같은 «(Step N)» 표식이 여럿이면 가장 뒤 커밋이 그 Step 의 끝 판이다.
// 🔑 짓는 동안 `P356_WT` 를 주면 그 판을 커밋 대신 작업트리에서 읽는다 — `2` · `3` · `4` · `5`.
// 🔑 포트 — 3960 · 3961(둘째 서버) · `P356_PORT` 로 바꾼다. DB — `p356_api_` 로 시작하는 것만 만들고 지운다(`P356_DB_PREFIX` 로 바꾼다 — 판정 둘을 함께 돌릴 때). `P356_PG_PORT` 로 PostgreSQL 호스트 포트를 바꾼다.
// 🔑 판정 DB 는 «p3-55 를 마친 학생 DB» 다 — `test/fixtures/p3-55-end.sql` 은 낭독 판(`p355stu`, 교안 차례대로 따라온 학생 DB)을
//    `pg_dump --inserts` 로 뜬 것이다. 인계문(`progress/NEXT-SESSION-p3-56.md`)의 숫자와 같다 —
//    댓글 351(원댓글 45 · 답글 306) · `comment_count` 1:4 · 2:39 · 3:2 · 다음 댓글 361 · 게시물 7개 · 다음 게시물 26.
//    🚨 번호는 학생마다 다를 수 있다 — 판정은 시드 게시물(1~5) 밖의 번호를 응답에서 읽는다.
//
// 축 ⓪ 판정 DB — 위 숫자 · 글에 `#` 이 든 게시물 0
// 축 ① Step 1 — 시작 판에서 1번 게시물 글을 고치고 새 글을 «공유하기» 로 올린 뒤, 교안의 LIKE 문장이 `#노을빛` 글까지 내준다
// 축 ② Step 2 — 마이그레이션이 테이블 둘을 만든다 · 같은 이름 · 같은 짝은 23505 · 게시물을 지우면 짝도 지워진다
// 축 ③ Step 3 — extractHashtags 의 경우들 · 만들 때 뽑은 이름이 터미널에 찍힌다 · 30자 · 30개를 넘으면 400(아무것도 안 쓴다)
// 축 ④ Step 4 — 만들 때 태그와 짝이 저장된다 · post_count · 기능 전에 쓴 글은 연결이 없다 · 같은 새 태그를 동시에 둘이 만들어도 한 줄
// 축 ⑤ Step 5 — Step 4 판에서 고치면 짝과 숫자가 그대로(겪기) · 고친 판에서 빠진 태그 −1 · 새 태그 +1 · 그대로인 태그는 그대로 ·
//              사진 설명만 고치면 태그는 그대로 · 기능 전에 쓴 글은 고치기 한 번으로 연결 · 지우면 −1
// 축 ⑥ 회귀 — 게시물 목록 · 하나 · 만들기 · 고치기 · 지우기 응답의 모양이 시작 판과 같다
// 축 ⑦ 학생 파일 차이 — 시작 판에서 Step 5 판까지 바뀐 학생 파일 · 내부 어휘 · 경로 주석
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, mkdtempSync, rmSync, cpSync, symlinkSync, existsSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { boot } from './helpers/boot.js';

const ROOT = new URL('../', import.meta.url);
const P = (rel) => new URL(rel, ROOT).pathname;
const read = (path) => readFileSync(path, 'utf8');
const PG_PORT = Number(process.env.P356_PG_PORT ?? 5432);
const ADMIN = { host: 'localhost', port: PG_PORT, database: 'postgres', user: 'postgres', password: 'postgres' };
const DB_PREFIX = process.env.P356_DB_PREFIX ?? 'p356_api';
const TPL_DB = `${DB_PREFIX}_tpl`;
const GATE_DB = `${DB_PREFIX}_gate`;
const dbUrl = (name) => `postgresql://postgres:postgres@localhost:${PG_PORT}/${name}`;
const PORT = Number(process.env.P356_PORT ?? 3960);
const PORT2 = 3961;
const SECRET = 'q2Xh0v9bGm4RkT7sYp1wLc8nZf3uJd6eHa5iVo0rQyE';
const env = {
  CORS_ORIGIN: 'http://localhost:3001', JWT_SECRET: SECRET,
  GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret', SITE_URL: `http://localhost:${PORT}`,
  KAKAO_CLIENT_ID: 'test-kakao', KAKAO_CLIENT_SECRET: 'test-kakao-secret',
  NAVER_CLIENT_ID: 'test-naver', NAVER_CLIENT_SECRET: 'test-naver-secret',
};
const STUDENT_FILES = ['app.js', 'db.js', 'errors.js', 'responses.js', 'routes', 'controllers', 'services', 'middlewares', 'schemas', 'strategies', 'docs', 'utils', 'package.json', 'requests', 'seed.js', 'data', 'prisma', 'prisma.config.js', '.env.example', 'lab'];
const FIXTURE = P('test/fixtures/p3-55-end.sql');

const git = (args) => execFileSync('git', args, { cwd: P('.'), encoding: 'utf8', maxBuffer: 1 << 28 });
const hasRef = (ref) => {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', ref], { cwd: P('.'), stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
};
// 🔑 판의 선 — 북마크 code/p3-56 이 있으면 그것, 없으면 지금 체크아웃한 선(HEAD). `P356_LINE` 으로 바꾼다.
const LINE = process.env.P356_LINE ?? (hasRef('refs/heads/code/p3-56') ? 'code/p3-56' : 'HEAD');
const WT = process.env.P356_WT ?? null;
const START = process.env.P356_BASE ?? 'code/p3-55';
/** «(Step N)» 표식이 붙은 그 회차 커밋들 — 새것부터. */
const stepCommits = (n) => {
  const log = git(['log', '-n', '200', '--format=%H %s', LINE]);
  return log.split('\n').filter((l) => / feat\(p3-56\): /.test(l) && l.endsWith(`(Step ${n})`)).map((l) => l.split(' ')[0]);
};
const dirs = [];
const refDirs = new Map();
const refDir = (ref) => {
  if (refDirs.has(ref)) return refDirs.get(ref);
  const dir = mkdtempSync(join(tmpdir(), 'p356-ref-'));
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
  if (commits.length === 0) throw new Error(`p3-56 (Step ${step}) 커밋이 없다`);
  return commits[0];
};
/** 그 Step 의 끝 판 — `P356_WT` 가 그 Step 이면 작업트리. */
const version = (step) => (WT === String(step) ? worktree : refDir(versionRef(step)));
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
/** 템플릿 DB 를 복사한 판정 DB — 판마다 새로 세운다. */
const freshDb = (name = GATE_DB) => admin(async (client) => {
  await kick(client, name);
  await client.query(`DROP DATABASE IF EXISTS ${name}`);
  await kick(client, TPL_DB);
  await client.query(`CREATE DATABASE ${name} TEMPLATE ${TPL_DB}`);
});

/** 그 판의 마이그레이션을 판정 DB 에 건다 — 학생이 `npx prisma migrate dev` 로 거는 것과 같은 SQL 파일들. */
// 🚨 풀어 둔 판에는 node_modules 가 없어 prisma.config.js 가 `prisma/config` 를 못 찾는다 — 학생 사본(링크 있음)에서 돈다.
const migrate = (from, db) => execFileSync(P('node_modules/.bin/prisma'), ['migrate', 'deploy'], {
  cwd: studentDir(from), env: { ...process.env, DATABASE_URL: dbUrl(db) }, encoding: 'utf8', stdio: 'pipe',
});

const studentDir = (from) => {
  const dir = mkdtempSync(join(tmpdir(), 'p356-srv-'));
  for (const name of STUDENT_FILES) {
    if (existsSync(from(name))) cpSync(from(name), join(dir, name), { recursive: true });
  }
  symlinkSync(P('node_modules'), join(dir, 'node_modules'));
  dirs.push(dir);
  return dir;
};
/** 그 판의 학생 파일 사본을 `db` 로 띄운다. 🚨 그 판의 스키마로 클라이언트를 만든 node_modules 가 필요하다 — 아래 `generateFor`. */
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
// 🚨 Prisma 클라이언트는 node_modules 안에 하나뿐이다 — 판마다 그 판의 schema.prisma 로 다시 만든다.
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
/** 쿠키를 기억하는 탭 하나 — Access 토큰 쿠키만 기억한다. */
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
/** 화면 «공유하기» 처럼 — 사진을 먼저 올리고 그 주소로 게시물을 만든다. 만들기 응답을 그대로 돌려준다. */
const share = async (tab, content) => {
  const form = new FormData();
  form.append('images', new Blob([photo()], { type: 'image/jpeg' }), 'beach.jpg');
  const uploaded = await tab.send('POST', '/api/v2/uploads', form);
  expect(uploaded.status).toBe(201);
  return tab.send('POST', '/api/v2/posts', { imageUrls: uploaded.body.data.imageUrls, postAlt: '', content });
};
/** 화면 «고치기» 처럼 — 글만 보낸다. */
const edit = (tab, id, content) => tab.send('PATCH', `/api/v2/posts/${id}`, { content });

const tagsOf = (db) => onDb(db, 'SELECT name, post_count FROM hashtags ORDER BY id');
const linksOf = (db, postId) => onDb(db,
  'SELECT h.name FROM post_hashtags ph JOIN hashtags h ON h.id = ph.hashtag_id WHERE ph.post_id = $1 ORDER BY ph.id', [postId])
  .then((rows) => rows.map((row) => row.name));
const countOf = async (db, name) => (await onDb(db, 'SELECT post_count FROM hashtags WHERE name = $1', [name]))[0]?.post_count ?? null;

// 교안의 학생 흐름에 쓰는 글 — Step 1 은 시작 판에서, Step 3~5 는 각 판에서 «화면» 으로 쓴다.
const POST1_BEFORE = '퇴근길에 한강이 너무 예뻤어요';
const POST1_TAGGED = '퇴근길에 한강이 너무 예뻤어요 #노을 #한강';
const SKY = '#노을빛 하늘이 오래 남았어요 #한강';
const LIKE_SQL = "SELECT id, content FROM posts WHERE content LIKE '%#노을%';";

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

describe('축 ⓪ 판정 DB — p3-55 를 마친 학생 DB', () => {
  it('댓글 351 · 원댓글 45 · comment_count · 게시물 7개 · 글에 # 이 든 게시물 0 · 다음 번호', async () => {
    await freshDb();
    const [c] = await onDb(GATE_DB, 'SELECT count(*)::int AS n, count(*) FILTER (WHERE parent_id IS NULL)::int AS roots FROM comments');
    expect(c).toEqual({ n: 351, roots: 45 });
    const posts = await onDb(GATE_DB, 'SELECT id, comment_count, content FROM posts ORDER BY id');
    expect(posts.map((p) => p.id)).toEqual([1, 2, 3, 4, 5, 9, 14]);
    expect(posts.map((p) => p.comment_count)).toEqual([4, 39, 2, 0, 0, 0, 0]);
    expect(posts.filter((p) => p.content?.includes('#'))).toEqual([]);
    expect(posts[0].content).toBe(POST1_BEFORE);
    const [seq] = await onDb(GATE_DB, "SELECT last_value::int AS posts FROM posts_id_seq");
    expect(seq.posts).toBe(25);
  });
});

describe('축 ① Step 1 — 글자로 찾으면', () => {
  it('시작 판에서 1번 글에 태그를 넣고 #노을빛 글을 올리면 LIKE 가 두 글을 다 준다 · 해시태그 테이블은 아직 없다', async () => {
    await freshDb();
    await serve('start', GATE_DB, async ({ base }) => {
      const jaehoon = await loggedIn(base, 'jaehoon');
      expect((await edit(jaehoon, 1, POST1_TAGGED)).status).toBe(200);
      const sky = await share(jaehoon, SKY);
      expect([sky.status, sky.body.data.id]).toEqual([201, 26]);
    });
    const rows = await onDb(GATE_DB, LIKE_SQL);
    expect(rows).toEqual([{ id: 1, content: POST1_TAGGED }, { id: 26, content: SKY }]);
    const tables = await onDb(GATE_DB, "SELECT to_regclass('hashtags') AS t");
    expect(tables[0].t).toBeNull();
  }, 60_000);
});

describe.runIf(hasStep(2))('축 ② Step 2 — 테이블 둘', () => {
  it('마이그레이션이 hashtags · post_hashtags 를 만들고 둘 다 비어 있다 · 1번 글은 그대로', async () => {
    await freshDb();
    const out = migrate(version(2), GATE_DB);
    expect(out).toMatch(/Applying migration `\d{14}_add_hashtags`/);
    expect(await onDb(GATE_DB, 'SELECT count(*)::int AS n FROM hashtags')).toEqual([{ n: 0 }]);
    expect(await onDb(GATE_DB, 'SELECT count(*)::int AS n FROM post_hashtags')).toEqual([{ n: 0 }]);
    const cols = await onDb(GATE_DB, "SELECT column_name, data_type, character_maximum_length AS len, column_default AS def FROM information_schema.columns WHERE table_name = 'hashtags' ORDER BY ordinal_position");
    expect(cols.map((c) => [c.column_name, c.data_type, c.len])).toEqual([
      ['id', 'integer', null], ['name', 'character varying', 30], ['post_count', 'integer', null]]);
    expect(cols[2].def).toBe('0');
  }, 60_000);

  it('같은 이름 · 같은 짝은 23505 · 게시물을 지우면 짝도 지워진다 · 태그 줄은 남는다', async () => {
    await freshDb();
    migrate(version(2), GATE_DB);
    const [{ id: tag }] = await onDb(GATE_DB, "INSERT INTO hashtags (name) VALUES ('노을') RETURNING id");
    await expect(onDb(GATE_DB, "INSERT INTO hashtags (name) VALUES ('노을')")).rejects.toMatchObject({ code: '23505' });
    await onDb(GATE_DB, 'INSERT INTO post_hashtags (post_id, hashtag_id) VALUES (5, $1)', [tag]);
    await expect(onDb(GATE_DB, 'INSERT INTO post_hashtags (post_id, hashtag_id) VALUES (5, $1)', [tag])).rejects.toMatchObject({ code: '23505' });
    await expect(onDb(GATE_DB, "INSERT INTO hashtags (name) VALUES ($1)", ['가'.repeat(31)])).rejects.toMatchObject({ code: '22001' });
    await onDb(GATE_DB, 'DELETE FROM posts WHERE id = 5');
    expect(await onDb(GATE_DB, 'SELECT count(*)::int AS n FROM post_hashtags')).toEqual([{ n: 0 }]);
    expect(await tagsOf(GATE_DB)).toEqual([{ name: '노을', post_count: 0 }]);
  });
});

describe.runIf(hasStep(3))('축 ③ Step 3 — 본문에서 뽑기', () => {
  let extractHashtags;
  let BadRequestError;
  beforeAll(async () => {
    const from = version(3);
    // 🚨 tmpdir 의 /var 는 /private/var 의 링크다 — 실제 경로로 불러야 utils 가 부르는 errors.js 와 같은 모듈이 된다.
    const dir = realpathSync(studentDir(from));
    ({ extractHashtags } = await import(pathToFileURL(join(dir, 'utils/hashtags.js')).href));
    ({ BadRequestError } = await import(pathToFileURL(join(dir, 'errors.js')).href));
  });

  it.each([
    ['퇴근길에 한강이 너무 예뻤어요 #노을 #한강', ['노을', '한강']],
    ['#노을빛 하늘이 오래 남았어요 #한강', ['노을빛', '한강']],
    ['#Hangang #hangang #HANGANG', ['hangang']],
    ['#노을 #바다 #노을', ['노을', '바다']],
    ['#노을#바다', ['노을', '바다']],
    ['오늘은 #노을, 내일은 #바다!', ['노을', '바다']],
    ['##노을', ['노을']],
    ['# 노을', []],
    ['#ㅋㅋㅋ 너무 좋아요', []],
    ['C# 공부 중 #개발_일지', ['개발_일지']],
    ['#2026 첫 노을', ['2026']],
    ['태그가 없는 글', []],
    ['', []],
    [undefined, []],
    [null, []],
  ])('%j → %j', (content, names) => {
    expect(extractHashtags(content)).toEqual(names);
  });

  it('30자는 되고 31자는 400 HASHTAG_TOO_LONG · 30개는 되고 31개는 400 TOO_MANY_HASHTAGS · 같은 태그를 31번 써도 하나', () => {
    expect(extractHashtags(`#${'가'.repeat(30)}`)).toEqual(['가'.repeat(30)]);
    const long = () => extractHashtags(`#노을 #${'가'.repeat(31)}`);
    expect(long).toThrow(BadRequestError);
    expect(long).toThrow('해시태그는 30자까지 쓸 수 있어요');
    const tags = (n) => Array.from({ length: n }, (_, i) => `#tag${i + 1}`).join(' ');
    expect(extractHashtags(tags(30))).toHaveLength(30);
    expect(() => extractHashtags(tags(31))).toThrow('해시태그는 게시물 하나에 30개까지 쓸 수 있어요');
    expect(extractHashtags('#노을 '.repeat(31))).toEqual(['노을']);
  });

  it('Step 3 판 — 만들 때 뽑은 이름이 터미널에 찍히고 아직 저장하지 않는다 · 31자 태그는 400 이고 게시물이 생기지 않는다', async () => {
    await freshDb();
    migrate(version(3), GATE_DB);
    await serve(3, GATE_DB, async ({ base, tail }) => {
      const jaehoon = await loggedIn(base, 'jaehoon');
      const ok = await share(jaehoon, '바다 보러 왔어요 #바다 #노을 #바다');
      expect(ok.status).toBe(201);
      expect(tail()).toContain("뽑은 해시태그: [ '바다', '노을' ]");
      const bad = await share(jaehoon, `#${'가'.repeat(31)}`);
      expect([bad.status, bad.body.error.code, bad.body.error.message]).toEqual([400, 'HASHTAG_TOO_LONG', '해시태그는 30자까지 쓸 수 있어요']);
    });
    expect(await onDb(GATE_DB, 'SELECT count(*)::int AS n FROM hashtags')).toEqual([{ n: 0 }]);
    expect((await onDb(GATE_DB, 'SELECT id FROM posts WHERE id > 25 ORDER BY id')).map((r) => r.id)).toEqual([26]);
  }, 60_000);
});

describe.runIf(hasStep(4))('축 ④ Step 4 — 만들 때 함께 저장', () => {
  it('태그와 짝이 저장되고 post_count 가 오른다 · 같은 태그를 두 번 써도 짝 하나 · 400 이면 태그도 게시물도 안 생긴다 · 기능 전에 쓴 1번 글은 연결이 없다', async () => {
    await freshDb();
    await serve('start', GATE_DB, async ({ base }) => {
      const jaehoon = await loggedIn(base, 'jaehoon');
      expect((await edit(jaehoon, 1, POST1_TAGGED)).status).toBe(200);
      expect((await share(jaehoon, SKY)).status).toBe(201);
    });
    migrate(version(4), GATE_DB);
    let ids;
    await serve(4, GATE_DB, async ({ base, tail }) => {
      const jaehoon = await loggedIn(base, 'jaehoon');
      const a = await share(jaehoon, '바다 보러 왔어요 #바다 #노을 #바다');
      const b = await share(jaehoon, '#노을 질 때 다시 왔어요');
      expect([a.status, b.status]).toEqual([201, 201]);
      ids = [a.body.data.id, b.body.data.id];
      const bad = await share(jaehoon, `#새태그 #${'가'.repeat(31)}`);
      expect(bad.status).toBe(400);
      expect(tail()).not.toContain('뽑은 해시태그');
    });
    expect(ids).toEqual([27, 28]);
    expect(await tagsOf(GATE_DB)).toEqual([{ name: '바다', post_count: 1 }, { name: '노을', post_count: 2 }]);
    expect(await linksOf(GATE_DB, 27)).toEqual(['바다', '노을']);
    expect(await linksOf(GATE_DB, 28)).toEqual(['노을']);
    expect(await linksOf(GATE_DB, 1)).toEqual([]);
    expect(await linksOf(GATE_DB, 26)).toEqual([]);
    expect((await onDb(GATE_DB, 'SELECT max(id)::int AS id FROM posts'))[0].id).toBe(28);
  }, 60_000);

  it('처음 보는 같은 태그로 게시물 둘을 동시에 만들어도 둘 다 201 · 태그 줄 하나 · post_count 2', async () => {
    await freshDb();
    migrate(version(4), GATE_DB);
    await serve(4, GATE_DB, async ({ base }) => {
      const jaehoon = await loggedIn(base, 'jaehoon');
      const seoyeon = await loggedIn(base, 'seoyeon');
      for (let round = 0; round < 5; round++) {
        const name = `동시${round}`;
        const [x, y] = await Promise.all([share(jaehoon, `#${name}`), share(seoyeon, `#${name}`)]);
        expect([name, x.status, y.status]).toEqual([name, 201, 201]);
        expect(await onDb(GATE_DB, 'SELECT name, post_count FROM hashtags WHERE name = $1', [name])).toEqual([{ name, post_count: 2 }]);
      }
    });
  }, 60_000);
});

describe.runIf(hasStep(5))('축 ⑤ Step 5 — 고칠 때 · 지울 때', () => {
  /** Step 4 판까지 학생 흐름 — 1번 글 고치기(시작 판) · #노을빛 글(시작 판) · 27 · 28(Step 4 판). */
  const toStep4End = async () => {
    await freshDb();
    await serve('start', GATE_DB, async ({ base }) => {
      const jaehoon = await loggedIn(base, 'jaehoon');
      expect((await edit(jaehoon, 1, POST1_TAGGED)).status).toBe(200);
      expect((await share(jaehoon, SKY)).status).toBe(201);
    });
    migrate(version(4), GATE_DB);
    await serve(4, GATE_DB, async ({ base }) => {
      const jaehoon = await loggedIn(base, 'jaehoon');
      expect((await share(jaehoon, '바다 보러 왔어요 #바다 #노을 #바다')).status).toBe(201);
      expect((await share(jaehoon, '#노을 질 때 다시 왔어요')).status).toBe(201);
    });
  };

  it('겪기 — Step 4 판에서 27번 글의 #노을 을 빼도 짝과 숫자가 그대로다', async () => {
    await toStep4End();
    await serve(4, GATE_DB, async ({ base }) => {
      const jaehoon = await loggedIn(base, 'jaehoon');
      expect((await edit(jaehoon, 27, '바다 보러 왔어요 #바다')).status).toBe(200);
    });
    expect(await linksOf(GATE_DB, 27)).toEqual(['바다', '노을']);
    expect(await countOf(GATE_DB, '노을')).toBe(2);
  }, 60_000);

  it('고친 판 — 빠진 태그 −1 · 새 태그 +1 · 그대로인 태그는 그대로 · 사진 설명만 고치면 그대로 · 1번 글은 고치기 한 번으로 연결 · 지우면 −1 · 0 이 된 태그 줄은 남는다', async () => {
    await toStep4End();
    await serve(5, GATE_DB, async ({ base }) => {
      const jaehoon = await loggedIn(base, 'jaehoon');
      // 27 — #노을 을 빼고 #여름 을 넣는다
      const res = await edit(jaehoon, 27, '바다 보러 왔어요 #바다 #여름');
      expect(res.status).toBe(200);
      expect(res.body.data.content).toBe('바다 보러 왔어요 #바다 #여름');
      expect(await linksOf(GATE_DB, 27)).toEqual(['바다', '여름']);
      expect(await tagsOf(GATE_DB)).toEqual([{ name: '바다', post_count: 1 }, { name: '노을', post_count: 1 }, { name: '여름', post_count: 1 }]);
      // 같은 글로 다시 고치면 아무것도 안 바뀐다
      const [before] = await onDb(GATE_DB, 'SELECT max(id)::int AS id FROM post_hashtags');
      expect((await edit(jaehoon, 27, '바다 보러 왔어요 #바다 #여름')).status).toBe(200);
      const [after] = await onDb(GATE_DB, 'SELECT max(id)::int AS id FROM post_hashtags');
      expect(after.id).toBe(before.id);
      // 사진 설명만 고치면 태그는 그대로
      expect((await jaehoon.send('PATCH', '/api/v2/posts/27', { postAlt: '바닷가' })).status).toBe(200);
      expect(await linksOf(GATE_DB, 27)).toEqual(['바다', '여름']);
      // 기능 전에 쓴 1번 글 — 글을 그대로 두고 «저장» 만 눌러도 연결된다
      expect((await edit(jaehoon, 1, POST1_TAGGED)).status).toBe(200);
      expect(await linksOf(GATE_DB, 1)).toEqual(['노을', '한강']);
      expect(await countOf(GATE_DB, '노을')).toBe(2);
      expect(await countOf(GATE_DB, '한강')).toBe(1);
      // 28 을 지우면 #노을 −1 · 짝도 지워진다
      expect((await jaehoon.send('DELETE', '/api/v2/posts/28')).status).toBe(200);
      expect(await countOf(GATE_DB, '노을')).toBe(1);
      expect(await onDb(GATE_DB, 'SELECT count(*)::int AS n FROM post_hashtags WHERE post_id = 28')).toEqual([{ n: 0 }]);
      // 27 에서 태그를 다 빼면 여름은 0 이 되고 줄은 남는다
      expect((await edit(jaehoon, 27, '바다 보러 왔어요')).status).toBe(200);
      expect(await countOf(GATE_DB, '여름')).toBe(0);
      expect(await linksOf(GATE_DB, 27)).toEqual([]);
      // 고칠 때도 31자 태그는 400 이고 글은 그대로다
      const bad = await edit(jaehoon, 1, `#${'가'.repeat(31)}`);
      expect([bad.status, bad.body.error.code]).toEqual([400, 'HASHTAG_TOO_LONG']);
      expect((await onDb(GATE_DB, 'SELECT content FROM posts WHERE id = 1'))[0].content).toBe(POST1_TAGGED);
    });
    // 숫자는 짝 수와 같다
    const drift = await onDb(GATE_DB, 'SELECT h.name FROM hashtags h WHERE h.post_count <> (SELECT count(*) FROM post_hashtags ph WHERE ph.hashtag_id = h.id)');
    expect(drift).toEqual([]);
  }, 90_000);

  it('남의 게시물을 고치려 하면 403 이고 태그는 그대로다', async () => {
    await toStep4End();
    await serve(5, GATE_DB, async ({ base }) => {
      const seoyeon = await loggedIn(base, 'seoyeon');
      expect((await edit(seoyeon, 27, '#가로채기')).status).toBe(403);
    });
    expect(await linksOf(GATE_DB, 27)).toEqual(['바다', '노을']);
    expect(await onDb(GATE_DB, "SELECT count(*)::int AS n FROM hashtags WHERE name = '가로채기'")).toEqual([{ n: 0 }]);
  }, 60_000);
});

describe.runIf(hasStep(5))('축 ⑥ 회귀 — 응답의 모양은 시작 판과 같다', () => {
  it('목록 · 하나 · 만들기 · 고치기 · 지우기 응답의 키', async () => {
    const keysOf = async (step) => {
      await freshDb();
      if (step !== 'start') migrate(version(step), GATE_DB);
      return serve(step, GATE_DB, async ({ base }) => {
        const jaehoon = await loggedIn(base, 'jaehoon');
        const list = await jaehoon.get('/api/v2/posts?limit=2');
        const one = await jaehoon.get('/api/v2/posts/1');
        const made = await share(jaehoon, '#바다');
        const edited = await edit(jaehoon, made.body.data.id, '#노을');
        const removed = await jaehoon.send('DELETE', `/api/v2/posts/${made.body.data.id}`);
        const k = (o) => Object.keys(o).sort();
        return { list: k(list.body.data.items[0]), one: k(one.body.data), made: k(made.body.data), edited: k(edited.body.data), removed: k(removed.body.data), statuses: [list.status, one.status, made.status, edited.status, removed.status] };
      });
    };
    const before = await keysOf('start');
    const after = await keysOf(5);
    expect(after).toEqual(before);
    expect(after.statuses).toEqual([200, 200, 201, 200, 200]);
  }, 90_000);
});

describe.runIf(hasStep(5))('축 ⑦ 학생 파일 차이', () => {
  it('시작 판에서 Step 5 판까지 바뀐 학생 파일 · 내부 어휘 없음 · 새 파일의 첫 줄 경로 주석', () => {
    const to = WT === '5' ? null : versionRef(5);
    const changed = git(['diff', '--name-only', START, ...(to ? [to] : []), '--', ...STUDENT_FILES]).trim().split('\n').filter(Boolean);
    expect(changed.filter((f) => !f.startsWith('lab/') && !f.startsWith('prisma/migrations/'))).toEqual(
      ['errors.js', 'prisma/schema.prisma', 'services/postService.js', 'utils/hashtags.js']);
    expect(changed.filter((f) => f.startsWith('prisma/migrations/'))).toHaveLength(1);
    const from = version(5);
    expect(read(from('utils/hashtags.js')).split('\n')[0]).toBe('// ~/instagram-api/utils/hashtags.js');
    for (const file of ['utils/hashtags.js', 'services/postService.js', 'errors.js']) {
      expect([file, read(from(file))]).not.toEqual([file, expect.stringMatching(/게이트|TDD|retrofit|하네스|교안/)]);
    }
  });
});

// 축 ⑧ 학생 한 사람의 흐름 — 한 DB 에서 시작 판 → Step 2 → 3 → 4 → 5 의 판을 차례로 갈아 끼우며 교안이 시키는 조작을 그대로 한다.
//   화면의 «공유하기» · «고치기»(«완료» 는 글을 안 바꿔도 PATCH 를 보낸다) · «삭제» 를 같은 요청으로 보낸다.
//   교안의 숫자(게시물 번호 · SQL 결과 · 터미널 줄)는 모두 이 흐름의 값이다 — 장면마다 DB 를 새로 세운 위 축들과 숫자가 다르다.
export const FLOW = {
  step3: '바다 보러 왔어요 #바다 #노을 #바다',
  tooLong: '한강에서 #오늘은퇴근하고한강공원에서노을이질때까지걷다가사진을많이찍었어요',
  step4a: '노을 보러 또 왔어요 #바다 #노을',
  step4b: '#노을 질 때 다시 왔어요 #Sunset',
  step5: '#노을 질 때 다시 왔어요',
};
describe.runIf(hasStep(5))('축 ⑧ 학생 한 사람의 흐름 — 켠 채로 교안 차례대로', () => {
  it('Step 1 → 5 의 숫자', async () => {
    expect([...FLOW.tooLong.split('#')[1]].length).toBe(32);
    await freshDb();
    const log = [];
    const tags = async () => (await onDb(GATE_DB, 'SELECT id, name, post_count FROM hashtags ORDER BY id')).map((t) => `${t.id}:${t.name}:${t.post_count}`);
    const links = async () => (await onDb(GATE_DB, 'SELECT id, post_id, hashtag_id FROM post_hashtags ORDER BY id')).map((r) => `${r.id}:${r.post_id}-${r.hashtag_id}`);
    // Step 1 — 시작 판
    await serve('start', GATE_DB, async ({ base }) => {
      const jaehoon = await loggedIn(base, 'jaehoon');
      expect((await edit(jaehoon, 1, POST1_TAGGED)).status).toBe(200);
      expect((await share(jaehoon, SKY)).body.data.id).toBe(26);
    });
    expect(await onDb(GATE_DB, LIKE_SQL)).toEqual([{ id: 1, content: POST1_TAGGED }, { id: 26, content: SKY }]);
    expect(await onDb(GATE_DB, "SELECT id, content FROM posts WHERE content LIKE '%#한강 %';")).toEqual([]);
    // Step 2
    migrate(version(2), GATE_DB);
    expect(await tags()).toEqual([]);
    // Step 3
    await serve(3, GATE_DB, async ({ base, tail }) => {
      const jaehoon = await loggedIn(base, 'jaehoon');
      expect((await share(jaehoon, FLOW.step3)).body.data.id).toBe(27);
      const bad = await share(jaehoon, FLOW.tooLong);
      expect([bad.status, bad.body.error.message]).toEqual([400, '해시태그는 30자까지 쓸 수 있어요']);
      log.push(...tail().split('\n').filter((l) => l.startsWith('뽑은 해시태그')));
    });
    expect(log).toEqual(["뽑은 해시태그: [ '바다', '노을' ]"]);
    expect(await tags()).toEqual([]);
    // Step 4
    await serve(4, GATE_DB, async ({ base }) => {
      const jaehoon = await loggedIn(base, 'jaehoon');
      expect((await share(jaehoon, FLOW.step4a)).body.data.id).toBe(28);
      expect((await share(jaehoon, FLOW.step4b)).body.data.id).toBe(29);
      expect(await tags()).toEqual(['1:바다:1', '2:노을:2', '4:sunset:1']);
      expect(await links()).toEqual(['1:28-1', '2:28-2', '3:29-2', '4:29-4']);
      // 🚨 sunset 이 3 이 아니라 4 다 — 29번의 노을 upsert 가 ON CONFLICT 로 끝나면서도 번호 3 을 하나 써 버렸다.
      for (const id of [1, 26, 27]) expect(await linksOf(GATE_DB, id)).toEqual([]);
      // 겪기 — #Sunset 을 빼도 그대로
      expect((await edit(jaehoon, 29, FLOW.step5)).status).toBe(200);
      expect(await tags()).toEqual(['1:바다:1', '2:노을:2', '4:sunset:1']);
      expect(await links()).toEqual(['1:28-1', '2:28-2', '3:29-2', '4:29-4']);
    });
    // Step 5
    await serve(5, GATE_DB, async ({ base }) => {
      const jaehoon = await loggedIn(base, 'jaehoon');
      expect((await edit(jaehoon, 29, FLOW.step5)).status).toBe(200);
      expect(await tags()).toEqual(['1:바다:1', '2:노을:2', '4:sunset:0']);
      expect(await links()).toEqual(['1:28-1', '2:28-2', '3:29-2']);
      expect((await edit(jaehoon, 1, POST1_TAGGED)).status).toBe(200);
      expect(await tags()).toEqual(['1:바다:1', '2:노을:3', '4:sunset:0', '6:한강:1']);
      expect(await links()).toEqual(['1:28-1', '2:28-2', '3:29-2', '5:1-2', '6:1-6']);
      expect((await edit(jaehoon, 27, FLOW.step3)).status).toBe(200);
      expect(await tags()).toEqual(['1:바다:2', '2:노을:4', '4:sunset:0', '6:한강:1']);
      expect(await links()).toEqual(['1:28-1', '2:28-2', '3:29-2', '5:1-2', '6:1-6', '7:27-1', '8:27-2']);
      expect((await jaehoon.send('DELETE', '/api/v2/posts/27')).status).toBe(200);
      expect(await tags()).toEqual(['1:바다:1', '2:노을:3', '4:sunset:0', '6:한강:1']);
      expect(await links()).toEqual(['1:28-1', '2:28-2', '3:29-2', '5:1-2', '6:1-6']);
    });
    expect(await linksOf(GATE_DB, 26)).toEqual([]);
    const drift = await onDb(GATE_DB, 'SELECT h.name FROM hashtags h WHERE h.post_count <> (SELECT count(*) FROM post_hashtags ph WHERE ph.hashtag_id = h.id)');
    expect(drift).toEqual([]);
  }, 120_000);
});
