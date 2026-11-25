// p3-59 「프로필 사진 바꾸기」 게이트 - 백엔드(교안 Step 2 · 3 · 4 · 5)
// 내부 검증 전용 - 교안에 한 줄도 인용하지 않는다.
//
// `8-fullstack-features` 열한째 회차다(`curriculum.md` 「`p3-59` 착수 결정」 ①~⑧).
// 백엔드의 시작 판은 code/p3-58(24f411d)의 학생 파일이다.
// 커밋 - Step 2 하나(사진 주소 적기 - 맨 판) · Step 4 하나(기록에 «프로필에 썼다») · Step 5 하나(앞 사진 치우기).
//        같은 «(Step N)» 표식이 여럿이면 가장 뒤 feat 커밋이 그 Step 의 끝 판이다.
//        Step 3 은 코드가 안 바뀐다 - Step 2 판에서 겪는다.
// 🔑 포트 - 3990 · 3991 · `P359_PORT` 로 바꾼다. DB - `p359_api_` 로 시작하는 것만 만들고 지운다.
// 🔑 판정 DB 는 «p3-58 을 마친 학생 DB» 다 - p3-58 은 남는 DB 쓰기가 없어 `test/fixtures/p3-57-end.sql` 그대로다.
//    사람 22명 · 사진이 있는 사람 넷(dahye · jaehoon · minji · seungwoo) · uploads 기록 4(전부 게시물에 씀).
//
// 축 ⓪ 판정 DB · 축 ① Step 2 사진 주소 적기 · 축 ② Step 3 한 시간 뒤 · 축 ③ Step 4 기록에 «프로필에 썼다» · 축 ④ Step 5 앞 사진 치우기
// 축 ⑤ 직접 해보기 1 글쓴이 사진 적기 · 축 ⑥ 과제 [기초] 글쓴이 사진 지우기
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
const PG_PORT = Number(process.env.P359_PG_PORT ?? 5432);
const ADMIN = { host: 'localhost', port: PG_PORT, database: 'postgres', user: 'postgres', password: 'postgres' };
const DB_PREFIX = process.env.P359_DB_PREFIX ?? 'p359_api';
const TPL_DB = `${DB_PREFIX}_tpl`;
const GATE_DB = `${DB_PREFIX}_gate`;
const dbUrl = (name) => `postgresql://postgres:postgres@localhost:${PG_PORT}/${name}`;
const PORT = Number(process.env.P359_PORT ?? 3990);
const PORT2 = 3991;
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
// 🔑 판의 선 - 북마크 code/p3-59 이 있으면 그것, 없으면 지금 체크아웃한 선(HEAD). `P359_LINE` 으로 바꾼다.
const LINE = process.env.P359_LINE ?? (hasRef('refs/heads/code/p3-59') ? 'code/p3-59' : 'HEAD');
const WT = process.env.P359_WT ?? null;
const START = process.env.P359_BASE ?? 'code/p3-58';
/** «(Step N)» 표식이 붙은 그 회차 커밋들 - 새것부터. */
const stepCommits = (n) => {
  const log = git(['log', '-n', '200', '--format=%H %s', LINE]);
  return log.split('\n').filter((l) => / feat\(p3-59\): /.test(l) && l.endsWith(`(Step ${n})`)).map((l) => l.split(' ')[0]);
};
const dirs = [];
const refDirs = new Map();
const refDir = (ref) => {
  if (refDirs.has(ref)) return refDirs.get(ref);
  const dir = mkdtempSync(join(tmpdir(), 'p359-ref-'));
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
  if (commits.length === 0) throw new Error(`p3-59 (Step ${step}) 커밋이 없다`);
  return commits[0];
};
/** 그 Step 의 끝 판 - `P359_WT` 가 그 Step 이면 작업트리. */
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
  const dir = mkdtempSync(join(tmpdir(), 'p359-srv-'));
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

const PHOTO = '/api/v2/members/me/profile-image';
const JAEHOON_ID = 2;
const CLEANED = (n) => `아무 게시물에도 쓰이지 않은 사진 ${n}장을 지웠어요.`;
const CLEANED_V4 = (n) => `아무 데도 쓰이지 않은 사진 ${n}장을 지웠어요.`;
/** 화면처럼 - 사진 한 장을 올리고 받은 주소를 돌려준다. */
const upload = async (tab) => {
  const form = new FormData();
  form.append('images', new Blob([photo()], { type: 'image/jpeg' }), 'beach.jpg');
  const res = await tab.send('POST', '/api/v2/uploads', form);
  expect(res.status).toBe(201);
  return res.body.data.imageUrls[0];
};
const setPhoto = (tab, imageUrl) => tab.send('PUT', PHOTO, { imageUrl });
const fileStatus = async (base, imageUrl) => (await fetch(`${base}${imageUrl}`)).status;
/** 같은 학생 폴더에서 서버를 다시 켠다 - 학생이 `npm run dev` 를 껐다 켜는 것과 같다(uploads 폴더가 그대로 남는다). */
const rebootIn = async (dir, db, fn, port = PORT) => {
  const srv = await boot(join(dir, 'app.js'), {
    port, cwd: dir, env: { ...env, DATABASE_URL: dbUrl(db), PORT: String(port) }, ready: `${port}번 포트에서`,
  });
  try {
    // 뜰 때 한 번 도는 청소가 끝나기를 잠깐 기다린다.
    await new Promise((r) => setTimeout(r, 1500));
    return await fn({ ...srv, base: `http://localhost:${port}` });
  } finally {
    await Promise.race([srv.stop(), new Promise((r) => setTimeout(r, 500))]);
  }
};
/** 교안 Step 3 의 SQL 그대로 - 아직 아무 게시물에도 안 쓴 기록의 올린 시각을 2시간 앞당긴다. */
const BACKDATE = "UPDATE uploads SET created_at = created_at - INTERVAL '2 hours' WHERE post_id IS NULL;";

describe('축 ⓪ 판정 DB - p3-58 을 마친 학생 DB', () => {
  it('사람 22명 · 사진이 있는 사람 넷 · me 는 사진이 없다 · uploads 기록 4(전부 게시물에 씀)', async () => {
    await freshDb();
    expect((await onDb(GATE_DB, 'SELECT count(*)::int AS n FROM users'))[0].n).toBe(22);
    const withPhoto = await onDb(GATE_DB, 'SELECT username FROM users WHERE profile_image IS NOT NULL ORDER BY username');
    expect(withPhoto.map((u) => u.username)).toEqual(['dahye', 'jaehoon', 'minji', 'seungwoo']);
    // sora 는 사진이 없지만 비밀번호도 없다(해싱 전에 가입) - 로그인할 수 없어 수업은 jaehoon 으로 한다.
    expect(await onDb(GATE_DB, "SELECT profile_image, password_hash FROM users WHERE username = 'sora'")).toEqual([{ profile_image: null, password_hash: null }]);
    expect(await onDb(GATE_DB, "SELECT id, profile_image FROM users WHERE username = 'jaehoon'"))
      .toEqual([{ id: JAEHOON_ID, profile_image: 'https://picsum.photos/seed/jaehoon/40/40' }]);
    expect(await onDb(GATE_DB, 'SELECT count(*)::int AS n, count(post_id)::int AS used FROM uploads')).toEqual([{ n: 4, used: 4 }]);
  });
});

describe('축 ① Step 2 - 사진 주소 적기(맨 판)', () => {
  it('시작 판에는 주소가 없다 - 404 ROUTE_NOT_FOUND', async () => {
    await freshDb();
    await serve('start', GATE_DB, async ({ base }) => {
      const tab = await loggedIn(base, 'jaehoon');
      const res = await setPhoto(tab, '/uploads/x.jpg');
      expect([res.status, res.body.error.code]).toEqual([404, 'ROUTE_NOT_FOUND']);
    });
  });

  it('올린 주소를 적으면 200 { profileImage } · «나는 누구» 와 프로필 헤더가 그 주소 · 파일이 열린다', async () => {
    await freshDb();
    await serve(2, GATE_DB, async ({ base }) => {
      const tab = await loggedIn(base, 'jaehoon');
      const imageUrl = await upload(tab);
      expect(imageUrl).toMatch(/^\/uploads\/[0-9a-f-]{36}\.jpg$/);
      const res = await setPhoto(tab, imageUrl);
      expect(res).toEqual({ status: 200, body: { data: { profileImage: imageUrl } } });
      expect((await tab.get('/api/v2/auth/me')).body.data.profileImage).toBe(imageUrl);
      expect((await tab.get('/api/v2/profiles/jaehoon')).body.data.profileImage).toBe(imageUrl);
      expect(await fileStatus(base, imageUrl)).toBe(200);
    });
  });

  it('우리 서버의 사진 주소가 아니면 400 VALIDATION_FAILED · 로그인 안 하면 401 · GET 은 405', async () => {
    await freshDb();
    await serve(2, GATE_DB, async ({ base }) => {
      const tab = await loggedIn(base, 'jaehoon');
      const outside = await setPhoto(tab, 'https://picsum.photos/seed/jaehoon/150/150');
      expect([outside.status, outside.body.error.code]).toEqual([400, 'VALIDATION_FAILED']);
      const empty = await tab.send('PUT', PHOTO, {});
      expect([empty.status, empty.body.error.code]).toEqual([400, 'VALIDATION_FAILED']);
      const nobody = await browser(base).send('PUT', PHOTO, { imageUrl: '/uploads/x.jpg' });
      expect([nobody.status, nobody.body.error.code]).toEqual([401, 'LOGIN_REQUIRED']);
      const get = await tab.get(PHOTO);
      expect(get.status).toBe(405);
    });
  });
});

describe('축 ② Step 3 - 한 시간 뒤에 사라진다(Step 2 판에서 겪기)', () => {
  it('올린 시각을 2시간 앞당기고 서버를 다시 켜면 청소가 프로필 사진을 지운다 - 사용자의 주소는 그대로라 사진이 깨진다', async () => {
    await freshDb();
    const from = version(2);
    generateFor(from);
    const dir = studentDir(from);
    let imageUrl;
    await rebootIn(dir, GATE_DB, async ({ base, tail }) => {
      const tab = await loggedIn(base, 'jaehoon');
      imageUrl = await upload(tab);
      expect((await setPhoto(tab, imageUrl)).status).toBe(200);
      expect(tail()).not.toContain('장을 지웠어요');
    });
    expect(await onDb(GATE_DB, BACKDATE)).toEqual([]);
    await rebootIn(dir, GATE_DB, async ({ base, tail }) => {
      expect(tail()).toContain(CLEANED(1));
      expect(await fileStatus(base, imageUrl)).toBe(404);
      const tab = await loggedIn(base, 'jaehoon');
      expect((await tab.get('/api/v2/auth/me')).body.data.profileImage).toBe(imageUrl);
    });
    expect(await onDb(GATE_DB, 'SELECT count(*)::int AS n FROM uploads')).toEqual([{ n: 4 }]);
  });

  it('맨 판의 구멍 둘 - 남이 올린 사진도 적힌다 · 프로필로 쓴 사진으로 게시물도 만들어진다', async () => {
    await freshDb();
    await serve(2, GATE_DB, async ({ base }) => {
      const me = await loggedIn(base, 'jaehoon');
      const seoyeon = await loggedIn(base, 'seoyeon');
      const myPhoto = await upload(me);
      expect((await setPhoto(seoyeon, myPhoto)).status).toBe(200);
      const mine = await upload(me);
      expect((await setPhoto(me, mine)).status).toBe(200);
      const post = await me.send('POST', '/api/v2/posts', { imageUrls: [mine], postAlt: '', content: '프로필 사진으로 글' });
      expect(post.status).toBe(201);
    });
  });
});

describe('축 ③ Step 4 - 기록에 «프로필에 썼다»', () => {
  it('마이그레이션이 uploads 에 profile_user_id(NULL 허용 · UNIQUE · users FK)를 더한다', async () => {
    await freshDb();
    const from = version(4);
    generateFor(from);
    migrate(from, GATE_DB);
    const cols = await onDb(GATE_DB,
      "SELECT column_name, is_nullable, data_type FROM information_schema.columns WHERE table_name = 'uploads' AND column_name = 'profile_user_id'");
    expect(cols).toEqual([{ column_name: 'profile_user_id', is_nullable: 'YES', data_type: 'integer' }]);
    const cons = await onDb(GATE_DB,
      "SELECT contype FROM pg_constraint WHERE conrelid = 'uploads'::regclass AND pg_get_constraintdef(oid) LIKE '%profile_user_id%' ORDER BY contype");
    expect(cons.map((c) => c.contype)).toEqual(['f']);
    const idx = await onDb(GATE_DB, "SELECT indexdef FROM pg_indexes WHERE tablename = 'uploads' AND indexdef LIKE '%profile_user_id%'");
    expect(idx.map((i) => i.indexdef)).toEqual([expect.stringContaining('CREATE UNIQUE INDEX')]);
  });

  it('같은 장면을 다시 하면 청소가 프로필 사진을 안 지운다 - 기록에 jaehoon 이 적혀 있다', async () => {
    await freshDb();
    const from = version(4);
    generateFor(from);
    migrate(from, GATE_DB);
    const dir = studentDir(from);
    let imageUrl;
    await rebootIn(dir, GATE_DB, async ({ base }) => {
      const tab = await loggedIn(base, 'jaehoon');
      imageUrl = await upload(tab);
      expect((await setPhoto(tab, imageUrl)).body).toEqual({ data: { profileImage: imageUrl } });
    });
    const fileName = imageUrl.slice('/uploads/'.length);
    expect(await onDb(GATE_DB, 'SELECT post_id, profile_user_id FROM uploads WHERE file_name = $1', [fileName]))
      .toEqual([{ post_id: null, profile_user_id: JAEHOON_ID }]);
    await onDb(GATE_DB, BACKDATE);
    await rebootIn(dir, GATE_DB, async ({ base, tail }) => {
      expect(tail()).not.toContain('장을 지웠어요');
      expect(await fileStatus(base, imageUrl)).toBe(200);
    });
  });

  it('남이 올린 사진 · 프로필로 쓴 사진으로 게시물 · 없는 파일은 400 IMAGE_NOT_AVAILABLE', async () => {
    await freshDb();
    const from = version(4);
    generateFor(from);
    migrate(from, GATE_DB);
    await withServer(from, GATE_DB, async ({ base }) => {
      const me = await loggedIn(base, 'jaehoon');
      const seoyeon = await loggedIn(base, 'seoyeon');
      const myPhoto = await upload(me);
      const other = await setPhoto(seoyeon, myPhoto);
      expect([other.status, other.body.error.code]).toEqual([400, 'IMAGE_NOT_AVAILABLE']);
      expect(other.body.error.message).toBe('내가 올리고 아직 아무 데도 쓰지 않은 사진만 쓸 수 있어요');
      const missing = await setPhoto(me, '/uploads/00000000-0000-0000-0000-000000000000.jpg');
      expect([missing.status, missing.body.error.code]).toEqual([400, 'IMAGE_NOT_AVAILABLE']);
      expect((await setPhoto(me, myPhoto)).status).toBe(200);
      const post = await me.send('POST', '/api/v2/posts', { imageUrls: [myPhoto], postAlt: '', content: '프로필 사진으로 글' });
      expect([post.status, post.body.error.code]).toEqual([400, 'IMAGE_NOT_AVAILABLE']);
      // 게시물에 쓴 사진은 프로필 사진으로도 못 쓴다.
      const shared = await share(me, '바다');
      expect(shared.status).toBe(201);
      const used = await setPhoto(me, shared.body.data.imageUrls[0]);
      expect([used.status, used.body.error.code]).toEqual([400, 'IMAGE_NOT_AVAILABLE']);
    });
  });

  it('Step 4 판의 구멍 - 한 번 더 바꾸면 500 에러(한 사람에 프로필 기록은 하나뿐인데 앞 기록이 남아 있다)', async () => {
    await freshDb();
    const from = version(4);
    generateFor(from);
    migrate(from, GATE_DB);
    await withServer(from, GATE_DB, async ({ base, tail }) => {
      const me = await loggedIn(base, 'jaehoon');
      expect((await setPhoto(me, await upload(me))).status).toBe(200);
      const second = await setPhoto(me, await upload(me));
      expect([second.status, second.body.error.code]).toEqual([500, 'INTERNAL_ERROR']);
      expect(tail()).toContain('P2002');
      if (process.env.P359_TAIL_DUMP) writeFileSync(process.env.P359_TAIL_DUMP, tail());
    });
  });
});

describe('축 ④ Step 5 - 앞 사진 치우기', () => {
  it('바꾸면 앞 사진의 기록과 파일이 바로 사라진다 · 새 사진에 jaehoon 이 적힌다', async () => {
    await freshDb();
    const from = version(5);
    generateFor(from);
    migrate(from, GATE_DB);
    await withServer(from, GATE_DB, async ({ base }) => {
      const me = await loggedIn(base, 'jaehoon');
      const first = await upload(me);
      expect((await setPhoto(me, first)).status).toBe(200);
      const second = await upload(me);
      expect(await setPhoto(me, second)).toEqual({ status: 200, body: { data: { profileImage: second } } });
      expect(await fileStatus(base, first)).toBe(404);
      expect(await fileStatus(base, second)).toBe(200);
      const rows = await onDb(GATE_DB, 'SELECT file_name FROM uploads WHERE profile_user_id = $1', [JAEHOON_ID]);
      expect(rows).toEqual([{ file_name: second.slice('/uploads/'.length) }]);
      expect(await onDb(GATE_DB, 'SELECT count(*)::int AS n FROM uploads WHERE file_name = $1', [first.slice('/uploads/'.length)]))
        .toEqual([{ n: 0 }]);
    });
  });

  it('지금 사진을 다시 보내면 400 이고 사진은 그대로 · 사진이 없던 seoyeon 도 바꿀 수 있다', async () => {
    await freshDb();
    const from = version(5);
    generateFor(from);
    migrate(from, GATE_DB);
    await withServer(from, GATE_DB, async ({ base }) => {
      const me = await loggedIn(base, 'jaehoon');
      const first = await upload(me);
      expect((await setPhoto(me, first)).status).toBe(200);
      const again = await setPhoto(me, first);
      expect([again.status, again.body.error.code]).toEqual([400, 'IMAGE_NOT_AVAILABLE']);
      expect(await fileStatus(base, first)).toBe(200);
      expect((await me.get('/api/v2/auth/me')).body.data.profileImage).toBe(first);
      const seoyeon = await loggedIn(base, 'seoyeon');
      const mine = await upload(seoyeon);
      expect((await setPhoto(seoyeon, mine)).status).toBe(200);
      expect((await seoyeon.get('/api/v2/profiles/seoyeon')).body.data.profileImage).toBe(mine);
    });
  });
});

const LAB_PORT = Number(process.env.P359_LAB_PORT ?? 3992);
/** 학생 쪽 포트 4001 을 판정 포트로 - 바꾸는 곳은 app.listen 의 수와 기다린다는 문장 둘뿐이어야 한다. */
const onPort = (file, port) => {
  const source = read(file);
  expect(source.split('4001').length - 1).toBe(2);
  writeFileSync(file, source.replaceAll('4001', String(port)));
};
/** 실습 서버를 띄운다 - `patch(source)` 를 주면 그 판으로 바꿔 띄운다(틀린 판). 실습 서버는 메모리 데이터라 띄울 때마다 처음 상태다. */
const labServer = async (which, fn, patch = null) => {
  const from = version('lab');
  const dir = studentDir(from);
  const file = join(dir, 'lab/p3-59', `${which}.js`);
  onPort(file, LAB_PORT);
  if (patch) {
    const before = read(file);
    const after = patch(before);
    expect(after).not.toBe(before);
    writeFileSync(file, after);
  }
  const srv = await boot(file, { port: LAB_PORT, cwd: dir, env, ready: `${LAB_PORT}번 포트에서` });
  try {
    return await fn(browser(`http://localhost:${LAB_PORT}`));
  } finally {
    await Promise.race([srv.stop(), new Promise((r) => setTimeout(r, 500))]);
  }
};
const putPhoto = (tab, name, file) => tab.send('PUT', `/api/users/${name}/photo`, { imageUrl: `/uploads/${file}` });
const BAD = { status: 400, body: { message: '내가 올리고 아직 아무 데도 쓰지 않은 사진만 쓸 수 있어요' } };
/** practice1.http 를 차례로 보낸다 - 상태 코드 여섯. */
const practiceRun = async (tab) => [
  (await tab.get('/api/users/yuna')).body.profileImage,
  (await putPhoto(tab, 'yuna', 'cat.jpg')).status,
  (await putPhoto(tab, 'yuna', 'cake.jpg')).status,
  (await putPhoto(tab, 'yuna', 'dog.jpg')).status,
  (await putPhoto(tab, 'yuna', 'cat.jpg')).status,
  (await putPhoto(tab, 'yuna', 'nothing.jpg')).status,
  (await tab.get('/api/users/yuna')).body.profileImage,
];
const CONDITION = (name) => ` && item.${name} === `;

describe('축 ⑤ 직접 해보기 1 - 글쓴이 사진 적기', () => {
  it('practice1.http 차례대로 - 처음엔 null · cat 200 · cake · dog · cat 다시 · 없는 파일은 400 · 끝에 cat', async () => {
    await labServer('practice1', async (tab) => {
      expect(await tab.get('/api/users/yuna')).toEqual({ status: 200, body: { id: 1, username: 'yuna', profileImage: null } });
      expect(await putPhoto(tab, 'yuna', 'cat.jpg')).toEqual({ status: 200, body: { profileImage: '/uploads/cat.jpg' } });
      expect(await putPhoto(tab, 'yuna', 'cake.jpg')).toEqual(BAD);
      expect(await putPhoto(tab, 'yuna', 'dog.jpg')).toEqual(BAD);
      expect(await putPhoto(tab, 'yuna', 'cat.jpg')).toEqual(BAD);
      expect(await putPhoto(tab, 'yuna', 'nothing.jpg')).toEqual(BAD);
      expect(await tab.get('/api/users/yuna')).toEqual({ status: 200, body: { id: 1, username: 'yuna', profileImage: '/uploads/cat.jpg' } });
      expect(await tab.send('PUT', '/api/users/yuna/photo', { imageUrl: 'https://picsum.photos/seed/yuna/150/150' }))
        .toEqual({ status: 400, body: { message: '보낸 내용이 규칙에 안 맞아요' } });
      expect(await putPhoto(tab, 'minho', 'cat.jpg')).toEqual({ status: 404, body: { message: '그런 사용자는 없어요' } });
      expect((await tab.get('/uploads/cat.jpg')).status).toBe(200);
    });
  });

  it('빈칸 넷 - 하나를 빼면 400 이어야 할 요청 하나가 200 이 된다 · 빈칸 그대로면 500', async () => {
    const ok = [null, 200, 400, 400, 400, 400, '/uploads/cat.jpg'];
    await labServer('practice1', async (tab) => expect(await practiceRun(tab)).toEqual(ok));
    const drop = (cond) => (source) => source.replace(cond, '');
    // 파일 이름을 안 보면 cake.jpg 를 보냈는데 yuna 의 다른 사진(sea.jpg) 기록이 적히고 주소는 cake 가 된다.
    await labServer('practice1', async (tab) => expect(await practiceRun(tab)).toEqual([null, 200, 200, 400, 400, 400, '/uploads/cake.jpg']),
      drop('item.fileName === fileName && '));
    await labServer('practice1', async (tab) => expect(await practiceRun(tab)).toEqual([null, 200, 400, 200, 400, 400, '/uploads/dog.jpg']),
      drop(`${CONDITION('uploaderId')}user.id`));
    await labServer('practice1', async (tab) => expect(await practiceRun(tab)).toEqual([null, 200, 200, 400, 400, 400, '/uploads/cake.jpg']),
      drop(`${CONDITION('reviewId')}null`));
    await labServer('practice1', async (tab) => expect(await practiceRun(tab)).toEqual([null, 200, 400, 400, 200, 400, '/uploads/cat.jpg']),
      drop(`${CONDITION('profileUserId')}null`));
    const blanks = (source) => source.replace('item.fileName === fileName', 'item.fileName === ____')
      .replace(`${CONDITION('uploaderId')}user.id`, `${CONDITION('uploaderId')}____`)
      .replace(`${CONDITION('reviewId')}null`, `${CONDITION('reviewId')}____`)
      .replace(`${CONDITION('profileUserId')}null`, `${CONDITION('profileUserId')}____`);
    await labServer('practice1', async (tab) => {
      expect(await putPhoto(tab, 'yuna', 'cat.jpg')).toEqual({ status: 500, body: { message: '서버에서 문제가 생겼어요' } });
    }, blanks);
  });
});

describe('축 ⑥ 과제 [기초] - 글쓴이 사진 지우기', () => {
  it('homework1.http 차례대로 - 지우면 null 과 파일 404 · 한 번 더도 200 null · 바깥 주소 sujin 은 기록 없이 null · 남의 파일은 그대로 · 없는 사람 404', async () => {
    await labServer('homework1', async (tab) => {
      expect((await putPhoto(tab, 'yuna', 'cat.jpg')).status).toBe(200);
      expect(await tab.send('DELETE', '/api/users/yuna/photo')).toEqual({ status: 200, body: { profileImage: null } });
      expect((await tab.get('/api/users/yuna')).body.profileImage).toBe(null);
      expect(await tab.get('/uploads/cat.jpg')).toEqual({ status: 404, body: { message: '그런 파일은 없어요' } });
      expect(await tab.send('DELETE', '/api/users/yuna/photo')).toEqual({ status: 200, body: { profileImage: null } });
      expect(await tab.send('DELETE', '/api/users/sujin/photo')).toEqual({ status: 200, body: { profileImage: null } });
      expect((await tab.get('/api/users/sujin')).body.profileImage).toBe(null);
      expect((await tab.get('/uploads/dog.jpg')).status).toBe(200);
      expect(await tab.send('DELETE', '/api/users/minho/photo')).toEqual({ status: 404, body: { message: '그런 사용자는 없어요' } });
      // 사진 적기는 직접 해보기 1 그대로
      expect((await putPhoto(tab, 'yuna', 'sea.jpg')).status).toBe(200);
    });
  });

  it('틀린 판 - 파일을 안 지우면 지운 뒤에도 cat.jpg 가 200', async () => {
    await labServer('homework1', async (tab) => {
      await putPhoto(tab, 'yuna', 'cat.jpg');
      await tab.send('DELETE', '/api/users/yuna/photo');
      expect((await tab.get('/uploads/cat.jpg')).status).toBe(200);
    }, (source) => source.replace('    files.delete(upload.fileName);\n', ''));
  });

  it('틀린 판 - 주소를 null 로 돌리지 않으면 지운 뒤에도 yuna 의 사진이 cat · 기록이 없을 때 404 로 답하면 sujin 이 404', async () => {
    await labServer('homework1', async (tab) => {
      await putPhoto(tab, 'yuna', 'cat.jpg');
      expect(await tab.send('DELETE', '/api/users/yuna/photo')).toEqual({ status: 200, body: { profileImage: null } });
      expect((await tab.get('/api/users/yuna')).body.profileImage).toBe('/uploads/cat.jpg');
    }, (source) => source.replace('  user.profileImage = null;\n', ''));
    await labServer('homework1', async (tab) => {
      await putPhoto(tab, 'yuna', 'cat.jpg');
      expect((await tab.send('DELETE', '/api/users/yuna/photo')).status).toBe(200);
      expect(await tab.send('DELETE', '/api/users/yuna/photo')).toEqual({ status: 404, body: { message: '지울 사진이 없어요' } });
      expect(await tab.send('DELETE', '/api/users/sujin/photo')).toEqual({ status: 404, body: { message: '지울 사진이 없어요' } });
    }, (source) => source.replace("  if (index !== -1) {\n", "  if (index === -1) {\n    res.status(404).json({ message: '지울 사진이 없어요' });\n    return;\n  }\n\n  {\n"));
  });
});

