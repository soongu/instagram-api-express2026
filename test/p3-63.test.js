// p3-63 「대화방·메시지 REST」 게이트 - 백엔드(교안 Step 1~8)
// 내부 검증 전용 - 교안에 한 줄도 인용하지 않는다.
//
// `9-realtime` 둘째 회차다(`curriculum.md` 「`p3-63` 착수 결정」 ①~⑧).
// 백엔드의 시작 판은 code/p3-62(f141650)의 학생 파일이다.
// 커밋 - «(Step N)» 표식. 같은 표식이 여럿이면 가장 뒤 feat 커밋이 그 Step 의 끝 판이다.
// 🔑 포트 - 3963 · `P363_PORT` 로 바꾼다. DB - `p363_api_` 로 시작하는 것만 만들고 지운다.
//    PostgreSQL 은 `P363_PG_PORT`(기본 5551 - 판정용 컨테이너 p360-db 를 이어 쓴다).
// 🔑 판정 DB 는 «p3-61 을 마친 학생 DB» `test/fixtures/p3-61-end.sql` 이다(p3-62 는 수업 DB 에 남는 쓰기가 팔로우 한 행뿐 - 대화방과 무관).
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
const PG_PORT = Number(process.env.P363_PG_PORT ?? 5551);
const ADMIN = { host: 'localhost', port: PG_PORT, database: 'postgres', user: 'postgres', password: 'postgres' };
const DB_PREFIX = process.env.P363_DB_PREFIX ?? 'p363_api';
const TPL_DB = `${DB_PREFIX}_tpl`;
const GATE_DB = `${DB_PREFIX}_gate`;
const dbUrl = (name) => `postgresql://postgres:postgres@localhost:${PG_PORT}/${name}`;
const PORT = Number(process.env.P363_PORT ?? 3963);
const SECRET = 'q2Xh0v9bGm4RkT7sYp1wLc8nZf3uJd6eHa5iVo0rQyE';
const env = {
  CORS_ORIGIN: 'http://localhost:3001', JWT_SECRET: SECRET,
  GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret', SITE_URL: `http://localhost:${PORT}`,
  KAKAO_CLIENT_ID: 'test-kakao', KAKAO_CLIENT_SECRET: 'test-kakao-secret',
  NAVER_CLIENT_ID: 'test-naver', NAVER_CLIENT_SECRET: 'test-naver-secret',
};
const STUDENT_FILES = ['app.js', 'db.js', 'errors.js', 'responses.js', 'routes', 'controllers', 'services', 'middlewares', 'schemas', 'strategies', 'docs', 'utils', 'package.json', 'requests', 'seed.js', 'data', 'prisma', 'prisma.config.js', '.env.example', 'lab'];
const FIXTURE = P('test/fixtures/p3-61-end.sql');

const git = (args) => execFileSync('git', args, { cwd: P('.'), encoding: 'utf8', maxBuffer: 1 << 28 });
const hasRef = (ref) => {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', ref], { cwd: P('.'), stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
};
// 🔑 판의 선 - 북마크 code/p3-63 이 있으면 그것, 없으면 지금 체크아웃한 선(HEAD). `P363_LINE` 으로 바꾼다.
const LINE = process.env.P363_LINE ?? (hasRef('refs/heads/code/p3-63') ? 'code/p3-63' : 'HEAD');
const WT = process.env.P363_WT ?? null;
const START = process.env.P363_BASE ?? 'code/p3-62';
/** «(표식)» 이 붙은 그 회차 커밋들 - 새것부터. */
const markCommits = (mark) => {
  const log = git(['log', '-n', '200', '--format=%H %s', LINE]);
  return log.split('\n').filter((l) => / feat\(p3-63\): /.test(l) && l.endsWith(`(${mark})`)).map((l) => l.split(' ')[0]);
};
const MARKS = { 1: 'Step 1', 2: 'Step 2', 3: 'Step 3', 4: 'Step 4', 5: 'Step 5', '6a': 'Step 6 403', 6: 'Step 6', 7: 'Step 7', 8: 'Step 8' };
const dirs = [];
const refDirs = new Map();
const refDir = (ref) => {
  if (refDirs.has(ref)) return refDirs.get(ref);
  const dir = mkdtempSync(join(tmpdir(), 'p363-ref-'));
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
  if (commits.length === 0) throw new Error(`p3-63 (${MARKS[step]}) 커밋이 없다`);
  return commits[0];
};
/** 그 Step 의 끝 판 - `P363_WT` 가 그 Step 이면 작업트리. */
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
  const dir = mkdtempSync(join(tmpdir(), 'p363-srv-'));
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

const JAEHOON_ID = 2;
const MINJI_ID = 3;
const SEOYEON_ID = 43;
const DOYUN_ID = 44;
const BORAM_ID = 48;
const CONV = '/api/v2/conversations';
const open = (tab, username) => tab.send('POST', CONV, { username });
const count = async (sql, db = GATE_DB) => (await onDb(db, sql))[0].n;

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

describe('축 ⓪ 판정 DB - p3-61 을 마친 학생 DB', () => {
  it('사람 22 · 대화방 표가 아직 없다 · 로그인할 수 있는 사람 번호', async () => {
    await freshDb();
    expect(await count('SELECT count(*)::int AS n FROM users')).toBe(22);
    expect(await count("SELECT count(*)::int AS n FROM pg_tables WHERE tablename IN ('conversations', 'direct_messages')")).toBe(0);
    const ids = await onDb(GATE_DB, "SELECT username, id FROM users WHERE username IN ('jaehoon', 'minji', 'seoyeon', 'doyun', 'boram') ORDER BY id");
    expect(ids.map((r) => [r.username, r.id])).toEqual([['jaehoon', 2], ['minji', 3], ['seoyeon', 43], ['doyun', 44], ['boram', 48]]);
  });
});

describe('축 ① Step 1 - 대화방과 메시지 테이블', () => {
  it('마이그레이션 하나 · 표 둘의 컬럼 · UNIQUE 짝 · b 자리 인덱스 · 메시지 최신순 인덱스 · 사람을 지우면 따라 지워진다', async () => {
    await serve(1, async () => {
      const cols = await onDb(GATE_DB, `SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns
        WHERE table_name IN ('conversations', 'direct_messages') ORDER BY table_name, ordinal_position`);
      expect(cols.map((c) => `${c.table_name}.${c.column_name}`)).toEqual([
        'conversations.id', 'conversations.participant_a_id', 'conversations.participant_b_id', 'conversations.created_at',
        'direct_messages.id', 'direct_messages.conversation_id', 'direct_messages.sender_id', 'direct_messages.content', 'direct_messages.is_read', 'direct_messages.created_at',
      ]);
      const idx = await onDb(GATE_DB, "SELECT indexname FROM pg_indexes WHERE tablename IN ('conversations', 'direct_messages') ORDER BY indexname");
      expect(idx.map((r) => r.indexname)).toEqual([
        'conversations_participant_a_id_participant_b_id_key', 'conversations_participant_b_id_idx', 'conversations_pkey',
        'direct_messages_conversation_id_created_at_id_idx', 'direct_messages_pkey',
      ]);
      const fks = await onDb(GATE_DB, `SELECT conname, confdeltype FROM pg_constraint WHERE contype = 'f'
        AND conrelid IN ('conversations'::regclass, 'direct_messages'::regclass) ORDER BY conname`);
      expect(fks.map((r) => [r.conname, r.confdeltype])).toEqual([
        ['conversations_participant_a_id_fkey', 'c'], ['conversations_participant_b_id_fkey', 'c'],
        ['direct_messages_conversation_id_fkey', 'c'], ['direct_messages_sender_id_fkey', 'c'],
      ]);
      const tooLong = await failOf(GATE_DB, `INSERT INTO direct_messages (conversation_id, sender_id, content) VALUES (1, 2, repeat('가', 1001))`);
      expect(tooLong.code).toBe('22001');
    });
  }, 60_000);

  it('seed 를 다시 돌려도 막히지 않는다 - TRUNCATE 목록 맨 앞에 두 표', () => {
    const seed = read(version(1)('seed.js'));
    expect(seed).toMatch(/TRUNCATE TABLE direct_messages, conversations, follows,/);
  });
});

describe('축 ② Step 2 - 대화방 만들기', () => {
  it('jaehoon 이 seoyeon 과 - 처음 201 + Location · 다시 200 같은 방 · 줄은 id · createdAt · otherUser', async () => {
    await serve(2, async ({ base }) => {
      const tab = await loggedIn(base, 'jaehoon');
      const first = await open(tab, 'seoyeon');
      expect(first.status).toBe(201);
      expect(first.headers.get('location')).toBe('/api/v2/conversations/1');
      expect(Object.keys(first.body.data)).toEqual(['id', 'createdAt', 'otherUser']);
      expect(first.body.data).toMatchObject({ id: 1, otherUser: { id: SEOYEON_ID, username: 'seoyeon', name: '박서연', profileImage: null } });
      const again = await open(tab, 'seoyeon');
      expect([again.status, again.headers.get('location'), again.body.data.id]).toEqual([200, null, 1]);
      expect(await count('SELECT count(*)::int AS n FROM conversations')).toBe(1);
      const row = (await onDb(GATE_DB, 'SELECT participant_a_id AS a, participant_b_id AS b FROM conversations'))[0];
      expect([row.a, row.b]).toEqual([JAEHOON_ID, SEOYEON_ID]);
    });
  }, 60_000);

  it('없는 사람 404 USER_NOT_FOUND · 이름 없이 400 · 로그인 없이 401 · GET 은 405 + Allow: POST', async () => {
    await serve(2, async ({ base }) => {
      expect(errOf(await open(browser(base), 'seoyeon'))).toEqual([401, 'LOGIN_REQUIRED']);
      const tab = await loggedIn(base, 'jaehoon');
      expect(errOf(await open(tab, 'nobody'))).toEqual([404, 'USER_NOT_FOUND']);
      expect(errOf(await tab.send('POST', CONV, {}))).toEqual([400, 'VALIDATION_FAILED']);
      const get = await tab.get(CONV);
      expect([get.status, get.headers.get('allow')]).toEqual([405, 'POST']);
    });
  }, 60_000);
});
