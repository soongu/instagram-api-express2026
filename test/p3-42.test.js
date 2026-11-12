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
      await sleep(300);
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
    // 첫 줄이 그 파일의 9번째 줄을 가리키고, 그 줄과 ^ 표시, 에러 문장이 이어진다
    expect(out.text).toMatch(/^file:\/\/\/.+\/services\/tokenService\.js:9\n  throw new Error\('\.env에 JWT_SECRET이 없어요'\);\n        \^\n\nError: \.env에 JWT_SECRET이 없어요\n/);
    expect(out.text).toMatch(/\nNode\.js v24\.\d+\.\d+\n$/);
    expect(read(S2('.env.example'))).toBe('# ~/instagram-api/.env.example\n# 이 파일은 «이름만» 알려줘요. 값은 각자 자기 것을 .env에 적으세요.\nDATABASE_URL=\nCORS_ORIGIN=\nJWT_SECRET=\n');
  }, 30000);
});

/** db.js 에 log: ['query'] 를 켠다 — 교안 오프닝·Step 4 가 학생에게 시키는 그 한 줄. */
const queryLog = (d) => replaceIn(d, 'db.js', 'new PrismaClient({ adapter });', "new PrismaClient({ adapter, log: ['query'] });");
const sessionsLines = (text) => text.split('\n').filter((l) => l.startsWith('prisma:query') && l.includes('"public"."sessions"'));

describe('축 ④ Step 4 — requireLogin 의 안쪽', () => {
  it('🔴 Step 2 판은 목록 요청마다 sessions 를 한 번 찾는다 · Step 4 판은 0번(로그인할 때 INSERT 하나만)', async () => {
    for (const [n, perRequest] of [[2, 1], [4, 0]]) {
      await freshGate();
      await withServer(stepDir(n), async ({ base, tail }) => {
        const me = device(base);
        await me.login('jaehoon');
        await sleep(200);
        const before = sessionsLines(tail()).length;
        expect(before).toBe(1); // 로그인 — INSERT
        for (let i = 0; i < 3; i += 1) expect((await me.get('/api/v2/posts?limit=2')).status).toBe(200);
        await sleep(200);
        expect(sessionsLines(tail()).length - before).toBe(3 * perRequest);
      }, { edit: queryLog });
    }
  }, 40000);

  it('🔴 Step 4 판 — 로그인 쿠키는 accessToken 하나 · 세션 행은 남긴다 · Bearer 로도 · 고친 쿠키·숫자 Bearer 는 401', async () => {
    const S4 = stepDir(4);
    await freshGate();
    await withServer(S4, async ({ base }) => {
      const me = device(base);
      const login = await me.login('jaehoon');
      expect(login.setCookies.map((l) => l.split('=')[0])).toEqual(['accessToken']);
      const token = me.cookie('accessToken');
      expect(await gate('SELECT id, user_id FROM sessions')).toEqual([{ id: parts(token)[1].sid, user_id: 2 }]);
      expect((await me.get('/api/v2/auth/me')).body).toEqual({ data: { id: 2, username: 'jaehoon', profileImage: 'https://picsum.photos/seed/jaehoon/40/40' } });
      const anon = device(base);
      expect((await anon.get('/api/v2/posts?limit=1', anon.bearer(token))).status).toBe(200);
      expect((await anon.get('/api/v2/auth/me', anon.bearer(token))).status).toBe(200);
      expect(await anon.get('/api/v2/auth/me')).toMatchObject({ status: 401, body: { error: { code: 'LOGIN_REQUIRED' } } });
      expect((await anon.get('/api/v2/auth/me', { Cookie: 'accessToken=1' })).status).toBe(401);
      expect((await anon.get('/api/v2/auth/me', anon.bearer('3'))).status).toBe(401);
      // 옛 세션 쿠키는 이제 아무것도 아니다
      expect((await anon.get('/api/v2/posts?limit=1', { Cookie: `sessionId=${parts(token)[1].sid}` })).status).toBe(401);
    });
    expect(read(S4('services/sessionService.js'))).not.toContain('getUserId');
  }, 30000);

  it('🔴 Step 4 판 — 토큰은 살아 있는데 그 사람이 지워졌으면 나는 누구는 401', async () => {
    await freshGate();
    await withServer(stepDir(4), async ({ base }) => {
      const me = device(base);
      expect((await me.send('POST', '/api/v2/auth/signup', { emailOrPhone: 'gone@example.com', name: '지울사람', username: 'gone', password: 'gone12345' })).status).toBe(201);
      await me.login('gone', 'gone12345');
      expect((await me.get('/api/v2/auth/me')).status).toBe(200);
      await gate(`DELETE FROM users WHERE username = 'gone'`);
      expect(await gate('SELECT count(*)::int AS n FROM sessions')).toEqual([{ n: 0 }]);
      expect(await me.get('/api/v2/auth/me')).toMatchObject({ status: 401, body: { error: { code: 'LOGIN_REQUIRED' } } });
    });
  }, 30000);

  it('🔴 Step 4 판 — 로그아웃은 토큰의 sid 행을 지우고 쿠키를 지운다 · 토큰 없이 로그아웃해도 200(아무것도 안 지운다)', async () => {
    await freshGate();
    await withServer(stepDir(4), async ({ base }) => {
      const [a, b] = [device(base), device(base)];
      await a.login('jaehoon');
      await b.login('jaehoon');
      expect((await device(base).send('POST', '/api/v2/auth/logout')).status).toBe(200);
      expect(await gate('SELECT count(*)::int AS n FROM sessions')).toEqual([{ n: 2 }]);
      const sid = parts(a.cookie('accessToken'))[1].sid;
      const out = await a.send('POST', '/api/v2/auth/logout');
      expect(out.body).toEqual({ data: { message: '로그아웃했어요' } });
      expect(out.setCookies).toEqual(['accessToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT']);
      expect(await gate('SELECT id FROM sessions WHERE id = $1', [sid])).toEqual([]);
      expect(await gate('SELECT count(*)::int AS n FROM sessions')).toEqual([{ n: 1 }]);
      const all = await b.send('POST', '/api/v2/auth/logout-all');
      expect(all.setCookies).toEqual(['accessToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT']);
      expect(await gate('SELECT count(*)::int AS n FROM sessions')).toEqual([{ n: 0 }]);
    });
  }, 30000);
});

describe('축 ⑤ Step 5 — 서버가 막는 토큰', () => {
  const run = async (n) => {
    await freshGate();
    let out;
    await withServer(stepDir(n), async () => {
      const dir = studentDir(stepDir(n), (d) => replaceIn(d, 'lab/p3-42/check-tokens.js', 'http://localhost:3000', `http://localhost:${PORT}`));
      out = node(dir, 'lab/p3-42/check-tokens.js');
    });
    return out;
  };

  it('🔴 Step 4 판 — 진짜와 HS512 가 200(헤더의 alg 를 서버가 그대로 따른다) · 나머지 넷은 401', async () => {
    expect(await run(4)).toEqual({ code: 0, out: '200  진짜 토큰\n401  페이로드만 바꾼 토큰\n401  다른 비밀키로 만든 토큰\n401  알고리즘을 none으로 바꾼 토큰\n200  HS512로 만든 토큰\n401  기한이 지난 토큰\n' });
  }, 30000);

  it('🔴 Step 5 판 — algorithms 를 HS256 하나로 정하면 HS512 도 401', async () => {
    expect(await run(5)).toEqual({ code: 0, out: '200  진짜 토큰\n401  페이로드만 바꾼 토큰\n401  다른 비밀키로 만든 토큰\n401  알고리즘을 none으로 바꾼 토큰\n401  HS512로 만든 토큰\n401  기한이 지난 토큰\n' });
    expect(read(stepDir(5)('services/tokenService.js'))).toContain("    return jwt.verify(token, SECRET, { algorithms: ['HS256'] });");
  }, 30000);
});

describe('축 ⑥ Step 6 — 로그아웃이 달라진다', () => {
  const blocks = () => read(R('requests/logout.http')).split(/^### /m).slice(1).map((chunk) => {
    const lines = chunk.split('\n');
    return { title: lines[0], text: lines.slice(1).join('\n') };
  });

  it('🔴 logout.http 차례 — 로그인 200 · 로그아웃 200(행이 지워진다) · 쿠키 없이 401 · 복사해 둔 토큰은 200', async () => {
    await freshGate();
    await withServer(stepDir(6), async ({ base }) => {
      const http = device(base);
      const titles = [];
      let copied;
      for (const { title, text } of blocks()) {
        titles.push(title);
        const [first, ...rest] = text.split('\n').filter((l) => !l.startsWith('#'));
        const [method, url] = first.split(' ');
        const path = url.replace('http://localhost:3000', '');
        if (title === '로그인') {
          const res = await http.send(method, path, JSON.parse(rest.slice(rest.indexOf('') + 1).join('\n')));
          expect(res.status).toBe(200);
          copied = http.cookie('accessToken');
          expect(await gate('SELECT count(*)::int AS n FROM sessions')).toEqual([{ n: 1 }]);
        } else if (title === '복사해 둔 토큰으로 게시물 목록') {
          expect(rest[0]).toBe('Authorization: Bearer COPIED_TOKEN');
          expect(text).toContain('# @no-cookie-jar\n');
          // 자리표시 그대로면 401, 복사해 둔 토큰을 붙여 넣으면 200
          expect((await device(base).get(path, { Authorization: 'Bearer COPIED_TOKEN' })).status).toBe(401);
          const res = await device(base).get(path, { Authorization: `Bearer ${copied}` });
          expect(res.status).toBe(200);
          expect(res.body.data.items).toHaveLength(1);
        } else {
          const res = await http.send(method, path);
          expect(res.status).toBe(title === '로그아웃' ? 200 : 401);
          if (title === '로그아웃') expect(await gate('SELECT count(*)::int AS n FROM sessions')).toEqual([{ n: 0 }]);
        }
      }
      expect(titles).toEqual(['로그인', '로그아웃', '로그아웃한 뒤 게시물 목록', '복사해 둔 토큰으로 게시물 목록']);
    });
  }, 30000);

  it('🔴 모든 기기에서 로그아웃 — 행은 모두 지워지는데 다른 기기의 토큰은 그대로 200 · 나는 누구도 200', async () => {
    await freshGate();
    await withServer(stepDir(6), async ({ base }) => {
      const [chrome, http] = [device(base), device(base)];
      await chrome.login('jaehoon');
      await http.login('jaehoon');
      expect((await http.send('POST', '/api/v2/auth/logout-all')).body).toEqual({ data: { message: '모든 기기에서 로그아웃했어요' } });
      expect(await gate('SELECT count(*)::int AS n FROM sessions')).toEqual([{ n: 0 }]);
      expect((await chrome.get('/api/v2/posts?limit=1')).status).toBe(200);
      expect((await chrome.get('/api/v2/auth/me')).status).toBe(200);
      expect((await http.get('/api/v2/posts?limit=1')).status).toBe(401);
    });
  }, 30000);
});
