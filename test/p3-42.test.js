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

/** .http 파일을 요청 덩어리로 — 제목 · `# @no-cookie-jar` · 요청 줄 · 헤더 · 본문. */
const httpBlocks = (file) => read(file).split(/^### /m).slice(1).map((chunk) => {
  const lines = chunk.replace(/\n+$/, '').split('\n');
  const title = lines.shift();
  const noJar = lines.includes('# @no-cookie-jar');
  const rest = lines.filter((l) => !l.startsWith('#'));
  const [method, url] = rest.shift().split(' ');
  const headers = {};
  while (rest.length && rest[0] !== '') {
    const line = rest.shift();
    const at = line.indexOf(': ');
    headers[line.slice(0, at)] = line.slice(at + 2);
  }
  const body = rest.join('\n').trim();
  return { title, noJar, method, url, headers, body: body === '' ? undefined : body };
});
/** 한 덩어리를 보낸다 — `swap` 으로 자리표시를 바꾸고, 쿠키 단지는 `jar`(device) 를 쓴다. */
const sendBlock = async (block, jar, { port, swap = {} } = {}) => {
  const fill = (text) => Object.entries(swap).reduce((t, [k, v]) => t.replaceAll(k, v), text);
  const url = new URL(fill(block.url));
  url.port = String(port);
  const headers = Object.fromEntries(Object.entries(block.headers).map(([k, v]) => [k, fill(v)]));
  const target = block.noJar ? device(url.origin) : jar;
  return target.send(block.method, `${url.pathname}${url.search}`, block.body === undefined ? undefined : JSON.parse(block.body), headers);
};
/** 실습 서버 하나를 학생 폴더 모양으로 띄운다 — 포트만 판정 포트로 바꾼다. */
const labServer = async (file, port, extraEnv, edit) => {
  const dir = studentDir(stepDir(6), (d) => {
    cpSync(LAB(file), join(d, `lab/p3-42/${file}`));
    replaceIn(d, `lab/p3-42/${file}`, /app\.listen\((40\d\d)/.exec(read(LAB(file)))[0], `app.listen(${port}`);
    if (edit) edit(d);
  });
  const srv = await boot(join(dir, `lab/p3-42/${file}`), { port, cwd: dir, env: { ...env, ...extraEnv }, ready: '포트에서' });
  return { srv, dir, base: `http://localhost:${port}` };
};

describe('축 ⑦ 직접 해보기 1 — DB 없이 토큰을 확인하는 공지 서버', () => {
  const run = async (edit) => {
    await freshGate();
    const result = {};
    await withServer(stepDir(6), async ({ base }) => {
      const http = device(base);
      await http.login('jaehoon');
      const token = http.cookie('accessToken');
      const lab = await labServer('practice1.js', LAB_PORT, {}, edit);
      try {
        const [list, anon, posted] = httpBlocks(LAB('practice1.http'));
        const jar = device(lab.base);
        result.list = await sendBlock(list, jar, { port: LAB_PORT });
        result.anon = await sendBlock(anon, jar, { port: LAB_PORT });
        result.posted = await sendBlock(posted, jar, { port: LAB_PORT, swap: { COPIED_TOKEN: token } });
        // 수업 서버에서 로그아웃해도
        await http.send('POST', '/api/v2/auth/logout-all');
        result.afterLogout = await sendBlock(posted, jar, { port: LAB_PORT, swap: { COPIED_TOKEN: token } });
        result.token = token;
        result.lab = lab;
      } catch (error) {
        await stop(lab.srv);
        throw error;
      }
    });
    // 수업 서버를 끈 뒤에도
    const [, , posted] = httpBlocks(LAB('practice1.http'));
    result.serverOff = await sendBlock(posted, device(result.lab.base), { port: LAB_PORT, swap: { COPIED_TOKEN: result.token } });
    await stop(result.lab.srv);
    return result;
  };

  it('🔴 목록 200 · 토큰 없이 401 · 복사한 토큰 201(글쓴이 2) · 수업 서버에서 로그아웃해도 201 · 수업 서버를 꺼도 201', async () => {
    const r = await run();
    expect(r.list).toMatchObject({ status: 200, body: [{ id: 1, title: '서버 점검 안내', authorId: 1 }] });
    expect(r.anon).toMatchObject({ status: 401, body: { message: '로그인이 필요해요' } });
    expect(r.posted).toMatchObject({ status: 201, body: { id: 2, title: '이번 주 모임은 쉬어요', authorId: 2 } });
    expect(r.afterLogout).toMatchObject({ status: 201, body: { id: 3, authorId: 2 } });
    expect(r.serverOff).toMatchObject({ status: 201, body: { id: 4, authorId: 2 } });
    expect(read(LAB('practice1.js'))).not.toMatch(/db\.js|prisma|fetch\(/);
    // Step 4 판(교안 직접 해보기 1 해설)은 algorithms 가 없고, 끝 판은 Step 5 가 그 옵션 하나만 더한다
    expect(read(P('snapshots/p3-42.practice1-step4.practice1.js'))).toBe(read(LAB('practice1.js')).replace(", SECRET, { algorithms: ['HS256'] });", ', SECRET);'));
  }, 60000);

  it('🔴 틀린 판 둘 — 수업 서버의 나는 누구에 물어보는 판은 수업 서버를 끄면 실패 · Number 를 빠뜨리면 글쓴이가 "2"', async () => {
    const ask = (d) => replaceIn(d, 'lab/p3-42/practice1.js', "  try {\n    const payload = jwt.verify(header.slice('Bearer '.length), SECRET, { algorithms: ['HS256'] });\n    res.locals.userId = Number(payload.sub);\n    next();\n  } catch {\n    res.status(401).json({ message: '로그인이 필요해요' });\n  }",
      `  fetch('http://localhost:${PORT}/api/v2/auth/me', { headers: { Authorization: header } })\n    .then(async (response) => {\n      if (!response.ok) return res.status(401).json({ message: '로그인이 필요해요' });\n      res.locals.userId = (await response.json()).data.id;\n      next();\n    })\n    .catch(next);`);
    const asked = await run(ask);
    expect(asked.posted.status).toBe(201);
    expect(asked.serverOff.status).toBe(500);
    const noNumber = await run((d) => replaceIn(d, 'lab/p3-42/practice1.js', 'res.locals.userId = Number(payload.sub);', 'res.locals.userId = payload.sub;'));
    expect(noNumber.posted.body.authorId).toBe('2');
  }, 90000);
});

describe('축 ⑧ 직접 해보기 2 — 비밀키 바꾸기', () => {
  const KEY1 = 'kW3m9Qe1Zt7Rb2Xy5Nc8Lp4Vh6Js0Ga1Df3Hk7Mn9Qr';
  const KEY2 = 'Tz8Yc2Wd5Fe1Gh7Jk3Lm9Np4Qr6St0Uv2Wx5Yz8Ab1C';
  const scenario = async (edit) => {
    const [login, first, second] = httpBlocks(LAB('practice2.http'));
    let lab = await labServer('practice2.js', LAB_PORT, { LAB_SECRET: KEY1, LAB_OLD_SECRET: '' }, edit);
    const jar = device(lab.base);
    const out = {};
    try {
      const a = (await sendBlock(login, jar, { port: LAB_PORT })).body.token;
      out.firstBefore = (await sendBlock(first, jar, { port: LAB_PORT, swap: { FIRST_TOKEN: a } })).status;
      await stop(lab.srv);
      lab = await labServer('practice2.js', LAB_PORT, { LAB_SECRET: KEY2, LAB_OLD_SECRET: KEY1 }, edit);
      out.firstDuring = (await sendBlock(first, jar, { port: LAB_PORT, swap: { FIRST_TOKEN: a } })).status;
      const b = (await sendBlock(login, jar, { port: LAB_PORT })).body.token;
      out.secondDuring = (await sendBlock(second, jar, { port: LAB_PORT, swap: { SECOND_TOKEN: b } })).status;
      out.secondAlg = parts(b)[0].alg;
      await stop(lab.srv);
      lab = await labServer('practice2.js', LAB_PORT, { LAB_SECRET: KEY2, LAB_OLD_SECRET: '' }, edit);
      out.firstAfter = (await sendBlock(first, jar, { port: LAB_PORT, swap: { FIRST_TOKEN: a } })).status;
      out.secondAfter = (await sendBlock(second, jar, { port: LAB_PORT, swap: { SECOND_TOKEN: b } })).status;
    } finally {
      await stop(lab.srv);
    }
    return out;
  };

  it('🔴 첫 토큰은 바꾸는 동안 200 · 옛 키를 빼면 401 · 둘째 토큰은 내내 200', async () => {
    expect(await scenario()).toEqual({ firstBefore: 200, firstDuring: 200, secondDuring: 200, secondAlg: 'HS256', firstAfter: 401, secondAfter: 200 });
  }, 60000);

  it('🔴 틀린 판 둘 — 옛 키를 안 보는 판은 바꾸자마자 401 · 옛 키로 만드는 판은 옛 키를 빼면 둘째도 401', async () => {
    expect((await scenario((d) => replaceIn(d, 'lab/p3-42/practice2.js', 'for (const secret of [SECRET, OLD_SECRET])', 'for (const secret of [SECRET])'))).firstDuring).toBe(401);
    expect((await scenario((d) => replaceIn(d, 'lab/p3-42/practice2.js', 'const token = jwt.sign({}, SECRET,', 'const token = jwt.sign({}, OLD_SECRET ?? SECRET,'))).secondAfter).toBe(401);
  }, 90000);
});

describe('축 ⑨ 직접 해보기 3 — 차단 목록', () => {
  const KEY = 'kW3m9Qe1Zt7Rb2Xy5Nc8Lp4Vh6Js0Ga1Df3Hk7Mn9Qr';
  const scenario = async (edit) => {
    const [loginA, loginB, meA, logoutA, meB] = httpBlocks(LAB('practice3.http'));
    const lab = await labServer('practice3.js', LAB_PORT, { LAB_SECRET: KEY }, edit);
    const jar = device(lab.base);
    try {
      const a = (await sendBlock(loginA, jar, { port: LAB_PORT })).body.token;
      const b = (await sendBlock(loginB, jar, { port: LAB_PORT })).body.token;
      const swap = { TOKEN_A: a, TOKEN_B: b };
      return {
        jtiDiffers: parts(a)[1].jti !== parts(b)[1].jti,
        meA: (await sendBlock(meA, jar, { port: LAB_PORT, swap })).status,
        logoutA: (await sendBlock(logoutA, jar, { port: LAB_PORT, swap })).status,
        meAAgain: await sendBlock(meA, jar, { port: LAB_PORT, swap }),
        meB: (await sendBlock(meB, jar, { port: LAB_PORT, swap })).status,
      };
    } finally {
      await stop(lab.srv);
    }
  };

  it('🔴 A 200 → A 로그아웃 → 복사해 둔 A 는 401(로그아웃한 토큰이에요) · B 는 그대로 200', async () => {
    const r = await scenario();
    expect(r).toMatchObject({ jtiDiffers: true, meA: 200, logoutA: 200, meB: 200 });
    expect(r.meAAgain).toMatchObject({ status: 401, body: { message: '로그아웃한 토큰이에요' } });
  }, 30000);

  it('🔴 틀린 판 — 사람(sub)으로 막는 판은 B 까지 401', async () => {
    const bySub = (d) => {
      replaceIn(d, 'lab/p3-42/practice3.js', 'if (revoked.has(payload.jti)) {', 'if (revoked.has(payload.sub)) {');
      replaceIn(d, 'lab/p3-42/practice3.js', 'revoked.set(jti, exp);', 'revoked.set(res.locals.payload.sub, exp);');
    };
    expect((await scenario(bySub)).meB).toBe(401);
  }, 30000);
});

describe('축 ⑩ 과제', () => {
  const CLUB = 'Hd4Kf7Lp1Mq3Nr6Ts9Uv2Wx5Yz8Ab0Cd3Ef6Gh9Ij2K';
  const runHw1 = async (edit) => {
    await freshGate();
    const out = [];
    await withServer(stepDir(6), async ({ base }) => {
      const http = device(base);
      await http.login('jaehoon');
      const classToken = http.cookie('accessToken');
      const lab = await labServer('homework1.js', HW_PORT, { CLUB_SECRET: CLUB }, edit);
      try {
        const jar = device(lab.base);
        let copied;
        for (const block of httpBlocks(LAB('homework1.http'))) {
          const res = await sendBlock(block, jar, { port: HW_PORT, swap: { COPIED_TOKEN: copied ?? '', CLASS_TOKEN: classToken } });
          if (block.title === '로그인') {
            copied = jar.cookie('clubToken');
            // sub 는 회원 번호(1)이고 이메일은 담지 않는다 · 30분
            const [, payload] = parts(copied);
            expect(payload.sub).toBe('1');
            expect(JSON.stringify(payload)).not.toContain('bomi');
            expect(payload.exp - payload.iat).toBe(1800);
          }
          if (block.title === '나는 누구') expect(res.body).toEqual({ email: 'bomi@example.com' });
          out.push([block.title, res.status]);
        }
      } finally {
        await stop(lab.srv);
      }
    });
    return out;
  };

  it('🔴 [기초] 401 → 로그인 200 → 로그아웃 뒤 401 · 복사해 둔 쿠키는 200(세션 판은 401) · 수업 서버의 토큰은 401', async () => {
    expect(await runHw1()).toEqual([
      ['가입', 201], ['로그인하지 않고 회원 목록', 401], ['로그인', 200], ['회원 목록', 200], ['나는 누구', 200],
      ['로그아웃', 200], ['로그아웃한 뒤 회원 목록', 401], ['복사해 둔 쿠키로 회원 목록', 200], ['수업 백엔드의 토큰으로 회원 목록', 401],
    ]);
  }, 60000);

  it('🔴 [기초] 틀린 판 — 수업 서버의 JWT_SECRET 을 함께 쓰면 수업 서버의 토큰이 동아리 회원 목록을 연다', async () => {
    const shared = await runHw1((d) => replaceIn(d, 'lab/p3-42/homework1.js', 'const SECRET = process.env.CLUB_SECRET;', 'const SECRET = process.env.JWT_SECRET;'));
    expect(shared.at(-1)).toEqual(['수업 백엔드의 토큰으로 회원 목록', 200]);
  }, 60000);

  const runHw2 = async (edit) => {
    const lab = await labServer('homework2.js', HW_PORT + 1, { CLUB_SECRET: CLUB }, edit);
    const out = [];
    try {
      const jar = device(lab.base);
      let other;
      for (const block of httpBlocks(LAB('homework2.http'))) {
        const res = await sendBlock(block, jar, { port: HW_PORT + 1, swap: { OTHER_TOKEN: other ?? '' } });
        if (block.title === '로그인 — 다른 기기') other = cookieLine(res, 'clubToken').split(';')[0].split('=')[1];
        if (block.title === '나는 누구 — 비밀번호를 바꾼 이 기기' && res.status === 200) expect(res.body).toEqual({ email: 'bomi@example.com' });
        out.push([block.title, res.status]);
      }
    } finally {
      await stop(lab.srv);
    }
    return out;
  };

  it('🔴 [응용] 지금 비밀번호 확인 · 이 기기는 남고 다른 기기는 401 · 옛 비밀번호 401 · 새 비밀번호 200', async () => {
    expect(await runHw2()).toEqual([
      ['가입', 201], ['로그인 — 다른 기기', 200], ['로그인 — 이 기기', 200], ['지금 비밀번호를 틀리게 보내면', 400], ['비밀번호 바꾸기', 200],
      ['나는 누구 — 비밀번호를 바꾼 이 기기', 200], ['나는 누구 — 다른 기기', 401], ['옛 비밀번호로 로그인', 401], ['새 비밀번호로 로그인', 200],
    ]);
  }, 60000);

  it('🔴 [응용] 틀린 판 둘 — 이 기기에 새 토큰을 안 주면 이 기기도 401 · 버전을 안 올리면 다른 기기가 200', async () => {
    const noNew = await runHw2((d) => replaceIn(d, 'lab/p3-42/homework2.js', '  member.tokenVersion += 1;\n  giveToken(res, member);\n', '  member.tokenVersion += 1;\n'));
    expect(noNew.find(([t]) => t === '나는 누구 — 비밀번호를 바꾼 이 기기')[1]).toBe(401);
    const noBump = await runHw2((d) => replaceIn(d, 'lab/p3-42/homework2.js', '  member.tokenVersion += 1;\n', ''));
    expect(noBump.find(([t]) => t === '나는 누구 — 다른 기기')[1]).toBe(200);
  }, 90000);
});

describe('축 ⑪ 교안·답안의 코드 블록과 출력은 실제와 같다', () => {
  const TRACK_DIR = new URL('../../', ROOT).pathname;
  const DOCS = ['part3/7-express-auth/p3-42-jwt-token-authorization-lecture.md', 'part3/7-express-auth/p3-42-jwt-token-authorization-answers.md'].map((f) => join(TRACK_DIR, f));
  const fences = (file, lang) => {
    const out = [];
    let open = null;
    let openLang = null;
    for (const line of read(file).split('\n')) {
      if (line.startsWith('```')) {
        if (open) { if (openLang === lang) out.push(open); open = null; } else { open = []; openLang = line.slice(3); }
      } else if (open) open.push(line);
    }
    return out;
  };
  const showAt = (ref, rel) => {
    try {
      return execFileSync('git', ['show', `${ref}:${rel}`], { cwd: P('.'), encoding: 'utf8', stdio: 'pipe' });
    } catch {
      return null;
    }
  };
  const versions = (rel) => [
    existsSync(R(rel)) ? read(R(rel)) : null,
    ...[2, 4, 5, 6].map((n) => showAt(commitOf(n), rel)),
    rel === 'services/tokenService.js' ? read(P('snapshots/p3-42.step2-no-guard.tokenService.js')) : null,
    rel === 'lab/p3-42/practice1.js' ? read(P('snapshots/p3-42.practice1-step4.practice1.js')) : null,
  ].filter(Boolean);
  const meaningful = (b) => b.filter((l) => l.trim() !== '' && l.trim() !== '...');
  const fenceOf = (startsWith) => fences(DOCS[0], '').find((b) => b[0]?.startsWith(startsWith));
  const normalize = (text, dir) => text.replaceAll(`/private${dir}`, dir).replaceAll(`file://${dir}`, 'file:///Users/hong/instagram-api').replaceAll(dir, '/Users/hong/instagram-api')
    .replaceAll(P('node_modules'), '/Users/hong/instagram-api/node_modules').replaceAll(`/private${tmpdir()}`, tmpdir());

  it('🔴 javascript 블록마다 한 버전에 줄이 모두 있다(수업 화면 블록은 instagram-next/.verify 가 본다)', () => {
    const all = DOCS.flatMap((d) => fences(d, 'javascript')).filter((b) => (b[0] ?? '').startsWith('// ~/instagram-api/'));
    expect(all.length).toBeGreaterThanOrEqual(15);
    for (const b of all) {
      const rel = b[0].replace('// ~/instagram-api/', '');
      expect(versions(rel).some((text) => meaningful(b).every((l) => text.split('\n').includes(l))), `${rel}\n${meaningful(b).join('\n')}`).toBe(true);
    }
  }, 30000);

  it('🔴 http 블록은 그 파일과 같다 · .env.example 블록도', () => {
    const files = ['requests/logout.http', ...readdirSync(LAB('.')).filter((f) => f.endsWith('.http')).map((f) => `lab/p3-42/${f}`)].map((rel) => read(R(rel)).trimEnd());
    const blocks = DOCS.flatMap((d) => fences(d, 'http'));
    expect(blocks).toHaveLength(6);
    for (const b of blocks) expect(files, b.join('\n')).toContain(b.join('\n').trimEnd());
    expect(fenceOf('# ~/instagram-api/.env.example').join('\n')).toBe(read(R('.env.example')).trimEnd());
  });

  it('🔴 Step 2 — 가드 없는 판의 500 에러 줄 · 가드가 있는 판에서 비밀키 줄을 주석으로 바꾸면 찍히는 줄', async () => {
    // 500 에러 — 학생처럼 npm run dev(--watch --env-file)로 띄우고 auth.http 의 «로그인»(옛 주소)을 보낸다
    const dir = studentDir(stepDir(2), (d) => writeFileSync(join(d, 'services/tokenService.js'), read(P('snapshots/p3-42.step2-no-guard.tokenService.js'))));
    writeFileSync(join(dir, '.env'), `DATABASE_URL="${GATE_URL}"\nCORS_ORIGIN=http://localhost:3001\nPORT=${PORT}\n`);
    await freshGate();
    const cleanEnv = { ...process.env };
    for (const k of ['NODE_ENV', 'VITEST', 'DATABASE_URL', 'CORS_ORIGIN', 'PORT', 'JWT_SECRET']) delete cleanEnv[k];
    const { spawn } = await import('node:child_process');
    const child = spawn(process.execPath, ['--watch', '--env-file=.env', 'app.js'], { cwd: dir, env: cleanEnv });
    let out = '';
    child.stdout.on('data', (b) => { out += b; });
    child.stderr.on('data', (b) => { out += b; });
    const until = async (cond, ms = 15000) => { const t0 = Date.now(); while (!cond()) { if (Date.now() - t0 > ms) throw new Error(out); await sleep(100); } };
    try {
      await until(() => out.includes('기다리고 있어요'));
      const res = await fetch(`http://localhost:${PORT}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'jaehoon', password: 'jaehoon1234' }) });
      expect(res.status).toBe(500);
      await until(() => out.includes('POST /api/auth/login 500'));
      const error = normalize(out.slice(out.indexOf('Error: secretOrPrivateKey')), dir).trimEnd().split('\n');
      const fence = fenceOf('Error: secretOrPrivateKey');
      expect(error.slice(0, 6)).toEqual(fence.slice(0, 6));
      expect(error[6]).toMatch(/^POST \/api\/auth\/login 500 [\d.]+ms$/);
      expect(fence[6]).toMatch(/^POST \/api\/auth\/login 500 [\d.]+ms$/);
      // 가드를 넣고(Step 2 판), 비밀키를 적고, 그 줄을 주석으로 바꾼다
      writeFileSync(join(dir, '.env'), `${read(join(dir, '.env'))}JWT_SECRET=${SECRET}\n`);
      await until(() => out.split('기다리고 있어요').length > 2);
      cpSync(stepDir(2)('services/tokenService.js'), join(dir, 'services/tokenService.js'));
      await until(() => out.split('기다리고 있어요').length > 3);
      const mark = out.length;
      writeFileSync(join(dir, '.env'), read(join(dir, '.env')).replace('JWT_SECRET=', '# JWT_SECRET='));
      await until(() => out.slice(mark).includes('Waiting for file changes'));
      const guard = normalize(out.slice(mark), dir).trimEnd().split('\n');
      const restarts = fences(DOCS[0], '').filter((f) => f[0] === "Change detected in '/Users/hong/instagram-api/.env'");
      // 첫째는 비밀키를 적고 저장했을 때의 두 줄, 둘째는 주석으로 바꿨을 때의 줄 전부
      expect(restarts[0]).toEqual(guard.slice(0, 2));
      expect(guard).toEqual(restarts[1]);
    } finally {
      child.kill();
      await sleep(300);
    }
  }, 60000);

  it('🔴 Step 3 — 교안의 node -p 명령으로 토큰 가운데를 읽으면 sid·iat·exp·sub 한 줄 · 토큰은 201자', async () => {
    await freshGate();
    await withServer(stepDir(2), async ({ base }) => {
      const me = device(base);
      await me.login('jaehoon');
      const token = me.cookie('accessToken');
      expect(token).toHaveLength(201);
      const cmd = fences(DOCS[0], 'bash').find((b) => b[0].startsWith('node -p "Buffer.from(process.argv[1]'))[0];
      expect(cmd).toBe('node -p "Buffer.from(process.argv[1].split(\'.\')[1], \'base64url\').toString()" 복사한-토큰');
      const code = cmd.slice('node -p "'.length, cmd.lastIndexOf('"'));
      const out = execFileSync(process.execPath, ['-p', code, token], { encoding: 'utf8' }).trim();
      const shape = /^\{"sid":"[0-9a-f-]{36}","iat":(\d{10}),"exp":(\d{10}),"sub":"2"\}$/;
      expect(out).toMatch(shape);
      const [, iat, exp] = out.match(shape);
      expect(Number(exp) - Number(iat)).toBe(3600);
      expect(fenceOf('{"sid":')[0]).toMatch(shape);
      // 글자 수를 세는 둘째 명령도 교안 그대로 실행한다
      const lengthCmd = fences(DOCS[0], 'bash').find((b) => b[0].startsWith('node -p "process.argv[1].length"'))[0];
      expect(lengthCmd).toBe('node -p "process.argv[1].length" 복사한-토큰');
      expect(execFileSync(process.execPath, ['-p', 'process.argv[1].length', token], { encoding: 'utf8' }).trim()).toBe('201');
    });
  }, 30000);

  it('🔴 Step 4 — grep 은 정의 한 줄 · 게시물 목록 요청의 쿼리 셋에 sessions 가 없다', async () => {
    const dir = studentDir(stepDir(4), (d) => cpSync(B('services/sessionService.js'), join(d, 'services/sessionService.js')));
    const out = execFileSync('/usr/bin/grep', ['-rn', 'getUserId', 'services', 'middlewares', 'controllers'], { cwd: dir, encoding: 'utf8' });
    expect(fenceOf('services/sessionService.js:22:')).toEqual([out.trimEnd()]);
    await freshGate();
    await withServer(stepDir(4), async ({ base, tail }) => {
      const me = device(base);
      await me.login('jaehoon');
      await sleep(200);
      const mark = tail().length;
      expect((await me.get('/api/posts')).status).toBe(200);
      await sleep(300);
      const lines = tail().slice(mark).trim().split('\n');
      const fence = fenceOf('prisma:query SELECT "public"."posts"');
      expect(lines).toHaveLength(4);
      for (const [i, l] of fence.entries()) {
        const head = l.split(' … ')[0].replace(/ …$/, '').replace(/ [\d.]+ms$/, '');
        expect(lines[i].startsWith(head), `${lines[i].slice(0, 120)}\n${head}`).toBe(true);
        if (l.includes(' FROM ')) expect(lines[i]).toContain(l.slice(l.indexOf(' FROM '), l.indexOf(' FROM ') + 28));
      }
      expect(lines.join('\n')).not.toContain('"public"."sessions"');
    }, { edit: queryLog });
  }, 30000);

  it('🔴 Step 5 — 스크립트 결과 두 펜스가 축 ⑤ 의 실제 출력과 같다', () => {
    const outs = fences(DOCS[0], '').filter((b) => b[0] === '200  진짜 토큰').map((b) => b.join('\n'));
    expect(outs).toEqual([
      '200  진짜 토큰\n401  페이로드만 바꾼 토큰\n401  다른 비밀키로 만든 토큰\n401  알고리즘을 none으로 바꾼 토큰\n200  HS512로 만든 토큰\n401  기한이 지난 토큰',
      '200  진짜 토큰\n401  페이로드만 바꾼 토큰\n401  다른 비밀키로 만든 토큰\n401  알고리즘을 none으로 바꾼 토큰\n401  HS512로 만든 토큰\n401  기한이 지난 토큰',
    ]);
  });

  it('🔴 오프닝·Step 7 — 화면이 보내는 여섯 요청(나는 누구 401 · 로그인 · 나는 누구 · 목록 셋)의 쿼리 줄 — 세션 판 16 · sessions 5 / 오늘 12 · 1', async () => {
    const scene = async (from, cookieName) => {
      let counted;
      await freshGate();
      await withServer(from, async ({ base, tail }) => {
        await sleep(200);
        const mark = tail().length;
        const anon = device(base);
        expect((await anon.get('/api/v2/auth/me')).status).toBe(401);
        const me = device(base);
        await me.login('jaehoon');
        expect(me.cookie(cookieName)).toBeTruthy();
        expect((await me.get('/api/v2/auth/me')).status).toBe(200);
        let cursor = null;
        for (let i = 0; i < 3; i += 1) {
          const page = await me.get(`/api/v2/posts?limit=2${cursor ? `&cursor=${cursor}` : ''}`);
          expect(page.status).toBe(200);
          cursor = page.body.data.nextCursor;
        }
        expect(cursor).toBeNull();
        await sleep(300);
        const lines = tail().slice(mark).split('\n').filter((l) => l.startsWith('prisma:query'));
        counted = { queries: lines.length, sessions: lines.filter((l) => l.includes('"public"."sessions"')).length };
      }, { edit: queryLog });
      return counted;
    };
    expect(await scene(BEFORE.dir ? (rel) => join(BEFORE.dir, rel) : B, 'sessionId')).toEqual({ queries: 16, sessions: 5 });
    expect(await scene(stepDir(6), 'accessToken')).toEqual({ queries: 12, sessions: 1 });
  }, 60000);
});

describe('축 ⑫ 실습·과제 서버도 비밀키가 없으면 뜨지 않는다', () => {
  it('🔴 practice1(JWT_SECRET) · practice2·practice3(LAB_SECRET) · homework1·homework2(CLUB_SECRET)', () => {
    const dir = studentDir(stepDir(6));
    for (const [file, name] of [['practice1.js', 'JWT_SECRET'], ['practice2.js', 'LAB_SECRET'], ['practice3.js', 'LAB_SECRET'], ['homework1.js', 'CLUB_SECRET'], ['homework2.js', 'CLUB_SECRET']]) {
      let out;
      try {
        execFileSync(process.execPath, [`lab/p3-42/${file}`], { cwd: dir, env: { ...process.env, ...env, JWT_SECRET: '', LAB_SECRET: '', CLUB_SECRET: '' }, encoding: 'utf8', stdio: 'pipe', timeout: 8000 });
        out = { code: 0 };
      } catch (error) {
        out = { code: error.status, text: `${error.stdout}${error.stderr}` };
      }
      expect(out.code, file).toBe(1);
      expect(out.text, file).toContain(`Error: .env에 ${name}이 없어요`);
    }
  }, 60000);
});

