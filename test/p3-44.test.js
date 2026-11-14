// p3-44 「액세스 토큰 재발급과 슬라이딩 세션」 게이트 — 백엔드
//
// `7-express-auth` 아홉째 회차다(`curriculum.md` 「`p3-44` 착수 결정」).
// Step 1~7 본문은 수업 백엔드, Step 8 은 수업 화면(`instagram-next/.verify` 가 판정), 실습·과제는 `lab/p3-44/`.
// Step 마다의 판은 커밋 제목의 «(Step N)» 표식으로 꺼낸다(같은 표식이 여럿이면 가장 뒤 커밋).
//
// 축 ① Step 1 — Access 15분 · 기한이 지난 토큰은 401(아직 코드는 LOGIN_REQUIRED)
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, mkdtempSync, rmSync, cpSync, symlinkSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import pg from 'pg';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { boot } from './helpers/boot.js';
import { roundDir } from './helpers/round.js';

// p3-37 Step 8(2026-11-15) — 새 주소의 실패 응답에는 path(쿼리를 뺀 주소)와 timestamp(ISO UTC)도 실린다.
const v2Error = (code, message) => ({ error: { code, message, path: expect.stringMatching(/^\/api\/v2\/[^?]*$/), timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/) } });

const ROOT = new URL('../', import.meta.url);
const P = (rel) => new URL(rel, ROOT).pathname;
const read = (path) => readFileSync(path, 'utf8');
const ADMIN = { host: 'localhost', port: 5432, database: 'postgres', user: 'postgres', password: 'postgres' };
const TPL_DB = 'p344_tpl';
const GATE_DB = 'p344_gate';
const GATE_URL = `postgresql://postgres:postgres@localhost:5432/${GATE_DB}`;
const PORT = 3950;
const LAB_PORT = 3952;
const LAB_PORT2 = 3953;
const HW_PORT = 3954;
const HW_PORT2 = 3955;

// 학생 파일은 이 회차 북마크 `code/p3-43` 을 풀어서 읽는다(없으면 작업트리 — 이 회차를 짓는 동안).
const ROUND = roundDir('code/p3-44');
const R = (rel) => join(ROUND.dir, rel);
const LAB = (rel) => R(`lab/p3-44/${rel}`);
// 2026-11-12 학생 낭독 집중 검수가 main 에서만 고친 실습·과제 파일 — 북마크 code/p3-44 는 옛 판이라 작업트리에서 읽는다.
//   practice1.js(로그아웃도 실려 온 쿠키를 돌려준다) · homework1.http(내보낸 회원 요청 다섯) · homework2.http(없는 기록 내보내기)
const MAIN_LAB = ['practice1.js', 'homework1.http', 'homework2.http'];

const SECRET = 'q2Xh0v9bGm4RkT7sYp1wLc8nZf3uJd6eHa5iVo0rQyE';
const CLUB_SECRET = 'Zk3p9QvL0sYb7Rt2Nw5xHc8mJd1fGa6eUo4iTy0rPqE';
const env = { DATABASE_URL: GATE_URL, CORS_ORIGIN: 'http://localhost:3001', JWT_SECRET: SECRET };
const STUDENT_FILES = ['app.js', 'db.js', 'errors.js', 'responses.js', 'routes', 'controllers', 'services', 'middlewares', 'schemas', 'docs', 'package.json', 'requests', 'seed.js', 'data', 'prisma', 'prisma.config.js', 'lab/p3-44', '.env.example'];

const hasRef = (ref) => {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', ref], { cwd: P('.'), stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
};
const LINE = hasRef('refs/heads/code/p3-44') ? 'code/p3-44' : 'main';
const commitOf = (n) => {
  const log = execFileSync('git', ['log', '--format=%H %s', `code/p3-43..${LINE}`], { cwd: P('.'), encoding: 'utf8' });
  const hits = log.split('\n').filter((l) => / feat\(p3-44\): /.test(l) && l.endsWith(`(Step ${n})`));
  if (hits.length === 0) throw new Error(`(Step ${n}) 커밋이 없다`);
  return hits[0].split(' ')[0];
};
const dirs = [];
const stepDirs = new Map();
const stepDir = (n) => {
  if (stepDirs.has(n)) return stepDirs.get(n);
  const dir = mkdtempSync(join(tmpdir(), `p344-step${n}-`));
  const tar = execFileSync('git', ['archive', '--format=tar', commitOf(n)], { cwd: P('.'), maxBuffer: 1 << 28 });
  execFileSync('tar', ['-x', '-C', dir], { input: tar });
  dirs.push(dir);
  const at = (rel) => join(dir, rel);
  stepDirs.set(n, at);
  return at;
};
const showAt = (ref, rel) => execFileSync('git', ['show', `${ref}:${rel}`], { cwd: P('.'), encoding: 'utf8' });

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
const gate = async (sql, params) => {
  const client = new pg.Client({ ...ADMIN, database: GATE_DB });
  await client.connect();
  try {
    return (await client.query(sql, params)).rows;
  } finally {
    await client.end();
  }
};
/** 판정 DB 를 템플릿에서 새로 만든다 — 시드 다섯(비밀번호 «이름1234») · 게시물 다섯 · admin.hong(45 · ADMIN). */
const freshGate = () => admin(async (client) => {
  await kick(client, GATE_DB);
  await client.query(`DROP DATABASE IF EXISTS ${GATE_DB}`);
  await kick(client, TPL_DB);
  await client.query(`CREATE DATABASE ${GATE_DB} TEMPLATE ${TPL_DB}`);
});

const studentDir = (from, edit) => {
  const dir = mkdtempSync(join(tmpdir(), 'p344-srv-'));
  for (const name of STUDENT_FILES) {
    if (existsSync(from(name))) cpSync(from(name), join(dir, name), { recursive: true });
  }
  symlinkSync(P('node_modules'), join(dir, 'node_modules'));
  if (edit) edit(dir);
  dirs.push(dir);
  return dir;
};
const start = (dir, file = 'app.js', port = PORT, ready = `${port}번 포트에서`) =>
  boot(join(dir, file), { port, cwd: dir, env: { ...env, PORT: String(port) }, ready });
const stop = (srv) => Promise.race([srv.stop(), sleep(500)]);
const withServer = async (from, fn, { edit } = {}) => {
  const dir = studentDir(from, edit);
  const srv = await start(dir);
  try {
    await fn({ ...srv, dir, base: `http://localhost:${PORT}` });
  } finally {
    await stop(srv);
  }
};
const replaceIn = (dir, rel, a, b) => {
  const text = read(join(dir, rel));
  if (!text.includes(a)) throw new Error(`${rel} 에 바꿀 글자가 없다: ${a}`);
  writeFileSync(join(dir, rel), text.replace(a, b));
};
const queryLog = (d) => replaceIn(d, 'db.js', 'new PrismaClient({ adapter })', "new PrismaClient({ adapter, log: ['query'] })");
const queryLines = (tail) => tail.split('\n').filter((line) => line.startsWith('prisma:query'));

/** 쿠키를 이름과 Path 마다 기억하는 요청 도우미 — 브라우저 하나나 httpYac 하나처럼(Path 가 맞는 요청에만 싣는다). */
const pathMatches = (cookiePath, path) => {
  const reqPath = path.split('?')[0];
  return reqPath === cookiePath || reqPath.startsWith(cookiePath.endsWith('/') ? cookiePath : `${cookiePath}/`);
};
const device = (base) => {
  const jar = new Map();
  const send = async (method, path, body, extra = {}) => {
    const headers = { ...extra };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    // httpYac 처럼 path 가 긴 쿠키를 앞에 싣는다(RFC 6265 §5.4 — 길이가 같으면 먼저 받은 쿠키가 앞)
    const carried = [...jar.values()].filter((c) => pathMatches(c.path, path)).sort((a, b) => b.path.length - a.path.length);
    // httpYac 처럼 — Authorization 헤더를 적어도 기억한 쿠키는 함께 싣는다(`# @no-cookie-jar` 요청은 sendBlock 이 빈 단지로 보낸다)
    if (carried.length > 0 && !headers.Cookie) headers.Cookie = carried.map((c) => `${c.name}=${c.value}`).join('; ');
    const res = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const sets = res.headers.getSetCookie();
    for (const line of sets) {
      const [pair] = line.split(';');
      const at = pair.indexOf('=');
      const [name, value] = [pair.slice(0, at), pair.slice(at + 1)];
      const cookiePath = /;\s*Path=([^;]+)/i.exec(line)?.[1] ?? '/';
      const key = `${name} ${cookiePath}`;
      if (value === '' || /Expires=Thu, 01 Jan 1970/.test(line)) jar.delete(key);
      else jar.set(key, { name, value, path: cookiePath });
    }
    const text = await res.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = text; }
    return { status: res.status, headers: res.headers, body: parsed, setCookies: sets };
  };
  return {
    send,
    get: (path, extra) => send('GET', path, undefined, extra),
    login: (username, password = `${username}1234`, prefix = '/api/v2') => send('POST', `${prefix}/auth/login`, { username, password }),
    cookie: (name) => [...jar.values()].find((c) => c.name === name)?.value,
    cookies: () => [...jar.values()].map((c) => `${c.name} ${c.path}`).sort(),
    // 다른 서버(같은 호스트)가 준 쿠키를 미리 넣어 둔다 — httpYac 의 쿠키 단지는 포트를 가리지 않는다.
    put: (name, value, cookiePath = '/') => jar.set(`${name} ${cookiePath}`, { name, value, path: cookiePath }),
    bearer: (token) => ({ Authorization: `Bearer ${token}` }),
  };
};
const node = (dir, file, extra = {}, args = []) => {
  try {
    return { code: 0, out: execFileSync(process.execPath, [file, ...args], { cwd: dir, encoding: 'utf8', env: { ...process.env, ...env, ...extra }, stdio: 'pipe' }) };
  } catch (error) {
    return { code: error.status, out: `${error.stdout}${error.stderr}` };
  }
};

/** `.http` 를 덩어리로 나눈다 — 제목 · `# @name` · `# @no-cookie-jar` · 요청 줄 · 헤더 · 본문. */
const httpBlocks = (text) => text.split(/^### /m).slice(1).map((chunk) => {
  const lines = chunk.replace(/\n+$/, '').split('\n');
  const title = lines.shift();
  const noJar = lines.includes('# @no-cookie-jar');
  const nameLine = lines.find((l) => l.startsWith('# @name '));
  const rest = lines.filter((l) => !l.startsWith('#'));
  const [method, url] = rest.shift().split(' ');
  const headers = {};
  while (rest.length && rest[0] !== '') {
    const line = rest.shift();
    const at = line.indexOf(': ');
    headers[line.slice(0, at)] = line.slice(at + 2);
  }
  const body = rest.join('\n').trim();
  return { title, noJar, name: nameLine?.slice('# @name '.length), method, url, headers, body: body === '' ? undefined : body };
});
/** 제목으로 덩어리를 찾는다 — 같은 제목이 둘이면 앞의 것. */
const blockOf = (blocks, title) => {
  const hit = blocks.find((b) => b.title === title);
  if (!hit) throw new Error(`«${title}» 요청이 없다`);
  return hit;
};
/** 한 덩어리를 보낸다 — `swap` 으로 자리표시를 바꾸고, `named` 로 `{{이름.data.id}}` 를 채운다. */
const sendBlock = async (block, jar, { port, swap = {}, named = {} } = {}) => {
  const fill = (text) => Object.entries(swap).reduce((t, [k, v]) => t.replaceAll(k, v), text)
    .replace(/\{\{(\w+)\.data\.id\}\}/g, (_, n) => named[n].data.id);
  const url = new URL(fill(block.url));
  url.port = String(port);
  const headers = Object.fromEntries(Object.entries(block.headers).map(([k, v]) => [k, fill(v)]));
  const target = block.noJar ? device(url.origin) : jar;
  const res = await target.send(block.method, `${url.pathname}${url.search}`, block.body === undefined ? undefined : JSON.parse(block.body), headers);
  if (block.name) named[block.name] = res.body;
  return res;
};
const parts = (token) => token.split('.').slice(0, 2).map((part) => JSON.parse(Buffer.from(part, 'base64url').toString()));

beforeAll(async () => {
  await admin(async (client) => {
    for (const name of [GATE_DB, TPL_DB]) {
      await kick(client, name);
      await client.query(`DROP DATABASE IF EXISTS ${name}`);
    }
    await client.query(`CREATE DATABASE ${TPL_DB}`);
  });
  const tpl = new pg.Client({ ...ADMIN, database: TPL_DB });
  await tpl.connect();
  // 마이그레이션은 이 회차 끝 판까지 — 앞 Step 판은 refresh_token_hash 컬럼을 몰라도 같은 DB 로 돈다(NULL 허용)
  for (const dir of readdirSync(R('prisma/migrations')).filter((name) => name !== 'migration_lock.toml').sort()) {
    await tpl.query(read(R(`prisma/migrations/${dir}/migration.sql`)));
  }
  await tpl.end();
  execFileSync(process.execPath, [R('seed.js')], {
    cwd: ROUND.dir, encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: `postgresql://postgres:postgres@localhost:5432/${TPL_DB}` },
  });
  // 학생 DB 의 admin.hong — 관리자 스크립트로 넣은 45번(비밀번호 admin1234!)
  const hash = await bcrypt.hash('admin1234!', 12);
  const after = new pg.Client({ ...ADMIN, database: TPL_DB });
  await after.connect();
  await after.query("INSERT INTO users (id, username, name, phone, password_hash, role) VALUES (45, 'admin.hong', '관리자', '01077771234', $1, 'ADMIN')", [hash]);
  await after.query("SELECT setval('users_id_seq', 47)");
  await after.end();
}, 120000);

afterAll(async () => {
  await admin(async (client) => {
    for (const name of [GATE_DB, TPL_DB]) {
      await kick(client, name);
      await client.query(`DROP DATABASE IF EXISTS ${name}`);
    }
  });
  ROUND.cleanup();
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});


const HTTP = (n, file = 'requests/reissue.http') => httpBlocks(read(stepDir(n)(file)));
/** lab/p3-44/expired-token.js 를 그 판 그대로 돌려 기한이 지난 토큰을 받는다. */
const expiredToken = (n) => {
  const dir = studentDir(stepDir(n));
  const { code, out } = node(dir, 'lab/p3-44/expired-token.js');
  if (code !== 0) throw new Error(out);
  return out.trim();
};

describe('축 ① Step 1 — Access 15분', () => {
  it('🔴 로그인 쿠키 Max-Age=900 · 토큰 exp − iat = 900 · 기한이 지난 토큰은 401(Step 1 판은 아직 LOGIN_REQUIRED)', async () => {
    await freshGate();
    const expired = expiredToken(1);
    const [header, payload] = parts(expired);
    expect(header.alg).toBe('HS256');
    expect(payload.sub).toBe('2');
    expect(payload.exp).toBeLessThan(Date.now() / 1000);
    await withServer(stepDir(1), async ({ base }) => {
      const blocks = HTTP(1);
      expect(blocks.map((b) => b.title)).toEqual(['로그인', '게시물 목록', '기한이 지난 토큰으로 게시물 목록']);
      const jar = device(base);
      const login = await sendBlock(blockOf(blocks, '로그인'), jar, { port: PORT });
      expect(login.status).toBe(200);
      const access = login.setCookies.find((line) => line.startsWith('accessToken='));
      expect(access).toMatch(/Max-Age=900;/);
      const [, claims] = parts(jar.cookie('accessToken'));
      expect(claims.exp - claims.iat).toBe(900);
      expect((await sendBlock(blockOf(blocks, '게시물 목록'), jar, { port: PORT })).status).toBe(200);
      const res = await sendBlock(blockOf(blocks, '기한이 지난 토큰으로 게시물 목록'), jar, { port: PORT, swap: { EXPIRED_TOKEN: expired } });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('LOGIN_REQUIRED');
    });
  });
});

const sha256 = (text) => createHash('sha256').update(text).digest('hex');
const cookieLine = (res, name) => res.setCookies.find((line) => line.startsWith(`${name}=`));

describe('축 ② Step 2 — Refresh 토큰은 «행 ID.비밀값» · 데이터베이스에는 해시만', () => {
  it('🔴 마이그레이션은 sessions 에 refresh_token_hash(TEXT · NULL 허용) 하나', () => {
    const dir = readdirSync(stepDir(2)('prisma/migrations')).find((name) => name.endsWith('_add_refresh_token_hash'));
    expect(dir).toBeDefined();
    expect(read(stepDir(2)(`prisma/migrations/${dir}/migration.sql`))).toContain('ALTER TABLE "sessions" ADD COLUMN     "refresh_token_hash" TEXT;');
  });

  it('🔴 로그인하면 쿠키가 둘 — refreshToken 은 HttpOnly · SameSite=Lax · Path=/api/v2/auth · 7일 · 값의 앞은 토큰의 sid · 행에는 비밀값의 SHA-256', async () => {
    await freshGate();
    await withServer(stepDir(2), async ({ base }) => {
      const jar = device(base);
      const login = await sendBlock(blockOf(HTTP(2), '로그인'), jar, { port: PORT });
      expect(login.status).toBe(200);
      const line = cookieLine(login, 'refreshToken');
      expect(line).toMatch(/Max-Age=604800;/);
      expect(line).toMatch(/Path=\/api\/v2\/auth;/);
      expect(line).toMatch(/HttpOnly/);
      expect(line).toMatch(/SameSite=Lax/);
      expect(cookieLine(login, 'accessToken')).toMatch(/Max-Age=900;/);
      const [sid, secret, extra] = jar.cookie('refreshToken').split('.');
      expect(extra).toBeUndefined();
      expect(secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(parts(jar.cookie('accessToken'))[1].sid).toBe(sid);
      const [row] = await gate('SELECT user_id, refresh_token_hash FROM sessions WHERE id = $1', [sid]);
      expect(row.user_id).toBe(2);
      expect(row.refresh_token_hash).toBe(sha256(secret));
      expect(row.refresh_token_hash).not.toContain(secret);
    });
  });
});

/** lab/p3-44/set-role.js 로 jaehoon(2번)의 역할을 바꾼다 — 그 판의 학생 파일 그대로. */
const setRole = (n, role) => {
  const dir = studentDir(stepDir(n));
  return node(dir, 'lab/p3-44/set-role.js', {}, [role]);
};

describe('축 ③ Step 3 — POST /auth/reissue', () => {
  it('🔴 기한이 지난 토큰 → 새 토큰 받기 200 → 다시 200 · 새 토큰의 sid 는 같은 행 · Refresh 는 그대로(아직 회전 없음)', async () => {
    await freshGate();
    const expired = expiredToken(3);
    await withServer(stepDir(3), async ({ base }) => {
      const blocks = HTTP(3);
      const jar = device(base);
      await sendBlock(blockOf(blocks, '로그인'), jar, { port: PORT });
      const before = { access: jar.cookie('accessToken'), refresh: jar.cookie('refreshToken') };
      expect((await sendBlock(blockOf(blocks, '기한이 지난 토큰으로 게시물 목록'), jar, { port: PORT, swap: { EXPIRED_TOKEN: expired } })).status).toBe(401);
      await sleep(1100);
      const re = await sendBlock(blockOf(blocks, '새 토큰 받기'), jar, { port: PORT });
      expect(re.status).toBe(200);
      expect(re.body).toEqual({ data: { message: '새 토큰을 받았어요' } });
      expect(cookieLine(re, 'accessToken')).toMatch(/Max-Age=900;/);
      expect(cookieLine(re, 'refreshToken')).toBeUndefined();
      expect(jar.cookie('accessToken')).not.toBe(before.access);
      expect(jar.cookie('refreshToken')).toBe(before.refresh);
      expect(parts(jar.cookie('accessToken'))[1].sid).toBe(parts(before.access)[1].sid);
      expect((await sendBlock(blockOf(blocks, '게시물 목록'), jar, { port: PORT })).status).toBe(200);
      // 아직 회전이 없어 같은 Refresh 로 몇 번이든 받는다
      expect((await sendBlock(blockOf(blocks, '새 토큰 받기'), jar, { port: PORT })).status).toBe(200);
    });
  });

  it('🔴 Refresh 가 없거나 · 비밀값이 틀리거나 · 없는 행이면 401 LOGIN_REQUIRED · 옛 주소에는 쿠키가 안 실려 401', async () => {
    await freshGate();
    await withServer(stepDir(3), async ({ base }) => {
      const jar = device(base);
      await jar.login('jaehoon');
      const [sid] = jar.cookie('refreshToken').split('.');
      const post = (cookie, prefix = '/api/v2') => fetch(`${base}${prefix}/auth/reissue`, { method: 'POST', headers: cookie ? { Cookie: cookie } : {} });
      for (const cookie of [undefined, `refreshToken=${sid}.wrong`, `refreshToken=${sid}`, 'refreshToken=no-such-row.abc']) {
        const res = await post(cookie);
        expect(res.status).toBe(401);
        expect((await res.json()).error.code).toBe('LOGIN_REQUIRED');
      }
      // 틀린 비밀값을 보내도 Step 3 판은 행을 그대로 둔다(지우는 것은 Step 4 의 재사용 감지)
      expect(await gate('SELECT count(*)::int AS n FROM sessions WHERE id = $1', [sid])).toEqual([{ n: 1 }]);
      const old = await jar.send('POST', '/api/auth/reissue');
      expect(old.status).toBe(401);
      expect((await jar.send('POST', '/api/v2/auth/reissue')).status).toBe(200);
    });
  });

  it('🔴 set-role.js 로 jaehoon 을 ADMIN 으로 → 옛 토큰은 사람 목록 403 → 새 토큰 받기 → 200 · USER 로 내리고 새 토큰 → 403', async () => {
    await freshGate();
    await withServer(stepDir(3), async ({ base }) => {
      const blocks = HTTP(3);
      const jar = device(base);
      await sendBlock(blockOf(blocks, '로그인'), jar, { port: PORT });
      const users = () => sendBlock(blockOf(blocks, 'jaehoon이 사람 목록'), jar, { port: PORT });
      expect((await users()).status).toBe(403);
      const up = setRole(3, 'ADMIN');
      expect(up.code).toBe(0);
      expect(up.out).toMatch(/역할을 바꿨어요/);
      expect(up.out).toMatch(/role: 'ADMIN'/);
      expect((await users()).status).toBe(403);
      expect((await sendBlock(blockOf(blocks, '새 토큰 받기'), jar, { port: PORT })).status).toBe(200);
      expect(parts(jar.cookie('accessToken'))[1].role).toBe('ADMIN');
      expect((await users()).status).toBe(200);
      expect(setRole(3, 'USER').code).toBe(0);
      expect((await sendBlock(blockOf(blocks, '새 토큰 받기'), jar, { port: PORT })).status).toBe(200);
      expect((await users()).status).toBe(403);
    });
  });
});

describe('축 ④ Step 4 — 회전과 재사용 감지', () => {
  it('🔴 Step 3 판은 복사해 둔 Refresh 로 몇 번이든 새 토큰을 받는다(겪기)', async () => {
    await freshGate();
    await withServer(stepDir(3), async ({ base }) => {
      const jar = device(base);
      await jar.login('jaehoon');
      const copied = jar.cookie('refreshToken');
      expect((await jar.send('POST', '/api/v2/auth/reissue')).status).toBe(200);
      const thief = device(base);
      for (let i = 0; i < 3; i += 1) {
        expect((await thief.send('POST', '/api/v2/auth/reissue', undefined, { Cookie: `refreshToken=${copied}` })).status).toBe(200);
      }
    });
  });

  it('🔴 새 토큰을 받을 때마다 Refresh 도 새것(같은 행 · 새 비밀값 · 행의 해시도 바뀜) · 복사해 둔 옛 Refresh 가 오면 401 · 그 행이 지워져 진짜 사용자도 401', async () => {
    await freshGate();
    await withServer(stepDir(4), async ({ base }) => {
      const blocks = HTTP(4);
      const jar = device(base);
      const login = await sendBlock(blockOf(blocks, '로그인'), jar, { port: PORT });
      const copied = jar.cookie('refreshToken');
      expect(cookieLine(login, 'refreshToken')).toBeDefined();
      const [sid, secret] = copied.split('.');
      const re = await sendBlock(blockOf(blocks, '새 토큰 받기'), jar, { port: PORT });
      expect(re.status).toBe(200);
      const line = cookieLine(re, 'refreshToken');
      expect(line).toMatch(/Path=\/api\/v2\/auth;/);
      expect(line).toMatch(/Max-Age=604800;/);
      const [sid2, secret2] = jar.cookie('refreshToken').split('.');
      expect(sid2).toBe(sid);
      expect(secret2).not.toBe(secret);
      expect(await gate('SELECT refresh_token_hash AS h FROM sessions WHERE id = $1', [sid])).toEqual([{ h: sha256(secret2) }]);
      const stolen = await sendBlock(blockOf(blocks, '복사해 둔 Refresh 토큰으로 새 토큰 받기'), jar, { port: PORT, swap: { COPIED_REFRESH: copied } });
      expect(stolen.status).toBe(401);
      expect(stolen.body.error.code).toBe('LOGIN_REQUIRED');
      expect(await gate('SELECT count(*)::int AS n FROM sessions WHERE id = $1', [sid])).toEqual([{ n: 0 }]);
      expect((await sendBlock(blockOf(blocks, '새 토큰 받기'), jar, { port: PORT })).status).toBe(401);
    });
  });

  it('🔴 같은 Refresh 로 두 요청이 동시에 오면 하나만 200 · 하나는 401 · 그 행은 지워진다', async () => {
    await freshGate();
    await withServer(stepDir(4), async ({ base }) => {
      for (let round = 0; round < 3; round += 1) {
        const jar = device(base);
        await jar.login('jaehoon');
        const cookie = `refreshToken=${jar.cookie('refreshToken')}`;
        const [sid] = jar.cookie('refreshToken').split('.');
        const results = await Promise.all([0, 1].map(() => fetch(`${base}/api/v2/auth/reissue`, { method: 'POST', headers: { Cookie: cookie } })));
        expect(results.map((r) => r.status).sort()).toEqual([200, 401]);
        expect(await gate('SELECT count(*)::int AS n FROM sessions WHERE id = $1', [sid])).toEqual([{ n: 0 }]);
      }
    });
  });
});

const DAY = 24 * 60 * 60 * 1000;
// TIMESTAMP(3) 은 시간대가 없어 pg 가 한국 시각으로 읽는다 — 데이터베이스 안에서 UTC 기준 밀리초로 바꿔 꺼낸다.
const sessionTimes = async (sid) => {
  const [row] = await gate(`SELECT (extract(epoch FROM created_at) * 1000)::float8 AS created,
    (extract(epoch FROM expires_at) * 1000)::float8 AS expires,
    (extract(epoch FROM now()::timestamp) * 1000)::float8 AS now FROM sessions WHERE id = $1`, [sid]);
  return row;
};

describe('축 ⑤ Step 5 — 슬라이딩 7일 · 절대 30일', () => {
  it('🔴 Step 4 판은 expires_at 이 지난 행으로도 새 토큰을 받는다(겪기 — 아무도 기한을 안 본다)', async () => {
    await freshGate();
    await withServer(stepDir(4), async ({ base }) => {
      const jar = device(base);
      await jar.login('jaehoon');
      await gate("UPDATE sessions SET expires_at = now() - interval '1 minute' WHERE user_id = 2");
      expect((await jar.send('POST', '/api/v2/auth/reissue')).status).toBe(200);
    });
  });

  it('🔴 expires_at 이 지났으면 401 · 행을 지운다 · created_at 이 30일 넘게 지났으면 expires_at 이 남아 있어도 401', async () => {
    await freshGate();
    await withServer(stepDir(5), async ({ base }) => {
      const a = device(base);
      await a.login('jaehoon');
      const [sidA] = a.cookie('refreshToken').split('.');
      await gate("UPDATE sessions SET expires_at = now() - interval '1 minute' WHERE id = $1", [sidA]);
      const res = await a.send('POST', '/api/v2/auth/reissue');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('LOGIN_REQUIRED');
      expect(await sessionTimes(sidA)).toBeUndefined();
      const b = device(base);
      await b.login('jaehoon');
      const [sidB] = b.cookie('refreshToken').split('.');
      await gate("UPDATE sessions SET created_at = now() - interval '31 days' WHERE id = $1", [sidB]);
      const timesB = await sessionTimes(sidB);
      expect(timesB.expires).toBeGreaterThan(timesB.now);
      expect((await b.send('POST', '/api/v2/auth/reissue')).status).toBe(401);
      expect(await sessionTimes(sidB)).toBeUndefined();
    });
  });

  it('🔴 새 토큰을 받으면 expires_at 이 «지금 + 7일» 로 밀린다 · 처음 로그인한 지 25일이면 «created_at + 30일» 에서 멈춘다', async () => {
    await freshGate();
    await withServer(stepDir(5), async ({ base }) => {
      const jar = device(base);
      await jar.login('jaehoon');
      const [sid] = jar.cookie('refreshToken').split('.');
      await gate("UPDATE sessions SET expires_at = now() + interval '1 day', created_at = now() - interval '6 days' WHERE id = $1", [sid]);
      expect((await jar.send('POST', '/api/v2/auth/reissue')).status).toBe(200);
      const slid = await sessionTimes(sid);
      expect(Math.abs(slid.expires - (slid.now + 7 * DAY))).toBeLessThan(60 * 1000);
      await gate("UPDATE sessions SET created_at = now() - interval '25 days' WHERE id = $1", [sid]);
      expect((await jar.send('POST', '/api/v2/auth/reissue')).status).toBe(200);
      const capped = await sessionTimes(sid);
      expect(capped.expires).toBe(capped.created + 30 * DAY);
    });
  });
});

describe('축 ⑥ Step 6 — 로그아웃은 Refresh 쿠키로 기록을 지운다', () => {
  it('🔴 로그아웃하면 행이 지워지고 쿠키 둘이 지워진다 · 복사해 둔 Refresh 로는 401 · 복사해 둔 Access 토큰은 만료(15분)까지 200', async () => {
    await freshGate();
    await withServer(stepDir(6), async ({ base }) => {
      const blocks = HTTP(6);
      const jar = device(base);
      await sendBlock(blockOf(blocks, '로그인'), jar, { port: PORT });
      const copied = { access: jar.cookie('accessToken'), refresh: jar.cookie('refreshToken') };
      const [sid] = copied.refresh.split('.');
      const out = await sendBlock(blockOf(blocks, '로그아웃'), jar, { port: PORT });
      expect(out.status).toBe(200);
      expect(cookieLine(out, 'refreshToken')).toMatch(/Path=\/api\/v2\/auth;/);
      expect(jar.cookies()).toEqual([]);
      expect(await gate('SELECT count(*)::int AS n FROM sessions WHERE id = $1', [sid])).toEqual([{ n: 0 }]);
      expect((await sendBlock(blockOf(blocks, '새 토큰 받기'), jar, { port: PORT })).status).toBe(401);
      const stolen = await sendBlock(blockOf(blocks, '복사해 둔 Refresh 토큰으로 새 토큰 받기'), jar, { port: PORT, swap: { COPIED_REFRESH: copied.refresh } });
      expect(stolen.status).toBe(401);
      const withAccess = await jar.send('GET', '/api/v2/posts?limit=1', undefined, jar.bearer(copied.access));
      expect(withAccess.status).toBe(200);
      const [, claims] = parts(copied.access);
      expect(claims.exp - claims.iat).toBe(900);
    });
  });

  it('🔴 비밀값이 틀린 Refresh 로 로그아웃을 보내면 행은 남는다(행 ID 는 Access 토큰에서 누구나 읽는다)', async () => {
    await freshGate();
    await withServer(stepDir(6), async ({ base }) => {
      const jar = device(base);
      await jar.login('jaehoon');
      const [sid] = jar.cookie('refreshToken').split('.');
      const res = await fetch(`${base}/api/v2/auth/logout`, { method: 'POST', headers: { Cookie: `refreshToken=${sid}.guess` } });
      expect(res.status).toBe(200);
      expect(await gate('SELECT count(*)::int AS n FROM sessions WHERE id = $1', [sid])).toEqual([{ n: 1 }]);
    });
  });

  it('🔴 모든 기기에서 로그아웃 — 그 사람의 행이 모두 지워져 다른 기기도 새 토큰을 못 받는다 · 쿠키 둘을 지운다', async () => {
    await freshGate();
    await withServer(stepDir(6), async ({ base }) => {
      const a = device(base);
      const b = device(base);
      await a.login('jaehoon');
      await b.login('jaehoon');
      const res = await a.send('POST', '/api/v2/auth/logout-all');
      expect(res.status).toBe(200);
      expect(a.cookies()).toEqual([]);
      expect(await gate('SELECT count(*)::int AS n FROM sessions WHERE user_id = 2')).toEqual([{ n: 0 }]);
      expect((await b.send('POST', '/api/v2/auth/reissue')).status).toBe(401);
    });
  });

  it('🔴 clearCookie 에 path 를 빼면 Refresh 쿠키가 지워지지 않고 남는다(이름과 path 가 같아야 같은 쿠키)', async () => {
    await freshGate();
    await withServer(stepDir(6), async ({ base }) => {
      const jar = device(base);
      await jar.login('jaehoon');
      await jar.send('POST', '/api/v2/auth/logout');
      expect(jar.cookies()).toEqual([]);
    });
    await withServer(stepDir(6), async ({ base }) => {
      const jar = device(base);
      await jar.login('jaehoon');
      await jar.send('POST', '/api/v2/auth/logout');
      expect(jar.cookies()).toEqual(['refreshToken /api/v2/auth']);
    }, { edit: (d) => replaceIn(d, 'controllers/authController.js', "res.clearCookie('refreshToken', { path: '/api/v2/auth' });", "res.clearCookie('refreshToken');") });
  });

  it('🔴 옛 주소 /api/auth/logout 에는 Refresh 쿠키가 실리지 않아 행이 남는다(새 주소에서 로그아웃)', async () => {
    await freshGate();
    await withServer(stepDir(6), async ({ base }) => {
      const jar = device(base);
      await jar.login('jaehoon');
      const [sid] = jar.cookie('refreshToken').split('.');
      expect((await jar.send('POST', '/api/auth/logout')).status).toBe(200);
      expect(await gate('SELECT count(*)::int AS n FROM sessions WHERE id = $1', [sid])).toEqual([{ n: 1 }]);
    });
  });
});

describe('축 ⑦ Step 7 — 만료만 TOKEN_EXPIRED · Access 쿠키는 로그인 기한만큼', () => {
  it('🔴 기한만 지난 토큰은 401 TOKEN_EXPIRED · 다른 비밀키(기한도 지남)·없음·엉터리는 LOGIN_REQUIRED', async () => {
    await freshGate();
    const expired = expiredToken(7);
    const forged = jwt.sign({ role: 'USER' }, 'another-secret', { subject: '2', expiresIn: -60, algorithm: 'HS256' });
    await withServer(stepDir(7), async ({ base }) => {
      const blocks = HTTP(7);
      const jar = device(base);
      const res = await sendBlock(blockOf(blocks, '기한이 지난 토큰으로 게시물 목록'), jar, { port: PORT, swap: { EXPIRED_TOKEN: expired } });
      expect(res.status).toBe(401);
      expect(res.body).toEqual(v2Error('TOKEN_EXPIRED', '토큰의 기한이 지났어요'));
      const none = await sendBlock(blockOf(blocks, '쿠키 없이 게시물 목록'), jar, { port: PORT });
      expect(none.body.error.code).toBe('LOGIN_REQUIRED');
      for (const token of [forged, 'abc']) {
        const r = await jar.send('GET', '/api/v2/posts?limit=1', undefined, jar.bearer(token));
        expect(r.status).toBe(401);
        expect(r.body.error.code).toBe('LOGIN_REQUIRED');
      }
      // 옛 주소는 옛 모양 — 코드 없이 문장만
      const old = await jar.send('GET', '/api/posts?limit=1', undefined, jar.bearer(expired));
      expect(old.status).toBe(401);
      expect(old.body).toEqual({ message: '토큰의 기한이 지났어요' });
    });
  });

  it('🔴 로그인·새 토큰 받기의 accessToken 쿠키는 Max-Age=604800(로그인 기한) · 토큰 자체는 그대로 15분', async () => {
    await freshGate();
    await withServer(stepDir(7), async ({ base }) => {
      const jar = device(base);
      const login = await jar.login('jaehoon');
      expect(cookieLine(login, 'accessToken')).toMatch(/Max-Age=604800;/);
      const re = await jar.send('POST', '/api/v2/auth/reissue');
      expect(cookieLine(re, 'accessToken')).toMatch(/Max-Age=604800;/);
      const [, claims] = parts(jar.cookie('accessToken'));
      expect(claims.exp - claims.iat).toBe(900);
    });
  });

  it('🔴 문서 — 로그인이 필요한 두 주소의 401 에 TOKEN_EXPIRED', async () => {
    await withServer(stepDir(7), async ({ base }) => {
      const doc = await (await fetch(`${base}/api/openapi.json`)).json();
      const codes = JSON.stringify(doc.paths['/api/v2/posts']);
      expect(codes).toContain('TOKEN_EXPIRED');
      expect(codes).toContain('LOGIN_REQUIRED');
    });
  });
});

/** 실습·과제 파일을 사본에 두고 포트를 바꿔 띄운다 — `from` 판의 학생 파일 위에 `file` 을 `source` 로 덮는다. */
const withLab = async (file, port, source, fn, { from = stepDir(7), labPort, extraEnv = {} } = {}) => {
  const dir = studentDir(from, (d) => {
    // 실습·과제 파일은 북마크(없으면 작업트리)의 lab/p3-44 — Step 커밋 뒤에 더한 파일이라 그 판에는 없다.
    cpSync(LAB(''), join(d, 'lab/p3-44'), { recursive: true });
    writeFileSync(join(d, file), source.replaceAll(String(labPort), String(port)));
  });
  const srv = await boot(join(dir, file), { port, cwd: dir, env: { ...env, ...extraEnv, PORT: String(port) }, ready: `${port}번 포트에서` });
  try {
    await fn({ dir, base: `http://localhost:${port}` });
  } finally {
    await stop(srv);
  }
};
const LAB_SRC = (name) => read(MAIN_LAB.includes(name) ? P(`lab/p3-44/${name}`) : LAB(name));
// 스냅숏은 판정 파일이라 작업트리에서 — 시작 판 practice1 은 학생 검수가 로그아웃 응답에 쿠키를 더했다.
const SNAP = (name) => read(P(`snapshots/p3-44.${name}`));
const sendAll = async (blocks, jar, port, opts = {}) => {
  const out = [];
  for (const block of blocks) out.push(await sendBlock(block, jar, { port, ...opts }));
  return out;
};

describe('축 ⑧ 직접 해보기 1 — 쿠키의 path', () => {
  const run = async (source) => {
    let got;
    await withLab('lab/p3-44/practice1.js', LAB_PORT, source, async ({ base }) => {
      const jar = device(base);
      // 학생의 httpYac 에는 수업 백엔드(3000)에서 받은 쿠키가 이미 있다 — 포트가 달라도 같은 localhost 라 함께 실린다
      jar.put('accessToken', 'class-token');
      jar.put('refreshToken', 'class-refresh', '/api/v2/auth');
      const res = await sendAll(httpBlocks(LAB_SRC('practice1.http')), jar, LAB_PORT);
      got = res.map((r) => (r.body.cookies ? r.body.cookies.join(',') : r.status));
    }, { labPort: 4001 });
    return got;
  };
  it('🔴 시작 코드는 labRefresh 가 모든 주소에 실린다 · path 를 /auth 로 주면 /authors 에도 안 실린다 · 지울 때 path 를 빼면 남는다', async () => {
    const AR = 'labAccess,labRefresh';
    expect(await run(SNAP('practice1-start.practice1.js'))).toEqual([200, AR, AR, AR, AR, '']);
    expect(await run(LAB_SRC('practice1.js'))).toEqual([200, 'labAccess', 'labAccess', 'labRefresh,labAccess', 'labRefresh,labAccess', '']);
    const half = LAB_SRC('practice1.js').replace("res.clearCookie('labRefresh', { path: '/auth' });", "res.clearCookie('labRefresh');");
    expect(await run(half)).toEqual([200, 'labAccess', 'labAccess', 'labRefresh,labAccess', 'labRefresh,labAccess', 'labRefresh']);
  });
  it('🔴 학생 검수 — path 를 /auth/refresh 로 더 좁게 준 판은 로그아웃에 labRefresh 가 안 실려 다섯째에서 드러난다', async () => {
    const narrow = LAB_SRC('practice1.js').replaceAll("path: '/auth' }", "path: '/auth/refresh' }");
    // 만들 때 · 지울 때 둘을 바꿨다(새 토큰 받는 라우트 줄에 원래 하나가 있다)
    expect(narrow.split("'/auth/refresh'")).toHaveLength(4);
    expect(await run(narrow)).toEqual([200, 'labAccess', 'labAccess', 'labRefresh,labAccess', 'labAccess', '']);
  });
});

describe('축 ⑨ 직접 해보기 2 — 로그인이 끝나는 때', () => {
  it('🔴 최근 로그인부터 «8글자 · 한국 시각 · 까닭» · created_at 을 25일 당기면 그 기록은 «처음 로그인한 뒤 30일» · expires_at 만 보는 판은 못 가린다', async () => {
    await freshGate();
    await withServer(stepDir(7), async ({ base }) => {
      await device(base).login('jaehoon');
      await device(base).login('jaehoon');
    });
    const runScript = (source) => {
      const dir = studentDir(stepDir(7), (d) => writeFileSync(join(d, 'lab/p3-44/practice2.js'), source));
      return node(dir, 'lab/p3-44/practice2.js');
    };
    const first = runScript(LAB_SRC('practice2.js'));
    expect(first.code).toBe(0);
    const lines = first.out.trim().split('\n');
    expect(lines).toHaveLength(2);
    for (const line of lines) expect(line).toMatch(/^[0-9a-f]{8} {2}\d{4}\. \d{1,2}\. \d{1,2}\. (오전|오후) \d{1,2}:\d{2}:\d{2} {2}7일 동안 새 토큰을 안 받으면$/);
    await gate("UPDATE sessions SET created_at = now() - interval '25 days' WHERE id = (SELECT id FROM sessions WHERE user_id = 2 ORDER BY created_at DESC LIMIT 1)");
    const after = runScript(LAB_SRC('practice2.js')).out.trim().split('\n');
    expect(after.filter((l) => l.endsWith('처음 로그인한 뒤 30일'))).toHaveLength(1);
    const wrong = LAB_SRC('practice2.js').replace('const endsAt = Math.min(session.expiresAt.getTime(), limit);', 'const endsAt = session.expiresAt.getTime();');
    expect(runScript(wrong).out.trim().split('\n').filter((l) => l.endsWith('처음 로그인한 뒤 30일'))).toHaveLength(0);
  });
});

describe('축 ⑩ 직접 해보기 3 — 화면 없이 새 토큰 받기', () => {
  const runClient = (source, token) => {
    const dir = studentDir(stepDir(7), (d) => writeFileSync(join(d, 'lab/p3-44/practice3.js'), source.replace('http://localhost:3000', `http://localhost:${PORT}`)));
    return node(dir, 'lab/p3-44/practice3.js', {}, [token]);
  };
  it('🔴 시작 코드는 TOKEN_EXPIRED 에서 멈춘다 · 다 짠 판은 새 토큰을 받아 200 · 엉터리 토큰이면 새 토큰을 받지 않는다 · «401 이면 무조건» 판은 엉터리에도 받는다', async () => {
    await freshGate();
    const expired = expiredToken(7);
    await withServer(stepDir(7), async () => {
      expect(runClient(SNAP('practice3-start.practice3.js'), expired).out.trim().split('\n')).toEqual(['로그인 200', '게시물 목록 401 TOKEN_EXPIRED']);
      expect(runClient(LAB_SRC('practice3.js'), expired).out.trim().split('\n')).toEqual(['로그인 200', '게시물 목록 401 TOKEN_EXPIRED', '새 토큰 받기 200', '게시물 목록 200']);
      expect(runClient(LAB_SRC('practice3.js'), 'abc').out.trim().split('\n')).toEqual(['로그인 200', '게시물 목록 401 LOGIN_REQUIRED']);
      const any401 = LAB_SRC('practice3.js').replace("if (first.error?.code === 'TOKEN_EXPIRED') {", 'if (first.error) {');
      expect(runClient(any401, 'abc').out).toContain('새 토큰 받기 200');
      // Refresh 쿠키를 싣지 않으면 새 토큰을 못 받는다
      const noCookie = LAB_SRC('practice3.js').replace("{ method: 'POST', headers: { Cookie: `refreshToken=${cookies.refreshToken}` } }", "{ method: 'POST' }");
      expect(runClient(noCookie, expired).out).toContain('새 토큰 받기 401');
    });
  });
});

describe('축 ⑪ 과제 [기초] — 동아리 서버에 Refresh', () => {
  const run = async (source) => {
    let statuses;
    let expiredBody;
    let loginCookies;
    await withLab('lab/p3-44/homework1.js', HW_PORT, source, async ({ dir, base }) => {
      const tok = node(dir, 'lab/p3-44/homework1-expired-token.js', { CLUB_SECRET }).out.trim();
      const blocks = httpBlocks(LAB_SRC('homework1.http'));
      const jar = device(base);
      const named = {};
      const res = [];
      const swap = {};
      for (const block of blocks) {
        const r = await sendBlock(block, jar, { port: HW_PORT, swap: { ...swap, EXPIRED_TOKEN: tok }, named });
        res.push(r);
        if (block.title === 'bomi로 로그인') {
          swap.COPIED_REFRESH = cookieLine(r, 'clubRefresh').split(';')[0].slice('clubRefresh='.length);
          swap.FORGED_REFRESH = `${swap.COPIED_REFRESH.split('.')[0]}.guess`;
          loginCookies = r.setCookies;
        }
        if (block.title === '다시 bomi로 로그인') swap.LOGGED_OUT_REFRESH = cookieLine(r, 'clubRefresh').split(';')[0].slice('clubRefresh='.length);
        if (block.title === 'dami로 로그인') swap.DAMI_REFRESH = cookieLine(r, 'clubRefresh').split(';')[0].slice('clubRefresh='.length);
        if (block.title === '기한이 지난 토큰으로 내 정보') expiredBody = r.body;
      }
      statuses = res.map((r) => r.status);
    }, { labPort: 4011, extraEnv: { CLUB_SECRET } });
    // «bomi로 로그인» 응답 헤더 — 요구사항 9 의 확인(Path=/auth · 둘 다 7일 · 토큰은 5분)
    const refreshLine = loginCookies.find((l) => l.startsWith('clubRefresh='));
    const tokenLine = loginCookies.find((l) => l.startsWith('clubToken='));
    const [, payload] = parts(tokenLine.split(';')[0].slice('clubToken='.length));
    const headers = {
      refreshPath: /; Path=\/auth(;|$)/.test(refreshLine),
      maxAges: [tokenLine, refreshLine].map((l) => /Max-Age=(\d+)/.exec(l)[1]),
      lifetime: payload.exp - payload.iat,
    };
    return { statuses, expiredBody, headers };
  };
  const SEQ = [201, 200, 200, 401, 200, 401, 401, 200, 401, 200, 401, 201, 200, 200, 200, 401];
  const HEADERS = { refreshPath: true, maxAges: ['604800', '604800'], lifetime: 300 };
  it('🔴 상태 코드 201 · 200 · 200 · 401 · 200 · 401 · 401 · 200 · 401 · 200 · 401 · 201 · 200 · 200 · 200 · 401 · 기한만 지난 토큰은 code TOKEN_EXPIRED · 로그인 헤더(Path=/auth · 7일 · 5분)', async () => {
    const ok = await run(LAB_SRC('homework1.js'));
    expect(ok.statuses).toEqual(SEQ);
    expect(ok.expiredBody).toEqual({ code: 'TOKEN_EXPIRED', message: '토큰의 기한이 지났어요' });
    expect(ok.headers).toEqual(HEADERS);
  });
  it('🔴 틀린 판 다섯을 가린다 — 회전 없음(6번째 200) · 재사용에도 안 지움(7번째 200) · 지어낸 값에도 지움(5번째 401) · 로그아웃이 기록을 안 지움(11번째 200) · 만료를 안 가름(code 없음)', async () => {
    const src = LAB_SRC('homework1.js');
    const swapOnce = (from, to) => { expect(src.split(from)).toHaveLength(2); return src.replace(from, to); };
    const noRotate = swapOnce("  const nextSecret = randomBytes(32).toString('base64url');\n  login.previousHash = hash;\n  login.secretHash = hashSecret(nextSecret);", "  const nextSecret = secret;");
    expect((await run(noRotate)).statuses[5]).toBe(200);
    const reuse = "    if (login.previousHash === hash) {\n      logins.delete(loginId);\n    }\n";
    const noDelete = swapOnce(reuse, '');
    expect((await run(noDelete)).statuses[6]).toBe(200);
    const deleteAny = swapOnce(reuse, '    logins.delete(loginId);\n');
    expect((await run(deleteAny)).statuses[4]).toBe(401);
    const logoutKeeps = swapOnce("  if (login && secret && login.secretHash === hashSecret(secret)) {\n    logins.delete(loginId);\n  }\n", '');
    expect((await run(logoutKeeps)).statuses[10]).toBe(200);
    const noCode = src.replace("      return res.status(401).json({ code: 'TOKEN_EXPIRED', message: '토큰의 기한이 지났어요' });", "      return res.status(401).json({ message: '로그인이 필요해요' });");
    expect((await run(noCode)).expiredBody.code).toBeUndefined();
  }, 60_000);
  it('🔴 학생 검수 — 내보낸 회원 확인을 빼면 마지막 요청이 401 이 아니다 · path 를 빼거나 30분 그대로 둔 판은 로그인 헤더가 가린다', async () => {
    const src = LAB_SRC('homework1.js');
    const noMember = src.replace("  if (!member) {\n    logins.delete(loginId);\n    return res.status(401).json({ message: '다시 로그인해 주세요' });\n  }\n\n  const nextSecret", '  const nextSecret');
    expect(noMember).not.toBe(src);
    expect((await run(noMember)).statuses).toEqual([...SEQ.slice(0, 15), 500]);
    const noPath = src.replace("{ httpOnly: true, sameSite: 'lax', path: '/auth', maxAge: LOGIN_LIFETIME }", "{ httpOnly: true, sameSite: 'lax', maxAge: LOGIN_LIFETIME }");
    expect(noPath).not.toBe(src);
    expect((await run(noPath)).headers.refreshPath).toBe(false);
    const thirty = src.replace('const ACCESS_LIFETIME = 1000 * 60 * 5;', 'const ACCESS_LIFETIME = 1000 * 60 * 30;');
    expect(thirty).not.toBe(src);
    expect((await run(thirty)).headers.lifetime).toBe(1800);
  }, 60_000);
  it('🔴 답안 «확인하지 못하는 요구사항» — 끝나는 때 확인 · 7일로 미루기 · 지금 역할을 빼도 상태 코드 열여섯 개와 로그인 헤더가 같다', async () => {
    const src = LAB_SRC('homework1.js');
    const noExpiry = src.replace('  if (!login || login.expiresAt <= Date.now()) {', '  if (!login) {');
    const noSlide = src.replace('  login.expiresAt = Date.now() + LOGIN_LIFETIME;\n', '');
    const oldRole = src.replace('  setTokens(res, member, loginId, nextSecret);', '  setTokens(res, { ...member, role: jwt.decode(req.cookies.clubToken)?.role ?? member.role }, loginId, nextSecret);');
    for (const wrong of [noExpiry, noSlide, oldRole]) {
      expect(wrong).not.toBe(src);
      const r = await run(wrong);
      expect(r.statuses).toEqual(SEQ);
      expect(r.headers).toEqual(HEADERS);
    }
  }, 90_000);
});

describe('축 ⑫ 과제 [응용] — 로그인한 기기 목록과 내보내기', () => {
  const run = async (source) => {
    await freshGate();
    let result;
    await withServer(stepDir(7), async ({ base: apiBase }) => {
      await withLab('lab/p3-44/homework2.js', HW_PORT2, source, async ({ base }) => {
        const a = device(apiBase);
        const b = device(apiBase);
        const c = device(apiBase);
        await a.login('jaehoon');
        await b.login('jaehoon');
        await c.login('admin.hong', 'admin1234!');
        const toLab = (dev) => ({ Cookie: `accessToken=${dev.cookie('accessToken')}` });
        const list = await (await fetch(`${base}/sessions`, { headers: toLab(a) })).json();
        const [sidA] = a.cookie('refreshToken').split('.');
        const [sidB] = b.cookie('refreshToken').split('.');
        const [sidC] = c.cookie('refreshToken').split('.');
        const delB = await fetch(`${base}/sessions/${sidB}`, { method: 'DELETE', headers: toLab(a) });
        const reissueB = await b.send('POST', '/api/v2/auth/reissue');
        const delC = await fetch(`${base}/sessions/${sidC}`, { method: 'DELETE', headers: toLab(a) });
        // 학생 검수 — 없는 기록 id(homework2.http «없는 로그인 기록 내보내기»)
        const delNone = await fetch(`${base}/sessions/00000000-0000-0000-0000-000000000000`, { method: 'DELETE', headers: toLab(a) });
        const noLogin = await fetch(`${base}/sessions`);
        const noLoginText = await noLogin.text();
        result = {
          list: list.map((s) => [s.id === sidA ? 'A' : s.id === sidB ? 'B' : '?', s.current]),
          endsAt: list.every((s) => typeof s.endsAt === 'string'),
          delB: delB.status, reissueB: reissueB.status, delC: delC.status, delNone: delNone.status,
          adminRows: (await gate('SELECT count(*)::int AS n FROM sessions WHERE user_id = 45'))[0].n,
          noLogin: [noLogin.status, (() => { try { return JSON.parse(noLoginText); } catch { return noLoginText.slice(0, 15); } })()],
        };
      }, { labPort: 4012 });
    });
    return result;
  };
  it('🔴 목록은 내 기록만 최근부터 · 지금 기기만 current · 다른 기기를 내보내면 그 기기는 새 토큰 401 · 남의 기록은 404 · 로그인 없이 401', async () => {
    expect(await run(LAB_SRC('homework2.js'))).toEqual({
      list: [['B', false], ['A', true]], endsAt: true, delB: 200, reissueB: 401, delC: 404, delNone: 404, adminRows: 1,
      noLogin: [401, { message: '로그인이 필요해요' }],
    });
  });
  it('🔴 틀린 판 — 내보낼 때 «내 것» 조건을 빼면 남의 기록도 지워진다(200)', async () => {
    const wrong = LAB_SRC('homework2.js').replace('where: { id: req.params.id, userId: res.locals.userId }', 'where: { id: req.params.id }');
    const r = await run(wrong);
    expect(r.delC).toBe(200);
    expect(r.adminRows).toBe(0);
  });
  it('🔴 학생 검수 — findUnique 뒤 null 확인을 빼면 없는 기록에 500 · 에러 미들웨어를 빼면 401 본문이 HTML', async () => {
    const src = LAB_SRC('homework2.js');
    const del = "  const { count } = await prisma.session.deleteMany({ where: { id: req.params.id, userId: res.locals.userId } });\n\n  if (count === 0) {\n    return res.status(404).json({ message: '그런 로그인 기록은 없어요' });\n  }\n";
    expect(src.split(del)).toHaveLength(2);
    const noNull = src.replace(del, "  const found = await prisma.session.findUnique({ where: { id: req.params.id } });\n\n  if (found.userId !== res.locals.userId) {\n    return res.status(404).json({ message: '그런 로그인 기록은 없어요' });\n  }\n\n  await prisma.session.delete({ where: { id: req.params.id } });\n");
    const r = await run(noNull);
    expect([r.delB, r.delC, r.delNone]).toEqual([200, 404, 500]);
    const mw = "app.use((err, req, res, next) => {\n  res.status(err.status ?? 500).json({ message: err.message });\n});\n";
    expect(src.split(mw)).toHaveLength(2);
    const noMw = await run(src.replace(mw, ''));
    expect(noMw.noLogin[0]).toBe(401);
    expect(noMw.noLogin[1]).toBe('<!DOCTYPE html>');
  });
  it('🔴 학생 검수 — 처음 로그인을 25일 당긴 기록의 endsAt 은 createdAt 의 30일 뒤 · expires_at 만 보는 판은 7일 뒤', async () => {
    const endsOf = async (source) => {
      await freshGate();
      let row;
      await withServer(stepDir(7), async ({ base: apiBase }) => {
        await withLab('lab/p3-44/homework2.js', HW_PORT2, source, async ({ base }) => {
          const a = device(apiBase);
          await a.login('jaehoon');
          await gate("UPDATE sessions SET created_at = now() - interval '25 days' WHERE id = $1", [a.cookie('refreshToken').split('.')[0]]);
          const [first] = await (await fetch(`${base}/sessions`, { headers: { Cookie: `accessToken=${a.cookie('accessToken')}` } })).json();
          row = (Date.parse(first.endsAt) - Date.parse(first.createdAt)) / (24 * 60 * 60 * 1000);
        }, { labPort: 4012 });
      });
      return Math.round(row);
    };
    const src = LAB_SRC('homework2.js');
    expect(await endsOf(src)).toBe(30);
    const expiresOnly = src.replace('endsAt: new Date(Math.min(session.expiresAt.getTime(), session.createdAt.getTime() + SESSION_MAX_LIFETIME)),', 'endsAt: session.expiresAt,');
    expect(expiresOnly).not.toBe(src);
    expect(await endsOf(expiresOnly)).toBe(32);
  });
});

describe('축 ⑬ Step 4 — 직전 비밀값일 때만 지운다', () => {
  it('🔴 행 ID 에 엉터리 비밀값을 붙여 보내면 401 · 행은 남고 진짜 Refresh 로는 그대로 새 토큰 · 직전 비밀값이면 지운다', async () => {
    await freshGate();
    await withServer(stepDir(4), async ({ base }) => {
      const jar = device(base);
      await jar.login('jaehoon');
      const first = jar.cookie('refreshToken');
      const [sid] = first.split('.');
      const guess = await fetch(`${base}/api/v2/auth/reissue`, { method: 'POST', headers: { Cookie: `refreshToken=${sid}.guess` } });
      expect(guess.status).toBe(401);
      expect(await gate('SELECT count(*)::int AS n FROM sessions WHERE id = $1', [sid])).toEqual([{ n: 1 }]);
      expect((await jar.send('POST', '/api/v2/auth/reissue')).status).toBe(200);
      const [row] = await gate('SELECT refresh_token_hash AS now, previous_refresh_token_hash AS prev FROM sessions WHERE id = $1', [sid]);
      expect(row.prev).toBe(sha256(first.split('.')[1]));
      expect(row.now).toBe(sha256(jar.cookie('refreshToken').split('.')[1]));
      const reuse = await fetch(`${base}/api/v2/auth/reissue`, { method: 'POST', headers: { Cookie: `refreshToken=${first}` } });
      expect(reuse.status).toBe(401);
      expect(await gate('SELECT count(*)::int AS n FROM sessions WHERE id = $1', [sid])).toEqual([{ n: 0 }]);
    });
  });

  it('🔴 🤔 — 훔친 사람이 두 번 바꾼 뒤 처음 값이 오면 지우지 않는다(직전 해시 하나만 남겨서) · 훔친 사람은 계속 200 · 다시 로그인해 모든 기기에서 로그아웃하면 끝난다', async () => {
    await freshGate();
    await withServer(stepDir(4), async ({ base }) => {
      const thief = device(base);
      await thief.login('jaehoon');
      const first = thief.cookie('refreshToken');
      const [sid] = first.split('.');
      expect((await thief.send('POST', '/api/v2/auth/reissue')).status).toBe(200);
      expect((await thief.send('POST', '/api/v2/auth/reissue')).status).toBe(200);
      const late = await fetch(`${base}/api/v2/auth/reissue`, { method: 'POST', headers: { Cookie: `refreshToken=${first}` } });
      expect(late.status).toBe(401);
      expect(await gate('SELECT count(*)::int AS n FROM sessions WHERE id = $1', [sid])).toEqual([{ n: 1 }]);
      expect((await thief.send('POST', '/api/v2/auth/reissue')).status).toBe(200);
      const owner = device(base);
      await owner.login('jaehoon');
      expect((await owner.send('POST', '/api/v2/auth/logout-all')).status).toBe(200);
      expect((await thief.send('POST', '/api/v2/auth/reissue')).status).toBe(401);
    });
  });

  it('🔴 Step 4 마이그레이션은 previous_refresh_token_hash(TEXT · NULL 허용) 하나', () => {
    const dir = readdirSync(stepDir(4)('prisma/migrations')).find((name) => name.endsWith('_add_previous_refresh_token_hash'));
    expect(dir).toBeDefined();
    expect(read(stepDir(4)(`prisma/migrations/${dir}/migration.sql`))).toContain('ALTER TABLE "sessions" ADD COLUMN     "previous_refresh_token_hash" TEXT;');
    expect(readdirSync(stepDir(3)('prisma/migrations')).some((name) => name.endsWith('_add_previous_refresh_token_hash'))).toBe(false);
  });
});

describe('축 ⑭ Step 6 겪기 · Step 7 다른 비밀키', () => {
  it('🔴 Step 5 판은 «기한이 지난 토큰으로 로그아웃» 뒤에도 새 토큰 200 · Step 6 판은 같은 요청이 기록을 지워 복사해 둔 Refresh 가 401', async () => {
    const expired = expiredToken(6);
    for (const [n, after] of [[5, 200], [6, 401]]) {
      await freshGate();
      await withServer(stepDir(n), async ({ base }) => {
        const blocks = HTTP(6);
        const jar = device(base);
        await sendBlock(blockOf(blocks, '로그인'), jar, { port: PORT });
        const copied = jar.cookie('refreshToken');
        const out = await sendBlock(blockOf(blocks, '기한이 지난 토큰으로 로그아웃'), jar, { port: PORT, swap: { EXPIRED_TOKEN: expired } });
        expect(out.status).toBe(200);
        const res = await sendBlock(blockOf(blocks, '복사해 둔 Refresh 토큰으로 새 토큰 받기'), jar, { port: PORT, swap: { COPIED_REFRESH: copied } });
        expect(res.status).toBe(after);
      });
    }
  });

  it('🔴 JWT_SECRET 을 다른 값으로 주고 expired-token.js 를 실행하면 그 토큰은 LOGIN_REQUIRED', async () => {
    await freshGate();
    const dir = studentDir(stepDir(7));
    const forged = node(dir, 'lab/p3-44/expired-token.js', { JWT_SECRET: 'another-secret' }).out.trim();
    expect(forged.split('.')).toHaveLength(3);
    await withServer(stepDir(7), async ({ base }) => {
      const res = await device(base).send('GET', '/api/v2/posts?limit=1', undefined, { Authorization: `Bearer ${forged}` });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('LOGIN_REQUIRED');
    });
  });
});

// 축 ⑮ 학생 낭독 집중 검수(2026-11-12) — 교안·답안이 적은 확인이 고친 실습·과제 파일과 같다
const DOCS = ['p3-44-access-token-reissue-lecture.md', 'p3-44-access-token-reissue-answers.md']
  .map((name) => join(new URL('../../', ROOT).pathname, `part3/7-express-auth/${name}`));
const fences = (file, lang) => {
  const out = [];
  let cur = null;
  for (const line of read(file).split('\n')) {
    if (line.startsWith('```')) {
      if (cur === null) cur = { lang: line.slice(3), body: [] };
      else { if (cur.lang === lang) out.push(cur.body.join('\n')); cur = null; }
    } else if (cur) cur.body.push(line);
  }
  return out;
};

describe('축 ⑮ 학생 검수 — 교안의 실습·과제 블록과 확인 차례', () => {
  it('🔴 직접 해보기 1 의 시작 코드·해설 코드 · 과제 둘의 .http 블록은 곧 그 파일이다', () => {
    const js = fences(DOCS[0], 'javascript').filter((b) => b.startsWith('// ~/instagram-api/lab/p3-44/practice1.js'));
    expect(js).toHaveLength(2);
    expect(`${js[0]}\n`).toBe(SNAP('practice1-start.practice1.js'));
    expect(`${js[1]}\n`).toBe(LAB_SRC('practice1.js'));
    const http = fences(DOCS[0], 'http');
    for (const [file, port] of [['practice1.http', 4001], ['homework1.http', 4011], ['homework2.http', 4012]]) {
      const hit = http.filter((b) => b.includes(`localhost:${port}/`));
      expect(hit, file).toHaveLength(1);
      expect(`${hit[0]}\n`, file).toBe(LAB_SRC(file));
    }
  });
  it('🔴 교안·답안이 적은 확인 차례가 위 실행과 같다', () => {
    const [lecture, answers] = DOCS.map(read);
    expect(lecture).toContain('`["labAccess"]` · `["labAccess"]` · `["labRefresh","labAccess"]` · `["labRefresh","labAccess"]` · `[]`');
    for (const seq of ['201 · 200 · 200 · 401 · 200 · 401 · 401 · 200 · 401 · 200 · 401 · 201 · 200 · 200 · 200 · 401', '200 · 200 · 200 · 404 · 404 · 401']) {
      expect(lecture, seq).toContain(seq);
      expect(answers, seq).toContain(seq);
    }
    expect(lecture).toContain('{ "message": "로그인이 필요해요" }');
    expect(lecture).toContain('Path=/auth');
  });
});
