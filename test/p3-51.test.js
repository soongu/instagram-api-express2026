// p3-51 「게시물 상세 — 같은 주소, 두 화면」 게이트 — 백엔드(교안 Step 4 «상세에서도 내 하트»)
// 내부 검증 전용 — 교안에 한 줄도 인용하지 않는다.
//
// `8-fullstack-features` 셋째 회차다(`curriculum.md` 「`p3-51` 착수 결정」 ⑤). 화면(Step 1~3 · 5~7)은 `instagram-next/.verify` 가 본다.
// 백엔드의 시작 판은 `code/p3-50` 이다. Step 4 는 커밋 둘 — 먼저 강의 자료 requests/post-detail.http(겪기 판 = 시작 판 + 그 파일),
// 그다음 고친 판(같은 «(Step 4)» 표식 · 가장 뒤 커밋이 Step 4 의 판).
// 🔑 짓는 동안 `P351_WT=4` 를 주면 Step 4 의 판을 커밋 대신 작업트리에서 읽는다(Red 를 실제 동작으로 보려고).
// 🔑 포트 — 3890 · 3891(둘째 서버). DB — `p351_api_` 로 시작하는 것만 만들고 지운다.
// 🔑 판정 DB 는 «학생 DB» 처럼 — 시드 뒤 jaehoon 밖 password_hash 를 지우고 seoyeon · doyun 을 가입 API 로 넣고,
//    9번(minji · p3-34 가 posts.http «게시물 올리기» 로 올린 것 — 사진은 picsum 둘)과 jaehoon 의 좋아요 1·2·9(PUT /likes/me),
//    9번보다 새 jaehoon 의 게시물 하나(14번 — p3-49 Step 6 «바다에 다녀왔어요»)를 넣는다.
//
// 축 ① 겪기 — code/p3-50 판: 상세 liked false · 같은 순간 목록 true · 누르기 200 이고 숫자 그대로
// 축 ② 고친 판 — jaehoon true · seoyeon false · 없는 번호 404 · 숫자 아닌 번호 404 · 로그인 없이 401 · 옛 주소 · 만들기·고치기·지우기 응답은 그대로
// 축 ③ 목록 응답이 code/p3-50 과 같다 — 같은 요청을 두 판에 · 상세의 차이는 liked 한 줄(보는 사람이 누른 게시물에서만)
// 축 ④ 쿼리 수 — 상세 하나에 3 · 고치기 전·뒤 같다 · 누가 보는지 모르면 세지 않는다
// 축 ⑤ requests/post-detail.http 를 httpYac CLI(--all)로 두 판에
// 축 ⑥ 학생 파일 차이
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, mkdtempSync, rmSync, cpSync, symlinkSync, existsSync, readdirSync, writeFileSync, openSync, closeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile, execFileSync, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import { boot } from './helpers/boot.js';

const execFileAsync = promisify(execFile);
const ROOT = new URL('../', import.meta.url);
const P = (rel) => new URL(rel, ROOT).pathname;
const read = (path) => readFileSync(path, 'utf8');
const ADMIN = { host: 'localhost', port: 5432, database: 'postgres', user: 'postgres', password: 'postgres' };
const TPL_DB = 'p351_api_tpl';
const GATE_DB = 'p351_api_gate';
const GATE2_DB = 'p351_api_gate2';
const dbUrl = (name) => `postgresql://postgres:postgres@localhost:5432/${name}`;
const PORT = 3890;
const PORT2 = 3891;
const SECRET = 'q2Xh0v9bGm4RkT7sYp1wLc8nZf3uJd6eHa5iVo0rQyE';
const PROVIDER_ENV = {
  GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret', SITE_URL: `http://localhost:${PORT}`,
  KAKAO_CLIENT_ID: 'test-kakao', KAKAO_CLIENT_SECRET: 'test-kakao-secret',
  NAVER_CLIENT_ID: 'test-naver', NAVER_CLIENT_SECRET: 'test-naver-secret',
};
const env = { CORS_ORIGIN: 'http://localhost:3001', JWT_SECRET: SECRET, ...PROVIDER_ENV };
const STUDENT_FILES = ['app.js', 'db.js', 'errors.js', 'responses.js', 'routes', 'controllers', 'services', 'middlewares', 'schemas', 'strategies', 'docs', 'package.json', 'requests', 'seed.js', 'data', 'prisma', 'prisma.config.js', '.env.example'];
const BASE_REF = 'code/p3-50';
const HTTP_FILE = 'requests/post-detail.http';

const hasRef = (ref) => {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', ref], { cwd: P('.'), stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
};
const LINE = hasRef('refs/heads/code/p3-51') ? 'code/p3-51' : 'main';
const WT = process.env.P351_WT ? Number(process.env.P351_WT) : null;
/** «(Step N)» 표식이 붙은 이 회차 커밋들 — 새것부터. */
const stepCommits = (n) => {
  const log = execFileSync('git', ['log', '-n', '400', '--format=%H %s', LINE], { cwd: P('.'), encoding: 'utf8' });
  const hits = log.split('\n').filter((l) => / feat\(p3-51\): /.test(l) && l.endsWith(`(Step ${n})`)).map((l) => l.split(' ')[0]);
  if (hits.length === 0) throw new Error(`(Step ${n}) 커밋이 없다`);
  return hits;
};
const dirs = [];
const refDirs = new Map();
/** 커밋(또는 브랜치) 하나를 임시 폴더에 풀어 둔다. */
const refDir = (ref) => {
  if (refDirs.has(ref)) return refDirs.get(ref);
  const dir = mkdtempSync(join(tmpdir(), 'p351-ref-'));
  const tar = execFileSync('git', ['archive', '--format=tar', ref], { cwd: P('.'), maxBuffer: 1 << 28 });
  execFileSync('tar', ['-x', '-C', dir], { input: tar });
  dirs.push(dir);
  const at = (rel) => join(dir, rel);
  refDirs.set(ref, at);
  return at;
};
const before = () => refDir(BASE_REF);
/** Step 4 의 판 — 고친 판(가장 뒤 «(Step 4)» 커밋). */
const after = () => (WT === 4 ? (rel) => P(rel) : refDir(stepCommits(4)[0]));
const afterRef = () => (WT === 4 ? null : stepCommits(4)[0]);
const showAt = (ref, rel) => execFileSync('git', ['show', `${ref}:${rel}`], { cwd: P('.'), encoding: 'utf8' });
const changedStudentFiles = (from, to) => execFileSync('git', ['diff', '--name-only', from, ...(to ? [to] : []), '--', ...STUDENT_FILES], { cwd: P('.'), encoding: 'utf8' }).trim().split('\n').filter(Boolean);

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
const dropDb = (name) => admin(async (client) => {
  await kick(client, name);
  await client.query(`DROP DATABASE IF EXISTS ${name}`);
});
/** 템플릿 DB 를 복사한 판정 DB. */
const copyDb = (name) => admin(async (client) => {
  await kick(client, name);
  await client.query(`DROP DATABASE IF EXISTS ${name}`);
  await kick(client, TPL_DB);
  await client.query(`CREATE DATABASE ${name} TEMPLATE ${TPL_DB}`);
});
const idOf = async (db, username) => (await onDb(db, 'SELECT id FROM users WHERE username = $1', [username]))[0].id;

const replaceIn = (dir, rel, a, b) => {
  const text = read(join(dir, rel));
  if (text.split(a).length !== 2) throw new Error(`${rel} 에 바꿀 글자가 없거나 여럿이다: ${a}`);
  writeFileSync(join(dir, rel), text.replace(a, b));
};
const studentDir = (from, edit) => {
  const dir = mkdtempSync(join(tmpdir(), 'p351-srv-'));
  for (const name of STUDENT_FILES) {
    if (existsSync(from(name))) cpSync(from(name), join(dir, name), { recursive: true });
  }
  symlinkSync(P('node_modules'), join(dir, 'node_modules'));
  if (edit) edit(dir);
  dirs.push(dir);
  return dir;
};
const stop = (srv) => Promise.race([srv.stop(), sleep(500)]);
/** 그 판의 학생 파일 사본을 `db` 로 띄운다. */
const withServer = async (from, db, fn, { edit, port = PORT } = {}) => {
  const dir = studentDir(from, edit);
  const srv = await boot(join(dir, 'app.js'), {
    port, cwd: dir, env: { ...env, DATABASE_URL: dbUrl(db), PORT: String(port) }, ready: `${port}번 포트에서`,
  });
  try {
    return await fn({ ...srv, dir, base: `http://localhost:${port}` });
  } finally {
    await stop(srv);
  }
};

// 학생 DB 에서 비밀번호가 있는 사람 — jaehoon 은 p3-40 의 set-password.js, seoyeon · doyun 은 p3-39 에 auth.http 로 가입.
const PASSWORDS = { jaehoon: 'jaehoon1234', seoyeon: 'instagram1234', doyun: 'instagram1234' };
/** 쿠키를 기억하는 탭 하나 — Access 토큰 쿠키만 기억한다(Refresh 쿠키는 Path 가 /api/v2/auth). */
const browser = (base) => {
  const jar = new Map();
  const send = async (method, path, body, extra = {}) => {
    const headers = { ...extra };
    let payload;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    if (jar.size > 0 && !headers.Cookie) headers.Cookie = [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
    const res = await fetch(`${base}${path}`, { method, headers, redirect: 'manual', body: payload });
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
    return { status: res.status, headers: res.headers, body: parsed, text };
  };
  return {
    send,
    get: (path) => send('GET', path),
    login: (username, password = PASSWORDS[username]) => send('POST', '/api/v2/auth/login', { username, password }),
  };
};
/** 로그인한 탭 — 로그인이 200 이 아니면 멈춘다. */
const loggedIn = async (base, username) => {
  const tab = browser(base);
  const res = await tab.login(username);
  expect([username, res.status]).toEqual([username, 200]);
  return tab;
};
/** requests/auth.http 의 가입 블록 본문 그대로(seoyeon · doyun). */
const signupBodies = (from) => read(from('requests/auth.http')).split(/^### /m)
  .filter((block) => /^POST \S+\/auth\/signup$/m.test(block) && /"username": "(seoyeon|doyun)"/.test(block))
  .map((block) => JSON.parse(block.slice(block.indexOf('{'), block.lastIndexOf('}') + 1)));
/** requests/posts.http 의 «게시물 올리기» 본문 — 학생 파일은 p3-16 Step 6 에서 사진 주소 둘을 picsum 으로 바꿨다. */
const post9Body = (from) => {
  const text = read(from('requests/posts.http'));
  const at = text.indexOf('### 게시물 올리기\n');
  const block = text.slice(at, text.indexOf('\n###', at + 5));
  const body = JSON.parse(block.slice(block.indexOf('{'), block.lastIndexOf('}') + 1));
  expect(body.imageUrls).toEqual(['/images/post-8.jpg', '/images/post-9.jpg']);
  return { ...body, imageUrls: ['https://picsum.photos/seed/post8/600/600', 'https://picsum.photos/seed/post9/600/600'] };
};
/** 로그인 없이 쓸 Access 토큰 — 데이터베이스를 안 보는 로그인 확인(requireLogin)을 그대로 지난다. */
const tokenFor = (userId) => jwt.sign({ sid: randomUUID(), role: 'USER' }, SECRET, { subject: String(userId), expiresIn: 900, algorithm: 'HS256' });
const photo = (name) => readFileSync(P(`requests/photos/${name}`));

/**
 * 템플릿을 학생 DB 처럼 — `base` 는 그 DB 로 띄운 시작 판 서버.
 * 사람: jaehoon(시드 비밀번호) · seoyeon · doyun(가입 API) — 나머지 시드 사람은 password_hash NULL.
 * 게시물: 시드 1~5 · 9(minji · picsum 둘) · 14(jaehoon · beach.jpg 를 올려서) — 최신순 14·9·1·2·3·4·5.
 * 좋아요: jaehoon 이 1·2·9.
 */
const toStudentState = async (base, from) => {
  await onDb(TPL_DB, "UPDATE users SET password_hash = NULL WHERE username <> 'jaehoon'");
  const bodies = signupBodies(from);
  expect(bodies.map((b) => b.username)).toEqual(['seoyeon', 'doyun']);
  for (const body of bodies) {
    const res = await fetch(`${base}/api/v2/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    expect(res.status).toBe(201);
  }
  // p3-34 Step 2 — 7·8번을 지우는 사이에 «게시물 올리기» 로 9번(그때는 본문의 authorId 3 = minji)
  await onDb(TPL_DB, "SELECT setval('posts_id_seq', 8)");
  const minji = browser(base);
  const nine = await minji.send('POST', '/api/v2/posts', post9Body(from), { Authorization: `Bearer ${tokenFor(await idOf(TPL_DB, 'minji'))}` });
  expect([nine.status, nine.body.data.id, nine.body.data.username]).toEqual([201, 9, 'minji']);
  const jaehoon = await loggedIn(base, 'jaehoon');
  for (const id of [1, 2, 9]) expect((await jaehoon.send('PUT', `/api/v2/posts/${id}/likes/me`)).status).toBe(200);
  // p3-49 Step 6 — 화면에서 «바다에 다녀왔어요»(사진을 먼저 올리고 그 주소로)
  await onDb(TPL_DB, "SELECT setval('posts_id_seq', 13)");
  const form = new FormData();
  form.append('images', new Blob([photo('beach.jpg')], { type: 'image/jpeg' }), 'beach.jpg');
  const uploaded = await jaehoon.send('POST', '/api/v2/uploads', form);
  expect(uploaded.status).toBe(201);
  const fourteen = await jaehoon.send('POST', '/api/v2/posts', { imageUrls: uploaded.body.data.imageUrls, postAlt: '바다에 다녀왔어요', content: '바다에 다녀왔어요' });
  expect([fourteen.status, fourteen.body.data.id]).toEqual([201, 14]);
};

/** httpYac CLI 로 `.http` 한 파일을 통째로 보낸다(`--all --json`) — 학생이 VS Code 에서 위에서부터 차례로 누르는 것과 같다. */
const httpyac = async (source, port = PORT) => {
  const dir = mkdtempSync(join(tmpdir(), 'p351-http-'));
  dirs.push(dir);
  writeFileSync(join(dir, 'send.http'), source.replaceAll('http://localhost:3000', `http://localhost:${port}`));
  // 🚨 출력을 파이프로 받으면 httpYac 이 64KB 에서 끊긴 채 끝난다 — 파일로 받는다(p3-50 판정과 같은 이유).
  const fd = openSync(join(dir, 'out.json'), 'w');
  await new Promise((resolve, reject) => {
    const child = spawn(P('node_modules/.bin/httpyac'), ['send', 'send.http', '--all', '--json'], { cwd: dir, stdio: ['ignore', fd, 'inherit'] });
    child.on('error', reject);
    child.on('exit', resolve);
  });
  closeSync(fd);
  const parse = (text) => {
    try { return JSON.parse(text); } catch { return text; }
  };
  return JSON.parse(read(join(dir, 'out.json'))).requests.map((r) => ({
    title: r.title, status: r.response?.statusCode, headers: r.response?.headers, rawBody: r.response?.body, body: parse(r.response?.body),
  }));
};

/** 교안에 인용할 실측 글자 — `P351_SEEN=경로` 를 주면 파일로 남긴다(보고용). */
const seen = {};

beforeAll(async () => {
  await admin(async (client) => {
    for (const name of [GATE_DB, GATE2_DB, TPL_DB]) {
      await kick(client, name);
      await client.query(`DROP DATABASE IF EXISTS ${name}`);
    }
    await client.query(`CREATE DATABASE ${TPL_DB}`);
  });
  // 템플릿은 시작 판(code/p3-50)의 마이그레이션 + 시드 + 학생 DB 의 쓰기
  const base = before();
  for (const dir of readdirSync(base('prisma/migrations')).filter((name) => name !== 'migration_lock.toml').sort()) {
    await onDb(TPL_DB, read(base(`prisma/migrations/${dir}/migration.sql`)));
  }
  const seedDir = studentDir(base);
  const childEnv = { ...process.env, DATABASE_URL: dbUrl(TPL_DB) };
  delete childEnv.NODE_ENV;
  execFileSync(process.execPath, [join(seedDir, 'seed.js')], { cwd: seedDir, encoding: 'utf8', env: childEnv });
  await withServer(base, TPL_DB, ({ base: url }) => toStudentState(url, base), { port: PORT2 });
  expect((await onDb(TPL_DB, "SELECT string_agg(id::text, ',' ORDER BY created_at DESC, id DESC) AS ids FROM posts"))[0].ids).toBe('14,9,1,2,3,4,5');
  expect((await onDb(TPL_DB, "SELECT string_agg(post_id || ':' || user_id, ',' ORDER BY post_id) AS l FROM post_likes"))[0].l).toBe('1:2,2:2,9:2');
  expect((await onDb(TPL_DB, 'SELECT like_count FROM posts WHERE id = 9'))[0].like_count).toBe(1);
}, 120_000);

afterAll(async () => {
  for (const name of [GATE_DB, GATE2_DB, TPL_DB]) await dropDb(name);
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  if (process.env.P351_SEEN) writeFileSync(process.env.P351_SEEN, JSON.stringify(seen, null, 2));
});

// ── 축 ① 겪기 — code/p3-50 판 ────────────────────────────────────────────────────
describe('축 ① 겪기 — 시작 판(code/p3-50)의 상세는 내가 누른 게시물도 liked false', () => {
  it('🔴 jaehoon 의 상세 9번 liked false · 같은 순간 목록의 9번 liked true · 누르기(PUT)는 200 이고 likeCount 1 그대로 · 좋아요 행도 그대로', async () => {
    await copyDb(GATE_DB);
    const out = await withServer(before(), GATE_DB, async ({ base }) => {
      const tab = await loggedIn(base, 'jaehoon');
      return {
        detail: await tab.get('/api/v2/posts/9'),
        list: await tab.get('/api/v2/posts?username=minji&limit=1'),
        whole: await tab.get('/api/v2/posts?limit=50'),
        put: await tab.send('PUT', '/api/v2/posts/9/likes/me'),
      };
    });
    expect([out.detail.status, out.detail.body.data.id, out.detail.body.data.liked, out.detail.body.data.likeCount]).toEqual([200, 9, false, 1]);
    expect(out.list.body.data.items.map((p) => [p.id, p.liked])).toEqual([[9, true]]);
    // 피드(최신순 한 페이지)에서도 9번은 true — 9번은 맨 위가 아니다(뒤에 올린 게시물이 있다)
    expect(out.whole.body.data.items.map((p) => [p.id, p.liked])).toEqual([[14, false], [9, true], [1, true], [2, true], [3, false], [4, false], [5, false]]);
    expect([out.put.status, out.put.body]).toEqual([200, { data: { liked: true, likeCount: 1 } }]);
    expect(await onDb(GATE_DB, "SELECT string_agg(post_id || ':' || user_id, ',' ORDER BY post_id) AS l, (SELECT like_count FROM posts WHERE id = 9) AS n FROM post_likes"))
      .toEqual([{ l: '1:2,2:2,9:2', n: 1 }]);
    // 상세의 나머지 칸은 목록의 9번과 같다 — 다른 것은 liked 하나
    const { liked: a, ...detailRest } = out.detail.body.data;
    const { liked: b, ...listRest } = out.list.body.data.items[0];
    expect([a, b]).toEqual([false, true]);
    expect(detailRest).toEqual(listRest);
  }, 30_000);
});

// ── 축 ② 고친 판 ────────────────────────────────────────────────────────────────
describe('축 ② 고친 판 — 상세도 목록과 같은 기준으로 보는 사람이 누른 좋아요를 센다', () => {
  it('🔴 jaehoon 9번 true · 1번 true · 4번 false · seoyeon · doyun 9번 false — 같은 게시물을 보는 사람마다 다르게', async () => {
    await copyDb(GATE_DB);
    const out = await withServer(after(), GATE_DB, async ({ base }) => {
      const [j, s, d] = [await loggedIn(base, 'jaehoon'), await loggedIn(base, 'seoyeon'), await loggedIn(base, 'doyun')];
      const liked = async (tab, id) => (await tab.get(`/api/v2/posts/${id}`)).body.data.liked;
      return {
        jaehoon: [await liked(j, 9), await liked(j, 1), await liked(j, 2), await liked(j, 4), await liked(j, 14)],
        seoyeon: [await liked(s, 9), await liked(s, 1)],
        doyun: [await liked(d, 9)],
        detail: await j.get('/api/v2/posts/9'),
      };
    });
    expect(out).toMatchObject({ jaehoon: [true, true, true, false, false], seoyeon: [false, false], doyun: [false] });
    expect([out.detail.status, out.detail.body.data.likeCount]).toEqual([200, 1]);
    seen.afterDetail = out.detail.body;
  }, 30_000);

  it('🔴 없는 번호 999999 는 404 POST_NOT_FOUND(봉투에 path · timestamp) · 숫자가 아닌 abc 도 404 POST_NOT_FOUND · 로그인 없이는 401 LOGIN_REQUIRED', async () => {
    await copyDb(GATE_DB);
    const out = await withServer(after(), GATE_DB, async ({ base }) => {
      const tab = await loggedIn(base, 'jaehoon');
      return {
        missing: await tab.get('/api/v2/posts/999999'),
        abc: await tab.get('/api/v2/posts/abc'),
        noLogin: await browser(base).get('/api/v2/posts/9'),
      };
    });
    const iso = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;
    expect(out.missing.status).toBe(404);
    expect(out.missing.body).toEqual({ error: { code: 'POST_NOT_FOUND', message: '그런 게시물은 없어요', path: '/api/v2/posts/999999', timestamp: expect.stringMatching(iso) } });
    expect(Object.keys(out.missing.body.error)).toEqual(['code', 'message', 'path', 'timestamp']);
    expect(out.abc.status).toBe(404);
    expect(out.abc.body).toEqual({ error: { code: 'POST_NOT_FOUND', message: '그런 게시물은 없어요', path: '/api/v2/posts/abc', timestamp: expect.stringMatching(iso) } });
    expect(out.noLogin.status).toBe(401);
    expect(out.noLogin.body).toEqual({ error: { code: 'LOGIN_REQUIRED', message: '로그인이 필요해요', path: '/api/v2/posts/9', timestamp: expect.stringMatching(iso) } });
    seen.errors = { missing: out.missing.text, abc: out.abc.text, noLogin: out.noLogin.text };
  }, 30_000);

  it('🔴 옛 주소 /api/posts/9 도 같은 liked(true) — 옛 모양(봉투 없음) · Deprecation · Sunset · Link', async () => {
    await copyDb(GATE_DB);
    const out = await withServer(after(), GATE_DB, async ({ base }) => {
      const tab = await loggedIn(base, 'jaehoon');
      return { old: await tab.get('/api/posts/9'), v2: await tab.get('/api/v2/posts/9'), s: await (await loggedIn(base, 'seoyeon')).get('/api/posts/9') };
    });
    expect(out.old.status).toBe(200);
    expect(out.old.body).toEqual(out.v2.body.data);
    expect(out.old.body.liked).toBe(true);
    expect(out.s.body.liked).toBe(false);
    expect([out.old.headers.get('deprecation'), out.old.headers.get('sunset'), out.old.headers.get('link')])
      .toEqual(['@1796083200', 'Mon, 01 Mar 2027 00:00:00 GMT', '</api/docs>; rel="deprecation"; type="text/html"']);
    expect(out.v2.headers.get('deprecation')).toBeNull();
    seen.oldDetail = { headers: Object.fromEntries(out.old.headers), body: out.old.text };
  }, 30_000);

  it('🔎 만들기 · 고치기 · 지우기 응답의 liked 는 이 회차가 안 바꾼다 — 내가 누른 내 게시물도 셋 다 false(상세만 true)', async () => {
    await copyDb(GATE_DB);
    const out = await withServer(after(), GATE_DB, async ({ base }) => {
      const tab = await loggedIn(base, 'jaehoon');
      const created = await tab.send('POST', '/api/v2/posts', { imageUrls: ['https://picsum.photos/seed/p351/600/600'], postAlt: '확인용', content: '확인용' });
      const id = created.body.data.id;
      const like = await tab.send('PUT', `/api/v2/posts/${id}/likes/me`);
      const detail = await tab.get(`/api/v2/posts/${id}`);
      const patched = await tab.send('PATCH', `/api/v2/posts/${id}`, { content: '고친 확인용' });
      const deleted = await tab.send('DELETE', `/api/v2/posts/${id}`);
      return { created, like, detail, patched, deleted };
    });
    expect([out.created.status, out.created.body.data.liked]).toEqual([201, false]);
    expect(out.like.body.data).toEqual({ liked: true, likeCount: 1 });
    expect([out.detail.status, out.detail.body.data.liked]).toEqual([200, true]);
    expect([out.patched.status, out.patched.body.data.liked, out.patched.body.data.likeCount]).toEqual([200, false, 1]);
    expect([out.deleted.status, out.deleted.body.data.liked]).toEqual([200, false]);
    seen.writeLiked = { create: out.created.body.data.liked, detail: out.detail.body.data.liked, patch: out.patched.body.data.liked, delete: out.deleted.body.data.liked };
  }, 30_000);

  it('🔎 번호 모양 — Number() 로 바꾸므로 0x9 · 9.0 · +9 · 앞 공백도 9번 · 1e1 은 10번(없음 404) · -1 · 0 은 404 · int 범위를 넘는 99999999999 는 500(두 판 같다 — 이 회차가 안 고친다)', async () => {
    await copyDb(GATE_DB);
    const ids = ['0x9', '9.0', '+9', '%209', '1e1', '-1', '0', '99999999999'];
    const probe = (from) => withServer(from, GATE_DB, async ({ base }) => {
      const tab = await loggedIn(base, 'jaehoon');
      const out = {};
      for (const id of ids) {
        const res = await tab.get(`/api/v2/posts/${id}`);
        out[id] = [res.status, res.body?.data?.id ?? res.body?.error?.code];
      }
      return out;
    });
    const [a, b] = [await probe(before()), await probe(after())];
    expect(b).toEqual({
      '0x9': [200, 9], '9.0': [200, 9], '+9': [200, 9], '%209': [200, 9], '1e1': [404, 'POST_NOT_FOUND'],
      '-1': [404, 'POST_NOT_FOUND'], 0: [404, 'POST_NOT_FOUND'], 99999999999: [500, 'INTERNAL_ERROR'],
    });
    expect(a).toEqual(b);
    seen.oddIds = b;
  }, 30_000);
});

// ── 축 ③ 목록 응답이 code/p3-50 과 같다 ─────────────────────────────────────────
const VIEWERS = ['jaehoon', 'seoyeon', 'doyun', null];
/** 읽기만 하는 요청들 — 목록(새 주소 · 옛 주소 · 커서 · 옛 숫자 커서 · 거르기 · 잘못된 값)과 상세. */
const readPaths = () => {
  const lists = [];
  for (const limit of [undefined, 1, 2, 3, 5, 7, 50]) lists.push(`/api/v2/posts${limit ? `?limit=${limit}` : ''}`);
  for (const username of ['minji', 'jaehoon', 'seungwoo', 'nobody']) lists.push(`/api/v2/posts?username=${username}`, `/api/v2/posts?username=${username}&limit=1`);
  lists.push('/api/v2/posts?limit=0', '/api/v2/posts?limit=51', '/api/v2/posts?limit=abc', '/api/v2/posts?cursor=abc', '/api/v2/posts?cursor=2', '/api/v2/posts?cursor=9&limit=2', '/api/v2/posts?cursor=999');
  lists.push('/api/posts', '/api/posts?limit=2', '/api/posts?cursor=9', '/api/posts?username=minji', '/api/posts?limit=0');
  const details = [];
  for (const id of [1, 2, 3, 4, 5, 9, 14]) details.push(`/api/v2/posts/${id}`, `/api/posts/${id}`);
  details.push('/api/v2/posts/999999', '/api/posts/999999', '/api/v2/posts/abc');
  return { lists, details };
};
const HEADERS = ['content-type', 'cache-control', 'etag', 'deprecation', 'sunset', 'link'];
/** 한 판에 같은 요청들을 보낸다 — 보는 사람마다, 커서는 받은 nextCursor 를 그대로 따라간다. */
const sendReads = async (from, db) => withServer(from, db, async ({ base }) => {
  const { lists, details } = readPaths();
  const out = [];
  for (const viewer of VIEWERS) {
    const tab = viewer ? await loggedIn(base, viewer) : browser(base);
    const record = async (kind, path) => {
      const res = await tab.get(path);
      out.push({ kind, viewer, path, status: res.status, headers: Object.fromEntries(HEADERS.map((h) => [h, res.headers.get(h)])), body: res.body });
      return res;
    };
    for (const path of lists) await record('list', path);
    // 둘씩 끝까지 — 받은 커서를 그대로 돌려준다
    for (const path of ['/api/v2/posts?limit=2', '/api/posts?limit=2']) {
      let res = await record('list', path);
      while (res.status === 200 && (res.body.data ?? res.body).nextCursor) {
        res = await record('list', `${path}&cursor=${(res.body.data ?? res.body).nextCursor}`);
      }
    }
    for (const path of details) await record('detail', path);
  }
  return out;
});
/** 실패 봉투의 timestamp 는 요청마다 다르다 — 그 값과, 그것이 든 응답의 ETag 만 지운다. */
const scrub = (r) => {
  const body = structuredClone(r.body);
  const headers = { ...r.headers };
  if (body?.error?.timestamp) {
    body.error.timestamp = '<timestamp>';
    headers.etag = '<etag>';
  }
  return { ...r, headers, body };
};

describe('축 ③ 목록 응답은 code/p3-50 과 한 글자도 같다 — 상세의 차이는 liked 한 줄', () => {
  it('🔴 같은 요청을 두 판에 — 목록은 상태 · 헤더(ETag 포함) · 본문 모두 같고, 상세는 보는 사람이 누른 게시물(jaehoon 의 1 · 2 · 9)에서만 liked 와 ETag 가 다르다', async () => {
    await copyDb(GATE_DB);
    const a = (await sendReads(before(), GATE_DB)).map(scrub);
    const b = (await sendReads(after(), GATE_DB)).map(scrub);
    expect(b.map((r) => [r.viewer, r.path])).toEqual(a.map((r) => [r.viewer, r.path]));
    const lists = a.filter((r) => r.kind === 'list');
    // 목록 요청이 실제로 여러 모양을 지났는지 — 200 · 400 · 옛 주소 · 커서를 따라간 페이지
    expect(lists.length).toBeGreaterThan(100);
    expect(new Set(lists.map((r) => r.status))).toEqual(new Set([200, 400, 401]));
    const differ = [];
    a.forEach((r, i) => {
      const s = b[i];
      if (JSON.stringify(r) === JSON.stringify(s)) return;
      const da = r.body?.data ?? r.body;
      const db = s.body?.data ?? s.body;
      const { liked: la, ...ra } = da;
      const { liked: lb, ...rb } = db;
      expect([r.path, ra]).toEqual([r.path, rb]);
      expect([r.path, r.status, s.status]).toEqual([r.path, 200, 200]);
      differ.push(`${r.viewer} ${r.path} liked ${la}→${lb} etag ${r.headers.etag === s.headers.etag ? '같음' : '다름'}`);
    });
    expect(differ).toEqual([
      'jaehoon /api/v2/posts/1 liked false→true etag 다름',
      'jaehoon /api/posts/1 liked false→true etag 다름',
      'jaehoon /api/v2/posts/2 liked false→true etag 다름',
      'jaehoon /api/posts/2 liked false→true etag 다름',
      'jaehoon /api/v2/posts/9 liked false→true etag 다름',
      'jaehoon /api/posts/9 liked false→true etag 다름',
    ]);
    seen.compared = { total: a.length, lists: lists.length, details: a.length - lists.length, differ };
  }, 120_000);

  it('🔴 쓰는 요청도 두 판에 같은 차례로(DB 복사본 둘) — 만들기 · 좋아요 · 고치기 · 취소 · 남의 게시물 403 · 지우기 응답은 상세 한 곳(누른 뒤의 상세 liked)만 다르다', async () => {
    const run = async (from, db) => {
      await copyDb(db);
      return withServer(from, db, async ({ base }) => {
        const [j, s] = [await loggedIn(base, 'jaehoon'), await loggedIn(base, 'seoyeon')];
        const out = [];
        const record = async (title, tab, method, path, body) => {
          const res = await tab.send(method, path, body);
          out.push({ title, status: res.status, body: res.body });
          return res;
        };
        const id = (await record('만들기', j, 'POST', '/api/v2/posts', { imageUrls: ['https://picsum.photos/seed/p351/600/600'], postAlt: '확인용', content: '확인용' })).body.data.id;
        await record('만든 뒤 상세', j, 'GET', `/api/v2/posts/${id}`);
        await record('좋아요', j, 'PUT', `/api/v2/posts/${id}/likes/me`);
        await record('누른 뒤 상세', j, 'GET', `/api/v2/posts/${id}`);
        await record('누른 뒤 목록', j, 'GET', '/api/v2/posts?limit=1');
        await record('seoyeon 이 보는 상세', s, 'GET', `/api/v2/posts/${id}`);
        await record('고치기', j, 'PATCH', `/api/v2/posts/${id}`, { content: '고친 확인용' });
        await record('seoyeon 이 고치기', s, 'PATCH', `/api/v2/posts/${id}`, { content: '남의 것' });
        await record('취소', j, 'DELETE', `/api/v2/posts/${id}/likes/me`);
        await record('취소한 뒤 상세', j, 'GET', `/api/v2/posts/${id}`);
        await record('seoyeon 이 지우기', s, 'DELETE', `/api/v2/posts/${id}`);
        await record('지우기', j, 'DELETE', `/api/v2/posts/${id}`);
        await record('지운 뒤 상세', j, 'GET', `/api/v2/posts/${id}`);
        return out;
      });
    };
    const times = (r) => {
      const body = structuredClone(r.body);
      for (const key of ['createdAt', 'updatedAt']) if (body?.data?.[key]) body.data[key] = '<time>';
      for (const item of body?.data?.items ?? []) { item.createdAt = '<time>'; item.updatedAt = '<time>'; }
      if (body?.data?.nextCursor) body.data.nextCursor = '<cursor>';
      if (body?.error?.timestamp) body.error.timestamp = '<timestamp>';
      return { ...r, body };
    };
    const a = (await run(before(), GATE_DB)).map(times);
    const b = (await run(after(), GATE2_DB)).map(times);
    expect(a.map((r) => [r.title, r.status])).toEqual([
      ['만들기', 201], ['만든 뒤 상세', 200], ['좋아요', 200], ['누른 뒤 상세', 200], ['누른 뒤 목록', 200], ['seoyeon 이 보는 상세', 200],
      ['고치기', 200], ['seoyeon 이 고치기', 403], ['취소', 200], ['취소한 뒤 상세', 200], ['seoyeon 이 지우기', 403], ['지우기', 200], ['지운 뒤 상세', 404],
    ]);
    const differ = a.filter((r, i) => JSON.stringify(r) !== JSON.stringify(b[i])).map((r, i) => r.title);
    expect(differ).toEqual(['누른 뒤 상세']);
    const i = a.findIndex((r) => r.title === '누른 뒤 상세');
    expect([a[i].body.data.liked, b[i].body.data.liked]).toEqual([false, true]);
    // 누른 뒤 목록은 두 판 모두 true — 목록은 원래 셌다
    expect(b.find((r) => r.title === '누른 뒤 목록').body.data.items[0].liked).toBe(true);
  }, 60_000);
});

// ── 축 ④ 쿼리 수 ────────────────────────────────────────────────────────────────
const withQueryLog = (dir) => replaceIn(dir, 'db.js', 'new PrismaClient({ adapter })', "new PrismaClient({ adapter, log: ['query'] })");
const queryLines = (text) => text.split('\n').filter((line) => line.startsWith('prisma:query'));

describe('축 ④ 쿼리 수 — 상세 하나에 쿼리 3 · 고치기 전·뒤 같다', () => {
  it('🔴 두 판 모두 상세 하나에 쿼리 3(게시물 · 글쓴이 · 사진) — 고친 판은 좋아요를 첫 쿼리에 LEFT JOIN 으로 함께 센다(조건 user_id)', async () => {
    await copyDb(GATE_DB);
    const measure = (from) => withServer(from, GATE_DB, async ({ base, tail }) => {
      const tab = await loggedIn(base, 'jaehoon');
      await tab.get('/api/v2/posts/9');
      await sleep(300);
      const at = tail().length;
      const res = await tab.get('/api/v2/posts/9');
      await sleep(300);
      const lines = queryLines(tail().slice(at));
      // 응답 시간 — 같은 요청 30번의 가운데 값(판정하지 않고 남기기만 한다)
      const ms = [];
      for (let n = 0; n < 30; n++) {
        const t = performance.now();
        await tab.get('/api/v2/posts/9');
        ms.push(performance.now() - t);
      }
      ms.sort((x, y) => x - y);
      return { liked: res.body.data.liked, lines, median: Number(ms[15].toFixed(2)) };
    }, { edit: withQueryLog });
    const [a, b] = [await measure(before()), await measure(after())];
    expect([a.liked, b.liked]).toEqual([false, true]);
    expect([a.lines.length, b.lines.length]).toEqual([3, 3]);
    expect(a.lines[0]).not.toContain('post_likes');
    expect(b.lines[0]).toMatch(/LEFT JOIN \(SELECT "public"\."post_likes"\."post_id", COUNT\(\*\) AS "_aggr_count_likes" FROM "public"\."post_likes" WHERE "public"\."post_likes"\."user_id" = \$1 GROUP BY/);
    expect(a.lines.slice(1)).toEqual(b.lines.slice(1));
    seen.queries = { before: a.lines, after: b.lines, medianMs: { before: a.median, after: b.median } };
  }, 60_000);

  it('🔴 누가 보는지 모르면(userId 없이 getPost) 세지 않는다 — liked false · 그 막음을 뺀 판은 누가 누른 좋아요든 세어 true', async () => {
    await copyDb(GATE_DB);
    const call = async (dir) => {
      const childEnv = { ...process.env, DATABASE_URL: dbUrl(GATE_DB) };
      delete childEnv.NODE_ENV;
      const code = `import * as s from './services/postService.js';
        const out = [(await s.getPost(9)).liked, (await s.getPost(9, ${await idOf(GATE_DB, 'jaehoon')})).liked, (await s.getPost(9, ${await idOf(GATE_DB, 'seoyeon')})).liked];
        process.stdout.write(JSON.stringify(out), () => process.exit(0));`;
      const { stdout } = await execFileAsync(process.execPath, ['--input-type=module', '-e', code], { cwd: dir, env: childEnv, encoding: 'utf8' });
      return JSON.parse(stdout.trim().split('\n').pop());
    };
    expect(await call(studentDir(after()))).toEqual([false, true, false]);
    // 막음을 뺀 판 — 누가 보는지 몰라도 _count 를 붙인다
    const trap = studentDir(after(), (dir) => replaceIn(dir, 'services/postService.js',
      '  return userId\n    ? { ...postFields, _count: { select: { likes: { where: { userId } } } } }\n    : postFields;',
      '  return { ...postFields, _count: { select: { likes: { where: { userId } } } } };'));
    expect(await call(trap)).toEqual([true, true, false]);
  }, 30_000);
});

// ── 축 ⑤ requests/post-detail.http ──────────────────────────────────────────────
describe('축 ⑤ requests/post-detail.http — httpYac CLI(--all)로 두 판에', () => {
  it('🔴 여섯 요청 — 고치기 전·뒤 상태가 같고, 두 판 응답 본문의 차이는 «게시물 하나 받기» 의 liked 한 줄(false → true)', async () => {
    const source = read(after()(HTTP_FILE));
    const send = async (from, db) => {
      await copyDb(db);
      return withServer(from, db, () => httpyac(source));
    };
    const a = await send(before(), GATE_DB);
    const b = await send(after(), GATE2_DB);
    const titles = [['로그인', 200], ['게시물 하나 받기', 200], ['같은 게시물을 목록으로 받기', 200], ['그 게시물 좋아요 누르기', 200], ['seoyeon으로 로그인', 200], ['seoyeon이 같은 게시물 받기', 200]];
    expect(a.map((r) => [r.title, r.status])).toEqual(titles);
    expect(b.map((r) => [r.title, r.status])).toEqual(titles);
    expect(a[1].body.data.liked).toBe(false);
    expect(b[1].body.data.liked).toBe(true);
    expect([a[2].body.data.items.map((p) => [p.id, p.liked]), b[2].body.data.items.map((p) => [p.id, p.liked])]).toEqual([[[9, true]], [[9, true]]]);
    expect([a[3].body, b[3].body]).toEqual([{ data: { liked: true, likeCount: 1 } }, { data: { liked: true, likeCount: 1 } }]);
    expect([a[5].body.data.liked, b[5].body.data.liked]).toEqual([false, false]);
    // 본문을 줄로 나눠 맞대 본다 — 시각은 템플릿에서 복사한 DB 라 두 판이 같다(로그인 응답은 그 사람 정보뿐)
    const lines = (r) => JSON.stringify(r.body, null, 2).split('\n');
    const changed = [];
    a.forEach((r, i) => {
      const [x, y] = [lines(r), lines(b[i])];
      expect([r.title, x.length]).toEqual([r.title, y.length]);
      x.forEach((line, k) => { if (line !== y[k]) changed.push([r.title, line.trim(), y[k].trim()]); });
    });
    expect(changed).toEqual([['게시물 하나 받기', '"liked": false', '"liked": true']]);
    const keep = (r) => ({ title: r.title, status: r.status, headers: r.headers, body: r.rawBody });
    seen.http = { before: a.map(keep), after: b.map(keep) };
  }, 60_000);
});

// ── 축 ⑥ 학생 파일 차이 ─────────────────────────────────────────────────────────
describe('축 ⑥ 학생 파일 차이 — code/p3-50 에서', () => {
  it('🔴 Step 4 첫 커밋은 강의 자료 requests/post-detail.http 하나 · Step 4 끝은 그것과 controllers/postController.js · services/postService.js · 새 패키지 · 마이그레이션 없음', () => {
    const commits = stepCommits(4);
    expect(commits.length).toBe(2);
    expect(changedStudentFiles(BASE_REF, commits[1])).toEqual([HTTP_FILE]);
    expect(changedStudentFiles(BASE_REF, commits[0])).toEqual(['controllers/postController.js', HTTP_FILE, 'services/postService.js']);
    for (const rel of ['package.json', 'package-lock.json', 'prisma/schema.prisma']) expect([rel, showAt(commits[0], rel)]).toEqual([rel, showAt(BASE_REF, rel)]);
    expect(readdirSync(after()('prisma/migrations'))).toEqual(readdirSync(before()('prisma/migrations')));
    seen.changedFiles = changedStudentFiles(BASE_REF, commits[0]);
  });

  it('🔴 바뀐 것 — 상세가 로그인 정보를 넘기고, «누가 보는지 알 때만 센다» 가 함수 하나(fieldsFor)에 있다 · 목록과 상세가 그 함수를 쓴다 · 만들기 · 고치기 · 지우기는 그대로 postFields', () => {
    const service = read(after()('services/postService.js'));
    expect(service.match(/_count: \{ select/g)).toHaveLength(1);
    expect(service.match(/function fieldsFor\(userId\)/g)).toHaveLength(1);
    expect(service.match(/select: fieldsFor\(userId\)/g)).toHaveLength(2);
    expect(service.match(/select: postFields/g)).toHaveLength(3);
    expect(service).toContain('export async function getPost(id, userId) {');
    const controller = read(after()('controllers/postController.js'));
    expect(controller).toContain('const post = await postService.getPost(req.postId, res.locals.userId);');
    // 바뀐 줄은 이것뿐이다 — 목록의 세는 코드를 함수로 옮기고(조건 · 세는 식은 그대로) 상세가 그 함수를 쓴다. 나머지 함수는 한 글자도 안 바뀌었다
    const diff = execFileSync('git', ['diff', '-U0', BASE_REF, ...(afterRef() ? [afterRef()] : []), '--', 'controllers/postController.js', 'services/postService.js'], { cwd: P('.'), encoding: 'utf8' });
    const changed = diff.split('\n').filter((line) => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line));
    const COUNT = '{ ...postFields, _count: { select: { likes: { where: { userId } } } } }';
    expect(changed).toEqual([
      '-  const post = await postService.getPost(req.postId);',
      '+  // 상세도 목록과 같다 — 보는 사람은 로그인 정보로 정하고, 그 사람이 누른 좋아요가 liked 로 간다.',
      '+  const post = await postService.getPost(req.postId, res.locals.userId);',
      '+// 보는 사람이 누른 좋아요를 센다 — 목록과 상세가 같은 기준이다.',
      '+// 누가 보는지 알 때만 센다. userId 가 undefined 면 `where` 가 «조건 없음» 이 되어 누가 누른 좋아요든 다 센다.',
      '+function fieldsFor(userId) {',
      '+  return userId',
      `+    ? ${COUNT}`,
      '+    : postFields;',
      '+}',
      '+',
      '-  // 누가 보는지 알 때만 그 사람이 누른 좋아요를 센다.',
      '-  // userId 가 undefined 면 `where` 가 «조건 없음» 이 되어 누가 누른 좋아요든 다 센다.',
      '-  const fields = userId',
      `-    ? ${COUNT}`,
      '-    : postFields;',
      '-',
      '-    select: fields,',
      '+    select: fieldsFor(userId),',
      '-export async function getPost(id) {',
      '+export async function getPost(id, userId) {',
      '-    select: postFields,',
      '+    select: fieldsFor(userId),',
    ]);
    seen.diff = diff;
  });

  it('🔴 학생 파일에 내부 어휘가 없다 · 첫 줄 경로 주석 · 쓰지 않기로 한 낱말이 없다', () => {
    const ref = afterRef() ?? 'HEAD';
    for (const rel of changedStudentFiles(BASE_REF, afterRef())) {
      const text = WT === 4 ? read(P(rel)) : showAt(ref, rel);
      expect([rel, /게이트|판정|TDD|Step \d|p3-\d\d|회차/.test(text)]).toEqual([rel, false]);
      if (rel.endsWith('.js')) expect([rel, text.split('\n')[0]]).toEqual([rel, `// ~/instagram-api/${rel}`]);
    }
    // «돌려준다»(값을 돌려주다 — return)는 이 코드베이스가 늘 쓰는 다른 낱말이라 뺀다
    const banned = /자리|박다|박아|박힌|결[이을로의]|갈래|몸통|판[이을으]|겹|까닭|걸리|걸린|돌리|돌려(?!주|준|줄)|가르|갈리|재다|재서|벗기|되살/;
    const diff = execFileSync('git', ['diff', BASE_REF, ...(afterRef() ? [afterRef()] : []), '--', ...STUDENT_FILES], { cwd: P('.'), encoding: 'utf8' });
    const added = diff.split('\n').filter((line) => line.startsWith('+') && !line.startsWith('+++'));
    expect(added.length).toBeGreaterThan(0);
    expect(added.filter((line) => banned.test(line))).toEqual([]);
  });
});
