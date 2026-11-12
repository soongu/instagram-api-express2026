// p3-43 「역할 기반 인가 — 관리자」 게이트 — 백엔드
//
// `7-express-auth` 여덟째 회차다(`curriculum.md` 「`p3-43` 착수 결정」).
// Step 1~8 본문은 수업 백엔드, 실습·과제는 `lab/p3-43/`. 화면은 바꾸지 않는다.
// Step 마다의 판은 커밋 제목의 «(Step N)» 표식으로 꺼낸다(같은 표식이 여럿이면 가장 뒤 커밋).
//
// 축 ① Step 1 — 관리자도 403 · X-Role 헤더도 403
// 축 ② Step 2 — users.role(enum · 기본 USER) · 역할을 실어 보낸 가입은 USER · enum 이 다른 글자를 막는다
// 축 ③ Step 3 — 관리자 스크립트
// 축 ④ Step 4 — 토큰에 역할 · 그래도 403(쓴 사람 확인은 그대로)
// 축 ⑤ Step 5 — 중간 판(checkAuthor 한 곳)은 고치기까지 열린다 · 끝 판은 지우기만 · 역할 없는 옛 토큰은 관리자가 아니다
// 축 ⑥ Step 6 — 관리자 주소 200/403/401/400/404/405 · 거르는 데 쿼리 0
// 축 ⑦ Step 7 — 역할을 내려도 복사한 토큰은 관리자(자기를 다시 올린다)
// 축 ⑧ Step 8 — 관리자 권한을 쓸 때만 다시 확인 · 일반 요청 쿼리는 그대로 · 올린 쪽은 다시 로그인해야
// 축 ⑨~⑪ 직접 해보기 셋 · 축 ⑫ 과제 둘 · 축 ⑭ 실습·과제 서버의 비밀키 가드
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
import { applyMigrationsAfter, SOCIAL_ACCOUNTS_MIGRATION } from './helpers/tip-schema.js';

const ROOT = new URL('../', import.meta.url);
const P = (rel) => new URL(rel, ROOT).pathname;
const read = (path) => readFileSync(path, 'utf8');
const ADMIN = { host: 'localhost', port: 5432, database: 'postgres', user: 'postgres', password: 'postgres' };
const TPL_DB = 'p343_tpl';
const GATE_DB = 'p343_gate';
const GATE_URL = `postgresql://postgres:postgres@localhost:5432/${GATE_DB}`;
const PORT = 3940;
const LAB_PORT = 3942;
const LAB_PORT2 = 3943;
const HW_PORT = 3944;
const HW_PORT2 = 3945;

// 학생 파일은 이 회차 북마크 `code/p3-43` 을 풀어서 읽는다(없으면 작업트리 — 이 회차를 짓는 동안).
const ROUND = roundDir('code/p3-43');
const R = (rel) => join(ROUND.dir, rel);
const LAB = (rel) => R(`lab/p3-43/${rel}`);
// 다섯 .http 는 2026-11-12 학생 낭독 집중 검수가 main 에만 고쳤다(북마크 code/p3-43 은 옛 판) — 작업트리에서 읽는다.
//   확인에 «하나만 어긴 값»(31자 이름 · 이름 없는 소개 · 151자 소개 · 공백만 · 101자 이유)과 «없는 대상»(없는 공지 · 내보낸 회원) · «회원이 운영진을 내보내기» 를 더했다.
const MAIN_HTTP = ['practice1.http', 'practice2.http', 'practice3.http', 'homework1.http', 'homework2.http'];
const LAB_HTTP = (rel) => (MAIN_HTTP.includes(rel) ? P(`lab/p3-43/${rel}`) : LAB(rel));

const SECRET = 'q2Xh0v9bGm4RkT7sYp1wLc8nZf3uJd6eHa5iVo0rQyE';
const CLUB_SECRET = 'Zk3p9QvL0sYb7Rt2Nw5xHc8mJd1fGa6eUo4iTy0rPqE';
const env = { DATABASE_URL: GATE_URL, CORS_ORIGIN: 'http://localhost:3001', JWT_SECRET: SECRET };
const STUDENT_FILES = ['app.js', 'db.js', 'errors.js', 'responses.js', 'routes', 'controllers', 'services', 'middlewares', 'schemas', 'docs', 'package.json', 'requests', 'seed.js', 'data', 'prisma', 'prisma.config.js', 'lab/p3-43', '.env.example'];

const hasRef = (ref) => {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', ref], { cwd: P('.'), stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
};
const LINE = hasRef('refs/heads/code/p3-43') ? 'code/p3-43' : 'main';
const commitOf = (n) => {
  const log = execFileSync('git', ['log', '--format=%H %s', `code/p3-42..${LINE}`], { cwd: P('.'), encoding: 'utf8' });
  const hits = log.split('\n').filter((l) => / feat\(p3-43\): /.test(l) && l.endsWith(`(Step ${n})`));
  if (hits.length === 0) throw new Error(`(Step ${n}) 커밋이 없다`);
  return hits[0].split(' ')[0];
};
const dirs = [];
const stepDirs = new Map();
const stepDir = (n) => {
  if (stepDirs.has(n)) return stepDirs.get(n);
  const dir = mkdtempSync(join(tmpdir(), `p343-step${n}-`));
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
/** 판정 DB 를 템플릿에서 새로 만든다 — 시드 다섯(비밀번호 «이름1234») · 게시물 다섯 · admin.hong(45 · USER). */
const freshGate = () => admin(async (client) => {
  await kick(client, GATE_DB);
  await client.query(`DROP DATABASE IF EXISTS ${GATE_DB}`);
  await kick(client, TPL_DB);
  await client.query(`CREATE DATABASE ${GATE_DB} TEMPLATE ${TPL_DB}`);
});

const studentDir = (from, edit) => {
  const dir = mkdtempSync(join(tmpdir(), 'p343-srv-'));
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
  // 마이그레이션은 Step 2 판까지 — 그 앞 판(Step 1)은 role 컬럼 없이도 같은 DB 로 돈다
  for (const dir of readdirSync(R('prisma/migrations')).filter((name) => name !== 'migration_lock.toml').sort()) {
    await tpl.query(read(R(`prisma/migrations/${dir}/migration.sql`)));
  }
  // 🚨 2026-11-12 `p3-44` — 작업트리 클라이언트는 sessions 행을 만들 때 refresh_token_hash 까지 돌려받으려 한다.
  //    그 컬럼이 없으면 로그인이 P2022 로 멈추니, 이 회차 뒤의 마이그레이션을 tip 까지 얹는다(이 회차 학생 파일은 그 컬럼을 쓰지 않는다).
  // 🚨 2026-11-12 `p3-45` — `social_accounts` 가 `users` 를 가리킨다. 이 회차 시드(북마크 판)는 그 테이블을 비우는 목록에 없어
  //    `TRUNCATE … users` 가 0A000 으로 멈추니, tip 은 그 마이그레이션 «앞» 까지만 얹는다(이 회차 학생 파일은 소셜 계정을 안 쓴다).
  await applyMigrationsAfter(tpl, readdirSync(R('prisma/migrations')).filter((name) => name !== 'migration_lock.toml').sort().at(-1), SOCIAL_ACCOUNTS_MIGRATION);
  await tpl.end();
  execFileSync(process.execPath, [R('seed.js')], {
    cwd: ROUND.dir, encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: `postgresql://postgres:postgres@localhost:5432/${TPL_DB}` },
  });
  // 학생 DB 의 admin.hong — 관리자 스크립트로 넣은 45번(비밀번호 admin1234!)
  const hash = await bcrypt.hash('admin1234!', 12);
  const after = new pg.Client({ ...ADMIN, database: TPL_DB });
  await after.connect();
  await after.query("INSERT INTO users (id, username, name, phone, password_hash) VALUES (45, 'admin.hong', '관리자', '01077771234', $1)", [hash]);
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

const ADMIN_HTTP = (n) => httpBlocks(read(stepDir(n)('requests/admin.http')));
const makeAdmin = (n = 8) => {
  const dir = studentDir(stepDir(n));
  return node(dir, 'lab/p3-43/make-admin.js');
};

describe('축 ① Step 1 — 관리자도 403', () => {
  it('🔴 jaehoon 이 올린 게시물을 admin.hong 이 지우면 403 NOT_POST_AUTHOR · X-Role: admin 을 실어도 403 · 게시물은 남는다', async () => {
    await freshGate();
    await withServer(stepDir(1), async ({ base }) => {
      const blocks = ADMIN_HTTP(1);
      expect(blocks.map((b) => b.title)).toEqual(['jaehoon으로 로그인', '신고가 들어올 게시물 올리기', 'admin.hong으로 로그인', '관리자가 그 게시물 지우기', '헤더에 관리자라고 적어 지우기']);
      const jar = device(base);
      const named = {};
      const out = [];
      for (const block of blocks) out.push(await sendBlock(block, jar, { port: PORT, named }));
      expect(out.map((r) => r.status)).toEqual([200, 201, 200, 403, 403]);
      expect(out[3].body).toEqual({ error: { code: 'NOT_POST_AUTHOR', message: '내가 쓴 게시물만 고치거나 지울 수 있어요' } });
      expect(out[4].body).toEqual(out[3].body);
      expect(out[2].body).toEqual({ data: { id: 45, username: 'admin.hong', profileImage: null } });
      expect(await gate('SELECT author_id FROM posts WHERE id = $1', [named.reported.data.id])).toEqual([{ author_id: 2 }]);
    });
  }, 40000);
});

describe('축 ② Step 2 — users.role', () => {
  it('🔴 마이그레이션 — enum user_role(USER · ADMIN) · role NOT NULL DEFAULT USER · 이미 있는 행은 모두 USER', async () => {
    const S2 = stepDir(2);
    const dirName = readdirSync(S2('prisma/migrations')).find((name) => name.endsWith('_add_user_role'));
    expect(read(S2(`prisma/migrations/${dirName}/migration.sql`))).toBe('-- CreateEnum\nCREATE TYPE "user_role" AS ENUM (\'USER\', \'ADMIN\');\n\n-- AlterTable\nALTER TABLE "users" ADD COLUMN     "role" "user_role" NOT NULL DEFAULT \'USER\';\n');
    await freshGate();
    expect(await gate('SELECT DISTINCT role FROM users')).toEqual([{ role: 'USER' }]);
    expect(await gate("SELECT id, username, role FROM users WHERE username = 'admin.hong'")).toEqual([{ id: 45, username: 'admin.hong', role: 'USER' }]);
    // enum 이라 다른 글자는 데이터베이스가 막는다
    await expect(gate("UPDATE users SET role = 'OWNER' WHERE id = 2")).rejects.toMatchObject({ code: '22P02', message: 'invalid input value for enum user_role: "OWNER"' });
  }, 30000);

  it('🔴 역할을 실어 보낸 가입 — 201 · 응답에 역할 없음 · 데이터베이스에는 USER(zod 가 버리고 컨트롤러·서비스도 넷만 꺼낸다)', async () => {
    await freshGate();
    await withServer(stepDir(2), async ({ base }) => {
      const block = blockOf(ADMIN_HTTP(2), '역할을 실어 보낸 가입');
      const res = await sendBlock(block, device(base), { port: PORT });
      expect(res).toMatchObject({ status: 201, body: { data: { message: '가입했어요', username: 'boram' } } });
      expect(await gate("SELECT username, role FROM users WHERE username = 'boram'")).toEqual([{ username: 'boram', role: 'USER' }]);
    });
    // 세 겹 — 스키마는 role 을 모르고, 컨트롤러와 서비스는 네 값만 꺼낸다
    expect(read(stepDir(2)('schemas/authSchema.js'))).not.toMatch(/role/);
    expect(read(stepDir(2)('controllers/authController.js'))).toContain('const { emailOrPhone, name, username, password } = req.body;');
  }, 30000);
});

describe('축 ③ Step 3 — 관리자 스크립트', () => {
  it('🔴 make-admin.js — «역할을 바꿨어요 { id: 45, … role: \'ADMIN\' }» · 데이터베이스도 ADMIN · 없는 번호면 USER_NOT_FOUND 로 멈춘다', async () => {
    await freshGate();
    const out = makeAdmin(3);
    expect(out).toEqual({ code: 0, out: "역할을 바꿨어요 { id: 45, username: 'admin.hong', profileImage: null, role: 'ADMIN' }\n" });
    expect(await gate("SELECT role FROM users WHERE id = 45")).toEqual([{ role: 'ADMIN' }]);
    const dir = studentDir(stepDir(3), (d) => replaceIn(d, 'lab/p3-43/make-admin.js', 'setRole(45,', 'setRole(999,'));
    const missing = node(dir, 'lab/p3-43/make-admin.js');
    expect(missing.code).toBe(1);
    expect(missing.out).toContain("code: 'USER_NOT_FOUND'");
  }, 30000);
});

describe('축 ④ Step 4 — 토큰에 역할', () => {
  it('🔴 Step 3 판은 관리자가 돼도 403 · Step 4 판의 토큰에는 role(admin.hong ADMIN · jaehoon USER) · 로그인·나는 누구 응답에도 role · 그래도 지우기는 403', async () => {
    await freshGate();
    makeAdmin(3);
    await withServer(stepDir(3), async ({ base }) => {
      const j = device(base);
      await j.login('jaehoon');
      const post = await j.send('POST', '/api/v2/posts', { imageUrls: ['/images/post-8.jpg'], postAlt: '광고', content: '광고' });
      const a = device(base);
      await a.login('admin.hong', 'admin1234!');
      expect(Object.keys(parts(a.cookie('accessToken'))[1])).toEqual(['sid', 'iat', 'exp', 'sub']);
      expect((await a.send('DELETE', `/api/v2/posts/${post.body.data.id}`)).status).toBe(403);
    });
    await withServer(stepDir(4), async ({ base }) => {
      const a = device(base);
      const login = await a.login('admin.hong', 'admin1234!');
      expect(login.body).toEqual({ data: { id: 45, username: 'admin.hong', profileImage: null, role: 'ADMIN' } });
      const token = a.cookie('accessToken');
      const [, payload] = parts(token);
      expect(Object.keys(payload)).toEqual(['sid', 'role', 'iat', 'exp', 'sub']);
      expect(payload).toMatchObject({ role: 'ADMIN', sub: '45' });
      expect(token.length).toBe(223);
      expect((await a.get('/api/v2/auth/me')).body).toEqual({ data: { id: 45, username: 'admin.hong', profileImage: null, role: 'ADMIN' } });
      const j = device(base);
      await j.login('jaehoon');
      expect(parts(j.cookie('accessToken'))[1].role).toBe('USER');
      expect(j.cookie('accessToken').length).toBe(220);
      // 🙋 — 페이로드의 role 만 ADMIN 으로 고쳐 서명은 그대로 붙이면 401
      const [h, p, sig] = j.cookie('accessToken').split('.');
      const forged = [h, Buffer.from(Buffer.from(p, 'base64url').toString().replace('"role":"USER"', '"role":"ADMIN"')).toString('base64url'), sig].join('.');
      expect(parts(forged)[1].role).toBe('ADMIN');
      expect(await device(base).get('/api/v2/auth/me', { Authorization: `Bearer ${forged}` })).toMatchObject({ status: 401, body: { error: { code: 'LOGIN_REQUIRED' } } });
      const [{ id }] = await gate('SELECT id FROM posts WHERE author_id = 2 ORDER BY id DESC LIMIT 1');
      expect((await a.send('DELETE', `/api/v2/posts/${id}`)).body).toEqual({ error: { code: 'NOT_POST_AUTHOR', message: '내가 쓴 게시물만 고치거나 지울 수 있어요' } });
    });
  }, 60000);
});

describe('축 ⑤ Step 5 — 관리자는 지우기만', () => {
  it('🔴 중간 판 스냅숏 둘 = Step 4 판에서 checkAuthor 한 곳에 «쓴 사람이거나 관리자면» 을 넣은 것', () => {
    const S4 = stepDir(4);
    const svc = read(S4('services/postService.js'))
      .replace('async function checkAuthor(id, userId) {', 'async function checkAuthor(id, userId, role) {')
      .replace("  if (post.authorId !== userId) throw new ForbiddenError('NOT_POST_AUTHOR');", "  // 쓴 사람이거나 관리자면 통과한다.\n  if (post.authorId !== userId && role !== 'ADMIN') throw new ForbiddenError('NOT_POST_AUTHOR');")
      .replace('export async function updatePost(id, userId, data) {\n  await checkAuthor(id, userId);', 'export async function updatePost(id, userId, data, role) {\n  await checkAuthor(id, userId, role);')
      .replace('export async function removePost(id, userId) {\n  await checkAuthor(id, userId);', 'export async function removePost(id, userId, role) {\n  await checkAuthor(id, userId, role);');
    expect(read(P('snapshots/p3-43.step5-both.postService.js'))).toBe(svc);
    const ctl = read(S4('controllers/postController.js'))
      .replace('postService.updatePost(req.postId, res.locals.userId, req.body);', 'postService.updatePost(req.postId, res.locals.userId, req.body, res.locals.role);')
      .replace('postService.removePost(req.postId, res.locals.userId);', 'postService.removePost(req.postId, res.locals.userId, res.locals.role);');
    expect(read(P('snapshots/p3-43.step5-both.postController.js'))).toBe(ctl);
  });

  const scene = async (edit) => {
    await freshGate();
    makeAdmin(5);
    const out = {};
    await withServer(stepDir(5), async ({ base }) => {
      const blocks = ADMIN_HTTP(5);
      const named = {};
      const jar = device(base);
      for (const t of ['jaehoon으로 로그인', '신고가 들어올 게시물 올리기', 'admin.hong으로 로그인']) await sendBlock(blockOf(blocks, t), jar, { port: PORT, named });
      out.patch = await sendBlock(blockOf(blocks, '관리자가 그 게시물의 글 고치기'), jar, { port: PORT, named });
      out.content = (await gate('SELECT content FROM posts WHERE id = $1', [named.reported.data.id]))[0].content;
      out.del = await sendBlock(blockOf(blocks, '관리자가 그 게시물 지우기'), jar, { port: PORT, named });
      out.missing = await jar.send('DELETE', '/api/v2/posts/999');
      const j = device(base);
      await j.login('jaehoon');
      out.jaehoonOther = await j.send('DELETE', '/api/v2/posts/2');
    }, { edit });
    return out;
  };

  it('🔴 중간 판 — 관리자가 남의 글을 고치기도 200(내용이 바뀐다)', async () => {
    const out = await scene((d) => {
      cpSync(P('snapshots/p3-43.step5-both.postService.js'), join(d, 'services/postService.js'));
      cpSync(P('snapshots/p3-43.step5-both.postController.js'), join(d, 'controllers/postController.js'));
    });
    expect(out.patch.status).toBe(200);
    expect(out.content).toBe('관리자가 고친 글');
  }, 40000);

  it('🔴 끝 판 — 고치기 403 · 지우기 200 · 없는 게시물 404 · jaehoon 은 남의 것을 그대로 403', async () => {
    const out = await scene();
    expect(out.patch.body).toEqual({ error: { code: 'NOT_POST_AUTHOR', message: '내가 쓴 게시물만 고치거나 지울 수 있어요' } });
    expect(out.content).toBe('지금 가입하면 100만 원을 드려요');
    expect(out.del).toMatchObject({ status: 200, body: { data: { authorId: 2, content: '지금 가입하면 100만 원을 드려요' } } });
    expect(out.missing).toMatchObject({ status: 404, body: { error: { code: 'POST_NOT_FOUND' } } });
    expect(out.jaehoonOther.status).toBe(403);
  }, 40000);

  it('🔴 역할을 담기 전에 받은 토큰(Step 3 판이 만든 것)은 Step 5 판에서도 관리자가 아니다 — 다시 로그인하면 200', async () => {
    await freshGate();
    makeAdmin(5);
    let oldToken;
    await withServer(stepDir(3), async ({ base }) => {
      const a = device(base);
      await a.login('admin.hong', 'admin1234!');
      oldToken = a.cookie('accessToken');
    });
    await withServer(stepDir(5), async ({ base }) => {
      const anon = device(base);
      expect((await anon.send('DELETE', '/api/v2/posts/1', undefined, anon.bearer(oldToken))).status).toBe(403);
      const a = device(base);
      await a.login('admin.hong', 'admin1234!');
      expect((await a.send('DELETE', '/api/v2/posts/1')).status).toBe(200);
    });
  }, 40000);
});

describe('축 ⑥ Step 6 — 관리자만 들어오는 주소', () => {
  it('🔴 관리자 200 · jaehoon 403 ADMIN_ONLY(쿼리 0) · 로그인 없이 401 · 역할 바꾸기 200 · 다른 글자 400 · 없는 번호·글자 번호 404 · 405 Allow GET · 옛 주소도', async () => {
    await freshGate();
    makeAdmin(6);
    await withServer(stepDir(6), async ({ base, tail }) => {
      const blocks = ADMIN_HTTP(6);
      const j = device(base);
      await sendBlock(blockOf(blocks, 'jaehoon으로 로그인'), j, { port: PORT });
      await sleep(200);
      const before = queryLines(tail()).length;
      const denied = await sendBlock(blockOf(blocks, '사람 목록'), j, { port: PORT });
      await sleep(200);
      expect(denied.body).toEqual({ error: { code: 'ADMIN_ONLY', message: '관리자만 할 수 있어요' } });
      expect(denied.status).toBe(403);
      expect(queryLines(tail()).length - before).toBe(0);
      const a = device(base);
      await sendBlock(blockOf(blocks, 'admin.hong으로 로그인'), a, { port: PORT });
      const list = await sendBlock(blockOf(blocks, '사람 목록'), a, { port: PORT });
      expect(list.status).toBe(200);
      expect(list.body.data.map((u) => `${u.id}:${u.username}:${u.role}`)).toEqual(['1:dahye:USER', '2:jaehoon:USER', '3:minji:USER', '4:nayeon:USER', '5:seungwoo:USER', '45:admin.hong:ADMIN']);
      expect(Object.keys(list.body.data[0])).toEqual(['id', 'username', 'profileImage', 'role']);
      const anon = await sendBlock(blockOf(blocks, '로그인 없이 사람 목록'), a, { port: PORT });
      expect(anon).toMatchObject({ status: 401, body: { error: { code: 'LOGIN_REQUIRED' } } });
      const promoted = await sendBlock(blockOf(blocks, 'jaehoon을 관리자로'), a, { port: PORT });
      expect(promoted.body).toEqual({ data: { id: 2, username: 'jaehoon', profileImage: 'https://picsum.photos/seed/jaehoon/40/40', role: 'ADMIN' } });
      const bad = await a.send('PATCH', '/api/v2/admin/users/2/role', { role: 'OWNER' });
      expect(bad).toMatchObject({ status: 400, body: { error: { code: 'VALIDATION_FAILED', details: { properties: { role: { errors: ['Invalid option: expected one of "USER"|"ADMIN"'] } } } } } });
      expect((await a.send('PATCH', '/api/v2/admin/users/999/role', { role: 'USER' })).body.error.code).toBe('USER_NOT_FOUND');
      expect((await a.send('PATCH', '/api/v2/admin/users/abc/role', { role: 'USER' })).status).toBe(404);
      const m405 = await a.send('DELETE', '/api/v2/admin/users');
      expect(m405.status).toBe(405);
      expect(m405.headers.get('allow')).toBe('GET');
      expect((await j.get('/api/admin/users')).body).toEqual({ message: '관리자만 할 수 있어요' });
    }, { edit: queryLog });
  }, 40000);
});

/** 역할을 내리는 장면 — admin.hong 이 jaehoon 을 올리고, jaehoon 이 로그인해 토큰을 받고, admin.hong 이 다시 내린다. */
const demoteScene = async (n, tail) => {
  const blocks = ADMIN_HTTP(n);
  const a = device(`http://localhost:${PORT}`);
  await sendBlock(blockOf(blocks, 'admin.hong으로 로그인'), a, { port: PORT });
  await sendBlock(blockOf(blocks, 'jaehoon을 관리자로'), a, { port: PORT });
  const j = device(`http://localhost:${PORT}`);
  await sendBlock(blockOf(blocks, 'jaehoon으로 로그인'), j, { port: PORT });
  const copied = j.cookie('accessToken');
  const demoted = await sendBlock(blockOf(blocks, 'jaehoon을 다시 USER로'), a, { port: PORT });
  const swap = { COPIED_TOKEN: copied };
  await sleep(200);
  const before = tail ? queryLines(tail()).length : 0;
  const list = await sendBlock(blockOf(blocks, '복사해 둔 jaehoon의 토큰으로 사람 목록'), a, { port: PORT, swap });
  await sleep(200);
  const listQueries = tail ? queryLines(tail()).length - before : null;
  const self = await sendBlock(blockOf(blocks, '복사해 둔 jaehoon의 토큰으로 자기를 관리자로'), a, { port: PORT, swap });
  return { a, copied, demoted, list, listQueries, self, swap, blocks };
};

describe('축 ⑦ Step 7 — 역할을 내려도 토큰은 관리자', () => {
  it('🔴 내려간 jaehoon 의 복사한 토큰으로 사람 목록 200 · 자기를 다시 관리자로 200(데이터베이스도 ADMIN)', async () => {
    await freshGate();
    makeAdmin(7);
    await withServer(stepDir(7), async () => {
      const r = await demoteScene(7);
      expect(parts(r.copied)[1].role).toBe('ADMIN');
      expect(r.demoted.body.data.role).toBe('USER');
      expect(r.list.status).toBe(200);
      expect(r.self).toMatchObject({ status: 200, body: { data: { id: 2, role: 'ADMIN' } } });
      expect(await gate('SELECT role FROM users WHERE id = 2')).toEqual([{ role: 'ADMIN' }]);
    });
  }, 40000);
});

describe('축 ⑧ Step 8 — 관리자 권한을 쓸 때만 다시 확인', () => {
  it('🔴 같은 장면 — 복사한 토큰으로 사람 목록 403 · 자기를 관리자로 403 · 남의 게시물 지우기 403 · 데이터베이스는 USER 그대로', async () => {
    await freshGate();
    makeAdmin(8);
    await withServer(stepDir(8), async ({ tail }) => {
      const r = await demoteScene(8, tail);
      expect(r.list.body).toEqual({ error: { code: 'ADMIN_ONLY', message: '관리자만 할 수 있어요' } });
      expect(r.listQueries).toBe(1);
      expect(r.self.status).toBe(403);
      const del = await sendBlock(blockOf(r.blocks, '복사해 둔 jaehoon의 토큰으로 남의 게시물 지우기'), r.a, { port: PORT, swap: r.swap });
      expect(del.body).toEqual({ error: { code: 'NOT_POST_AUTHOR', message: '내가 쓴 게시물만 고치거나 지울 수 있어요' } });
      expect(await gate('SELECT role FROM users WHERE id = 2')).toEqual([{ role: 'USER' }]);
      expect(await gate('SELECT count(*)::int AS n FROM posts WHERE id = 2')).toEqual([{ n: 1 }]);
    }, { edit: queryLog });
  }, 40000);

  it('🔴 쿼리 수 — jaehoon 의 목록·나는 누구는 Step 6 판과 같다 · jaehoon 의 관리자 주소 403 은 0 · 관리자 목록은 1 → 2 · 관리자의 남의 게시물 지우기는 하나 더', async () => {
    const counts = {};
    for (const n of [6, 8]) {
      await freshGate();
      makeAdmin(8);
      await withServer(stepDir(n), async ({ base, tail }) => {
        const j = device(base);
        await j.login('jaehoon');
        const a = device(base);
        await a.login('admin.hong', 'admin1234!');
        const measure = async (fn) => {
          await sleep(150);
          const before = queryLines(tail()).length;
          const res = await fn();
          await sleep(150);
          return [res.status, queryLines(tail()).length - before];
        };
        counts[n] = {
          posts: await measure(() => j.get('/api/v2/posts?limit=2')),
          me: await measure(() => j.get('/api/v2/auth/me')),
          deniedAdmin: await measure(() => j.get('/api/v2/admin/users')),
          deniedDelete: await measure(() => j.send('DELETE', '/api/v2/posts/2')),
          adminList: await measure(() => a.get('/api/v2/admin/users')),
          adminDelete: await measure(() => a.send('DELETE', '/api/v2/posts/3')),
        };
      }, { edit: queryLog });
    }
    expect(counts[6]).toEqual({ posts: [200, 3], me: [200, 1], deniedAdmin: [403, 0], deniedDelete: [403, 1], adminList: [200, 1], adminDelete: [200, 5] });
    expect(counts[8]).toEqual({ posts: [200, 3], me: [200, 1], deniedAdmin: [403, 0], deniedDelete: [403, 1], adminList: [200, 2], adminDelete: [200, 6] });
  }, 60000);

  it('🔴 올린 쪽 — dahye 를 관리자로 올려도 올리기 전 토큰은 403 · 다시 로그인하면 200', async () => {
    await freshGate();
    makeAdmin(8);
    await withServer(stepDir(8), async ({ base }) => {
      const d = device(base);
      await d.login('dahye');
      const a = device(base);
      await a.login('admin.hong', 'admin1234!');
      await a.send('PATCH', '/api/v2/admin/users/1/role', { role: 'ADMIN' });
      expect((await d.get('/api/v2/admin/users')).status).toBe(403);
      await d.login('dahye');
      expect((await d.get('/api/v2/admin/users')).status).toBe(200);
    });
  }, 30000);
});

/** 실습 서버 하나를 학생 폴더 모양으로 띄운다 — 포트를 판정 포트로, 수업 서버 주소를 판정 포트로 바꾼다. */
const labServer = async (file, port, extraEnv = {}, edit) => {
  const dir = studentDir(stepDir(8), (d) => {
    if (edit) edit(d);
    const text = read(join(d, `lab/p3-43/${file}`));
    const listen = /app\.listen\((40\d\d)/.exec(text)[0];
    writeFileSync(join(d, `lab/p3-43/${file}`), text.replace(listen, `app.listen(${port}`).replaceAll('http://localhost:3000', `http://localhost:${PORT}`));
  });
  const srv = await boot(join(dir, `lab/p3-43/${file}`), { port, cwd: dir, env: { ...env, ...extraEnv }, ready: '포트에서' });
  return { srv, dir, base: `http://localhost:${port}` };
};
const runHttp = async (file, port, swap = {}) => {
  const jar = device(`http://localhost:${port}`);
  const out = [];
  for (const block of httpBlocks(read(LAB_HTTP(file)))) out.push(await sendBlock(block, jar, { port, swap }));
  return out;
};

describe('축 ⑨ 직접 해보기 1 — 내 정보 서버', () => {
  const run = async (file) => {
    const lab = await labServer('practice1.js', LAB_PORT, {}, file ? (d) => cpSync(file, join(d, 'lab/p3-43/practice1.js')) : undefined);
    try {
      return await runHttp('practice1.http', LAB_PORT);
    } finally {
      await stop(lab.srv);
    }
  };

  it('🔴 시작 판 — 역할까지 실어 고치면 role ADMIN · 빈 이름·길이를 넘긴 값도 200 / 끝 판 — role USER 그대로 · 빈 이름 · 31자 이름 · 이름 없는 소개 · 151자 소개 400', async () => {
    const before = await run(P('snapshots/p3-43.practice1-start.practice1.js'));
    expect(before.map((r) => r.status)).toEqual([200, 200, 200, 200, 200, 200, 200, 200]);
    expect(before[2].body).toEqual({ id: 1, username: 'jaehoon', name: '김재훈3', bio: '', role: 'ADMIN' });
    expect(before[7].body).toMatchObject({ id: 45, username: 'admin.hong', name: '김재훈4', role: 'ADMIN' });
    const after = await run();
    expect(after.map((r) => r.status)).toEqual([200, 200, 200, 400, 400, 400, 400, 200]);
    expect(after[7].body).toEqual({ id: 1, username: 'jaehoon', name: '김재훈4', bio: '', role: 'USER' });
    expect(after[0].body).toEqual({ id: 1, username: 'jaehoon', name: '김재훈', bio: '', role: 'USER' });
    expect(after[2].body).toEqual({ id: 1, username: 'jaehoon', name: '김재훈3', bio: '', role: 'USER' });
    expect(after[3].body).toEqual({ message: '보낸 내용이 규칙에 안 맞아요' });
  }, 30000);

  it('🔴 틀린 판 — 검사는 하되 role 만 지우고 본문을 덮어쓰면 넷째까지는 같지만 다섯째에 번호와 사용자 이름이 바뀐다', async () => {
    const block = join(tmpdir(), `p343-blocklist-${process.pid}.js`);
    writeFileSync(block, read(LAB('practice1.js')).replace('  Object.assign(me(), result.data);', '  delete req.body.role;\n  Object.assign(me(), req.body);'));
    dirs.push(block);
    const out = await run(block);
    expect(out.map((r) => r.status)).toEqual([200, 200, 200, 400, 400, 400, 400, 200]);
    expect(out[2].body.role).toBe('USER');
    expect(out[7].body).toMatchObject({ id: 45, username: 'admin.hong' });
  }, 30000);

  // 하나만 어긴 값 — 길이 상한이나 «늘 함께» 를 빠뜨린 판은 그 요청 하나만 200 이 된다
  const variant = async (from, to) => {
    const file = join(tmpdir(), `p343-variant-${process.pid}-${dirs.length}.js`);
    const text = read(LAB('practice1.js'));
    if (!text.includes(from)) throw new Error(`«${from}» 이 없다`);
    writeFileSync(file, text.replace(from, to));
    dirs.push(file);
    return (await run(file)).map((r) => r.status);
  };
  it('🔴 틀린 판 — name 30자 상한 · name 을 늘 보내야 한다는 것 · bio 150자 상한을 빠뜨리면 그 요청이 200', async () => {
    expect(await variant('name: z.string().min(1).max(30),', 'name: z.string().min(1),')).toEqual([200, 200, 200, 400, 200, 400, 400, 200]);
    expect(await variant('name: z.string().min(1).max(30),', 'name: z.string().min(1).max(30).optional(),')).toEqual([200, 200, 200, 400, 400, 200, 400, 200]);
    expect(await variant('bio: z.string().max(150).optional(),', 'bio: z.string().optional(),')).toEqual([200, 200, 200, 400, 400, 400, 200, 200]);
  }, 60000);
});

/** 공지 서버 둘(직접 해보기 2·3)을 수업 서버(Step 8 판)와 함께 띄운다. */
const noticeServers = async (fn, edit2) => {
  await freshGate();
  makeAdmin(8);
  const dir = studentDir(stepDir(8));
  const api = await start(dir);
  let p2;
  let p3;
  try {
    p2 = await labServer('practice2.js', LAB_PORT, {}, edit2);
    p3 = await labServer('practice3.js', LAB_PORT2);
    const a = device(`http://localhost:${PORT}`);
    await a.login('admin.hong', 'admin1234!');
    const j = device(`http://localhost:${PORT}`);
    await j.login('jaehoon');
    await fn({ api, p2, p3, a, j });
  } finally {
    if (p2) await stop(p2.srv);
    if (p3) await stop(p3.srv);
    await stop(api);
  }
};

describe('축 ⑩·⑪ 직접 해보기 2·3 — 공지 서버가 토큰의 역할로', () => {
  it('🔴 둘 다 — 토큰 없이 401 · X-Role 만 401 · jaehoon 403 · admin.hong 200 · 목록에 2번만', async () => {
    await noticeServers(async ({ a, j }) => {
      for (const [file, port] of [['practice2.http', LAB_PORT], ['practice3.http', LAB_PORT2]]) {
        // practice3.http 의 마지막 요청(내려간 jaehoon 의 토큰)은 여기서는 jaehoon 의 USER 토큰으로 — 토큰부터 403
        const out = await runHttp(file, port, { SEOYEON_TOKEN: j.cookie('accessToken'), ADMIN_TOKEN: a.cookie('accessToken'), COPIED_TOKEN: j.cookie('accessToken') });
        expect(out.map((r) => r.status)).toEqual(file === 'practice2.http' ? [200, 401, 401, 403, 200, 404, 200] : [200, 401, 401, 403, 200, 404, 200, 403]);
        expect(out[3].body).toEqual({ message: '관리자만 할 수 있어요' });
        expect(out[5].body).toEqual({ message: '그런 공지는 없어요' });
        expect(out[6].body).toEqual([{ id: 2, title: '새 기능 소개', authorId: 1 }]);
      }
    });
  }, 60000);

  it('🔴 틀린 판 — 없는 번호에 404 를 빠뜨리면 findIndex 의 -1 로 splice(-1, 1) 이 마지막 공지를 지운다 · 여섯째가 200 · 목록이 빈다', async () => {
    await noticeServers(async ({ a, j }) => {
      const out = await runHttp('practice2.http', LAB_PORT, { SEOYEON_TOKEN: j.cookie('accessToken'), ADMIN_TOKEN: a.cookie('accessToken') });
      expect(out.map((r) => r.status)).toEqual([200, 401, 401, 403, 200, 200, 200]);
      expect(out[6].body).toEqual([]);
    }, (d) => replaceIn(d, 'lab/p3-43/practice2.js', "  if (index === -1) {\n    return res.status(404).json({ message: '그런 공지는 없어요' });\n  }\n\n", ''));
  }, 60000);

  it('🔴 내려간 jaehoon 의 토큰 — 직접 해보기 2 는 200(수업 서버에 안 묻는다) · 3 은 403 · 수업 서버를 끄면 3 의 관리자 일은 503 · 목록은 둘 다 200', async () => {
    await noticeServers(async ({ api, a }) => {
      await a.send('PATCH', '/api/v2/admin/users/2/role', { role: 'ADMIN' });
      const j = device(`http://localhost:${PORT}`);
      await j.login('jaehoon');
      const stale = j.cookie('accessToken');
      await a.send('PATCH', '/api/v2/admin/users/2/role', { role: 'USER' });
      const del = (port) => device(`http://localhost:${port}`).send('DELETE', '/notices/2', undefined, { Authorization: `Bearer ${stale}` });
      expect((await del(LAB_PORT)).status).toBe(200);
      expect(await del(LAB_PORT2)).toMatchObject({ status: 403, body: { message: '관리자만 할 수 있어요' } });
      await stop(api);
      const adminDel = await device(`http://localhost:${LAB_PORT2}`).send('DELETE', '/notices/1', undefined, { Authorization: `Bearer ${a.cookie('accessToken')}` });
      expect(adminDel).toMatchObject({ status: 503, body: { message: '지금은 관리자인지 확인할 수 없어요' } });
      expect((await device(`http://localhost:${LAB_PORT2}`).get('/notices')).status).toBe(200);
      expect((await device(`http://localhost:${LAB_PORT}`).send('DELETE', '/notices/1', undefined, { Authorization: `Bearer ${a.cookie('accessToken')}` })).status).toBe(200);
    });
  }, 60000);
});

describe('축 ⑫ 과제', () => {
  const club = async (edit) => {
    const lab = await labServer('homework1.js', HW_PORT, { CLUB_SECRET }, edit);
    try {
      const jar = device(`http://localhost:${HW_PORT}`);
      const out = [];
      let damiToken;
      for (const block of httpBlocks(read(LAB_HTTP('homework1.http')))) {
        out.push(await sendBlock(block, jar, { port: HW_PORT }));
        if (block.title === 'dami로 로그인') damiToken = jar.cookie('clubToken');
      }
      const damiMe = await device(`http://localhost:${HW_PORT}`).get('/me', { Cookie: `clubToken=${damiToken}` });
      return { out, damiMe, damiToken };
    } finally {
      await stop(lab.srv);
    }
  };

  it('🔴 [기초] 첫 가입은 운영진 · 역할을 실어 보내도 회원 · 회원은 목록·내보내기 403 · 운영진 200 · 자기 자신 400 · 내보내기 200 · 내보낸 회원 다시 404 · 새 가입은 3번 · 내보낸 dami 의 토큰은 나는 누구 401', async () => {
    const r = await club();
    expect(r.out.map((x) => x.status)).toEqual([201, 201, 200, 403, 403, 200, 200, 400, 200, 404, 200, 201, 200]);
    expect(r.out[3].body).toEqual({ message: '운영진만 할 수 있어요' });
    expect(r.out[4].body).toEqual({ message: '운영진만 할 수 있어요' });
    expect(r.out[6].body).toEqual([{ id: 1, email: 'bomi@example.com', role: 'MANAGER' }, { id: 2, email: 'dami@example.com', role: 'MEMBER' }]);
    expect(r.out[7].body).toEqual({ message: '자기 자신은 내보낼 수 없어요' });
    expect(r.out[9].body).toEqual({ message: '그런 회원은 없어요' });
    expect(r.out[12].body).toEqual([{ id: 1, email: 'bomi@example.com', role: 'MANAGER' }, { id: 3, email: 'sena@example.com', role: 'MEMBER' }]);
    expect(parts(r.damiToken)[1]).toMatchObject({ role: 'MEMBER', sub: '2' });
    expect(r.damiMe.status).toBe(401);
  }, 60000);

  it('🔴 [기초] 틀린 판 — 운영진 라우트를 app.use(requireMember) 위에 두면 운영진 bomi 도 회원 목록 403', async () => {
    const r = await club((d) => {
      const file = join(d, 'lab/p3-43/homework1.js');
      const text = read(file);
      const start = text.indexOf('// 회원 목록은 운영진만 본다');
      const end = text.indexOf('// 나는 누구');
      const routes = text.slice(start, end);
      const use = '// 여기부터는 로그인한 회원만 지나간다';
      if (start < 0 || end < 0 || !text.includes(use)) throw new Error('옮길 자리가 없다');
      writeFileSync(file, text.replace(routes, '').replace(use, `${routes}${use}`));
    });
    expect(r.out[6]).toMatchObject({ status: 403, body: { message: '운영진만 할 수 있어요' } });
  }, 60000);

  it('🔴 [기초] 틀린 판 — 내보내기에 requireManager 를 빠뜨리면 «dami가 bomi 내보내기» 가 200(회원이 운영진을 내보낸다)', async () => {
    const r = await club((d) => replaceIn(d, 'lab/p3-43/homework1.js', "app.delete('/members/:id', requireManager, (req, res) => {", "app.delete('/members/:id', (req, res) => {"));
    expect(r.out[4]).toMatchObject({ status: 200, body: { email: 'bomi@example.com' } });
  }, 60000);

  it('🔴 [기초] 틀린 판 — 없는 번호에 404 를 빠뜨리면 «내보낸 dami 다시 내보내기» 가 200(splice(-1, 1) 이 bomi 를 내보낸다)', async () => {
    const r = await club((d) => replaceIn(d, 'lab/p3-43/homework1.js', "  if (index === -1) {\n    return res.status(404).json({ message: '그런 회원은 없어요' });\n  }\n\n", ''));
    expect(r.out[9]).toMatchObject({ status: 200, body: { email: 'bomi@example.com' } });
  }, 60000);

  it('🔴 [기초] 틀린 판 — 번호를 members.length + 1 로 매기면 새 가입이 2번을 받고, 내보낸 dami 의 토큰이 sena 로 읽힌다', async () => {
    const r = await club((d) => {
      replaceIn(d, 'lab/p3-43/homework1.js', 'members.push({ id: nextId, email, passwordHash, role });\n  nextId += 1;', 'members.push({ id: members.length + 1, email, passwordHash, role });');
    });
    expect(r.out[12].body).toEqual([{ id: 1, email: 'bomi@example.com', role: 'MANAGER' }, { id: 2, email: 'sena@example.com', role: 'MEMBER' }]);
    expect(r.damiMe).toMatchObject({ status: 200, body: { email: 'sena@example.com' } });
  }, 60000);

  const audit = async (edit) => {
    await freshGate();
    makeAdmin(8);
    const dir = studentDir(stepDir(8));
    const api = await start(dir);
    let lab;
    try {
      lab = await labServer('homework2.js', HW_PORT2, {}, edit);
      const a = device(`http://localhost:${PORT}`);
      await a.login('admin.hong', 'admin1234!');
      // Step 7 처럼 — jaehoon 을 올렸다가 그 사이 받은 토큰을 복사하고 다시 내린다
      await a.send('PATCH', '/api/v2/admin/users/2/role', { role: 'ADMIN' });
      const old = device(`http://localhost:${PORT}`);
      await old.login('jaehoon');
      await a.send('PATCH', '/api/v2/admin/users/2/role', { role: 'USER' });
      const j = device(`http://localhost:${PORT}`);
      await j.login('jaehoon');
      const swap = { JAEHOON_TOKEN: j.cookie('accessToken'), ADMIN_TOKEN: a.cookie('accessToken'), COPIED_TOKEN: old.cookie('accessToken') };
      return { out: await runHttp('homework2.http', HW_PORT2, swap), swap };
    } finally {
      if (lab) await stop(lab.srv);
      await stop(api);
    }
  };

  it('🔴 [응용] 내려간 관리자의 토큰 — 숨기기 403 · 기록 보기 403 · 둘 다 DENIED 로 남는다(직접 해보기 3 의 다시 확인을 이어받았다)', async () => {
    await freshGate();
    makeAdmin(8);
    const dir = studentDir(stepDir(8));
    const api = await start(dir);
    let lab;
    try {
      lab = await labServer('homework2.js', HW_PORT2);
      const a = device(`http://localhost:${PORT}`);
      await a.login('admin.hong', 'admin1234!');
      await a.send('PATCH', '/api/v2/admin/users/2/role', { role: 'ADMIN' });
      const j = device(`http://localhost:${PORT}`);
      await j.login('jaehoon');
      const stale = j.cookie('accessToken');
      await a.send('PATCH', '/api/v2/admin/users/2/role', { role: 'USER' });
      const hw = device(`http://localhost:${HW_PORT2}`);
      expect((await hw.send('PATCH', '/notices/1/hide', { reason: '내려가기 전에 받은 토큰' }, { Authorization: `Bearer ${stale}` })).status).toBe(403);
      const log = await hw.get('/audit', { Authorization: `Bearer ${a.cookie('accessToken')}` });
      expect(log.body.map(({ at, ...rest }) => rest)).toEqual([{ actorId: 2, action: 'PATCH /notices/1/hide', result: 'DENIED' }]);
    } finally {
      if (lab) await stop(lab.srv);
      await stop(api);
    }
  }, 60000);

  it('🔴 [응용] jaehoon 403 · 이유 없이 · 공백만 · 101자 400 · 없는 공지 404 · 이유를 적으면 200 · 목록에 2번만 · jaehoon 의 기록 보기 403 · 관리자는 최근 것부터 넷(막힌 시도 셋 포함) · 토큰은 안 남는다', async () => {
    const { out, swap } = await audit();
    expect(out.map((r) => r.status)).toEqual([403, 400, 400, 400, 404, 200, 200, 403, 403, 200]);
    for (const i of [1, 2, 3]) expect(out[i].body).toEqual({ message: '숨기는 이유를 100자 안으로 적어 주세요' });
    expect(out[4].body).toEqual({ message: '그런 공지는 없어요' });
    expect(out[6].body).toEqual([{ id: 2, title: '새 기능 소개', authorId: 1, hidden: false }]);
    const log = out[9].body;
    expect(log.map(({ at, ...rest }) => rest)).toEqual([
      { actorId: 2, action: 'GET /audit', result: 'DENIED' },
      { actorId: 2, action: 'PATCH /notices/2/hide', result: 'DENIED' },
      { actorId: 45, action: 'HIDE_NOTICE', result: 'OK', targetId: 1, reason: '점검이 끝나 지난 안내가 됐어요' },
      { actorId: 2, action: 'PATCH /notices/1/hide', result: 'DENIED' },
    ]);
    for (const entry of log) expect(entry.at).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
    expect(JSON.stringify(log)).not.toContain(swap.ADMIN_TOKEN);
    expect(JSON.stringify(log)).not.toContain(swap.JAEHOON_TOKEN);
  }, 60000);

  it('🔴 [응용] 틀린 판 — requireAdmin 이 막을 때 기록하지 않으면 관리자의 기록 보기에 HIDE_NOTICE 하나뿐', async () => {
    const { out } = await audit((d) => {
      const file = join(d, 'lab/p3-43/homework2.js');
      const line = "    record(res, `${req.method} ${req.path}`, 'DENIED');\n";
      if (read(file).split(line).length !== 3) throw new Error('기록 줄이 둘이 아니다');
      writeFileSync(file, read(file).replaceAll(line, ''));
    });
    expect(out.map((r) => r.status)).toEqual([403, 400, 400, 400, 404, 200, 200, 403, 403, 200]);
    expect(out[9].body.map((e) => e.action)).toEqual(['HIDE_NOTICE']);
  }, 60000);

  it('🔴 [응용] 틀린 판 — trim() 을 빠뜨리면 공백만 적은 이유가 200 · 100자 상한을 빠뜨리면 101자가 200 · 없는 공지 404 를 빠뜨리면 500', async () => {
    const CHECK = "  if (typeof reason !== 'string' || reason.trim() === '' || reason.length > 100) {";
    const noTrim = await audit((d) => replaceIn(d, 'lab/p3-43/homework2.js', CHECK, "  if (typeof reason !== 'string' || reason === '' || reason.length > 100) {"));
    expect(noTrim.out.map((r) => r.status)).toEqual([403, 400, 200, 400, 404, 200, 200, 403, 403, 200]);
    const noMax = await audit((d) => replaceIn(d, 'lab/p3-43/homework2.js', CHECK, "  if (typeof reason !== 'string' || reason.trim() === '') {"));
    expect(noMax.out.map((r) => r.status)).toEqual([403, 400, 400, 200, 404, 200, 200, 403, 403, 200]);
    const no404 = await audit((d) => replaceIn(d, 'lab/p3-43/homework2.js', "  if (!notice) {\n    return res.status(404).json({ message: '그런 공지는 없어요' });\n  }\n\n", ''));
    expect(no404.out.map((r) => r.status)).toEqual([403, 400, 400, 400, 500, 200, 200, 403, 403, 200]);
  }, 120000);

  it('🔴 [응용] 틀린 판 — 직접 해보기 2(토큰의 역할만 믿는다)에서 시작하면 내려간 jaehoon 의 숨기기가 200', async () => {
    const { out } = await audit((d) => {
      const file = join(d, 'lab/p3-43/homework2.js');
      const text = read(file);
      const start = text.indexOf('// 관리자만 다음으로 보낸다');
      const end = text.indexOf('const adminOnly');
      writeFileSync(file, text.slice(0, start) + `function requireAdmin(req, res, next) {
  if (res.locals.role !== 'ADMIN') {
    record(res, \`\${req.method} \${req.path}\`, 'DENIED');
    res.status(403).json({ message: '관리자만 할 수 있어요' });
    return;
  }

  next();
}

` + text.slice(end));
    });
    expect(out.map((r) => r.status)).toEqual([403, 400, 400, 400, 404, 200, 200, 200, 403, 200]);
  }, 60000);
});

describe('축 ⑭ 실습·과제 서버도 비밀키가 없으면 뜨지 않는다', () => {
  it('🔴 practice2 · practice3 · homework2(JWT_SECRET) · homework1(CLUB_SECRET)', () => {
    const dir = studentDir(stepDir(8));
    for (const [file, name] of [['practice2.js', 'JWT_SECRET'], ['practice3.js', 'JWT_SECRET'], ['homework2.js', 'JWT_SECRET'], ['homework1.js', 'CLUB_SECRET']]) {
      const out = node(dir, `lab/p3-43/${file}`, { JWT_SECRET: '', CLUB_SECRET: '' });
      expect(out.code).toBe(1);
      expect(out.out).toContain(`Error: .env에 ${name}이 없어요`);
    }
  }, 30000);
});

const DOCS = ['p3-43-role-based-authorization-lecture.md', 'p3-43-role-based-authorization-answers.md']
  .map((name) => join(new URL('../../', ROOT).pathname, `part3/7-express-auth/${name}`));
const fences = (file, lang) => {
  const out = [];
  const lines = read(file).split('\n');
  let cur = null;
  for (const line of lines) {
    if (line.startsWith('```')) {
      if (cur === null) cur = { lang: line.slice(3), body: [] };
      else { if (lang === undefined || cur.lang === lang) out.push(cur.body.join('\n')); cur = null; }
    } else if (cur) cur.body.push(line);
  }
  return out;
};
const meaningful = (block) => block.split('\n').filter((l) => l.trim() !== '' && l.trim() !== '...' && l.trim() !== '// ...');

describe('축 ⑬ 교안·답안의 블록은 코드베이스와 실제 실행과 같다', () => {
  it('🔴 javascript 블록 — 줄마다 Step 1~8 커밋이나 스냅숏의 그 경로 파일에 있다', () => {
    const blocks = DOCS.flatMap((d) => fences(d, 'javascript'));
    expect(blocks.length).toBeGreaterThan(20);
    for (const block of blocks) {
      const [first] = block.split('\n');
      const rel = first.replace('// ~/instagram-api/', '');
      expect(first.startsWith('// ~/instagram-api/'), first).toBe(true);
      const sources = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => stepDir(n)(rel)).filter(existsSync).map(read);
      for (const snap of readdirSync(P('snapshots')).filter((f) => f.startsWith('p3-43.'))) {
        if (rel.endsWith(snap.split('.').slice(-2).join('.'))) sources.push(read(P(`snapshots/${snap}`)));
      }
      expect(sources.length, rel).toBeGreaterThan(0);
      const ok = sources.some((src) => meaningful(block).every((l) => src.split('\n').includes(l)));
      expect(ok, `${rel}\n${block}`).toBe(true);
    }
  });

  it('🔴 http 블록 — 줄마다 requests/admin.http 나 lab/p3-43 의 .http 에 있다 · admin.http 는 교안에 적은 차례 그대로', () => {
    const files = [R('requests/admin.http'), ...readdirSync(LAB('.')).filter((f) => f.endsWith('.http')).map((f) => LAB_HTTP(f))].map((path) => read(path).split('\n'));
    const blocks = DOCS.flatMap((d) => fences(d, 'http'));
    expect(blocks.length).toBe(11);
    for (const b of blocks) expect(files.some((lines) => meaningful(b).every((l) => lines.includes(l))), b).toBe(true);
    // 교안이 admin.http 에 더하라고 한 덩어리를 차례로 이으면 그 파일이 된다
    const adminBlocks = fences(DOCS[0], 'http').filter((b) => b.includes('localhost:3000'));
    expect(adminBlocks.join('\n\n') + '\n').toBe(read(R('requests/admin.http')));
 
    // 실습·과제의 .http 도 교안 블록이 곧 그 파일이다(직접 해보기 3 은 2 를 복사해 포트를 바꾸고 한 요청을 더한 것)
    const labBlock = (port) => DOCS.flatMap((d) => fences(d, 'http')).filter((b) => b.includes(`localhost:${port}/`));
    for (const [file, port] of [['practice1.http', 4001], ['practice2.http', 4002], ['homework1.http', 4011], ['homework2.http', 4012]]) {
      expect(labBlock(port), file).toHaveLength(1);
      expect(`${labBlock(port)[0]}\n`, file).toBe(read(LAB_HTTP(file)));
    }
    expect(`${labBlock(4002)[0].replaceAll('4002', '4003')}\n\n${labBlock(4003)[0]}\n`).toBe(read(LAB_HTTP('practice3.http')));
    // 교안이 적은 상태 코드 차례가 위 실행과 같다
    const lecture = read(DOCS[0]);
    for (const seq of ['200 · 200 · 200 · 400 · 400 · 400 · 400 · 200', '200 · 401 · 401 · 403 · 200 · 404 · 200', '201 · 201 · 200 · 403 · 403 · 200 · 200 · 400 · 200 · 404 · 200 · 201 · 200', '403 · 400 · 400 · 400 · 404 · 200 · 200 · 403 · 403 · 200']) {
      expect(lecture, seq).toContain(seq);
    }
  });

  it('🔴 prisma 블록 · 마이그레이션 · make-admin 출력 · 토큰 페이로드 모양 · 쿼리 표', () => {
    const lecture = read(DOCS[0]);
    for (const l of meaningful(fences(DOCS[0], 'prisma')[0])) expect(read(stepDir(2)('prisma/schema.prisma')).split('\n'), l).toContain(l);
    const mig = readdirSync(stepDir(2)('prisma/migrations')).find((n) => n.endsWith('_add_user_role'));
    expect(lecture).toContain(`Applying migration \`${mig}\``);
    expect(lecture).toContain(`  └─ ${mig}/`);
    expect(lecture).toContain("```bash\n역할을 바꿨어요 { id: 45, username: 'admin.hong', profileImage: null, role: 'ADMIN' }\n```");
    const payload = fences(DOCS[0], '').find((b) => b.startsWith('{"sid":'));
    expect(Object.keys(JSON.parse(payload))).toEqual(['sid', 'role', 'iat', 'exp', 'sub']);
    expect(JSON.parse(payload)).toMatchObject({ role: 'ADMIN', sub: '45' });
    expect(JSON.parse(payload).exp - JSON.parse(payload).iat).toBe(3600);
    expect(lecture).toContain('지난 시간에 201자였던 jaehoon의 토큰은 이제 220자예요');
    const table = fences(DOCS[0], '').find((b) => b.startsWith(' 보낸 사람'));
    expect(table.split('\n').slice(2).map((l) => l.trim().split(/\s{2,}/))).toEqual([
      ['jaehoon', '게시물 목록', '3', '3'],
      ['jaehoon', '나는 누구', '1', '1'],
      ['jaehoon', '사람 목록(403 에러)', '0', '0'],
      ['jaehoon', '남의 게시물 지우기(403 에러)', '1', '1'],
      ['admin.hong', '사람 목록', '1', '2'],
      ['admin.hong', '남의 게시물 지우기', '5', '6'],
    ]);
  });

  it('🔴 sql 블록 — 교안 차례대로 판정 DB 에서 실행하면 교안의 결과·에러와 같다', async () => {
    await freshGate();
    const lecture = read(DOCS[0]);
    const sqls = fences(DOCS[0], 'sql').filter((b) => !b.startsWith('-- CreateEnum'));
    expect(sqls).toEqual([
      'SELECT DISTINCT role FROM users;',
      "UPDATE users SET role = 'OWNER' WHERE username = 'jaehoon';",
      "SELECT username, role FROM users WHERE username = 'boram';",
      "SELECT id, username, role FROM users WHERE username = 'admin.hong';",
    ]);
    expect(await gate(sqls[0])).toEqual([{ role: 'USER' }]);
    await expect(gate(sqls[1])).rejects.toMatchObject({ message: 'invalid input value for enum user_role: "OWNER"' });
    expect(lecture).toContain('```\n   invalid input value for enum user_role: "OWNER"\n```');
    expect(lecture).toContain('```sql\n' + read(stepDir(2)(`prisma/migrations/${readdirSync(stepDir(2)('prisma/migrations')).find((n) => n.endsWith('_add_user_role'))}/migration.sql`)) + '```');
    expect(lecture).toContain(' id   username     role\n ==   ==========   ====\n 45   admin.hong   USER');
    expect(await gate(sqls[3])).toEqual([{ id: 45, username: 'admin.hong', role: 'USER' }]);
    expect(lecture).toContain(' username   role\n ========   ====\n boram      USER');
  }, 30000);

  it('🔴 json 블록 — 403 본문 · admin.hong 로그인 응답 · 지운 게시물은 «관리자가 고친 글»', () => {
    const jsons = fences(DOCS[0], 'json');
    expect(JSON.parse(jsons[0])).toEqual({ error: { code: 'NOT_POST_AUTHOR', message: '내가 쓴 게시물만 고치거나 지울 수 있어요' } });
    expect(JSON.parse(jsons[1])).toEqual({ data: { id: 45, username: 'admin.hong', profileImage: null, role: 'ADMIN' } });
    expect(jsons[2]).toContain('"content": "관리자가 고친 글"');
    expect(jsons[4]).toContain('"role": "ADMIN"');
  });
});
