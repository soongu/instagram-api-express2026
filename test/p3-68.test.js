// p3-68 「알림 남기기와 알림 패널」 게이트 - 백엔드(교안 Step 1 · 2 · 3 · 4 · 5 · 6 · 8 의 읽음 API)
// 내부 검증 전용 - 교안에 한 줄도 인용하지 않는다.
//
// `9-realtime` 일곱째 회차다(`curriculum.md` 「`p3-68` 착수 결정」 ①~⑩). 백엔드의 시작 판은 code/p3-67(98bad29)의 학생 파일이다.
// 커밋 - Step 1(notifications 테이블 · post_id 까지) · Step 2 둘(겪기 판 - count 를 안 본다 / 고친 판 - count 가 1 일 때만)
//        · Step 3(post_like_id + Cascade · 남아 있던 알림 정리) · Step 4(comment_id · follow_id · CHECK · 댓글·팔로우)
//        · Step 5 둘(겪기 판 - 게시물 주인을 멘션하면 두 줄 / 고친 판) · Step 6(목록 API) · Step 8(읽음 API).
//        같은 «(Step N)» 표식이 여럿이면 가장 뒤 feat 커밋이 그 Step 의 끝 판이다. 겪기 판은 «(Step N 겪기)».
// 🔑 포트 - 3988 · `P368_PORT` 로 바꾼다. DB - `p368_api_` 로 시작하는 것만 만들고 지운다.
//    PostgreSQL 은 `P368_PG_PORT`(기본 5580 - 판정용 컨테이너 p368-db).
// 🔑 판정 DB 는 «p3-67 을 마친 학생 DB» `test/fixtures/p3-67-end.sql` 이다.
//    jaehoon(2) 의 게시물 1(사진 셋 · 첫 사진 https://picsum.photos/seed/post1/600/600) · seoyeon(43) · doyun(44 · jaehoon 을 이미 팔로우) ·
//    seoyeon 은 jaehoon 의 게시물에 좋아요를 누른 적이 없다 · 알림 테이블은 없다.
// 🚨 Prisma 의 schema-engine 캐시가 루트 소유인 맥이면 `PRISMA_SCHEMA_ENGINE_BINARY` 에 그 파일 경로를 주고 돌린다(generate 도 그 파일을 건드린다).
//
// 축 ⓪ 판정 DB · 축 ① 이어진 흐름(학생이 교안 차례대로 Step 1 → 6 · 8 을 한 DB 에서) · 축 ② Step 1 테이블
// 축 ③ Step 3 마이그레이션의 정리 · 축 ④ Step 4 CHECK · 축 ⑤ Step 5 멘션 규칙(화면 규칙과 같다) · 축 ⑥ Step 6 목록 · 축 ⑦ Step 8 읽음
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
const PG_PORT = Number(process.env.P368_PG_PORT ?? 5580);
const ADMIN = { host: 'localhost', port: PG_PORT, database: 'postgres', user: 'postgres', password: 'postgres' };
const DB_PREFIX = process.env.P368_DB_PREFIX ?? 'p368_api';
const TPL_DB = `${DB_PREFIX}_tpl`;
const GATE_DB = `${DB_PREFIX}_gate`;
const dbUrl = (name) => `postgresql://postgres:postgres@localhost:${PG_PORT}/${name}`;
const PORT = Number(process.env.P368_PORT ?? 3988);
const SECRET = 'q2Xh0v9bGm4RkT7sYp1wLc8nZf3uJd6eHa5iVo0rQyE';
const env = {
  CORS_ORIGIN: 'http://localhost:3001', JWT_SECRET: SECRET,
  GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret', SITE_URL: `http://localhost:${PORT}`,
  KAKAO_CLIENT_ID: 'test-kakao', KAKAO_CLIENT_SECRET: 'test-kakao-secret',
  NAVER_CLIENT_ID: 'test-naver', NAVER_CLIENT_SECRET: 'test-naver-secret',
};
const STUDENT_FILES = ['app.js', 'realtime.js', 'public', 'db.js', 'errors.js', 'responses.js', 'routes', 'controllers', 'services', 'middlewares', 'schemas', 'strategies', 'docs', 'utils', 'package.json', 'requests', 'seed.js', 'data', 'prisma', 'prisma.config.js', '.env.example', 'lab'];
const FIXTURE = P('test/fixtures/p3-67-end.sql');

const git = (args) => execFileSync('git', args, { cwd: P('.'), encoding: 'utf8', maxBuffer: 1 << 28 });
const hasRef = (ref) => {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', ref], { cwd: P('.'), stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
};
// 🔑 판의 선 - 북마크 code/p3-68 이 있으면 그것, 없으면 지금 체크아웃한 선(HEAD). `P368_LINE` 으로 바꾼다.
const LINE = process.env.P368_LINE ?? (hasRef('refs/heads/code/p3-68') ? 'code/p3-68' : 'HEAD');
const WT = process.env.P368_WT ?? null;
const START = process.env.P368_BASE ?? 'code/p3-67';
/** «(표식)» 이 붙은 그 회차 커밋들 - 새것부터. */
const markCommits = (mark) => {
  const log = git(['log', '-n', '200', '--format=%H %s', LINE]);
  return log.split('\n').filter((l) => / feat\(p3-68\): /.test(l) && l.endsWith(`(${mark})`)).map((l) => l.split(' ')[0]);
};
const MARKS = { 1: 'Step 1', '2a': 'Step 2 겪기', 2: 'Step 2', 3: 'Step 3', 4: 'Step 4', '5a': 'Step 5 겪기', 5: 'Step 5', 6: 'Step 6', 8: 'Step 8' };
const dirs = [];
const refDirs = new Map();
const refDir = (ref) => {
  if (refDirs.has(ref)) return refDirs.get(ref);
  const dir = mkdtempSync(join(tmpdir(), 'p368-ref-'));
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
  if (commits.length === 0) throw new Error(`p3-68 (${MARKS[step]}) 커밋이 없다`);
  return commits[0];
};
/** 그 Step 의 끝 판 - `P368_WT` 가 그 Step 이면 작업트리. */
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
  const dir = mkdtempSync(join(tmpdir(), 'p368-srv-'));
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
  if (process.env.P368_SEEN) writeFileSync(process.env.P368_SEEN, JSON.stringify(seen, null, 2));
  if (!process.env.P368_KEEP) await dropDb(GATE_DB);
  await dropDb(TPL_DB);
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

describe('축 ⓪ 판정 DB - p3-67 을 마친 학생 DB', () => {
  it('알림 테이블이 없다 · seoyeon 은 jaehoon 의 게시물에 좋아요가 없다 · doyun 은 jaehoon 을 팔로우한다 · 게시물 1 의 첫 사진', async () => {
    const tables = await onDb(TPL_DB, `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_name = 'notifications'`);
    expect(tables[0].n).toBe(0);
    const likes = await onDb(TPL_DB, `SELECT count(*)::int AS n FROM post_likes l JOIN posts p ON p.id = l.post_id WHERE l.user_id = 43 AND p.author_id = 2`);
    expect(likes[0].n).toBe(0);
    const follows = await onDb(TPL_DB, 'SELECT count(*)::int AS n FROM follows WHERE follower_id = 44 AND following_id = 2');
    expect(follows[0].n).toBe(1);
    const image = await onDb(TPL_DB, 'SELECT image_url FROM post_images WHERE post_id = 1 ORDER BY img_order LIMIT 1');
    expect(image[0].image_url).toBe('https://picsum.photos/seed/post1/600/600');
  });
});

// 학생이 교안 차례대로 한 DB 에서 따라간 흐름 - Step 판마다 그 판의 마이그레이션만 더 걸고 다시 띄운다.
describe('축 ① 이어진 흐름 - 교안 차례대로 한 DB 에서', () => {
  it('Step 1 → 2 겪기 → 2 → 3 → 4 → 5 겪기 → 5 → 6 · 8', async () => {
    await freshDb();
    const flow = {};
    const step = (s, fn) => serve(s, ({ base }) => fn(base), { fresh: false });

    // Step 1 - 테이블만 생긴다
    await step(1, async () => {
      flow.step1 = await notifRows();
    });

    // Step 2 겪기 - count 를 안 보는 판. 같은 PUT 두 번
    await step('2a', async (base) => {
      const seoyeon = await loggedIn(base, 'seoyeon');
      flow.step2aPut = [brief(await seoyeon.send('PUT', '/api/v2/posts/1/likes/me')), brief(await seoyeon.send('PUT', '/api/v2/posts/1/likes/me'))];
      flow.step2aRows = short(await notifRows());
    });

    // Step 2 - 고친 판. 잘못 남은 두 줄을 SQL 로 지우고, 좋아요도 취소한 뒤 다시 두 번. jaehoon 이 자기 게시물 26 에 누른다
    await step(2, async (base) => {
      await onDb(GATE_DB, 'DELETE FROM notifications');
      const seoyeon = await loggedIn(base, 'seoyeon');
      flow.step2Unlike = brief(await seoyeon.send('DELETE', '/api/v2/posts/1/likes/me'));
      flow.step2Put = [brief(await seoyeon.send('PUT', '/api/v2/posts/1/likes/me')), brief(await seoyeon.send('PUT', '/api/v2/posts/1/likes/me'))];
      const jaehoon = await loggedIn(base, 'jaehoon');
      flow.step2Own = brief(await jaehoon.send('PUT', '/api/v2/posts/26/likes/me'));
      flow.step2Rows = short(await notifRows());
      // Step 3 의 첫 장면 - 예고의 물음. 같은 판에서 1초 만에 취소한다
      flow.step3Unlike = brief(await seoyeon.send('DELETE', '/api/v2/posts/1/likes/me'));
      flow.step3Left = short(await notifRows());
      flow.step3LikeRows = (await onDb(GATE_DB, 'SELECT count(*)::int AS n FROM post_likes WHERE post_id = 1 AND user_id = 43'))[0].n;
    });

    // Step 3 - post_like_id + Cascade. 마이그레이션이 남아 있던 거짓 알림을 지운다
    await step(3, async (base) => {
      flow.step3AfterMigrate = short(await notifRows());
      const seoyeon = await loggedIn(base, 'seoyeon');
      flow.step3Put = brief(await seoyeon.send('PUT', '/api/v2/posts/1/likes/me'));
      flow.step3RowsAfterPut = await notifRows();
      flow.step3LikeId = (await onDb(GATE_DB, 'SELECT id FROM post_likes WHERE post_id = 1 AND user_id = 43'))[0].id;
      flow.step3Delete = brief(await seoyeon.send('DELETE', '/api/v2/posts/1/likes/me'));
      flow.step3RowsAfterDelete = short(await notifRows());
      flow.step3PutAgain = brief(await seoyeon.send('PUT', '/api/v2/posts/1/likes/me'));
      flow.step3RowsEnd = await notifRows();
      flow.step3LikeIdEnd = (await onDb(GATE_DB, 'SELECT id FROM post_likes WHERE post_id = 1 AND user_id = 43'))[0].id;
    });

    // Step 4 - 댓글 · 답글 · 팔로우
    await step(4, async (base) => {
      const seoyeon = await loggedIn(base, 'seoyeon');
      const comment = await seoyeon.send('POST', '/api/v2/posts/1/comments', { content: '여기 어디예요?' });
      const reply = await seoyeon.send('POST', '/api/v2/posts/1/comments', { content: '저도 가보고 싶어요', parentId: 1 });
      flow.step4Comment = brief(comment);
      flow.step4Reply = brief(reply);
      const jaehoon = await loggedIn(base, 'jaehoon');
      flow.step4Own = brief(await jaehoon.send('POST', '/api/v2/posts/1/comments', { content: '한강공원이에요' }));
      flow.step4RowsAfterComments = await notifRows();
      flow.step4DeleteReply = (await seoyeon.send('DELETE', `/api/v2/posts/1/comments/${reply.body.data.comment.id}`)).status;
      flow.step4RowsAfterDelete = short(await notifRows());
      const doyun = await loggedIn(base, 'doyun');
      flow.step4Unfollow0 = brief(await doyun.send('DELETE', '/api/v2/profiles/jaehoon/followers/me'));
      flow.step4Rows0 = short(await notifRows());
      flow.step4Follow = [brief(await doyun.send('PUT', '/api/v2/profiles/jaehoon/followers/me')), brief(await doyun.send('PUT', '/api/v2/profiles/jaehoon/followers/me'))];
      flow.step4RowsFollow = await notifRows();
      flow.step4Unfollow = brief(await doyun.send('DELETE', '/api/v2/profiles/jaehoon/followers/me'));
      flow.step4RowsUnfollow = short(await notifRows());
      flow.step4FollowAgain = brief(await doyun.send('PUT', '/api/v2/profiles/jaehoon/followers/me'));
      flow.step4RowsEnd = await notifRows();
    });

    // Step 5 겪기 - 게시물 주인을 멘션하면 두 줄
    await step('5a', async (base) => {
      const seoyeon = await loggedIn(base, 'seoyeon');
      const res = await seoyeon.send('POST', '/api/v2/posts/1/comments', { content: '@jaehoon @doyun 다음 주에 같이 가요' });
      flow.step5aComment = brief(res);
      flow.step5aRows = (await notifRows()).filter((r) => r.comment_id === res.body.data.comment.id);
    });

    // Step 5 - 고친 판. 그 댓글을 지우고(알림 셋이 함께 사라진다) 같은 글을 다시 단다
    await step(5, async (base) => {
      const seoyeon = await loggedIn(base, 'seoyeon');
      const [{ id }] = await onDb(GATE_DB, `SELECT id FROM comments WHERE author_id = 43 AND content = '@jaehoon @doyun 다음 주에 같이 가요'`);
      flow.step5Delete = (await seoyeon.send('DELETE', `/api/v2/posts/1/comments/${id}`)).status;
      flow.step5RowsAfterDelete = (await notifRows()).filter((r) => r.comment_id === id).length;
      const res = await seoyeon.send('POST', '/api/v2/posts/1/comments', { content: '@jaehoon @doyun 다음 주에 같이 가요' });
      flow.step5Comment = brief(res);
      flow.step5Rows = (await notifRows()).filter((r) => r.comment_id === res.body.data.comment.id);
    });

    // Step 6 · 8 - 목록과 읽음
    await step(8, async (base) => {
      const jaehoon = await loggedIn(base, 'jaehoon');
      flow.step6List = brief(await jaehoon.get('/api/v2/notifications'));
      const first = await jaehoon.get('/api/v2/notifications?limit=2');
      flow.step6Page1 = brief(first);
      flow.step6Page2 = brief(await jaehoon.get(`/api/v2/notifications?limit=2&cursor=${first.body.data.nextCursor}`));
      const doyun = await loggedIn(base, 'doyun');
      flow.step6Doyun = brief(await doyun.get('/api/v2/notifications'));
      // 다음 회차의 판정 DB(잠정) - 화면 Step 7 · 8 이 알림을 누르기 전의 상태. `P368_DUMP` 에 파일 경로를 주면 뜬다.
      if (process.env.P368_DUMP) {
        writeFileSync(process.env.P368_DUMP, execFileSync('docker', ['exec', process.env.P368_PG_CONTAINER ?? 'p368-db', 'pg_dump', '--inserts', '-U', 'postgres', GATE_DB], { encoding: 'utf8', maxBuffer: 1 << 28 }));
      }
      flow.step8Read = brief(await jaehoon.send('PATCH', `/api/v2/notifications/${flow.step6List.body.data.items[0].id}/read`));
      flow.step8ReadAgain = brief(await jaehoon.send('PATCH', `/api/v2/notifications/${flow.step6List.body.data.items[0].id}/read`));
      flow.step8Others = brief(await jaehoon.send('PATCH', `/api/v2/notifications/${flow.step6Doyun.body.data.items[0].id}/read`));
      flow.endRows = await notifRows();
      flow.nextIds = await onDb(GATE_DB, `SELECT (SELECT last_value FROM notifications_id_seq) AS notifications, (SELECT last_value FROM comments_id_seq) AS comments, (SELECT last_value FROM post_likes_id_seq) AS post_likes, (SELECT last_value FROM follows_id_seq) AS follows`);
    });
    seen.flow = flow;
    const liked = (likeCount) => ({ status: 200, body: { data: { liked: true, likeCount } } });
    const unliked = (likeCount) => ({ status: 200, body: { data: { liked: false, likeCount } } });
    const followed = (followerCount) => ({ status: 200, body: { data: { following: true, followerCount } } });
    const unfollowed = (followerCount) => ({ status: 200, body: { data: { following: false, followerCount } } });

    expect(flow.step1).toEqual([]);
    // Step 2 겪기 - 같은 PUT 두 번에 응답은 같고(132) 알림은 두 줄
    expect(flow.step2aPut).toEqual([liked(132), liked(132)]);
    expect(flow.step2aRows).toEqual([[1, 'LIKE', 2, 43], [2, 'LIKE', 2, 43]]);
    // Step 2 - 두 줄을 지우고 취소한 뒤 다시 두 번이면 한 줄(3번) · jaehoon 이 자기 게시물 26 에 누르면 알림 없음
    expect([flow.step2Unlike, ...flow.step2Put, flow.step2Own]).toEqual([unliked(131), liked(132), liked(132), liked(1)]);
    expect(flow.step2Rows).toEqual([[3, 'LIKE', 2, 43]]);
    // Step 3 첫 장면 - 취소해도 알림 3번이 남는다(좋아요 행은 0)
    expect(flow.step3Unlike).toEqual(unliked(131));
    expect([flow.step3Left, flow.step3LikeRows]).toEqual([[[3, 'LIKE', 2, 43]], 0]);
    // Step 3 - 마이그레이션이 그 거짓 알림을 지운다 · 다시 누르면 4번(좋아요 17) · 취소하면 사라진다 · 또 누르면 5번(좋아요 18)
    expect(flow.step3AfterMigrate).toEqual([]);
    expect([flow.step3Put, flow.step3Delete, flow.step3PutAgain]).toEqual([liked(132), unliked(131), liked(132)]);
    expect(flow.step3RowsAfterPut).toEqual([{ id: 4, type: 'LIKE', receiver_id: 2, sender_id: 43, post_id: 1, post_like_id: 17, comment_id: undefined, follow_id: undefined, is_read: false }]);
    expect([flow.step3LikeId, flow.step3RowsAfterDelete, flow.step3LikeIdEnd]).toEqual([17, [], 18]);
    expect(flow.step3RowsEnd.map((r) => [r.id, r.post_like_id])).toEqual([[5, 18]]);
    // Step 4 - 댓글 361 · 답글 362 가 COMMENT 둘(6 · 7) · jaehoon 의 자기 댓글 363 은 알림 없음 · 답글을 지우면 7번이 사라진다
    expect([flow.step4Comment.status, flow.step4Comment.body.data.comment.id, flow.step4Comment.body.data.commentCount]).toEqual([201, 361, 5]);
    expect([flow.step4Reply.status, flow.step4Reply.body.data.comment.id, flow.step4Reply.body.data.commentCount]).toEqual([201, 362, 5]);
    expect([flow.step4Own.status, flow.step4Own.body.data.comment.id, flow.step4Own.body.data.commentCount]).toEqual([201, 363, 6]);
    expect(flow.step4RowsAfterComments.map((r) => [r.id, r.type, r.comment_id])).toEqual([[5, 'LIKE', null], [6, 'COMMENT', 361], [7, 'COMMENT', 362]]);
    expect([flow.step4DeleteReply, flow.step4RowsAfterDelete]).toEqual([200, [[5, 'LIKE', 2, 43], [6, 'COMMENT', 2, 43]]]);
    // 팔로우 - doyun 이 원래 팔로우하던 것을 끊어도(3) 없던 알림이라 그대로 · 다시 팔로우 두 번이면 FOLLOW 한 줄(8 · 팔로우 40) · 끊으면 사라지고 · 또 팔로우하면 9(팔로우 42)
    expect([flow.step4Unfollow0, ...flow.step4Follow, flow.step4Unfollow, flow.step4FollowAgain]).toEqual([unfollowed(3), followed(4), followed(4), unfollowed(3), followed(4)]);
    expect(flow.step4Rows0).toEqual([[5, 'LIKE', 2, 43], [6, 'COMMENT', 2, 43]]);
    expect(flow.step4RowsFollow.map((r) => [r.id, r.type, r.sender_id, r.post_id, r.follow_id])).toEqual([[5, 'LIKE', 43, 1, null], [6, 'COMMENT', 43, 1, null], [8, 'FOLLOW', 44, null, 40]]);
    expect(flow.step4RowsUnfollow).toEqual([[5, 'LIKE', 2, 43], [6, 'COMMENT', 2, 43]]);
    expect(flow.step4RowsEnd.map((r) => [r.id, r.type, r.follow_id])).toEqual([[5, 'LIKE', null], [6, 'COMMENT', null], [9, 'FOLLOW', 42]]);
    // Step 5 겪기 - 댓글 364 하나에 jaehoon 둘(COMMENT 10 · MENTION 11) · doyun 하나(MENTION 12)
    expect([flow.step5aComment.status, flow.step5aComment.body.data.comment.id]).toEqual([201, 364]);
    expect(flow.step5aRows.map((r) => [r.id, r.type, r.receiver_id])).toEqual([[10, 'COMMENT', 2], [11, 'MENTION', 2], [12, 'MENTION', 44]]);
    // Step 5 - 그 댓글을 지우면 세 줄이 함께 사라지고, 다시 단 365 는 jaehoon COMMENT 13 · doyun MENTION 14
    expect([flow.step5Delete, flow.step5RowsAfterDelete]).toEqual([200, 0]);
    expect([flow.step5Comment.status, flow.step5Comment.body.data.comment.id]).toEqual([201, 365]);
    expect(flow.step5Rows.map((r) => [r.id, r.type, r.receiver_id])).toEqual([[13, 'COMMENT', 2], [14, 'MENTION', 44]]);
    // Step 6 - jaehoon 의 목록 넷(13 · 9 · 6 · 5) · 두 개씩이면 [13, 9] 다음 [6, 5] · doyun 은 멘션 하나
    const item = (id, type, sender, postId, message) => ({
      id, type, isRead: false, createdAt: expect.any(String), postId,
      sender: { id: sender === 'seoyeon' ? 43 : 44, username: sender, profileImage: null },
      thumbnailUrl: postId === null ? null : 'https://picsum.photos/seed/post1/600/600', message,
    });
    expect(flow.step6List).toEqual({ status: 200, body: { data: { items: [
      item(13, 'COMMENT', 'seoyeon', 1, 'seoyeon님이 회원님의 게시물에 댓글을 남겼어요'),
      item(9, 'FOLLOW', 'doyun', null, 'doyun님이 회원님을 팔로우하기 시작했어요'),
      item(6, 'COMMENT', 'seoyeon', 1, 'seoyeon님이 회원님의 게시물에 댓글을 남겼어요'),
      item(5, 'LIKE', 'seoyeon', 1, 'seoyeon님이 회원님의 게시물을 좋아해요'),
    ], hasNext: false, nextCursor: null } } });
    expect([flow.step6Page1.body.data.items.map((i) => i.id), flow.step6Page1.body.data.hasNext, typeof flow.step6Page1.body.data.nextCursor]).toEqual([[13, 9], true, 'string']);
    expect([flow.step6Page2.body.data.items.map((i) => i.id), flow.step6Page2.body.data.hasNext, flow.step6Page2.body.data.nextCursor]).toEqual([[6, 5], false, null]);
    expect(flow.step6Doyun.body.data.items).toEqual([item(14, 'MENTION', 'seoyeon', 1, 'seoyeon님이 댓글에서 회원님을 언급했어요')]);
    // Step 8 - 읽음 두 번 모두 200 · doyun 의 알림 14 는 jaehoon 에게 404
    expect([flow.step8Read, flow.step8ReadAgain]).toEqual([{ status: 200, body: { data: { id: 13, isRead: true } } }, { status: 200, body: { data: { id: 13, isRead: true } } }]);
    expect([flow.step8Others.status, flow.step8Others.body.error.code, flow.step8Others.body.error.message]).toEqual([404, 'NOTIFICATION_NOT_FOUND', '그런 알림은 없어요']);
    expect(flow.endRows.map((r) => [r.id, r.is_read])).toEqual([[5, false], [6, false], [9, false], [13, true], [14, false]]);
    expect(flow.nextIds).toEqual([{ notifications: '14', comments: '365', post_likes: '18', follows: '42' }]);
  }, 240_000);
});

describe('축 ② Step 1 - notifications 테이블', () => {
  it('컬럼 일곱(원인 컬럼은 아직 없다) · 종류는 넷 · 인덱스 (receiver_id, created_at DESC, id DESC) · FK 셋 모두 Cascade', async () => {
    await serve(1, async () => {
      const cols = await onDb(GATE_DB, `SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'notifications' ORDER BY ordinal_position`);
      expect(cols.map((c) => [c.column_name, c.is_nullable])).toEqual([['id', 'NO'], ['type', 'NO'], ['receiver_id', 'NO'], ['sender_id', 'NO'], ['post_id', 'YES'], ['is_read', 'NO'], ['created_at', 'NO']]);
      const kinds = await onDb(GATE_DB, `SELECT unnest(enum_range(NULL::notification_type))::text AS v`);
      expect(kinds.map((k) => k.v)).toEqual(['LIKE', 'COMMENT', 'FOLLOW', 'MENTION']);
      const idx = await onDb(GATE_DB, `SELECT indexdef FROM pg_indexes WHERE tablename = 'notifications' AND indexname <> 'notifications_pkey'`);
      expect(idx.map((i) => i.indexdef)).toEqual(['CREATE INDEX notifications_receiver_id_created_at_id_idx ON public.notifications USING btree (receiver_id, created_at DESC, id DESC)']);
      const fks = await onDb(GATE_DB, `SELECT conname, confdeltype FROM pg_constraint WHERE conrelid = 'notifications'::regclass AND contype = 'f' ORDER BY conname`);
      expect(fks.map((f) => [f.conname, f.confdeltype])).toEqual([['notifications_post_id_fkey', 'c'], ['notifications_receiver_id_fkey', 'c'], ['notifications_sender_id_fkey', 'c']]);
    });
  }, 60_000);
});

describe('축 ③ Step 3 - 마이그레이션의 정리', () => {
  it('좋아요가 없는 LIKE 알림은 지우고, 있는 것에는 그 좋아요 번호를 적는다 - Step 2 판에서 남긴 두 줄(하나는 취소한 좋아요)', async () => {
    await serve(2, async ({ base }) => {
      const seoyeon = await loggedIn(base, 'seoyeon');
      await seoyeon.send('PUT', '/api/v2/posts/1/likes/me');
      await seoyeon.send('PUT', '/api/v2/posts/14/likes/me');
      await seoyeon.send('DELETE', '/api/v2/posts/14/likes/me');
      expect((await notifRows()).map((r) => [r.id, r.post_id])).toEqual([[1, 1], [2, 14]]);
    });
    migrate(version(3), GATE_DB);
    const [{ id: likeId }] = await onDb(GATE_DB, 'SELECT id FROM post_likes WHERE post_id = 1 AND user_id = 43');
    expect((await notifRows()).map((r) => [r.id, r.post_id, r.post_like_id])).toEqual([[1, 1, likeId]]);
  }, 60_000);
});

describe('축 ④ Step 4 - 원인은 셋 가운데 정확히 하나', () => {
  it('하나도 없거나 둘이면 23514 notifications_one_cause', async () => {
    await serve(4, async () => {
      const none = await failOf(GATE_DB, `INSERT INTO notifications (type, receiver_id, sender_id) VALUES ('LIKE', 2, 43)`);
      expect([none.code, none.constraint]).toEqual(['23514', 'notifications_one_cause']);
      const [{ id: followId }] = await onDb(GATE_DB, 'SELECT id FROM follows WHERE follower_id = 44 AND following_id = 2');
      const [{ id: commentId }] = await onDb(GATE_DB, 'SELECT id FROM comments WHERE post_id = 1 ORDER BY id LIMIT 1');
      const two = await failOf(GATE_DB, `INSERT INTO notifications (type, receiver_id, sender_id, comment_id, follow_id) VALUES ('COMMENT', 2, 44, ${commentId}, ${followId})`);
      expect([two.code, two.constraint]).toEqual(['23514', 'notifications_one_cause']);
    });
  }, 60_000);
});

describe('축 ⑤ Step 5 - 멘션 규칙은 화면의 링크 규칙과 같다', () => {
  const FRONT = new URL('../instagram-next/', ROOT).pathname;
  it.skipIf(!existsSync(FRONT))('instagram-next cc/main 의 utils/mentions.js 와 같은 이름들을 뽑는다 - 열 문장', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'p368-front-'));
    dirs.push(dir);
    writeFileSync(join(dir, 'front.mjs'), execFileSync('git', ['show', 'cc/main:utils/mentions.js'], { cwd: FRONT, encoding: 'utf8' }));
    const front = await import(join(dir, 'front.mjs'));
    const server = await import(version(5)('utils/mentions.js'));
    const texts = ['@jaehoon @doyun 다음 주에 같이 가요', '메일은 a@b.com 이에요', '@dahye. 고마워요', '@jaehoon@doyun', 'x@jaehoon', '@kim.minji.', '(@doyun)', '@_a.b_', '@a..b', '@jaehoon 그리고 @jaehoon'];
    for (const text of texts) {
      const fromFront = [...new Set(front.splitMentions(text).filter((p) => p.username !== undefined).map((p) => p.username))];
      expect([text, server.extractMentions(text)]).toEqual([text, fromFront]);
    }
  });

  it('나 자신 · 가입하지 않은 이름 · 메일 주소는 알림이 없다 - 게시물 주인 jaehoon 에게 COMMENT 하나뿐', async () => {
    await serve(5, async ({ base }) => {
      const seoyeon = await loggedIn(base, 'seoyeon');
      const res = await seoyeon.send('POST', '/api/v2/posts/1/comments', { content: '@seoyeon @nobody 메일은 doyun@example.com' });
      expect((await notifRows()).filter((r) => r.comment_id === res.body.data.comment.id).map((r) => [r.type, r.receiver_id])).toEqual([['COMMENT', 2]]);
    });
  }, 60_000);
});

describe('축 ⑥ Step 6 - 알림 목록의 바깥', () => {
  it('로그인하지 않으면 401 · limit 0 이나 51 은 400 · 커서가 틀리면 400 · POST 는 405 · 알림이 없으면 빈 목록', async () => {
    await serve(6, async ({ base }) => {
      expect((await fetch(`${base}/api/v2/notifications`)).status).toBe(401);
      const jaehoon = await loggedIn(base, 'jaehoon');
      expect((await jaehoon.get('/api/v2/notifications?limit=0')).body.error.code).toBe('VALIDATION_FAILED');
      expect((await jaehoon.get('/api/v2/notifications?limit=51')).body.error.code).toBe('VALIDATION_FAILED');
      expect((await jaehoon.get('/api/v2/notifications?cursor=abc')).body.error.code).toBe('INVALID_CURSOR');
      const post = await jaehoon.send('POST', '/api/v2/notifications');
      expect([post.status, post.headers.get('allow')]).toEqual([405, 'GET']);
      expect((await jaehoon.get('/api/v2/notifications')).body).toEqual({ data: { items: [], hasNext: false, nextCursor: null } });
    });
  }, 60_000);
});

describe('축 ⑦ Step 8 - 읽음의 바깥', () => {
  it('번호가 아니면 404 · 없는 번호 404 · GET 은 405(Allow PATCH)', async () => {
    await serve(8, async ({ base }) => {
      const jaehoon = await loggedIn(base, 'jaehoon');
      const abc = await jaehoon.send('PATCH', '/api/v2/notifications/abc/read');
      const none = await jaehoon.send('PATCH', '/api/v2/notifications/9999/read');
      expect([abc.status, abc.body.error.code, none.status, none.body.error.code]).toEqual([404, 'NOTIFICATION_NOT_FOUND', 404, 'NOTIFICATION_NOT_FOUND']);
      const get = await jaehoon.get('/api/v2/notifications/1/read');
      expect([get.status, get.headers.get('allow')]).toEqual([405, 'PATCH']);
    });
  }, 60_000);
});
