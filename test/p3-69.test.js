// p3-69 「실시간 알림」 게이트 - 백엔드(교안 Step 1 · 2 · 3 · 4)와 다음 회차 판정 DB
// 내부 검증 전용 - 교안에 한 줄도 인용하지 않는다.
//
// `9-realtime` 마지막 회차다(`curriculum.md` 「`p3-69` 착수 결정」 ①~⑥). 백엔드의 시작 판은 code/p3-68(5fbf9d2)의 학생 파일이다.
// 커밋 - Step 1(notify 가 트랜잭션 안에서 바로 보낸다) · Step 2(번호만 돌려주고 커밋 뒤 pushNew) · Step 3(findCaused · pushRemoved)
//        · Step 4(notifications_seen_at · unseen · seen). 같은 «(Step N)» 표식이 여럿이면 가장 뒤 feat 커밋이 그 Step 의 끝 판이다.
// 🔑 포트 - 3989 · `P369_PORT` 로 바꾼다. DB - `p369_api_` 로 시작하는 것만 만들고 지운다.
//    PostgreSQL 은 `P369_PG_PORT`(기본 5580 - 판정용 컨테이너 p368-db).
// 🔑 판정 DB 는 «p3-68 을 마친 학생 DB» `test/fixtures/p3-68-end.sql` 이다 - 다음 알림 번호 15 · jaehoon(2) 의 알림 5 · 6 · 9 · 13 ·
//    seoyeon(43) 은 jaehoon 의 게시물 1 에만 좋아요 · 14 · 26 · 28 · 29 에는 없다.
// 🔑 교안 Step 2 의 «일부러 실패» 는 학생이 likeService.js 의 `return …changeLikeCount(` 줄 위에 잠깐 넣는 한 줄이다 - 사본에 넣어 재현한다.
//
// 축 ① 이어진 흐름(학생이 교안 차례대로 Step 1 → 4 를 한 DB 에서 · 실시간 이벤트를 jaehoon 의 연결로 받는다)
// 축 ② 화면 Step 5~8 을 요청으로 이어서 마친 DB → test/fixtures/p3-69-end.sql(`P369_WRITE_END=1` 이면 다시 쓴다)
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
const PG_PORT = Number(process.env.P369_PG_PORT ?? 5580);
const ADMIN = { host: 'localhost', port: PG_PORT, database: 'postgres', user: 'postgres', password: 'postgres' };
const DB_PREFIX = process.env.P369_DB_PREFIX ?? 'p369_api';
const TPL_DB = `${DB_PREFIX}_tpl`;
const GATE_DB = `${DB_PREFIX}_gate`;
const dbUrl = (name) => `postgresql://postgres:postgres@localhost:${PG_PORT}/${name}`;
const PORT = Number(process.env.P369_PORT ?? 3989);
const SECRET = 'q2Xh0v9bGm4RkT7sYp1wLc8nZf3uJd6eHa5iVo0rQyE';
const env = {
  CORS_ORIGIN: 'http://localhost:3001', JWT_SECRET: SECRET,
  GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret', SITE_URL: `http://localhost:${PORT}`,
  KAKAO_CLIENT_ID: 'test-kakao', KAKAO_CLIENT_SECRET: 'test-kakao-secret',
  NAVER_CLIENT_ID: 'test-naver', NAVER_CLIENT_SECRET: 'test-naver-secret',
};
const STUDENT_FILES = ['app.js', 'realtime.js', 'public', 'db.js', 'errors.js', 'responses.js', 'routes', 'controllers', 'services', 'middlewares', 'schemas', 'strategies', 'docs', 'utils', 'package.json', 'requests', 'seed.js', 'data', 'prisma', 'prisma.config.js', '.env.example', 'lab'];
const FIXTURE = P('test/fixtures/p3-68-end.sql');

const git = (args) => execFileSync('git', args, { cwd: P('.'), encoding: 'utf8', maxBuffer: 1 << 28 });
const hasRef = (ref) => {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', ref], { cwd: P('.'), stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
};
// 🔑 판의 선 - 북마크 code/p3-69 가 있으면 그것, 없으면 지금 체크아웃한 선(HEAD). `P369_LINE` 으로 바꾼다.
const LINE = process.env.P369_LINE ?? (hasRef('refs/heads/code/p3-69') ? 'code/p3-69' : 'HEAD');
const WT = process.env.P369_WT ?? null;
const START = process.env.P369_BASE ?? 'code/p3-68';
/** «(표식)» 이 붙은 그 회차 커밋들 - 새것부터. */
const markCommits = (mark) => {
  const log = git(['log', '-n', '200', '--format=%H %s', LINE]);
  return log.split('\n').filter((l) => / feat\(p3-69\): /.test(l) && l.endsWith(`(${mark})`)).map((l) => l.split(' ')[0]);
};
const MARKS = { 1: 'Step 1', 2: 'Step 2', 3: 'Step 3', 4: 'Step 4' };
const dirs = [];
const refDirs = new Map();
const refDir = (ref) => {
  if (refDirs.has(ref)) return refDirs.get(ref);
  const dir = mkdtempSync(join(tmpdir(), 'p369-ref-'));
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
  if (commits.length === 0) throw new Error(`p3-69 (${MARKS[step]}) 커밋이 없다`);
  return commits[0];
};
/** 그 Step 의 끝 판 - `P369_WT` 가 그 Step 이면 작업트리. */
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
  const dir = mkdtempSync(join(tmpdir(), 'p369-srv-'));
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
  if (process.env.P369_SEEN) writeFileSync(process.env.P369_SEEN, JSON.stringify(seen, null, 2));
  if (!process.env.P369_KEEP) await dropDb(GATE_DB);
  await dropDb(TPL_DB);
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});


/** 그 탭의 쿠키로 연결을 연다 - 받은 이벤트를 차례로 모은다(dm-test.html 의 Console 에 건 두 줄과 같다). */
const listen = async (base, tab) => {
  const socket = connectIo(base, { extraHeaders: { cookie: tab.cookie() }, transports: ['websocket'], reconnection: false });
  const events = [];
  socket.on('notification:new', (n) => events.push(['new', n]));
  socket.on('notification:removed', (n) => events.push(['removed', n]));
  await new Promise((ok, fail) => { socket.on('connect', ok); socket.on('connect_error', fail); });
  return { events, close: () => socket.close() };
};
const settle = () => new Promise((r) => setTimeout(r, 400));
/** 교안 Step 2 의 «일부러 실패» - 학생이 넣는 한 줄. */
const FAIL_LINE = (dir) => {
  const file = join(dir, 'services/likeService.js');
  const text = read(file);
  const at = text.search(/\n {6}return (\{ status: await )?changeLikeCount\(tx, postId, count, true\)/);
  if (at < 0) throw new Error('likeService.js 에 넣을 곳이 없다');
  writeFileSync(file, `${text.slice(0, at)}\n      throw new Error('일부러 실패');${text.slice(at)}`);
};
const ids = (events) => events.map(([kind, n]) => [kind, n.id]);

describe('축 ⓪ 판정 DB - p3-68 을 마친 학생 DB', () => {
  it('다음 알림 번호 15 · jaehoon 의 알림 5 · 6 · 9 · 13 · seoyeon 은 게시물 14 · 26 에 좋아요가 없다', async () => {
    await freshDb();
    const rows = await onDb(GATE_DB, 'SELECT id, receiver_id FROM notifications ORDER BY id');
    expect(rows.map((r) => [r.id, r.receiver_id])).toEqual([[5, 2], [6, 2], [9, 2], [13, 2], [14, 44]]);
    const likes = await onDb(GATE_DB, 'SELECT post_id FROM post_likes WHERE user_id = 43 ORDER BY post_id');
    expect(likes.map((r) => r.post_id)).toEqual([1]);
    const [{ last_value }] = await onDb(GATE_DB, 'SELECT last_value FROM notifications_id_seq');
    expect(Number(last_value)).toBe(14);
  });
});

describe('축 ① 이어진 흐름 - Step 1 → 4', () => {
  it('교안이 적은 번호 · 응답 · 이벤트', async () => {
    const out = {};
    await freshDb();
    // Step 1 - 트랜잭션 안에서 바로 보낸다
    await serve(1, async ({ base }) => {
      const jaehoon = await loggedIn(base, 'jaehoon');
      const ws = await listen(base, jaehoon);
      const seoyeon = await loggedIn(base, 'seoyeon');
      out.step1Like = brief(await seoyeon.send('PUT', '/api/v2/posts/14/likes/me'));
      await settle();
      out.step1Events = ws.events.map(([k, n]) => [k, n.id, n.type, n.postId, n.message, n.sender.username, n.isRead, Object.keys(n).sort().join(',')]);
      ws.close();
    }, { fresh: false });
    // Step 2 겪기 - Step 1 판에 «일부러 실패»
    await serve(1, async ({ base }) => {
      const jaehoon = await loggedIn(base, 'jaehoon');
      const ws = await listen(base, jaehoon);
      const seoyeon = await loggedIn(base, 'seoyeon');
      out.failLike = await seoyeon.send('PUT', '/api/v2/posts/26/likes/me');
      await settle();
      out.failEvents = ids(ws.events);
      out.listTop = (await jaehoon.get('/api/v2/notifications?limit=1')).body.data.items.map((n) => n.id);
      out.read16 = brief(await jaehoon.send('PATCH', '/api/v2/notifications/16/read'));
      ws.close();
    }, { fresh: false, edit: FAIL_LINE });
    // Step 2 판에 «일부러 실패» - 아무것도 안 간다
    await serve(2, async ({ base }) => {
      const jaehoon = await loggedIn(base, 'jaehoon');
      const ws = await listen(base, jaehoon);
      const seoyeon = await loggedIn(base, 'seoyeon');
      out.fail2 = (await seoyeon.send('PUT', '/api/v2/posts/26/likes/me')).status;
      await settle();
      out.fail2Events = ids(ws.events);
      ws.close();
    }, { fresh: false, edit: FAIL_LINE });
    // Step 2 판 - 좋아요 · 멘션 댓글 · (Step 3 겪기) 취소
    await serve(2, async ({ base }) => {
      const jaehoon = await loggedIn(base, 'jaehoon');
      const ws = await listen(base, jaehoon);
      const seoyeon = await loggedIn(base, 'seoyeon');
      out.like26 = brief(await seoyeon.send('PUT', '/api/v2/posts/26/likes/me'));
      await settle();
      out.like26Events = ids(ws.events);
      ws.events.length = 0;
      out.mention = (await seoyeon.send('POST', '/api/v2/posts/14/comments', { content: '@jaehoon @doyun 여기 좋다' })).status;
      await settle();
      out.mentionEvents = ws.events.map(([k, n]) => [k, n.id, n.type]);
      ws.events.length = 0;
      out.unlike26 = brief(await seoyeon.send('DELETE', '/api/v2/posts/26/likes/me'));
      await settle();
      out.unlikeEvents2 = ids(ws.events);
      ws.close();
    }, { fresh: false });
    out.afterStep2 = short(await notifRows());
    // Step 3 판 - 누르고 곧바로 취소
    await serve(3, async ({ base }) => {
      const jaehoon = await loggedIn(base, 'jaehoon');
      const ws = await listen(base, jaehoon);
      const seoyeon = await loggedIn(base, 'seoyeon');
      await seoyeon.send('PUT', '/api/v2/posts/26/likes/me');
      await seoyeon.send('DELETE', '/api/v2/posts/26/likes/me');
      await settle();
      out.step3Events = ids(ws.events);
      ws.close();
    }, { fresh: false });
    // Step 4 판 - 아직 안 본 알림
    await serve(4, async ({ base }) => {
      const jaehoon = await loggedIn(base, 'jaehoon');
      out.unseen1 = brief(await jaehoon.get('/api/v2/notifications/unseen'));
      out.seen = brief(await jaehoon.send('PATCH', '/api/v2/notifications/seen'));
      out.unseen2 = (await jaehoon.get('/api/v2/notifications/unseen')).body;
      out.listAfterSeen = (await jaehoon.get('/api/v2/notifications')).body.data.items.map((n) => [n.id, n.isRead]);
      out.seenPost = (await jaehoon.send('POST', '/api/v2/notifications/seen')).status;
      const seoyeon = await loggedIn(base, 'seoyeon');
      await seoyeon.send('PUT', '/api/v2/posts/26/likes/me');
      out.unseen3 = (await jaehoon.get('/api/v2/notifications/unseen')).body;
      out.newest = (await jaehoon.get('/api/v2/notifications?limit=1')).body.data.items.map((n) => n.id);
    }, { fresh: false });
    seen.flow = out;

    expect(out.step1Like).toEqual({ status: 200, body: { data: { liked: true, likeCount: out.step1Like.body.data.likeCount } } });
    expect(out.step1Events).toEqual([['new', 15, 'LIKE', 14, 'seoyeon님이 회원님의 게시물을 좋아해요', 'seoyeon', false, 'createdAt,id,isRead,message,postId,sender,thumbnailUrl,type']]);
    expect(out.failLike.status).toBe(500);
    expect(out.failLike.body.error.code).toBe('INTERNAL_ERROR');
    expect(out.failEvents).toEqual([['new', 16]]);
    expect(out.listTop).toEqual([15]);
    expect(out.read16.status).toBe(404);
    expect(out.read16.body.error.code).toBe('NOTIFICATION_NOT_FOUND');
    expect(out.fail2).toBe(500);
    expect(out.fail2Events).toEqual([]);
    expect(out.like26.status).toBe(200);
    expect(out.like26Events).toEqual([['new', 18]]);
    expect(out.mention).toBe(201);
    expect(out.mentionEvents).toEqual([['new', 19, 'COMMENT']]);
    expect(out.unlike26.body.data.liked).toBe(false);
    expect(out.unlikeEvents2).toEqual([]);
    expect(out.afterStep2).toEqual([[5, 'LIKE', 2, 43], [6, 'COMMENT', 2, 43], [9, 'FOLLOW', 2, 44], [13, 'COMMENT', 2, 43], [14, 'MENTION', 44, 43], [15, 'LIKE', 2, 43], [19, 'COMMENT', 2, 43], [20, 'MENTION', 44, 43]]);
    expect(out.step3Events).toEqual([['new', 21], ['removed', 21]]);
    expect(out.unseen1).toEqual({ status: 200, body: { data: { unseenCount: 6 } } });
    expect(out.seen).toEqual({ status: 200, body: { data: { unseenCount: 0 } } });
    expect(out.unseen2).toEqual({ data: { unseenCount: 0 } });
    expect(out.listAfterSeen).toEqual([[19, false], [15, false], [13, true], [9, true], [6, false], [5, false]]);
    expect(out.seenPost).toBe(405);
    expect(out.unseen3).toEqual({ data: { unseenCount: 1 } });
    expect(out.newest).toEqual([22]);
  }, 240_000);
});

describe('축 ② 화면 Step 5~8 을 요청으로 이어서 마친 DB - 다음 회차 판정 DB', () => {
  it('교안 차례대로 - 패널을 여는 것은 PATCH /seen · 이벤트가 온 때 패널이 열려 있으면 화면이 보내는 PATCH /seen 도', async () => {
    const out = {};
    await serve(4, async ({ base }) => {
      const jaehoon = await loggedIn(base, 'jaehoon');
      const seoyeon = await loggedIn(base, 'seoyeon');
      const open = () => jaehoon.send('PATCH', '/api/v2/notifications/seen');
      const relike = async (postId) => {
        await seoyeon.send('DELETE', `/api/v2/posts/${postId}/likes/me`);
        await seoyeon.send('PUT', `/api/v2/posts/${postId}/likes/me`);
      };
      // Step 5 - 써 봐요(열고 닫기) · 닫힌 채 다시 누르기 · 겪기 판에서 연 채로 · 고친 판에서 연 채로
      await open();
      await relike(26);
      out.step5Closed = (await jaehoon.get('/api/v2/notifications/unseen')).body.data.unseenCount;
      await open();
      await relike(26);
      out.step5Problem = (await jaehoon.get('/api/v2/notifications/unseen')).body.data.unseenCount;
      await open();
      await relike(26);
      await open();
      // Step 6 - 겪기 판 · 고친 판 모두 패널을 연 채로
      await open();
      await relike(26);
      await open();
      await relike(26);
      await open();
      // Step 7 - 끊긴 사이(이벤트가 오지 않아 화면은 아무것도 안 보낸다) · 고친 판은 다시 이어질 때 PATCH /seen
      await seoyeon.send('DELETE', '/api/v2/posts/26/likes/me');
      await relike(14);
      await relike(14);
      await open();
      out.jaehoonRows = (await jaehoon.get('/api/v2/notifications')).body.data.items.map((n) => [n.id, n.type, n.postId, n.isRead]);
      out.unseen = (await jaehoon.get('/api/v2/notifications/unseen')).body.data.unseenCount;
      // Step 8 - seoyeon 이 jaehoon 과의 1번 방에 세 번 보낸다(jaehoon 은 방을 열지 않는다)
      const ws = connectIo(base, { extraHeaders: { cookie: seoyeon.cookie() }, transports: ['websocket'], reconnection: false });
      await new Promise((ok, fail) => { ws.on('connect', ok); ws.on('connect_error', fail); });
      out.dm = [];
      for (const content of ['토요일 몇 시에 만나요?', '피드에서 보고 있어요', '받은편지함에서도 보여요']) {
        const ack = await new Promise((ok) => ws.emit('dm:send', { conversationId: 1, content }, ok));
        out.dm.push([ack.data?.id, ack.data?.content]);
      }
      ws.close();
    }, { fresh: false });
    out.rows = short(await notifRows());
    const [{ nl }] = await onDb(GATE_DB, 'SELECT last_value AS nl FROM notifications_id_seq');
    out.lastNotification = Number(nl);
    out.likes = (await onDb(GATE_DB, 'SELECT post_id FROM post_likes WHERE user_id = 43 ORDER BY post_id')).map((r) => r.post_id);
    seen.end = out;

    expect(out.step5Closed).toBe(1);
    expect(out.step5Problem).toBe(1);
    expect(out.rows).toEqual([[5, 'LIKE', 2, 43], [6, 'COMMENT', 2, 43], [9, 'FOLLOW', 2, 44], [13, 'COMMENT', 2, 43], [14, 'MENTION', 44, 43], [19, 'COMMENT', 2, 43], [20, 'MENTION', 44, 43], [29, 'LIKE', 2, 43]]);
    expect(out.jaehoonRows).toEqual([[29, 'LIKE', 14, false], [19, 'COMMENT', 14, false], [13, 'COMMENT', 1, true], [9, 'FOLLOW', null, true], [6, 'COMMENT', 1, false], [5, 'LIKE', 1, false]]);
    expect(out.unseen).toBe(0);
    expect(out.lastNotification).toBe(29);
    expect(out.likes).toEqual([1, 14]);
    expect(out.dm.map(([, c]) => c)).toEqual(['토요일 몇 시에 만나요?', '피드에서 보고 있어요', '받은편지함에서도 보여요']);
    if (process.env.P369_WRITE_END) {
      const dump = execFileSync('docker', ['exec', process.env.P369_PG_CONTAINER ?? 'p368-db', 'pg_dump', '--inserts', '-U', 'postgres', GATE_DB], { encoding: 'utf8', maxBuffer: 1 << 28 });
      writeFileSync(P('test/fixtures/p3-69-end.sql'), dump);
    }
  }, 240_000);
});
