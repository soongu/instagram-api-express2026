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
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import pg from 'pg';
import bcrypt from 'bcrypt';
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

/** 쿠키를 이름마다 기억하는 요청 도우미 — 브라우저 하나나 httpYac 하나처럼. */
const device = (base) => {
  const jar = new Map();
  const send = async (method, path, body, extra = {}) => {
    const headers = { ...extra };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (jar.size > 0 && !headers.Cookie && !headers.Authorization) headers.Cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
    const res = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const sets = res.headers.getSetCookie();
    for (const line of sets) {
      const [pair] = line.split(';');
      const at = pair.indexOf('=');
      const [name, value] = [pair.slice(0, at), pair.slice(at + 1)];
      if (value === '' || /Expires=Thu, 01 Jan 1970/.test(line)) jar.delete(name);
      else jar.set(name, value);
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
    cookie: (name) => jar.get(name),
    bearer: (token) => ({ Authorization: `Bearer ${token}` }),
  };
};
const node = (dir, file, extra = {}) => {
  try {
    return { code: 0, out: execFileSync(process.execPath, [file], { cwd: dir, encoding: 'utf8', env: { ...process.env, ...env, ...extra }, stdio: 'pipe' }) };
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
