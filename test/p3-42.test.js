// p3-42 「JWT 발급과 토큰 기반 인가」 게이트 — 백엔드
//
// `7-express-auth` 일곱째 회차다(`curriculum.md` 「`p3-42` 착수 결정」).
// Step 2~6 본문은 수업 백엔드, Step 7 은 수업 화면(`instagram-next/.verify` 가 본다), 실습·과제는 `lab/p3-42/`.
// Step 마다의 판은 커밋 제목의 «(Step N)» 표식으로 꺼낸다(그 커밋을 임시 폴더에 풀어 띄운다).
//
// 축 ② Step 2 — 비밀키 없이 만든 판은 로그인 500(secretOrPrivateKey must have a value) · 고친 판은 쿠키 둘 · 토큰 안의 sub·sid·1시간 · 비밀키가 없으면 서버가 안 뜬다
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, mkdtempSync, rmSync, cpSync, symlinkSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import pg from 'pg';
import { boot } from './helpers/boot.js';
import { roundDir } from './helpers/round.js';

const ROOT = new URL('../', import.meta.url);
const P = (rel) => new URL(rel, ROOT).pathname;
const read = (path) => readFileSync(path, 'utf8');
const ADMIN = { host: 'localhost', port: 5432, database: 'postgres', user: 'postgres', password: 'postgres' };
const TPL_DB = 'p342_tpl';
const GATE_DB = 'p342_gate';
const GATE_URL = `postgresql://postgres:postgres@localhost:5432/${GATE_DB}`;
const PORT = 3930;
const LAB_PORT = 3932;
const HW_PORT = 3934;

// 학생 파일은 이 회차 북마크 `code/p3-42` 을 풀어서 읽는다(없으면 작업트리 — 이 회차를 짓는 동안).
const ROUND = roundDir('code/p3-42');
const R = (rel) => join(ROUND.dir, rel);
const BEFORE = roundDir('code/p3-41');
const B = (rel) => join(BEFORE.dir, rel);
const LAB = (rel) => R(`lab/p3-42/${rel}`);

// 판정의 비밀키 — 학생처럼 무작위 32바이트를 base64url 로 적은 값(43자).
const SECRET = 'q2Xh0v9bGm4RkT7sYp1wLc8nZf3uJd6eHa5iVo0rQyE';
const env = { DATABASE_URL: GATE_URL, CORS_ORIGIN: 'http://localhost:3001', JWT_SECRET: SECRET };
const STUDENT_FILES = ['app.js', 'db.js', 'errors.js', 'responses.js', 'routes', 'controllers', 'services', 'middlewares', 'schemas', 'docs', 'package.json', 'requests', 'seed.js', 'data', 'prisma', 'prisma.config.js', 'lab/p3-42', '.env.example'];

const hasRef = (ref) => {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', ref], { cwd: P('.'), stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
};
const LINE = hasRef('refs/heads/code/p3-42') ? 'code/p3-42' : 'main';
const commitOf = (n) => {
  const log = execFileSync('git', ['log', '--format=%H %s', `code/p3-41..${LINE}`], { cwd: P('.'), encoding: 'utf8' });
  const hits = log.split('\n').filter((l) => / feat\(p3-42\): /.test(l) && l.endsWith(`(Step ${n})`));
  if (hits.length === 0) throw new Error(`(Step ${n}) 커밋이 없다`);
  return hits[0].split(' ')[0];
};
const dirs = [];
const stepDir = (n) => {
  const dir = mkdtempSync(join(tmpdir(), `p342-step${n}-`));
  const tar = execFileSync('git', ['archive', '--format=tar', commitOf(n)], { cwd: P('.'), maxBuffer: 1 << 28 });
  execFileSync('tar', ['-x', '-C', dir], { input: tar });
  dirs.push(dir);
  return (rel) => join(dir, rel);
};

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
/** 판정 DB 를 템플릿에서 새로 만든다 — 시드 다섯(비밀번호 «이름1234») · 게시물 다섯 · 세션 없음. */
const freshGate = () => admin(async (client) => {
  await kick(client, GATE_DB);
  await client.query(`DROP DATABASE IF EXISTS ${GATE_DB}`);
  await kick(client, TPL_DB);
  await client.query(`CREATE DATABASE ${GATE_DB} TEMPLATE ${TPL_DB}`);
});

/** 학생 폴더 모양의 임시 폴더에 그 판의 파일을 깐다. `edit(dir)` 로 띄우기 전에 파일을 고칠 수 있다. */
const studentDir = (from, edit) => {
  const dir = mkdtempSync(join(tmpdir(), 'p342-srv-'));
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

/** 쿠키를 이름마다 기억하는 요청 도우미 — 브라우저 하나나 httpYac 하나처럼(만료로 지우는 쿠키는 버린다). */
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
const node = (dir, file) => {
  try {
    return { code: 0, out: execFileSync(process.execPath, [file], { cwd: dir, encoding: 'utf8', env: { ...process.env, ...env }, stdio: 'pipe' }) };
  } catch (error) {
    return { code: error.status, out: `${error.stdout}${error.stderr}` };
  }
};

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
  for (const dir of readdirSync(R('prisma/migrations')).filter((name) => name !== 'migration_lock.toml').sort()) {
    await tpl.query(read(R(`prisma/migrations/${dir}/migration.sql`)));
  }
  await tpl.end();
  execFileSync(process.execPath, [R('seed.js')], {
    cwd: ROUND.dir, encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: `postgresql://postgres:postgres@localhost:5432/${TPL_DB}` },
  });
}, 120000);

afterAll(async () => {
  await admin(async (client) => {
    for (const name of [GATE_DB, TPL_DB]) {
      await kick(client, name);
      await client.query(`DROP DATABASE IF EXISTS ${name}`);
    }
  });
  ROUND.cleanup();
  BEFORE.cleanup();
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});


const jwtLib = (await import('jsonwebtoken')).default;
const parts = (token) => token.split('.').slice(0, 2).map((part) => JSON.parse(Buffer.from(part, 'base64url').toString()));
const cookieLine = (res, name) => res.setCookies.find((line) => line.startsWith(`${name}=`));
/** 비밀키 없이 띄운다 — 학생이 .env 에 JWT_SECRET 을 아직 안 적은 상태. */
const noSecret = { ...env, JWT_SECRET: '' };

describe('축 ② Step 2 — 토큰을 만드는 곳과 비밀키', () => {
  const GUARD = "// 비밀키가 없으면 서버가 뜨지 않게 여기서 멈춘다 — 로그인할 때가 아니라 뜰 때 알게 된다.\nif (!SECRET) {\n  throw new Error('.env에 JWT_SECRET이 없어요');\n}\n\n";

  it('🔴 가드 없는 판(스냅숏) = Step 2 판에서 가드만 뺀 것 · 비밀키 없이 뜨고 로그인은 500(secretOrPrivateKey must have a value)', async () => {
    const S2 = stepDir(2);
    const snap = read(P('snapshots/p3-42.step2-no-guard.tokenService.js'));
    expect(read(S2('services/tokenService.js')).replace(GUARD, '')).toBe(snap);
    await freshGate();
    const dir = studentDir(S2, (d) => writeFileSync(join(d, 'services/tokenService.js'), snap));
    const srv = await boot(join(dir, 'app.js'), { port: PORT, cwd: dir, env: { ...noSecret, PORT: String(PORT) }, ready: `${PORT}번 포트에서` });
    try {
      const me = device(`http://localhost:${PORT}`);
      const login = await me.login('jaehoon');
      expect(login.status).toBe(500);
      expect(login.body).toEqual({ error: { code: 'INTERNAL_ERROR', message: '서버에서 문제가 생겼어요' } });
      expect(srv.tail()).toContain('Error: secretOrPrivateKey must have a value');
      expect(srv.tail()).toContain('POST /api/v2/auth/login 500 ');
    } finally {
      await stop(srv);
    }
  }, 30000);

  it('🔴 Step 2 판 — 로그인하면 쿠키 둘(sessionId 그대로 + accessToken 1시간) · 토큰 안에 sub·sid · 서명은 HS256', async () => {
    const S2 = stepDir(2);
    await freshGate();
    await withServer(S2, async ({ base }) => {
      const me = device(base);
      const login = await me.login('jaehoon');
      expect(login.status).toBe(200);
      expect(login.body).toEqual({ data: { id: 2, username: 'jaehoon', profileImage: 'https://picsum.photos/seed/jaehoon/40/40' } });
      expect(cookieLine(login, 'sessionId')).toMatch(/^sessionId=[0-9a-f-]{36}; Max-Age=604800; Path=\/; Expires=.+; HttpOnly; SameSite=Lax$/);
      expect(cookieLine(login, 'accessToken')).toMatch(/^accessToken=[\w-]+\.[\w-]+\.[\w-]+; Max-Age=3600; Path=\/; Expires=.+; HttpOnly; SameSite=Lax$/);
      const token = me.cookie('accessToken');
      const [header, payload] = parts(token);
      expect(header).toEqual({ alg: 'HS256', typ: 'JWT' });
      expect(Object.keys(payload)).toEqual(['sid', 'iat', 'exp', 'sub']);
      expect(payload.sub).toBe('2');
      expect(payload.exp - payload.iat).toBe(3600);
      expect(payload.sid).toBe(me.cookie('sessionId'));
      expect(await gate('SELECT id, user_id FROM sessions')).toEqual([{ id: payload.sid, user_id: 2 }]);
      expect(jwtLib.verify(token, SECRET, { algorithms: ['HS256'] }).sub).toBe('2');
      // 로그인 확인은 아직 세션 — 쿠키 둘을 함께 보내면 지나간다
      expect((await me.get('/api/v2/posts?limit=1')).status).toBe(200);
      // 응답 본문에는 토큰이 없다
      expect(JSON.stringify(login.body)).not.toContain(token);
    });
  }, 30000);

  it('🔴 Step 2 판 — 비밀키 없이 띄우면 서버가 뜨지 않는다(우리 문장) · .env.example 에 JWT_SECRET 줄', async () => {
    const S2 = stepDir(2);
    const dir = studentDir(S2);
    let out;
    try {
      execFileSync(process.execPath, ['app.js'], { cwd: dir, env: { ...process.env, ...noSecret, PORT: String(PORT) }, encoding: 'utf8', stdio: 'pipe', timeout: 8000 });
      out = { code: 0 };
    } catch (error) {
      out = { code: error.status, text: `${error.stdout}${error.stderr}` };
    }
    expect(out.code).toBe(1);
    expect(out.text).toContain(`${dir}/services/tokenService.js:8`);
    expect(out.text).toContain("  throw new Error('.env에 JWT_SECRET이 없어요');");
    expect(out.text).toContain('Error: .env에 JWT_SECRET이 없어요');
    expect(read(S2('.env.example'))).toBe('# ~/instagram-api/.env.example\n# 이 파일은 «이름만» 알려줘요. 값은 각자 자기 것을 .env에 적으세요.\nDATABASE_URL=\nCORS_ORIGIN=\nJWT_SECRET=\n');
  }, 30000);
});
