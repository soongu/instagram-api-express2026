// p3-52 「내 게시물 고치기·지우기」 게이트 — 백엔드(교안 Step 1 의 강의 자료 · Step 5 «고치기 응답도 보는 사람 기준»)
// 내부 검증 전용 — 교안에 한 줄도 인용하지 않는다.
//
// `8-fullstack-features` 넷째 회차다(`curriculum.md` 「`p3-52` 착수 결정」 ①·④). 화면(Step 2~4 · 6~8)은 `instagram-next/.verify` 가 본다.
// 백엔드의 시작 판은 `code/p3-51` 이다. Step 1 은 강의 자료 requests/post-author.http 하나(커밋 하나 · 고친 코드 없음).
// Step 5 는 커밋 둘 — 먼저 그 .http 에 «내 게시물» 요청을 더한 겪기 판(고친 코드 없음), 그다음 고친 판(같은 «(Step 5)» 표식 · 가장 뒤 커밋).
// 🔑 짓는 동안 `P352_WT` 를 주면 그 판을 커밋 대신 작업트리에서 읽는다 — `1`(Step 1) · `5a`(Step 5 겪기 판) · `5`(Step 5 고친 판 · 겪기 판은 커밋).
// 🔑 포트 — 3860 · 3861(둘째 서버). DB — `p352_api_` 로 시작하는 것만 만들고 지운다. `P352_PG_PORT` 로 PostgreSQL 호스트 포트를 바꾼다.
// 🔑 판정 DB 는 «학생 DB» 처럼(progress/reading-tools/next/STUDENT-ENV-p3-51.example.md 「데이터베이스」) — 시드 뒤 jaehoon 밖 password_hash 를 지우고
//    seoyeon · doyun 을 가입 API 로 넣고 · 관리자 admin.hong(ADMIN · 비밀번호 admin1234! — p3-43) · 9번(minji «제주 왔어요 🌊» · 사진은 picsum 둘) ·
//    jaehoon 의 좋아요 1·2·9 · jaehoon 의 게시물 14 «바다에 다녀왔어요» · 15~18 «느린 네트워크» · 19 «지난 주말에 다녀온 바다»(사진은 /uploads/ 한 장씩 ·
//    업로드 기록이 있다 · 19 의 파일은 폴더에 없다 — p3-50 Step 4 에서 지워졌다) · 다음 게시물 번호 26.
//    🚨 번호는 학생마다 다를 수 있다 — 판정은 «9번» 밖의 번호를 고정값으로 쓰지 않고 글로 찾는다.
// 🔑 uploads 폴더 — 템플릿을 세운 서버의 uploads/ 를 떠 두었다가 판정 서버마다 학생 폴더 사본에 깔아 준다.
//
// 축 ① Step 1 판 — post-author.http 를 httpYac CLI(--all)로: 상태 줄 · 실패 봉투 NOT_POST_AUTHOR 둘 · /me 의 role · 9번의 authorId 가 minji · 데이터베이스는 그대로
// 축 ② 서버 규칙(이미 있음 — 회귀로 잠근다) — 시작 판과 고친 판에 같은 차례로 · 남의 게시물 403 · 관리자 · 내 게시물 · 사진 파일과 업로드 기록 · 본문 검사가 먼저
//      · 막음을 뺀 판(updatePost 의 checkAuthor 한 줄을 지우면 남의 글을 고친다)
// 축 ③ Step 5 겪기 판 — 좋아요를 누른 내 게시물을 고치면 응답 liked false · 같은 순간 상세는 true
// 축 ④ Step 5 고친 판 — 응답 liked true · seoyeon 이 받은 상세는 false · 고치기 전·뒤 응답 차이는 liked 한 줄 · 쿼리 수 그대로 · 만들기·지우기 응답은 그대로
// 축 ⑤ 학생 파일 차이 — Step 1 은 requests/ 한 파일 · Step 5 는 requests/ 와 services/postService.js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, mkdtempSync, rmSync, cpSync, symlinkSync, existsSync, readdirSync, writeFileSync, openSync, closeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { boot } from './helpers/boot.js';

const ROOT = new URL('../', import.meta.url);
const P = (rel) => new URL(rel, ROOT).pathname;
const read = (path) => readFileSync(path, 'utf8');
const PG_PORT = Number(process.env.P352_PG_PORT ?? 5432);
const ADMIN = { host: 'localhost', port: PG_PORT, database: 'postgres', user: 'postgres', password: 'postgres' };
const TPL_DB = 'p352_api_tpl';
const GATE_DB = 'p352_api_gate';
const GATE2_DB = 'p352_api_gate2';
const dbUrl = (name) => `postgresql://postgres:postgres@localhost:${PG_PORT}/${name}`;
const PORT = 3860;
const PORT2 = 3861;
const SECRET = 'q2Xh0v9bGm4RkT7sYp1wLc8nZf3uJd6eHa5iVo0rQyE';
const PROVIDER_ENV = {
  GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret', SITE_URL: `http://localhost:${PORT}`,
  KAKAO_CLIENT_ID: 'test-kakao', KAKAO_CLIENT_SECRET: 'test-kakao-secret',
  NAVER_CLIENT_ID: 'test-naver', NAVER_CLIENT_SECRET: 'test-naver-secret',
};
const env = { CORS_ORIGIN: 'http://localhost:3001', JWT_SECRET: SECRET, ...PROVIDER_ENV };
const STUDENT_FILES = ['app.js', 'db.js', 'errors.js', 'responses.js', 'routes', 'controllers', 'services', 'middlewares', 'schemas', 'strategies', 'docs', 'package.json', 'requests', 'seed.js', 'data', 'prisma', 'prisma.config.js', '.env.example'];
const BASE_REF = 'code/p3-51';
const HTTP_FILE = 'requests/post-author.http';
const ISO = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;
const UUID_FILE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/;

const hasRef = (ref) => {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', ref], { cwd: P('.'), stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
};
const LINE = hasRef('refs/heads/code/p3-52') ? 'code/p3-52' : 'main';
const WT = process.env.P352_WT ?? null;
/** «(Step N)» 표식이 붙은 이 회차 커밋들 — 새것부터. */
const stepCommits = (n) => {
  const log = execFileSync('git', ['log', '-n', '400', '--format=%H %s', LINE], { cwd: P('.'), encoding: 'utf8' });
  const hits = log.split('\n').filter((l) => / feat\(p3-52\): /.test(l) && l.endsWith(`(Step ${n})`)).map((l) => l.split(' ')[0]);
  if (hits.length === 0) throw new Error(`(Step ${n}) 커밋이 없다`);
  return hits;
};
const dirs = [];
const refDirs = new Map();
/** 커밋(또는 브랜치) 하나를 임시 폴더에 풀어 둔다. */
const refDir = (ref) => {
  if (refDirs.has(ref)) return refDirs.get(ref);
  const dir = mkdtempSync(join(tmpdir(), 'p352-ref-'));
  const tar = execFileSync('git', ['archive', '--format=tar', ref], { cwd: P('.'), maxBuffer: 1 << 28 });
  execFileSync('tar', ['-x', '-C', dir], { input: tar });
  dirs.push(dir);
  const at = (rel) => join(dir, rel);
  refDirs.set(ref, at);
  return at;
};
const worktree = (rel) => P(rel);
const base = () => refDir(BASE_REF);
/** Step 1 의 판 — 강의 자료 하나. */
const step1 = () => (WT === '1' ? worktree : refDir(stepCommits(1)[0]));
/** Step 5 겪기 판 — 가장 앞 «(Step 5)» 커밋(.http 에 요청을 더했고 고친 코드는 없다). */
const trapRef = () => (WT === '5a' ? null : stepCommits(5).at(-1));
const trap = () => (WT === '5a' ? worktree : refDir(trapRef()));
/** Step 5 고친 판 — 가장 뒤 «(Step 5)» 커밋. */
const fixedRef = () => (WT === '5' ? null : stepCommits(5)[0]);
const fixed = () => (WT === '5' ? worktree : refDir(fixedRef()));
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
/** 글로 게시물 하나를 찾는다 — 같은 글이 둘 이상이면 멈춘다. */
const postIdByContent = async (db, content) => {
  const rows = await onDb(db, 'SELECT id FROM posts WHERE content = $1', [content]);
  if (rows.length !== 1) throw new Error(`«${content}» 게시물이 ${rows.length}개다`);
  return rows[0].id;
};
/** 데이터베이스에서 이 회차가 건드릴 수 있는 것 전부 — 요청을 보낸 앞뒤를 맞대 본다. */
const dbState = async (db) => (await onDb(db, `SELECT json_build_object(
  'posts', (SELECT json_agg(json_build_object('id', id, 'author', author_id, 'content', content, 'alt', post_alt, 'likes', like_count, 'updated', updated_at) ORDER BY id) FROM posts),
  'likes', (SELECT string_agg(post_id || ':' || user_id, ',' ORDER BY post_id, user_id) FROM post_likes),
  'images', (SELECT json_agg(json_build_object('post', post_id, 'url', image_url, 'order', img_order) ORDER BY id) FROM post_images),
  'uploads', (SELECT json_agg(json_build_object('file', file_name, 'post', post_id) ORDER BY id) FROM uploads)
) AS s`))[0].s;

const replaceIn = (dir, rel, a, b) => {
  const text = read(join(dir, rel));
  if (text.split(a).length !== 2) throw new Error(`${rel} 에 바꿀 글자가 없거나 여럿이다: ${a}`);
  writeFileSync(join(dir, rel), text.replace(a, b));
};
/** 템플릿을 세운 서버의 uploads 폴더를 떠 둔 곳 — 판정 서버마다 사본을 깐다. */
let TPL_UPLOADS = null;
const studentDir = (from, edit) => {
  const dir = mkdtempSync(join(tmpdir(), 'p352-srv-'));
  for (const name of STUDENT_FILES) {
    if (existsSync(from(name))) cpSync(from(name), join(dir, name), { recursive: true });
  }
  if (TPL_UPLOADS) cpSync(TPL_UPLOADS, join(dir, 'uploads'), { recursive: true });
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
const uploadedFiles = (dir) => (existsSync(join(dir, 'uploads')) ? readdirSync(join(dir, 'uploads')).sort() : []);

// 학생 DB 에서 비밀번호가 있는 사람 — jaehoon 은 p3-40 의 set-password.js, seoyeon · doyun 은 p3-39 에 auth.http 로 가입, admin.hong 은 p3-43 의 관리자.
const PASSWORDS = { jaehoon: 'jaehoon1234', seoyeon: 'instagram1234', doyun: 'instagram1234', 'admin.hong': 'admin1234!' };
/** 쿠키를 기억하는 탭 하나 — Access 토큰 쿠키만 기억한다(Refresh 쿠키는 Path 가 /api/v2/auth). */
const browser = (url) => {
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
    return { status: res.status, headers: res.headers, body: parsed, text };
  };
  return {
    send,
    get: (path) => send('GET', path),
    login: (username, password = PASSWORDS[username]) => send('POST', '/api/v2/auth/login', { username, password }),
  };
};
/** 로그인한 탭 — 로그인이 200 이 아니면 멈춘다. */
const loggedIn = async (url, username) => {
  const tab = browser(url);
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

/** 화면 «공유하기» 처럼 — 사진을 먼저 올리고 그 주소로 게시물을 만든다. 만든 번호와 사진 파일 이름을 돌려준다. */
const share = async (tab, content, postAlt) => {
  const form = new FormData();
  form.append('images', new Blob([photo('beach.jpg')], { type: 'image/jpeg' }), 'beach.jpg');
  const uploaded = await tab.send('POST', '/api/v2/uploads', form);
  expect(uploaded.status).toBe(201);
  const created = await tab.send('POST', '/api/v2/posts', { imageUrls: uploaded.body.data.imageUrls, postAlt, content });
  expect(created.status).toBe(201);
  return { id: created.body.data.id, fileName: uploaded.body.data.imageUrls[0].replace('/uploads/', '') };
};

/**
 * 템플릿을 학생 DB 처럼 — `url` 은 그 DB 로 띄운 시작 판 서버, `dir` 은 그 서버의 학생 폴더 사본.
 * 게시물 최신순 19·18·17·16·15·14·9·1·2·3·4·5 · 좋아요 jaehoon 이 1·2·9 · 업로드 기록 6(14~19) · 폴더의 파일 5(19 의 파일이 없다).
 */
const toStudentState = async (url, dir, from) => {
  await onDb(TPL_DB, "UPDATE users SET password_hash = NULL WHERE username <> 'jaehoon'");
  const bodies = signupBodies(from);
  expect(bodies.map((b) => b.username)).toEqual(['seoyeon', 'doyun']);
  for (const body of bodies) {
    const res = await fetch(`${url}/api/v2/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    expect(res.status).toBe(201);
  }
  // p3-43 — 관리자 스크립트로 넣고 역할을 ADMIN 으로 바꾼 admin.hong
  await onDb(TPL_DB, "INSERT INTO users (username, name, phone, password_hash, role) VALUES ('admin.hong', '관리자', '01077771234', $1, 'ADMIN')",
    [await bcrypt.hash(PASSWORDS['admin.hong'], 12)]);
  // p3-34 Step 2 — 7·8번을 지우는 사이에 «게시물 올리기» 로 9번(그때는 본문의 authorId 3 = minji)
  await onDb(TPL_DB, "SELECT setval('posts_id_seq', 8)");
  const minji = browser(url);
  const nine = await minji.send('POST', '/api/v2/posts', post9Body(from), { Authorization: `Bearer ${tokenFor(await idOf(TPL_DB, 'minji'))}` });
  expect([nine.status, nine.body.data.id, nine.body.data.username, nine.body.data.content]).toEqual([201, 9, 'minji', '제주 왔어요 🌊']);
  const jaehoon = await loggedIn(url, 'jaehoon');
  for (const id of [1, 2, 9]) expect((await jaehoon.send('PUT', `/api/v2/posts/${id}/likes/me`)).status).toBe(200);
  // p3-49 — 화면 «공유하기» 로 14(Step 6) · 15~18(Step 8 의 느린 네트워크)
  await onDb(TPL_DB, "SELECT setval('posts_id_seq', 13)");
  await share(jaehoon, '바다에 다녀왔어요', '바다에 다녀왔어요');
  for (let n = 0; n < 4; n++) await share(jaehoon, '느린 네트워크', '느린 네트워크');
  // p3-50 Step 4 — photo-owner.http 의 «그 사진으로 게시물 만들기»(19) · seoyeon 이 같은 주소로 만든 게시물을 지울 때 그 파일이 지워졌다
  const nineteen = await share(jaehoon, '지난 주말에 다녀온 바다', '바닷가 사진');
  rmSync(join(dir, 'uploads', nineteen.fileName));
  // 그 뒤 20~25 는 번호만 쓰였다 — 다음 게시물은 26
  await onDb(TPL_DB, "SELECT setval('posts_id_seq', 25)");
  TPL_UPLOADS = mkdtempSync(join(tmpdir(), 'p352-uploads-'));
  dirs.push(TPL_UPLOADS);
  cpSync(join(dir, 'uploads'), TPL_UPLOADS, { recursive: true });
};

/** httpYac CLI 로 `.http` 한 파일을 통째로 보낸다(`--all --json`) — 학생이 VS Code 에서 위에서부터 차례로 누르는 것과 같다. */
const httpyac = async (source, port = PORT) => {
  const dir = mkdtempSync(join(tmpdir(), 'p352-http-'));
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
    title: r.title, status: r.response?.statusCode, statusLine: `${r.response?.protocol} ${r.response?.statusCode} ${r.response?.statusMessage}`,
    headers: r.response?.headers, rawBody: r.response?.body, body: parse(r.response?.body),
  }));
};
/** .http 의 블록 — 제목 · 요청 줄. 맨 위(첫 ### 앞)는 `head` 로 따로. */
const blocksOf = (text) => {
  const [head, ...rest] = text.split(/^### /m);
  return { head, blocks: rest.map((block) => ({ title: block.split('\n')[0], request: block.split('\n').find((line) => /^(GET|POST|PUT|PATCH|DELETE) /.test(line)) })) };
};
/** 학생이 적는 «주소창의 번호» — 파일의 `@postId = …` 한 줄을 판정 DB 의 그 게시물 번호로 바꾼다. */
const withPostId = (text, id) => {
  const lines = text.split('\n').filter((line) => /^@postId = /.test(line));
  expect(lines).toHaveLength(1);
  return text.replace(/^@postId = .*$/m, `@postId = ${id}`);
};

/** 교안에 인용할 실측 글자 — `P352_SEEN=경로` 를 주면 파일로 남긴다(보고용). */
const seen = {};

beforeAll(async () => {
  await admin(async (client) => {
    for (const name of [GATE_DB, GATE2_DB, TPL_DB]) {
      await kick(client, name);
      await client.query(`DROP DATABASE IF EXISTS ${name}`);
    }
    await client.query(`CREATE DATABASE ${TPL_DB}`);
  });
  // 템플릿은 시작 판(code/p3-51)의 마이그레이션 + 시드 + 학생 DB 의 쓰기
  const from = base();
  for (const dir of readdirSync(from('prisma/migrations')).filter((name) => name !== 'migration_lock.toml').sort()) {
    await onDb(TPL_DB, read(from(`prisma/migrations/${dir}/migration.sql`)));
  }
  const seedDir = studentDir(from);
  const childEnv = { ...process.env, DATABASE_URL: dbUrl(TPL_DB) };
  delete childEnv.NODE_ENV;
  execFileSync(process.execPath, [join(seedDir, 'seed.js')], { cwd: seedDir, encoding: 'utf8', env: childEnv });
  await withServer(from, TPL_DB, ({ base: url, dir }) => toStudentState(url, dir, from), { port: PORT2 });
  expect((await onDb(TPL_DB, "SELECT string_agg(id::text, ',' ORDER BY created_at DESC, id DESC) AS ids FROM posts"))[0].ids).toBe('19,18,17,16,15,14,9,1,2,3,4,5');
  expect((await onDb(TPL_DB, "SELECT string_agg(post_id || ':' || user_id, ',' ORDER BY post_id) AS l FROM post_likes"))[0].l).toBe('1:2,2:2,9:2');
  expect(await onDb(TPL_DB, "SELECT username, role FROM users WHERE password_hash IS NOT NULL ORDER BY id"))
    .toEqual([{ username: 'jaehoon', role: 'USER' }, { username: 'seoyeon', role: 'USER' }, { username: 'doyun', role: 'USER' }, { username: 'admin.hong', role: 'ADMIN' }]);
  const uploads = await onDb(TPL_DB, 'SELECT file_name, post_id FROM uploads ORDER BY id');
  expect(uploads.map((u) => u.post_id)).toEqual([14, 15, 16, 17, 18, 19]);
  // 폴더에는 19 의 사진만 없다
  expect(readdirSync(TPL_UPLOADS).sort()).toEqual(uploads.filter((u) => u.post_id !== 19).map((u) => u.file_name).sort());
  expect((await onDb(TPL_DB, "SELECT nextval('posts_id_seq') AS n"))[0].n).toBe('26');
  await onDb(TPL_DB, "SELECT setval('posts_id_seq', 25)");
}, 180_000);

afterAll(async () => {
  for (const name of [GATE_DB, GATE2_DB, TPL_DB]) await dropDb(name);
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  if (process.env.P352_SEEN) writeFileSync(process.env.P352_SEEN, JSON.stringify(seen, null, 2));
});

// ── 축 ① Step 1 판 ──────────────────────────────────────────────────────────────
const STEP1_BLOCKS = [
  ['jaehoon으로 로그인', 'POST http://localhost:3000/api/v2/auth/login'],
  ['나는 누구', 'GET http://localhost:3000/api/v2/auth/me'],
  ['9번 게시물 받기', 'GET http://localhost:3000/api/v2/posts/9'],
  ['9번 게시물의 글 고치기', 'PATCH http://localhost:3000/api/v2/posts/9'],
  ['9번 게시물 지우기', 'DELETE http://localhost:3000/api/v2/posts/9'],
];

describe('축 ① Step 1 판 — requests/post-author.http 를 httpYac CLI(--all)로 학생 DB 에', () => {
  it('🔴 다섯 요청 — 로그인 · 나는 누구(id · username · profileImage · role) · 9번 받기(authorId 가 minji) · 9번 고치기 403 · 9번 지우기 403(NOT_POST_AUTHOR) · 데이터베이스와 uploads 폴더는 그대로', async () => {
    const text = read(step1()(HTTP_FILE));
    // 꼴 — 맨 위부터 `### ` · jaehoon 이 자기 게시물을 고치거나 지우는 요청은 없다
    const { head, blocks } = blocksOf(text);
    expect(head).toBe('');
    expect(blocks.map((b) => [b.title, b.request])).toEqual(STEP1_BLOCKS);
    expect(text.endsWith('\n')).toBe(true);
    await copyDb(GATE_DB);
    const before = await dbState(GATE_DB);
    const minjiId = await idOf(GATE_DB, 'minji');
    const [jaehoonRow] = await onDb(GATE_DB, "SELECT id, profile_image FROM users WHERE username = 'jaehoon'");
    const { runs, files, filesAfter } = await withServer(step1(), GATE_DB, async ({ dir }) => {
      const files0 = uploadedFiles(dir);
      const out = await httpyac(text);
      return { runs: out, files: files0, filesAfter: uploadedFiles(dir) };
    });
    expect(runs.map((r) => [r.title, r.status])).toEqual([
      ['jaehoon으로 로그인', 200], ['나는 누구', 200], ['9번 게시물 받기', 200], ['9번 게시물의 글 고치기', 403], ['9번 게시물 지우기', 403],
    ]);
    // 상태 줄 — httpYac 이 응답 첫 줄에 보여 주는 글자
    expect(runs.map((r) => r.statusLine)).toEqual(['HTTP/1.1 200 OK', 'HTTP/1.1 200 OK', 'HTTP/1.1 200 OK', 'HTTP/1.1 403 Forbidden', 'HTTP/1.1 403 Forbidden']);
    expect(runs[1].body).toEqual({ data: { id: jaehoonRow.id, username: 'jaehoon', profileImage: jaehoonRow.profile_image, role: 'USER' } });
    expect(Object.keys(runs[1].body.data)).toEqual(['id', 'username', 'profileImage', 'role']);
    expect(runs[2].body.data).toMatchObject({ id: 9, authorId: minjiId, username: 'minji', content: '제주 왔어요 🌊', liked: true });
    expect(runs[2].body.data.authorId).not.toBe(runs[1].body.data.id);
    for (const [i, method] of [[3, 'PATCH'], [4, 'DELETE']]) {
      expect([method, runs[i].body]).toEqual([method, { error: { code: 'NOT_POST_AUTHOR', message: '내가 쓴 게시물만 고치거나 지울 수 있어요', path: '/api/v2/posts/9', timestamp: expect.stringMatching(ISO) } }]);
      expect(Object.keys(runs[i].body.error)).toEqual(['code', 'message', 'path', 'timestamp']);
    }
    expect(await dbState(GATE_DB)).toEqual(before);
    expect(filesAfter).toEqual(files);
    seen.step1 = { file: text, runs: runs.map((r) => ({ title: r.title, statusLine: r.statusLine, contentType: r.headers?.['content-type'], body: r.rawBody })) };
  }, 60_000);
});

// ── 축 ② 서버 규칙 — 시작 판과 고친 판에 같은 차례로 ────────────────────────────────
/** 고치기 · 지우기 규칙을 한 차례로 — 누가 · 무엇을 · 응답. 사진 파일과 업로드 기록도 함께 본다. */
const rules = async (from, db) => {
  await copyDb(db);
  const [fourteen, nineteen] = [await postIdByContent(db, '바다에 다녀왔어요'), await postIdByContent(db, '지난 주말에 다녀온 바다')];
  const fileOf = async (id) => (await onDb(db, 'SELECT file_name FROM uploads WHERE post_id = $1', [id]))[0].file_name;
  const [file14, file19] = [await fileOf(fourteen), await fileOf(nineteen)];
  return withServer(from, db, async ({ base: url, dir, tail }) => {
    const [j, s, a, nobody] = [await loggedIn(url, 'jaehoon'), await loggedIn(url, 'seoyeon'), await loggedIn(url, 'admin.hong'), browser(url)];
    const out = [];
    const record = async (title, tab, method, path, body) => {
      const res = await tab.send(method, path, body);
      out.push({ title, status: res.status, body: res.body });
      return res;
    };
    await record('jaehoon 이 9번 글 고치기', j, 'PATCH', '/api/v2/posts/9', { content: 'jaehoon이 고친 글' });
    await record('jaehoon 이 9번 지우기', j, 'DELETE', '/api/v2/posts/9');
    await record('jaehoon 이 9번 글을 숫자로', j, 'PATCH', '/api/v2/posts/9', { content: 123 });
    await record('jaehoon 이 9번 사진 바꾸기', j, 'PATCH', '/api/v2/posts/9', { imageUrls: ['https://picsum.photos/seed/x/600/600'] });
    await record('seoyeon 이 14 고치기', s, 'PATCH', `/api/v2/posts/${fourteen}`, { content: '남의 글' });
    await record('seoyeon 이 14 지우기', s, 'DELETE', `/api/v2/posts/${fourteen}`);
    await record('로그인 없이 14 고치기', nobody, 'PATCH', `/api/v2/posts/${fourteen}`, { content: '누구?' });
    await record('로그인 없이 14 지우기', nobody, 'DELETE', `/api/v2/posts/${fourteen}`);
    await record('없는 번호 고치기', j, 'PATCH', '/api/v2/posts/999999', { content: '없는 글' });
    await record('없는 번호 지우기', j, 'DELETE', '/api/v2/posts/999999');
    await record('관리자가 9번 글 고치기', a, 'PATCH', '/api/v2/posts/9', { content: '관리자가 고친 글' });
    await record('관리자가 9번 지우기', a, 'DELETE', '/api/v2/posts/9');
    await record('관리자가 지운 9번', j, 'GET', '/api/v2/posts/9');
    await record('jaehoon 이 14 글 고치기', j, 'PATCH', `/api/v2/posts/${fourteen}`, { content: '주말에 바다에 다녀왔어요' });
    await record('jaehoon 이 14 사진만 보내기', j, 'PATCH', `/api/v2/posts/${fourteen}`, { imageUrls: ['https://picsum.photos/seed/x/600/600'] });
    const files0 = uploadedFiles(dir);
    await record('jaehoon 이 14 지우기', j, 'DELETE', `/api/v2/posts/${fourteen}`);
    await record('지운 14', j, 'GET', `/api/v2/posts/${fourteen}`);
    const photo14 = await fetch(`${url}/uploads/${file14}`);
    const files1 = uploadedFiles(dir);
    const logAt = tail().length;
    await record('jaehoon 이 19 지우기(파일이 이미 없다)', j, 'DELETE', `/api/v2/posts/${nineteen}`);
    await record('지운 19', j, 'GET', `/api/v2/posts/${nineteen}`);
    await sleep(200);
    return {
      out, fourteen, nineteen, file14, file19, files0, files1, files2: uploadedFiles(dir), photo14: photo14.status,
      log19: tail().slice(logAt),
      uploads: await onDb(db, 'SELECT file_name, post_id FROM uploads ORDER BY id'),
      slow: (await onDb(db, "SELECT id FROM posts WHERE content = '느린 네트워크' ORDER BY id")).map((row) => row.id),
      likes9: (await onDb(db, 'SELECT count(*)::int AS n FROM post_likes WHERE post_id = 9'))[0].n,
    };
  });
};
/** 실행마다 다른 값 — 시각 · 실패 봉투의 timestamp — 를 지운다. */
const scrubTimes = (r) => {
  const body = structuredClone(r.body);
  for (const key of ['createdAt', 'updatedAt']) if (body?.data?.[key]) body.data[key] = '<time>';
  if (body?.error?.timestamp) body.error.timestamp = '<timestamp>';
  return { ...r, body };
};

describe('축 ② 서버 규칙 — 이미 있는 고치기·지우기 규칙(회귀) · 시작 판과 고친 판이 같다', () => {
  it('🔴 남의 게시물 403 · 본문 검사가 먼저(숫자 글 400 · 사진 목록은 버려져 403) · 로그인 없이 401 · 없는 번호 404 · 관리자는 지우기 200 · 고치기 403 · 내 게시물 고치기 200 · 지우기 200 뒤 404 · 사진 파일과 업로드 기록이 사라진다 · 파일이 이미 없는 19 도 200', async () => {
    const a = await rules(base(), GATE_DB);
    const b = await rules(fixed(), GATE2_DB);
    const statuses = [
      ['jaehoon 이 9번 글 고치기', 403, 'NOT_POST_AUTHOR'], ['jaehoon 이 9번 지우기', 403, 'NOT_POST_AUTHOR'],
      ['jaehoon 이 9번 글을 숫자로', 400, 'VALIDATION_FAILED'], ['jaehoon 이 9번 사진 바꾸기', 403, 'NOT_POST_AUTHOR'],
      ['seoyeon 이 14 고치기', 403, 'NOT_POST_AUTHOR'], ['seoyeon 이 14 지우기', 403, 'NOT_POST_AUTHOR'],
      ['로그인 없이 14 고치기', 401, 'LOGIN_REQUIRED'], ['로그인 없이 14 지우기', 401, 'LOGIN_REQUIRED'],
      ['없는 번호 고치기', 404, 'POST_NOT_FOUND'], ['없는 번호 지우기', 404, 'POST_NOT_FOUND'],
      ['관리자가 9번 글 고치기', 403, 'NOT_POST_AUTHOR'], ['관리자가 9번 지우기', 200, undefined], ['관리자가 지운 9번', 404, 'POST_NOT_FOUND'],
      ['jaehoon 이 14 글 고치기', 200, undefined], ['jaehoon 이 14 사진만 보내기', 200, undefined],
      ['jaehoon 이 14 지우기', 200, undefined], ['지운 14', 404, 'POST_NOT_FOUND'],
      ['jaehoon 이 19 지우기(파일이 이미 없다)', 200, undefined], ['지운 19', 404, 'POST_NOT_FOUND'],
    ];
    for (const run of [a, b]) expect(run.out.map((r) => [r.title, r.status, r.body?.error?.code])).toEqual(statuses);
    // 두 판의 응답이 시각 밖으로는 한 글자도 같다 — 이 차례에는 jaehoon 이 좋아요를 누른 게시물을 고치는 일이 없다
    expect(b.out.map(scrubTimes)).toEqual(a.out.map(scrubTimes));
    const at = (title) => b.out.find((r) => r.title === title);
    // 본문 검사가 글쓴이 확인보다 먼저다 — 남의 게시물이어도 글이 숫자면 400 · 모르는 필드(imageUrls)는 검사에서 버려져 403
    expect(at('jaehoon 이 9번 글을 숫자로').body.error).toMatchObject({ code: 'VALIDATION_FAILED', details: expect.any(Object) });
    // 내 게시물 — 고친 글 · 사진만 보내면 아무것도 안 바뀐다(사진은 그대로 · 글도 그대로)
    expect(at('jaehoon 이 14 글 고치기').body.data).toMatchObject({ id: b.fourteen, content: '주말에 바다에 다녀왔어요', imageUrls: [`/uploads/${b.file14}`] });
    expect(at('jaehoon 이 14 사진만 보내기').body.data).toMatchObject({ content: '주말에 바다에 다녀왔어요', imageUrls: [`/uploads/${b.file14}`] });
    expect(at('관리자가 9번 지우기').body.data).toMatchObject({ id: 9, username: 'minji' });
    expect(b.likes9).toBe(0);
    // 사진 — 14 를 지우면 파일과 기록이 함께 사라진다 · 19 는 파일이 이미 없어도 200 이고 기록이 사라진다(터미널에 에러 줄 없음)
    expect(b.files0).toContain(b.file14);
    expect(b.files1).not.toContain(b.file14);
    expect(b.files1).toEqual(b.files0.filter((name) => name !== b.file14));
    expect(b.photo14).toBe(404);
    expect(b.files0).not.toContain(b.file19);
    expect(b.files2).toEqual(b.files1);
    expect(b.log19).not.toMatch(/Error|ENOENT/);
    expect(b.uploads.map((u) => u.file_name)).not.toContain(b.file14);
    expect(b.uploads.map((u) => u.file_name)).not.toContain(b.file19);
    expect(b.slow).toHaveLength(4);
    expect(b.uploads.map((u) => u.post_id)).toEqual(b.slow);
    expect(b.files2.filter((name) => UUID_FILE.test(name))).toHaveLength(4);
    seen.rules = b.out.map((r) => ({ title: r.title, status: r.status, body: r.body }));
  }, 90_000);

  it('🔎 막음을 뺀 판 — updatePost 의 checkAuthor 한 줄을 지우면 jaehoon 이 9번(minji) 글을 고친다(200) · 지우기는 그대로 403 — 남의 게시물을 막는 것은 그 한 줄이다', async () => {
    await copyDb(GATE_DB);
    const out = await withServer(fixed(), GATE_DB, async ({ base: url }) => {
      const j = await loggedIn(url, 'jaehoon');
      return { patch: await j.send('PATCH', '/api/v2/posts/9', { content: 'jaehoon이 고친 글' }), del: await j.send('DELETE', '/api/v2/posts/9') };
    }, {
      edit: (dir) => replaceIn(dir, 'services/postService.js',
        'export async function updatePost(id, userId, data) {\n  await checkAuthor(id, userId);\n', 'export async function updatePost(id, userId, data) {\n'),
    });
    expect([out.patch.status, out.patch.body.data.content, out.patch.body.data.username]).toEqual([200, 'jaehoon이 고친 글', 'minji']);
    expect([out.del.status, out.del.body.error.code]).toEqual([403, 'NOT_POST_AUTHOR']);
  }, 30_000);
});

// ── 축 ③ Step 5 겪기 판 ─────────────────────────────────────────────────────────
const STEP5_BLOCKS = [
  ...STEP1_BLOCKS,
  ['내 게시물 받기', 'GET http://localhost:3000/api/v2/posts/{{postId}}'],
  ['내 게시물 좋아요 누르기', 'PUT http://localhost:3000/api/v2/posts/{{postId}}/likes/me'],
  ['내 게시물의 글 고치기', 'PATCH http://localhost:3000/api/v2/posts/{{postId}}'],
];
const STEP5_STATUSES = STEP5_BLOCKS.map(([title], i) => [title, [3, 4].includes(i) ? 403 : 200]);
/** Step 5 의 .http 를 한 판에 — 학생 DB 사본에서 · 보낸 뒤 같은 순간 jaehoon 과 seoyeon 이 받은 상세도 함께. */
const sendStep5 = async (from, db) => {
  await copyDb(db);
  const id = await postIdByContent(db, '바다에 다녀왔어요');
  const text = withPostId(read(from(HTTP_FILE)), id);
  return withServer(from, db, async ({ base: url }) => {
    const runs = await httpyac(text);
    const j = await loggedIn(url, 'jaehoon');
    const s = await loggedIn(url, 'seoyeon');
    return { id, runs, jaehoon: await j.get(`/api/v2/posts/${id}`), seoyeon: await s.get(`/api/v2/posts/${id}`) };
  });
};
/** 겪기 판과 고친 판에 한 번씩만 보낸다 — 축 ③ · ④ 가 같은 실측을 본다. */
let trapRun;
let fixedRun;
const sendTrap = () => (trapRun ??= sendStep5(trap(), GATE_DB));
const sendFixed = () => (fixedRun ??= sendStep5(fixed(), GATE2_DB));

describe('축 ③ Step 5 겪기 판 — 좋아요를 누른 내 게시물을 고치면 응답의 하트가 꺼진다', () => {
  it('🔴 .http 의 꼴 — Step 1 의 다섯 요청 그대로 · 맨 위에 @postId 한 줄 · 끝에 내 게시물 받기 · 좋아요 누르기 · 글 고치기', () => {
    const text = read(trap()(HTTP_FILE));
    const { head, blocks } = blocksOf(text);
    expect(head).toMatch(/^# .+\n@postId = \d+\n\n$/);
    expect(blocks.map((b) => [b.title, b.request])).toEqual(STEP5_BLOCKS);
    // Step 1 의 파일은 한 글자도 안 바뀌고 그 앞뒤에 더했다
    const step1Text = read(step1()(HTTP_FILE));
    expect(text.startsWith(head + step1Text)).toBe(true);
    // 기본값은 학생 DB 의 14 «바다에 다녀왔어요»
    expect(head).toContain('@postId = 14\n');
    seen.step5Head = head;
  });

  it('🔴 받기 liked false · 누르기 { liked: true, likeCount: 1 } · 고치기 200 인데 응답 liked false · likeCount 1 · 같은 순간 상세는 true', async () => {
    const t = await sendTrap();
    expect(t.runs.map((r) => [r.title, r.status])).toEqual(STEP5_STATUSES);
    expect(t.runs.slice(5).map((r) => r.statusLine)).toEqual(['HTTP/1.1 200 OK', 'HTTP/1.1 200 OK', 'HTTP/1.1 200 OK']);
    const [got, put, patched] = t.runs.slice(5);
    expect([got.body.data.id, got.body.data.liked, got.body.data.likeCount]).toEqual([t.id, false, 0]);
    expect(put.body).toEqual({ data: { liked: true, likeCount: 1 } });
    expect(patched.body.data).toMatchObject({ id: t.id, content: '주말에 바다에 다녀왔어요', liked: false, likeCount: 1 });
    expect([t.jaehoon.status, t.jaehoon.body.data.liked, t.jaehoon.body.data.likeCount]).toEqual([200, true, 1]);
    // 응답과 같은 순간의 상세 — 다른 것은 liked 하나
    const { liked: x, ...patchedRest } = patched.body.data;
    const { liked: y, ...detailRest } = t.jaehoon.body.data;
    expect([x, y]).toEqual([false, true]);
    expect(detailRest).toEqual(patchedRest);
  }, 60_000);
});

// ── 축 ④ Step 5 고친 판 ─────────────────────────────────────────────────────────
const withQueryLog = (dir) => replaceIn(dir, 'db.js', 'new PrismaClient({ adapter })', "new PrismaClient({ adapter, log: ['query'] })");
const queryLines = (text) => text.split('\n').filter((line) => line.startsWith('prisma:query'));

describe('축 ④ Step 5 고친 판 — 고치기 응답도 목록·상세와 같은 기준으로 liked 를 정한다', () => {
  it('🔴 .http 는 겪기 판과 같다 · 고치기 응답 liked true · 같은 순간 jaehoon 의 상세와 한 글자도 같다 · seoyeon 이 받은 상세는 liked false', async () => {
    expect(read(fixed()(HTTP_FILE))).toBe(read(trap()(HTTP_FILE)));
    const f = await sendFixed();
    expect(f.runs.map((r) => [r.title, r.status])).toEqual(STEP5_STATUSES);
    const patched = f.runs[7].body.data;
    expect(patched).toMatchObject({ id: f.id, content: '주말에 바다에 다녀왔어요', liked: true, likeCount: 1 });
    expect(f.jaehoon.body.data).toEqual(patched);
    // seoyeon 은 고칠 수 없다 — jaehoon 이 고친 응답과 seoyeon 이 받은 상세를 맞대면 liked 하나만 다르다
    const { liked: x, ...patchedRest } = patched;
    const { liked: y, ...seoyeonRest } = f.seoyeon.body.data;
    expect([x, y]).toEqual([true, false]);
    expect(seoyeonRest).toEqual(patchedRest);
  }, 60_000);

  it('🔴 고치기 전·뒤 .http 응답 본문의 차이는 «내 게시물의 글 고치기» 의 liked 한 줄(false → true) — updatedAt 은 실행마다 다르니 모양만', async () => {
    const [t, f] = [await sendTrap(), await sendFixed()];
    const lines = (r) => JSON.stringify(r.body, null, 2).split('\n');
    const changed = [];
    t.runs.forEach((r, i) => {
      const [x, y] = [lines(r), lines(f.runs[i])];
      expect([r.title, x.length]).toEqual([r.title, y.length]);
      x.forEach((line, k) => {
        if (line === y[k]) return;
        // 실행마다 다른 값 — 고친 시각 · 실패 봉투의 timestamp
        if (/^\s*"(updatedAt|timestamp)": "/.test(line) && line.split(':')[0] === y[k].split(':')[0]) return;
        changed.push([r.title, line.trim(), y[k].trim()]);
      });
    });
    expect(changed).toEqual([['내 게시물의 글 고치기', '"liked": false', '"liked": true']]);
    expect(f.runs[7].body.data.updatedAt).toMatch(ISO);
    const keep = (r) => ({ title: r.title, statusLine: r.statusLine, contentType: r.headers?.['content-type'], body: r.rawBody });
    seen.step5 = { trap: t.runs.map(keep), fixed: f.runs.map(keep), seoyeonAfterFix: f.seoyeon.text, jaehoonAfterTrap: t.jaehoon.text };
  }, 60_000);

  it('🔴 쿼리 수 — 고치기 요청 하나에 겪기 판과 고친 판이 같다 · 고친 판은 게시물을 읽는 쿼리에 좋아요를 LEFT JOIN 으로 함께 센다(조건 user_id)', async () => {
    const measure = async (from, db) => {
      await copyDb(db);
      const id = await postIdByContent(db, '바다에 다녀왔어요');
      return withServer(from, db, async ({ base: url, tail }) => {
        const tab = await loggedIn(url, 'jaehoon');
        await tab.send('PUT', `/api/v2/posts/${id}/likes/me`);
        await tab.send('PATCH', `/api/v2/posts/${id}`, { content: '한 번 고쳐 두기' });
        await sleep(300);
        const at = tail().length;
        const res = await tab.send('PATCH', `/api/v2/posts/${id}`, { content: '주말에 바다에 다녀왔어요' });
        await sleep(300);
        return { liked: res.body.data.liked, lines: queryLines(tail().slice(at)), raw: tail().slice(at) };
      }, { edit: withQueryLog });
    };
    const [a, b] = [await measure(trap(), GATE_DB), await measure(fixed(), GATE2_DB)];
    expect([a.liked, b.liked]).toEqual([false, true]);
    expect(b.lines.length).toBe(a.lines.length);
    const withLikes = (lines) => lines.filter((line) => line.includes('post_likes'));
    expect(withLikes(a.lines)).toEqual([]);
    expect(withLikes(b.lines)).toHaveLength(1);
    expect(withLikes(b.lines)[0]).toMatch(/LEFT JOIN \(SELECT "public"\."post_likes"\."post_id", COUNT\(\*\) AS "_aggr_count_likes" FROM "public"\."post_likes" WHERE "public"\."post_likes"\."user_id" = \$1 GROUP BY/);
    // 다른 쿼리는 한 글자도 같다
    expect(a.lines.filter((line) => !b.lines.includes(line))).toHaveLength(1);
    seen.patchQueries = { trap: a.lines, fixed: b.lines, rawTrap: a.raw, rawFixed: b.raw };
  }, 60_000);

  it('🔎 만들기 응답 liked false(맞는 값 — 아직 아무도 안 눌렀다) · 지우기 응답 liked false(화면이 안 쓴다) — 고친 판도 그대로', async () => {
    await copyDb(GATE_DB);
    const out = await withServer(fixed(), GATE_DB, async ({ base: url }) => {
      const tab = await loggedIn(url, 'jaehoon');
      const created = await tab.send('POST', '/api/v2/posts', { imageUrls: ['https://picsum.photos/seed/p352/600/600'], postAlt: '확인용', content: '확인용' });
      const id = created.body.data.id;
      await tab.send('PUT', `/api/v2/posts/${id}/likes/me`);
      const patched = await tab.send('PATCH', `/api/v2/posts/${id}`, { content: '고친 확인용' });
      const deleted = await tab.send('DELETE', `/api/v2/posts/${id}`);
      return { id, created, patched, deleted };
    });
    expect(out.id).toBe(26);
    expect([out.created.status, out.created.body.data.liked]).toEqual([201, false]);
    expect([out.patched.status, out.patched.body.data.liked, out.patched.body.data.likeCount]).toEqual([200, true, 1]);
    expect([out.deleted.status, out.deleted.body.data.liked, out.deleted.body.data.likeCount]).toEqual([200, false, 1]);
    seen.writeLiked = { create: out.created.body.data.liked, patch: out.patched.body.data.liked, delete: out.deleted.body.data.liked };
  }, 60_000);
});

// ── 축 ⑤ 학생 파일 차이 ─────────────────────────────────────────────────────────
describe('축 ⑤ 학생 파일 차이 — code/p3-51 에서', () => {
  it('🔴 Step 1 은 requests/post-author.http 하나 · Step 5 겪기 판도 그 파일 하나 · Step 5 끝은 그것과 services/postService.js · 새 패키지 · 마이그레이션 없음', () => {
    const [s1] = stepCommits(1);
    const s5 = stepCommits(5);
    expect(stepCommits(1)).toHaveLength(1);
    expect(s5).toHaveLength(2);
    expect(changedStudentFiles(BASE_REF, s1)).toEqual([HTTP_FILE]);
    expect(changedStudentFiles(BASE_REF, s5[1])).toEqual([HTTP_FILE]);
    expect(changedStudentFiles(BASE_REF, s5[0])).toEqual([HTTP_FILE, 'services/postService.js']);
    // 차례 — Step 1 → Step 5 겪기 → Step 5 고친 판
    const order = execFileSync('git', ['log', '--format=%H', `${BASE_REF}..${LINE}`], { cwd: P('.'), encoding: 'utf8' }).trim().split('\n').reverse();
    expect([order.indexOf(s1) < order.indexOf(s5[1]), order.indexOf(s5[1]) < order.indexOf(s5[0])]).toEqual([true, true]);
    for (const rel of ['package.json', 'package-lock.json', 'prisma/schema.prisma']) expect([rel, showAt(s5[0], rel)]).toEqual([rel, showAt(BASE_REF, rel)]);
    expect(readdirSync(fixed()('prisma/migrations'))).toEqual(readdirSync(base()('prisma/migrations')));
    seen.commits = { step1: s1, step5: s5 };
  });

  it('🔴 바뀐 것 — updatePost 의 select 한 줄(postFields → fieldsFor(userId))과 fieldsFor 위 주석 한 줄 · 만들기 · 지우기는 그대로 postFields', () => {
    const service = read(fixed()('services/postService.js'));
    expect(service.match(/select: fieldsFor\(userId\)/g)).toHaveLength(3);
    expect(service.match(/select: postFields/g)).toHaveLength(2);
    expect(service.match(/_count: \{ select/g)).toHaveLength(1);
    const diff = execFileSync('git', ['diff', '-U0', BASE_REF, ...(fixedRef() ? [fixedRef()] : []), '--', 'services/postService.js'], { cwd: P('.'), encoding: 'utf8' });
    const changed = diff.split('\n').filter((line) => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line));
    expect(changed).toEqual([
      '-// 보는 사람이 누른 좋아요를 센다 — 목록과 상세가 같은 기준이다.',
      '+// 보는 사람이 누른 좋아요를 센다 — 목록 · 상세 · 고치기 응답이 같은 기준이다.',
      '-      select: postFields,',
      '+      select: fieldsFor(userId),',
    ]);
    // 그 select 는 updatePost 안에 있다
    const update = service.slice(service.indexOf('export async function updatePost('), service.indexOf('export async function removePost('));
    expect(update).toContain('select: fieldsFor(userId),');
    seen.diff = diff;
  });

  it('🔴 학생 파일에 내부 어휘가 없다 · 첫 줄 경로 주석 · 쓰지 않기로 한 낱말이 없다', () => {
    const to = WT ? null : stepCommits(5)[0];
    for (const rel of changedStudentFiles(BASE_REF, to)) {
      const text = to ? showAt(to, rel) : read(P(rel));
      expect([rel, /게이트|판정|TDD|Step \d|p3-\d\d|회차/.test(text)]).toEqual([rel, false]);
      if (rel.endsWith('.js')) expect([rel, text.split('\n')[0]]).toEqual([rel, `// ~/instagram-api/${rel}`]);
    }
    // «돌려준다»(값을 돌려주다 — return)는 이 코드베이스가 늘 쓰는 다른 낱말이라 뺀다
    const banned = /자리|박다|박아|박힌|결[이을로의]|갈래|몸통|판[이을으]|겹|까닭|걸리|걸린|돌리|돌려(?!주|준|줄)|가르|갈리|재다|재서|벗기|되살/;
    const diff = execFileSync('git', ['diff', BASE_REF, ...(to ? [to] : []), '--', ...STUDENT_FILES], { cwd: P('.'), encoding: 'utf8' });
    const added = diff.split('\n').filter((line) => line.startsWith('+') && !line.startsWith('+++'));
    expect(added.length).toBeGreaterThan(0);
    expect(added.filter((line) => banned.test(line))).toEqual([]);
  });
});
