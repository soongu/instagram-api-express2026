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
    const carried = [...jar.values()].filter((c) => pathMatches(c.path, path));
    if (carried.length > 0 && !headers.Cookie && !headers.Authorization) headers.Cookie = carried.map((c) => `${c.name}=${c.value}`).join('; ');
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
      expect(res.body).toEqual({ error: { code: 'TOKEN_EXPIRED', message: '토큰의 기한이 지났어요' } });
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
