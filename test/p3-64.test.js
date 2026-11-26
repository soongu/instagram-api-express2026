// p3-64 「Socket.IO 서버 - 연결과 보내기」 게이트 - 수업 백엔드(교안 Step 1~7) · 실습 서버(직접 해보기 둘 · 과제 둘)
// 내부 검증 전용 - 교안에 한 줄도 인용하지 않는다.
//
// `9-realtime` 셋째 회차다(`curriculum.md` 「`p3-64` 착수 결정」).
// 백엔드의 시작 판은 code/p3-63(e9c2b88)의 학생 파일이다.
// 커밋 - «(Step N)» · «(직접 해보기 N)» · «(과제 [기초])» 표식. 같은 표식이 여럿이면 가장 뒤 feat 커밋이 그 판이다.
// 🔑 포트 - 3965 · `P364_PORT` 로 바꾼다. 실습 서버는 4965(사본에서 4001 숫자만 바꾼다). DB - `p364_api_` 로 시작하는 것만 만들고 지운다.
//    PostgreSQL 은 `P364_PG_PORT`(기본 5551 - 판정용 컨테이너 p360-db 를 이어 쓴다).
// 🔑 판정 DB 는 «p3-63 을 마친 학생 DB» `test/fixtures/p3-63-end.sql` 이다(방 1 · 7 · 8 · 메시지 1 · 2 · 다음 메시지 번호 8).
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
const PG_PORT = Number(process.env.P364_PG_PORT ?? 5551);
const ADMIN = { host: 'localhost', port: PG_PORT, database: 'postgres', user: 'postgres', password: 'postgres' };
const DB_PREFIX = process.env.P364_DB_PREFIX ?? 'p364_api';
const TPL_DB = `${DB_PREFIX}_tpl`;
const GATE_DB = `${DB_PREFIX}_gate`;
const dbUrl = (name) => `postgresql://postgres:postgres@localhost:${PG_PORT}/${name}`;
const PORT = Number(process.env.P364_PORT ?? 3965);
const SECRET = 'q2Xh0v9bGm4RkT7sYp1wLc8nZf3uJd6eHa5iVo0rQyE';
const env = {
  CORS_ORIGIN: 'http://localhost:3001', JWT_SECRET: SECRET,
  GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret', SITE_URL: `http://localhost:${PORT}`,
  KAKAO_CLIENT_ID: 'test-kakao', KAKAO_CLIENT_SECRET: 'test-kakao-secret',
  NAVER_CLIENT_ID: 'test-naver', NAVER_CLIENT_SECRET: 'test-naver-secret',
};
const STUDENT_FILES = ['app.js', 'db.js', 'errors.js', 'responses.js', 'routes', 'controllers', 'services', 'middlewares', 'schemas', 'strategies', 'docs', 'utils', 'package.json', 'requests', 'seed.js', 'data', 'prisma', 'prisma.config.js', '.env.example', 'lab', 'realtime.js', 'public'];
const FIXTURE = P('test/fixtures/p3-63-end.sql');

const git = (args) => execFileSync('git', args, { cwd: P('.'), encoding: 'utf8', maxBuffer: 1 << 28 });
const hasRef = (ref) => {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', ref], { cwd: P('.'), stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
};
// 🔑 판의 선 - 북마크 code/p3-63 이 있으면 그것, 없으면 지금 체크아웃한 선(HEAD). `P364_LINE` 으로 바꾼다.
const LINE = process.env.P364_LINE ?? (hasRef('refs/heads/code/p3-64') ? 'code/p3-64' : 'HEAD');
const WT = process.env.P364_WT ?? null;
const START = process.env.P364_BASE ?? 'code/p3-63';
/** «(표식)» 이 붙은 그 회차 커밋들 - 새것부터. */
const markCommits = (mark) => {
  const log = git(['log', '-n', '200', '--format=%H %s', LINE]);
  return log.split('\n').filter((l) => / feat\(p3-64\): /.test(l) && l.endsWith(`(${mark})`)).map((l) => l.split(' ')[0]);
};
const MARKS = { 1: 'Step 1', 2: 'Step 2', 3: 'Step 3', 4: 'Step 4', 5: 'Step 5', 6: 'Step 6', 7: 'Step 7', lab0: '직접 해보기 자료', lab1: '직접 해보기 1', lab2: '직접 해보기 2', hw1: '과제 [기초]', hw2: '과제 [응용]' };
const dirs = [];
const refDirs = new Map();
const refDir = (ref) => {
  if (refDirs.has(ref)) return refDirs.get(ref);
  const dir = mkdtempSync(join(tmpdir(), 'p364-ref-'));
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
  if (commits.length === 0) throw new Error(`p3-64 (${MARKS[step]}) 커밋이 없다`);
  return commits[0];
};
/** 그 Step 의 끝 판 - `P364_WT` 가 그 Step 이면 작업트리. */
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
  const dir = mkdtempSync(join(tmpdir(), 'p364-srv-'));
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
const LAB_PORT = Number(process.env.P364_LAB_PORT ?? 4965);
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

// 교안의 메시지 - 이어진 흐름에서 이 차례로 보낸다.
const M1 = '도윤 님, 내일 사진 보내 드릴게요';
const M2 = '사진은 저녁에 보낼게요';
const M3 = '사진 크기는 원본 그대로 괜찮아요?';
const BORAM = '저도 사진 보고 싶어요';
const M4 = '방금 사진 보냈어요';

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

describe('축 ⓪ 판정 DB - p3-63 을 마친 학생 DB', () => {
  it('방 1 · 7 · 8 · 메시지는 방 7 의 둘 · 다음 메시지 번호는 8', async () => {
    await freshDb();
    const rooms = await onDb(GATE_DB, 'SELECT id, participant_a_id AS a, participant_b_id AS b FROM conversations ORDER BY id');
    expect(rooms.map((r) => [r.id, r.a, r.b])).toEqual([[1, 2, 43], [7, 2, 3], [8, 2, 44]]);
    expect(await count('SELECT count(*)::int AS n FROM direct_messages')).toBe(2);
    expect(await count("SELECT last_value::int AS n FROM direct_messages_id_seq")).toBe(7);
  });
});

describe('축 ① Step 1 - 수업 백엔드에 Socket.IO', () => {
  it('app.js 는 import 한 줄 · 정적 폴더 · server 변수 · startRealtime 만 바뀐다 · socket.io 는 이미 dependencies 에', () => {
    const before = read(version('start')('app.js'));
    const after = read(version(1)('app.js'));
    const added = after.split('\n').filter((l) => !before.split('\n').includes(l));
    expect(added).toEqual([
      "import { startRealtime } from './realtime.js';",
      '// 실시간 기능을 시험하는 화면 - public 폴더의 파일을 그 이름의 주소로 내보낸다.',
      "app.use(express.static('public'));",
      'const server = app.listen(PORT, () => {',
      '// 같은 서버에 Socket.IO 를 붙인다.',
      'startRealtime(server);',
    ]);
    expect(JSON.parse(read(version('start')('package.json'))).dependencies['socket.io']).toMatch(/^\^4\.8/);
    expect(read(version(1)('package.json'))).toBe(read(version('start')('package.json')));
  });

  it('시험 화면 셋이 200 · 로그인 없이도 연결된다 · 창 1 에 연결 수 · 닫힘 줄', async () => {
    await serve(1, async ({ base, tail }) => {
      for (const path of ['/dm-test.html', '/dm-test.js', '/socket.io/socket.io.js']) {
        expect([path, (await fetch(`${base}${path}`)).status]).toEqual([path, 200]);
      }
      const anon = await socketOf(base);
      const garbage = await socketOf(base, 'accessToken=garbage');
      expect([anon.connected, garbage.connected]).toEqual([true, true]);
      anon.close();
      garbage.close();
      await settle();
      expect(logLines(tail, /연결이/)).toEqual([
        '연결이 열렸어요. 지금 연결은 1개예요.', '연결이 열렸어요. 지금 연결은 2개예요.', '연결이 닫혔어요.', '연결이 닫혔어요.',
      ]);
    });
  }, 60_000);
});

describe('축 ② Step 2 - 연결이 열리기 전에 로그인 확인', () => {
  it('쿠키 없음 · 엉터리 토큰 · 기한 지난 토큰은 connect_error · jaehoon 은 연결되고 창 1 에 번호', async () => {
    await serve(2, async ({ base, tail }) => {
      const anon = await socketOf(base);
      expect([anon.connected, anon.message, anon.data]).toEqual([false, '로그인이 필요해요', { code: 'LOGIN_REQUIRED' }]);
      const garbage = await socketOf(base, 'accessToken=garbage');
      expect([garbage.connected, garbage.data]).toEqual([false, { code: 'LOGIN_REQUIRED' }]);
      const expired = jwt.sign({ sid: 1, role: 'USER', exp: Math.floor(Date.now() / 1000) - 60 }, SECRET, { subject: '2', algorithm: 'HS256' });
      const old = await socketOf(base, `accessToken=${expired}`);
      expect([old.connected, old.message, old.data]).toEqual([false, '토큰의 기한이 지났어요', { code: 'TOKEN_EXPIRED' }]);
      const jaehoon = await personOf(base, 'jaehoon');
      expect(jaehoon.connected).toBe(true);
      // 헤더로 보낸 토큰도 readToken 이 읽는다 - requireLogin 과 같은 함수라서.
      const bearer = await socketOf(base, '', { headers: { authorization: `Bearer ${jaehoon.socket.io.opts.extraHeaders.cookie.split('=')[1]}` } });
      expect(bearer.connected).toBe(true);
      jaehoon.close();
      bearer.close();
      await settle();
      expect(logLines(tail, /연결이/)).toEqual([
        '2번 사용자의 연결이 열렸어요. 지금 연결은 1개예요.', '2번 사용자의 연결이 열렸어요. 지금 연결은 2개예요.',
        '2번 사용자의 연결이 닫혔어요.', '2번 사용자의 연결이 닫혔어요.',
      ]);
    });
  }, 60_000);
});

// 교안 차례 - Step 3 은 doyun 과 먼저(M1), 그다음 시크릿 창을 boram 으로 바꿔(M2) boram 도 받는 것을 겪는다.
const STAGE_3 = { step: 3, run: async ({ base }) => {
  const jaehoon = await personOf(base, 'jaehoon');
  const doyun = await personOf(base, 'doyun');
  expect(await send(jaehoon, { conversationId: 8, content: M1 })).toEqual({ timeout: 'operation has timed out' });
  doyun.close();
  const boram = await personOf(base, 'boram');
  await send(jaehoon, { conversationId: 8, content: M2 }, 300);
  await settle();
  jaehoon.close();
  boram.close();
} };
// Step 4 - jaehoon 탭 둘과 boram. jaehoon 이 M3 을 보내고, boram 이 Console 에서 8번 방에 보낸다(이 판은 저장된다).
const STAGE_4 = { step: 4, run: async ({ base }) => {
  const jaehoon = await personOf(base, 'jaehoon');
  const boram = await personOf(base, 'boram');
  await send(jaehoon, { conversationId: 8, content: M3 }, 300);
  boram.socket.emit('dm:send', { conversationId: 8, content: BORAM });
  await settle();
  jaehoon.close();
  boram.close();
} };
// Step 5 - 고친 판에서 boram 이 다시 보내 보고(막힌다), 값 없이도 보내 본다. 그 뒤 쿼리 창에서 boram 의 메시지를 지운다.
const STAGE_5 = { step: 5, run: async ({ base }) => {
  const boram = await personOf(base, 'boram');
  boram.socket.emit('dm:send', { conversationId: 8, content: BORAM });
  boram.socket.emit('dm:send');
  await settle();
  boram.close();
} };
const DELETE_BORAM = `DELETE FROM direct_messages WHERE sender_id = ${BORAM_ID};`;
// Step 6 - 쿼리 창에서 지운 뒤, boram 이 화면에서 8번 방에 보내 보고(실패 ack) jaehoon 이 M4 를 보낸다(성공 ack).
const STAGE_6 = { step: 6, before: () => onDb(GATE_DB, DELETE_BORAM), run: async ({ base }) => {
  const boram = await personOf(base, 'boram');
  const jaehoon = await personOf(base, 'jaehoon');
  await send(boram, { conversationId: 8, content: BORAM });
  await send(jaehoon, { conversationId: 8, content: M4 });
  await settle();
  boram.close();
  jaehoon.close();
} };

describe('축 ③ Step 3 - 보내기를 모든 연결에', () => {
  it('jaehoon 이 8번 방에 M1 - 메시지 8 이 저장되고 jaehoon · doyun 이 받는다 · 화면은 결과를 못 받는다(5초 ack)', async () => {
    await flow([{ step: 3, run: async ({ base }) => {
      const jaehoon = await personOf(base, 'jaehoon');
      const doyun = await personOf(base, 'doyun');
      expect(await send(jaehoon, { conversationId: 8, content: M1 })).toEqual({ timeout: 'operation has timed out' });
      await settle();
      expect(messagesOf(jaehoon)).toEqual([[8, JAEHOON_ID, M1]]);
      expect(messagesOf(doyun)).toEqual([[8, JAEHOON_ID, M1]]);
      expect(Object.keys(jaehoon.events[0][1])).toEqual(['conversationId', 'id', 'senderId', 'content', 'createdAt', 'isRead']);
      expect(jaehoon.events[0][1]).toMatchObject({ conversationId: 8, isRead: false });
      jaehoon.close();
      doyun.close();
    } }]);
  }, 60_000);

  it('이어진 흐름 - 시크릿 창을 boram 으로 바꾸면 jaehoon 과 doyun 의 M2 를 boram 도 받는다(메시지 9)', async () => {
    await flow([{ step: 3, run: async ({ base }) => {
      const jaehoon = await personOf(base, 'jaehoon');
      const doyun = await personOf(base, 'doyun');
      await send(jaehoon, { conversationId: 8, content: M1 }, 300);
      doyun.close();
      const boram = await personOf(base, 'boram');
      await send(jaehoon, { conversationId: 8, content: M2 }, 300);
      await settle();
      expect(messagesOf(boram)).toEqual([[9, JAEHOON_ID, M2]]);
      jaehoon.close();
      boram.close();
    } }]);
    expect(await rowsOf(8)).toEqual([[8, JAEHOON_ID, M1], [9, JAEHOON_ID, M2]]);
  }, 60_000);

  it('겪기 - 값 없이 보내면 서버가 꺼진다(이 판은 값을 안 본다)', async () => {
    await serve(3, async ({ base, tail }) => {
      const jaehoon = await personOf(base, 'jaehoon');
      jaehoon.socket.emit('dm:send');
      await sleep(800);
      expect(tail()).toContain("TypeError: Cannot destructure property 'conversationId' of 'undefined' as it is undefined.");
      expect((await fetch(`${base}/dm-test.html`).catch(() => null))).toBe(null);
    });
  }, 60_000);
});

describe('축 ④ Step 4 - 사람마다 방', () => {
  it('이어진 흐름 - jaehoon 탭 둘이 M3(메시지 10)을 받고 boram 은 못 받는다', async () => {
    await flow([STAGE_3, { step: 4, run: async ({ base }) => {
      const tab = await loggedIn(base, 'jaehoon');
      const one = await socketOf(base, tab.cookie());
      const two = await socketOf(base, tab.cookie());
      const boram = await personOf(base, 'boram');
      await send(one, { conversationId: 8, content: M3 }, 300);
      await settle();
      expect(messagesOf(one)).toEqual([[10, JAEHOON_ID, M3]]);
      expect(messagesOf(two)).toEqual([[10, JAEHOON_ID, M3]]);
      expect(messagesOf(boram)).toEqual([]);
      for (const p of [one, two, boram]) p.close();
    } }]);
  }, 90_000);

  it('이어진 흐름 - 겪기: boram 이 Console 에서 8번 방에 보내면 저장되고(메시지 11 · 보낸 사람 48) jaehoon 과 doyun 이 받는다', async () => {
    await flow([STAGE_3, { step: 4, run: async ({ base }) => {
      const jaehoon = await personOf(base, 'jaehoon');
      const doyun = await personOf(base, 'doyun');
      const boram = await personOf(base, 'boram');
      await send(jaehoon, { conversationId: 8, content: M3 }, 300);
      boram.socket.emit('dm:send', { conversationId: 8, content: BORAM });
      await settle();
      expect(messagesOf(jaehoon)).toEqual([[10, JAEHOON_ID, M3], [11, BORAM_ID, BORAM]]);
      expect(messagesOf(doyun)).toEqual([[10, JAEHOON_ID, M3], [11, BORAM_ID, BORAM]]);
      expect(messagesOf(boram)).toEqual([]);
      for (const p of [jaehoon, doyun, boram]) p.close();
    } }]);
    expect((await rowsOf(8)).map(([id, s]) => [id, s])).toEqual([[8, 2], [9, 2], [10, 2], [11, 48]]);
  }, 90_000);
});

/** Step 5 의 «참여자 확인만 넣은 판» - Step 5 서비스에 Step 4 의 realtime.js 를 얹는다. */
const checkOnly = (dir) => writeFileSync(join(dir, 'realtime.js'), read(version(4)('realtime.js')));

describe('축 ⑤ Step 5 - 받은 값을 믿지 않는다', () => {
  it('서비스는 한 줄만 바뀐다 - findUnique 대신 findMyConversation', () => {
    const before = read(version(4)('services/conversationService.js'));
    const after = read(version(5)('services/conversationService.js'));
    const oldLines = `  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { participantAId: true, participantBId: true },
  });`;
    const newLines = `  // 이력을 줄 때와 같은 확인 - 없는 방과 남의 방이면 404 에러를 던진다.
  const conversation = await findMyConversation(conversationId, myId);`;
    expect(before.split(oldLines)).toHaveLength(2);
    expect(after).toBe(before.replace(oldLines, newLines));
  });

  it('겪기 - 참여자 확인만 넣으면 boram 의 한 번에 서버가 꺼진다 · 경고 줄 다음에 NotFoundError · jaehoon 연결도 끊긴다', async () => {
    await flow([STAGE_3, STAGE_4, { step: 5, edit: checkOnly, run: async ({ base, tail }) => {
      const jaehoon = await personOf(base, 'jaehoon');
      const boram = await personOf(base, 'boram');
      const dropped = new Promise((r) => jaehoon.socket.on('disconnect', (reason) => r(reason)));
      boram.socket.emit('dm:send', { conversationId: 8, content: BORAM });
      expect(await Promise.race([dropped, sleep(3000).then(() => 'still')])).toBe('transport close');
      const lines = tail().split('\n');
      const at = lines.indexOf('8번 대화방은 48번 사용자의 방이 아니라서 404 로 답했어요.');
      expect(at).toBeGreaterThan(-1);
      expect(lines.slice(at + 1).join('\n')).toMatch(/throw new NotFoundError\('CONVERSATION_NOT_FOUND'\);[\s\S]*NotFoundError: 그런 대화방은 없어요/);
      expect(tail()).toContain("code: 'CONVERSATION_NOT_FOUND'");
    } }]);
    expect((await rowsOf(8)).map(([id]) => id)).toEqual([8, 9, 10, 11]);
  }, 90_000);

  it('npm run dev(--watch)로 띄웠으면 꺼진 뒤 «Failed running» 줄이 찍히고 파일을 고칠 때까지 기다린다', async () => {
    await freshDb();
    const from = version(5);
    generateFor(from);
    migrate(from, GATE_DB);
    const dir = studentDir(from);
    checkOnly(dir);
    const envs = { ...process.env, ...env, DATABASE_URL: dbUrl(GATE_DB), PORT: String(PORT) };
    delete envs.NODE_ENV;
    const child = spawn(process.execPath, ['--watch', 'app.js'], { cwd: dir, env: envs });
    let out = '';
    child.stdout.on('data', (b) => { out += b; });
    child.stderr.on('data', (b) => { out += b; });
    try {
      for (let i = 0; i < 80 && !out.includes('포트에서'); i += 1) await sleep(100);
      const boram = await personOf(`http://localhost:${PORT}`, 'boram');
      boram.socket.emit('dm:send', { conversationId: 8, content: BORAM });
      for (let i = 0; i < 50 && !out.includes('Failed running'); i += 1) await sleep(100);
      expect(out).toContain("Failed running 'app.js'. Waiting for file changes before restarting...");
      boram.close();
    } finally {
      child.kill();
      await sleep(300);
    }
  }, 60_000);

  it('고친 판 - boram 의 8번 방 · 값 없음 · 빈 내용 · 글자 번호 · 1001자는 저장되지 않고 서버는 그대로 · 창 1 에 줄', async () => {
    await flow([STAGE_3, STAGE_4, { step: 5, run: async ({ base, tail }) => {
      const jaehoon = await personOf(base, 'jaehoon');
      const boram = await personOf(base, 'boram');
      boram.socket.emit('dm:send', { conversationId: 8, content: BORAM });
      await settle();
      boram.socket.emit('dm:send');
      await settle();
      for (const bad of [{ conversationId: 8, content: '   ' }, { conversationId: '8', content: 'x' }, { conversationId: 8, content: '가'.repeat(1001) }]) {
        jaehoon.socket.emit('dm:send', bad);
      }
      await settle();
      expect(messagesOf(jaehoon)).toEqual([]);
      expect(logLines(tail, /보내지 못했어요|404 로 답했어요/)).toEqual([
        '8번 대화방은 48번 사용자의 방이 아니라서 404 로 답했어요.',
        '48번 사용자의 메시지를 보내지 못했어요 - 그런 대화방은 없어요',
        '48번 사용자의 메시지를 보내지 못했어요 - 보낸 내용이 규칙에 안 맞아요',
        '2번 사용자의 메시지를 보내지 못했어요 - 보낸 내용이 규칙에 안 맞아요',
        '2번 사용자의 메시지를 보내지 못했어요 - 보낸 내용이 규칙에 안 맞아요',
        '2번 사용자의 메시지를 보내지 못했어요 - 보낸 내용이 규칙에 안 맞아요',
      ]);
      // 앞뒤 빈칸은 떼고 저장한다
      jaehoon.socket.emit('dm:send', { conversationId: 8, content: '  안녕  ' });
      await settle();
      expect(messagesOf(jaehoon).map(([, , c]) => c)).toEqual(['안녕']);
      jaehoon.close();
      boram.close();
    } }]);
  }, 90_000);

  it('이 판에서도 화면은 성공과 실패를 가리지 못한다 - 둘 다 5초 ack 가 안 온다', async () => {
    await serve(5, async ({ base }) => {
      const jaehoon = await personOf(base, 'jaehoon');
      const boram = await personOf(base, 'boram');
      expect(await send(jaehoon, { conversationId: 8, content: M4 }, 800)).toEqual({ timeout: 'operation has timed out' });
      expect(await send(boram, { conversationId: 8, content: BORAM }, 800)).toEqual({ timeout: 'operation has timed out' });
      jaehoon.close();
      boram.close();
    });
  }, 60_000);

  it('쿼리 창의 DELETE 한 문장 - boram 의 메시지 하나가 지워진다', async () => {
    await flow([STAGE_3, STAGE_4, STAGE_5]);
    const rows = await onDb(GATE_DB, `WITH gone AS (${DELETE_BORAM.replace(';', '')} RETURNING id) SELECT id FROM gone`);
    expect(rows.map((r) => r.id)).toEqual([11]);
    expect((await rowsOf(8)).map(([id]) => id)).toEqual([8, 9, 10]);
  }, 120_000);
});

describe('축 ⑥ Step 6 - ack 로 결과 알리기', () => {
  it('이어진 흐름 - boram 은 { error: CONVERSATION_NOT_FOUND } · jaehoon 의 M4 는 { data } 메시지 12(11 은 지워서 빈다)', async () => {
    await flow([STAGE_3, STAGE_4, STAGE_5, { step: 6, before: () => onDb(GATE_DB, DELETE_BORAM), run: async ({ base }) => {
      const boram = await personOf(base, 'boram');
      const jaehoon = await personOf(base, 'jaehoon');
      expect(await send(boram, { conversationId: 8, content: BORAM })).toEqual({ error: { code: 'CONVERSATION_NOT_FOUND', message: '그런 대화방은 없어요' } });
      const ok = await send(jaehoon, { conversationId: 8, content: M4 });
      expect(Object.keys(ok)).toEqual(['data']);
      expect(ok.data).toMatchObject({ conversationId: 8, id: 12, senderId: JAEHOON_ID, content: M4, isRead: false });
      await settle();
      expect(messagesOf(jaehoon)).toEqual([[12, JAEHOON_ID, M4]]);
      boram.close();
      jaehoon.close();
    } }]);
    expect(await rowsOf(8)).toEqual([[8, 2, M1], [9, 2, M2], [10, 2, M3], [12, 2, M4]]);
  }, 150_000);

  it('빈 내용은 VALIDATION_FAILED 와 details · ack 를 안 넘겨도 서버는 그대로 · 우리가 던지지 않은 에러는 INTERNAL_ERROR', async () => {
    await serve(6, async ({ base, tail }) => {
      const jaehoon = await personOf(base, 'jaehoon');
      const empty = await send(jaehoon, { conversationId: 8, content: '   ' });
      expect(empty.error.code).toBe('VALIDATION_FAILED');
      expect(empty.error.message).toBe('보낸 내용이 규칙에 안 맞아요');
      expect(empty.error.details.properties.content.errors).toEqual(['Too small: expected string to have >=1 characters']);
      jaehoon.socket.emit('dm:send', { conversationId: 8, content: '확인 없이' });
      await settle();
      expect(messagesOf(jaehoon).map(([, , c]) => c)).toEqual(['확인 없이']);
      // 없는 대화방도 같은 404 코드
      expect((await send(jaehoon, { conversationId: 99, content: 'x' })).error.code).toBe('CONVERSATION_NOT_FOUND');
      expect(tail()).not.toMatch(/보내지 못했어요/);
      jaehoon.close();
    }, { edit: null });
    await serve(6, async ({ base, tail }) => {
      await onDb(GATE_DB, 'ALTER TABLE direct_messages RENAME TO direct_messages_gone');
      const jaehoon = await personOf(base, 'jaehoon');
      const broken = await send(jaehoon, { conversationId: 8, content: 'x' });
      expect(broken).toEqual({ error: { code: 'INTERNAL_ERROR', message: '서버에서 문제가 생겼어요' } });
      expect(tail()).toMatch(/PrismaClientKnownRequestError|P2021/);
      jaehoon.close();
    });
  }, 90_000);
});

describe('축 ⑦ Step 7 - 입력 중', () => {
  it('jaehoon 이 8번 방에서 치면 doyun 만 받는다(jaehoon 의 다른 탭 · boram 은 못 받는다) · 저장하지 않는다 · boram 이 8번 방이면 아무에게도 안 가고 경고 줄', async () => {
    await serve(7, async ({ base, tail }) => {
      const tab = await loggedIn(base, 'jaehoon');
      const one = await socketOf(base, tab.cookie());
      const two = await socketOf(base, tab.cookie());
      const doyun = await personOf(base, 'doyun');
      const boram = await personOf(base, 'boram');
      const before = await count('SELECT count(*)::int AS n FROM direct_messages');
      one.socket.emit('dm:typing', { conversationId: 8, typing: true });
      await settle();
      one.socket.emit('dm:typing', { conversationId: 8, typing: false });
      boram.socket.emit('dm:typing', { conversationId: 8, typing: true });
      one.socket.emit('dm:typing', { conversationId: 8 });
      await settle();
      expect(typingOf(doyun)).toEqual([{ conversationId: 8, senderId: JAEHOON_ID, typing: true }, { conversationId: 8, senderId: JAEHOON_ID, typing: false }]);
      expect([typingOf(one), typingOf(two), typingOf(boram)]).toEqual([[], [], []]);
      expect(await count('SELECT count(*)::int AS n FROM direct_messages')).toBe(before);
      expect(logLines(tail, /입력 중 표시/).sort()).toEqual([
        '2번 사용자의 입력 중 표시를 보내지 못했어요 - 보낸 내용이 규칙에 안 맞아요',
        '48번 사용자의 입력 중 표시를 보내지 못했어요 - 그런 대화방은 없어요',
      ]);
      for (const p of [one, two, doyun, boram]) p.close();
    });
  }, 60_000);

  it('realtime.js 완성본은 150줄 이하 · 이벤트는 dm:send · dm:typing 둘', () => {
    const src = read(version(7)('realtime.js'));
    expect(src.split('\n').length).toBeLessThan(150);
    expect([...src.matchAll(/socket\.on\('([^']+)'/g)].map((m) => m[1])).toEqual(['dm:send', 'dm:typing', 'disconnect']);
  });
});

// ── 실습 서버 ──────────────────────────────────────────────────────────────
// 수업 백엔드(Step 7 판)에서 로그인하고, 같은 쿠키로 실습 서버에 연결한다 - 학생이 3000 에서 로그인하고 4001 을 여는 것과 같다.
const SEOYEON_ID = 43;
/** 그 표식 판의 실습 파일을 포트 숫자만 바꿔 띄운다. `edit(src)` 로 빈칸만 바꾼 판을 만든다. */
const labServe = async (mark, file, fn, { edit = null } = {}) => {
  await serve(7, async ({ base }) => {
    const dir = studentDir(version(mark));
    const path = join(dir, 'lab/p3-64', file);
    const source = read(path);
    let changed = source.replaceAll('4001', String(LAB_PORT));
    // 포트 숫자 말고는 안 바뀐다
    expect(changed.split('\n').filter((l, i) => l !== source.split('\n')[i]).every((l) => l.includes(String(LAB_PORT)))).toBe(true);
    if (edit) {
      const edited = edit(changed);
      expect(edited).not.toBe(changed);
      changed = edited;
    }
    writeFileSync(path, changed);
    const srv = await boot(path, { port: LAB_PORT, cwd: dir, env: { JWT_SECRET: SECRET }, ready: '기다리고 있어요' });
    try {
      await fn({ base, lab: `http://localhost:${LAB_PORT}`, tail: srv.tail });
    } finally {
      await Promise.race([srv.stop(), sleep(500)]);
    }
  });
};
const labPerson = (base, lab, username) => personOf(base, username, lab);
const inquiryMessages = (person) => person.events.filter(([e]) => e === 'inquiry:message').map(([, m]) => [m.id, m.inquiryId, m.senderId, m.content]);
const emitAck = (person, event, payload, ms = 1500) => person.socket.timeout(ms).emitWithAck(event, payload).catch((e) => ({ timeout: e.message }));
/** 한 줄만 바꾼 판 - 그 글자가 정확히 한 번 있어야 한다. */
const swap = (a, b) => (src) => {
  if (src.split(a).length !== 2) throw new Error(`바꿀 글자가 없거나 여럿이다: ${a}`);
  return src.replace(a, b);
};

describe('축 ⑧ 직접 해보기 1 - 문의방 실시간', () => {
  it('실습 화면 200 · 로그인 없이 연결하면 «로그인이 필요해요» · jaehoon 이 1번 방에 보내면 seoyeon 과 jaehoon 이 받는다(10번)', async () => {
    await labServe('lab1', 'practice1.js', async ({ base, lab }) => {
      expect((await fetch(`${lab}/`)).status).toBe(200);
      const anon = await socketOf(lab);
      expect([anon.connected, anon.message]).toEqual([false, '로그인이 필요해요']);
      const jaehoon = await labPerson(base, lab, 'jaehoon');
      const seoyeon = await labPerson(base, lab, 'seoyeon');
      jaehoon.socket.emit('inquiry:send', { inquiryId: 1, content: '내일 보내 드릴게요' });
      await settle();
      expect(inquiryMessages(seoyeon)).toEqual([[10, 1, JAEHOON_ID, '내일 보내 드릴게요']]);
      expect(inquiryMessages(jaehoon)).toEqual([[10, 1, JAEHOON_ID, '내일 보내 드릴게요']]);
      // 4번 방(taeyang 이 jaehoon 의 텀블러를 묻는 방)에 보내면 seoyeon 은 못 받는다
      jaehoon.socket.emit('inquiry:send', { inquiryId: 4, content: '재고 있어요' });
      await settle();
      expect(inquiryMessages(seoyeon).map(([id]) => id)).toEqual([10]);
      expect(inquiryMessages(jaehoon).map(([id]) => id)).toEqual([10, 11]);
      jaehoon.close();
      seoyeon.close();
    });
  }, 60_000);

  it('이 판은 확인하지 않는다 - seoyeon 이 남의 2번 방에 보내면 jaehoon 이 받는다(직접 해보기 2 가 막는다)', async () => {
    await labServe('lab1', 'practice1.js', async ({ base, lab }) => {
      const jaehoon = await labPerson(base, lab, 'jaehoon');
      const seoyeon = await labPerson(base, lab, 'seoyeon');
      seoyeon.socket.emit('inquiry:send', { inquiryId: 2, content: '저도 이어폰 궁금해요' });
      await settle();
      expect(inquiryMessages(jaehoon)).toEqual([[10, 2, SEOYEON_ID, '저도 이어폰 궁금해요']]);
      jaehoon.close();
      seoyeon.close();
    });
  }, 60_000);
});

describe('축 ⑨ 직접 해보기 2 - 문의 보내기 확인과 결과', () => {
  it('내 1번 방 { data } · 남의 3번 방과 없는 99번 «그런 문의방은 없어요» · 빈 내용과 501자 «문의는 1~500자로 보내 주세요» · 남의 2번 방은 jaehoon 에게 안 간다', async () => {
    await labServe('lab2', 'practice2.js', async ({ base, lab }) => {
      const jaehoon = await labPerson(base, lab, 'jaehoon');
      const seoyeon = await labPerson(base, lab, 'seoyeon');
      const ok = await emitAck(jaehoon, 'inquiry:send', { inquiryId: 1, content: '  내일 보내 드릴게요  ' });
      expect(ok.data).toMatchObject({ id: 10, inquiryId: 1, senderId: JAEHOON_ID, content: '내일 보내 드릴게요', isRead: false });
      for (const id of [3, 99]) expect(await emitAck(jaehoon, 'inquiry:send', { inquiryId: id, content: 'x' })).toEqual({ error: { message: '그런 문의방은 없어요' } });
      for (const content of ['   ', '가'.repeat(501), 5]) {
        expect(await emitAck(jaehoon, 'inquiry:send', { inquiryId: 1, content })).toEqual({ error: { message: '문의는 1~500자로 보내 주세요' } });
      }
      expect(await emitAck(seoyeon, 'inquiry:send', { inquiryId: 2, content: '저도 이어폰 궁금해요' })).toEqual({ error: { message: '그런 문의방은 없어요' } });
      expect((await emitAck(jaehoon, 'inquiry:send', undefined)).error.message).toBe('그런 문의방은 없어요');
      await settle();
      expect(inquiryMessages(jaehoon).map(([id]) => id)).toEqual([10]);
      expect(inquiryMessages(seoyeon).map(([id]) => id)).toEqual([10]);
      jaehoon.close();
      seoyeon.close();
    });
  }, 60_000);
});

describe('축 ⑩ 과제 [기초] - 문의방 입력 중', () => {
  it('jaehoon 이 1번 방에서 치면 seoyeon 만 받는다 · 4번 방이면 seoyeon 은 못 받는다 · 남의 3번 방과 typing 없음은 아무에게도 안 간다', async () => {
    await labServe('hw1', 'homework1.js', async ({ base, lab }) => {
      const jaehoon = await labPerson(base, lab, 'jaehoon');
      const seoyeon = await labPerson(base, lab, 'seoyeon');
      jaehoon.socket.emit('inquiry:typing', { inquiryId: 1, typing: true });
      jaehoon.socket.emit('inquiry:typing', { inquiryId: 4, typing: true });
      jaehoon.socket.emit('inquiry:typing', { inquiryId: 3, typing: true });
      jaehoon.socket.emit('inquiry:typing', { inquiryId: 1 });
      seoyeon.socket.emit('inquiry:typing', { inquiryId: 2, typing: true });
      jaehoon.socket.emit('inquiry:typing', { inquiryId: 1, typing: false });
      await settle();
      const typings = (p) => p.events.filter(([e]) => e === 'inquiry:typing').map(([, t]) => t);
      expect(typings(seoyeon)).toEqual([{ inquiryId: 1, senderId: JAEHOON_ID, typing: true }, { inquiryId: 1, senderId: JAEHOON_ID, typing: false }]);
      expect(typings(jaehoon)).toEqual([]);
      // 보내기는 직접 해보기 2 그대로
      expect((await emitAck(seoyeon, 'inquiry:send', { inquiryId: 1, content: '네' })).data.id).toBe(10);
      jaehoon.close();
      seoyeon.close();
    });
  }, 60_000);
});

describe('축 ⑪ 과제 [응용] - 문의방 실시간 읽음', () => {
  it('seoyeon 이 1번 방을 읽으면 readCount 1(jaehoon 이 보낸 9) · jaehoon 에게 inquiry:read · 다시 0 이면 안 알린다 · jaehoon 이 읽으면 1(seoyeon 의 3) · 남의 방 에러', async () => {
    await labServe('hw2', 'homework2.js', async ({ base, lab }) => {
      const jaehoon = await labPerson(base, lab, 'jaehoon');
      const seoyeon = await labPerson(base, lab, 'seoyeon');
      expect(await emitAck(seoyeon, 'inquiry:read', { inquiryId: 1 })).toEqual({ data: { readCount: 1 } });
      expect(await emitAck(seoyeon, 'inquiry:read', { inquiryId: 1 })).toEqual({ data: { readCount: 0 } });
      await settle();
      const reads = (p) => p.events.filter(([e]) => e === 'inquiry:read').map(([, t]) => t);
      expect(reads(jaehoon)).toEqual([{ inquiryId: 1, readerId: SEOYEON_ID }]);
      expect(await emitAck(jaehoon, 'inquiry:read', { inquiryId: 1 })).toEqual({ data: { readCount: 1 } });
      expect(await emitAck(jaehoon, 'inquiry:read', { inquiryId: 3 })).toEqual({ error: { message: '그런 문의방은 없어요' } });
      expect(await emitAck(jaehoon, 'inquiry:read', { inquiryId: 2 })).toEqual({ data: { readCount: 2 } });
      await settle();
      expect(reads(seoyeon)).toEqual([{ inquiryId: 1, readerId: JAEHOON_ID }]);
      jaehoon.close();
      seoyeon.close();
    });
  }, 60_000);
});

describe('축 ⑫ 다음 회차 판정 DB - p3-64-end.sql(교안 차례대로 이어진 흐름의 끝)', () => {
  it('P364_KEEP 이면 흐름 끝 DB 를 p364_api_end 로 남긴다(덤프를 뜰 때만)', async () => {
    if (!process.env.P364_KEEP) return;
    await flow([STAGE_3, STAGE_4, STAGE_5, STAGE_6]);
    await admin(async (client) => {
      await client.query(`DROP DATABASE IF EXISTS ${DB_PREFIX}_end`);
      await kick(client, GATE_DB);
      await client.query(`CREATE DATABASE ${DB_PREFIX}_end TEMPLATE ${GATE_DB}`);
    });
  }, 180_000);

  it('덤프 - 8번 방의 메시지 8 · 9 · 10 · 12(11 은 boram 의 것을 지웠다) · 모두 jaehoon 이 보냈고 안 읽음 · 방은 그대로 1 · 7 · 8', async () => {
    const dump = read(P('test/fixtures/p3-64-end.sql')).split('\n').filter((line) => !line.startsWith('\\')).join('\n');
    const db = `${DB_PREFIX}_dump`;
    await dropDb(db);
    await admin((client) => client.query(`CREATE DATABASE ${db}`));
    try {
      await runSqlFile(db, dump);
      const msgs = await onDb(db, 'SELECT id, conversation_id AS c, sender_id AS s, content, is_read AS r FROM direct_messages ORDER BY id');
      expect(msgs.map((m) => [m.id, m.c, m.s, m.content, m.r])).toEqual([
        [1, 7, 3, '다음 주 스터디 몇 시에 해요?', false], [2, 7, 2, '저녁 7시요!', false],
        [8, 8, 2, M1, false], [9, 8, 2, M2, false], [10, 8, 2, M3, false], [12, 8, 2, M4, false],
      ]);
      const rooms = await onDb(db, 'SELECT id FROM conversations ORDER BY id');
      expect(rooms.map((r) => r.id)).toEqual([1, 7, 8]);
      expect(await count('SELECT last_value::int AS n FROM direct_messages_id_seq', db)).toBe(12);
    } finally {
      await dropDb(db);
    }
  }, 60_000);
});

// ── 시험 화면을 브라우저로 ─────────────────────────────────────────────────
// 학생은 http://localhost:3000/dm-test.html 을 일반 창과 시크릿 창에 연다 - 크롬 둘(쿠키가 따로)로 흉내 낸다.
const page = async (chrome, base) => {
  const tab = await chrome.newTab();
  await tab.open(`${base}/dm-test.html`);
  return tab;
};
const loginOn = (tab, username, password) => tab.evaluate(`(() => {
  document.querySelector('#username').value = ${JSON.stringify(username)};
  document.querySelector('#password').value = ${JSON.stringify(password)};
  document.querySelector('#login').requestSubmit();
})()`);
const statusOf = (tab) => tab.evaluate("document.querySelector('#status').textContent");
const waitStatus = (tab, text, ms = 15_000) => tab.waitUntil(`document.querySelector('#status').textContent === ${JSON.stringify(text)}`, ms);
const sendOn = (tab, room, text) => tab.evaluate(`(() => {
  document.querySelector('#room').value = ${JSON.stringify(String(room))};
  document.querySelector('#text').value = ${JSON.stringify(text)};
  document.querySelector('#send').requestSubmit();
})()`);
const typeOn = (tab, room, text) => tab.evaluate(`(async () => {
  document.querySelector('#room').value = ${JSON.stringify(String(room))};
  const input = document.querySelector('#text');
  for (const ch of ${JSON.stringify(text)}) {
    input.value += ch;
    input.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 30));
  }
})()`);
const framesSent = (tab, re) => tab.events.filter((e) => e.method === 'Network.webSocketFrameSent' && re.test(e.params.response.payloadData)).map((e) => e.params.response.payloadData);
const describeChrome = CHROME ? describe : describe.skip;

describeChrome('축 ⑬ 시험 화면 - 브라우저에서', () => {
  it('Step 1 판 - 비밀번호를 틀려도 «연결됐어요» · Step 2 판으로 바꾸면 jaehoon 창은 저절로 다시 붙고 시크릿 창은 «연결하지 못했어요 - 로그인이 필요해요»', async () => {
    const A = await launchChrome();
    const B = await launchChrome();
    try {
      await freshDb();
      const from1 = version(1);
      generateFor(from1);
      const dir1 = studentDir(from1);
      const dir2 = studentDir(version(2));
      let a;
      let b;
      await bootIn(dir1, GATE_DB, async ({ base, tail }) => {
        a = await page(A, base);
        await loginOn(a, 'jaehoon', 'jaehoon1234');
        await waitStatus(a, '연결됐어요');
        b = await page(B, base);
        await loginOn(b, 'jaehoon', 'wrong');
        await waitStatus(b, '연결됐어요');
        expect(logLines(tail, /연결이 열렸어요/)).toEqual(['연결이 열렸어요. 지금 연결은 1개예요.', '연결이 열렸어요. 지금 연결은 2개예요.']);
      });
      expect([await statusOf(a), await statusOf(b)]).toEqual(['연결이 끊겼어요', '연결이 끊겼어요']);
      await bootIn(dir2, GATE_DB, async ({ tail }) => {
        await waitStatus(a, '연결됐어요');
        await waitStatus(b, '연결하지 못했어요 - 로그인이 필요해요');
        await sleep(500);
        expect(logLines(tail, /연결이 열렸어요/)).toEqual(['2번 사용자의 연결이 열렸어요. 지금 연결은 1개예요.']);
        await loginOn(b, 'doyun', 'instagram1234');
        await waitStatus(b, '연결됐어요');
        await sleep(300);
        expect(logLines(tail, /연결이 열렸어요/)).toEqual(['2번 사용자의 연결이 열렸어요. 지금 연결은 1개예요.', '44번 사용자의 연결이 열렸어요. 지금 연결은 2개예요.']);
      });
    } finally {
      await A.close();
      await B.close();
    }
  }, 120_000);

  it('Step 2 판 - 연결을 여는 첫 요청(polling)에 Cookie 가 실리고 WebSocket 으로 옮겨 간다 · 프레임에는 쿠키가 없다', async () => {
    const A = await launchChrome();
    try {
      await serve(2, async ({ base }) => {
        const a = await page(A, base);
        await loginOn(a, 'jaehoon', 'jaehoon1234');
        await waitStatus(a, '연결됐어요');
        await sleep(500);
        const polling = a.events.filter((e) => e.method === 'Network.requestWillBeSent' && /\/socket\.io\/\?EIO=4&transport=polling&t=[^&]+$/.test(e.params.request.url));
        expect(polling.length).toBeGreaterThan(0);
        const first = polling[0].params.requestId;
        const extra = a.events.find((e) => e.method === 'Network.requestWillBeSentExtraInfo' && e.params.requestId === first);
        expect(extra.params.headers.Cookie ?? extra.params.headers.cookie).toMatch(/^accessToken=ey/);
        const ws = a.events.filter((e) => e.method === 'Network.webSocketCreated').map((e) => e.params.url.replace(base.replace('http', 'ws'), ''));
        expect(ws).toHaveLength(1);
        expect(ws[0]).toMatch(/^\/socket\.io\/\?EIO=4&transport=websocket&sid=/);
        const frames = a.events.filter((e) => /^Network\.webSocketFrame(Sent|Received)$/.test(e.method)).map((e) => e.params.response.payloadData);
        expect(frames.some((f) => f.includes('accessToken'))).toBe(false);
      });
    } finally {
      await A.close();
    }
  }, 90_000);

  it('Step 3 판 - 보내면 두 창 목록에 «8번 방 · 2번 사용자: …» · 결과 줄은 «보내는 중...» 에서 5초 뒤 «5초 동안 서버가 답하지 않았어요»', async () => {
    const A = await launchChrome();
    const B = await launchChrome();
    try {
      await serve(3, async ({ base }) => {
        const a = await page(A, base);
        await loginOn(a, 'jaehoon', 'jaehoon1234');
        await waitStatus(a, '연결됐어요');
        const b = await page(B, base);
        await loginOn(b, 'doyun', 'instagram1234');
        await waitStatus(b, '연결됐어요');
        await sendOn(a, 8, M1);
        expect(await a.evaluate("document.querySelector('#result').textContent")).toBe('보내는 중...');
        await b.waitUntil("document.querySelectorAll('#list li').length === 1", 5000);
        expect(await a.lines()).toEqual([`8번 방 · 2번 사용자: ${M1}`]);
        expect(await b.lines()).toEqual([`8번 방 · 2번 사용자: ${M1}`]);
        expect(await a.evaluate("document.querySelector('#text').value")).toBe('');
        const waited = await a.waitUntil("document.querySelector('#result').textContent === '5초 동안 서버가 답하지 않았어요'", 8000);
        expect(waited).toBeGreaterThan(3500);
      });
    } finally {
      await A.close();
      await B.close();
    }
  }, 90_000);

  it('Step 5 판 - Console 의 socket 으로 값 없이 보내도 서버는 그대로 · Step 7 판 - 결과 줄의 JSON · 입력 중 줄과 프레임 둘', async () => {
    const A = await launchChrome();
    const B = await launchChrome();
    try {
      await serve(5, async ({ base, tail }) => {
        const b = await page(B, base);
        await loginOn(b, 'boram', 'boram1234');
        await waitStatus(b, '연결됐어요');
        expect(await b.evaluate('typeof socket')).toBe('object');
        await b.evaluate("void socket.emit('dm:send', { conversationId: 8, content: '저도 사진 보고 싶어요' })");
        await b.evaluate("void socket.emit('dm:send')");
        await sleep(600);
        expect(logLines(tail, /보내지 못했어요/)).toHaveLength(2);
        expect(await statusOf(b)).toBe('연결됐어요');
      });
      await serve(7, async ({ base }) => {
        const a = await page(A, base);
        await loginOn(a, 'jaehoon', 'jaehoon1234');
        await waitStatus(a, '연결됐어요');
        const b = await page(B, base);
        await loginOn(b, 'doyun', 'instagram1234');
        await waitStatus(b, '연결됐어요');
        await typeOn(a, 8, '방금 사진');
        await b.waitUntil("document.querySelector('#typing').textContent === '8번 방 · 2번 사용자가 입력 중이에요...'", 5000);
        const gone = await b.waitUntil("document.querySelector('#typing').textContent === ''", 6000);
        expect(gone).toBeGreaterThan(2000);
        expect(framesSent(a, /dm:typing/)).toEqual([
          '42["dm:typing",{"conversationId":8,"typing":true}]', '42["dm:typing",{"conversationId":8,"typing":false}]',
        ]);
        await sendOn(a, 8, M4);
        await a.waitUntil("document.querySelector('#result').textContent.startsWith('{')", 5000);
        const result = JSON.parse(await a.evaluate("document.querySelector('#result').textContent"));
        expect(result.data).toMatchObject({ conversationId: 8, senderId: JAEHOON_ID, content: M4, isRead: false });
        await sendOn(a, 8, '   ');
        await a.waitUntil("document.querySelector('#result').textContent.includes('VALIDATION_FAILED')", 5000);
      });
    } finally {
      await A.close();
      await B.close();
    }
  }, 120_000);
});

describe('축 ②-쿠키 io.engine.use(cookieParser()) 를 빼면', () => {
  it('Express 의 app.use(cookieParser()) 는 /socket.io 요청에 안 닿는다 - jaehoon 도 «로그인이 필요해요»', async () => {
    await serve(2, async ({ base }) => {
      const jaehoon = await personOf(base, 'jaehoon');
      expect([jaehoon.connected, jaehoon.data]).toEqual([false, { code: 'LOGIN_REQUIRED' }]);
    }, { edit: (dir) => replaceIn(dir, 'realtime.js', '  io.engine.use(cookieParser());\n', '') });
  }, 60_000);
});

describe('축 ⑧-틀린 답 직접 해보기 1 - 빈칸만 바꾼 판 넷', () => {
  const ANSWERS = {
    a: ['socket.data.userId = Number(payload.sub);', 'socket.data.userId = payload.sub;'],
    b: ['socket.join(`user:${userId}`);', 'socket.join(userId);'],
    c: ['io.to(`user:${inquiry.buyerId}`).to(`user:${sellerIdOf(inquiry)}`)', 'io.to(`user:${inquiry.buyerId}`).to(`user:${inquiry.buyerId}`)'],
    d: ['io.to(`user:${inquiry.buyerId}`).to(`user:${sellerIdOf(inquiry)}`)', 'io.to(`user:${sellerIdOf(inquiry)}`).to(`user:${sellerIdOf(inquiry)}`)'],
  };
  const run = (key) => async ({ base, lab }) => {
    const jaehoon = await labPerson(base, lab, 'jaehoon');
    const seoyeon = await labPerson(base, lab, 'seoyeon');
    jaehoon.socket.emit('inquiry:send', { inquiryId: 1, content: '내일 보내 드릴게요' });
    await settle();
    const got = { jaehoon: jaehoon.events.filter(([e]) => e === 'inquiry:message').map(([, m]) => m.senderId), seoyeon: seoyeon.events.filter(([e]) => e === 'inquiry:message').map(([, m]) => m.senderId) };
    jaehoon.close();
    seoyeon.close();
    return got;
  };
  it('첫 빈칸 payload.sub - senderId 가 글자 "2"', async () => {
    let got;
    await labServe('lab1', 'practice1.js', async (x) => { got = await run('a')(x); }, { edit: swap(...ANSWERS.a) });
    expect(got).toEqual({ jaehoon: ['2'], seoyeon: ['2'] });
  }, 60_000);
  it('둘째 빈칸 userId - 아무 탭에도 안 온다', async () => {
    let got;
    await labServe('lab1', 'practice1.js', async (x) => { got = await run('b')(x); }, { edit: swap(...ANSWERS.b) });
    expect(got).toEqual({ jaehoon: [], seoyeon: [] });
  }, 60_000);
  it('셋째·넷째 모두 buyerId - jaehoon(파는 사람)에게 안 온다 · 모두 sellerIdOf - seoyeon 에게 안 온다', async () => {
    let got;
    await labServe('lab1', 'practice1.js', async (x) => { got = await run('c')(x); }, { edit: swap(...ANSWERS.c) });
    expect(got).toEqual({ jaehoon: [], seoyeon: [2] });
    await labServe('lab1', 'practice1.js', async (x) => { got = await run('d')(x); }, { edit: swap(...ANSWERS.d) });
    expect(got).toEqual({ jaehoon: [2], seoyeon: [] });
  }, 90_000);
});

describe('축 ⑨-틀린 답 직접 해보기 2 - 빈칸만 바꾼 판 넷', () => {
  const firstAck = async ({ base, lab, tail }) => {
    const jaehoon = await labPerson(base, lab, 'jaehoon');
    const one = await emitAck(jaehoon, 'inquiry:send', { inquiryId: 1, content: '  내일 보내 드릴게요  ' }, 800);
    const three = await emitAck(jaehoon, 'inquiry:send', { inquiryId: 3, content: 'x' }, 800);
    await settle();
    const blank = await emitAck(jaehoon, 'inquiry:send', { inquiryId: 1, content: '   ' }, 800);
    jaehoon.close();
    return { one, three, blank, log: tail() };
  };
  it('첫 빈칸 buyerId 한 번 더 - 확인 1 이 «그런 문의방은 없어요»', async () => {
    let got;
    await labServe('lab2', 'practice2.js', async (x) => { got = await firstAck(x); }, { edit: swap('inquiry.buyerId === myId || sellerIdOf(inquiry) === myId', 'inquiry.buyerId === myId || inquiry.buyerId === myId') });
    expect(got.one).toEqual({ error: { message: '그런 문의방은 없어요' } });
  }, 60_000);
  it('둘째 빈칸 inquiry - 확인 1 이 «그런 문의방은 없어요» · 확인 2 에서 서버가 TypeError 로 꺼진다', async () => {
    let got;
    await labServe('lab2', 'practice2.js', async (x) => { got = await firstAck(x); }, { edit: swap('if (!inquiry) {', 'if (inquiry) {') });
    expect(got.one).toEqual({ error: { message: '그런 문의방은 없어요' } });
    expect(got.three).toEqual({ timeout: 'socket has been disconnected' });
    expect(got.log).toMatch(/TypeError/);
  }, 60_000);
  it('셋째 빈칸 reply - 확인 3 에서 결과가 안 온다', async () => {
    let got;
    await labServe('lab2', 'practice2.js', async (x) => { got = await firstAck(x); }, { edit: swap("reply(ack, { error: { message: '문의는 1~500자로 보내 주세요' } });", "reply(reply, { error: { message: '문의는 1~500자로 보내 주세요' } });") });
    expect(got.one.data.content).toBe('내일 보내 드릴게요');
    expect(got.blank).toEqual({ timeout: 'operation has timed out' });
  }, 60_000);
  it('넷째 빈칸 message - 확인 1 이 { data } 없이 메시지 그대로', async () => {
    let got;
    await labServe('lab2', 'practice2.js', async (x) => { got = await firstAck(x); }, { edit: swap('reply(ack, { data: message });', 'reply(ack, message);') });
    expect(got.one).toMatchObject({ id: 10, inquiryId: 1, content: '내일 보내 드릴게요' });
    expect(got.one.data).toBeUndefined();
  }, 60_000);
});

describe('축 ⑩·⑪-흔한 실수 - 답안의 표', () => {
  const typings = (p) => p.events.filter(([e]) => e === 'inquiry:typing').map(([, t]) => t.inquiryId);
  const reads = (p) => p.events.filter(([e]) => e === 'inquiry:read').map(([, t]) => t.readerId);
  it('[기초] broadcast 로 보내면 확인 2 에서 seoyeon 이 4번 방 표시를 받는다 · user:${userId} 면 확인 1 에서 seoyeon 이 못 받는다', async () => {
    const EMIT = "io.to(`user:${otherId}`).emit('inquiry:typing', { inquiryId: inquiry.id, senderId: userId, typing: payload.typing });";
    const scene = (out) => async ({ base, lab }) => {
      const jaehoon = await labPerson(base, lab, 'jaehoon');
      const seoyeon = await labPerson(base, lab, 'seoyeon');
      jaehoon.socket.emit('inquiry:typing', { inquiryId: 1, typing: true });
      await settle();
      out.one = typings(seoyeon);
      jaehoon.socket.emit('inquiry:typing', { inquiryId: 4, typing: true });
      await settle();
      out.two = typings(seoyeon);
      jaehoon.close();
      seoyeon.close();
    };
    const a = {};
    await labServe('hw1', 'homework1.js', scene(a), { edit: swap(EMIT, "socket.broadcast.emit('inquiry:typing', { inquiryId: inquiry.id, senderId: userId, typing: payload.typing });") });
    expect(a).toEqual({ one: [1], two: [1, 4] });
    const b = {};
    await labServe('hw1', 'homework1.js', scene(b), { edit: swap(EMIT, "io.to(`user:${userId}`).emit('inquiry:typing', { inquiryId: inquiry.id, senderId: userId, typing: payload.typing });") });
    expect(b.one).toEqual([]);
  }, 90_000);

  it('[응용] 보낸 사람을 안 거르면 확인 1 이 2 · 늘 알리면 확인 2 에서 jaehoon 에게 한 번 더', async () => {
    const scene = (out) => async ({ base, lab }) => {
      const jaehoon = await labPerson(base, lab, 'jaehoon');
      const seoyeon = await labPerson(base, lab, 'seoyeon');
      out.one = await emitAck(seoyeon, 'inquiry:read', { inquiryId: 1 });
      await settle();
      out.afterOne = reads(jaehoon).length;
      out.two = await emitAck(seoyeon, 'inquiry:read', { inquiryId: 1 });
      await settle();
      out.afterTwo = reads(jaehoon).length;
      jaehoon.close();
      seoyeon.close();
    };
    const a = {};
    await labServe('hw2', 'homework2.js', scene(a), { edit: swap('message.inquiryId === inquiry.id && message.senderId !== userId && !message.isRead', 'message.inquiryId === inquiry.id && !message.isRead') });
    expect(a.one).toEqual({ data: { readCount: 2 } });
    const b = {};
    await labServe('hw2', 'homework2.js', scene(b), { edit: swap('if (unread.length > 0) {', 'if (true) {') });
    expect([b.one, b.afterOne, b.two, b.afterTwo]).toEqual([{ data: { readCount: 1 } }, 1, { data: { readCount: 0 } }, 2]);
  }, 90_000);
});

describe('축 ⑫-주제 1 disconnectSockets', () => {
  it('io.in(user:2).disconnectSockets() 는 jaehoon 의 연결 둘을 끊고 doyun 은 그대로 · 다시 붙으면 쿠키가 없으니 거절', async () => {
    await serve(7, async ({ base }) => {
      const tab = await loggedIn(base, 'jaehoon');
      const one = await socketOf(base, tab.cookie());
      const two = await socketOf(base, tab.cookie());
      const doyun = await personOf(base, 'doyun');
      // 서버 밖에서 부를 수 없으니 같은 일을 하는 Socket.IO 서버를 따로 세워 API 만 확인한다
      expect([one.connected, two.connected, doyun.connected]).toEqual([true, true, true]);
      for (const p of [one, two, doyun]) p.close();
    });
    const { Server } = await import('socket.io');
    const http = await import('node:http');
    const server = http.createServer();
    const io = new Server(server);
    io.on('connection', (socket) => socket.join(`user:${socket.handshake.query.u}`));
    await new Promise((r) => server.listen(LAB_PORT, r));
    try {
      const mk = async (u) => {
        const s = connectIo(`http://localhost:${LAB_PORT}`, { query: { u }, reconnection: false });
        await new Promise((r) => s.on('connect', r));
        return s;
      };
      const a = await mk('2');
      const b = await mk('2');
      const c = await mk('44');
      const reasons = [];
      a.on('disconnect', (r) => reasons.push(r));
      b.on('disconnect', (r) => reasons.push(r));
      io.in('user:2').disconnectSockets();
      await settle();
      expect([a.connected, b.connected, c.connected, reasons]).toEqual([false, false, true, ['io server disconnect', 'io server disconnect']]);
      c.disconnect();
    } finally {
      io.close();
    }
  }, 60_000);
});
