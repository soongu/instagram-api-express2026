// p3-54 「댓글 달고 지우기」 게이트 — 백엔드(교안 Step 1~3 의 댓글 달기 · 숫자 · 지우기 API · docs/openapi.js)
// 내부 검증 전용 — 교안에 한 줄도 인용하지 않는다.
//
// `8-fullstack-features` 여섯째 회차다(`curriculum.md` 「`p3-54` 착수 결정」). 화면(Step 4~7)은 `instagram-next/.verify` 가 본다.
// 백엔드의 시작 판은 code/p3-53 의 학생 파일이다(그 위의 다른 세션 판정 커밋 da923f9 에서 지었다).
// 커밋 — Step 1 은 둘(강의 자료 · 세 층) · Step 2 는 셋(강의 자료 · increment 판 · changeCommentCount 판) ·
//        Step 3 은 여섯(강의 자료 · 번호로만 찾는 판 · 고친 판 · 문서 · 같이 지우기 · 숫자를 다시 맞추는 SQL). 같은 «(Step N)» 표식이 여럿이면 가장 뒤 커밋이 그 Step 의 끝 판이다.
// 🔑 짓는 동안 `P354_WT` 를 주면 그 판을 커밋 대신 작업트리에서 읽는다 — `1a` · `1` · `2a` · `2b` · `2` · `3a` · `3b` · `3c` · `3d` · `3e` · `3`.
// 🔑 포트 — 3930 · 3931(둘째 서버) · 3936(탐침). DB — `p354_api_` 로 시작하는 것만 만들고 지운다. `P354_PG_PORT` 로 PostgreSQL 호스트 포트를 바꾼다.
// 🔑 판정 DB 는 «p3-53 을 마친 학생 DB» — test/p3-53.test.js 의 준비(«p3-52 를 마친 학생 DB»)를 그대로 하고 그 위에 lab/p3-53/many-comments.sql 을 한 번.
//    결과 — 게시물 최신순 14·9·1·2·3·4·5 · 2번 게시물 원댓글 29 · comment_count 29 · 댓글 37행(원댓글 34 · 답글 3) · 좋아요 1·2·9·14(jaehoon) · uploads 1행.
//    🚨 번호는 학생마다 다를 수 있다 — 판정은 시드 게시물(1~5)과 시드 댓글(1~12) 밖의 번호를 고정값으로 쓰지 않는다.
//
// 축 ⓪ 판정 DB — 위 숫자
// 축 ① Step 1 — 강의 자료 판(405 + Allow: GET) · 세 층 판(201 · 응답 꼴 · Location 없음 · 숫자 그대로) · 400 · 404 · 401 · 본문의 authorId·parentId
// 축 ② Step 2 — 강의 자료 판(달아도 commentCount 그대로) · increment 판(숫자는 오르고 updatedAt 이 바뀐다) · 고친 판(updatedAt 그대로 · { comment, commentCount }) ·
//      실패하면 둘 다 되돌아간다(트랜잭션 없이 · tx 대신 prisma · 트랜잭션 뒤) · 쿼리 로그
// 축 ③ Step 3 — 번호로만 찾는 판(엉뚱한 게시물 숫자가 내려간다) · 고친 판의 경우들(요청마다 숫자 = 원댓글 수) · 답글이 달린 원댓글 · 답글 · 쿼리 ·
//      같이 지우기(고친 판 3c 는 둘 다 200 에 숫자를 두 번 내린다 → 끝 판은 지운 행 수로 404) · 문서
// 축 ④ 회귀 — 댓글 목록 · 게시물 목록 · 좋아요가 시작 판과 같다
// 축 ⑤ 학생 파일 차이 — 시작 판에서 각 판까지 · 내부 어휘 · 경로 주석 · 쓰지 않기로 한 낱말
// 축 ⑥ 학생 한 사람의 흐름 — 한 DB 에서 Step 1 → 2 → 3 의 판을 차례로 갈아 끼우며 교안 차례로 누르고 끝에 fix-comment-count.sql(어긋남 → 0 · 확인 SELECT 앞뒤 · 두 번 실행)
//      — 그 끝 DB 가 «Step 4 를 시작하는 학생 DB» 다(화면 판정이 쓴다)
// 축 ⑦ Step 3 강의 자료 SQL — 파일 꼴(경로 주석 · 표준 SQL · UPDATE 하나 + SELECT 하나) · 어긋남이 없는 DB 에서는 아무것도 안 바뀐다 · updated_at 그대로
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, mkdtempSync, rmSync, cpSync, symlinkSync, existsSync, readdirSync, writeFileSync, openSync, closeSync, realpathSync, mkdirSync } from 'node:fs';
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
const PG_PORT = Number(process.env.P354_PG_PORT ?? 5432);
const ADMIN = { host: 'localhost', port: PG_PORT, database: 'postgres', user: 'postgres', password: 'postgres' };
const TPL_DB = 'p354_api_tpl';
const GATE_DB = 'p354_api_gate';
const GATE2_DB = 'p354_api_gate2';
const dbUrl = (name) => `postgresql://postgres:postgres@localhost:${PG_PORT}/${name}`;
const PORT = 3930;
const PORT2 = 3931;
const PROBE_PORT = 3936;
const SECRET = 'q2Xh0v9bGm4RkT7sYp1wLc8nZf3uJd6eHa5iVo0rQyE';
const PROVIDER_ENV = {
  GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret', SITE_URL: `http://localhost:${PORT}`,
  KAKAO_CLIENT_ID: 'test-kakao', KAKAO_CLIENT_SECRET: 'test-kakao-secret',
  NAVER_CLIENT_ID: 'test-naver', NAVER_CLIENT_SECRET: 'test-naver-secret',
};
const env = { CORS_ORIGIN: 'http://localhost:3001', JWT_SECRET: SECRET, ...PROVIDER_ENV };
const STUDENT_FILES = ['app.js', 'db.js', 'errors.js', 'responses.js', 'routes', 'controllers', 'services', 'middlewares', 'schemas', 'strategies', 'docs', 'utils', 'package.json', 'requests', 'seed.js', 'data', 'prisma', 'prisma.config.js', '.env.example', 'lab'];
const HTTP_FILE = 'requests/post-comments.http';
const SQL_FILE = 'lab/p3-53/many-comments.sql';
const FIX_SQL = 'lab/p3-54/fix-comment-count.sql';
const ISO_ANY = /^\d{4}-\d\d-\d\dT/;
const ISO = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;

const hasRef = (ref) => {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', ref], { cwd: P('.'), stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
};
// 🔑 판의 선 — 북마크 code/p3-54 가 있으면 그것, 없으면 지금 체크아웃한 선(HEAD). `P354_LINE` 으로 바꾼다.
const LINE = process.env.P354_LINE ?? (hasRef('refs/heads/code/p3-54') ? 'code/p3-54' : 'HEAD');
const WT = process.env.P354_WT ?? null;
/** «(Step N)» 표식이 붙은 이 회차 커밋들 — 새것부터. */
const stepCommits = (n) => {
  const log = execFileSync('git', ['log', '-n', '400', '--format=%H %s', LINE], { cwd: P('.'), encoding: 'utf8' });
  const hits = log.split('\n').filter((l) => / feat\(p3-54\): /.test(l) && l.endsWith(`(Step ${n})`)).map((l) => l.split(' ')[0]);
  if (hits.length === 0) throw new Error(`(Step ${n}) 커밋이 없다`);
  return hits;
};
const dirs = [];
const refDirs = new Map();
/** 커밋(또는 브랜치) 하나를 임시 폴더에 풀어 둔다. */
const refDir = (ref) => {
  if (refDirs.has(ref)) return refDirs.get(ref);
  const dir = mkdtempSync(join(tmpdir(), 'p354-ref-'));
  const tar = execFileSync('git', ['archive', '--format=tar', ref], { cwd: P('.'), maxBuffer: 1 << 28 });
  execFileSync('tar', ['-x', '-C', dir], { input: tar });
  dirs.push(dir);
  const at = (rel) => join(dir, rel);
  refDirs.set(ref, at);
  return at;
};
const worktree = (rel) => P(rel);
// 🔑 시작 판 — 이 회차 첫 커밋(Step 1 의 강의 자료)의 바로 앞. code/p3-53 위의 다른 세션 판정 커밋(p3-48 축 ④ — da923f9)이다 ·
//    학생 파일은 code/p3-53 과 같다. `P354_BASE` 로 바꾼다.
let baseCache;
const baseRef = () => (baseCache ??= process.env.P354_BASE
  ?? execFileSync('git', ['rev-parse', `${stepCommits(1).at(-1)}^`], { cwd: P('.'), encoding: 'utf8' }).trim());
const base = () => refDir(baseRef());
/** 판의 커밋 — Step 의 커밋 가운데 `index` 번째(오래된 것부터 0) · 작업트리로 읽는 판이면 null. */
// Step 1 — 1a 강의 자료 · 1 세 층 / Step 2 — 2a 강의 자료 · 2b increment · 2 changeCommentCount /
// Step 3 — 3a 강의 자료 · 3b 번호로만 찾는 판 · 3c 고친 판 · 3d 문서 · 3e 같이 지우기 · 3 숫자 다시 맞추는 SQL(가장 뒤 커밋 — 학생 파일의 Step 3 끝 판)
const VERSIONS = {
  '1a': [1, 0], 1: [1, 1], '2a': [2, 0], '2b': [2, 1], 2: [2, 2], '3a': [3, 0], '3b': [3, 1], '3c': [3, 2], '3d': [3, 3], '3e': [3, 4], 3: [3, -1],
};
const versionRef = (label) => {
  if (WT === String(label)) return null;
  const [step, index] = VERSIONS[label];
  const commits = stepCommits(step).slice().reverse();
  if (index === -1) return commits.at(-1);
  if (commits[index] === undefined) throw new Error(`(Step ${step}) 커밋이 ${index + 1}개보다 적다`);
  return commits[index];
};
/** 판 하나의 파일 읽기 — 커밋을 풀었거나 작업트리. */
const version = (label) => {
  const ref = versionRef(label);
  return ref === null ? worktree : refDir(ref);
};
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
/** SQL 파일 하나를 통째로 — 여러 문장을 한 번에 보내고 문장마다의 결과를 받는다. */
const runSql = async (name, sql) => {
  const client = new pg.Client({ ...ADMIN, database: name });
  await client.connect();
  try {
    const out = await client.query(sql);
    return Array.isArray(out) ? out : [out];
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

const replaceIn = (dir, rel, a, b) => {
  const text = read(join(dir, rel));
  if (text.split(a).length !== 2) throw new Error(`${rel} 에 바꿀 글자가 없거나 여럿이다: ${a}`);
  writeFileSync(join(dir, rel), text.replace(a, b));
};
/** 템플릿을 세운 서버의 uploads 폴더를 떠 둔 곳 — 판정 서버마다 사본을 깐다. */
let TPL_UPLOADS = null;
const studentDir = (from, edit) => {
  const dir = mkdtempSync(join(tmpdir(), 'p354-srv-'));
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
/** requests/auth.http 의 가입 블록 본문 그대로 — 이름으로 고른다(sora 는 p3-22 · seoyeon · doyun 은 p3-39). */
const signupBodies = (from, names) => read(from('requests/auth.http')).split(/^### /m)
  .filter((block) => /^POST \S+\/auth\/signup$/m.test(block) && names.some((name) => block.includes(`"username": "${name}"`)))
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
 * 템플릿을 «p3-52 를 마친» 학생 DB 처럼 — `url` 은 그 DB 로 띄운 시작 판 서버, `dir` 은 그 서버의 학생 폴더 사본.
 * 게시물 최신순 14·9·1·2·3·4·5 · 좋아요 jaehoon 이 1·2·9·14 · 14 의 글은 «주말에 바다에 다녀왔어요» · 댓글은 시드 그대로.
 */
const toStudentState = async (url, dir, from) => {
  // p3-22 — 화면의 가입으로 들어온 sora(auth.http «회원가입» 본문)
  const [sora] = signupBodies(from, ['sora']);
  expect(sora.username).toBe('sora');
  expect((await fetch(`${url}/api/v2/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sora) })).status).toBe(201);
  await onDb(TPL_DB, "UPDATE users SET password_hash = NULL WHERE username <> 'jaehoon'");
  const bodies = signupBodies(from, ['seoyeon', 'doyun']);
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
  // p3-49 — 화면 «공유하기» 로 14(Step 6) · 15~18(Step 8 의 두 번 누르기들)
  await onDb(TPL_DB, "SELECT setval('posts_id_seq', 13)");
  const fourteen = await share(jaehoon, '바다에 다녀왔어요', '바다에 다녀왔어요');
  const slow = [];
  for (let n = 0; n < 4; n++) slow.push(await share(jaehoon, '느린 네트워크', '느린 네트워크'));
  // p3-50 Step 4 — photo-owner.http 의 «그 사진으로 게시물 만들기»(19) · seoyeon 이 같은 주소로 만든 게시물을 지울 때 그 파일이 지워졌다
  const nineteen = await share(jaehoon, '지난 주말에 다녀온 바다', '바닷가 사진');
  rmSync(join(dir, 'uploads', nineteen.fileName));
  // 그 뒤 20~25 는 번호만 쓰였다 — 다음 게시물은 26
  await onDb(TPL_DB, "SELECT setval('posts_id_seq', 25)");
  // p3-52 — 14 에 하트를 누르고 글을 고친다(Step 4 · Step 5) · 19 를 지운다(Step 7) · 18~15 를 지운다(직접 해보기 · 과제)
  expect((await jaehoon.send('PUT', `/api/v2/posts/${fourteen.id}/likes/me`)).status).toBe(200);
  expect((await jaehoon.send('PATCH', `/api/v2/posts/${fourteen.id}`, { content: '주말에 바다에 다녀왔어요' })).status).toBe(200);
  for (const one of [nineteen, ...slow.slice().reverse()]) expect((await jaehoon.send('DELETE', `/api/v2/posts/${one.id}`)).status).toBe(200);
  TPL_UPLOADS = mkdtempSync(join(tmpdir(), 'p354-uploads-'));
  dirs.push(TPL_UPLOADS);
  cpSync(join(dir, 'uploads'), TPL_UPLOADS, { recursive: true });
};

/** httpYac CLI 로 `.http` 한 파일을 통째로 보낸다(`--all --json`) — 학생이 VS Code 에서 위에서부터 차례로 누르는 것과 같다. */
const httpyac = async (source, port = PORT) => {
  const dir = mkdtempSync(join(tmpdir(), 'p354-http-'));
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
    url: r.response?.request?.url, headers: r.response?.headers, rawBody: r.response?.body, body: parse(r.response?.body),
  }));
};
/** .http 의 블록 — 제목 · 요청 줄. 맨 위(첫 ### 앞)는 `head` 로 따로. */
const blocksOf = (text) => {
  const [head, ...rest] = text.split(/^### /m);
  return { head, blocks: rest.map((block) => ({ title: block.split('\n')[0], request: block.split('\n').find((line) => /^(GET|POST|PUT|PATCH|DELETE) /.test(line)) })) };
};
const withQueryLog = (dir) => replaceIn(dir, 'db.js', 'new PrismaClient({ adapter })', "new PrismaClient({ adapter, log: ['query'] })");
const queryLines = (text) => text.split('\n').filter((line) => line.startsWith('prisma:query'));
/** 요청 하나의 Prisma 쿼리 로그 — 그 판을 쿼리 로그를 켠 사본으로 띄워 `path` 를 두 번 보내고 둘째 것만 센다(첫 요청의 연결 준비를 빼려고). */
const queriesOf = async (from, db, path, { edit } = {}) => withServer(from, db, async ({ base: url, tail }) => {
  const tab = await loggedIn(url, 'jaehoon');
  await tab.get(path);
  await sleep(300);
  const at = tail().length;
  const res = await tab.get(path);
  await sleep(300);
  return { status: res.status, body: res.body, lines: queryLines(tail().slice(at)), raw: tail().slice(at) };
}, { port: PROBE_PORT, edit: (dir) => { withQueryLog(dir); if (edit) edit(dir); } });

/** 교안에 인용할 실측 글자 — `P354_SEEN=경로` 를 주면 파일로 남긴다(보고용). */
const seen = {};

const SEED_SHIFT = "INTERVAL '3 days'";
beforeAll(async () => {
  await admin(async (client) => {
    for (const name of [GATE_DB, GATE2_DB, TPL_DB]) {
      await kick(client, name);
      await client.query(`DROP DATABASE IF EXISTS ${name}`);
    }
    await client.query(`CREATE DATABASE ${TPL_DB}`);
  });
  // 템플릿은 시작 판(code/p3-53 의 학생 파일)의 마이그레이션 + 시드 + 학생 DB 의 쓰기 + p3-53 Step 5 의 SQL 한 번
  const from = base();
  for (const dir of readdirSync(from('prisma/migrations')).filter((name) => name !== 'migration_lock.toml').sort()) {
    await onDb(TPL_DB, read(from(`prisma/migrations/${dir}/migration.sql`)));
  }
  const seedDir = studentDir(from);
  const childEnv = { ...process.env, DATABASE_URL: dbUrl(TPL_DB) };
  delete childEnv.NODE_ENV;
  execFileSync(process.execPath, [join(seedDir, 'seed.js')], { cwd: seedDir, encoding: 'utf8', env: childEnv });
  // 학생은 시드를 며칠 전에 넣었다 — 오늘 더하는 댓글(many-comments.sql)이 시드 댓글보다 늦게 들어가는 것이 학생 DB 의 모습이다.
  await onDb(TPL_DB, `UPDATE posts SET created_at = created_at - ${SEED_SHIFT}, updated_at = updated_at - ${SEED_SHIFT}`);
  await onDb(TPL_DB, `UPDATE comments SET created_at = created_at - ${SEED_SHIFT}, updated_at = updated_at - ${SEED_SHIFT}`);
  await withServer(from, TPL_DB, ({ base: url, dir }) => toStudentState(url, dir, from), { port: PORT2 });
  expect((await onDb(TPL_DB, "SELECT string_agg(id::text, ',' ORDER BY created_at DESC, id DESC) AS ids FROM posts"))[0].ids).toBe('14,9,1,2,3,4,5');
  const jaehoonId = await idOf(TPL_DB, 'jaehoon');
  expect((await onDb(TPL_DB, "SELECT string_agg(post_id || ':' || user_id, ',' ORDER BY post_id) AS l FROM post_likes"))[0].l)
    .toBe([1, 2, 9, 14].map((id) => `${id}:${jaehoonId}`).join(','));
  expect(await onDb(TPL_DB, 'SELECT id, content, comment_count FROM posts ORDER BY id')).toEqual([
    { id: 1, content: '퇴근길에 한강이 너무 예뻤어요', comment_count: 3 },
    { id: 2, content: '오늘 아침에 구운 크루아상', comment_count: 4 },
    { id: 3, content: '주말마다 여기 옵니다', comment_count: 2 },
    { id: 4, content: '새로 산 렌즈로 찍어봤어요', comment_count: 0 },
    { id: 5, content: '동네 한 바퀴', comment_count: 0 },
    { id: 9, content: '제주 왔어요 🌊', comment_count: 0 },
    { id: 14, content: '주말에 바다에 다녀왔어요', comment_count: 0 },
  ]);
  // 댓글은 시드 그대로 — 원댓글 9 · 답글 3(1번 3+2 · 2번 4+1 · 3번 2)
  expect(await onDb(TPL_DB, 'SELECT post_id, count(*) FILTER (WHERE parent_id IS NULL)::int AS roots, count(*) FILTER (WHERE parent_id IS NOT NULL)::int AS replies FROM comments GROUP BY post_id ORDER BY post_id'))
    .toEqual([{ post_id: 1, roots: 3, replies: 2 }, { post_id: 2, roots: 4, replies: 1 }, { post_id: 3, roots: 2, replies: 0 }]);
  // p3-53 Step 5 — 강의 자료 many-comments.sql 을 한 번(시작 판의 파일 그대로)
  const out = await runSql(TPL_DB, read(from(SQL_FILE)));
  expect(out.at(-1).rows).toEqual([{ comment_count: 29, root_comments: '29' }]);
  expect(await onDb(TPL_DB, "SELECT username FROM users WHERE password_hash IS NOT NULL ORDER BY id"))
    .toEqual([{ username: 'jaehoon' }, { username: 'seoyeon' }, { username: 'doyun' }, { username: 'admin.hong' }]);
  expect((await onDb(TPL_DB, "SELECT count(*)::int AS n FROM users WHERE username = 'sora' AND password_hash IS NULL"))[0].n).toBe(1);
  expect((await onDb(TPL_DB, "SELECT nextval('posts_id_seq') AS n"))[0].n).toBe('26');
  await onDb(TPL_DB, "SELECT setval('posts_id_seq', 25)");
}, 180_000);

afterAll(async () => {
  for (const name of [GATE_DB, GATE2_DB, TPL_DB]) await dropDb(name);
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  if (process.env.P354_SEEN) writeFileSync(process.env.P354_SEEN, JSON.stringify(seen, null, 2));
});

/** 실패 봉투 — 새 주소의 { error: { code, message, path, timestamp } }. */
const v2Error = (code, message, path) => ({ error: { code, message, path, timestamp: expect.stringMatching(ISO) } });
const keep = (r) => ({ title: r.title, statusLine: r.statusLine, contentType: r.headers?.['content-type'], body: r.rawBody });
/** .http 의 블록 — 제목과 그 블록 글자 전체(### 줄부터 다음 ### 앞까지). */
const blockTexts = (text) => text.split(/^### /m).slice(1).map((block) => ({ title: block.split('\n')[0], text: `### ${block.trimEnd()}\n` }));
/** 제목으로 골라 차례대로 이어 붙인 .http — 같은 제목을 두 번 적으면 두 번 보낸다(학생이 같은 요청을 다시 누르는 것과 같다). */
const compose = (text, titles) => {
  const all = blockTexts(text);
  return titles.map((title) => {
    const hits = all.filter((b) => b.title === title);
    if (hits.length !== 1) throw new Error(`«${title}» 블록이 ${hits.length}개다`);
    return hits[0].text;
  }).join('\n');
};
/** 게시물마다 comment_count · 원댓글 수 · 댓글 행 수. */
const counts = (db) => onDb(db, `SELECT p.id, p.comment_count AS count,
  (SELECT count(*)::int FROM comments c WHERE c.post_id = p.id AND c.parent_id IS NULL) AS roots,
  (SELECT count(*)::int FROM comments c WHERE c.post_id = p.id) AS rows
  FROM posts p ORDER BY p.id`);
const countOf = async (db, id) => (await counts(db)).find((p) => p.id === id);
/** 숫자와 원댓글 수가 어긋난 게시물 — 비어 있어야 맞다. */
const drift = async (db) => (await counts(db)).filter((p) => p.count !== p.roots);
const LOGIN = 'jaehoon으로 로그인';
const ADD = '2번 게시물에 댓글 달기';
const POST2 = '2번 게시물';
const POST1 = '1번 게시물';
const ADDED_TEXT = '한 입만 나눠 주세요';
const MINE_TEXT = '앗, 다른 사진에 달려던 댓글이에요';
/** 로그인한 jaehoon 의 탭으로 요청을 차례로 — 요청마다 응답과 그 뒤의 숫자. */
const sendSteps = (from, db, steps, { edit, port } = {}) => withServer(from, db, async ({ base: url, tail }) => {
  const tab = await loggedIn(url, 'jaehoon');
  const out = [];
  for (const [method, path, body] of steps) {
    const res = await tab.send(method, path, body);
    out.push({
      method, path, status: res.status, body: res.body, text: res.text,
      allow: res.headers.get('allow'), location: res.headers.get('location'), drift: await drift(db),
    });
  }
  return { out, log: tail() };
}, { edit, port });
/** 요청 하나의 Prisma 쿼리 로그 — 쿼리 로그를 켠 사본으로 띄워 목록 한 번으로 연결을 준비한 뒤 그 요청만 센다. */
const queriesOfSend = (from, db, method, path, body) => withServer(from, db, async ({ base: url, tail }) => {
  const tab = await loggedIn(url, 'jaehoon');
  await tab.get('/api/v2/posts/2/comments?limit=1');
  await sleep(300);
  const at = tail().length;
  const res = await tab.send(method, path, body);
  await sleep(300);
  const raw = tail().slice(at).split('\n').filter((line) => !/^(서버가|아무 게시물|GET|POST|DELETE|PUT|PATCH) /.test(line)).join('\n').trim();
  return { status: res.status, body: res.body, lines: queryLines(tail().slice(at)), raw };
}, { port: PROBE_PORT, edit: withQueryLog });
const scrubTime = (body) => {
  const copy = structuredClone(body);
  if (copy?.error?.timestamp) copy.error.timestamp = '<timestamp>';
  return copy;
};

// ── 축 ⓪ 판정 DB ─────────────────────────────────────────────────────────────────
describe('축 ⓪ 판정 DB — p3-53 을 마친 학생 DB', () => {
  it('🔴 게시물 최신순 14·9·1·2·3·4·5 · 2번 원댓글 29 · comment_count 29 · 댓글 37행(원댓글 34 · 답글 3 — 1번 3+2 · 2번 29+1 · 3번 2) · 좋아요 1·2·9·14 · uploads 1행 · 숫자가 모두 맞다', async () => {
    expect((await onDb(TPL_DB, "SELECT string_agg(id::text, ',' ORDER BY created_at DESC, id DESC) AS ids FROM posts"))[0].ids).toBe('14,9,1,2,3,4,5');
    expect(await counts(TPL_DB)).toEqual([
      { id: 1, count: 3, roots: 3, rows: 5 },
      { id: 2, count: 29, roots: 29, rows: 30 },
      { id: 3, count: 2, roots: 2, rows: 2 },
      { id: 4, count: 0, roots: 0, rows: 0 },
      { id: 5, count: 0, roots: 0, rows: 0 },
      { id: 9, count: 0, roots: 0, rows: 0 },
      { id: 14, count: 0, roots: 0, rows: 0 },
    ]);
    expect(await onDb(TPL_DB, 'SELECT count(*)::int AS rows, count(*) FILTER (WHERE parent_id IS NULL)::int AS roots, count(*) FILTER (WHERE parent_id IS NOT NULL)::int AS replies FROM comments'))
      .toEqual([{ rows: 37, roots: 34, replies: 3 }]);
    const jaehoonId = await idOf(TPL_DB, 'jaehoon');
    expect(jaehoonId).toBe(2);
    expect((await onDb(TPL_DB, "SELECT string_agg(post_id || ':' || user_id, ',' ORDER BY post_id) AS l FROM post_likes"))[0].l).toBe('1:2,2:2,9:2,14:2');
    expect(await onDb(TPL_DB, 'SELECT count(*)::int AS n, count(post_id)::int AS used FROM uploads')).toEqual([{ n: 1, used: 1 }]);
    // 시드 댓글 번호 — 판정이 고정값으로 쓰는 것들(1번 게시물 1·2·3 + 답글 10·11 · 2번 게시물 4~7 + 답글 12)
    expect(await onDb(TPL_DB, 'SELECT c.id, c.post_id, c.parent_id, u.username, c.content FROM comments c JOIN users u ON u.id = c.author_id WHERE c.id <= 12 ORDER BY c.id')).toEqual([
      { id: 1, post_id: 1, parent_id: null, username: 'minji', content: '저도 가봤어요' },
      { id: 2, post_id: 1, parent_id: null, username: 'seungwoo', content: '사진 잘 나왔네요' },
      { id: 3, post_id: 1, parent_id: null, username: 'nayeon', content: '다음에 같이 가요' },
      { id: 4, post_id: 2, parent_id: null, username: 'jaehoon', content: '크루아상 색이 좋네요' },
      { id: 5, post_id: 2, parent_id: null, username: 'minji', content: '레시피 공유해주세요' },
      { id: 6, post_id: 2, parent_id: null, username: 'dahye', content: '저도 구워볼래요' },
      { id: 7, post_id: 2, parent_id: null, username: 'nayeon', content: '냄새가 여기까지' },
      { id: 8, post_id: 3, parent_id: null, username: 'seungwoo', content: '다음엔 저도 낄게요' },
      { id: 9, post_id: 3, parent_id: null, username: 'dahye', content: '코트 어디예요?' },
      { id: 10, post_id: 1, parent_id: 1, username: 'jaehoon', content: '다음엔 같이 가요' },
      { id: 11, post_id: 1, parent_id: 1, username: 'dahye', content: '저도 껴주세요' },
      { id: 12, post_id: 2, parent_id: 4, username: 'minji', content: '이번엔 잘 구워졌어요' },
    ]);
    // 게시물 주인 — jaehoon 은 1 · 9 · 14 가 아니라 1 · 14(9 는 minji) · 2 는 minji
    expect(await onDb(TPL_DB, 'SELECT p.id, u.username FROM posts p JOIN users u ON u.id = p.author_id ORDER BY p.id')).toEqual([
      { id: 1, username: 'jaehoon' }, { id: 2, username: 'minji' }, { id: 3, username: 'seungwoo' }, { id: 4, username: 'minji' },
      { id: 5, username: 'dahye' }, { id: 9, username: 'minji' }, { id: 14, username: 'jaehoon' },
    ]);
    seen.tpl = { counts: await counts(TPL_DB) };
  });
});

// ── 축 ① Step 1 ────────────────────────────────────────────────────────────────
const STEP0_BLOCKS = [
  [LOGIN, 'POST http://localhost:3000/api/v2/auth/login'],
  ['1번 게시물의 댓글', 'GET http://localhost:3000/api/v2/posts/1/comments'],
  ['없는 게시물의 댓글', 'GET http://localhost:3000/api/v2/posts/99/comments'],
  ['댓글이 없는 게시물의 댓글', 'GET http://localhost:3000/api/v2/posts/4/comments'],
  ['2번 게시물의 댓글 — 첫 페이지', 'GET http://localhost:3000/api/v2/posts/2/comments?limit=2'],
  ['둘째 페이지 — 받은 커서를 그대로 돌려준다', 'GET http://localhost:3000/api/v2/posts/2/comments?limit=2&cursor={{first.data.nextCursor}}'],
];
const STEP1_BLOCKS = [...STEP0_BLOCKS, [ADD, 'POST http://localhost:3000/api/v2/posts/2/comments']];

describe('축 ① Step 1 — 댓글 달기 API', () => {
  it('🔴 강의 자료 판 — post-comments.http 끝에 «2번 게시물에 댓글 달기» 하나(JSON content) · 앞 블록은 시작 판 그대로 · 보내면 405 + Allow: GET · 댓글은 그대로', async () => {
    const text = read(version('1a')(HTTP_FILE));
    const start = read(base()(HTTP_FILE));
    expect(text.startsWith(start)).toBe(true);
    const { head, blocks } = blocksOf(text);
    expect(head).toBe('');
    expect(blocks.map((b) => [b.title, b.request])).toEqual(STEP1_BLOCKS);
    expect(text.slice(start.length)).toBe(`\n### ${ADD}\nPOST http://localhost:3000/api/v2/posts/2/comments\nContent-Type: application/json\n\n{\n  "content": "${ADDED_TEXT}"\n}\n`);
    await copyDb(GATE_DB);
    const runs = await withServer(version('1a'), GATE_DB, () => httpyac(text));
    expect(runs.map((r) => r.status)).toEqual([200, 200, 404, 200, 200, 200, 405]);
    expect(runs[6].headers.allow).toBe('GET');
    expect(runs[6].body).toEqual(v2Error('METHOD_NOT_ALLOWED', '이 주소는 그 HTTP 메서드를 받지 않아요', '/api/v2/posts/2/comments'));
    expect(await countOf(GATE_DB, 2)).toEqual({ id: 2, count: 29, roots: 29, rows: 30 });
    seen.step1a = { file: text, add: keep(runs[6]), allow: runs[6].headers.allow };
  }, 60_000);

  it('🔴 세 층 판 — 같은 .http · 201 · 봉투 { data: 댓글 } · 목록과 같은 일곱 필드 · 글쓴이 jaehoon · Location 없음 · 원댓글은 30 인데 comment_count 는 29 그대로(Step 2 의 겪기)', async () => {
    const text = read(version(1)(HTTP_FILE));
    expect(text).toBe(read(version('1a')(HTTP_FILE)));
    await copyDb(GATE_DB);
    const runs = await withServer(version(1), GATE_DB, () => httpyac(text));
    expect(runs.map((r) => r.status)).toEqual([200, 200, 404, 200, 200, 200, 201]);
    const added = runs[6];
    expect(added.statusLine).toBe('HTTP/1.1 201 Created');
    expect(added.headers.location).toBeUndefined();
    expect(Object.keys(added.body)).toEqual(['data']);
    expect(Object.keys(added.body.data)).toEqual(['id', 'authorId', 'content', 'likeCount', 'createdAt', 'username', 'profileImage']);
    expect(added.body.data).toMatchObject({ authorId: 2, content: ADDED_TEXT, likeCount: 0, username: 'jaehoon', profileImage: 'https://picsum.photos/seed/jaehoon/40/40' });
    expect(ISO.test(added.body.data.createdAt)).toBe(true);
    expect(await onDb(GATE_DB, 'SELECT post_id, author_id, parent_id, content FROM comments WHERE id = $1', [added.body.data.id]))
      .toEqual([{ post_id: 2, author_id: 2, parent_id: null, content: ADDED_TEXT }]);
    expect(await countOf(GATE_DB, 2)).toEqual({ id: 2, count: 29, roots: 30, rows: 31 });
    // 목록 끝에 붙는다 — 둘째 페이지(limit 20 기본) 끝이 방금 단 댓글
    const tour = await withServer(version(1), GATE_DB, async ({ base: url }) => {
      const tab = await loggedIn(url, 'jaehoon');
      const first = await tab.get('/api/v2/posts/2/comments');
      const second = await tab.get(`/api/v2/posts/2/comments?cursor=${first.body.data.nextCursor}`);
      const post = await tab.get('/api/v2/posts/2');
      return { first: first.body.data, second: second.body.data, post: post.body.data };
    });
    expect([tour.first.items.length, tour.second.items.length, tour.second.hasNext]).toEqual([20, 10, false]);
    expect(tour.second.items.at(-1)).toEqual(added.body.data);
    expect(tour.post.commentCount).toBe(29);
    seen.step1 = { add: keep(added), post2: tour.post };
  }, 90_000);

  it('🔴 세 층 판 — 빈 글 · 공백만 · content 없음 400 VALIDATION_FAILED · 앞뒤 공백은 떼고 저장 · 2200자까지 · 본문의 authorId · parentId 는 무시 · 없는 게시물 404 · 숫자가 아닌 번호 404 · 로그인 없이 401 · 읽을 수 없는 본문 400 INVALID_BODY · PUT 405 Allow: GET, POST · 옛 주소는 봉투 없이 201', async () => {
    await copyDb(GATE_DB);
    const minji = await idOf(GATE_DB, 'minji');
    const long = '가'.repeat(2200);
    const { out } = await sendSteps(version(1), GATE_DB, [
      ['POST', '/api/v2/posts/2/comments', { content: '' }],
      ['POST', '/api/v2/posts/2/comments', { content: '   ' }],
      ['POST', '/api/v2/posts/2/comments', {}],
      ['POST', '/api/v2/posts/2/comments', { content: `  ${ADDED_TEXT}  ` }],
      ['POST', '/api/v2/posts/2/comments', { content: long }],
      ['POST', '/api/v2/posts/2/comments', { content: `${long}가` }],
      ['POST', '/api/v2/posts/2/comments', { content: ADDED_TEXT, authorId: minji }],
      ['POST', '/api/v2/posts/2/comments', { content: ADDED_TEXT, parentId: 4 }],
      ['POST', '/api/v2/posts/99/comments', { content: ADDED_TEXT }],
      ['POST', '/api/v2/posts/abc/comments', { content: ADDED_TEXT }],
      ['PUT', '/api/v2/posts/2/comments', { content: ADDED_TEXT }],
      ['POST', '/api/posts/2/comments', { content: ADDED_TEXT }],
    ]);
    const [empty, spaces, missing, padded, max, over, withAuthor, withParent, nope, notNumber, put, old] = out;
    for (const r of [empty, spaces, missing, over]) expect([r.status, r.body.error.code]).toEqual([400, 'VALIDATION_FAILED']);
    expect(empty.body.error.details).toEqual({ errors: [], properties: { content: { errors: ['Too small: expected string to have >=1 characters'] } } });
    expect(spaces.body.error.details).toEqual(empty.body.error.details);
    expect(missing.body.error.details).toEqual({ errors: [], properties: { content: { errors: ['Invalid input: expected string, received undefined'] } } });
    expect(over.body.error.details).toEqual({ errors: [], properties: { content: { errors: ['Too big: expected string to have <=2200 characters'] } } });
    expect([padded.status, padded.body.data.content]).toEqual([201, ADDED_TEXT]);
    expect([max.status, max.body.data.content.length]).toEqual([201, 2200]);
    expect([withAuthor.status, withAuthor.body.data.authorId, withAuthor.body.data.username]).toEqual([201, 2, 'jaehoon']);
    expect(withParent.status).toBe(201);
    expect(await onDb(GATE_DB, 'SELECT parent_id FROM comments WHERE id = $1', [withParent.body.data.id])).toEqual([{ parent_id: null }]);
    expect(nope.body).toEqual(v2Error('POST_NOT_FOUND', '그런 게시물은 없어요', '/api/v2/posts/99/comments'));
    expect([nope.status, notNumber.status, notNumber.body.error.code]).toEqual([404, 404, 'POST_NOT_FOUND']);
    expect([put.status, put.allow]).toEqual([405, 'GET, POST']);
    expect([old.status, Object.keys(old.body)]).toEqual([201, ['id', 'authorId', 'content', 'likeCount', 'createdAt', 'username', 'profileImage']]);
    // 로그인 없이 · 읽을 수 없는 본문
    const extra = await withServer(version(1), GATE_DB, async ({ base: url }) => {
      const nobody = await browser(url).send('POST', '/api/v2/posts/2/comments', { content: ADDED_TEXT });
      const tab = await loggedIn(url, 'jaehoon');
      const res = await fetch(`${url}/api/v2/posts/2/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenFor(2)}` }, body: '{"content": "한 입만' });
      expect(tab).toBeTruthy();
      return { nobody, bad: { status: res.status, body: await res.json() } };
    });
    expect([extra.nobody.status, extra.nobody.body.error.code]).toEqual([401, 'LOGIN_REQUIRED']);
    expect([extra.bad.status, extra.bad.body.error.code, extra.bad.body.error.message]).toEqual([400, 'INVALID_BODY', '보낸 내용을 읽을 수 없어요']);
    seen.step1Extra = {
      empty: empty.text, spaces: spaces.text, missing: missing.text, over: scrubTime(over.body), padded: padded.body.data.content,
      withAuthor: withAuthor.text, nope: nope.text, notNumber: notNumber.text, put: put.text, putAllow: put.allow, old: old.text,
      nobody: extra.nobody.text, bad: extra.bad.body,
    };
  }, 90_000);

  it('🔴 세 층 판 — 쿼리는 게시물 확인 · 넣기 · 넣은 댓글 읽기 · 글쓴이 · COMMIT(Prisma 가 넣기와 읽기를 스스로 묶는다 — BEGIN 줄은 로그에 안 찍힌다) · 숫자를 고치는 줄이 없다', async () => {
    await copyDb(GATE_DB);
    const q = await queriesOfSend(version(1), GATE_DB, 'POST', '/api/v2/posts/2/comments', { content: ADDED_TEXT });
    expect(q.status).toBe(201);
    expect(q.raw).not.toMatch(/UPDATE|BEGIN/);
    expect(q.lines.map((line) => line.split(' ').slice(1, 4).join(' '))).toEqual([
      'SELECT "public"."posts"."id" FROM', 'INSERT INTO "public"."comments"', 'SELECT "public"."comments"."id", "public"."comments"."author_id",',
      'SELECT "public"."users"."id", "public"."users"."username",', 'COMMIT',
    ]);
    seen.step1Queries = q.raw;
  }, 60_000);
});

// ── 축 ② Step 2 ────────────────────────────────────────────────────────────────
const STEP2_BLOCKS = [...STEP1_BLOCKS, [POST2, 'GET http://localhost:3000/api/v2/posts/2']];
/** 2번 게시물을 보고 · 달고 · 다시 본다(학생이 «2번 게시물» 을 달기 전·뒤로 누르는 차례). */
const beforeAfter = async (label, db, { edit } = {}) => {
  await copyDb(db);
  const text = read(version('2a')(HTTP_FILE));
  const runs = await withServer(version(label), db, () => httpyac(compose(text, [LOGIN, POST2, ADD, POST2])), { edit });
  return { runs, before: runs[1].body.data, added: runs[2], after: runs[3].body.data };
};

describe('축 ② Step 2 — 숫자를 같은 트랜잭션에서', () => {
  it('🔴 강의 자료 판 — .http 끝에 «2번 게시물»(GET /posts/2) · 달기 전·뒤 commentCount 가 29 그대로 · updatedAt 도 그대로(원댓글은 30)', async () => {
    const text = read(version('2a')(HTTP_FILE));
    expect(text.startsWith(read(version(1)(HTTP_FILE)))).toBe(true);
    const { head, blocks } = blocksOf(text);
    expect(head).toBe('');
    expect(blocks.map((b) => [b.title, b.request])).toEqual(STEP2_BLOCKS);
    const { runs, before, added, after } = await beforeAfter('2a', GATE_DB);
    expect(runs.map((r) => r.status)).toEqual([200, 200, 201, 200]);
    expect([before.commentCount, after.commentCount]).toEqual([29, 29]);
    expect(after.updatedAt).toBe(before.updatedAt);
    expect(await countOf(GATE_DB, 2)).toEqual({ id: 2, count: 29, roots: 30, rows: 31 });
    seen.step2a = { file: text, before: keep(runs[1]), added: keep(added), after: keep(runs[3]) };
  }, 60_000);

  it('🔴 increment 판 — 숫자는 29 → 30 으로 맞지만 updatedAt 이 단 시각으로 바뀐다(createdAt 은 그대로) · 응답은 아직 댓글만', async () => {
    const { runs, before, added, after } = await beforeAfter('2b', GATE_DB);
    expect(runs.map((r) => r.status)).toEqual([200, 200, 201, 200]);
    expect([before.commentCount, after.commentCount]).toEqual([29, 30]);
    expect(after.createdAt).toBe(before.createdAt);
    expect(after.updatedAt).not.toBe(before.updatedAt);
    // 바뀐 시각은 방금 단 댓글의 시각과 1초 안
    expect(Math.abs(Date.parse(after.updatedAt) - Date.parse(added.body.data.createdAt))).toBeLessThan(1000);
    expect(Object.keys(added.body.data)).toEqual(['id', 'authorId', 'content', 'likeCount', 'createdAt', 'username', 'profileImage']);
    expect(await countOf(GATE_DB, 2)).toEqual({ id: 2, count: 30, roots: 30, rows: 31 });
    seen.step2b = { before: keep(runs[1]), added: keep(added), after: keep(runs[3]) };
  }, 60_000);

  it('🔴 고친 판 — 숫자 29 → 30 · updatedAt 그대로 · 응답 { comment, commentCount: 30 } · 숫자는 원댓글 수와 같다', async () => {
    const { runs, before, added, after } = await beforeAfter(2, GATE_DB);
    expect(runs.map((r) => r.status)).toEqual([200, 200, 201, 200]);
    expect([before.commentCount, after.commentCount]).toEqual([29, 30]);
    expect([after.createdAt, after.updatedAt]).toEqual([before.createdAt, before.updatedAt]);
    expect(Object.keys(added.body.data)).toEqual(['comment', 'commentCount']);
    expect(added.body.data.commentCount).toBe(30);
    expect(Object.keys(added.body.data.comment)).toEqual(['id', 'authorId', 'content', 'likeCount', 'createdAt', 'username', 'profileImage']);
    expect(added.body.data.comment).toMatchObject({ content: ADDED_TEXT, username: 'jaehoon', likeCount: 0 });
    expect(added.headers.location).toBeUndefined();
    expect(await drift(GATE_DB)).toEqual([]);
    // 좋아요도 같은 규칙 — 누르면 like_count 만 오르고 updatedAt 은 그대로(시작 판부터)
    seen.step2 = { before: keep(runs[1]), added: keep(added), after: keep(runs[3]) };
  }, 60_000);

  it('🔴 쿼리 로그 — 두 판 모두 넣기 뒤에 숫자 고치기 · 마지막 COMMIT 하나(BEGIN 줄은 안 찍힌다) · increment 판의 UPDATE 는 updated_at 까지 · 고친 판은 SQL 그대로(다음 줄에 찍힌다 — 템플릿이 줄바꿈으로 시작) + 숫자 읽기', async () => {
    await copyDb(GATE_DB);
    const inc = await queriesOfSend(version('2b'), GATE_DB, 'POST', '/api/v2/posts/2/comments', { content: ADDED_TEXT });
    await copyDb(GATE_DB);
    const fixed = await queriesOfSend(version(2), GATE_DB, 'POST', '/api/v2/posts/2/comments', { content: ADDED_TEXT });
    seen.step2Queries = { inc: inc.raw, fixed: fixed.raw };
    for (const q of [inc, fixed]) {
      expect(q.status).toBe(201);
      expect(q.lines.at(-1)).toBe('prisma:query COMMIT');
      expect(q.lines.filter((line) => line === 'prisma:query COMMIT')).toHaveLength(1);
      expect(q.raw).not.toMatch(/BEGIN/);
    }
    expect(inc.lines).toHaveLength(6);
    expect(inc.lines[4]).toMatch(/^prisma:query UPDATE "public"\."posts" SET "comment_count" = \("public"\."posts"\."comment_count" \+ \$1\), "updated_at" = \$2 WHERE/);
    expect(fixed.lines).toHaveLength(7);
    expect(fixed.raw).toContain('prisma:query \n    UPDATE posts SET comment_count = comment_count + $1 WHERE id = $2\n');
    expect(fixed.lines[5]).toBe('prisma:query SELECT "public"."posts"."id", "public"."posts"."comment_count" FROM "public"."posts" WHERE ("public"."posts"."id" = $1 AND 1=1) LIMIT $2 OFFSET $3');
  }, 90_000);

  // p2-35 과제 [응용] 답안의 확인 셋 — 숫자를 고친 «뒤» 에 throw 한 줄
  const THROW = "    throw new Error('서버가 갑자기 멈췄어요');\n";
  const CREATE_END = '      select: commentFields,\n    });\n';
  it('🔴 실패하면 둘 다 되돌아간다(고친 판에 throw 한 줄) · 🔎 increment 판에서 tx 대신 prisma 로 숫자를 고치면 숫자만 오른다 · 트랜잭션 없이 넣기와 숫자 사이에서 멈추면 댓글만 남는다', async () => {
    const run = async (label, edit) => {
      await copyDb(GATE_DB);
      const { out, log } = await sendSteps(version(label), GATE_DB, [['POST', '/api/v2/posts/2/comments', { content: ADDED_TEXT }]], { edit });
      return { status: out[0].status, code: out[0].body.error?.code, post2: await countOf(GATE_DB, 2), logged: log.includes('서버가 갑자기 멈췄어요') };
    };
    // 고친 판 — 숫자를 고친 다음 줄에서 멈춘다
    const rolled = await run(2, (dir) => replaceIn(dir, 'services/commentService.js', '    const commentCount = await changeCommentCount(tx, postId, 1);\n', `    const commentCount = await changeCommentCount(tx, postId, 1);\n${THROW}`));
    expect(rolled).toEqual({ status: 500, code: 'INTERNAL_ERROR', post2: { id: 2, count: 29, roots: 29, rows: 30 }, logged: true });
    // increment 판 — 숫자를 tx 대신 prisma 로 고치고 그 뒤에서 멈춘다
    const outside = await run('2b', (dir) => {
      replaceIn(dir, 'services/commentService.js', '    await tx.post.update({\n', '    await prisma.post.update({\n');
      replaceIn(dir, 'services/commentService.js', '      data: { commentCount: { increment: 1 } },\n    });\n', `      data: { commentCount: { increment: 1 } },\n    });\n${THROW}`);
    });
    expect(outside).toEqual({ status: 500, code: 'INTERNAL_ERROR', post2: { id: 2, count: 30, roots: 29, rows: 30 }, logged: true });
    // 트랜잭션 없이 — 댓글을 넣은 다음 줄에서 멈춘다(숫자를 고치는 줄까지 못 간다)
    const noTx = await run('2b', (dir) => {
      replaceIn(dir, 'services/commentService.js', '  return prisma.$transaction(async (tx) => {\n', '  {\n    const tx = prisma;\n');
      replaceIn(dir, 'services/commentService.js', '    return flatten(comment);\n  });\n}', '    return flatten(comment);\n  }\n}');
      replaceIn(dir, 'services/commentService.js', CREATE_END, `${CREATE_END}${THROW}`);
    });
    expect(noTx).toEqual({ status: 500, code: 'INTERNAL_ERROR', post2: { id: 2, count: 29, roots: 30, rows: 31 }, logged: true });
    seen.rollback = { rolled, outside, noTx };
  }, 120_000);

  it('🔴 고친 판 — 본문에 parentId 를 넣어도 원댓글로 달리고 숫자가 오른다(답글을 다는 길이 이 API 에 없다) · 연달아 다섯 번 보내도 숫자 = 원댓글', async () => {
    await copyDb(GATE_DB);
    const { out } = await sendSteps(version(2), GATE_DB, [
      ['POST', '/api/v2/posts/2/comments', { content: ADDED_TEXT, parentId: 4 }],
      ...Array.from({ length: 5 }, () => ['POST', '/api/v2/posts/2/comments', { content: ADDED_TEXT }]),
    ]);
    expect(out.map((r) => [r.status, r.body.data.commentCount])).toEqual([[201, 30], [201, 31], [201, 32], [201, 33], [201, 34], [201, 35]]);
    expect(await onDb(GATE_DB, 'SELECT parent_id FROM comments WHERE id = $1', [out[0].body.data.comment.id])).toEqual([{ parent_id: null }]);
    expect(out.every((r) => r.drift.length === 0)).toBe(true);
    // 동시에 다섯 — 숫자는 SQL 한 줄이 «지금 값 + 1» 로 고쳐서 하나도 안 잃는다
    const parallel = await withServer(version(2), GATE_DB, async ({ base: url }) => {
      const tab = await loggedIn(url, 'jaehoon');
      return Promise.all(Array.from({ length: 5 }, () => tab.send('POST', '/api/v2/posts/2/comments', { content: ADDED_TEXT })));
    });
    expect(parallel.map((r) => r.status)).toEqual([201, 201, 201, 201, 201]);
    expect(parallel.map((r) => r.body.data.commentCount).sort((a, b) => a - b)).toEqual([36, 37, 38, 39, 40]);
    expect(await drift(GATE_DB)).toEqual([]);
  }, 90_000);
});

// ── 축 ③ Step 3 ────────────────────────────────────────────────────────────────
const D_WRONG = '2번 게시물 주소로 1번 게시물의 댓글 지우기';
const D_WRONG2 = '2번 게시물 주소로 1번 게시물의 다른 댓글 지우기';
const D_RIGHT = '1번 게시물 주소로 같은 댓글 지우기';
const D_ADD = '지울 댓글 달기';
const D_MINE = '내가 단 댓글 지우기';
const D_AGAIN = '같은 댓글을 한 번 더 지우기';
const D_OTHERS = '남의 게시물에 남이 단 댓글 지우기';
const D_NONE = '없는 댓글 지우기';
const STEP3_BLOCKS = [
  ...STEP2_BLOCKS,
  [D_WRONG, 'DELETE http://localhost:3000/api/v2/posts/2/comments/3'],
  [POST1, 'GET http://localhost:3000/api/v2/posts/1'],
  [D_WRONG2, 'DELETE http://localhost:3000/api/v2/posts/2/comments/2'],
  [D_RIGHT, 'DELETE http://localhost:3000/api/v2/posts/1/comments/2'],
  [D_ADD, 'POST http://localhost:3000/api/v2/posts/2/comments'],
  [D_MINE, 'DELETE http://localhost:3000/api/v2/posts/2/comments/{{mine.data.comment.id}}'],
  [D_AGAIN, 'DELETE http://localhost:3000/api/v2/posts/2/comments/{{mine.data.comment.id}}'],
  [D_OTHERS, 'DELETE http://localhost:3000/api/v2/posts/2/comments/6'],
  [D_NONE, 'DELETE http://localhost:3000/api/v2/posts/2/comments/999'],
];
const COMMENT3 = { id: 3, authorId: 4, content: '다음에 같이 가요', likeCount: 0, username: 'nayeon', profileImage: null };

describe('축 ③ Step 3 — 지우기 API', () => {
  it('🔴 강의 자료 판 — .http 끝에 지우기 요청 아홉(«지울 댓글 달기» 에 # @name mine) · 앞 블록은 Step 2 그대로', () => {
    const text = read(version('3a')(HTTP_FILE));
    expect(text.startsWith(read(version(2)(HTTP_FILE)))).toBe(true);
    const { head, blocks } = blocksOf(text);
    expect(head).toBe('');
    expect(blocks.map((b) => [b.title, b.request])).toEqual(STEP3_BLOCKS);
    expect(text).toContain(`### ${D_ADD}\n# @name mine\nPOST `);
    expect(text).toContain(`"content": "${MINE_TEXT}"`);
    for (const label of ['3b', '3c', '3d', '3e', 3]) expect(read(version(label)(HTTP_FILE))).toBe(text);
    seen.step3File = text;
  });

  it('🔴 겪기 판(번호로만 찾는다) — 2번 게시물 주소로 1번 게시물의 댓글(3 · nayeon · jaehoon 의 게시물)을 지우면 200 · 그 댓글이 지워지고 2번 게시물의 숫자가 29 → 28 · 1번은 3 그대로(원댓글은 2)', async () => {
    await copyDb(GATE_DB);
    const text = read(version('3a')(HTTP_FILE));
    const runs = await withServer(version('3b'), GATE_DB, () => httpyac(compose(text, [LOGIN, POST2, POST1, D_WRONG, POST1, POST2])));
    expect(runs.map((r) => r.status)).toEqual([200, 200, 200, 200, 200, 200]);
    const deleted = runs[3].body.data;
    expect(Object.keys(deleted)).toEqual(['comment', 'commentCount']);
    expect(deleted.comment).toMatchObject(COMMENT3);
    expect(deleted.commentCount).toBe(28);
    expect([runs[1].body.data.commentCount, runs[5].body.data.commentCount]).toEqual([29, 28]);
    expect([runs[2].body.data.commentCount, runs[4].body.data.commentCount]).toEqual([3, 3]);
    expect(await onDb(GATE_DB, 'SELECT id FROM comments WHERE id = 3')).toEqual([]);
    expect(await drift(GATE_DB)).toEqual([{ id: 1, count: 3, roots: 2, rows: 4 }, { id: 2, count: 28, roots: 29, rows: 30 }]);
    // 고친 판으로 같은 요청 — 404 COMMENT_NOT_FOUND · 숫자도 댓글도 그대로
    await copyDb(GATE2_DB);
    const fixed = await withServer(version(3), GATE2_DB, () => httpyac(compose(text, [LOGIN, D_WRONG, POST1, POST2])));
    expect(fixed.map((r) => r.status)).toEqual([200, 404, 200, 200]);
    expect(fixed[1].body).toEqual(v2Error('COMMENT_NOT_FOUND', '그런 댓글은 없어요', '/api/v2/posts/2/comments/3'));
    expect([fixed[2].body.data.commentCount, fixed[3].body.data.commentCount]).toEqual([3, 29]);
    expect(await drift(GATE2_DB)).toEqual([]);
    seen.step3b = { runs: runs.map(keep), fixed: fixed.map(keep) };
  }, 90_000);

  it('🔴 겪기 판의 다른 얼굴 — 1번 게시물 주소로 2번 게시물의 jaehoon 댓글(4 · 답글 12 가 딸림)을 지우면 1번 숫자가 내려간다 · 없는 게시물 주소(99)로 jaehoon 의 답글(10)을 지우면 지우기까지 되돌아가 404 POST_NOT_FOUND', async () => {
    await copyDb(GATE_DB);
    const { out } = await sendSteps(version('3b'), GATE_DB, [
      ['DELETE', '/api/v2/posts/1/comments/4'],
      ['DELETE', '/api/v2/posts/99/comments/10'],
    ]);
    expect([out[0].status, out[0].body.data.commentCount]).toEqual([200, 2]);
    // 4번에 딸린 답글(12)도 함께 지워진다 — 2번은 원댓글 28 · 숫자 29
    expect(out[0].drift).toEqual([{ id: 1, count: 2, roots: 3, rows: 5 }, { id: 2, count: 29, roots: 28, rows: 28 }]);
    expect([out[1].status, out[1].body.error.code]).toEqual([404, 'POST_NOT_FOUND']);
    expect(await onDb(GATE_DB, 'SELECT id FROM comments WHERE id = 10')).toEqual([{ id: 10 }]);
  }, 60_000);

  it('🔴 고친 판 — 경우마다(요청마다 숫자 = 원댓글 수) · 어긋난 주소 404 · 맞는 주소 200(내 게시물에 남이 단 댓글) · 내 댓글 달고 지우기 · 두 번째는 404 · 남의 게시물에 남이 단 댓글 403 · 없는 댓글 404', async () => {
    await copyDb(GATE_DB);
    const { out } = await sendSteps(version(3), GATE_DB, [
      ['DELETE', '/api/v2/posts/2/comments/2'],
      ['DELETE', '/api/v2/posts/1/comments/2'],
      ['POST', '/api/v2/posts/2/comments', { content: MINE_TEXT }],
    ]);
    const mine = out[2].body.data.comment.id;
    const rest = await sendSteps(version(3), GATE_DB, [
      ['DELETE', `/api/v2/posts/2/comments/${mine}`],
      ['DELETE', `/api/v2/posts/2/comments/${mine}`],
      ['DELETE', '/api/v2/posts/2/comments/6'],
      ['DELETE', '/api/v2/posts/2/comments/999'],
      ['DELETE', '/api/v2/posts/2/comments/abc'],
      ['DELETE', '/api/v2/posts/99/comments/5'],
      ['PATCH', '/api/v2/posts/2/comments/5', { content: 'x' }],
      ['DELETE', '/api/posts/1/comments/3'],
    ]);
    const [wrong, right, added] = out;
    const [delMine, again, others, none, notNumber, noPost, patch, old] = rest.out;
    expect([...out, ...rest.out].every((r) => r.drift.length === 0)).toBe(true);
    expect(wrong.body).toEqual(v2Error('COMMENT_NOT_FOUND', '그런 댓글은 없어요', '/api/v2/posts/2/comments/2'));
    expect([right.status, right.body.data.commentCount]).toEqual([200, 2]);
    expect(right.body.data.comment).toMatchObject({ id: 2, content: '사진 잘 나왔네요', username: 'seungwoo' });
    expect([added.status, added.body.data.commentCount]).toEqual([201, 30]);
    expect([delMine.status, delMine.body.data.commentCount, delMine.body.data.comment.content]).toEqual([200, 29, MINE_TEXT]);
    expect(delMine.body.data.comment).toEqual(added.body.data.comment);
    expect([again.status, again.body.error.code]).toEqual([404, 'COMMENT_NOT_FOUND']);
    expect(others.body).toEqual(v2Error('CANNOT_REMOVE_COMMENT', '내 댓글이나 내 게시물에 달린 댓글만 지울 수 있어요', '/api/v2/posts/2/comments/6'));
    expect(others.status).toBe(403);
    expect([none.status, none.body.error.code, notNumber.status, notNumber.body.error.code]).toEqual([404, 'COMMENT_NOT_FOUND', 404, 'COMMENT_NOT_FOUND']);
    expect([noPost.status, noPost.body.error.code]).toEqual([404, 'COMMENT_NOT_FOUND']);
    expect([patch.status, patch.allow]).toEqual([405, 'DELETE']);
    expect([old.status, Object.keys(old.body)]).toEqual([200, ['comment', 'commentCount']]);
    expect(await countOf(GATE_DB, 1)).toEqual({ id: 1, count: 1, roots: 1, rows: 3 });
    // 로그인 없이 401 · 403 은 남의 게시물 주인이 아닌 다른 로그인(seoyeon)에도
    const extra = await withServer(version(3), GATE_DB, async ({ base: url }) => {
      const nobody = await browser(url).send('DELETE', '/api/v2/posts/2/comments/6');
      const seoyeon = await loggedIn(url, 'seoyeon');
      return { nobody, seoyeon: await seoyeon.send('DELETE', '/api/v2/posts/1/comments/1') };
    });
    expect([extra.nobody.status, extra.nobody.body.error.code]).toEqual([401, 'LOGIN_REQUIRED']);
    expect([extra.seoyeon.status, extra.seoyeon.body.error.code]).toEqual([403, 'CANNOT_REMOVE_COMMENT']);
    seen.step3 = Object.fromEntries(Object.entries({ wrong, right, added, delMine, again, others, none, notNumber, noPost, patch, old }).map(([k, r]) => [k, { status: r.status, allow: r.allow, body: r.text }]));
  }, 120_000);

  it('🔴 고친 판 — .http 전체를 위에서부터 보내면(학생이 처음 판으로 차례로 누른 것과 같은 DB) 상태 줄 · 숫자 = 원댓글', async () => {
    await copyDb(GATE_DB);
    const text = read(version(3)(HTTP_FILE));
    const runs = await withServer(version(3), GATE_DB, () => httpyac(text));
    expect(runs.map((r) => [r.title, r.status])).toEqual([
      [LOGIN, 200], ['1번 게시물의 댓글', 200], ['없는 게시물의 댓글', 404], ['댓글이 없는 게시물의 댓글', 200],
      ['2번 게시물의 댓글 — 첫 페이지', 200], ['둘째 페이지 — 받은 커서를 그대로 돌려준다', 200], [ADD, 201], [POST2, 200],
      [D_WRONG, 404], [POST1, 200], [D_WRONG2, 404], [D_RIGHT, 200], [D_ADD, 201], [D_MINE, 200], [D_AGAIN, 404], [D_OTHERS, 403], [D_NONE, 404],
    ]);
    expect(await drift(GATE_DB)).toEqual([]);
    seen.step3All = runs.map(keep);
  }, 90_000);

  it('🔴 🙋 답글이 달린 원댓글(1 · minji — 답글 10 jaehoon · 11 dahye)을 게시물 주인 jaehoon 이 지우면 행 5 → 2 · 숫자 3 → 2 · 답글 하나(11)만 지우면 행 5 → 4 · 숫자 3 그대로 · 응답의 commentCount 도 3', async () => {
    await copyDb(GATE_DB);
    const root = await sendSteps(version(3), GATE_DB, [['DELETE', '/api/v2/posts/1/comments/1']]);
    expect([root.out[0].status, root.out[0].body.data.commentCount]).toEqual([200, 2]);
    expect(root.out[0].body.data.comment).toMatchObject({ id: 1, username: 'minji', content: '저도 가봤어요', likeCount: 7 });
    expect(await countOf(GATE_DB, 1)).toEqual({ id: 1, count: 2, roots: 2, rows: 2 });
    expect(await onDb(GATE_DB, 'SELECT id FROM comments WHERE post_id = 1 ORDER BY id')).toEqual([{ id: 2 }, { id: 3 }]);
    await copyDb(GATE2_DB);
    const reply = await sendSteps(version(3), GATE2_DB, [['DELETE', '/api/v2/posts/1/comments/11'], ['DELETE', '/api/v2/posts/1/comments/10']]);
    expect(reply.out.map((r) => [r.status, r.body.data.commentCount, r.body.data.comment.content])).toEqual([[200, 3, '저도 껴주세요'], [200, 3, '다음엔 같이 가요']]);
    expect(await countOf(GATE2_DB, 1)).toEqual({ id: 1, count: 3, roots: 3, rows: 3 });
    // 답글의 원댓글이 남의 게시물에 있으면 — 2번 게시물의 답글 12(minji)는 jaehoon 이 못 지운다
    const others = await sendSteps(version(3), GATE2_DB, [['DELETE', '/api/v2/posts/2/comments/12']]);
    expect(others.out[0].status).toBe(403);
    seen.replies = { root: root.out[0].text, reply: reply.out.map((r) => r.text) };
  }, 90_000);

  it('🔴 쿼리 로그 — 끝 판 지우기는 댓글 찾기(게시물 주인 · 글쓴이 따로 — JOIN 이 아니다) · 지우기 · 숫자 SQL · 숫자 읽기 · COMMIT · 403 · 404 는 찾기에서 멈춘다 · 겪기 판은 찾기에 post_id 가 없다', async () => {
    await copyDb(GATE_DB);
    const ok = await queriesOfSend(version(3), GATE_DB, 'DELETE', '/api/v2/posts/1/comments/2');
    const forbidden = await queriesOfSend(version(3), GATE_DB, 'DELETE', '/api/v2/posts/2/comments/6');
    const wrong = await queriesOfSend(version(3), GATE_DB, 'DELETE', '/api/v2/posts/2/comments/3');
    const trap = await queriesOfSend(version('3b'), GATE_DB, 'DELETE', '/api/v2/posts/2/comments/3');
    const fixedC = await queriesOfSend(version('3c'), GATE_DB, 'DELETE', '/api/v2/posts/1/comments/1');
    seen.step3Queries = { ok: ok.raw, forbidden: forbidden.raw, wrong: wrong.raw, trap: trap.raw, fixedC: fixedC.raw };
    expect([ok.status, forbidden.status, wrong.status, trap.status, fixedC.status]).toEqual([200, 403, 404, 200, 200]);
    // 찾기 — 고친 판은 WHERE 에 post_id 가 더해진다 · 게시물 주인은 따로 한 줄(JOIN 이 아니다)
    expect(ok.lines[0]).toMatch(/WHERE \("public"\."comments"\."id" = \$1 AND "public"\."comments"\."post_id" = \$2\)/);
    expect(trap.lines[0]).toMatch(/WHERE \("public"\."comments"\."id" = \$1 AND 1=1\)/);
    expect(ok.lines.slice(1, 3).some((line) => /^prisma:query SELECT "public"\."posts"\."id", "public"\."posts"\."author_id" FROM "public"\."posts" WHERE/.test(line))).toBe(true);
    expect(ok.lines.join('\n')).not.toMatch(/JOIN/);
    expect(ok.lines.at(-1)).toBe('prisma:query COMMIT');
    expect(ok.raw).toContain('UPDATE posts SET comment_count = comment_count + $1 WHERE id = $2');
    expect(ok.lines.some((line) => /^prisma:query DELETE FROM "public"\."comments" WHERE "public"\."comments"\."id" = \$1/.test(line))).toBe(true);
    // 403 · 404 는 찾기에서 멈춘다 — 403 은 찾기 세 줄(댓글 + 게시물 주인 + 글쓴이) · 404 는 한 줄
    expect([forbidden.lines.length, wrong.lines.length]).toEqual([3, 1]);
    expect(forbidden.raw + wrong.raw).not.toMatch(/DELETE|UPDATE/);
  }, 90_000);

  it('🔴 같은 댓글을 동시에 둘이 지우면 — 고친 판(3c)은 둘 다 200 에 숫자를 두 번 내린다(3 → 1 · 원댓글 2) · 끝 판은 200 하나 · 404 하나 · 숫자 = 원댓글 (다섯 번씩)', async () => {
    const pairOf = async (label) => {
      await copyDb(GATE_DB);
      const pair = await withServer(version(label), GATE_DB, async ({ base: url, tail }) => {
        const tab = await loggedIn(url, 'jaehoon');
        const both = await Promise.all([tab.send('DELETE', '/api/v2/posts/1/comments/2'), tab.send('DELETE', '/api/v2/posts/1/comments/2')]);
        await sleep(200);
        return { statuses: both.map((r) => r.status).sort(), codes: both.map((r) => r.body.error?.code ?? null).sort(), counts: both.map((r) => r.body.data?.commentCount ?? null), internal: /prisma:error|INTERNAL/.test(tail()) };
      });
      return { ...pair, drift: await drift(GATE_DB) };
    };
    const before = [];
    const after = [];
    for (let turn = 0; turn < 5; turn += 1) before.push(await pairOf('3c'));
    for (let turn = 0; turn < 5; turn += 1) after.push(await pairOf(3));
    seen.concurrentDelete = { before, after };
    for (const r of before) expect([r.statuses, r.drift]).toEqual([[200, 200], [{ id: 1, count: 1, roots: 2, rows: 4 }]]);
    for (const r of after) expect([r.statuses, r.codes, r.counts.filter((n) => n !== null), r.drift]).toEqual([[200, 404], ['COMMENT_NOT_FOUND', null], [2], []]);
  }, 180_000);

  it('🔴 문서 — /api/docs 가 뜨고 /api/openapi.json 에 댓글 주소 셋(GET · POST · DELETE) · 에러 코드는 MESSAGES 에 있다 · 좋아요 주소는 없다', async () => {
    await copyDb(GATE_DB);
    const out = await withServer(version(3), GATE_DB, async ({ base: url }) => {
      const page = await fetch(`${url}/api/docs/`);
      const doc = await (await fetch(`${url}/api/openapi.json`)).json();
      return { status: page.status, type: page.headers.get('content-type'), html: await page.text(), doc };
    });
    expect([out.status, out.type]).toEqual([200, 'text/html; charset=utf-8']);
    expect(out.html).toContain('swagger-ui');
    const paths = out.doc.paths;
    expect(Object.keys(paths)).toEqual(['/api/v2/posts', '/api/v2/posts/{id}/comments', '/api/v2/posts/{id}/comments/{commentId}', '/api/v2/auth/signup', '/api/posts']);
    expect(Object.keys(paths['/api/v2/posts/{id}/comments'])).toEqual(['parameters', 'get', 'post']);
    expect(Object.keys(paths['/api/v2/posts/{id}/comments/{commentId}'])).toEqual(['parameters', 'delete']);
    expect(Object.keys(paths['/api/v2/posts/{id}/comments/{commentId}'].delete.responses)).toEqual(['200', '401', '403', '404']);
    expect(JSON.stringify(paths)).not.toContain('likes');
    expect(out.doc.components.schemas.ErrorCode.enum).toEqual(expect.arrayContaining(['COMMENT_NOT_FOUND', 'CANNOT_REMOVE_COMMENT']));
    seen.docs = { comments: paths['/api/v2/posts/{id}/comments'], remove: paths['/api/v2/posts/{id}/comments/{commentId}'], schemas: { Comment: out.doc.components.schemas.Comment, CommentChange: out.doc.components.schemas.CommentChange } };
  }, 60_000);
});

// ── 축 ④ 회귀 ──────────────────────────────────────────────────────────────────
describe('축 ④ 회귀 — 시작 판과 같다', () => {
  /** 댓글 목록 끝까지 · 게시물 목록 첫 두 페이지 · 좋아요 누르기와 취소 — 실행마다 다른 시각은 지운다. */
  const tour = async (from, db) => {
    await copyDb(db);
    return withServer(from, db, async ({ base: url }) => {
      const tab = await loggedIn(url, 'jaehoon');
      const pages = [];
      let cursor = null;
      for (let turn = 0; turn < 5; turn += 1) {
        const res = await tab.get(`/api/v2/posts/2/comments${cursor === null ? '' : `?cursor=${cursor}`}`);
        pages.push(res.body.data.items.map((c) => [c.id, c.username, c.content]));
        if (res.body.data.nextCursor === null) break;
        cursor = res.body.data.nextCursor;
      }
      const first = await tab.get('/api/v2/posts?limit=2');
      const second = await tab.get(`/api/v2/posts?limit=2&cursor=${first.body.data.nextCursor}`);
      const like = await tab.send('PUT', '/api/v2/posts/3/likes/me');
      const unlike = await tab.send('DELETE', '/api/v2/posts/3/likes/me');
      const post3 = await tab.get('/api/v2/posts/3');
      const badCursor = await tab.get('/api/v2/posts/2/comments?cursor=abc');
      return {
        pages, posts: [first.body, second.body], like: like.body, unlike: unlike.body,
        post3Updated: post3.body.data.updatedAt, badCursor: scrubTime(badCursor.body),
      };
    });
  };
  it('🔴 댓글 목록(첫 페이지 20 · 둘째 9) · 게시물 목록 · 좋아요 · 잘못된 커서가 시작 판과 한 글자도 같다', async () => {
    const [a, b] = [await tour(base(), GATE_DB), await tour(version(3), GATE2_DB)];
    expect(b).toEqual(a);
    expect(a.pages.map((p) => p.length)).toEqual([20, 9]);
    expect(a.posts[0].data.items.map((p) => p.id)).toEqual([14, 9]);
    expect([a.like.data.liked, a.unlike.data.liked, a.like.data.likeCount - a.unlike.data.likeCount]).toEqual([true, false, 1]);
  }, 90_000);
});

// ── 축 ⑤ 학생 파일 차이 ───────────────────────────────────────────────────────────
describe('축 ⑤ 학생 파일 차이 — 시작 판(code/p3-53 의 학생 파일)에서 각 판까지', () => {
  it('🔴 커밋 수와 차례 — Step 1 둘 · Step 2 셋 · Step 3 여섯 · 1 → 2 → 3', () => {
    expect([1, 2, 3].map((n) => stepCommits(n).length)).toEqual([2, 3, 6]);
    const order = execFileSync('git', ['log', '--format=%H', `${baseRef()}..${LINE}`], { cwd: P('.'), encoding: 'utf8' }).trim().split('\n').reverse();
    const labels = ['1a', 1, '2a', '2b', 2, '3a', '3b', '3c', '3d', '3e', 3];
    const at = labels.map((label) => order.indexOf(versionRef(label)));
    expect(at.every((n) => n >= 0)).toBe(true);
    expect(at).toEqual(at.slice().sort((a, b) => a - b));
    seen.commits = Object.fromEntries(labels.map((label) => [label, versionRef(label)]));
  });

  it('🔴 판마다 바뀐 학생 파일 — 교안이 «바꿀 파일» 로 말할 목록 · 새 패키지 · 스키마 · 마이그레이션 없음', () => {
    const r = (label) => versionRef(label);
    expect(changedStudentFiles(baseRef(), r('1a'))).toEqual([HTTP_FILE]);
    expect(changedStudentFiles(r('1a'), r(1))).toEqual(['controllers/commentController.js', 'routes/comments.js', 'schemas/commentSchema.js', 'services/commentService.js']);
    expect(changedStudentFiles(r(1), r('2a'))).toEqual([HTTP_FILE]);
    expect(changedStudentFiles(r('2a'), r('2b'))).toEqual(['services/commentService.js']);
    expect(changedStudentFiles(r('2b'), r(2))).toEqual(['services/commentService.js']);
    expect(changedStudentFiles(r(2), r('3a'))).toEqual([HTTP_FILE]);
    expect(changedStudentFiles(r('3a'), r('3b'))).toEqual(['controllers/commentController.js', 'errors.js', 'middlewares/params.js', 'routes/comments.js', 'services/commentService.js']);
    expect(changedStudentFiles(r('3b'), r('3c'))).toEqual(['services/commentService.js']);
    expect(changedStudentFiles(r('3c'), r('3d'))).toEqual(['docs/openapi.js']);
    expect(changedStudentFiles(r('3d'), r('3e'))).toEqual(['services/commentService.js']);
    expect(changedStudentFiles(r('3e'), r(3))).toEqual([FIX_SQL]);
    expect(changedStudentFiles(baseRef(), r(3))).toEqual([
      'controllers/commentController.js', 'docs/openapi.js', 'errors.js', FIX_SQL, 'middlewares/params.js', HTTP_FILE,
      'routes/comments.js', 'schemas/commentSchema.js', 'services/commentService.js',
    ]);
    for (const rel of ['package.json', 'package-lock.json', 'prisma/schema.prisma', 'app.js']) expect([rel, showAt(r(3), rel)]).toEqual([rel, showAt(baseRef(), rel)]);
    expect(readdirSync(version(3)('prisma/migrations'))).toEqual(readdirSync(base()('prisma/migrations')));
    // 고친 판 Step 3 은 찾는 조건 한 줄 + 그 위 주석 한 줄
    const diff = execFileSync('git', ['diff', '-U0', r('3b'), r('3c'), '--', 'services/commentService.js'], { cwd: P('.'), encoding: 'utf8' });
    expect(diff.split('\n').filter((line) => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line))).toEqual([
      '+  // 주소의 게시물에 달린 댓글만 찾는다. 번호만으로 찾으면 다른 게시물의 댓글도 찾아져서 숫자를 엉뚱한 게시물에서 내린다.',
      '-    where: { id: commentId },',
      '+    where: { id: commentId, postId },',
    ]);
    seen.diffs = Object.fromEntries([['1', r('1a'), r(1)], ['2b', r('2a'), r('2b')], ['2', r('2b'), r(2)], ['3b', r('3a'), r('3b')], ['3c', r('3b'), r('3c')], ['3d', r('3c'), r('3d')], ['3e', r('3d'), r('3e')], ['3', r('3e'), r(3)]]
      .map(([k, a, b]) => [k, execFileSync('git', ['diff', a, b, '--', ...STUDENT_FILES], { cwd: P('.'), encoding: 'utf8' })]));
    seen.files = Object.fromEntries(['routes/comments.js', 'controllers/commentController.js', 'services/commentService.js', 'schemas/commentSchema.js', 'middlewares/params.js'].map((rel) => [rel, showAt(r(3), rel)]));
    seen.files2b = showAt(r('2b'), 'services/commentService.js');
    seen.files3b = showAt(r('3b'), 'services/commentService.js');
    seen.files3c = showAt(r('3c'), 'services/commentService.js');
    seen.files1 = showAt(r(1), 'services/commentService.js');
  });

  it('🔴 학생 파일에 내부 어휘가 없다 · 첫 줄 경로 주석 · 쓰지 않기로 한 낱말이 없다', () => {
    const to = versionRef(3);
    for (const rel of changedStudentFiles(baseRef(), to)) {
      const text = showAt(to, rel);
      expect([rel, /게이트|판정|TDD|Step \d|p3-\d\d|회차|스냅숏/.test(text.split('\n').slice(1).join('\n'))]).toEqual([rel, false]);
      if (rel.endsWith('.js')) expect([rel, text.split('\n')[0]]).toEqual([rel, `// ~/instagram-api/${rel}`]);
      if (rel.endsWith('.sql')) expect([rel, text.split('\n')[0]]).toEqual([rel, `-- ~/instagram-api/${rel}`]);
    }
    // 오늘 새로 쓴 주석에는 문장 안 줄표(—)와 연결어미 뒤 쉼표가 없다
    const comments = execFileSync('git', ['diff', baseRef(), to, '--', ...STUDENT_FILES], { cwd: P('.'), encoding: 'utf8' })
      .split('\n').filter((line) => /^\+\s*(\/\/|--)/.test(line) && !/^\+(\/\/|--) ~\//.test(line));
    expect(comments.length).toBeGreaterThan(20);
    expect(comments.filter((line) => /—|(서|고|라|면|는데|지만|니까|으니|므로|어|아),/.test(line))).toEqual([]);
    // «돌려준다»(값을 돌려주다 — return)는 이 코드베이스가 늘 쓰는 다른 낱말이라 뺀다
    const banned = /자리|박다|박아|박힌|결[이을로의]|갈래|몸통|판[이을으]|겹|까닭|걸리|걸린|돌리|돌려(?!주|준|줄)|가르|갈리|재다|재서|벗기|되살|짝/;
    const labels = ['3b', '3c', '3d', '3e', 3, '2b', 2, 1];
    for (const label of labels) {
      const diff = execFileSync('git', ['diff', baseRef(), versionRef(label), '--', ...STUDENT_FILES], { cwd: P('.'), encoding: 'utf8' });
      const added = diff.split('\n').filter((line) => line.startsWith('+') && !line.startsWith('+++'));
      expect(added.length).toBeGreaterThan(0);
      expect([label, added.filter((line) => banned.test(line))]).toEqual([label, []]);
    }
  });
});

// ── 축 ⑥ 학생 한 사람의 흐름 ─────────────────────────────────────────────────────
/** Step 2 에서 «달기» 를 보낼 때 교안이 바꿔 쓰게 하는 글 — Step 1 은 강의 자료 그대로. */
const FLOW_TEXTS = { step2b: '어느 빵집 크루아상이에요?', step2: '크기가 손바닥만 하네요' };
describe('축 ⑥ 학생 한 사람의 흐름 — 한 DB 에서 판을 차례로 갈아 끼우며 .http 를 교안 차례로 누른다', () => {
  it('🔎 Step 1 달기 → Step 2 강의 자료로 보기 → increment 판 달기 → 고친 판 달기 → Step 3 겪기 판 → 고친 판 — 어디서 숫자가 어긋나고 무엇이 다시 맞추는가', async () => {
    await copyDb(GATE_DB);
    const text = read(version(3)(HTTP_FILE));
    // 교안은 Step 2 에서 «달기» 블록의 글을 바꿔서 보내게 한다 — 같은 글이 세 번 달려 화면에 같은 줄이 셋 보이지 않게.
    const ADD_LINE = `"content": "${ADDED_TEXT}"`;
    const send = async (label, titles, content = ADDED_TEXT) => {
      const source = compose(text, [LOGIN, ...titles]);
      if (source.split(ADD_LINE).length - 1 !== titles.filter((t) => t === ADD).length) throw new Error('달기 블록의 글 줄을 못 찾았다');
      const runs = await withServer(version(label), GATE_DB, () => httpyac(source.replaceAll(ADD_LINE, `"content": "${content}"`)));
      return { runs: runs.slice(1).map((r) => ({ title: r.title, status: r.status, body: r.body })), drift: await drift(GATE_DB) };
    };
    const flow = {};
    flow.step1 = await send(1, [ADD]);
    flow.step2a = await send('2a', [POST2]);
    flow.step2b = await send('2b', [ADD, POST2], FLOW_TEXTS.step2b);
    flow.step2 = await send(2, [ADD, POST2], FLOW_TEXTS.step2);
    flow.step3b = await send('3b', [D_WRONG, POST1, POST2]);
    flow.step3 = await send(3, [D_WRONG2, D_RIGHT, D_ADD, D_MINE, D_AGAIN, D_OTHERS, D_NONE, POST1, POST2]);
    const end = await counts(GATE_DB);
    seen.flow = { ...flow, end };
    expect(flow.step1.drift).toEqual([{ id: 2, count: 29, roots: 30, rows: 31 }]);
    expect(flow.step2.runs[0].body.data.commentCount).toBe(31);
    expect([flow.step1.runs[0].body.data.content, flow.step2b.runs[0].body.data.content, flow.step2.runs[0].body.data.comment.content])
      .toEqual([ADDED_TEXT, FLOW_TEXTS.step2b, FLOW_TEXTS.step2]);
    expect(flow.step3b.drift).toEqual([{ id: 1, count: 3, roots: 2, rows: 4 }, { id: 2, count: 30, roots: 32, rows: 33 }]);
    expect(flow.step3.drift).toEqual([{ id: 1, count: 2, roots: 1, rows: 3 }, { id: 2, count: 30, roots: 32, rows: 33 }]);
    // Step 3 끝 — 강의 자료 fix-comment-count.sql 을 실행한다(확인 SELECT 는 파일 끝의 그것)
    const sql = read(version(3)(FIX_SQL));
    const check = sql.slice(sql.lastIndexOf('SELECT posts.id'));
    const checkBefore = await onDb(GATE_DB, check);
    const timesBefore = await onDb(GATE_DB, 'SELECT id, updated_at FROM posts ORDER BY id');
    const first = await runSql(GATE_DB, sql);
    const afterFirst = await counts(GATE_DB);
    const second = await runSql(GATE_DB, sql);
    expect(checkBefore).toEqual([
      { id: 1, comment_count: 2, root_comments: '1' }, { id: 2, comment_count: 30, root_comments: '32' }, { id: 3, comment_count: 2, root_comments: '2' },
      { id: 4, comment_count: 0, root_comments: '0' }, { id: 5, comment_count: 0, root_comments: '0' }, { id: 9, comment_count: 0, root_comments: '0' },
      { id: 14, comment_count: 0, root_comments: '0' },
    ]);
    expect([first.length, first[0].command, first[0].rowCount, first[1].command]).toEqual([2, 'UPDATE', 7, 'SELECT']);
    expect(first[1].rows).toEqual([
      { id: 1, comment_count: 1, root_comments: '1' }, { id: 2, comment_count: 32, root_comments: '32' }, { id: 3, comment_count: 2, root_comments: '2' },
      { id: 4, comment_count: 0, root_comments: '0' }, { id: 5, comment_count: 0, root_comments: '0' }, { id: 9, comment_count: 0, root_comments: '0' },
      { id: 14, comment_count: 0, root_comments: '0' },
    ]);
    // 두 번 실행해도 같다 · updated_at 은 그대로 · 모든 게시물이 적힌 수 = 원댓글 수
    expect(second[1].rows).toEqual(first[1].rows);
    expect(await drift(GATE_DB)).toEqual([]);
    expect(await onDb(GATE_DB, 'SELECT id, updated_at FROM posts ORDER BY id')).toEqual(timesBefore);
    seen.flowSql = { checkBefore, update: { command: first[0].command, rowCount: first[0].rowCount }, checkAfter: first[1].rows, second: second[1].rows, afterFirst };
    seen.flowFixed = await counts(GATE_DB);
    // 끝 DB 의 2번 게시물 updatedAt — increment 판이 바꾼 채 남는다(시작 판의 시각과 다르다)
    const [p2] = await onDb(GATE_DB, 'SELECT updated_at, created_at FROM posts WHERE id = 2');
    expect(p2.updated_at.getTime()).toBeGreaterThan(p2.created_at.getTime());
    seen.flowEnd = await onDb(GATE_DB, `SELECT c.id, c.post_id, c.parent_id, u.username, c.content FROM comments c JOIN users u ON u.id = c.author_id WHERE c.id > 37 OR c.id <= 12 ORDER BY c.id`);
    expect(seen.flowEnd.filter((c) => c.id > 37).map((c) => [c.post_id, c.parent_id, c.username, c.content])).toEqual([
      [2, null, 'jaehoon', ADDED_TEXT], [2, null, 'jaehoon', FLOW_TEXTS.step2b], [2, null, 'jaehoon', FLOW_TEXTS.step2],
    ]);
  }, 180_000);
});

// ── 축 ⑦ Step 3 강의 자료 SQL ─────────────────────────────────────────────────────
describe('축 ⑦ Step 3 강의 자료 — lab/p3-54/fix-comment-count.sql', () => {
  it('🔴 파일 — 첫 줄 경로 주석 · 표준 SQL 만(psql 메타명령 · BEGIN/COMMIT 없음) · UPDATE 하나 + 확인 SELECT 하나 · updated_at 을 고치지 않는다', () => {
    const sql = read(version(3)(FIX_SQL));
    expect(sql.split('\n')[0]).toBe(`-- ~/instagram-api/${FIX_SQL}`);
    expect(sql.split('\n').filter((line) => /^\s*\\/.test(line))).toEqual([]);
    expect(sql).not.toMatch(/BEGIN|COMMIT|TRANSACTION/i);
    const statements = sql.split('\n').filter((line) => !line.startsWith('--')).join('\n').split(';').map((one) => one.trim()).filter(Boolean);
    expect(statements.map((one) => one.split(/\s/)[0])).toEqual(['UPDATE', 'SELECT']);
    expect(statements[0]).not.toMatch(/updated_at/);
    expect(statements[0]).toMatch(/parent_id IS NULL/);
    seen.fixSql = sql;
  });

  it('🔴 어긋남이 없는 판정 DB(p3-53 끝)에서 실행 — UPDATE 7행 · 숫자도 updated_at 도 그대로 · 확인 SELECT 의 두 값이 모든 줄에서 같다', async () => {
    await copyDb(GATE_DB);
    const before = await onDb(GATE_DB, 'SELECT id, comment_count, updated_at FROM posts ORDER BY id');
    const out = await runSql(GATE_DB, read(version(3)(FIX_SQL)));
    expect(out[0].rowCount).toBe(7);
    expect(out[1].rows.every((row) => String(row.comment_count) === row.root_comments)).toBe(true);
    expect(await onDb(GATE_DB, 'SELECT id, comment_count, updated_at FROM posts ORDER BY id')).toEqual(before);
    seen.fixSqlOnTpl = out[1].rows;
  }, 30_000);
});

// ── 축 ⑧ 교안 대조(수업 백엔드 · Step 1~3) ────────────────────────────────────────────
// 원고는 읽기만 한다 — 어긋나면 판정이 빨개질 뿐 원고를 고치지 않는다. 경로는 `P354_LECTURE` 로만 받는다(없으면 «건너뜀»).
// 고칠 곳은 `P354_LECTURE_REPORT=<파일>` 에 { line, lecture, measured } 로 남긴다. 실습 블록(lab/p3-54/)은 test/p3-54.lab.test.js 의 교안 축이 본다.
// 🔑 «응답 펜스 · 표 · 산문» 은 교안 차례대로 흐름(lessonFlow — 축 ⑥ 과 같은 차례 + Step 1 강의 자료 판의 405)의 실측과 맞댄다.
//    되돌아가기 셋 · 같이 지우기 · 본문 authorId 는 축 ② · ③ · ① 이 잰 값(seen)을 쓴다 — 이 축만 따로 돌리면 그 값이 없어 «실측 없음» 으로 남는다.
const LECTURE_MD = process.env.P354_LECTURE ?? null;
if (!LECTURE_MD) console.log('\n🚨🚨🚨 축 ⑧ 교안 대조 — 건너뜀 (P354_LECTURE 가 없다) 🚨🚨🚨\n');
const describeLecture = LECTURE_MD ? describe : describe.skip;
/** 원고의 펜스 — 언어 · 본문 · 시작 줄 번호 · Step · <details> 안인가. */
const fencesOf = (file) => {
  const out = [];
  let cur = null;
  let step = null;
  let details = false;
  read(file).split('\n').forEach((line, i) => {
    if (cur) {
      if (line.startsWith('```')) { out.push(cur); cur = null; } else cur.body.push(line);
      return;
    }
    if (line.startsWith('```')) { cur = { lang: line.slice(3).trim(), body: [], line: i + 1, step, details }; return; }
    if (line.startsWith('## ')) step = Number(/^## Step (\d+)/.exec(line)?.[1]) || null;
    if (line.startsWith('<details>')) details = true;
    if (line.startsWith('</details>')) details = false;
  });
  if (cur) throw new Error(`${file} — 닫히지 않은 펜스(${cur.line}번 줄)`);
  return out;
};
/** 원고의 마크다운 표 — 머리 칸 · 행 · 행마다 줄 번호 · Step. 펜스 안의 `|` 줄은 표가 아니다. */
const tablesOf = (file) => {
  const out = [];
  let cur = null;
  let inFence = false;
  let step = null;
  const cellsOf = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
  read(file).split('\n').forEach((line, i) => {
    if (line.startsWith('```')) inFence = !inFence;
    if (!inFence && line.startsWith('## ')) step = Number(/^## Step (\d+)/.exec(line)?.[1]) || null;
    if (!inFence && line.startsWith('|')) {
      if (!cur) { cur = { header: cellsOf(line), rows: [], lines: [], line: i + 1, step }; return; }
      if (/^\|[\s:|-]+\|$/.test(line.trim())) return;
      cur.rows.push(cellsOf(line));
      cur.lines.push(i + 1);
      return;
    }
    if (cur) { out.push(cur); cur = null; }
  });
  if (cur) out.push(cur);
  return out;
};
const plainCell = (cell) => cell.replace(/`/g, '');
const isElision = (line) => ['// ...', '...', '-- ...'].includes(line.trim());
/** 블록이 파일에 어떻게 들어 있나 — full · tail · excerpt(줄임 표시 · 줄이 차례대로) · null. */
const howIn = (body, file) => {
  const text = body.join('\n');
  if (text + '\n' === file || text === file) return 'full';
  if (body.some(isElision)) {
    let at = 0;
    const lines = file.split('\n');
    for (const line of body.filter((one) => one.trim() !== '' && !isElision(one))) {
      const found = lines.indexOf(line, at);
      if (found === -1) return null;
      at = found + 1;
    }
    return 'excerpt';
  }
  if (file.endsWith('\n' + text + '\n')) return 'tail';
  if (file.includes('\n' + text + '\n')) return 'slice';
  return null;
};
const API_JS = '// ~/instagram-api/';
const API_SQL = '-- ~/instagram-api/';
/** 교안의 수업 백엔드 블록 — ```http 전부 · ```javascript/```sql 첫 줄이 ~/instagram-api 경로 주석(lab/p3-54/ 의 실습 서버 .js 는 빼고 SQL 은 넣는다). */
const classFences = () => fencesOf(LECTURE_MD).flatMap((fence) => {
  const first = fence.body[0] ?? '';
  if (fence.lang === 'http') return [{ ...fence, rel: HTTP_FILE }];
  if (fence.lang === 'javascript' && first.startsWith(API_JS) && !first.startsWith(`${API_JS}lab/`)) return [{ ...fence, rel: first.slice(API_JS.length) }];
  if (fence.lang === 'sql' && first.startsWith(API_SQL)) return [{ ...fence, rel: first.slice(API_SQL.length) }];
  return [];
});
const EXPECTED_CLASS_FENCES = [
  [1, 'http', HTTP_FILE, 'tail', '1a'],
  [1, 'javascript', 'schemas/commentSchema.js', 'full', 1],
  [1, 'javascript', 'routes/comments.js', 'full', 1],
  [1, 'javascript', 'controllers/commentController.js', 'full', 1],
  [1, 'javascript', 'services/commentService.js', 'excerpt', 1],
  [2, 'http', HTTP_FILE, 'tail', '2a'],
  [2, 'javascript', 'services/commentService.js', 'excerpt', '2b'],
  [2, 'javascript', 'services/commentService.js', 'excerpt', 2],
  [3, 'http', HTTP_FILE, 'tail', '3a'],
  [3, 'javascript', 'middlewares/params.js', 'excerpt', '3b'],
  [3, 'javascript', 'errors.js', 'excerpt', '3b'],
  [3, 'javascript', 'routes/comments.js', 'full', '3b'],
  [3, 'javascript', 'controllers/commentController.js', 'excerpt', '3b'],
  [3, 'javascript', 'services/commentService.js', 'excerpt', '3b'],
  [3, 'javascript', 'services/commentService.js', 'excerpt', '3c'],
  [3, 'javascript', 'services/commentService.js', 'excerpt', 3],
  [3, 'sql', FIX_SQL, 'full', 3],
];
/** 교안 차례대로 흐름 — 판정 DB 사본 하나에서 판을 갈아 끼우며 교안이 보내게 하는 요청을 보낸다(Step 2 의 달기 두 번은 글을 바꿔서). */
let lessonRun;
const lessonFlow = () => (lessonRun ??= (async () => {
  await copyDb(GATE2_DB);
  const text = read(version(3)(HTTP_FILE));
  const ADD_LINE = `"content": "${ADDED_TEXT}"`;
  const send = async (label, titles, content = ADDED_TEXT) => {
    const source = compose(text, [LOGIN, ...titles]).replaceAll(ADD_LINE, `"content": "${content}"`);
    const runs = await withServer(version(label), GATE2_DB, () => httpyac(source));
    const byTitle = {};
    for (const r of runs.slice(1)) (byTitle[r.title] ??= []).push(r);
    return { runs: runs.slice(1), byTitle, counts: await counts(GATE2_DB) };
  };
  const out = {};
  // 흐름 앞의 시드 댓글과 게시물 주인 — 지우기 전에 읽어 둔다
  out.comments = Object.fromEntries((await onDb(GATE2_DB, 'SELECT c.id, c.post_id, u.username, c.content FROM comments c JOIN users u ON u.id = c.author_id WHERE c.id <= 12')).map((c) => [c.id, c]));
  out.postAuthors = Object.fromEntries((await onDb(GATE2_DB, 'SELECT p.id, u.username FROM posts p JOIN users u ON u.id = p.author_id')).map((p) => [p.id, p.username]));
  out.step1a = await send('1a', [ADD]);
  out.step1 = await send(1, [ADD, POST2]);
  out.step2a = await send('2a', [POST2]);
  out.step2b = await send('2b', [ADD, POST2], FLOW_TEXTS.step2b);
  out.step2 = await send(2, [ADD, POST2], FLOW_TEXTS.step2);
  out.step3b = await send('3b', [D_WRONG, POST1, POST2]);
  out.step3 = await send(3, [D_WRONG2, D_RIGHT, D_ADD, D_MINE, D_AGAIN, D_OTHERS, D_NONE, POST1, POST2]);
  const sql = read(version(3)(FIX_SQL));
  out.sqlBefore = await onDb(GATE2_DB, sql.slice(sql.lastIndexOf('SELECT posts.id')));
  out.sqlAfter = (await runSql(GATE2_DB, sql))[1].rows;
  return out;
})());
/** 답글 🙋 표의 실측 — 새 사본에서 원댓글 1 하나 · 다른 사본에서 답글 11 하나. */
let replyRun;
const replyFacts = () => (replyRun ??= (async () => {
  const one = async (path) => {
    await copyDb(GATE_DB);
    const before = await countOf(GATE_DB, 1);
    const { out } = await sendSteps(version(3), GATE_DB, [['DELETE', path]]);
    return { status: out[0].status, before, after: await countOf(GATE_DB, 1) };
  };
  return { root: await one('/api/v2/posts/1/comments/1'), reply: await one('/api/v2/posts/1/comments/11') };
})());
const ISO_TIME = '<시각>';
const scrubTimesDeep = (value) => JSON.parse(JSON.stringify(value), (key, v) => ((key === 'timestamp' || key === 'createdAt') && typeof v === 'string' && ISO.test(v) ? ISO_TIME : v));
/** 고칠 곳 — { line, lecture, measured }. */
const lectureProblems = [];
const problem = (line, lecture, measured) => lectureProblems.push({ line, lecture, measured });
afterAll(() => {
  if (process.env.P354_LECTURE_REPORT) writeFileSync(process.env.P354_LECTURE_REPORT, JSON.stringify(lectureProblems, null, 2));
});
// 산문 꼴 찾기는 굵게 표시(**)를 떼고 본다 — 표시는 글자 주장이 아니다.
const lectureLines = () => read(LECTURE_MD).split('\n').map((line) => line.replaceAll('**', ''));
/** 산문 한 줄을 꼴로 찾는다 — 없으면 null. */
const findLine = (re) => {
  const lines = lectureLines();
  const at = lines.findIndex((line) => re.test(line));
  return at === -1 ? null : { line: at + 1, text: lines[at], match: re.exec(lines[at]) };
};
const countLabel = (n) => `${n}`;

describeLecture(LECTURE_MD ? '축 ⑧ 교안 대조 — 수업 백엔드(Step 1~3)' : '🚨 건너뜀(P354_LECTURE 없음) — 축 ⑧ 교안 대조', () => {
  it('🔴 코드 블록 — Step · 언어 · 파일 · 대조 방식 · 판이 목록과 같고, 블록마다 그 판 글자와 맞는다(완성본은 글자까지 · 줄임은 줄이 같은 차례로)', () => {
    const found = [];
    const before = lectureProblems.length;
    for (const fence of classFences()) {
      const expected = EXPECTED_CLASS_FENCES[found.length];
      const which = expected && expected[2] === fence.rel && expected[0] === fence.step ? expected[4] : null;
      const how = which !== null ? howIn(fence.body, read(version(which)(fence.rel))) : null;
      found.push([fence.step, fence.lang, fence.rel, how, which]);
      if (which === null || how !== expected[3]) {
        problem(fence.line, `${fence.lang} 블록 ${fence.rel}`, `기대 ${JSON.stringify(expected ?? '(목록에 없는 블록)')} · 실제 대조 ${how ?? '맞는 판 없음'}`);
      }
    }
    seen.lectureFences = found;
    expect(lectureProblems.slice(before)).toEqual([]);
    expect(found).toEqual(EXPECTED_CLASS_FENCES);
  });

  it('🔴 응답 펜스 셋 — Step 1 강의 자료 판 405 · Step 1 세 층 판 201 · Step 2 고친 판 201 이 교안 차례대로 흐름의 실제 응답과 같다(시각은 꼴만)', async () => {
    const flow = await lessonFlow();
    const before = lectureProblems.length;
    const jsonFences = fencesOf(LECTURE_MD).filter((f) => f.lang === 'json' && (f.step === 1 || f.step === 2));
    const actual = [
      ['405', flow.step1a.byTitle[ADD][0]],
      ['Step 1 201', flow.step1.byTitle[ADD][0]],
      ['Step 2 201', flow.step2.byTitle[ADD][0]],
    ];
    expect(jsonFences.length).toBe(3);
    jsonFences.forEach((fence, i) => {
      const [label, run] = actual[i];
      const want = scrubTimesDeep(JSON.parse(fence.body.join('\n')));
      const got = scrubTimesDeep(run.body);
      if (JSON.stringify(want) !== JSON.stringify(got)) problem(fence.line, `${label} 응답 펜스 ${JSON.stringify(want)}`, `${run.status} ${JSON.stringify(got)}`);
      // 시각은 꼴이 같아야 한다(ISO 8601 UTC 밀리초)
      for (const key of ['timestamp', 'createdAt']) {
        const text = fence.body.join('\n');
        const m = new RegExp(`"${key}": "([^"]+)"`).exec(text);
        if (m && !ISO.test(m[1])) problem(fence.line, `${label} 의 ${key} ${m[1]}`, 'ISO 8601 UTC 밀리초 꼴이 아니다');
      }
    });
    expect([flow.step1a.byTitle[ADD][0].status, flow.step1a.byTitle[ADD][0].headers.allow]).toEqual([405, 'GET']);
    seen.lessonResponses = actual.map(([label, run]) => ({ label, status: run.status, body: run.rawBody }));
    expect(lectureProblems.slice(before)).toEqual([]);
  }, 240_000);

  it('🔴 마크다운 표 — Step 2 달기 전·뒤 · 🙋 세 판 · Step 3 겪기 · 결과 · 🙋 답글 · 맞추는 SQL 의 숫자가 실측과 같다', async () => {
    const flow = await lessonFlow();
    const replies = await replyFacts();
    const before = lectureProblems.length;
    const tables = tablesOf(LECTURE_MD);
    const byHeader = (first) => tables.filter((t) => plainCell(t.header[0]) === first);
    const cell = (t, r, c) => plainCell(t.rows[r]?.[c] ?? '');
    const check = (t, r, c, want, what) => {
      if (cell(t, r, c) !== want) problem(t.lines[r], `${what} «${t.rows[r]?.[c]}»`, want);
    };
    // Step 2 — 달기 전(강의 자료 판) · 단 뒤(increment 판)
    const [beforeAfter] = byHeader('«2번 게시물»');
    const p2Before = flow.step2a.byTitle[POST2][0].body.data;
    const p2After = flow.step2b.byTitle[POST2][0].body.data;
    const added2b = flow.step2b.byTitle[ADD][0].body.data;
    check(beforeAfter, 0, 1, countLabel(p2Before.commentCount), '달기 전 commentCount');
    check(beforeAfter, 1, 1, countLabel(p2After.commentCount), '단 뒤 commentCount');
    if (cell(beforeAfter, 0, 2) !== '시드를 넣은 시각' || p2Before.updatedAt !== p2Before.createdAt) problem(beforeAfter.lines[0], `달기 전 updatedAt «${cell(beforeAfter, 0, 2)}»`, `updatedAt ${p2Before.updatedAt} · createdAt ${p2Before.createdAt}`);
    if (cell(beforeAfter, 1, 2) !== '방금 댓글을 단 시각' || Math.abs(Date.parse(p2After.updatedAt) - Date.parse(added2b.createdAt)) > 1000) problem(beforeAfter.lines[1], `단 뒤 updatedAt «${cell(beforeAfter, 1, 2)}»`, `updatedAt ${p2After.updatedAt} · 단 댓글 createdAt ${added2b.createdAt}`);
    // 🙋 세 판 — 축 ② 가 잰 값(2번 게시물 시작 29/29)
    const [three] = byHeader('코드');
    const rb = seen.rollback;
    const delta = (n, base) => (n === base ? '그대로' : `${n - base} ${n > base ? '올랐어요' : '내려갔어요'}`);
    if (!rb) problem(three.line, '🙋 세 판 표', '실측 없음 — 축 ② 를 함께 돌려야 한다');
    else {
      const rows = [rb.rolled, rb.outside, rb.noTx];
      rows.forEach((r, i) => {
        const countWord = r.post2.count === 29 ? '그대로' : `${r.post2.count - 29} 올랐어요`;
        const rootWord = r.post2.roots === 29 ? '그대로' : `${r.post2.roots - 29} 늘었어요`;
        check(three, i, 2, countWord, `세 판 ${i + 1}행 comment_count`);
        check(three, i, 3, rootWord, `세 판 ${i + 1}행 원댓글`);
      });
      expect(delta(1, 1)).toBe('그대로');
    }
    // Step 3 겪기 — 번호로만 찾는 판
    const [trapTable, resultTable] = tables.filter((t) => plainCell(t.header[0]) === '요청');
    const wrong = flow.step3b.byTitle[D_WRONG][0];
    const post1 = flow.step3b.byTitle[POST1][0];
    if (!new RegExp(`^${wrong.status} · 3번 댓글이 지워졌어요$`).test(cell(trapTable, 0, 1)) || wrong.body.data.comment.id !== 3) problem(trapTable.lines[0], `겪기 1행 응답 «${cell(trapTable, 0, 1)}»`, `${wrong.status} · 지운 댓글 ${wrong.body.data?.comment?.id}`);
    check(trapTable, 0, 2, `응답의 commentCount ${wrong.body.data.commentCount}`, '겪기 1행 숫자');
    check(trapTable, 1, 1, `${post1.status}`, '겪기 2행 응답');
    check(trapTable, 1, 2, `commentCount ${post1.body.data.commentCount}`, '겪기 2행 숫자');
    // Step 3 결과 — 고친 판의 일곱 요청
    resultTable.rows.forEach((row, i) => {
      const title = /«(.+)»/.exec(row[0])?.[1];
      const run = flow.step3.byTitle[title]?.[0];
      if (!run) { problem(resultTable.lines[i], `결과 표 «${title}»`, '그런 요청이 흐름에 없다'); return; }
      const message = run.body.error?.message;
      const wantResponse = message ? `${run.status} «${message}»` : `${run.status}`;
      check(resultTable, i, 1, wantResponse, `결과 표 «${title}» 응답`);
      check(resultTable, i, 2, run.body.data?.commentCount === undefined ? '' : `${run.body.data.commentCount}`, `결과 표 «${title}» commentCount`);
    });
    // 🙋 답글 — 원댓글 1 · 답글 11
    const [replyTable] = byHeader('jaehoon이 지운 댓글');
    [replies.root, replies.reply].forEach((r, i) => {
      check(replyTable, i, 1, `${r.before.rows}에서 ${r.after.rows}`, `답글 표 ${i + 1}행 댓글 행`);
      check(replyTable, i, 2, r.after.count === r.before.count ? `${r.before.count} 그대로` : `${r.before.count}에서 ${r.after.count}`, `답글 표 ${i + 1}행 comment_count`);
    });
    // 맞추는 SQL — 실행 전 · 뒤
    const [sqlTable] = byHeader('id');
    flow.sqlBefore.forEach((b, i) => {
      const a = flow.sqlAfter[i];
      const want = [`${b.id}`, `${b.comment_count}`, `${b.root_comments}`, `${a.comment_count}`, `${a.root_comments}`];
      if (JSON.stringify(sqlTable.rows[i]?.map(plainCell)) !== JSON.stringify(want)) problem(sqlTable.lines[i] ?? sqlTable.line, `SQL 표 ${i + 1}행 ${JSON.stringify(sqlTable.rows[i])}`, want.join(' | '));
    });
    if (sqlTable.rows.length !== flow.sqlBefore.length) problem(sqlTable.line, `SQL 표 ${sqlTable.rows.length}행`, `게시물 ${flow.sqlBefore.length}개`);
    seen.lessonFlow = { counts: Object.fromEntries(Object.entries(flow).filter(([, v]) => v?.counts).map(([k, v]) => [k, v.counts])), sqlBefore: flow.sqlBefore, sqlAfter: flow.sqlAfter, replies };
    expect(lectureProblems.slice(before)).toEqual([]);
  }, 240_000);

  it('🔴 산문의 서버 주장 — 꼴로 찾아 실측과 맞댄다(못 찾으면 그것도 고칠 곳)', async () => {
    const flow = await lessonFlow();
    const before = lectureProblems.length;
    const facts = {
      add405: flow.step1a.byTitle[ADD][0],
      step1Count: flow.step1.byTitle[POST2][0].body.data.commentCount,
      step2a: flow.step2a,
      step2b: flow.step2b,
      step2: flow.step2,
      step3b: flow.step3b,
    };
    const rootsOf = (state, id) => state.counts.find((p) => p.id === id).roots;
    const countBefore3b = flow.step2.counts.find((p) => p.id === 2).count;
    const claims = [
      [/404가 아니라 (\d{3})가 와요/, (m) => [m[1], `${facts.add405.status}`]],
      [/`Allow: (\w+)`이 이 주소가/, (m) => [m[1], facts.add405.headers.allow]],
      [/`\.trim\(\)`이 앞뒤 공백을 먼저 떼니 공백만 보낸 글도 빈 글처럼 (\d{3})/, (m) => [m[1], seen.step1Extra ? `${JSON.parse(seen.step1Extra.spaces).error ? 400 : 201}` : '실측 없음']],
      [/본문에 `"authorId": (\d+)`을 더해 보내도 결과는 같아요/, (m) => [`authorId ${m[1]} → 글쓴이 2 jaehoon`, seen.step1Extra ? `authorId ${m[1]} → 글쓴이 ${JSON.parse(seen.step1Extra.withAuthor).data.authorId} ${JSON.parse(seen.step1Extra.withAuthor).data.username}` : '실측 없음']],
      [/그대로 «댓글 (\d+)개 보기»예요/, (m) => [m[1], `${facts.step1Count}`]],
      [/`commentCount`가 (\d+)예요\. 2번 게시물의 원댓글은 이제 (\d+)개/, (m) => [`${m[1]} / ${m[2]}`, `${facts.step2a.byTitle[POST2][0].body.data.commentCount} / ${rootsOf(facts.step2a, 2)}`]],
      [/원댓글 (\d+)개와는 여전히 (\d+) 차이/, (m) => [`${m[1]} · ${m[2]}`, `${rootsOf(facts.step2b, 2)} · ${rootsOf(facts.step2b, 2) - facts.step2b.counts.find((p) => p.id === 2).count}`]],
      [/응답의 `commentCount`가 (\d+)이에요\. «2번 게시물»을 다시 보내면 `commentCount`는 (\d+)이고, `updatedAt`은 바로 앞에서 본 값 그대로/, (m) => [`${m[1]} / ${m[2]} / 그대로`, `${facts.step2.byTitle[ADD][0].body.data.commentCount} / ${facts.step2.byTitle[POST2][0].body.data.commentCount} / ${facts.step2.byTitle[POST2][0].body.data.updatedAt === facts.step2b.byTitle[POST2][0].body.data.updatedAt ? '그대로' : '바뀜'}`]],
      [/세 경우 모두 응답은 (\d{3})/, (m) => [m[1], seen.rollback ? [...new Set(Object.values(seen.rollback).map((r) => r.status))].join(',') : '실측 없음']],
      [/3번 댓글은 (\w+)이 1번 게시물에 단 «(.+?)»예요\. 1번 게시물은 (\w+)의 게시물/, (m) => [`${m[1]} «${m[2]}» · ${m[3]}`, `${flow.comments[3].username} «${flow.comments[3].content}» · ${flow.postAuthors[1]}`]],
      [/1번 게시물은 원댓글이 하나 줄었는데 그대로 (\d+)이고, 2번 게시물은 아무것도 안 지워졌는데 (\d+)에서 (\d+)(?:으)?로/, (m) => [`${m[1]} · ${m[2]}→${m[3]}`, `${facts.step3b.byTitle[POST1][0].body.data.commentCount} · ${countBefore3b}→${facts.step3b.byTitle[D_WRONG][0].body.data.commentCount}`]],
      [/요청이 (아홉 ?|\d+)개예요/, (m) => [`${{ '아홉 ': 9, 아홉: 9 }[m[1]] ?? Number(m[1])}`, `${blocksOf(read(version('3a')(HTTP_FILE))).blocks.length - blocksOf(read(version(2)(HTTP_FILE))).blocks.length}`]],
      // 403 에러를 던지려면 ForbiddenError 를 import 해야 한다 — 겪기 판 커밋이 import 줄에 그것을 더했다
      [/403 에러를 던지려고 파일 맨 위 `import` 줄에 `(\w+)`를 더했어요/, (m) => [m[1], execFileSync('git', ['diff', '-U0', versionRef('3a'), versionRef('3b'), '--', 'services/commentService.js'], { cwd: P('.'), encoding: 'utf8' }).split('\n').filter((line) => /^[+-]import /.test(line)).map((line) => line.replace(/^\+import \{ (\w+), NotFoundError \} from '\.\.\/errors\.js';$/, '$1')).filter((x) => !x.startsWith('-')).join('')]],
      [/6번 댓글은 (\w+)가 (\w+)의 게시물에 단 «(.+?)»/, (m) => [`${m[1]} · ${m[2]} · «${m[3]}»`, `${flow.comments[6].username} · ${flow.postAuthors[2]} · «${flow.comments[6].content}»`]],
      [/다섯 번 모두 둘 다 (\d{3})이었(?:어요\.|고) 1번 게시물의 숫자는 (\d+)에서 (\d+)로 두 번 내려갔(?:고,|지만) 남은 원댓글은 (\d+)개/, (m) => [`${m[1]} · ${m[2]}→${m[3]} · ${m[4]}`, seen.concurrentDelete ? `${[...new Set(seen.concurrentDelete.before.flatMap((r) => r.statuses))].join(',')} · 3→${[...new Set(seen.concurrentDelete.before.map((r) => r.drift[0]?.count))].join(',')} · ${[...new Set(seen.concurrentDelete.before.map((r) => r.drift[0]?.roots))].join(',')}` : '실측 없음']],
      [/다섯 번 모두 (\d{3}) 하나와 (\d{3}) 하나였고 숫자도 한 번만/, (m) => [`${m[1]} · ${m[2]}`, seen.concurrentDelete ? [...new Set(seen.concurrentDelete.after.map((r) => r.statuses.join(' · ')))].join(' / ') : '실측 없음']],
      // 문서에 댓글 주소의 HTTP 메서드 셋 — 목록 주소의 get · post 와 댓글 하나 주소의 delete
      [/댓글 API 셋\(((?:`[A-Z]+`·?)+)\)이 보여요/, (m) => [m[1].replace(/`/g, ''), seen.docs ? [...Object.keys(seen.docs.comments), ...Object.keys(seen.docs.remove)].filter((k) => k !== 'parameters').map((k) => k.toUpperCase()).join('·') : '실측 없음']],
    ];
    const results = [];
    for (const [re, measure] of claims) {
      const hit = findLine(re);
      if (!hit) { problem(null, `꼴 ${re}`, '교안에서 못 찾았다'); results.push([String(re), null]); continue; }
      const [said, got] = measure(hit.match);
      results.push([hit.line, said, got]);
      if (said !== got) problem(hit.line, hit.text.trim(), got);
    }
    seen.lessonClaims = results;
    expect(lectureProblems.slice(before)).toEqual([]);
  }, 240_000);
});
