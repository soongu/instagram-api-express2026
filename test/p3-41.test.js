// p3-41 「세션 기반 인증과 인가」 게이트 — 백엔드
//
// `7-express-auth` 여섯째 회차다(`curriculum.md` 「`p3-41` 착수 결정」).
// Step 1~6·8 본문은 수업 백엔드, Step 7 은 수업 화면(`instagram-next/.verify` 가 본다), 실습·과제는 `lab/p3-41/`.
// Step 마다의 판은 커밋 제목의 «(Step N)» 표식으로 꺼낸다(그 커밋을 임시 폴더에 풀어 띄운다).
//
// 축 ① Step 1 — sessions 표(칸 · FK ON DELETE CASCADE · user_id 인덱스) · 시드가 비우는 목록에 sessions 가 없으면 0A000
// 축 ② Step 2 — 부르는 곳을 안 고친 판: 로그인 200 + 쿠키 j:{} · 나는 누구 500(Expected Int) · 기다리지 않은 Promise 로 서버가 끝난다
//        고친 판: 서버를 다시 띄워도 나는 누구 200 · 쿠키 없이 로그아웃해도 남의 세션은 남는다(가드를 뺀 판은 모두 지운다)
// 축 ③ Step 3 — Step 2 판은 기한이 지난 세션도 200 · Step 3 판은 401 + 그 줄을 지운다 · 쿠키 Max-Age 604800
// 축 ④ Step 4 — Step 3 판은 로그인 없이 목록·좋아요 200 · Step 4 판은 401(두 주소) · /auth·문서·프리플라이트는 그대로
// 축 ⑤ Step 5 — 모든 기기에서 로그아웃: 그 사람 세션만 모두 · 로그인 없이 401 · GET 405
// 축 ⑥ Step 6 — Step 5 판은 jaehoon 이 /likes/1 로 dahye 의 좋아요 · Step 6 판은 404 · /likes/me · ?userId 무시 · 문서에 userId 없음
// 축 ⑧ Step 8 — Step 6 판은 남의 이름으로 올리기·하트 수 고치기·남의 게시물 지우기가 모두 통과 · Step 8 판은 글쓴이 = 나 · 403 · likeCount 는 버린다
// 축 ⑨ posts.http · auth.http — 로그인한 뒤 tip 서버에 차례로
// 축 ⑩ 직접 해보기 1 — cleanup.js(틀린 판 gt 는 남아야 할 세션을 지운다)
// 축 ⑪ 직접 해보기 2 — 4002 공지 서버(틀린 판 둘)
// 축 ⑫ 직접 해보기 3 — 4003 댓글 서버(틀린 판 하나)
// 축 ⑬ 과제 [기초] · [응용](틀린 판 셋)
// 축 ⑭ 이 회차 학생 파일 — code/p3-40 에서 바뀐 파일
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, mkdtempSync, rmSync, cpSync, symlinkSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import pg from 'pg';
import { boot } from './helpers/boot.js';
import { roundDir } from './helpers/round.js';
import { applyMigrationsAfter } from './helpers/tip-schema.js';

const ROOT = new URL('../', import.meta.url);
const P = (rel) => new URL(rel, ROOT).pathname;
const read = (path) => readFileSync(path, 'utf8');
const ADMIN = { host: 'localhost', port: 5432, database: 'postgres', user: 'postgres', password: 'postgres' };
const TPL_DB = 'p341_tpl';
const GATE_DB = 'p341_gate';
const GATE_URL = `postgresql://postgres:postgres@localhost:5432/${GATE_DB}`;
const PORT = 3920;
const LAB_PORT = 3922;
const HW_PORT = 3924;

// 학생 파일은 이 회차 북마크 `code/p3-41` 을 풀어서 읽는다(없으면 작업트리 — 이 회차를 짓는 동안).
const ROUND = roundDir('code/p3-41');
const R = (rel) => join(ROUND.dir, rel);
const BEFORE = roundDir('code/p3-40');
const B = (rel) => join(BEFORE.dir, rel);
const LAB = (rel) => R(`lab/p3-41/${rel}`);

const env = { DATABASE_URL: GATE_URL, CORS_ORIGIN: 'http://localhost:3001' };
const STUDENT_FILES = ['app.js', 'db.js', 'errors.js', 'responses.js', 'routes', 'controllers', 'services', 'middlewares', 'schemas', 'docs', 'package.json', 'requests', 'seed.js', 'data', 'prisma', 'prisma.config.js', 'lab/p3-41'];

const hasRef = (ref) => {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', ref], { cwd: P('.'), stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
};
const LINE = hasRef('refs/heads/code/p3-41') ? 'code/p3-41' : 'main';
const commitOf = (n) => {
  const log = execFileSync('git', ['log', '--format=%H %s', `code/p3-40..${LINE}`], { cwd: P('.'), encoding: 'utf8' });
  const hits = log.split('\n').filter((l) => / feat\(p3-41\): /.test(l) && l.endsWith(`(Step ${n})`));
  if (hits.length === 0) throw new Error(`(Step ${n}) 커밋이 없다`);
  return hits[0].split(' ')[0];
};
const dirs = [];
const stepDir = (n) => {
  const dir = mkdtempSync(join(tmpdir(), `p341-step${n}-`));
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
  const dir = mkdtempSync(join(tmpdir(), 'p341-srv-'));
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

/** 쿠키 하나(sessionId)를 기억하는 요청 도우미 — 브라우저 하나나 httpYac 하나처럼. */
const device = (base) => {
  let cookie = null;
  const send = async (method, path, body, extra = {}) => {
    const headers = { ...extra };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (cookie && !headers.Cookie) headers.Cookie = cookie;
    const res = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const set = res.headers.get('set-cookie');
    if (set) {
      const value = set.split(';')[0];
      cookie = value.endsWith('=') ? null : value;
    }
    const text = await res.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = text; }
    return { status: res.status, headers: res.headers, body: parsed, setCookie: set };
  };
  return {
    send,
    get: (path, extra) => send('GET', path, undefined, extra),
    login: (username, password = `${username}1234`, prefix = '/api/v2') => send('POST', `${prefix}/auth/login`, { username, password }),
    cookie: () => cookie,
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
  // p3-43 뒤 — 작업트리 클라이언트가 사람을 만들 때 role 을 싣는다(그 회차 뒤 마이그레이션을 tip 까지 얹는다)
  await applyMigrationsAfter(tpl, readdirSync(R('prisma/migrations')).filter((name) => name !== 'migration_lock.toml').sort().at(-1));
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

describe('축 ① Step 1 — sessions 표', () => {
  it('🔴 칸 넷 · 기본 키 · FK 는 ON DELETE CASCADE · user_id 인덱스', async () => {
    await freshGate();
    const cols = await gate(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'sessions' ORDER BY ordinal_position`);
    expect(cols).toEqual([
      { column_name: 'id', data_type: 'text', is_nullable: 'NO' },
      { column_name: 'user_id', data_type: 'integer', is_nullable: 'NO' },
      { column_name: 'expires_at', data_type: 'timestamp without time zone', is_nullable: 'NO' },
      { column_name: 'created_at', data_type: 'timestamp without time zone', is_nullable: 'NO' },
    ]);
    const [fk] = await gate(`SELECT confdeltype FROM pg_constraint WHERE conname = 'sessions_user_id_fkey'`);
    expect(fk.confdeltype).toBe('c');
    expect((await gate(`SELECT indexname FROM pg_indexes WHERE tablename = 'sessions' ORDER BY 1`)).map((r) => r.indexname)).toEqual(['sessions_pkey', 'sessions_user_id_idx']);
    // 사람을 지우면 그 사람의 세션도 지워진다
    const [{ id }] = await gate(`INSERT INTO users (username) VALUES ('gate_only') RETURNING id`);
    await gate(`INSERT INTO sessions (id, user_id, expires_at) VALUES ('s1', $1, now() + interval '1 day')`, [id]);
    await gate('DELETE FROM users WHERE id = $1', [id]);
    expect(await gate('SELECT count(*)::int AS n FROM sessions')).toEqual([{ n: 0 }]);
  });

  it('🔴 시드가 비우는 목록에 sessions 가 없으면(code/p3-40 의 seed.js) 0A000 로 멈춘다 · Step 1 시드는 한 줄 그대로', async () => {
    await freshGate();
    const old = node(BEFORE.dir, B('seed.js'));
    expect(old.code).not.toBe(0);
    expect(old.out).toContain('Raw query failed. Code: `0A000`. Message: `cannot truncate a table referenced in a foreign key constraint`');
    const S1 = stepDir(1);
    const dir = studentDir(S1);
    const ok = node(dir, 'seed.js');
    expect(ok).toEqual({ code: 0, out: '사람 5명, 게시물 5개, 사진 8장, 댓글 9개, 답글 3개를 넣었어요.\n' });
    expect(read(S1('seed.js'))).toContain('  TRUNCATE TABLE sessions, post_likes, post_images, comments, posts, users RESTART IDENTITY`;');
  }, 30000);
});

describe('축 ② Step 2 — sessionService 를 표로', () => {
  it('🔴 부르는 곳을 안 고친 판 — 로그인 200 · 쿠키 j:{} · 나는 누구 500 · 그 뒤 서버가 끝난다', async () => {
    const S2 = stepDir(2);
    await freshGate();
    const dir = studentDir(S2, (d) => {
      for (const rel of ['services/authService.js', 'controllers/authController.js']) cpSync(B(rel), join(d, rel));
    });
    const srv = await start(dir);
    try {
      const me = device(srv.base);
      const login = await me.login('jaehoon');
      expect(login.status).toBe(200);
      expect(login.setCookie).toMatch(/^sessionId=j%3A%7B%7D; Max-Age=604800;/);
      const who = await me.get('/api/v2/auth/me');
      expect(who.status).toBe(500);
      expect(who.body).toEqual({ error: { code: 'INTERNAL_ERROR', message: '서버에서 문제가 생겼어요' } });
      await sleep(800);
      await expect(fetch(`${srv.base}/api/v2/auth/me`)).rejects.toThrow();
      const log = srv.tail();
      expect(log).toContain('Argument `id`: Invalid value provided. Expected Int, provided Object.');
      expect(log).toContain('Argument `id`: Invalid value provided. Expected String, provided Object.');
      expect(log).toContain('GET /api/v2/auth/me 500 ');
      expect(log).toMatch(/Node\.js v24\.\d+\.\d+\n$/);
    } finally {
      await stop(srv);
    }
  }, 30000);

  it('🔴 고친 판 — 표에 한 줄 · 서버를 다시 띄워도 나는 누구 200 · 로그아웃하면 줄이 사라진다', async () => {
    const S2 = stepDir(2);
    await freshGate();
    const dir = studentDir(S2);
    const me = device(`http://localhost:${PORT}`);
    let srv = await start(dir);
    try {
      expect((await me.login('jaehoon')).status).toBe(200);
      const rows = await gate('SELECT id, user_id FROM sessions');
      expect(rows).toEqual([{ id: me.cookie().replace('sessionId=', ''), user_id: 2 }]);
      expect((await me.get('/api/v2/auth/me')).body).toEqual({ data: { id: 2, username: 'jaehoon', profileImage: 'https://picsum.photos/seed/jaehoon/40/40' } });
    } finally {
      await stop(srv);
    }
    srv = await start(dir);
    try {
      expect((await me.get('/api/v2/auth/me')).status).toBe(200);
      expect((await me.send('POST', '/api/v2/auth/logout')).status).toBe(200);
      expect(await gate('SELECT count(*)::int AS n FROM sessions')).toEqual([{ n: 0 }]);
      expect((await me.get('/api/v2/auth/me')).status).toBe(401);
    } finally {
      await stop(srv);
    }
  }, 30000);

  it('🔴 쿠키 없이 로그아웃 — 고친 판은 남의 세션이 남는다 · 세션 ID 가드를 뺀 판은 모두 지운다', async () => {
    const S2 = stepDir(2);
    for (const [edit, left] of [[undefined, 2], [(d) => replaceIn(d, 'services/sessionService.js', '  if (!sessionId) return;\n\n  await prisma.session.deleteMany', '  await prisma.session.deleteMany'), 0]]) {
      await freshGate();
      await withServer(S2, async ({ base }) => {
        await device(base).login('jaehoon');
        await device(base).login('minji');
        expect((await device(base).send('POST', '/api/v2/auth/logout')).status).toBe(200);
        expect(await gate('SELECT count(*)::int AS n FROM sessions')).toEqual([{ n: left }]);
      }, { edit });
    }
  }, 30000);
});

describe('축 ③ Step 3 — 세션의 기한', () => {
  it('🔴 Step 2 판은 기한이 지난 세션도 200 · Step 3 판은 401 이고 그 줄을 지운다 · 쿠키는 7일', async () => {
    const S2 = stepDir(2);
    const S3 = stepDir(3);
    for (const [from, status, left] of [[S2, 200, 1], [S3, 401, 0]]) {
      await freshGate();
      await withServer(from, async ({ base }) => {
        const me = device(base);
        const login = await me.login('jaehoon');
        expect(login.setCookie).toMatch(/; Max-Age=604800; Path=\/; Expires=/);
        const [{ days }] = await gate(`SELECT round(extract(epoch FROM expires_at - created_at) / 86400) AS days FROM sessions`);
        expect(Number(days)).toBe(7);
        await gate(`UPDATE sessions SET expires_at = now() - interval '1 minute' WHERE user_id = 2`);
        expect((await me.get('/api/v2/auth/me')).status).toBe(status);
        expect(await gate('SELECT count(*)::int AS n FROM sessions')).toEqual([{ n: left }]);
      });
    }
    expect(read(S3('controllers/authController.js'))).toContain('    maxAge: SESSION_LIFETIME,');
    expect(read(S3('controllers/authController.js'))).not.toContain('SEVEN_DAYS');
  }, 30000);
});

describe('축 ④ Step 4 — 로그인한 사람만', () => {
  it('🔴 Step 3 판은 로그인 없이 목록·좋아요 200 · Step 4 판은 두 주소 모두 401 · 로그인하면 200', async () => {
    const S3 = stepDir(3);
    await freshGate();
    await withServer(S3, async ({ base }) => {
      const anon = device(base);
      expect((await anon.get('/api/v2/posts?limit=1')).status).toBe(200);
      expect((await anon.send('PUT', '/api/v2/posts/1/likes/2')).body).toEqual({ data: { liked: true, likeCount: 131 } });
    });
    const S4 = stepDir(4);
    await freshGate();
    await withServer(S4, async ({ base, tail }) => {
      const anon = device(base);
      expect(await anon.get('/api/v2/posts?limit=1')).toMatchObject({ status: 401, body: { error: { code: 'LOGIN_REQUIRED', message: '로그인이 필요해요' } } });
      expect((await anon.send('PUT', '/api/v2/posts/1/likes/2')).status).toBe(401);
      expect(await anon.get('/api/posts?limit=1')).toMatchObject({ status: 401, body: { message: '로그인이 필요해요' } });
      expect(await gate('SELECT count(*)::int AS n FROM post_likes')).toEqual([{ n: 0 }]);
      // 로그인하러 오는 주소 · 문서 · 프리플라이트는 그대로 열려 있다
      expect((await anon.get('/api/v2/auth/check-duplicate?type=username&value=zzz')).status).toBe(200);
      expect((await anon.get('/api/openapi.json')).status).toBe(200);
      const pre = await fetch(`${base}/api/v2/posts/1/likes/2`, { method: 'OPTIONS', headers: { Origin: 'http://localhost:3001', 'Access-Control-Request-Method': 'PUT' } });
      expect(pre.status).toBe(204);
      // 로그인하면 지나간다
      const me = device(base);
      await me.login('jaehoon');
      expect((await me.get('/api/v2/posts?limit=1')).status).toBe(200);
      expect((await me.send('PUT', '/api/v2/posts/1/likes/2')).status).toBe(200);
      // 없는 주소 — 로그인 전에는 401, 로그인하면 404
      expect((await anon.get('/api/v2/nothing')).status).toBe(401);
      expect((await me.get('/api/v2/nothing')).status).toBe(404);
      expect(tail()).toContain('GET /api/v2/posts?limit=1 401 ');
    });
    const app = read(S4('app.js'));
    expect(app).toContain("api.use('/auth', authRouter);\n// 여기부터는 로그인한 사람만 지나간다.\napi.use(requireLogin);\napi.use('/posts', postsRouter);");
  }, 40000);

  it('🔴 no-login.http — Step 3 판은 200 · 200 · 200(좋아요 행이 생겼다 지워진다) · Step 4 판은 401 셋', async () => {
    const send = async (base) => {
      const out = [];
      for (const chunk of read(R('requests/no-login.http')).split(/^### /m).slice(1)) {
        const [title, meta, line] = chunk.split('\n');
        expect(meta).toBe('# @no-cookie-jar');
        const [method, url] = line.split(' ');
        out.push([title, (await fetch(url.replace('http://localhost:3000', base), { method })).status]);
      }
      return out;
    };
    await freshGate();
    await withServer(stepDir(3), async ({ base }) => {
      expect((await send(base)).map(([, s]) => s)).toEqual([200, 200, 200]);
    });
    await freshGate();
    await withServer(stepDir(4), async ({ base }) => {
      expect(await send(base)).toEqual([
        ['로그인하지 않고 게시물 목록', 401],
        ['로그인하지 않고 minji 이름으로 좋아요', 401],
        ['로그인하지 않고 minji 이름으로 누른 좋아요 취소', 401],
      ]);
    });
  }, 30000);

  it('🔴 차례를 바꾸면(requireLogin 을 /auth 위에) 로그인도 401 · 맨 아래에 두면 아무것도 안 막는다', async () => {
    const S4 = stepDir(4);
    const above = (d) => replaceIn(d, 'app.js', "api.use('/auth', authRouter);\n// 여기부터는 로그인한 사람만 지나간다.\napi.use(requireLogin);", "api.use(requireLogin);\napi.use('/auth', authRouter);");
    const below = (d) => {
      replaceIn(d, 'app.js', '// 여기부터는 로그인한 사람만 지나간다.\napi.use(requireLogin);\n', '');
      replaceIn(d, 'app.js', "api.use('/uploads', uploadsRouter);\n", "api.use('/uploads', uploadsRouter);\napi.use(requireLogin);\n");
    };
    await freshGate();
    await withServer(S4, async ({ base }) => {
      expect((await device(base).login('jaehoon')).status).toBe(401);
    }, { edit: above });
    await freshGate();
    await withServer(S4, async ({ base }) => {
      expect((await device(base).get('/api/v2/posts?limit=1')).status).toBe(200);
    }, { edit: below });
  }, 30000);
});

describe('축 ⑤ Step 5 — 모든 기기에서 로그아웃', () => {
  it('🔴 jaehoon 의 세션만 모두 지운다 · 로그인 없이 401 · GET 405', async () => {
    const S5 = stepDir(5);
    await freshGate();
    await withServer(S5, async ({ base }) => {
      const [a, b] = [device(base), device(base)];
      const m = device(base);
      await a.login('jaehoon');
      await b.login('jaehoon');
      await m.login('minji');
      expect(await gate('SELECT user_id, count(*)::int AS n FROM sessions GROUP BY user_id ORDER BY 1')).toEqual([{ user_id: 2, n: 2 }, { user_id: 3, n: 1 }]);
      expect(await device(base).send('POST', '/api/v2/auth/logout-all')).toMatchObject({ status: 401 });
      const all = await a.send('POST', '/api/v2/auth/logout-all');
      expect(all.status).toBe(200);
      expect(all.body).toEqual({ data: { message: '모든 기기에서 로그아웃했어요' } });
      expect(all.setCookie).toMatch(/^sessionId=; /);
      expect(await gate('SELECT user_id, count(*)::int AS n FROM sessions GROUP BY user_id ORDER BY 1')).toEqual([{ user_id: 3, n: 1 }]);
      expect((await b.get('/api/v2/auth/me')).status).toBe(401);
      expect((await m.get('/api/v2/auth/me')).status).toBe(200);
      expect((await m.get('/api/v2/auth/logout-all')).status).toBe(405);
    });
  }, 30000);

  it('🔴 라우트에서 requireLogin 을 빼도 deleteUserSessions 의 가드가 막는다(200 이지만 아무것도 안 지운다) · 가드까지 빼면 모든 사람의 세션을 지운다', async () => {
    const S5 = stepDir(5);
    await freshGate();
    await withServer(S5, async ({ base }) => {
      await device(base).login('jaehoon');
      await device(base).login('minji');
      expect(await gate('SELECT count(*)::int AS n FROM sessions')).toEqual([{ n: 2 }]);
      expect((await device(base).send('POST', '/api/v2/auth/logout-all')).status).toBe(200);
      expect(await gate('SELECT count(*)::int AS n FROM sessions')).toEqual([{ n: 2 }]);
    }, { edit: (d) => replaceIn(d, 'routes/auth.js', "router.post('/logout-all', requireLogin, authController.logoutAll);", "router.post('/logout-all', authController.logoutAll);") });
    await freshGate();
    await withServer(S5, async ({ base }) => {
      await device(base).login('jaehoon');
      await device(base).login('minji');
      expect((await device(base).send('POST', '/api/v2/auth/logout-all')).status).toBe(200);
      expect(await gate('SELECT count(*)::int AS n FROM sessions')).toEqual([{ n: 0 }]);
    }, { edit: (d) => {
      replaceIn(d, 'routes/auth.js', "router.post('/logout-all', requireLogin, authController.logoutAll);", "router.post('/logout-all', authController.logoutAll);");
      replaceIn(d, 'services/sessionService.js', '  if (userId === undefined) return 0;\n', '');
    } });
  }, 30000);
});

describe('축 ⑥ Step 6 — 주소의 사람 번호를 뺀다', () => {
  it('🔴 Step 5 판 — 로그인한 jaehoon 이 /likes/1 로 dahye 의 좋아요를 누른다', async () => {
    const S5 = stepDir(5);
    await freshGate();
    await withServer(S5, async ({ base }) => {
      const me = device(base);
      await me.login('jaehoon');
      expect((await me.send('PUT', '/api/posts/1/likes/1')).body).toEqual({ liked: true, likeCount: 131 });
      expect((await me.get('/api/posts/1/likes')).body).toEqual(['dahye']);
      const page = await me.get('/api/posts?userId=1&limit=1');
      expect(page.body.items[0]).toMatchObject({ id: 1, liked: true });
    });
  }, 30000);

  it('🔴 Step 6 판 — /likes/1 은 404 · /likes/me 는 나 · ?userId 는 보지 않는다 · 문서에 userId 가 없다', async () => {
    const S6 = stepDir(6);
    await freshGate();
    await withServer(S6, async ({ base }) => {
      const me = device(base);
      await me.login('jaehoon');
      expect(await me.send('PUT', '/api/posts/1/likes/1')).toMatchObject({ status: 404, body: { message: '그런 주소는 없어요' } });
      expect((await me.send('PUT', '/api/posts/1/likes/me')).body).toEqual({ liked: true, likeCount: 131 });
      expect((await me.get('/api/posts/1/likes')).body).toEqual(['jaehoon']);
      expect((await me.get('/api/posts?userId=1&limit=1')).body.items[0]).toMatchObject({ id: 1, liked: true });
      const dahye = device(base);
      await dahye.login('dahye');
      expect((await dahye.get('/api/posts?userId=2&limit=1')).body.items[0]).toMatchObject({ id: 1, liked: false });
      expect((await me.send('DELETE', '/api/posts/1/likes/me')).body).toEqual({ liked: false, likeCount: 130 });
      expect((await me.send('POST', '/api/posts/1/likes/me')).status).toBe(405);
      const doc = (await me.get('/api/openapi.json')).body;
      expect(doc.paths['/api/v2/posts'].get.parameters.map((p) => p.name)).toEqual(['limit', 'cursor', 'username']);
      expect(Object.keys(doc.paths['/api/v2/posts'].get.responses)).toEqual(['200', '400', '401']);
      expect(Object.keys(doc.paths['/api/posts'].get.responses)).toEqual(['200', '400', '401']);
      expect(Object.keys(doc.paths['/api/posts'].post.responses)).toEqual(['201', '400', '401']);
    });
    expect(read(S6('middlewares/params.js'))).not.toContain('parseUserId');
  }, 30000);
});

describe('축 ⑧ Step 8 — 쓴 사람만', () => {
  const create = { authorId: 3, imageUrls: ['/images/post-8.jpg'], postAlt: '제주도 바다 사진', content: '제주 왔어요 🌊' };

  it('🔴 Step 6 판 — 남의 이름으로 올리기 · 하트 수 고치기 · 남의 게시물 지우기가 모두 통과한다', async () => {
    const S6 = stepDir(6);
    await freshGate();
    await withServer(S6, async ({ base }) => {
      const me = device(base);
      await me.login('jaehoon');
      const made = await me.send('POST', '/api/posts', create);
      expect(made.status).toBe(201);
      expect(made.body).toMatchObject({ authorId: 3, username: 'minji' });
      expect((await me.send('PATCH', `/api/posts/${made.body.id}`, { likeCount: 7 })).body.likeCount).toBe(7);
      expect((await me.send('DELETE', `/api/posts/${made.body.id}`)).status).toBe(200);
      expect((await me.send('PATCH', '/api/posts/2', { content: '제가 고쳐 볼게요' })).status).toBe(200);
    });
  }, 30000);

  it('🔴 Step 8 판 — 글쓴이는 나 · likeCount 는 버린다 · 남의 게시물 403 · 없는 게시물 404 · 내 게시물은 지운다', async () => {
    const S8 = stepDir(8);
    await freshGate();
    await withServer(S8, async ({ base }) => {
      const me = device(base);
      await me.login('jaehoon');
      const made = await me.send('POST', '/api/posts', create);
      expect(made.body).toMatchObject({ authorId: 2, username: 'jaehoon' });
      const [{ updated_at: before }] = await gate('SELECT updated_at FROM posts WHERE id = $1', [made.body.id]);
      const patched = await me.send('PATCH', `/api/posts/${made.body.id}`, { likeCount: 7 });
      expect(patched.status).toBe(200);
      expect(patched.body.likeCount).toBe(0);
      expect((await gate('SELECT updated_at FROM posts WHERE id = $1', [made.body.id]))[0].updated_at).toEqual(before);
      expect(await me.send('PATCH', '/api/posts/2', { content: '제가 고쳐 볼게요' })).toMatchObject({ status: 403, body: { message: '내가 쓴 게시물만 고치거나 지울 수 있어요' } });
      expect(await me.send('DELETE', '/api/v2/posts/2')).toMatchObject({ status: 403, body: { error: { code: 'NOT_POST_AUTHOR', message: '내가 쓴 게시물만 고치거나 지울 수 있어요' } } });
      expect((await me.send('DELETE', '/api/posts/999')).status).toBe(404);
      expect((await me.send('DELETE', `/api/posts/${made.body.id}`)).status).toBe(200);
      expect(await gate('SELECT content FROM posts WHERE id = 2')).not.toEqual([{ content: '제가 고쳐 볼게요' }]);
      const doc = (await me.get('/api/openapi.json')).body;
      expect(Object.keys(doc.paths['/api/v2/posts'].post.requestBody.content['application/json'].schema.properties)).toEqual(['postAlt', 'content', 'imageUrls']);
    });
  }, 30000);
});

describe('축 ⑨ posts.http · auth.http — 로그인한 뒤 tip 서버에 차례로', () => {
  // httpYac 처럼 위에서부터 차례로 — 쿠키는 기억하고(# @no-cookie-jar 면 안 싣는다) · # @name 과 {{이름.id}} 를 안다.
  const sendFile = async (me, file) => {
    const out = [];
    const named = {};
    for (const chunk of read(file).split(/^### /m).slice(1)) {
      const lines = chunk.replace(/\n+$/, '').split('\n');
      const title = lines.shift().trim();
      let noJar = false;
      let name = null;
      while (lines[0]?.startsWith('# @')) {
        const meta = lines.shift();
        if (meta === '# @no-cookie-jar') noJar = true;
        if (meta.startsWith('# @name ')) name = meta.slice('# @name '.length).trim();
      }
      const [method, rawUrl] = lines.shift().split(' ');
      const headers = {};
      while (lines.length && lines[0].trim() !== '') {
        const [key, ...value] = lines.shift().split(':');
        if (key.trim() !== 'Content-Type') headers[key.trim()] = value.join(':').trim();
      }
      const text = lines.join('\n').trim();
      const path = rawUrl.replace('http://localhost:3000', '').replace(/\{\{([^}]+)\}\}/g, (_, expr) => expr.split(/[.[\]]+/).filter(Boolean).reduce((o, k) => o[k], named));
      let body;
      try { body = text ? JSON.parse(text) : undefined; } catch { body = undefined; }
      if (text && body === undefined) {
        const res = await fetch(`${me.base}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(noJar ? {} : { Cookie: me.dev.cookie() }) }, body: text });
        out.push([title, res.status]);
        continue;
      }
      const res = noJar ? await device(me.base).send(method, path, body, headers) : await me.dev.send(method, path, body, headers);
      if (name) named[name] = res.body;
      out.push([title, res.status]);
    }
    return out;
  };

  it('🔴 auth.http 로그인 → posts.http 차례 · auth.http 의 끝 «모든 기기에서 로그아웃»', async () => {
    await freshGate();
    await withServer(R, async ({ base }) => {
      const me = { base, dev: device(base) };
      const auth = await sendFile(me, R('requests/auth.http'));
      expect(auth[0]).toEqual(['로그인', 200]);
      expect(auth[1]).toEqual(['나는 누구', 200]);
      expect(auth.at(-1)).toEqual(['모든 기기에서 로그아웃', 401]);
      await me.dev.login('jaehoon', 'jaehoon1234', '/api');
      expect(await sendFile(me, R('requests/posts.http'))).toEqual([
        ['게시물 목록', 200],
        ['목록의 첫 게시물 하나', 200],
        ['없는 게시물', 404],
        ['번호가 들어갈 곳에 아무 글자나', 404],
        ['없는 주소', 404],
        ['minji가 올린 것만', 200],
        ['최신 두 개만', 200],
        ['게시물 올리기', 201],
        ['사진 없이 올리기', 400],
        ['방금 올린 게시물의 하트 수 고치기', 200],
        ['방금 올린 게시물 지우기', 200],
        ['남의 게시물 고치기', 403],
        ['남의 게시물 지우기', 403],
        ['깨진 몸통 보내기', 400],
        ['좋아요 누르기', 200],
        ['좋아요 취소', 200],
        ['좋아요 누른 사람들', 200],
        ['1번 게시물 지금 상태', 200],
        ['1번 게시물 좋아요 누른 사람들', 200],
        ['2번 다음부터', 200],
        ['4번 다음부터', 200],
      ]);
      expect((await me.dev.send('POST', '/api/auth/logout-all')).status).toBe(200);
      expect((await me.dev.get('/api/posts')).status).toBe(401);
    });
  }, 40000);
});

describe('축 ⑩ 직접 해보기 1 — 기한이 지난 세션 치우기', () => {
  const runCleanup = (from, edit) => {
    const dir = studentDir(from, edit);
    return node(dir, 'lab/p3-41/cleanup.js');
  };
  it('🔴 지난 세션 하나만 지운다 · 다시 돌리면 0 · gt 로 적은 판은 남아야 할 세션을 지운다', async () => {
    await freshGate();
    await gate(`INSERT INTO sessions (id, user_id, expires_at) VALUES ('valid', 2, now() + interval '7 days'), ('practice-old', 2, now() - interval '1 day')`);
    expect(runCleanup(R)).toEqual({ code: 0, out: '기한이 지난 세션 1개를 지웠어요. 남은 세션은 1개예요.\n' });
    expect(runCleanup(R)).toEqual({ code: 0, out: '기한이 지난 세션 0개를 지웠어요. 남은 세션은 1개예요.\n' });
    expect(await gate('SELECT id FROM sessions')).toEqual([{ id: 'valid' }]);
    await gate(`INSERT INTO sessions (id, user_id, expires_at) VALUES ('practice-old', 2, now() - interval '1 day')`);
    const wrong = runCleanup(R, (d) => replaceIn(d, 'lab/p3-41/cleanup.js', 'expiresAt: { lte: new Date() }', 'expiresAt: { gt: new Date() }'));
    expect(wrong.out).toBe('기한이 지난 세션 1개를 지웠어요. 남은 세션은 1개예요.\n');
    expect(await gate('SELECT id FROM sessions')).toEqual([{ id: 'practice-old' }]);
  }, 30000);
});

/** 수업 서버(PORT)와 실습 서버(LAB_PORT)를 함께 띄운다 — 실습 파일의 포트만 바꿔서. */
const withLab = async (file, labPort, fn, { edit } = {}) => {
  await freshGate();
  const dir = studentDir(R, (d) => {
    replaceIn(d, `lab/p3-41/${file}`, `app.listen(${{ 'practice2.js': 4002, 'practice3.js': 4003, 'homework1.js': 4011, 'homework2.js': 4012 }[file]}`, `app.listen(${labPort}`);
    if (edit) edit(d);
  });
  const api = await start(dir);
  const lab = await start(dir, `lab/p3-41/${file}`, labPort, '포트에서');
  try {
    await fn({ api: `http://localhost:${PORT}`, lab: `http://localhost:${labPort}`, labTail: lab.tail });
  } finally {
    await stop(lab);
    await stop(api);
  }
};

describe('축 ⑪ 직접 해보기 2 — 다른 서버도 같은 로그인을 본다', () => {
  // 쿠키는 포트를 가리지 않는다 — 수업 서버에서 받은 쿠키를 실습 서버에도 싣는다(브라우저·httpYac 과 같다).
  const twoServers = async ({ api, lab }) => {
    const me = device(api);
    await me.login('jaehoon', 'jaehoon1234', '/api');
    const at = (base) => ({ send: (m, p, b) => fetch(`${base}${p}`, { method: m, headers: { 'Content-Type': 'application/json', Cookie: me.cookie() ?? '' }, body: b && JSON.stringify(b) }) });
    return { me, lab: at(lab) };
  };
  it('🔴 목록은 누구나 · 올리기는 로그인한 사람(글쓴이 = 2) · 수업 서버에서 모든 기기 로그아웃하면 401', async () => {
    await withLab('practice2.js', LAB_PORT, async (s) => {
      expect((await fetch(`${s.lab}/notices`)).status).toBe(200);
      const anon = await fetch(`${s.lab}/notices`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"title":"아무나 올려 볼게요"}' });
      expect([anon.status, await anon.json()]).toEqual([401, { message: '로그인이 필요해요' }]);
      const { me, lab } = await twoServers(s);
      // practice2.http 의 «공지 올리기» 는 본문에 authorId 1 을 싣는다(2026-11-12 학생 낭독 집중 검수) — 글쓴이는 그래도 2.
      const res = await lab.send('POST', '/notices', { title: '다음 주 스터디는 쉬어요', authorId: 1 });
      expect([res.status, await res.json()]).toEqual([201, { id: 2, authorId: 2, title: '다음 주 스터디는 쉬어요' }]);
      const cookie = me.cookie();
      await me.send('POST', '/api/auth/logout-all');
      const after = await fetch(`${s.lab}/notices`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: '{"title":"또"}' });
      expect(after.status).toBe(401);
    });
  }, 40000);

  it('🔴 틀린 판 — 본문의 authorId 를 먼저 쓰는 판은 «공지 올리기» 가 1 로 올라간다(확인의 «authorId 는 2» 가 가린다)', async () => {
    await withLab('practice2.js', LAB_PORT, async (s) => {
      const { lab } = await twoServers(s);
      const res = await lab.send('POST', '/notices', { title: '다음 주 스터디는 쉬어요', authorId: 1 });
      expect([res.status, (await res.json()).authorId]).toEqual([201, 1]);
    }, { edit: (d) => replaceIn(d, 'lab/p3-41/practice2.js', 'authorId: res.locals.userId,', 'authorId: req.body.authorId ?? res.locals.userId,') });
  }, 40000);

  it('🔴 틀린 판 둘 — cookieParser 를 빠뜨리면 로그인해도 500 · requireLogin 을 앱 전체에 걸면 목록도 401', async () => {
    await withLab('practice2.js', LAB_PORT, async (s) => {
      const { lab } = await twoServers(s);
      expect((await lab.send('POST', '/notices', { title: 'x' })).status).toBe(500);
    }, { edit: (d) => replaceIn(d, 'lab/p3-41/practice2.js', 'app.use(cookieParser());\n', '') });
    await withLab('practice2.js', LAB_PORT, async (s) => {
      expect((await fetch(`${s.lab}/notices`)).status).toBe(401);
    }, { edit: (d) => replaceIn(d, 'lab/p3-41/practice2.js', 'app.use(cookieParser());\n', 'app.use(cookieParser());\napp.use(requireLogin);\n') });
  }, 40000);
});

describe('축 ⑫ 직접 해보기 3 — 댓글은 쓴 사람이나 게시물 주인만', () => {
  const sendAllComments = async ({ api, lab }) => {
    const me = device(api);
    await me.login('jaehoon', 'jaehoon1234', '/api');
    const out = [];
    for (const id of [1, 2, 3, 99]) {
      const res = await fetch(`${lab}/comments/${id}`, { method: 'DELETE', headers: { Cookie: me.cookie() } });
      out.push([id, res.status]);
    }
    return out;
  };
  it('🔴 1·2 는 200 · 3 은 403 · 99 는 404 · 로그인 없이 401 · 쓴 사람만 보는 판은 1 이 403', async () => {
    await withLab('practice3.js', LAB_PORT + 1, async (s) => {
      expect((await fetch(`${s.lab}/comments/1`, { method: 'DELETE' })).status).toBe(401);
      expect(await sendAllComments(s)).toEqual([[1, 200], [2, 200], [3, 403], [99, 404]]);
    });
    await withLab('practice3.js', LAB_PORT + 1, async (s) => {
      expect(await sendAllComments(s)).toEqual([[1, 403], [2, 200], [3, 403], [99, 404]]);
    }, { edit: (d) => replaceIn(d, 'lab/p3-41/practice3.js', 'comment.authorId !== userId && post.authorId !== userId', 'comment.authorId !== userId') });
  }, 40000);
});

describe('축 ⑬ 과제', () => {
  const club = async (lab) => {
    const me = device(lab);
    const statuses = [];
    statuses.push((await me.send('POST', '/members', { email: 'bomi@example.com', password: 'bomi1234' })).status);
    statuses.push((await device(lab).get('/members')).status);
    // «로그인하지 않고 나는 누구» — 2026-11-12 학생 낭독 집중 검수가 더했다(main 에만 · 북마크 code/p3-41 은 일곱).
    statuses.push((await device(lab).get('/me')).status);
    statuses.push((await me.send('POST', '/login', { email: 'bomi@example.com', password: 'bomi1234' })).status);
    const copied = me.cookie();
    statuses.push((await me.get('/members')).status);
    statuses.push((await me.get('/me')).status);
    statuses.push((await me.send('POST', '/logout')).status);
    statuses.push((await me.get('/members')).status);
    statuses.push((await device(lab).get('/members', { Cookie: copied })).status);
    return statuses;
  };
  it('🔴 [기초] 401 → 로그인 200 → 로그아웃 뒤 401 · 복사해 둔 쿠키도 401 · 서버 세션을 안 지운 판은 마지막이 200', async () => {
    await withLab('homework1.js', HW_PORT, async ({ lab }) => {
      expect(await club(lab)).toEqual([201, 401, 401, 200, 200, 200, 200, 401, 401]);
    });
    await withLab('homework1.js', HW_PORT, async ({ lab }) => {
      expect(await club(lab)).toEqual([201, 401, 401, 200, 200, 200, 200, 401, 200]);
    }, { edit: (d) => replaceIn(d, 'lab/p3-41/homework1.js', '  sessions.delete(req.cookies.clubSession);\n', '') });
    // requireMember 를 회원 목록 라우트에만 붙인 판 — 나머지 요청은 같고 «로그인하지 않고 나는 누구» 만 200 이다.
    await withLab('homework1.js', HW_PORT, async ({ lab }) => {
      expect(await club(lab)).toEqual([201, 401, 200, 200, 200, 200, 200, 401, 401]);
      expect((await device(lab).get('/me')).body).toEqual({});
    }, { edit: (d) => {
      replaceIn(d, 'lab/p3-41/homework1.js', '// 여기부터는 로그인한 회원만 지나간다 — 가입·로그인·로그아웃은 위에 둔다.\napp.use(requireMember);\n\n', '');
      replaceIn(d, 'lab/p3-41/homework1.js', "app.get('/members', (req, res)", "app.get('/members', requireMember, (req, res)");
    } });
    // app.use(requireMember) 를 가입·로그인보다 위에 두면 가입부터 401 이다.
    await withLab('homework1.js', HW_PORT, async ({ lab }) => {
      const me = device(lab);
      const signup = await me.send('POST', '/members', { email: 'bomi@example.com', password: 'bomi1234' });
      expect(signup.status).toBe(401);
      expect(signup.body).toEqual({ message: '로그인이 필요해요' });
      expect((await me.send('POST', '/login', { email: 'bomi@example.com', password: 'bomi1234' })).status).toBe(401);
    }, { edit: (d) => {
      replaceIn(d, 'lab/p3-41/homework1.js', '// 여기부터는 로그인한 회원만 지나간다 — 가입·로그인·로그아웃은 위에 둔다.\napp.use(requireMember);\n\n', '');
      replaceIn(d, 'lab/p3-41/homework1.js', "app.post('/members', async", "app.use(requireMember);\n\napp.post('/members', async");
    } });
  }, 60000);

  it('🔴 [기초] 기한을 1분으로 줄이면 70초 뒤 복사해 둔 쿠키도 401 · 기한을 안 보는 판은 200 · maxAge 를 초로 적으면 Max-Age=1', async () => {
    const LIFE60 = (d) => replaceIn(d, 'lab/p3-41/homework1.js', 'const SESSION_LIFETIME = 1000 * 60 * 30;', 'const SESSION_LIFETIME = 1000 * 60;');
    await withLab('homework1.js', HW_PORT, async ({ lab }) => {
      const me = device(lab);
      await me.send('POST', '/members', { email: 'bomi@example.com', password: 'bomi1234' });
      await me.send('POST', '/login', { email: 'bomi@example.com', password: 'bomi1234' });
      const copied = me.cookie();
      await sleep(70000);
      expect((await device(lab).get('/members', { Cookie: copied })).status).toBe(200);
    }, { edit: (d) => { LIFE60(d); replaceIn(d, 'lab/p3-41/homework1.js', '  if (!session || expired) {', '  if (!session) {'); } });
    await withLab('homework1.js', HW_PORT, async ({ lab }) => {
      const me = device(lab);
      await me.send('POST', '/members', { email: 'bomi@example.com', password: 'bomi1234' });
      expect((await me.send('POST', '/login', { email: 'bomi@example.com', password: 'bomi1234' })).setCookie).toMatch(/; Max-Age=1;/);
    }, { edit: (d) => replaceIn(d, 'lab/p3-41/homework1.js', '{ httpOnly: true, sameSite: \'lax\', maxAge: SESSION_LIFETIME }', '{ httpOnly: true, sameSite: \'lax\', maxAge: 30 * 60 }') });
    await withLab('homework1.js', HW_PORT, async ({ lab }) => {
      const me = device(lab);
      await me.send('POST', '/members', { email: 'bomi@example.com', password: 'bomi1234' });
      const login = await me.send('POST', '/login', { email: 'bomi@example.com', password: 'bomi1234' });
      expect(login.setCookie).toMatch(/; Max-Age=60;/);
      const copied = me.cookie();
      expect((await device(lab).get('/members', { Cookie: copied })).status).toBe(200);
      await sleep(70000);
      expect((await device(lab).get('/members', { Cookie: copied })).status).toBe(401);
    }, { edit: LIFE60 });
  }, 240000);

  const passwordChange = async ({ api, lab }) => {
    const a = device(api);
    const b = device(api);
    const out = {};
    out.signup = (await a.send('POST', '/api/auth/signup', { emailOrPhone: 'hojun@example.com', name: '정호준', username: 'hojun', password: 'hojun1234' })).status;
    await a.login('hojun', 'hojun1234', '/api');
    await b.login('hojun', 'hojun1234', '/api');
    const at = (path, body) => fetch(`${lab}${path}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: a.cookie() }, body: JSON.stringify(body) }).then(async (r) => [r.status, await r.json()]);
    out.wrong = await at('/me/password', { currentPassword: 'hojun0000', newPassword: 'hojun5678' });
    out.changed = await at('/me/password', { currentPassword: 'hojun1234', newPassword: 'hojun5678' });
    out.thisDevice = (await a.get('/api/auth/me')).status;
    out.otherDevice = (await b.get('/api/auth/me')).status;
    out.oldPassword = (await device(api).login('hojun', 'hojun1234', '/api')).status;
    out.newPassword = (await device(api).login('hojun', 'hojun5678', '/api')).status;
    return out;
  };
  it('🔴 [응용] 지금 비밀번호 확인 · 이 기기만 남는다 · 옛 비밀번호 401 · 새 비밀번호 200', async () => {
    await withLab('homework2.js', HW_PORT + 1, async (s) => {
      expect(await passwordChange(s)).toEqual({
        signup: 201,
        wrong: [400, { message: '지금 비밀번호가 맞지 않아요' }],
        changed: [200, { message: '비밀번호를 바꿨어요', signedOut: 1 }],
        thisDevice: 200,
        otherDevice: 401,
        oldPassword: 401,
        newPassword: 200,
      });
      expect((await fetch(`${s.lab}/me/password`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status).toBe(401);
    });
  }, 60000);

  it('🔴 [응용] 틀린 판 둘 — 지금 세션까지 지우면 이 기기도 401 · 지우지 않으면 다른 기기가 200', async () => {
    await withLab('homework2.js', HW_PORT + 1, async (s) => {
      expect(await passwordChange(s)).toMatchObject({ changed: [200, { signedOut: 2 }], thisDevice: 401, otherDevice: 401 });
    }, { edit: (d) => replaceIn(d, 'lab/p3-41/homework2.js', 'where: { userId: me.id, id: { not: readSessionId(req) } },', 'where: { userId: me.id },') });
    await withLab('homework2.js', HW_PORT + 1, async (s) => {
      expect(await passwordChange(s)).toMatchObject({ thisDevice: 200, otherDevice: 200 });
    }, { edit: (d) => replaceIn(d, 'lab/p3-41/homework2.js', 'where: { userId: me.id, id: { not: readSessionId(req) } },', 'where: { userId: -1 },') });
  }, 90000);
});

describe('축 ⑭ 이 회차 학생 파일', () => {
  it('🔴 code/p3-40 에서 바뀐 학생 파일', () => {
    const changed = execFileSync('git', ['diff', '--name-only', 'code/p3-40', LINE, '--', '.', ':(exclude)test', ':(exclude)snapshots'], { cwd: P('.'), encoding: 'utf8' }).trim().split('\n').sort();
    expect(changed.filter((f) => !f.startsWith('prisma/migrations/'))).toEqual([
      'app.js',
      'controllers/authController.js',
      'controllers/likeController.js',
      'controllers/postController.js',
      'docs/openapi.js',
      'errors.js',
      'lab/p3-41/cleanup.js',
      'lab/p3-41/homework1.http',
      'lab/p3-41/homework1.js',
      'lab/p3-41/homework2.http',
      'lab/p3-41/homework2.js',
      'lab/p3-41/practice2.http',
      'lab/p3-41/practice2.js',
      'lab/p3-41/practice3.http',
      'lab/p3-41/practice3.js',
      'middlewares/auth.js',
      'middlewares/params.js',
      'prisma/schema.prisma',
      'requests/auth.http',
      'requests/cache.http',
      'requests/no-login.http',
      'requests/posts.http',
      'requests/rest.http',
      'routes/auth.js',
      'routes/likes.js',
      'schemas/postSchema.js',
      'seed.js',
      'services/authService.js',
      'services/postService.js',
      'services/sessionService.js',
    ]);
    expect(changed.filter((f) => f.startsWith('prisma/migrations/'))).toEqual([expect.stringMatching(/^prisma\/migrations\/\d{14}_add_sessions\/migration\.sql$/)]);
  });
});

describe('축 ⑮ 교안·답안의 코드 블록은 줄마다 그 파일에 실재한다', () => {
  const TRACK_DIR = new URL('../../', ROOT).pathname;
  const DOCS = ['part3/7-express-auth/p3-41-session-auth-authorization-lecture.md', 'part3/7-express-auth/p3-41-session-auth-authorization-answers.md'].map((f) => join(TRACK_DIR, f));
  // 펜스를 차례로 열고 닫으며 언어가 맞는 것만 모은다(닫는 줄을 다음 펜스의 여는 줄로 읽지 않게).
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
    ...[1, 2, 3, 4, 5, 6, 8].map((n) => showAt(commitOf(n), rel)),
  ].filter(Boolean);
  const meaningful = (b) => b.filter((l) => l.trim() !== '' && l.trim() !== '...');

  it('🔴 javascript 블록마다 한 버전에 줄이 모두 있다(수업 화면 블록은 instagram-next/.verify 가 본다)', () => {
    const all = DOCS.flatMap((d) => fences(d, 'javascript')).filter((b) => (b[0] ?? '').startsWith('// ~/instagram-api/'));
    expect(all.length).toBeGreaterThanOrEqual(25);
    for (const b of all) {
      const rel = b[0].replace('// ~/instagram-api/', '');
      expect(versions(rel).some((text) => meaningful(b).every((l) => text.split('\n').includes(l))), `${rel}\n${meaningful(b).join('\n')}`).toBe(true);
    }
  }, 30000);

  it('🔴 prisma 블록 · http 블록은 줄마다 그 파일에 있다', () => {
    for (const b of fences(DOCS[0], 'prisma')) {
      for (const l of meaningful(b)) expect(read(R('prisma/schema.prisma')).split('\n'), l).toContain(l);
    }
    // 두 .http 는 2026-11-12 학생 낭독 집중 검수가 main 에만 고쳤다(북마크 code/p3-41 은 옛 판) — 작업트리에서 읽는다.
    const MAIN_HTTP = ['lab/p3-41/homework1.http', 'lab/p3-41/practice2.http'];
    const http = ['requests/auth.http', 'requests/posts.http', 'requests/no-login.http', 'requests/rest.http', 'requests/cache.http', ...readdirSync(LAB('.')).filter((f) => f.endsWith('.http')).map((f) => `lab/p3-41/${f}`)]
      .map((rel) => read(MAIN_HTTP.includes(rel) ? P(rel) : R(rel)).split('\n'));
    const blocks = DOCS.flatMap((d) => fences(d, 'http'));
    expect(blocks.length).toBe(8);
    for (const b of blocks) {
      expect(http.some((lines) => meaningful(b).every((l) => lines.includes(l))), meaningful(b).join('\n')).toBe(true);
    }
  });

  it('🔴 학생 낭독 집중 검수(2026-11-12) — 과제 [기초] 상태 코드 여덟 · 직접 해보기 2 본문의 authorId 1', () => {
    const [lecture, answers] = DOCS.map(read);
    for (const doc of [lecture, answers]) expect(doc).toContain('201 · 401 · 401 · 200 · 200 · 200 · 200 · 401');
    expect(lecture).not.toContain('201 · 401 · 200 · 200 · 200 · 200 · 401');
    expect(lecture).toContain('### 로그인하지 않고 나는 누구\n# @no-cookie-jar\nGET http://localhost:4011/me');
    expect(lecture).toContain('"title": "다음 주 스터디는 쉬어요",\n  "authorId": 1');
  });

  it('🔴 언어 없는 펜스 — await 를 빠뜨린 판의 터미널 줄 · grep 출력 · 마이그레이션 폴더 이름', () => {
    const [lecture] = DOCS.map(read);
    // 터미널 그림의 «...» 가 아닌 줄은 축 ② 가 본 실제 로그와 같은 글자다(ms 숫자만 다르다).
    const crash = fences(DOCS[0], '').find((b) => b.includes('Node.js v24.19.0'));
    expect(meaningful(crash).filter((l) => !l.startsWith('GET '))).toEqual([
      'PrismaClientValidationError:',
      'Invalid `prisma.user.findUnique()` invocation:',
      'Argument `id`: Invalid value provided. Expected Int, provided Object.',
      'PrismaClientValidationError:',
      'Invalid `prisma.session.findUnique()` invocation:',
      'Argument `id`: Invalid value provided. Expected String, provided Object.',
      'Node.js v24.19.0',
      "Failed running 'app.js'. Waiting for file changes before restarting...",
    ]);
    // grep — Step 2 판 + 부르는 곳(authService·컨트롤러)은 code/p3-40 그대로인 폴더에서 실제로 실행한 출력
    const dir = studentDir(stepDir(2), (d) => {
      for (const rel of ['services/authService.js', 'controllers/authController.js']) cpSync(B(rel), join(d, rel));
    });
    const out = execFileSync('/usr/bin/grep', ['-rn', 'sessionService\\.', 'services', 'controllers'], { cwd: dir, encoding: 'utf8' });
    expect(lecture).toContain(`\`\`\`\n${out}\`\`\``);
    const mig = readdirSync(R('prisma/migrations')).find((n) => n.endsWith('_add_sessions'));
    expect(lecture).toContain(`Applying migration \`${mig}\``);
    expect(lecture).toContain(`  └─ ${mig}/`);
  });
});
