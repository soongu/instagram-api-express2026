// p3-53 「댓글 보기」 게이트 — 백엔드(교안 Step 1~3 의 댓글 목록 API · Step 5 의 강의 자료 SQL)
// 내부 검증 전용 — 교안에 한 줄도 인용하지 않는다.
//
// `8-fullstack-features` 다섯째 회차다(`curriculum.md` 「`p3-53` 착수 결정」 ①·②·⑥). 화면(Step 4·5)은 `instagram-next/.verify` 가 본다.
// 백엔드의 시작 판은 `code/p3-52` 다. 이 회차는 «보기» 만 짓는다 — 달기·지우기·comment_count 트랜잭션은 다음 회차.
// 커밋 — Step 1 은 둘(강의 자료 requests/post-comments.http 만 · 그다음 세 층과 app.js) · Step 2 도 둘(.http 에 겪기 둘 · 그다음 고친 서비스) ·
//        Step 3 도 둘(커서 함수를 utils/cursor.js 로 옮기기 · 그다음 댓글 커서) · Step 5 는 하나(lab/p3-53/many-comments.sql).
//        같은 «(Step N)» 표식이 여럿이면 가장 뒤 커밋이 그 Step 의 끝 판이다.
// 🔑 짓는 동안 `P353_WT` 를 주면 그 판을 커밋 대신 작업트리에서 읽는다 — `1a` · `1` · `2a` · `2` · `3a` · `3` · `5`.
// 🔑 포트 — 3890 · 3891(둘째 서버) · 3896(탐침). DB — `p353_api_` 로 시작하는 것만 만들고 지운다. `P353_PG_PORT` 로 PostgreSQL 호스트 포트를 바꾼다.
// 🔑 판정 DB 는 «p3-52 를 마친 학생 DB» 처럼(progress/reading-tools/next/STUDENT-ENV-p3-52.example.md 「데이터베이스」 + p3-52 의 쓰기) —
//    시드(학생은 며칠 전에 넣었다 — 시드 행의 시각을 사흘 앞으로 옮긴다) · sora 가입(p3-22 의 auth.http «회원가입») · jaehoon 밖 password_hash 지움 ·
//    seoyeon · doyun 가입 · admin.hong · 9번(minji) · jaehoon 의 좋아요 1·2·9 · jaehoon 의 게시물 14~19 ·
//    그 위에 p3-52 의 쓰기 — 14 의 글을 «주말에 바다에 다녀왔어요» 로 · 14 좋아요 · 19·18·17·16·15 지우기.
//    결과 — 게시물 최신순 14·9·1·2·3·4·5 · 댓글은 시드 그대로 12행(원댓글 9 · 답글 3) · comment_count 3·4·2·0·0(9·14 는 0).
//    🚨 번호는 학생마다 다를 수 있다 — 판정은 시드 게시물(1~5)과 시드 댓글(1~12) 밖의 번호를 고정값으로 쓰지 않는다.
//
// 축 ① Step 1 — 강의 자료 판(404 ROUTE_NOT_FOUND) · 세 층 판(1번 다섯 · 오래된 순 · 이름 없음 · POST 405 + Allow: GET · 쿼리 한 줄)
// 축 ② Step 2 — 겪기 판(99번 · 4번 둘 다 200 []) · 고친 판(1번 셋 · 이름·사진 · 99번 404 POST_NOT_FOUND · 4번 [] · 쿼리 두 줄)
// 축 ③ Step 3 — 옮기기 판(게시물 목록이 그대로) · 반례 스냅숏(게시물 조건 그대로 — 둘째 페이지가 첫 페이지 앞쪽) · 고친 판(겹침·빠짐 없음 ·
//      같은 시각 · 잘못된 커서 400 · limit 400 · 기본 20) · 게시물 목록 회귀(첫·둘째 페이지 · 옛 숫자 커서 · 지운 커서)
// 축 ④ Step 5 SQL — 판정 DB 에서 실행 뒤 원댓글 29 · comment_count 29 · 첫 페이지 20 + 둘째 9 · 두 번 실행하면 54
// 축 ⑤ 학생 파일 차이 — code/p3-52 에서 각 Step 의 커밋마다 바뀐 파일 · 내부 어휘 · 경로 주석 · 쓰지 않기로 한 낱말
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
const PG_PORT = Number(process.env.P353_PG_PORT ?? 5432);
const ADMIN = { host: 'localhost', port: PG_PORT, database: 'postgres', user: 'postgres', password: 'postgres' };
const TPL_DB = 'p353_api_tpl';
const GATE_DB = 'p353_api_gate';
const GATE2_DB = 'p353_api_gate2';
const dbUrl = (name) => `postgresql://postgres:postgres@localhost:${PG_PORT}/${name}`;
const PORT = 3890;
const PORT2 = 3891;
const PROBE_PORT = 3896;
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
const ISO = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;

const hasRef = (ref) => {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', ref], { cwd: P('.'), stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
};
// 🔑 판의 선 — 북마크 code/p3-53 이 있으면 그것, 없으면 지금 체크아웃한 선(HEAD). `P353_LINE` 으로 바꾼다.
const LINE = process.env.P353_LINE ?? (hasRef('refs/heads/code/p3-53') ? 'code/p3-53' : 'HEAD');
const WT = process.env.P353_WT ?? null;
/** «(Step N)» 표식이 붙은 이 회차 커밋들 — 새것부터. */
const stepCommits = (n) => {
  const log = execFileSync('git', ['log', '-n', '400', '--format=%H %s', LINE], { cwd: P('.'), encoding: 'utf8' });
  const hits = log.split('\n').filter((l) => / feat\(p3-53\): /.test(l) && l.endsWith(`(Step ${n})`)).map((l) => l.split(' ')[0]);
  if (hits.length === 0) throw new Error(`(Step ${n}) 커밋이 없다`);
  return hits;
};
const dirs = [];
const refDirs = new Map();
/** 커밋(또는 브랜치) 하나를 임시 폴더에 풀어 둔다. */
const refDir = (ref) => {
  if (refDirs.has(ref)) return refDirs.get(ref);
  const dir = mkdtempSync(join(tmpdir(), 'p353-ref-'));
  const tar = execFileSync('git', ['archive', '--format=tar', ref], { cwd: P('.'), maxBuffer: 1 << 28 });
  execFileSync('tar', ['-x', '-C', dir], { input: tar });
  dirs.push(dir);
  const at = (rel) => join(dir, rel);
  refDirs.set(ref, at);
  return at;
};
const worktree = (rel) => P(rel);
// 🔑 시작 판 — 이 회차 첫 커밋(Step 1 의 강의 자료)의 바로 앞. 북마크 code/p3-52 위에서 지었으면 code/p3-52 이고,
//    그 뒤 선 위의 정정(p3-33 decodeCursor 의 try 좁히기 — 7ca45d7) 위에서 지었으면 그 커밋이다. `P353_BASE` 로 바꾼다.
let baseCache;
const baseRef = () => (baseCache ??= process.env.P353_BASE
  ?? execFileSync('git', ['rev-parse', `${stepCommits(1).at(-1)}^`], { cwd: P('.'), encoding: 'utf8' }).trim());
const base = () => refDir(baseRef());
/** 판의 커밋 — Step 의 커밋 가운데 `index` 번째(오래된 것부터 0) · 작업트리로 읽는 판이면 null. */
const VERSIONS = {
  '1a': [1, 0], 1: [1, 1], '2a': [2, 0], 2: [2, 1], '3a': [3, 0], 3: [3, 1], 5: [5, 0],
};
const versionRef = (label) => {
  if (WT === String(label)) return null;
  const [step, index] = VERSIONS[label];
  const commits = stepCommits(step).slice().reverse();
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
  const dir = mkdtempSync(join(tmpdir(), 'p353-srv-'));
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
  TPL_UPLOADS = mkdtempSync(join(tmpdir(), 'p353-uploads-'));
  dirs.push(TPL_UPLOADS);
  cpSync(join(dir, 'uploads'), TPL_UPLOADS, { recursive: true });
};

/** httpYac CLI 로 `.http` 한 파일을 통째로 보낸다(`--all --json`) — 학생이 VS Code 에서 위에서부터 차례로 누르는 것과 같다. */
const httpyac = async (source, port = PORT) => {
  const dir = mkdtempSync(join(tmpdir(), 'p353-http-'));
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

/** 교안에 인용할 실측 글자 — `P353_SEEN=경로` 를 주면 파일로 남긴다(보고용). */
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
  // 템플릿은 시작 판(code/p3-52)의 마이그레이션 + 시드 + 학생 DB 의 쓰기
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
  expect(await onDb(TPL_DB, "SELECT username FROM users WHERE password_hash IS NOT NULL ORDER BY id"))
    .toEqual([{ username: 'jaehoon' }, { username: 'seoyeon' }, { username: 'doyun' }, { username: 'admin.hong' }]);
  expect((await onDb(TPL_DB, "SELECT count(*)::int AS n FROM users WHERE username = 'sora' AND password_hash IS NULL"))[0].n).toBe(1);
  expect((await onDb(TPL_DB, "SELECT nextval('posts_id_seq') AS n"))[0].n).toBe('26');
  await onDb(TPL_DB, "SELECT setval('posts_id_seq', 25)");
}, 180_000);

afterAll(async () => {
  for (const name of [GATE_DB, GATE2_DB, TPL_DB]) await dropDb(name);
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  if (process.env.P353_SEEN) writeFileSync(process.env.P353_SEEN, JSON.stringify(seen, null, 2));
});

/** 실패 봉투 — 새 주소의 { error: { code, message, path, timestamp } }. */
const v2Error = (code, message, path) => ({ error: { code, message, path, timestamp: expect.stringMatching(ISO) } });
const keep = (r) => ({ title: r.title, statusLine: r.statusLine, contentType: r.headers?.['content-type'], body: r.rawBody });
/** 1번 게시물의 시드 댓글 — 시각 차례(답글 둘이 원댓글 사이에 섞인다). */
const POST1_ALL = [
  { id: 1, parentId: null, username: 'minji', content: '저도 가봤어요', likeCount: 7 },
  { id: 2, parentId: null, username: 'seungwoo', content: '사진 잘 나왔네요', likeCount: 2 },
  { id: 10, parentId: 1, username: 'jaehoon', content: '다음엔 같이 가요', likeCount: 1 },
  { id: 11, parentId: 1, username: 'dahye', content: '저도 껴주세요', likeCount: 0 },
  { id: 3, parentId: null, username: 'nayeon', content: '다음에 같이 가요', likeCount: 0 },
];

// ── 축 ① Step 1 ────────────────────────────────────────────────────────────────
const STEP1_BLOCKS = [
  ['jaehoon으로 로그인', 'POST http://localhost:3000/api/v2/auth/login'],
  ['1번 게시물의 댓글', 'GET http://localhost:3000/api/v2/posts/1/comments'],
];

describe('축 ① Step 1 — 댓글이 붙을 주소', () => {
  it('🔴 강의 자료 판 — post-comments.http 두 요청 · 로그인 200 · 댓글 주소는 404 ROUTE_NOT_FOUND «그런 주소는 없어요»(고친 코드 없음)', async () => {
    const text = read(version('1a')(HTTP_FILE));
    const { head, blocks } = blocksOf(text);
    expect(head).toBe('');
    expect(blocks.map((b) => [b.title, b.request])).toEqual(STEP1_BLOCKS);
    expect(text.endsWith('\n')).toBe(true);
    await copyDb(GATE_DB);
    const runs = await withServer(version('1a'), GATE_DB, () => httpyac(text));
    expect(runs.map((r) => [r.title, r.statusLine])).toEqual([['jaehoon으로 로그인', 'HTTP/1.1 200 OK'], ['1번 게시물의 댓글', 'HTTP/1.1 404 Not Found']]);
    expect(runs[1].body).toEqual(v2Error('ROUTE_NOT_FOUND', '그런 주소는 없어요', '/api/v2/posts/1/comments'));
    expect(Object.keys(runs[1].body.error)).toEqual(['code', 'message', 'path', 'timestamp']);
    seen.step1a = { file: text, runs: runs.map(keep) };
  }, 60_000);

  it('🔴 세 층 판 — 같은 .http · 1번 게시물의 댓글 다섯(답글 둘이 섞인다) · 오래된 순 · 테이블의 필드 그대로(이름 없음) · 봉투 { data: [...] }', async () => {
    const text = read(version(1)(HTTP_FILE));
    expect(text).toBe(read(version('1a')(HTTP_FILE)));
    await copyDb(GATE_DB);
    const runs = await withServer(version(1), GATE_DB, () => httpyac(text));
    expect(runs.map((r) => [r.title, r.statusLine])).toEqual([['jaehoon으로 로그인', 'HTTP/1.1 200 OK'], ['1번 게시물의 댓글', 'HTTP/1.1 200 OK']]);
    const rows = runs[1].body.data;
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.map((c) => [c.id, c.parentId])).toEqual(POST1_ALL.map((c) => [c.id, c.parentId]));
    expect(Object.keys(rows[0])).toEqual(['id', 'postId', 'authorId', 'content', 'likeCount', 'createdAt', 'updatedAt', 'parentId']);
    expect(rows.every((c) => c.postId === 1 && ISO.test(c.createdAt))).toBe(true);
    // 시각이 이른 것부터
    expect(rows.map((c) => c.createdAt)).toEqual(rows.map((c) => c.createdAt).slice().sort());
    // 글쓴이는 번호뿐이다
    const ids = Object.fromEntries(await Promise.all(['minji', 'seungwoo', 'jaehoon', 'dahye', 'nayeon'].map(async (n) => [n, await idOf(GATE_DB, n)])));
    expect(rows.map((c) => c.authorId)).toEqual(POST1_ALL.map((c) => ids[c.username]));
    expect(rows.map((c) => [c.content, c.likeCount])).toEqual(POST1_ALL.map((c) => [c.content, c.likeCount]));
    expect(JSON.stringify(rows)).not.toContain('username');
    seen.step1 = { runs: runs.map(keep) };
  }, 60_000);

  it('🔴 세 층 판 — GET 말고는 405 + Allow: GET · 없는 번호 99 는 200 [] · 숫자가 아닌 번호는 404 POST_NOT_FOUND · 옛 주소(/api)는 봉투 없이 · 로그인 없이 401 · 쿼리 한 줄', async () => {
    await copyDb(GATE_DB);
    const out = await withServer(version(1), GATE_DB, async ({ base: url }) => {
      const tab = await loggedIn(url, 'jaehoon');
      return {
        post: await tab.send('POST', '/api/v2/posts/1/comments', { content: '댓글' }),
        put: await tab.send('PUT', '/api/v2/posts/1/comments'),
        missing: await tab.get('/api/v2/posts/99/comments'),
        notNumber: await tab.get('/api/v2/posts/abc/comments'),
        old: await tab.get('/api/posts/1/comments'),
        nobody: await browser(url).get('/api/v2/posts/1/comments'),
      };
    });
    expect([out.post.status, out.post.headers.get('allow')]).toEqual([405, 'GET']);
    expect(out.post.body).toEqual(v2Error('METHOD_NOT_ALLOWED', '이 주소는 그 HTTP 메서드를 받지 않아요', '/api/v2/posts/1/comments'));
    expect([out.put.status, out.put.headers.get('allow')]).toEqual([405, 'GET']);
    expect([out.missing.status, out.missing.body]).toEqual([200, { data: [] }]);
    expect([out.notNumber.status, out.notNumber.body]).toEqual([404, v2Error('POST_NOT_FOUND', '그런 게시물은 없어요', '/api/v2/posts/abc/comments')]);
    expect(out.old.status).toBe(200);
    expect(out.old.body.map((c) => c.id)).toEqual(POST1_ALL.map((c) => c.id));
    expect([out.nobody.status, out.nobody.body.error.code]).toEqual([401, 'LOGIN_REQUIRED']);
    const q = await queriesOf(version(1), GATE_DB, '/api/v2/posts/1/comments');
    expect(q.status).toBe(200);
    expect(q.lines).toHaveLength(1);
    expect(q.lines[0]).toMatch(/FROM "public"\."comments" WHERE "public"\."comments"\."post_id" = \$1 ORDER BY "public"\."comments"\."created_at" ASC, "public"\."comments"\."id" ASC/);
    seen.step1Extra = { post: out.post.text, allow: out.post.headers.get('allow'), missing: out.missing.text, notNumber: out.notNumber.text, old: out.old.text, queries: q.lines };
  }, 90_000);
});

// ── 축 ② Step 2 ────────────────────────────────────────────────────────────────
const STEP2_BLOCKS = [
  ...STEP1_BLOCKS,
  ['없는 게시물의 댓글', 'GET http://localhost:3000/api/v2/posts/99/comments'],
  ['댓글이 없는 게시물의 댓글', 'GET http://localhost:3000/api/v2/posts/4/comments'],
];
/** 판 하나에 Step 2 의 .http 를 — 판정 DB 사본에서. */
const sendStep2 = async (label, db) => {
  await copyDb(db);
  const text = read(version(label)(HTTP_FILE));
  return { text, runs: await withServer(version(label), db, () => httpyac(text)) };
};
let step2Trap;
let step2Fixed;
const sendStep2Trap = () => (step2Trap ??= sendStep2('2a', GATE_DB));
const sendStep2Fixed = () => (step2Fixed ??= sendStep2(2, GATE2_DB));
/** 사람 이름 → 번호 · 프로필 사진(판정 DB 의 값). */
const people = async (db) => Object.fromEntries((await onDb(db, 'SELECT id, username, profile_image FROM users')).map((u) => [u.username, u]));

describe('축 ② Step 2 — 원댓글만, 글쓴이와 함께', () => {
  it('🔴 겪기 판 — .http 끝에 두 요청(99번 · 4번)을 더했다 · 고친 코드 없음 · 없는 게시물도 댓글 없는 게시물도 똑같이 200 { data: [] } · 1번은 여전히 다섯', async () => {
    const { text, runs } = await sendStep2Trap();
    const { head, blocks } = blocksOf(text);
    expect(head).toBe('');
    expect(blocks.map((b) => [b.title, b.request])).toEqual(STEP2_BLOCKS);
    expect(text.startsWith(read(version(1)(HTTP_FILE)))).toBe(true);
    expect(runs.map((r) => [r.title, r.statusLine])).toEqual(STEP2_BLOCKS.map(([title]) => [title, 'HTTP/1.1 200 OK']));
    expect(runs[1].body.data.map((c) => c.id)).toEqual(POST1_ALL.map((c) => c.id));
    expect(runs[2].body).toEqual({ data: [] });
    expect(runs[3].body).toEqual({ data: [] });
    expect(runs[2].rawBody).toBe(runs[3].rawBody);
    seen.step2a = { file: text, runs: runs.map(keep) };
  }, 60_000);

  it('🔴 고친 판 — .http 는 겪기 판과 같다 · 1번은 원댓글 셋(답글 10 · 11 이 빠진다) · 글쓴이 이름과 사진 · 99번 404 POST_NOT_FOUND · 4번은 그대로 200 []', async () => {
    const { text, runs } = await sendStep2Fixed();
    expect(text).toBe(read(version('2a')(HTTP_FILE)));
    expect(runs.map((r) => [r.title, r.statusLine])).toEqual([
      ['jaehoon으로 로그인', 'HTTP/1.1 200 OK'], ['1번 게시물의 댓글', 'HTTP/1.1 200 OK'],
      ['없는 게시물의 댓글', 'HTTP/1.1 404 Not Found'], ['댓글이 없는 게시물의 댓글', 'HTTP/1.1 200 OK'],
    ]);
    const who = await people(GATE2_DB);
    const roots = POST1_ALL.filter((c) => c.parentId === null);
    const rows = runs[1].body.data;
    expect(rows.map((c) => c.id)).toEqual([1, 2, 3]);
    expect(Object.keys(rows[0])).toEqual(['id', 'authorId', 'content', 'likeCount', 'createdAt', 'username', 'profileImage']);
    expect(rows.map(({ createdAt, ...rest }) => rest)).toEqual(roots.map((c) => ({
      id: c.id, authorId: who[c.username].id, content: c.content, likeCount: c.likeCount, username: c.username, profileImage: who[c.username].profile_image,
    })));
    expect(rows.every((c) => ISO.test(c.createdAt))).toBe(true);
    // 프로필 사진 — 게시물을 올린 적 없는 nayeon 은 null
    expect(rows.map((c) => c.profileImage === null)).toEqual([false, false, true]);
    expect(runs[2].body).toEqual(v2Error('POST_NOT_FOUND', '그런 게시물은 없어요', '/api/v2/posts/99/comments'));
    expect(runs[3].body).toEqual({ data: [] });
    seen.step2 = { runs: runs.map(keep) };
  }, 60_000);

  it('🔴 고친 판 — 쿼리는 게시물 확인 한 줄 + 댓글 한 줄 + 글쓴이 한 줄(users … IN — JOIN 이 아니다) · 없는 게시물은 확인 한 줄에서 멈춘다 · 댓글 없는 게시물도 세 줄(IN (NULL)) · 겪기 판은 한 줄', async () => {
    await copyDb(GATE_DB);
    const trap1 = await queriesOf(version('2a'), GATE_DB, '/api/v2/posts/1/comments');
    const fixed1 = await queriesOf(version(2), GATE_DB, '/api/v2/posts/1/comments');
    const fixed99 = await queriesOf(version(2), GATE_DB, '/api/v2/posts/99/comments');
    const fixed4 = await queriesOf(version(2), GATE_DB, '/api/v2/posts/4/comments');
    seen.step2Queries = { trap1: trap1.lines, fixed1: fixed1.lines, fixed99: fixed99.lines, fixed4: fixed4.lines };
    expect(trap1.lines).toHaveLength(1);
    expect(fixed1.lines).toHaveLength(3);
    expect(fixed1.lines[0]).toBe('prisma:query SELECT "public"."posts"."id" FROM "public"."posts" WHERE ("public"."posts"."id" = $1 AND 1=1) LIMIT $2 OFFSET $3');
    expect(fixed1.lines[1]).toMatch(/^prisma:query SELECT "public"\."comments"\."id", "public"\."comments"\."author_id", "public"\."comments"\."content", "public"\."comments"\."like_count", "public"\."comments"\."created_at" FROM "public"\."comments" WHERE \("public"\."comments"\."post_id" = \$1 AND "public"\."comments"\."parent_id" IS NULL\) ORDER BY /);
    expect(fixed1.lines[2]).toBe('prisma:query SELECT "public"."users"."id", "public"."users"."username", "public"."users"."profile_image" FROM "public"."users" WHERE "public"."users"."id" IN ($1,$2,$3) OFFSET $4');
    expect(fixed1.lines.join('\n')).not.toMatch(/JOIN/);
    expect([fixed99.status, fixed99.lines]).toEqual([404, [fixed1.lines[0]]]);
    expect([fixed4.status, fixed4.lines.length]).toEqual([200, 3]);
    expect(fixed4.lines[2]).toBe('prisma:query SELECT "public"."users"."id", "public"."users"."username", "public"."users"."profile_image" FROM "public"."users" WHERE "public"."users"."id" IN (NULL) OFFSET $1');
  }, 90_000);

  it('🔎 게시물 하나 + 그 댓글을 post.findUnique 의 select 한 번으로 받는 판(짓지 않는다 — 🙋 재료) — 쿼리는 그래도 셋 · 없는 게시물은 한 줄', async () => {
    await copyDb(GATE_DB);
    const probe = `import { prisma } from '../db.js';
import { NotFoundError } from '../errors.js';

export async function getComments(postId) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      comments: {
        where: { parentId: null },
        select: { id: true, authorId: true, content: true, likeCount: true, createdAt: true, author: { select: { username: true, profileImage: true } } },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      },
    },
  });
  if (!post) throw new NotFoundError('POST_NOT_FOUND');

  return post.comments.map(({ author, ...comment }) => ({ ...comment, username: author.username, profileImage: author.profileImage }));
}
`;
    const edit = (dir) => writeFileSync(join(dir, 'services/commentService.js'), probe);
    const one = await queriesOf(version(2), GATE_DB, '/api/v2/posts/1/comments', { edit });
    const missing = await queriesOf(version(2), GATE_DB, '/api/v2/posts/99/comments', { edit });
    const fixed1 = await queriesOf(version(2), GATE_DB, '/api/v2/posts/1/comments');
    expect(one.body).toEqual(fixed1.body);
    expect(missing.status).toBe(404);
    seen.step2OneQuery = { lines: one.lines, missing: missing.lines };
    // 한 번 불러도 쿼리는 셋 그대로다 — 게시물 · 댓글 · 글쓴이(Prisma 가 관계마다 따로 읽는다)
    expect(one.lines).toHaveLength(3);
    expect(one.lines[0]).toBe(fixed1.lines[0]);
    expect(one.lines[2]).toBe(fixed1.lines[2]);
    expect(missing.lines).toHaveLength(1);
  }, 90_000);
});

// ── 축 ③ Step 3 ────────────────────────────────────────────────────────────────
const STEP3_BLOCKS = [
  ...STEP2_BLOCKS,
  ['2번 게시물의 댓글 — 첫 페이지', 'GET http://localhost:3000/api/v2/posts/2/comments?limit=2'],
  ['둘째 페이지 — 받은 커서를 그대로 돌려준다', 'GET http://localhost:3000/api/v2/posts/2/comments?limit=2&cursor={{first.data.nextCursor}}'],
];
const TRAP_FILE = 'snapshots/p3-53.step3-trap.commentService.js';
/** 게시물 조건을 그대로 가져온 판 — 고친 판의 서비스 자리에 반례 스냅숏을 깐다. */
const withTrapService = (dir) => writeFileSync(join(dir, 'services/commentService.js'), read(P(TRAP_FILE)));
/** 시각만 비교하는 판 — OR 의 번호 비교를 뺐다. */
const FIXED_AFTER = '    createdAt: { gte: createdAt },\n    OR: [{ createdAt: { gt: createdAt } }, { id: { gt: id } }],\n';
const withTimeOnly = (dir) => replaceIn(dir, 'services/commentService.js', FIXED_AFTER, '    createdAt: { gt: createdAt },\n');
/** 번호만 비교하는 판 — 시각 비교를 뺐다. */
const withIdOnly = (dir) => replaceIn(dir, 'services/commentService.js', FIXED_AFTER, '    id: { gt: id },\n');
/** 하나 더 받지 않는 판 — take 가 limit 그대로. */
const withTakeLimit = (dir) => replaceIn(dir, 'services/commentService.js', '    take: limit + 1,\n', '    take: limit,\n');
/** nextCursor 를 따라 끝까지 — 받은 페이지들. */
const walkComments = async (tab, postId, limit) => {
  const pages = [];
  let cursor = null;
  for (let turn = 0; turn < 60; turn += 1) {
    const res = await tab.get(`/api/v2/posts/${postId}/comments?limit=${limit}${cursor === null ? '' : `&cursor=${cursor}`}`);
    expect(res.status).toBe(200);
    pages.push(res.body.data);
    if (res.body.data.nextCursor === null) return pages;
    cursor = res.body.data.nextCursor;
  }
  throw new Error('60번을 내려가도 끝나지 않는다');
};
const idsOf = (pages) => pages.map((page) => page.items.map((c) => c.id));
const decode = (cursor) => JSON.parse(Buffer.from(cursor, 'base64url').toString());
/** 게시물 목록 — 첫 페이지부터 끝까지 · 옛 숫자 커서 · 없는 번호 커서 · 잘못된 커서 · 지운 게시물의 커서. 실행마다 다른 timestamp 는 지운다. */
const postListTour = async (from, db) => {
  await copyDb(db);
  return withServer(from, db, async ({ base: url }) => {
    const tab = await loggedIn(url, 'jaehoon');
    const pages = [];
    let cursor = null;
    for (let turn = 0; turn < 10; turn += 1) {
      const res = await tab.get(`/api/v2/posts?limit=2${cursor === null ? '' : `&cursor=${cursor}`}`);
      pages.push({ status: res.status, body: res.body });
      if (res.body.data.nextCursor === null) break;
      cursor = res.body.data.nextCursor;
    }
    const scrub = (res) => {
      const body = structuredClone(res.body);
      if (body?.error?.timestamp) body.error.timestamp = '<timestamp>';
      return { status: res.status, body, deprecation: res.headers.get('deprecation') !== null };
    };
    const old2 = scrub(await tab.get('/api/posts?limit=2&cursor=2'));
    const old999 = scrub(await tab.get('/api/posts?limit=2&cursor=999'));
    const bad = scrub(await tab.get('/api/v2/posts?limit=2&cursor=abc'));
    const noId = scrub(await tab.get('/api/v2/posts?limit=2&cursor=eyJpZCI6Mn0'));
    // 9번 커서를 받아 두고 9번을 지운 뒤 그 커서로 — 커서의 값만 쓰므로 이어진다
    const at9 = pages.flatMap((p) => p.body.data.items).findIndex((post) => post.id === 9);
    const cursorAt9 = (await tab.get(`/api/v2/posts?limit=${at9 + 1}`)).body.data.nextCursor;
    const admin = await loggedIn(url, 'admin.hong');
    expect((await admin.send('DELETE', '/api/v2/posts/9')).status).toBe(200);
    const afterDeleted = scrub(await tab.get(`/api/v2/posts?limit=2&cursor=${cursorAt9}`));
    return { pages, old2, old999, bad, noId, afterDeleted };
  });
};

describe('축 ③ Step 3 — 오래된 순으로 나눠 받기', () => {
  it('🔴 옮기기 판 — encodeCursor · decodeCursor · cursorSchema 를 utils/cursor.js 로 · 게시물 목록은 시작 판과 한 글자도 같다(첫 페이지부터 끝까지 · 옛 숫자 커서 · 없는 번호 · 잘못된 커서 · 지운 게시물의 커서) · 댓글은 Step 2 그대로', async () => {
    const util = read(version('3a')('utils/cursor.js'));
    expect(util.split('\n')[0]).toBe('// ~/instagram-api/utils/cursor.js');
    expect(util).toMatch(/^export function encodeCursor\(\{ createdAt, id \}\) \{$/m);
    expect(util).toMatch(/^export function decodeCursor\(cursor\) \{$/m);
    expect(util).toMatch(/^const cursorSchema = z\.object\(\{$/m);
    const service = read(version('3a')('services/postService.js'));
    expect(service).toContain("import { encodeCursor, decodeCursor } from '../utils/cursor.js';");
    expect(service).not.toMatch(/function (encodeCursor|decodeCursor)/);
    expect(read(version('3a')('schemas/postSchema.js'))).not.toContain('cursorSchema');
    // 옮긴 함수와 스키마는 시작 판의 것과 글자 그대로다(export 만 붙었다)
    const fnText = (text, name) => {
      const at = text.indexOf(`function ${name}(`);
      return text.slice(at, text.indexOf('\n}\n', at) + 2);
    };
    const startService = read(base()('services/postService.js'));
    for (const name of ['encodeCursor', 'decodeCursor']) {
      expect(util).toContain(`export ${fnText(startService, name)}`);
    }
    const startSchema = read(base()('schemas/postSchema.js'));
    const schemaBlock = startSchema.slice(startSchema.indexOf('export const cursorSchema'), startSchema.indexOf('});', startSchema.indexOf('export const cursorSchema')) + 3);
    expect(util).toContain(schemaBlock.replace('export const', 'const'));
    seen.movedDecode = fnText(util, 'decodeCursor');
    expect(read(version('3a')('services/commentService.js'))).toBe(read(version(2)('services/commentService.js')));
    const [a, b] = [await postListTour(base(), GATE_DB), await postListTour(version('3a'), GATE2_DB)];
    expect(b).toEqual(a);
    expect(a.pages.map((p) => p.body.data.items.map((post) => post.id))).toEqual([[14, 9], [1, 2], [3, 4], [5]]);
    expect(a.old2.deprecation).toBe(true);
    expect(a.old2.body.items.map((post) => post.id)).toEqual([3, 4]);
    expect(a.old999.body).toEqual({ items: [], hasNext: false, nextCursor: null });
    expect([a.bad.status, a.bad.body.error.code, a.noId.status, a.noId.body.error.code]).toEqual([400, 'INVALID_CURSOR', 400, 'INVALID_CURSOR']);
    expect(a.afterDeleted.body.data.items.map((post) => post.id)).toEqual([1, 2]);
  }, 120_000);

  it('🔴 반례 스냅숏 — 고친 판과 다른 곳은 afterCursor 하나 · 그 함수와 위 주석은 postService.js 의 것 그대로(최신순의 lte · lt)', () => {
    const trap = read(P(TRAP_FILE));
    const fixed = read(version(3)('services/commentService.js'));
    expect(trap.split('\n')[0]).not.toMatch(/^\/\/ ~\//);
    const fnOf = (text) => {
      const at = text.indexOf('function afterCursor(');
      const commentStart = text.lastIndexOf('\n\n', at) + 2;
      return text.slice(commentStart, text.indexOf('\n}\n', at) + 3);
    };
    const postFn = fnOf(read(version(3)('services/postService.js')));
    expect(fnOf(trap)).toBe(postFn);
    expect(trap.replace(fnOf(trap), fnOf(fixed))).toBe(fixed.replace(/^\/\/ ~\/instagram-api\/services\/commentService\.js\n/, ''));
    seen.trapFunction = postFn;
  });

  it('🔴 반례 스냅숏 — 같은 .http 를 보내면 첫 페이지는 4 · 5 로 같고, 둘째 페이지가 첫 페이지의 앞쪽(4)을 다시 준다 · hasNext false 라 6 · 7 은 영영 못 받는다', async () => {
    await copyDb(GATE_DB);
    const text = read(version(3)(HTTP_FILE));
    const runs = await withServer(version(3), GATE_DB, () => httpyac(text), { edit: withTrapService });
    expect(runs.map((r) => r.status)).toEqual([200, 200, 404, 200, 200, 200]);
    expect(runs[4].body.data.items.map((c) => c.id)).toEqual([4, 5]);
    expect(runs[4].body.data.hasNext).toBe(true);
    expect(runs[5].body.data).toMatchObject({ hasNext: false, nextCursor: null });
    expect(runs[5].body.data.items.map((c) => c.id)).toEqual([4]);
    // 커서 없이 받는 목록(1번 · 4번)은 고친 판과 같다 — 조건이 쓰이는 것은 둘째 페이지부터다
    expect(runs[1].body.data.items.map((c) => c.id)).toEqual([1, 2, 3]);
    seen.trapRuns = runs.map(keep);
  }, 60_000);

  it('🔴 고친 판 — .http 끝에 둘(2번 게시물 limit=2 첫 페이지 · 받은 커서로 둘째 페이지) · 응답은 { items, hasNext, nextCursor } · 4 · 5 → 6 · 7 · 끝', async () => {
    const text = read(version(3)(HTTP_FILE));
    const { head, blocks } = blocksOf(text);
    expect(head).toBe('');
    expect(blocks.map((b) => [b.title, b.request])).toEqual(STEP3_BLOCKS);
    expect(text.startsWith(read(version(2)(HTTP_FILE)))).toBe(true);
    expect(text).toContain('### 2번 게시물의 댓글 — 첫 페이지\n# @name first\nGET ');
    await copyDb(GATE_DB);
    const runs = await withServer(version(3), GATE_DB, () => httpyac(text));
    expect(runs.map((r) => [r.title, r.statusLine])).toEqual(STEP3_BLOCKS.map(([title]) => [title, title === '없는 게시물의 댓글' ? 'HTTP/1.1 404 Not Found' : 'HTTP/1.1 200 OK']));
    expect(runs[1].body.data).toMatchObject({ hasNext: false, nextCursor: null });
    expect(runs[1].body.data.items.map((c) => c.id)).toEqual([1, 2, 3]);
    expect(Object.keys(runs[1].body.data)).toEqual(['items', 'hasNext', 'nextCursor']);
    expect(runs[3].body).toEqual({ data: { items: [], hasNext: false, nextCursor: null } });
    const [first, second] = [runs[4].body.data, runs[5].body.data];
    expect([first.items.map((c) => c.id), first.hasNext]).toEqual([[4, 5], true]);
    expect(decode(first.nextCursor)).toEqual({ createdAt: first.items[1].createdAt, id: 5 });
    expect(runs[5].url).toContain(`cursor=${first.nextCursor}`);
    expect([second.items.map((c) => c.id), second.hasNext, second.nextCursor]).toEqual([[6, 7], false, null]);
    expect(second.items.map((c) => c.username)).toEqual(['dahye', 'nayeon']);
    seen.step3 = { file: text, runs: runs.map(keep) };
  }, 60_000);

  it('🔴 고친 판 — 같은 시각의 두 댓글(5 · 6)이 페이지 경계에 걸려도 · 번호 차례와 시각 차례가 어긋나도 겹치지도 빠지지도 않는다 · 시각만 비교하면 6 이 빠지고 · 번호만 비교하면 시각이 이른 7 이 페이지마다 다시 온다', async () => {
    const run = async (edit) => {
      await copyDb(GATE_DB);
      // 6 의 시각을 5 와 같게 · 7 을 4 보다 1분 이르게(p3-33 직접 해보기 3 의 두 문장과 같은 꼴)
      await onDb(GATE_DB, 'UPDATE comments SET created_at = (SELECT created_at FROM comments WHERE id = 5) WHERE id = 6');
      return withServer(version(3), GATE_DB, async ({ base: url }) => {
        const tab = await loggedIn(url, 'jaehoon');
        const out = {};
        for (const limit of [1, 2, 3, 4]) out[limit] = idsOf(await walkComments(tab, 2, limit));
        await onDb(GATE_DB, "UPDATE comments SET created_at = (SELECT created_at FROM comments WHERE id = 4) - INTERVAL '1 minute' WHERE id = 7");
        out.shuffled = idsOf(await walkComments(tab, 2, 2));
        return out;
      }, { edit });
    };
    const fixed = await run();
    expect(fixed).toEqual({ 1: [[4], [5], [6], [7]], 2: [[4, 5], [6, 7]], 3: [[4, 5, 6], [7]], 4: [[4, 5, 6, 7]], shuffled: [[7, 4], [5, 6]] });
    const timeOnly = await run(withTimeOnly);
    expect(timeOnly[2]).toEqual([[4, 5], [7]]);
    const idOnly = await run(withIdOnly);
    // 번호만 비교하면 시각이 가장 이른 7 이 번호로는 가장 커서 페이지마다 다시 온다
    expect(idOnly.shuffled).toEqual([[7, 4], [7, 5], [7, 6]]);
    expect(idOnly[2]).toEqual([[4, 5], [6, 7]]);
    seen.sameTime = { fixed, timeOnly, idOnly };
  }, 120_000);

  it('🔴 고친 판 — 잘못된 커서 400 INVALID_CURSOR · limit 0 · 51 · 1.5 · 글자는 400 VALIDATION_FAILED · limit 이 없으면 20 · 50 까지 · 하나 더 받지 않으면(take: limit) 첫 페이지부터 hasNext false', async () => {
    await copyDb(GATE_DB);
    // 2번 게시물에 원댓글 30개를 더해 둔다(기본값과 상한을 보려고)
    await onDb(GATE_DB, `INSERT INTO comments (post_id, author_id, content, created_at, updated_at)
      SELECT 2, (SELECT id FROM users WHERE username = 'jaehoon'), '확인 ' || n, now() + n * INTERVAL '1 second', now() + n * INTERVAL '1 second' FROM generate_series(1, 30) AS numbers(n)`);
    const out = await withServer(version(3), GATE_DB, async ({ base: url }) => {
      const tab = await loggedIn(url, 'jaehoon');
      const bad = {};
      for (const q of ['cursor=abc', 'cursor=eyJpZCI6Mn0', 'limit=0', 'limit=51', 'limit=1.5', 'limit=abc', 'limit=']) bad[q] = await tab.get(`/api/v2/posts/2/comments?${q}`);
      return {
        bad,
        missingWithBadCursor: await tab.get('/api/v2/posts/99/comments?cursor=abc'),
        plain: await tab.get('/api/v2/posts/2/comments'),
        fifty: await tab.get('/api/v2/posts/2/comments?limit=50'),
      };
    });
    expect(Object.fromEntries(Object.entries(out.bad).map(([q, r]) => [q, [r.status, r.body.error.code]]))).toEqual({
      'cursor=abc': [400, 'INVALID_CURSOR'], 'cursor=eyJpZCI6Mn0': [400, 'INVALID_CURSOR'],
      'limit=0': [400, 'VALIDATION_FAILED'], 'limit=51': [400, 'VALIDATION_FAILED'], 'limit=1.5': [400, 'VALIDATION_FAILED'],
      'limit=abc': [400, 'VALIDATION_FAILED'], 'limit=': [400, 'VALIDATION_FAILED'],
    });
    expect(out.bad['cursor=abc'].body).toEqual(v2Error('INVALID_CURSOR', '커서 값이 올바르지 않아요', '/api/v2/posts/2/comments'));
    expect(out.bad['limit=0'].body.error).toMatchObject({ code: 'VALIDATION_FAILED', message: '보낸 내용이 규칙에 안 맞아요', details: { properties: { limit: expect.any(Object) } } });
    // 게시물 확인이 커서 풀기보다 먼저다 — 없는 게시물에 잘못된 커서는 404
    expect([out.missingWithBadCursor.status, out.missingWithBadCursor.body.error.code]).toEqual([404, 'POST_NOT_FOUND']);
    expect([out.plain.body.data.items.length, out.plain.body.data.hasNext]).toEqual([20, true]);
    expect([out.fifty.body.data.items.length, out.fifty.body.data.hasNext, out.fifty.body.data.nextCursor]).toEqual([34, false, null]);
    const take = await withServer(version(3), GATE_DB, async ({ base: url }) => (await loggedIn(url, 'jaehoon')).get('/api/v2/posts/2/comments?limit=2'), { edit: withTakeLimit });
    expect([take.body.data.items.map((c) => c.id), take.body.data.hasNext, take.body.data.nextCursor]).toEqual([[4, 5], false, null]);
    seen.step3Errors = { badCursor: out.bad['cursor=abc'].text, limit0: out.bad['limit=0'].text, limit51: out.bad['limit=51'].text };
  }, 90_000);

  it('🔴 게시물 목록 회귀 — 고친 판도 시작 판과 한 글자도 같다', async () => {
    const [a, b] = [await postListTour(base(), GATE_DB), await postListTour(version(3), GATE2_DB)];
    expect(b).toEqual(a);
  }, 120_000);

  it('🔎 커서였던 댓글이 지워져도 이어진다(커서의 값만 쓴다) · 쿼리는 Step 2 와 같은 셋 · 커서가 오면 조건이 더해진다 · EXPLAIN — 지금 댓글 테이블에는 post_id 인덱스가 없다', async () => {
    await copyDb(GATE_DB);
    const cont = await withServer(version(3), GATE_DB, async ({ base: url }) => {
      const tab = await loggedIn(url, 'jaehoon');
      const first = (await tab.get('/api/v2/posts/2/comments?limit=2')).body.data;
      await onDb(GATE_DB, 'DELETE FROM comments WHERE id = 5');
      return { first, second: (await tab.get(`/api/v2/posts/2/comments?limit=2&cursor=${first.nextCursor}`)).body.data };
    });
    expect(cont.second.items.map((c) => c.id)).toEqual([6, 7]);
    await copyDb(GATE_DB);
    const q1 = await queriesOf(version(3), GATE_DB, '/api/v2/posts/2/comments?limit=2');
    const cursor = encodeURIComponent((await onDb(GATE_DB, "SELECT encode(convert_to(json_build_object('createdAt', to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"'), 'id', id)::text, 'UTF8'), 'base64') AS c FROM comments WHERE id = 5"))[0].c.replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', ''));
    const q2 = await queriesOf(version(3), GATE_DB, `/api/v2/posts/2/comments?limit=2&cursor=${cursor}`);
    expect(q1.lines).toHaveLength(3);
    expect(q2.lines).toHaveLength(3);
    expect(q2.body.data.items.map((c) => c.id)).toEqual([6, 7]);
    const indexes = await onDb(GATE_DB, "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'comments' ORDER BY indexname");
    const sql = q2.lines[1].replace('prisma:query ', '');
    seen.step3Explain = { indexes, q1: q1.lines, q2: q2.lines, continuedAfterDelete: cont };
    expect(indexes.map((i) => i.indexname)).toEqual(['comments_pkey']);
    expect(sql).toMatch(/"created_at" >= \$\d+ AND \("public"\."comments"\."created_at" > \$\d+ OR "public"\."comments"\."id" > \$\d+\)/);
  }, 90_000);
});

// ── 축 ④ Step 5 강의 자료 SQL ───────────────────────────────────────────────────
const SQL_AUTHORS = ['jaehoon', 'minji', 'dahye', 'nayeon', 'seungwoo', 'sora'];
const explainOf = async (db) => (await onDb(db, `EXPLAIN (ANALYZE, COSTS OFF, BUFFERS OFF, TIMING OFF, SUMMARY OFF)
  SELECT id FROM comments WHERE post_id = 2 AND parent_id IS NULL ORDER BY created_at ASC, id ASC LIMIT 21`)).map((row) => row['QUERY PLAN']);

describe('축 ④ Step 5 — 강의 자료 lab/p3-53/many-comments.sql', () => {
  it('🔴 파일 — 첫 줄 경로 주석 · 표준 SQL 만(psql 메타명령 · BEGIN/COMMIT 없음) · INSERT 하나 · UPDATE 하나 · 확인 SELECT 하나', () => {
    const sql = read(version(5)(SQL_FILE));
    expect(sql.split('\n')[0]).toBe('-- ~/instagram-api/lab/p3-53/many-comments.sql');
    expect(sql.split('\n').filter((line) => /^\s*\\/.test(line))).toEqual([]);
    expect(sql).not.toMatch(/\b(BEGIN|COMMIT|ROLLBACK)\b/);
    const statements = sql.split('\n').filter((line) => !line.startsWith('--')).join('\n').split(';').map((one) => one.trim()).filter(Boolean);
    expect(statements.map((one) => one.split(/\s/)[0])).toEqual(['INSERT', 'UPDATE', 'SELECT']);
    expect(sql.endsWith(';\n')).toBe(true);
  });

  it('🔴 판정 DB 에서 실행 — 확인 SELECT 가 comment_count 29 · 원댓글 29 · 더한 25개는 2번 게시물의 원댓글 · 글쓴이 여섯이 차례로 · 글 25개가 모두 다르다 · 1분 간격 · 시드 댓글보다 모두 늦다', async () => {
    await copyDb(GATE_DB);
    const before = (await onDb(GATE_DB, 'SELECT max(id) AS id, max(created_at) AS at FROM comments'))[0];
    const results = await runSql(GATE_DB, read(version(5)(SQL_FILE)));
    expect(results.map((r) => r.command)).toEqual(['INSERT', 'UPDATE', 'SELECT']);
    expect([results[0].rowCount, results[1].rowCount]).toEqual([25, 1]);
    expect(results[2].rows).toEqual([{ comment_count: 29, root_comments: '29' }]);
    const added = await onDb(GATE_DB, `SELECT c.id, c.post_id, c.parent_id, c.content, c.like_count, c.created_at, u.username
      FROM comments c JOIN users u ON u.id = c.author_id WHERE c.id > $1 ORDER BY c.created_at, c.id`, [before.id]);
    expect(added).toHaveLength(25);
    expect(added.every((c) => c.post_id === 2 && c.parent_id === null && c.like_count === 0)).toBe(true);
    expect(added.map((c) => c.username)).toEqual(Array.from({ length: 25 }, (_, i) => SQL_AUTHORS[i % 6]));
    expect(new Set(added.map((c) => c.content)).size).toBe(25);
    // 시드 댓글과 겹치는 글이 없다
    const seedTexts = (await onDb(GATE_DB, 'SELECT content FROM comments WHERE id <= $1', [before.id])).map((c) => c.content);
    expect(added.filter((c) => seedTexts.includes(c.content))).toEqual([]);
    // 번호 차례가 시각 차례다 · 1분 간격 · 시드 댓글보다 늦다
    expect(added.map((c) => c.id)).toEqual(added.map((c) => c.id).slice().sort((a, b) => a - b));
    for (let i = 1; i < 25; i++) expect(added[i].created_at - added[i - 1].created_at).toBe(60_000);
    expect(added[0].created_at > before.at).toBe(true);
    seen.sql = { results: results.map((r) => ({ command: r.command, rowCount: r.rowCount, rows: r.rows })), added: added.map((c) => ({ id: c.id, username: c.username, content: c.content })) };
  }, 60_000);

  it('🔴 실행 뒤 댓글 API(Step 3 판) — limit 없이 첫 페이지 20(시드 넷 + 더한 16) · nextCursor 로 둘째 페이지 9 · hasNext false · 이어지는 곳이 겹치지도 빠지지도 않는다 · 쿼리는 그대로 셋', async () => {
    await copyDb(GATE_DB);
    await runSql(GATE_DB, read(version(5)(SQL_FILE)));
    const out = await withServer(version(5), GATE_DB, async ({ base: url }) => {
      const tab = await loggedIn(url, 'jaehoon');
      const first = await tab.get('/api/v2/posts/2/comments');
      const second = await tab.get(`/api/v2/posts/2/comments?cursor=${first.body.data.nextCursor}`);
      const post = await tab.get('/api/v2/posts/2');
      return { first: first.body.data, second: second.body.data, post: post.body.data };
    });
    const ids = (await onDb(GATE_DB, 'SELECT id FROM comments WHERE post_id = 2 AND parent_id IS NULL ORDER BY created_at, id')).map((c) => c.id);
    expect(ids).toHaveLength(29);
    expect([out.first.items.length, out.first.hasNext]).toEqual([20, true]);
    expect([out.second.items.length, out.second.hasNext, out.second.nextCursor]).toEqual([9, false, null]);
    expect([...out.first.items, ...out.second.items].map((c) => c.id)).toEqual(ids);
    expect(out.first.items.slice(0, 4).map((c) => c.id)).toEqual([4, 5, 6, 7]);
    expect(decode(out.first.nextCursor).id).toBe(out.first.items[19].id);
    expect(out.post.commentCount).toBe(29);
    seen.sqlPages = {
      first: { count: out.first.items.length, hasNext: out.first.hasNext, nextCursor: out.first.nextCursor, last: out.first.items[19] },
      second: { count: out.second.items.length, hasNext: out.second.hasNext, nextCursor: out.second.nextCursor, first: out.second.items[0], last: out.second.items[8] },
    };
    const q = await queriesOf(version(5), GATE_DB, `/api/v2/posts/2/comments?cursor=${out.first.nextCursor}`);
    expect(q.lines).toHaveLength(3);
  }, 90_000);

  it('🔎 두 번 실행하면 원댓글 54 · comment_count 54(둘이 함께 오르니 확인 SELECT 로는 두 번 실행한 것이 안 보인다) · sora 가 없는 DB 면 21개만 들어가고 숫자는 25 올라 두 값이 다르다', async () => {
    await copyDb(GATE_DB);
    const sql = read(version(5)(SQL_FILE));
    await runSql(GATE_DB, sql);
    const twice = await runSql(GATE_DB, sql);
    expect(twice[2].rows).toEqual([{ comment_count: 54, root_comments: '54' }]);
    await copyDb(GATE2_DB);
    await onDb(GATE2_DB, "UPDATE users SET username = 'sora_gone' WHERE username = 'sora'");
    const noSora = await runSql(GATE2_DB, sql);
    expect([noSora[0].rowCount, noSora[2].rows]).toEqual([21, [{ comment_count: 29, root_comments: '25' }]]);
    seen.sqlTwice = { twice: twice[2].rows, noSora: noSora[2].rows };
  }, 60_000);

  it('🔎 EXPLAIN — 댓글 테이블에 post_id 인덱스가 없어 실행 전·뒤 모두 comments 를 Seq Scan(🙋 재료 — 짓지 않는다)', async () => {
    await copyDb(GATE_DB);
    const before = await explainOf(GATE_DB);
    await runSql(GATE_DB, read(version(5)(SQL_FILE)));
    await onDb(GATE_DB, 'ANALYZE comments');
    const after = await explainOf(GATE_DB);
    seen.explain = { before, after };
    expect(before.join('\n')).toMatch(/Seq Scan on comments/);
    expect(after.join('\n')).toMatch(/Seq Scan on comments/);
  }, 60_000);
});

// ── 축 ⑤ 학생 파일 차이 ─────────────────────────────────────────────────────────
describe('축 ⑤ 학생 파일 차이 — 시작 판(code/p3-52 또는 그 위의 정정)에서 각 판까지', () => {
  it('🔴 커밋 수와 차례 — Step 1 둘 · Step 2 둘 · Step 3 둘 · Step 5 하나 · 1 → 2 → 3 → 5', () => {
    expect([1, 2, 3, 5].map((n) => stepCommits(n).length)).toEqual([2, 2, 2, 1]);
    const order = execFileSync('git', ['log', '--format=%H', `${baseRef()}..${LINE}`], { cwd: P('.'), encoding: 'utf8' }).trim().split('\n').reverse();
    const at = ['1a', 1, '2a', 2, '3a', 3, 5].map((label) => order.indexOf(versionRef(label)));
    expect(at.every((n) => n >= 0)).toBe(true);
    expect(at).toEqual(at.slice().sort((a, b) => a - b));
    seen.commits = Object.fromEntries(['1a', 1, '2a', 2, '3a', 3, 5].map((label) => [label, versionRef(label)]));
  });

  it('🔴 판마다 바뀐 학생 파일 — 교안이 «바꿀 파일» 로 말할 목록', () => {
    const r = (label) => versionRef(label);
    expect(changedStudentFiles(baseRef(), r('1a'))).toEqual([HTTP_FILE]);
    expect(changedStudentFiles(r('1a'), r(1))).toEqual(['app.js', 'controllers/commentController.js', 'routes/comments.js', 'services/commentService.js']);
    expect(changedStudentFiles(r(1), r('2a'))).toEqual([HTTP_FILE]);
    expect(changedStudentFiles(r('2a'), r(2))).toEqual(['services/commentService.js']);
    expect(changedStudentFiles(r(2), r('3a'))).toEqual(['schemas/postSchema.js', 'services/postService.js', 'utils/cursor.js']);
    expect(changedStudentFiles(r('3a'), r(3))).toEqual(['controllers/commentController.js', HTTP_FILE, 'routes/comments.js', 'schemas/commentSchema.js', 'services/commentService.js']);
    expect(changedStudentFiles(r(3), r(5))).toEqual([SQL_FILE]);
    expect(changedStudentFiles(baseRef(), r(5))).toEqual([
      'app.js', 'controllers/commentController.js', SQL_FILE, HTTP_FILE, 'routes/comments.js', 'schemas/commentSchema.js', 'schemas/postSchema.js',
      'services/commentService.js', 'services/postService.js', 'utils/cursor.js',
    ]);
    // 새 패키지 · 스키마 · 마이그레이션 없음
    for (const rel of ['package.json', 'package-lock.json', 'prisma/schema.prisma']) expect([rel, showAt(r(5), rel)]).toEqual([rel, showAt(baseRef(), rel)]);
    expect(readdirSync(version(5)('prisma/migrations'))).toEqual(readdirSync(base()('prisma/migrations')));
    // app.js 는 두 줄을 더했다 — import 하나 · 좋아요 라우터 바로 아래 api.use 하나
    const diff = execFileSync('git', ['diff', '-U0', r('1a'), r(1), '--', 'app.js'], { cwd: P('.'), encoding: 'utf8' });
    expect(diff.split('\n').filter((line) => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line))).toEqual([
      "+import commentsRouter from './routes/comments.js';",
      "+api.use('/posts/:id/comments', commentsRouter);",
    ]);
    const app = read(version(1)('app.js'));
    expect(app).toContain("api.use('/posts/:id/likes', likesRouter);\napi.use('/posts/:id/comments', commentsRouter);\n");
    expect(app.indexOf('api.use(requireLogin);')).toBeLessThan(app.indexOf("api.use('/posts/:id/comments'"));
    seen.diffs = Object.fromEntries([['1', r('1a'), r(1)], ['2', r(1), r(2)], ['3a', r(2), r('3a')], ['3', r('3a'), r(3)]].map(([k, a, b]) => [k, execFileSync('git', ['diff', a, b, '--', ...STUDENT_FILES], { cwd: P('.'), encoding: 'utf8' })]));
  });

  it('🔴 학생 파일에 내부 어휘가 없다 · 첫 줄 경로 주석 · 쓰지 않기로 한 낱말이 없다', () => {
    const to = versionRef(5);
    for (const rel of changedStudentFiles(baseRef(), to)) {
      const text = showAt(to, rel);
      // 첫 줄 경로 주석의 lab/p3-53/ 은 학생 폴더 이름이라 뺀다
      expect([rel, /게이트|판정|TDD|Step \d|p3-\d\d|회차|스냅숏/.test(text.split('\n').slice(1).join('\n'))]).toEqual([rel, false]);
      if (rel.endsWith('.js')) expect([rel, text.split('\n')[0]]).toEqual([rel, `// ~/instagram-api/${rel}`]);
      if (rel.endsWith('.sql')) expect([rel, text.split('\n')[0]]).toEqual([rel, `-- ~/instagram-api/${rel}`]);
    }
    // «돌려준다»(값을 돌려주다 — return)는 이 코드베이스가 늘 쓰는 다른 낱말이라 뺀다
    const banned = /자리|박다|박아|박힌|결[이을로의]|갈래|몸통|판[이을으]|겹|까닭|걸리|걸린|돌리|돌려(?!주|준|줄)|가르|갈리|재다|재서|벗기|되살|짝/;
    const diff = execFileSync('git', ['diff', baseRef(), to, '--', ...STUDENT_FILES], { cwd: P('.'), encoding: 'utf8' });
    const added = diff.split('\n').filter((line) => line.startsWith('+') && !line.startsWith('+++'));
    expect(added.length).toBeGreaterThan(0);
    expect(added.filter((line) => banned.test(line))).toEqual([]);
  });
});
