// p3-65 「대화방 목록이 메시지를 따라가게」 게이트 - 수업 백엔드(교안 Step 1~8) · 실습 서버(직접 해보기 둘 · 과제 둘)
// 내부 검증 전용 - 교안에 한 줄도 인용하지 않는다.
//
// `9-realtime` 넷째 회차다(`curriculum.md` 「`p3-65` 착수 결정」).
// 백엔드의 시작 판은 code/p3-64(34ea102)의 학생 파일이다. Step 1 · 7 은 코드가 안 바뀌어 커밋이 없다.
// 커밋 - «(Step N)» · «(직접 해보기 N)» · «(과제 [기초])» 표식. 같은 표식이 여럿이면 가장 뒤 feat 커밋이 그 판이다.
// 🔑 포트 - 3966 · `P365_PORT` 로 바꾼다. 실습 서버는 4966(사본에서 4001 숫자만 바꾼다). DB - `p365_api_` 로 시작하는 것만 만들고 지운다.
//    PostgreSQL 은 `P365_PG_PORT`(기본 5551 - 판정용 컨테이너 p360-db 를 이어 쓴다).
// 🔑 판정 DB 는 «p3-64 를 마친 학생 DB» `test/fixtures/p3-64-end.sql` 이다(방 1 · 7 · 8 · 메시지 1 · 2 · 8 · 9 · 10 · 12 · 다음 메시지 번호 13).
// 🔑 Socket.IO 클라이언트는 `socket.io-client` - package.json 에 없다(학생 파일이 아니다). `npm install --no-save socket.io-client` 로 깐다.
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
const PG_PORT = Number(process.env.P365_PG_PORT ?? 5551);
const ADMIN = { host: 'localhost', port: PG_PORT, database: 'postgres', user: 'postgres', password: 'postgres' };
const DB_PREFIX = process.env.P365_DB_PREFIX ?? 'p365_api';
const TPL_DB = `${DB_PREFIX}_tpl`;
const GATE_DB = `${DB_PREFIX}_gate`;
const dbUrl = (name) => `postgresql://postgres:postgres@localhost:${PG_PORT}/${name}`;
const PORT = Number(process.env.P365_PORT ?? 3966);
const SECRET = 'q2Xh0v9bGm4RkT7sYp1wLc8nZf3uJd6eHa5iVo0rQyE';
const env = {
  CORS_ORIGIN: 'http://localhost:3001', JWT_SECRET: SECRET,
  GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret', SITE_URL: `http://localhost:${PORT}`,
  KAKAO_CLIENT_ID: 'test-kakao', KAKAO_CLIENT_SECRET: 'test-kakao-secret',
  NAVER_CLIENT_ID: 'test-naver', NAVER_CLIENT_SECRET: 'test-naver-secret',
};
const STUDENT_FILES = ['app.js', 'db.js', 'errors.js', 'responses.js', 'routes', 'controllers', 'services', 'middlewares', 'schemas', 'strategies', 'docs', 'utils', 'package.json', 'requests', 'seed.js', 'data', 'prisma', 'prisma.config.js', '.env.example', 'lab', 'realtime.js', 'public'];
const FIXTURE = P('test/fixtures/p3-64-end.sql');

const git = (args) => execFileSync('git', args, { cwd: P('.'), encoding: 'utf8', maxBuffer: 1 << 28 });
const hasRef = (ref) => {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', ref], { cwd: P('.'), stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
};
// 🔑 판의 선 - 북마크 code/p3-65 가 있으면 그것, 없으면 지금 체크아웃한 선(HEAD). `P365_LINE` 으로 바꾼다.
const LINE = process.env.P365_LINE ?? (hasRef('refs/heads/code/p3-65') ? 'code/p3-65' : 'HEAD');
const WT = process.env.P365_WT ?? null;
const START = process.env.P365_BASE ?? 'code/p3-64';
/** «(표식)» 이 붙은 그 회차 커밋들 - 새것부터. */
const markCommits = (mark) => {
  const log = git(['log', '-n', '200', '--format=%H %s', LINE]);
  return log.split('\n').filter((l) => / feat\(p3-65\): /.test(l) && l.endsWith(`(${mark})`)).map((l) => l.split(' ')[0]);
};
const MARKS = { 2: 'Step 2', 3: 'Step 3', 4: 'Step 4', 5: 'Step 5', 6: 'Step 6', 8: 'Step 8', lab1: '직접 해보기 1', lab2: '직접 해보기 2', hw1: '과제 [기초]', hw2: '과제 [응용]' };
const dirs = [];
const refDirs = new Map();
const refDir = (ref) => {
  if (refDirs.has(ref)) return refDirs.get(ref);
  const dir = mkdtempSync(join(tmpdir(), 'p365-ref-'));
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
  if (commits.length === 0) throw new Error(`p3-65 (${MARKS[step]}) 커밋이 없다`);
  return commits[0];
};
/** 그 Step 의 끝 판 - `P365_WT` 가 그 Step 이면 작업트리. */
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
  const dir = mkdtempSync(join(tmpdir(), 'p365-srv-'));
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

import { io as connectIo } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import { spawn } from 'node:child_process';
import { launchChrome, CHROME } from './helpers/chrome.js';

const JAEHOON_ID = 2;
const DOYUN_ID = 44;
const BORAM_ID = 48;
const LAB_PORT = Number(process.env.P365_LAB_PORT ?? 4966);
const count = async (sql, db = GATE_DB) => (await onDb(db, sql))[0].n;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 이어진 흐름 - 판정 DB 를 처음에만 세우고, Step 마다 그 판의 서버로 갈아 끼운다. `before` 는 그 판을 띄우기 전 SQL. */
const flow = async (stages) => {
  await freshDb();
  for (const { step, before, run, edit = null } of stages) {
    if (before) await before();
    const from = version(step);
    generateFor(from);
    migrate(from, GATE_DB);
    const dir = studentDir(from);
    if (edit) edit(dir);
    await bootIn(dir, GATE_DB, run ?? (async () => {}));
  }
};

/** 연결 하나 - 받은 이벤트를 `events` 에 모은다. `cookie` 는 그 탭의 로그인 쿠키. */
const socketOf = async (base, cookie = '', { headers = {} } = {}) => {
  const events = [];
  const socket = connectIo(base, {
    extraHeaders: { ...(cookie ? { cookie } : {}), ...headers }, reconnection: false, transports: ['polling', 'websocket'],
  });
  socket.onAny((event, value) => events.push([event, value]));
  const outcome = await new Promise((resolve) => {
    socket.on('connect', () => resolve({ connected: true }));
    socket.on('connect_error', (error) => resolve({ connected: false, message: error.message, data: error.data }));
  });
  return { socket, events, ...outcome, close: () => socket.disconnect() };
};
/** 그 사람으로 로그인한 탭의 연결 - 수업 백엔드 `base` 에서 로그인하고 `target` 에 연결한다. */
const personOf = async (base, username, target = base) => {
  const tab = await loggedIn(base, username);
  return socketOf(target, tab.cookie());
};
const send = (person, payload, ms = 1500) => person.socket.timeout(ms).emitWithAck('dm:send', payload).catch((e) => ({ timeout: e.message }));
const settle = () => sleep(300);
const messagesOf = (person) => person.events.filter(([e]) => e === 'dm:message').map(([, m]) => [m.id, m.senderId, m.content]);
const typingOf = (person) => person.events.filter(([e]) => e === 'dm:typing').map(([, t]) => t);
const rowsOf = async (conversationId) => (await onDb(GATE_DB,
  'SELECT id, sender_id AS s, content FROM direct_messages WHERE conversation_id = $1 ORDER BY id', [conversationId])).map((r) => [r.id, r.s, r.content]);
const logLines = (tail, re) => tail().split('\n').filter((line) => re.test(line));

// 교안의 메시지 - 이어진 흐름에서 이 차례로 보낸다(번호는 판정 DB 의 시퀀스 12 다음부터).
const MA = '민지 님, 이번 주 스터디도 저녁 7시예요?'; // 13 · Step 1 · 7번 방
const MB = '장소는 지난번 그 카페예요'; // 14 · Step 3 겪기 · 7번 방
const MC = '늦으면 연락 주세요'; // 15 · Step 3 · 7번 방
const HELLO = '잘 지내요?'; // 16 · Step 6 겪기 · seoyeon · 1번 방
const WEEKEND = '주말에 시간 있어요?'; // 17 · Step 6 · seoyeon · 1번 방
const PHOTO = '사진 잘 받았어요!'; // 18 · Step 7 · doyun · 8번 방
const SLOW_J = '원본도 따로 보내 드릴까요?'; // 19 · Step 8 겪기 · jaehoon · 8번 방
const SLOW_D = '네, 부탁해요'; // 20 · Step 8 겪기 · doyun · 8번 방
const FIX_J = '지금 보내요'; // 21 · Step 8 · jaehoon · 8번 방
const FIX_D = '고마워요!'; // 22 · Step 8 · doyun · 8번 방

const SNAP = (name) => P(`snapshots/p3-65/${name}`);
/** 서비스 파일 하나를 스냅숏으로 바꾼 사본 */
const withService = (name) => (dir) => cpSync(SNAP(name), join(dir, 'services/conversationService.js'));
const ROOMS = '/api/v2/conversations';
const listOf = async (tab, query = '') => {
  const res = await tab.get(`${ROOMS}${query}`);
  expect(res.status).toBe(200);
  return res.body.data;
};
const roomIdsOf = (page) => page.items.map((c) => c.id);
const previewsOf = (page) => page.items.map((c) => [c.id, c.otherUser.username, c.lastMessage?.content ?? null]);
const lastIds = async () => (await onDb(GATE_DB, 'SELECT id, last_message_id AS m FROM conversations ORDER BY id')).map((r) => [r.id, r.m]);
const decoded = (cursor) => JSON.parse(Buffer.from(cursor, 'base64url').toString());
const sendOk = async (person, conversationId, content) => {
  const res = await send(person, { conversationId, content }, 8000);
  expect(res.data?.content).toBe(content);
  return res.data;
};
const together = async (base, names, fn) => {
  const people = {};
  for (const name of names) people[name] = await personOf(base, name);
  try {
    return await fn(people);
  } finally {
    for (const p of Object.values(people)) p.close();
  }
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

describe('축 ⓪ 판정 DB - p3-64 를 마친 학생 DB', () => {
  it('방 1 · 7 · 8 · 메시지 1 · 2(7번 방) · 8 · 9 · 10 · 12(8번 방) · 다음 메시지 번호 13 · 마지막 메시지 컬럼은 아직 없다', async () => {
    await freshDb();
    const rooms = await onDb(GATE_DB, 'SELECT id FROM conversations ORDER BY id');
    expect(rooms.map((r) => r.id)).toEqual([1, 7, 8]);
    const msgs = await onDb(GATE_DB, 'SELECT id, conversation_id AS c FROM direct_messages ORDER BY id');
    expect(msgs.map((m) => [m.id, m.c])).toEqual([[1, 7], [2, 7], [8, 8], [9, 8], [10, 8], [12, 8]]);
    expect(await count('SELECT last_value::int AS n FROM direct_messages_id_seq')).toBe(12);
    const cols = await onDb(GATE_DB, "SELECT column_name FROM information_schema.columns WHERE table_name = 'conversations' AND column_name LIKE 'last_%'");
    expect(cols).toEqual([]);
  });
});

// ── 이어진 흐름 - 교안 차례 그대로 ──────────────────────────────────────────
// 학생은 수업 서버 하나를 켜 둔 채 Step 마다 파일을 고친다. 판정은 Step 마다 그 판의 서버로 갈아 끼우고 DB 는 이어 쓴다.
const seen = {};
const STAGE_1 = {
  step: 'start',
  run: async ({ base }) => {
    // Step 1 - jaehoon 이 시험 화면에서 7번 방(minji)에 보낸다. 목록은 그대로 [8, 7] 이고 7번 방의 미리보기만 바뀐다.
    await together(base, ['jaehoon'], async ({ jaehoon }) => {
      seen.ma = await sendOk(jaehoon, 7, MA);
    });
    const tab = await loggedIn(base, 'jaehoon');
    seen.list1 = await listOf(tab);
  },
};
const STAGE_2 = {
  step: 2,
  run: async ({ base }) => {
    seen.backfill = await lastIds();
    seen.backfillAt = await onDb(GATE_DB, 'SELECT id, last_message_at = created_at AS same FROM conversations ORDER BY id');
    // Step 3 겪기 - 컬럼은 있지만 보내기가 안 고친다.
    await together(base, ['jaehoon'], async ({ jaehoon }) => {
      seen.mb = await sendOk(jaehoon, 7, MB);
    });
    seen.afterMb = await lastIds();
  },
};
const STAGE_3 = {
  step: 3,
  run: async ({ base }) => {
    await together(base, ['jaehoon'], async ({ jaehoon }) => {
      seen.mc = await sendOk(jaehoon, 7, MC);
    });
    seen.afterMc = await lastIds();
    seen.list3 = await listOf(await loggedIn(base, 'jaehoon'));
  },
};
const STAGE_4 = {
  step: 4,
  run: async ({ base }) => {
    const tab = await loggedIn(base, 'jaehoon');
    seen.list4 = await listOf(tab);
    seen.page4a = await listOf(tab, '?limit=1');
    seen.page4b = await listOf(tab, `?limit=1&cursor=${seen.page4a.nextCursor}`);
  },
};
const STAGE_5 = {
  step: 5,
  edit: withQueryLog,
  run: async ({ base, tail }) => {
    const tab = await loggedIn(base, 'jaehoon');
    const before = queryLines(tail()).length;
    seen.list5 = await listOf(tab);
    seen.log5 = queryLines(tail()).slice(before);
    // Step 6 겪기 - seoyeon 이 둘 다 지운 1번 방에 보내도 jaehoon 의 목록에 안 뜬다.
    await together(base, ['seoyeon'], async ({ seoyeon }) => {
      seen.hello = await sendOk(seoyeon, 1, HELLO);
    });
    seen.list5b = await listOf(tab);
  },
};
const STAGE_6A = {
  step: 5,
  edit: withService('step6-filter-only.conversationService.js'),
  run: async ({ base }) => {
    const tab = await loggedIn(base, 'jaehoon');
    seen.list6a = await listOf(tab);
    // 지운 방을 다시 여는 경우 - jaehoon 이 1번 방을 다시 지우고 seoyeon 과의 방을 연다.
    seen.clear6 = (await tab.send('DELETE', `${ROOMS}/1`)).status;
    seen.list6a2 = await listOf(tab);
    seen.open6a = brief(await tab.send('POST', ROOMS, { username: 'seoyeon' }));
  },
};
const STAGE_6 = {
  step: 6,
  run: async ({ base }) => {
    const tab = await loggedIn(base, 'jaehoon');
    seen.open6 = brief(await tab.send('POST', ROOMS, { username: 'seoyeon' }));
    seen.list6 = await listOf(tab);
    await together(base, ['seoyeon'], async ({ seoyeon }) => {
      seen.weekend = await sendOk(seoyeon, 1, WEEKEND);
    });
    seen.list6b = await listOf(tab);
    seen.history6 = (await tab.get(`${ROOMS}/1/messages`)).body.data;
    // Step 7 - 2개씩 받는 사이에 doyun 이 8번 방에 보낸다. 8번 방은 맨 위로 올라가 이번 내리기에서 안 보인다.
    seen.page7a = await listOf(tab, '?limit=2');
    await together(base, ['doyun'], async ({ doyun }) => {
      seen.photo = await sendOk(doyun, 8, PHOTO);
    });
    seen.page7b = await listOf(tab, `?limit=2&cursor=${seen.page7a.nextCursor}`);
    seen.list7 = await listOf(tab);
  },
};
const raceIn = async (base, j, d) => together(base, ['jaehoon', 'doyun'], async ({ jaehoon, doyun }) => {
  const first = send(jaehoon, { conversationId: 8, content: j }, 8000);
  await sleep(500);
  const second = send(doyun, { conversationId: 8, content: d }, 8000);
  const started = Date.now();
  const [a, b] = await Promise.all([first, second]);
  return { a: a.data, b: b.data, ms: Date.now() - started };
});
const STAGE_8A = {
  step: 6,
  edit: withService('step8-slow.conversationService.js'),
  run: async ({ base }) => {
    seen.race = await raceIn(base, SLOW_J, SLOW_D);
    seen.list8a = await listOf(await loggedIn(base, 'jaehoon'));
    seen.last8a = await lastIds();
  },
};
const STAGE_8B = {
  step: 8,
  edit: withService('step8-slow-fixed.conversationService.js'),
  run: async ({ base }) => {
    seen.raceFixed = await raceIn(base, FIX_J, FIX_D);
    seen.list8b = await listOf(await loggedIn(base, 'jaehoon'));
    seen.last8b = await lastIds();
  },
};
const STAGE_8 = { step: 8, run: async ({ base }) => { seen.list8 = await listOf(await loggedIn(base, 'jaehoon')); } };
const ALL = [STAGE_1, STAGE_2, STAGE_3, STAGE_4, STAGE_5, STAGE_6A, STAGE_6, STAGE_8A, STAGE_8B, STAGE_8];

describe('축 ①~⑧ 이어진 흐름 - 교안 차례 그대로', () => {
  beforeAll(async () => {
    await flow(ALL);
    if (process.env.P365_KEEP) {
      await admin(async (client) => {
        await client.query(`DROP DATABASE IF EXISTS ${DB_PREFIX}_end`);
        await kick(client, GATE_DB);
        await client.query(`CREATE DATABASE ${DB_PREFIX}_end TEMPLATE ${GATE_DB}`);
      });
    }
  }, 240_000);

  it('Step 1 - 7번 방에 보내도 목록은 [8, 7] 그대로 · 7번 방의 미리보기는 방금 보낸 13번', () => {
    expect(seen.ma.id).toBe(13);
    expect(roomIdsOf(seen.list1)).toEqual([8, 7]);
    expect(previewsOf(seen.list1)).toEqual([[8, 'doyun', '방금 사진 보냈어요'], [7, 'minji', MA]]);
  });

  it('Step 2 - 마이그레이션이 이미 있는 방을 채운다 · 1번 방은 메시지가 없어 번호가 비고 시각은 만든 시각', () => {
    expect(seen.backfill).toEqual([[1, null], [7, 13], [8, 12]]);
    expect(seen.backfillAt.map((r) => [r.id, r.same])).toEqual([[1, true], [7, false], [8, false]]);
  });

  it('Step 3 겪기 - Step 2 판으로 보낸 14번은 대화방 행을 안 고친다(7번 방은 여전히 13)', () => {
    expect(seen.mb.id).toBe(14);
    expect(seen.afterMb).toEqual([[1, null], [7, 13], [8, 12]]);
  });

  it('Step 3 - 트랜잭션 판으로 보낸 15번이 7번 방의 마지막 메시지가 된다 · 목록은 아직 만든 차례 [8, 7]', () => {
    expect(seen.mc.id).toBe(15);
    expect(seen.afterMc).toEqual([[1, null], [7, 15], [8, 12]]);
    expect(roomIdsOf(seen.list3)).toEqual([8, 7]);
  });

  it('Step 4 - 목록이 [7, 8] · 1개씩이면 7 → 8 · 커서에는 lastMessageAt 과 id', () => {
    expect(roomIdsOf(seen.list4)).toEqual([7, 8]);
    expect(previewsOf(seen.list4)).toEqual([[7, 'minji', MC], [8, 'doyun', '방금 사진 보냈어요']]);
    expect(Object.keys(seen.list4.items[0])).toEqual(['id', 'createdAt', 'lastMessageAt', 'otherUser', 'lastMessage']);
    expect([roomIdsOf(seen.page4a), seen.page4a.hasNext]).toEqual([[7], true]);
    expect(Object.keys(decoded(seen.page4a.nextCursor))).toEqual(['lastMessageAt', 'id']);
    expect(decoded(seen.page4a.nextCursor)).toEqual({ lastMessageAt: seen.mc.createdAt, id: 7 });
    expect([roomIdsOf(seen.page4b), seen.page4b.hasNext, seen.page4b.nextCursor]).toEqual([[8], false, null]);
  });

  it('Step 5 - 목록은 그대로 · 메시지를 읽는 쿼리는 번호 둘로 찾고 ORDER BY 가 없다', () => {
    expect(previewsOf(seen.list5)).toEqual(previewsOf(seen.list4));
    const msgQueries = seen.log5.filter((l) => /FROM "public"\."direct_messages"/.test(l));
    expect(msgQueries).toHaveLength(1);
    expect(msgQueries[0]).toMatch(/WHERE "public"\."direct_messages"\."id" IN \(\$1,\$2\) OFFSET \$3$/);
    expect(msgQueries[0]).not.toMatch(/ORDER BY/);
  });

  it('Step 6 겪기 - seoyeon 이 1번 방에 16번을 보내도 jaehoon 의 목록은 [7, 8]', () => {
    expect(seen.hello.id).toBe(16);
    expect(roomIdsOf(seen.list5b)).toEqual([7, 8]);
  });

  it('Step 6 거르기만 고친 판 - 1번 방이 맨 위로 · jaehoon 이 다시 지우면 빠지고, 다시 열면 지운 «잘 지내요?» 가 미리보기로 온다', () => {
    expect(previewsOf(seen.list6a)).toEqual([[1, 'seoyeon', HELLO], [7, 'minji', MC], [8, 'doyun', '방금 사진 보냈어요']]);
    expect(seen.clear6).toBe(204);
    expect(roomIdsOf(seen.list6a2)).toEqual([7, 8]);
    expect(seen.open6a.status).toBe(200);
    expect(seen.open6a.body.data.lastMessage.content).toBe(HELLO);
  });

  it('Step 6 - 다시 열면 미리보기가 null · 지운 시각은 응답에 없다 · seoyeon 의 17번이 오면 1번 방이 다시 뜨고 이력은 17번만', () => {
    expect(seen.open6.status).toBe(200);
    expect(seen.open6.body.data.lastMessage).toBe(null);
    expect(Object.keys(seen.open6.body.data)).toEqual(['id', 'createdAt', 'lastMessageAt', 'otherUser', 'lastMessage']);
    expect(roomIdsOf(seen.list6)).toEqual([7, 8]);
    expect(seen.weekend.id).toBe(17);
    expect(previewsOf(seen.list6b)).toEqual([[1, 'seoyeon', WEEKEND], [7, 'minji', MC], [8, 'doyun', '방금 사진 보냈어요']]);
    expect(seen.history6.items.map((m) => [m.id, m.content])).toEqual([[17, WEEKEND]]);
  });

  it('Step 7 - 2개씩 [1, 7] 을 받은 뒤 8번 방에 18번이 오면 다음 페이지는 빈 목록 · 새로 받으면 [8, 1, 7]', () => {
    expect([roomIdsOf(seen.page7a), seen.page7a.hasNext]).toEqual([[1, 7], true]);
    expect(seen.photo.id).toBe(18);
    expect([seen.page7b.items, seen.page7b.hasNext, seen.page7b.nextCursor]).toEqual([[], false, null]);
    expect(previewsOf(seen.list7)).toEqual([[8, 'doyun', PHOTO], [1, 'seoyeon', WEEKEND], [7, 'minji', MC]]);
  });

  it('Step 8 겪기 - jaehoon 의 19번이 늦게 끝나 doyun 의 20번을 덮는다 · 미리보기가 앞 메시지', () => {
    expect([seen.race.a.id, seen.race.b.id]).toEqual([19, 20]);
    expect(seen.race.a.createdAt < seen.race.b.createdAt).toBe(true);
    expect(seen.last8a).toEqual([[1, 17], [7, 15], [8, 19]]);
    expect(previewsOf(seen.list8a)[0]).toEqual([8, 'doyun', SLOW_J]);
  });

  it('Step 8 - 늦추는 줄을 둔 채 조건을 붙이면 doyun 의 22번이 남는다 · 늦추는 줄을 지운 판도 같다', () => {
    expect([seen.raceFixed.a.id, seen.raceFixed.b.id]).toEqual([21, 22]);
    expect(seen.last8b).toEqual([[1, 17], [7, 15], [8, 22]]);
    expect(previewsOf(seen.list8b)[0]).toEqual([8, 'doyun', FIX_D]);
    expect(previewsOf(seen.list8)).toEqual([[8, 'doyun', FIX_D], [1, 'seoyeon', WEEKEND], [7, 'minji', MC]]);
  });
});

describe('축 ⑨ 스냅숏 - 교안이 말로만 하는 판은 회차 판에서 그 부분만 다르다', () => {
  const lines = (text) => text.split('\n');
  const onlyIn = (a, b) => lines(b).filter((l) => !lines(a).includes(l));
  it('늦추는 줄 - Step 6 · Step 8 판에 같은 두 줄(주석 + if)만 더했다', () => {
    const slow = read(SNAP('step8-slow.conversationService.js'));
    const slowFixed = read(SNAP('step8-slow-fixed.conversationService.js'));
    const s6 = read(version(6)('services/conversationService.js'));
    const s8 = read(version(8)('services/conversationService.js'));
    const delay = [
      '    // 겪어 보려고 잠깐 넣는 줄 - jaehoon(2번)이 보낸 메시지만 대화방 행을 3초 늦게 고친다.',
      '    if (myId === 2) await new Promise((resolve) => setTimeout(resolve, 3000));',
    ];
    expect(onlyIn(s6, slow)).toEqual(delay);
    expect(onlyIn(slow, s6)).toEqual([]);
    expect(onlyIn(s8, slowFixed)).toEqual(delay);
    expect(onlyIn(slowFixed, s8)).toEqual([]);
  });
  it('거르기만 고친 판 - Step 5 판의 목록 where 만 Step 6 판의 것', () => {
    const mid = read(SNAP('step6-filter-only.conversationService.js'));
    const s5 = read(version(5)('services/conversationService.js'));
    const s6 = read(version(6)('services/conversationService.js'));
    expect(onlyIn(s5, mid).every((l) => lines(s6).includes(l))).toBe(true);
    expect(onlyIn(mid, s5)).toEqual([
      '        // 내가 a 자리에 있고 지우지 않은 방과, b 자리에 있고 지우지 않은 방',
      '        { OR: [{ participantAId: myId, aClearedAt: null }, { participantBId: myId, bClearedAt: null }] },',
    ]);
  });
});

describe('축 ⑩ 커서 함수 - 시각 이름을 받게 바꿔도 다른 목록의 커서 글자는 그대로', () => {
  it('encodeCursor(row) 는 옛 판과 같은 글자 · lastMessageAt 이름으로 접고 풀 수 있다 · 이름이 다르면 INVALID_CURSOR', async () => {
    const now = await import(join(studentDir(version(4)), 'utils/cursor.js'));
    const old = await import(join(studentDir(version('start')), 'utils/cursor.js'));
    const row = { createdAt: new Date('2026-11-26T07:30:52.785Z'), id: 12, content: '무엇이든' };
    expect(now.encodeCursor(row)).toBe(old.encodeCursor(row));
    const c = now.encodeCursor({ lastMessageAt: new Date('2026-11-26T07:30:52.785Z'), id: 8 }, 'lastMessageAt');
    expect(now.decodeCursor(c, 'lastMessageAt')).toEqual({ lastMessageAt: '2026-11-26T07:30:52.785Z', id: 8 });
    expect(() => now.decodeCursor(c)).toThrow();
  });
});

describe('축 ⑪ Step 7 - 커서에 방 번호만 담으면(스냅숏)', () => {
  it('2개씩 [1, 7] 을 받은 뒤 7번 방에 메시지가 오면 다음 페이지가 [1, 8] - 1번 방이 두 번 · 값을 담은 회차 판은 [8]', async () => {
    const scene = async (edit) => {
      let got;
      await flow([
        { step: 6, run: async ({ base }) => {
          // 판정 DB 에서 1번 방이 [1, 7, 8] 차례로 보이게 - seoyeon 이 1번 방에, jaehoon 이 7번 방에
          await together(base, ['seoyeon'], async ({ seoyeon }) => { await sendOk(seoyeon, 1, WEEKEND); });
          await together(base, ['jaehoon'], async ({ jaehoon }) => { await sendOk(jaehoon, 7, MC); });
          await together(base, ['seoyeon'], async ({ seoyeon }) => { await sendOk(seoyeon, 1, HELLO); });
        } },
        { step: 6, edit, run: async ({ base }) => {
          const tab = await loggedIn(base, 'jaehoon');
          const first = await listOf(tab, '?limit=2');
          await together(base, ['jaehoon'], async ({ jaehoon }) => { await sendOk(jaehoon, 7, MA); });
          const second = await listOf(tab, `?limit=2&cursor=${first.nextCursor}`);
          got = [roomIdsOf(first), roomIdsOf(second)];
        } },
      ]);
      return got;
    };
    expect(await scene(withService('step7-room-id-cursor.conversationService.js'))).toEqual([[1, 7], [1, 8]]);
    expect(await scene(null)).toEqual([[1, 7], [8]]);
  }, 120_000);
});

// ── 오프닝 - 메시지 1만 개 · 10만 개 ───────────────────────────────────────
const bulk = (n) => `INSERT INTO direct_messages (conversation_id, sender_id, content, is_read, created_at)
  SELECT 8, 44, '메시지 ' || g, true, TIMESTAMP '2026-11-20 07:00:00' + g * INTERVAL '1 second' FROM generate_series(1, ${n}) g`;
const timeList = async (base, n = 15) => {
  const tab = await loggedIn(base, 'jaehoon');
  for (let i = 0; i < 3; i += 1) await listOf(tab);
  const ms = [];
  for (let i = 0; i < n; i += 1) {
    const t = performance.now();
    await listOf(tab);
    ms.push(performance.now() - t);
  }
  ms.sort((a, b) => a - b);
  return ms[Math.floor(n / 2)];
};
/** 8번 방에 n 개를 넣은 DB 에서 p3-64 판과 Step 5 판의 목록 응답 시간(가운데 값) */
const measure = async (n) => {
  await freshDb();
  await onDb(GATE_DB, bulk(n));
  expect(await count('SELECT count(*)::int AS n FROM direct_messages WHERE conversation_id IN (7, 8)')).toBe(n + 6);
  const got = { n };
  await serve('start', async ({ base, tail }) => {
    const before = queryLines(tail()).length;
    const page = await listOf(await loggedIn(base, 'jaehoon'));
    expect(previewsOf(page)).toEqual([[8, 'doyun', '방금 사진 보냈어요'], [7, 'minji', '저녁 7시요!']]);
    const q = queryLines(tail()).slice(before).filter((l) => /FROM "public"\."direct_messages"/.test(l));
    expect(q).toHaveLength(1);
    expect(q[0]).toMatch(/WHERE "public"\."direct_messages"\."conversation_id" IN \(\$1,\$2\)/);
    expect(q[0]).not.toMatch(/LIMIT/);
    got.before = await timeList(base);
  }, { fresh: false, edit: withQueryLog });
  await serve(5, async ({ base }) => {
    got.after = await timeList(base);
  }, { fresh: false });
  return got;
};
describe('축 ⑫ 오프닝 - 8번 방에 메시지 1만 개 · 10만 개를 넣고 목록을 보내면', () => {
  it('p3-64 판은 방 둘의 미리보기를 보이려고 두 방의 메시지를 모두 읽어(LIMIT 없음) 메시지 수만큼 느려진다 · Step 5 판은 그대로', async () => {
    const small = await measure(10_000);
    const large = await measure(100_000);
    writeFileSync(join(tmpdir(), 'p365-opening.txt'), [small, large].map((m) => `${m.n} - p3-64 판 ${m.before.toFixed(1)}ms · Step 5 판 ${m.after.toFixed(1)}ms`).join('\n'));
    expect(large.before).toBeGreaterThan(small.before * 4);
    expect(large.before).toBeGreaterThan(large.after * 8);
    expect(large.after).toBeLessThan(small.after * 2);
  }, 180_000);
});

describe('축 ⑬ last_message_id 에 UNIQUE 를 걸면 - 같은 방에 거의 동시에 보내면 한쪽이 교착으로 실패한다', () => {
  it('UNIQUE 를 SQL 로 더한 DB 에서 늦추는 줄 판(Step 8) - jaehoon 쪽 ack 가 INTERNAL_ERROR · 터미널에 P2034 · 그 메시지는 저장되지 않는다', async () => {
    let got;
    await serve(8, async ({ base, tail }) => {
      await onDb(GATE_DB, 'CREATE UNIQUE INDEX conversations_last_message_id_key ON conversations (last_message_id)');
      got = await together(base, ['jaehoon', 'doyun'], async ({ jaehoon, doyun }) => {
        const first = send(jaehoon, { conversationId: 8, content: SLOW_J }, 8000);
        await sleep(500);
        const second = send(doyun, { conversationId: 8, content: SLOW_D }, 8000);
        return Promise.all([first, second]);
      });
      expect(tail()).toMatch(/P2034/);
    }, { edit: withService('step8-slow-fixed.conversationService.js') });
    expect(got[0]).toEqual({ error: { code: 'INTERNAL_ERROR', message: '서버에서 문제가 생겼어요' } });
    expect(got[1].data.content).toBe(SLOW_D);
    expect((await rowsOf(8)).map(([, , c]) => c)).not.toContain(SLOW_J);
  }, 60_000);

  it('UNIQUE 없는 회차 판(Step 8 · 늦추는 줄 없음) - 두 사람이 다섯 통씩 한꺼번에 보내도 열 통 모두 저장되고 대화방 행은 가장 늦은 메시지', async () => {
    await serve(8, async ({ base }) => {
      const acks = await together(base, ['jaehoon', 'doyun'], async ({ jaehoon, doyun }) => Promise.all(
        [0, 1, 2, 3, 4].flatMap((i) => [send(jaehoon, { conversationId: 8, content: `j${i}` }, 8000), send(doyun, { conversationId: 8, content: `d${i}` }, 8000)]),
      ));
      expect(acks.every((a) => a.data)).toBe(true);
      const [row] = await onDb(GATE_DB, 'SELECT last_message_id AS m, last_message_at AS at FROM conversations WHERE id = 8');
      const [latest] = await onDb(GATE_DB, 'SELECT id, created_at FROM direct_messages WHERE conversation_id = 8 ORDER BY created_at DESC, id DESC LIMIT 1');
      expect(row.at.getTime()).toBe(latest.created_at.getTime());
    });
  }, 60_000);
});
