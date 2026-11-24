// p3-55 「대댓글」 게이트 — 백엔드(교안 Step 1~3 의 답글 목록 · replyCount · 답글 달기 API · docs/openapi.js)
// 내부 검증 전용 — 교안에 한 줄도 인용하지 않는다.
//
// `8-fullstack-features` 일곱째 회차다(`progress/p3-55-replies.md` 「착수 결정」 ②~④). 화면(Step 4~8)은 `instagram-next/.verify` 가 본다.
// 백엔드의 시작 판은 code/p3-54(767e642)의 학생 파일이다.
// 커밋 — Step 1 은 셋(강의 자료 · 원댓글을 안 읽는 판 · 고친 판) · Step 2 는 셋(강의 자료 · 답글을 통째로 싣는 판 · _count 판) ·
//        Step 3 은 넷(강의 자료 · 답글을 달 댓글을 번호로만 찾는 판 · 고친 판 · 문서). 같은 «(Step N)» 표식이 여럿이면 가장 뒤 커밋이 그 Step 의 끝 판이다.
// 🔑 짓는 동안 `P355_WT` 를 주면 그 판을 커밋 대신 작업트리에서 읽는다 — `1a` · `1b` · `1` · `2a` · `2b` · `2` · `3a` · `3b` · `3c` · `3`.
// 🔑 포트 — 3970 · 3971(둘째 서버) · 3977(셋째 서버) · 3976(탐침). DB — `p355_api_` 로 시작하는 것만 만들고 지운다. `P355_PG_PORT` 로 PostgreSQL 호스트 포트를 바꾼다.
// 🔑 판정 DB 는 «p3-54 를 마친 학생 DB» —
//    ① test/p3-54.test.js 의 준비(«p3-53 을 마친 학생 DB»)를 그대로 하고
//    ② 그 위에 p3-54 축 ⑥(Step 1 → 2 → 3 의 판을 차례로 갈아 끼우며 .http 를 교안 차례로 · 끝에 fix-comment-count.sql)을 그대로 돌린 뒤
//    ③ p3-54 화면 Step 4~7 이 교안 차례로 쓴 것(instagram-next `.verify/test/p3-54.claims.test.js` ⑭ «교안 그대로»)을 같은 요청으로 다시 쓴다 —
//       1번 게시물에 jaehoon 원댓글 셋(«노을 질 때 가면 더 예뻐요» · «서버가 꺼져 있으면 어떻게 될까요»(서버를 다시 켜고 «게시») · «사진은 휴대폰으로 찍었어요») ·
//       2번 게시물에 jaehoon 원댓글 여덟 · 그 가운데 «다음엔 같이 구워요» 를 지운다.
//    결과 — 1번 원댓글 4 · 행 6(답글 10 · 11) · 2번 원댓글 39 · 행 40(답글 12) · 숫자가 모두 맞다.
//    🚨 화면은 POST·DELETE 를 브라우저에서 보낸다 — 여기서는 같은 주소를 같은 차례로 보낸다(시각은 실행한 때 · 서버를 끈 채 보낸 첫 «게시» 는 아무것도 안 쓴다).
//    🚨 번호는 학생마다 다를 수 있다 — 판정은 시드 게시물(1~5)과 시드 댓글(1~12) 밖의 번호를 고정값으로 쓰지 않는다.
//
// 축 ⓪ 판정 DB — 위 숫자
// 축 ① Step 1 — 강의 자료 판(404 ROUTE_NOT_FOUND) · 원댓글을 안 읽는 판(없는 댓글 · 답글 번호 200 [] · 다른 게시물 주소로도 답글) · 고친 판(404 · 400 · 커서 · 기본 3 · 쿼리)
// 축 ② Step 2 — 강의 자료(SQL 파일 꼴 · 실행 결과 · .http 한 블록) · 통째로 싣는 판 · _count 판 · 두 판의 응답 크기·시간(실측) · 쿼리 로그
// 축 ③ Step 3 — 강의 자료 판(parentId 를 버린다 — 원댓글로 달린다) · 번호로만 찾는 판(다른 게시물의 댓글에도 답글) · 고친 판(경우들 · 숫자 · 응답 꼴 · 쿼리) · 문서
// 축 ④ 회귀 — 댓글 목록(replyCount 를 뺀 나머지) · 게시물 목록 · 좋아요 · 원댓글 달기(replyCount 를 뺀 나머지) · 지우기가 시작 판과 같다
// 축 ⑤ 학생 파일 차이 — 시작 판에서 각 판까지 · 내부 어휘 · 경로 주석 · 쓰지 않기로 한 낱말
// 축 ⑥ 학생 한 사람의 흐름 — 한 DB 에서 Step 1 → 2 → 3 의 판을 차례로 갈아 끼우며 교안 차례로 누른다 — 그 끝 DB 가 «Step 4 를 시작하는 학생 DB» 다(화면 판정이 쓴다)
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, mkdtempSync, rmSync, cpSync, symlinkSync, existsSync, readdirSync, writeFileSync, openSync, closeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { performance } from 'node:perf_hooks';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { boot } from './helpers/boot.js';

const ROOT = new URL('../', import.meta.url);
const P = (rel) => new URL(rel, ROOT).pathname;
const read = (path) => readFileSync(path, 'utf8');
const PG_PORT = Number(process.env.P355_PG_PORT ?? 5432);
const ADMIN = { host: 'localhost', port: PG_PORT, database: 'postgres', user: 'postgres', password: 'postgres' };
const TPL_DB = 'p355_api_tpl';
const GATE_DB = 'p355_api_gate';
const GATE2_DB = 'p355_api_gate2';
const dbUrl = (name) => `postgresql://postgres:postgres@localhost:${PG_PORT}/${name}`;
const PORT = 3970;
const PORT2 = 3971;
const PORT3 = 3977;
const PROBE_PORT = 3976;
const SECRET = 'q2Xh0v9bGm4RkT7sYp1wLc8nZf3uJd6eHa5iVo0rQyE';
const PROVIDER_ENV = {
  GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret', SITE_URL: `http://localhost:${PORT}`,
  KAKAO_CLIENT_ID: 'test-kakao', KAKAO_CLIENT_SECRET: 'test-kakao-secret',
  NAVER_CLIENT_ID: 'test-naver', NAVER_CLIENT_SECRET: 'test-naver-secret',
};
const env = { CORS_ORIGIN: 'http://localhost:3001', JWT_SECRET: SECRET, ...PROVIDER_ENV };
const STUDENT_FILES = ['app.js', 'db.js', 'errors.js', 'responses.js', 'routes', 'controllers', 'services', 'middlewares', 'schemas', 'strategies', 'docs', 'utils', 'package.json', 'requests', 'seed.js', 'data', 'prisma', 'prisma.config.js', '.env.example', 'lab'];
const HTTP_FILE = 'requests/post-comments.http';
const SQL53 = 'lab/p3-53/many-comments.sql';
const FIX54 = 'lab/p3-54/fix-comment-count.sql';
const SQL_FILE = 'lab/p3-55/many-replies.sql';
const ISO = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;
const FIELDS = ['id', 'authorId', 'content', 'likeCount', 'createdAt', 'username', 'profileImage'];

const git = (args, opts = {}) => execFileSync('git', args, { cwd: P('.'), encoding: 'utf8', maxBuffer: 1 << 28, ...opts });
const hasRef = (ref) => {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', ref], { cwd: P('.'), stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
};
// 🔑 판의 선 — 북마크 code/p3-55 가 있으면 그것, 없으면 지금 체크아웃한 선(HEAD). `P355_LINE` 으로 바꾼다.
const LINE = process.env.P355_LINE ?? (hasRef('refs/heads/code/p3-55') ? 'code/p3-55' : 'HEAD');
const WT = process.env.P355_WT ?? null;
/** «(Step N)» 표식이 붙은 그 회차 커밋들 — 새것부터. */
const commitsOf = (round, line) => (n) => {
  const log = git(['log', '-n', '600', '--format=%H %s', line]);
  const hits = log.split('\n').filter((l) => new RegExp(` feat\\(${round}\\): `).test(l) && l.endsWith(`(Step ${n})`)).map((l) => l.split(' ')[0]);
  if (hits.length === 0) throw new Error(`${round} (Step ${n}) 커밋이 없다`);
  return hits;
};
const stepCommits = commitsOf('p3-55', LINE);
const stepCommits54 = commitsOf('p3-54', 'code/p3-54');
const dirs = [];
const refDirs = new Map();
/** 커밋(또는 브랜치) 하나를 임시 폴더에 풀어 둔다. */
const refDir = (ref) => {
  if (refDirs.has(ref)) return refDirs.get(ref);
  const dir = mkdtempSync(join(tmpdir(), 'p355-ref-'));
  const tar = execFileSync('git', ['archive', '--format=tar', ref], { cwd: P('.'), maxBuffer: 1 << 28 });
  execFileSync('tar', ['-x', '-C', dir], { input: tar });
  dirs.push(dir);
  const at = (rel) => join(dir, rel);
  refDirs.set(ref, at);
  return at;
};
const worktree = (rel) => P(rel);
// 🔑 시작 판 — 이 회차 첫 커밋(Step 1 의 강의 자료)의 바로 앞 = code/p3-54. `P355_BASE` 로 바꾼다.
let baseCache;
const baseRef = () => (baseCache ??= process.env.P355_BASE ?? git(['rev-parse', `${stepCommits(1).at(-1)}^`]).trim());
const base = () => refDir(baseRef());
// Step 1 — 1a 강의 자료 · 1b 원댓글을 안 읽는 판 · 1 고친 판 / Step 2 — 2a 강의 자료 · 2b 통째로 싣는 판 · 2 _count 판 /
// Step 3 — 3a 강의 자료 · 3b 번호로만 찾는 판 · 3c 고친 판 · 3 문서(가장 뒤 커밋 — 학생 파일의 Step 3 끝 판)
const VERSIONS = { '1a': [1, 0], '1b': [1, 1], 1: [1, -1], '2a': [2, 0], '2b': [2, 1], 2: [2, -1], '3a': [3, 0], '3b': [3, 1], '3c': [3, 2], 3: [3, -1] };
const LABELS = ['1a', '1b', 1, '2a', '2b', 2, '3a', '3b', '3c', 3];
const versionRef = (label) => {
  if (WT === String(label)) return null;
  const [step, index] = VERSIONS[label];
  const commits = stepCommits(step).slice().reverse();
  if (index === -1) return commits.at(-1);
  if (commits[index] === undefined) throw new Error(`(Step ${step}) 커밋이 ${index + 1}개보다 적다`);
  return commits[index];
};
const version = (label) => {
  const ref = versionRef(label);
  return ref === null ? worktree : refDir(ref);
};
// p3-54 의 판 — 판정 DB 를 세울 때 p3-54 축 ⑥ 을 그대로 돌리려고
const VERSIONS54 = { 1: [1, 1], '2a': [2, 0], '2b': [2, 1], 2: [2, 2], '3b': [3, 1], 3: [3, -1] };
const version54 = (label) => {
  const [step, index] = VERSIONS54[label];
  const commits = stepCommits54(step).slice().reverse();
  return refDir(index === -1 ? commits.at(-1) : commits[index]);
};
const base54Ref = () => git(['rev-parse', `${stepCommits54(1).at(-1)}^`]).trim();
const showAt = (ref, rel) => git(['show', `${ref}:${rel}`]);
const changedStudentFiles = (from, to) => git(['diff', '--name-only', from, ...(to ? [to] : []), '--', ...STUDENT_FILES]).trim().split('\n').filter(Boolean);

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

const replaceIn = (dir, rel, a, b) => {
  const text = read(join(dir, rel));
  if (text.split(a).length !== 2) throw new Error(`${rel} 에 바꿀 글자가 없거나 여럿이다: ${a}`);
  writeFileSync(join(dir, rel), text.replace(a, b));
};
/** 템플릿을 세운 서버의 uploads 폴더를 떠 둔 곳 — 판정 서버마다 사본을 깐다. */
let TPL_UPLOADS = null;
const studentDir = (from, edit) => {
  const dir = mkdtempSync(join(tmpdir(), 'p355-srv-'));
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
      payload = typeof body === 'string' ? body : JSON.stringify(body);
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
const tokenFor = (userId) => jwt.sign({ sid: randomUUID(), role: 'USER' }, SECRET, { subject: String(userId), expiresIn: 900, algorithm: 'HS256' });
const photo = (name) => readFileSync(P(`requests/photos/${name}`));
/** 화면 «공유하기» 처럼 — 사진을 먼저 올리고 그 주소로 게시물을 만든다. */
const share = async (tab, content, postAlt) => {
  const form = new FormData();
  form.append('images', new Blob([photo('beach.jpg')], { type: 'image/jpeg' }), 'beach.jpg');
  const uploaded = await tab.send('POST', '/api/v2/uploads', form);
  expect(uploaded.status).toBe(201);
  const created = await tab.send('POST', '/api/v2/posts', { imageUrls: uploaded.body.data.imageUrls, postAlt, content });
  expect(created.status).toBe(201);
  return { id: created.body.data.id, fileName: uploaded.body.data.imageUrls[0].replace('/uploads/', '') };
};

/** 템플릿을 «p3-52 를 마친» 학생 DB 처럼 — test/p3-54.test.js 의 toStudentState 그대로. */
const toStudentState = async (url, dir, from) => {
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
  await onDb(TPL_DB, "INSERT INTO users (username, name, phone, password_hash, role) VALUES ('admin.hong', '관리자', '01077771234', $1, 'ADMIN')",
    [await bcrypt.hash(PASSWORDS['admin.hong'], 12)]);
  await onDb(TPL_DB, "SELECT setval('posts_id_seq', 8)");
  const minji = browser(url);
  const nine = await minji.send('POST', '/api/v2/posts', post9Body(from), { Authorization: `Bearer ${tokenFor(await idOf(TPL_DB, 'minji'))}` });
  expect([nine.status, nine.body.data.id, nine.body.data.username, nine.body.data.content]).toEqual([201, 9, 'minji', '제주 왔어요 🌊']);
  const jaehoon = await loggedIn(url, 'jaehoon');
  for (const id of [1, 2, 9]) expect((await jaehoon.send('PUT', `/api/v2/posts/${id}/likes/me`)).status).toBe(200);
  await onDb(TPL_DB, "SELECT setval('posts_id_seq', 13)");
  const fourteen = await share(jaehoon, '바다에 다녀왔어요', '바다에 다녀왔어요');
  const slow = [];
  for (let n = 0; n < 4; n++) slow.push(await share(jaehoon, '느린 네트워크', '느린 네트워크'));
  const nineteen = await share(jaehoon, '지난 주말에 다녀온 바다', '바닷가 사진');
  rmSync(join(dir, 'uploads', nineteen.fileName));
  await onDb(TPL_DB, "SELECT setval('posts_id_seq', 25)");
  expect((await jaehoon.send('PUT', `/api/v2/posts/${fourteen.id}/likes/me`)).status).toBe(200);
  expect((await jaehoon.send('PATCH', `/api/v2/posts/${fourteen.id}`, { content: '주말에 바다에 다녀왔어요' })).status).toBe(200);
  for (const one of [nineteen, ...slow.slice().reverse()]) expect((await jaehoon.send('DELETE', `/api/v2/posts/${one.id}`)).status).toBe(200);
  TPL_UPLOADS = mkdtempSync(join(tmpdir(), 'p355-uploads-'));
  dirs.push(TPL_UPLOADS);
  cpSync(join(dir, 'uploads'), TPL_UPLOADS, { recursive: true });
};

/** httpYac CLI 로 `.http` 한 파일을 통째로 보낸다(`--all --json`) — 학생이 VS Code 에서 위에서부터 차례로 누르는 것과 같다. */
const httpyac = async (source, port = PORT) => {
  const dir = mkdtempSync(join(tmpdir(), 'p355-http-'));
  dirs.push(dir);
  writeFileSync(join(dir, 'send.http'), source.replaceAll('http://localhost:3000', `http://localhost:${port}`));
  // 🚨 출력을 파이프로 받으면 httpYac 이 64KB 에서 끊긴 채 끝난다 — 파일로 받는다.
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
/** .http 의 블록 — 제목 · 요청 줄. */
const blocksOf = (text) => {
  const [head, ...rest] = text.split(/^### /m);
  return { head, blocks: rest.map((block) => ({ title: block.split('\n')[0], request: block.split('\n').find((line) => /^(GET|POST|PUT|PATCH|DELETE) /.test(line)) })) };
};
const blockTexts = (text) => text.split(/^### /m).slice(1).map((block) => ({ title: block.split('\n')[0], text: `### ${block.trimEnd()}\n` }));
/** 제목으로 골라 차례대로 이어 붙인 .http — 같은 제목을 두 번 적으면 두 번 보낸다. */
const compose = (text, titles) => {
  const all = blockTexts(text);
  return titles.map((title) => {
    const hits = all.filter((b) => b.title === title);
    if (hits.length !== 1) throw new Error(`«${title}» 블록이 ${hits.length}개다`);
    return hits[0].text;
  }).join('\n');
};
const withQueryLog = (dir) => replaceIn(dir, 'db.js', 'new PrismaClient({ adapter })', "new PrismaClient({ adapter, log: ['query'] })");
const queryLines = (text) => text.split('\n').filter((line) => line.startsWith('prisma:query'));
/** 요청 하나의 Prisma 쿼리 로그 — 쿼리 로그를 켠 사본으로 띄워 목록 한 번으로 연결을 준비한 뒤 그 요청만 센다. */
const queriesOfSend = (from, db, method, path, body) => withServer(from, db, async ({ base: url, tail }) => {
  const tab = await loggedIn(url, 'jaehoon');
  await tab.get('/api/v2/posts/2/comments?limit=1');
  await tab.send(method, path, body);
  await sleep(300);
  const at = tail().length;
  const res = await tab.send(method, path, body);
  await sleep(300);
  return { status: res.status, body: res.body, lines: queryLines(tail().slice(at)), raw: tail().slice(at) };
}, { port: PROBE_PORT, edit: withQueryLog });

/** 게시물마다 comment_count · 원댓글 수 · 댓글 행 수. */
const counts = (db) => onDb(db, `SELECT p.id, p.comment_count AS count,
  (SELECT count(*)::int FROM comments c WHERE c.post_id = p.id AND c.parent_id IS NULL) AS roots,
  (SELECT count(*)::int FROM comments c WHERE c.post_id = p.id) AS rows
  FROM posts p ORDER BY p.id`);
const countOf = async (db, id) => (await counts(db)).find((p) => p.id === id);
const drift = async (db) => (await counts(db)).filter((p) => p.count !== p.roots);
/** 원댓글 하나의 답글 — 번호 · 게시물 · 글쓴이 · 글(오래된 순). */
const repliesOf = (db, id) => onDb(db, `SELECT c.id, c.post_id, u.username, c.content FROM comments c JOIN users u ON u.id = c.author_id
  WHERE c.parent_id = $1 ORDER BY c.created_at, c.id`, [id]);
const commentIdOf = async (db, content) => {
  const rows = await onDb(db, 'SELECT id FROM comments WHERE content = $1', [content]);
  if (rows.length !== 1) throw new Error(`«${content}» 댓글이 ${rows.length}개다`);
  return rows[0].id;
};

/** 교안에 인용할 실측 — `P355_SEEN=경로` 를 주면 파일로 남긴다(보고용). */
const seen = {};

// ── p3-54 의 흐름(판정 DB 의 ② · ③) ─────────────────────────────────────────────
const LOGIN = 'jaehoon으로 로그인';
const ADD54 = '2번 게시물에 댓글 달기';
const POST2 = '2번 게시물';
const POST1 = '1번 게시물';
const ADDED54 = '한 입만 나눠 주세요';
const D_WRONG = '2번 게시물 주소로 1번 게시물의 댓글 지우기';
const D_WRONG2 = '2번 게시물 주소로 1번 게시물의 다른 댓글 지우기';
const D_RIGHT = '1번 게시물 주소로 같은 댓글 지우기';
const D_ADD = '지울 댓글 달기';
const D_MINE = '내가 단 댓글 지우기';
const D_AGAIN = '같은 댓글을 한 번 더 지우기';
const D_OTHERS = '남의 게시물에 남이 단 댓글 지우기';
const D_NONE = '없는 댓글 지우기';
const FLOW54_TEXTS = { step2b: '어느 빵집 크루아상이에요?', step2: '크기가 손바닥만 하네요' };
/** p3-54 화면 Step 4~7 이 교안 차례로 쓴 것 — [게시물, 글] 은 달기 · [게시물, 글, 'DELETE'] 는 그 글을 지우기. */
const SCREEN54 = [
  [1, '노을 질 때 가면 더 예뻐요'], [1, '서버가 꺼져 있으면 어떻게 될까요'], [1, '사진은 휴대폰으로 찍었어요'],
  [2, '저도 주말에 구워 볼게요'], [2, '레시피 꼭 알려 주세요'], [2, '크루아상 모양이 정말 예뻐요'], [2, '한 번에 다 먹을 것 같아요'],
  [2, '오늘 저녁은 빵으로 정했어요'], [2, '사진만 봐도 배불러요'], [2, '빵 굽는 영상도 올려 주세요'], [2, '다음엔 같이 구워요'],
  [2, '다음엔 같이 구워요', 'DELETE'],
];

const SEED_SHIFT = "INTERVAL '3 days'";
beforeAll(async () => {
  await admin(async (client) => {
    for (const name of [GATE_DB, GATE2_DB, TPL_DB]) {
      await kick(client, name);
      await client.query(`DROP DATABASE IF EXISTS ${name}`);
    }
    await client.query(`CREATE DATABASE ${TPL_DB}`);
  });
  // ① «p3-53 을 마친 학생 DB» — test/p3-54.test.js 의 beforeAll 그대로(시작 판은 p3-54 의 시작 판)
  const from = refDir(base54Ref());
  for (const dir of readdirSync(from('prisma/migrations')).filter((name) => name !== 'migration_lock.toml').sort()) {
    await onDb(TPL_DB, read(from(`prisma/migrations/${dir}/migration.sql`)));
  }
  const seedDir = studentDir(from);
  const childEnv = { ...process.env, DATABASE_URL: dbUrl(TPL_DB) };
  delete childEnv.NODE_ENV;
  execFileSync(process.execPath, [join(seedDir, 'seed.js')], { cwd: seedDir, encoding: 'utf8', env: childEnv });
  await onDb(TPL_DB, `UPDATE posts SET created_at = created_at - ${SEED_SHIFT}, updated_at = updated_at - ${SEED_SHIFT}`);
  await onDb(TPL_DB, `UPDATE comments SET created_at = created_at - ${SEED_SHIFT}, updated_at = updated_at - ${SEED_SHIFT}`);
  await withServer(from, TPL_DB, ({ base: url, dir }) => toStudentState(url, dir, from), { port: PORT2 });
  const out53 = await runSql(TPL_DB, read(from(SQL53)));
  expect(out53.at(-1).rows).toEqual([{ comment_count: 29, root_comments: '29' }]);

  // ② p3-54 축 ⑥ — Step 1 → 2 → 3 의 판을 차례로 갈아 끼우며 .http 를 교안 차례로 · 끝에 fix-comment-count.sql
  const text54 = read(version54(3)(HTTP_FILE));
  const ADD_LINE = `"content": "${ADDED54}"`;
  const send54 = async (label, titles, content = ADDED54) => {
    const source = compose(text54, [LOGIN, ...titles]);
    const runs = await withServer(version54(label), TPL_DB, () => httpyac(source.replaceAll(ADD_LINE, `"content": "${content}"`)));
    return runs.slice(1).map((r) => r.status);
  };
  const flow54 = {
    1: await send54(1, [ADD54]),
    '2a': await send54('2a', [POST2]),
    '2b': await send54('2b', [ADD54, POST2], FLOW54_TEXTS.step2b),
    2: await send54(2, [ADD54, POST2], FLOW54_TEXTS.step2),
    '3b': await send54('3b', [D_WRONG, POST1, POST2]),
    3: await send54(3, [D_WRONG2, D_RIGHT, D_ADD, D_MINE, D_AGAIN, D_OTHERS, D_NONE, POST1, POST2]),
  };
  expect(flow54).toEqual({
    1: [201], '2a': [200], '2b': [201, 200], 2: [201, 200], '3b': [200, 200, 200], 3: [404, 200, 201, 200, 404, 403, 404, 200, 200],
  });
  await runSql(TPL_DB, read(version54(3)(FIX54)));
  expect(await drift(TPL_DB)).toEqual([]);
  expect(await counts(TPL_DB)).toEqual(expect.arrayContaining([{ id: 1, count: 1, roots: 1, rows: 3 }, { id: 2, count: 32, roots: 32, rows: 33 }]));

  // ③ p3-54 화면 Step 4~7 — 끝 판(code/p3-54)의 서버에 같은 요청을 같은 차례로
  await withServer(base(), TPL_DB, async ({ base: url }) => {
    const tab = await loggedIn(url, 'jaehoon');
    for (const [postId, content, method] of SCREEN54) {
      if (method === 'DELETE') {
        const res = await tab.send('DELETE', `/api/v2/posts/${postId}/comments/${await commentIdOf(TPL_DB, content)}`);
        expect([content, res.status]).toEqual([content, 200]);
      } else {
        const res = await tab.send('POST', `/api/v2/posts/${postId}/comments`, { content });
        expect([content, res.status]).toEqual([content, 201]);
        await sleep(5);
      }
    }
  }, { port: PORT2 });
  expect(await drift(TPL_DB)).toEqual([]);
  expect((await onDb(TPL_DB, "SELECT nextval('posts_id_seq') AS n"))[0].n).toBe('26');
  await onDb(TPL_DB, "SELECT setval('posts_id_seq', 25)");
}, 300_000);

afterAll(async () => {
  for (const name of [GATE_DB, GATE2_DB, TPL_DB]) await dropDb(name);
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  if (process.env.P355_SEEN) writeFileSync(process.env.P355_SEEN, JSON.stringify(seen, null, 2));
});

/** 실패 봉투 — 새 주소의 { error: { code, message, path, timestamp } }. */
const v2Error = (code, message, path) => ({ error: { code, message, path, timestamp: expect.stringMatching(ISO) } });
const MSG = {
  COMMENT_NOT_FOUND: '그런 댓글은 없어요', REPLY_HAS_NO_REPLIES: '답글에는 답글이 없어요', CANNOT_REPLY_TO_REPLY: '답글에는 답글을 달 수 없어요',
  ROUTE_NOT_FOUND: '그런 주소는 없어요', VALIDATION_FAILED: '보낸 내용이 규칙에 안 맞아요', INVALID_CURSOR: '커서 값이 올바르지 않아요',
  POST_NOT_FOUND: '그런 게시물은 없어요', LOGIN_REQUIRED: '로그인이 필요해요', METHOD_NOT_ALLOWED: '이 주소는 그 HTTP 메서드를 받지 않아요',
};
const err = (code, path) => v2Error(code, MSG[code], path);
const keep = (r) => ({ title: r.title, statusLine: r.statusLine, contentType: r.headers?.['content-type'], body: r.rawBody });
const ids = (items) => items.map((c) => c.id);

// ── 축 ⓪ 판정 DB ─────────────────────────────────────────────────────────────────
describe('축 ⓪ 판정 DB — p3-54 를 마친 학생 DB', () => {
  it('🔴 1번 원댓글 4(minji 1 + jaehoon 42 · 43 · 44) · 행 6(답글 10 · 11) · 2번 원댓글 39 · 행 40(4번 댓글의 답글 12 하나) · 3번 2 · 숫자가 모두 맞다 · 시드 댓글 번호 그대로', async () => {
    expect(await counts(TPL_DB)).toEqual([
      { id: 1, count: 4, roots: 4, rows: 6 },
      { id: 2, count: 39, roots: 39, rows: 40 },
      { id: 3, count: 2, roots: 2, rows: 2 },
      { id: 4, count: 0, roots: 0, rows: 0 },
      { id: 5, count: 0, roots: 0, rows: 0 },
      { id: 9, count: 0, roots: 0, rows: 0 },
      { id: 14, count: 0, roots: 0, rows: 0 },
    ]);
    expect(await onDb(TPL_DB, `SELECT u.username, c.content FROM comments c JOIN users u ON u.id = c.author_id
      WHERE c.post_id = 1 AND c.parent_id IS NULL ORDER BY c.created_at, c.id`)).toEqual([
      { username: 'minji', content: '저도 가봤어요' }, { username: 'jaehoon', content: '노을 질 때 가면 더 예뻐요' },
      { username: 'jaehoon', content: '서버가 꺼져 있으면 어떻게 될까요' }, { username: 'jaehoon', content: '사진은 휴대폰으로 찍었어요' },
    ]);
    expect(await repliesOf(TPL_DB, 1)).toEqual([
      { id: 10, post_id: 1, username: 'jaehoon', content: '다음엔 같이 가요' }, { id: 11, post_id: 1, username: 'dahye', content: '저도 껴주세요' },
    ]);
    expect(await repliesOf(TPL_DB, 4)).toEqual([{ id: 12, post_id: 2, username: 'minji', content: '이번엔 잘 구워졌어요' }]);
    expect(await onDb(TPL_DB, 'SELECT count(*)::int AS n FROM comments WHERE parent_id IS NOT NULL')).toEqual([{ n: 3 }]);
    expect(await onDb(TPL_DB, 'SELECT c.id, c.post_id, c.parent_id, u.username, c.content FROM comments c JOIN users u ON u.id = c.author_id WHERE c.id <= 12 ORDER BY c.id'))
      .toEqual([
        { id: 1, post_id: 1, parent_id: null, username: 'minji', content: '저도 가봤어요' },
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
    // 2번 게시물의 원댓글 첫 페이지(20)는 4번부터 — 오래된 순으로 시드 넷이 맨 앞
    const firstPage = await onDb(TPL_DB, 'SELECT id FROM comments WHERE post_id = 2 AND parent_id IS NULL ORDER BY created_at, id LIMIT 4');
    expect(firstPage.map((r) => r.id)).toEqual([4, 5, 6, 7]);
    expect(await idOf(TPL_DB, 'jaehoon')).toBe(2);
    // 트랙 progress/reading-tools/next/reset-p3-55.example.sh(7ec4a45)의 재현과 같은 차례로 만들었으니 번호까지 같다 —
    // 1번 게시물의 jaehoon 원댓글 42 · 43 · 44 · 지운 댓글 2 · 3 · 41 · 52 · 48행(원댓글 45 · 답글 3) · 다음 댓글 번호 53
    expect(await onDb(TPL_DB, "SELECT id FROM comments WHERE post_id = 1 AND parent_id IS NULL AND author_id = 2 ORDER BY id")).toEqual([{ id: 42 }, { id: 43 }, { id: 44 }]);
    const existing = new Set((await onDb(TPL_DB, 'SELECT id FROM comments')).map((r) => r.id));
    expect(Array.from({ length: 52 }, (_, i) => i + 1).filter((id) => !existing.has(id))).toEqual([2, 3, 41, 52]);
    expect(await onDb(TPL_DB, 'SELECT count(*)::int AS rows, count(*) FILTER (WHERE parent_id IS NULL)::int AS roots FROM comments')).toEqual([{ rows: 48, roots: 45 }]);
    expect(await onDb(TPL_DB, 'SELECT last_value::int AS n FROM comments_id_seq')).toEqual([{ n: 52 }]);
    seen.tpl = { counts: await counts(TPL_DB), lastCommentId: (await onDb(TPL_DB, 'SELECT max(id) AS n FROM comments'))[0].n };
  });
});

// ── 축 ① Step 1 ────────────────────────────────────────────────────────────────
const R_LIST = '1번 게시물의 1번 댓글에 달린 답글';
const R_FIRST = '답글 첫 페이지 — 하나만';
const R_SECOND = '답글 둘째 페이지 — 받은 커서를 그대로 돌려준다';
const R_NONE = '없는 댓글의 답글';
const R_OTHER = '2번 게시물 주소로 1번 게시물 댓글의 답글';
const R_REPLY = '답글의 답글';
const STEP1_NEW = [
  [R_LIST, 'GET http://localhost:3000/api/v2/posts/1/comments/1/replies'],
  [R_FIRST, 'GET http://localhost:3000/api/v2/posts/1/comments/1/replies?limit=1'],
  [R_SECOND, 'GET http://localhost:3000/api/v2/posts/1/comments/1/replies?limit=1&cursor={{firstReplies.data.nextCursor}}'],
  [R_NONE, 'GET http://localhost:3000/api/v2/posts/1/comments/999/replies'],
  [R_OTHER, 'GET http://localhost:3000/api/v2/posts/2/comments/1/replies'],
  [R_REPLY, 'GET http://localhost:3000/api/v2/posts/1/comments/10/replies'],
];
const STEP1_TITLES = STEP1_NEW.map(([title]) => title);
/** Step 1 의 요청 여섯을 그 판으로 보낸다(로그인 한 번 먼저). */
const sendStep1 = async (label, db = GATE_DB) => {
  const source = compose(read(version(3)(HTTP_FILE)), [LOGIN, ...STEP1_TITLES]);
  return (await withServer(version(label), db, () => httpyac(source))).slice(1);
};

describe('축 ① Step 1 — 답글 목록 API', () => {
  it('🔴 강의 자료 판 — post-comments.http 끝에 요청 여섯(limit=1 첫 페이지에 # @name firstReplies) · 앞 블록은 시작 판 그대로 · 보내면 404 ROUTE_NOT_FOUND · 둘째 페이지는 커서가 없어 못 보낸다', async () => {
    const text = read(version('1a')(HTTP_FILE));
    const start = read(base()(HTTP_FILE));
    expect(text.startsWith(start)).toBe(true);
    const added = blocksOf(text.slice(start.length));
    expect(added.head).toBe('\n');
    expect(added.blocks.map((b) => [b.title, b.request])).toEqual(STEP1_NEW);
    expect(text.slice(start.length)).toContain(`### ${R_FIRST}\n# @name firstReplies\nGET `);
    await copyDb(GATE_DB);
    const runs = await sendStep1('1a');
    // 둘째 페이지는 보내지 못한다 — 첫 페이지가 404 라 {{firstReplies.data.nextCursor}} 를 채울 값이 없다(httpYac 이 요청을 안 보낸다)
    expect(runs.map((r) => [r.status ?? null, r.body?.error?.code ?? null])).toEqual([
      [404, 'ROUTE_NOT_FOUND'], [404, 'ROUTE_NOT_FOUND'], [null, null], [404, 'ROUTE_NOT_FOUND'], [404, 'ROUTE_NOT_FOUND'], [404, 'ROUTE_NOT_FOUND'],
    ]);
    expect(runs[0].body).toEqual(err('ROUTE_NOT_FOUND', '/api/v2/posts/1/comments/1/replies'));
    seen.step1a = { added: text.slice(start.length), first: keep(runs[0]) };
  }, 60_000);

  it('🔴 원댓글을 안 읽는 판 — 여섯 모두 200 · 1번 댓글 [10, 11] · limit=1 은 [10] → 커서로 [11] · 없는 댓글(999) [] · 답글 번호(10) [] · 2번 게시물 주소로도 1번 게시물의 답글 [10, 11]', async () => {
    await copyDb(GATE_DB);
    const runs = await sendStep1('1b');
    expect(runs.map((r) => r.status)).toEqual([200, 200, 200, 200, 200, 200]);
    expect(runs.map((r) => ids(r.body.data.items))).toEqual([[10, 11], [10], [11], [], [10, 11], []]);
    expect(runs.map((r) => r.body.data.hasNext)).toEqual([false, true, false, false, false, false]);
    expect(runs[3].body.data).toEqual({ items: [], hasNext: false, nextCursor: null });
    expect(runs[4].body).toEqual(runs[0].body);
    seen.step1b = runs.map(keep);
  }, 60_000);

  it('🔴 고친 판 — 1번 댓글 [10, 11](목록과 같은 일곱 필드 · replyCount·parentId 없음) · 커서로 이어진다 · 999 → 404 COMMENT_NOT_FOUND · 2번 게시물 주소로 → 404 COMMENT_NOT_FOUND · 10 → 400 REPLY_HAS_NO_REPLIES', async () => {
    await copyDb(GATE_DB);
    const runs = await sendStep1(1);
    expect(runs.map((r) => r.status)).toEqual([200, 200, 200, 404, 404, 400]);
    expect(runs.slice(0, 3).map((r) => ids(r.body.data.items))).toEqual([[10, 11], [10], [11]]);
    expect(Object.keys(runs[0].body)).toEqual(['data']);
    expect(Object.keys(runs[0].body.data)).toEqual(['items', 'hasNext', 'nextCursor']);
    for (const item of runs[0].body.data.items) expect(Object.keys(item)).toEqual(FIELDS);
    expect(runs[0].body.data.items).toEqual([
      expect.objectContaining({ id: 10, authorId: 2, content: '다음엔 같이 가요', username: 'jaehoon', profileImage: 'https://picsum.photos/seed/jaehoon/40/40' }),
      expect.objectContaining({ id: 11, content: '저도 껴주세요', username: 'dahye' }),
    ]);
    expect(runs[0].body.data.items.every((c) => ISO.test(c.createdAt))).toBe(true);
    // 커서는 마지막 답글의 { createdAt, id } 를 base64url 로 — 원댓글 목록과 같은 꼴
    const cursor = JSON.parse(Buffer.from(runs[1].body.data.nextCursor, 'base64url').toString());
    expect(cursor).toEqual({ createdAt: runs[0].body.data.items[0].createdAt, id: 10 });
    expect(runs[2].body.data).toMatchObject({ hasNext: false, nextCursor: null });
    expect(runs[3].body).toEqual(err('COMMENT_NOT_FOUND', '/api/v2/posts/1/comments/999/replies'));
    expect(runs[4].body).toEqual(err('COMMENT_NOT_FOUND', '/api/v2/posts/2/comments/1/replies'));
    expect(runs[5].body).toEqual(err('REPLY_HAS_NO_REPLIES', '/api/v2/posts/1/comments/10/replies'));
    expect(await counts(GATE_DB)).toEqual(await counts(TPL_DB));
    seen.step1 = runs.map(keep);
  }, 60_000);

  it('🔴 고친 판 — 답글이 없는 원댓글(5) 200 [] · 없는 게시물 404 COMMENT_NOT_FOUND · 숫자가 아닌 번호 404 · limit 0 · 51 · 1.5 · abc 400 VALIDATION_FAILED · 잘못된 커서 400 INVALID_CURSOR · 로그인 없이 401 · POST · DELETE 405 Allow: GET', async () => {
    await copyDb(GATE_DB);
    const out = await withServer(version(1), GATE_DB, async ({ base: url }) => {
      const tab = await loggedIn(url, 'jaehoon');
      const o = {};
      for (const [key, path] of [
        ['empty', '/api/v2/posts/2/comments/5/replies'], ['noPost', '/api/v2/posts/99/comments/1/replies'], ['word', '/api/v2/posts/1/comments/abc/replies'],
        ['limit0', '/api/v2/posts/1/comments/1/replies?limit=0'], ['limit51', '/api/v2/posts/1/comments/1/replies?limit=51'],
        ['limitHalf', '/api/v2/posts/1/comments/1/replies?limit=1.5'], ['limitWord', '/api/v2/posts/1/comments/1/replies?limit=abc'],
        ['limit50', '/api/v2/posts/1/comments/1/replies?limit=50'], ['badCursor', '/api/v2/posts/1/comments/1/replies?cursor=abc'],
      ]) o[key] = await tab.get(path);
      o.post = await tab.send('POST', '/api/v2/posts/1/comments/1/replies', { content: '여기로 달면' });
      o.del = await tab.send('DELETE', '/api/v2/posts/1/comments/1/replies');
      o.anon = await browser(url).get('/api/v2/posts/1/comments/1/replies');
      return o;
    });
    const brief = Object.fromEntries(Object.entries(out).map(([k, r]) => [k, [r.status, r.body.error?.code ?? null]]));
    expect(brief).toEqual({
      empty: [200, null], noPost: [404, 'COMMENT_NOT_FOUND'], word: [404, 'COMMENT_NOT_FOUND'],
      limit0: [400, 'VALIDATION_FAILED'], limit51: [400, 'VALIDATION_FAILED'], limitHalf: [400, 'VALIDATION_FAILED'], limitWord: [400, 'VALIDATION_FAILED'],
      limit50: [200, null], badCursor: [400, 'INVALID_CURSOR'], post: [405, 'METHOD_NOT_ALLOWED'], del: [405, 'METHOD_NOT_ALLOWED'], anon: [401, 'LOGIN_REQUIRED'],
    });
    expect(out.empty.body.data).toEqual({ items: [], hasNext: false, nextCursor: null });
    expect([out.post.headers.get('allow'), out.del.headers.get('allow')]).toEqual(['GET', 'GET']);
    expect(out.limit0.body.error.details.properties.limit.errors).toEqual(['Too small: expected number to be >=1']);
    expect(await counts(GATE_DB)).toEqual(await counts(TPL_DB));
    seen.step1Cases = Object.fromEntries(Object.entries(out).map(([k, r]) => [k, { status: r.status, body: r.body }]));
  }, 60_000);

  it('🔴 고친 판 — 기본은 3개씩(4번 댓글에 답글 301 · SQL 뒤) · 끝까지 이으면 301 · 같은 시각이면 번호가 작은 것이 먼저이고 커서가 그 사이에서도 이어진다', async () => {
    await copyDb(GATE_DB);
    await runSql(GATE_DB, read(version(3)(SQL_FILE)));
    // 같은 시각 셋 — 답글 셋째·넷째·다섯째를 둘째와 같은 시각으로
    const four = (await repliesOf(GATE_DB, 4)).map((r) => r.id);
    await onDb(GATE_DB, 'UPDATE comments SET created_at = (SELECT created_at FROM comments WHERE id = $1) WHERE id = ANY($2)', [four[1], four.slice(2, 5)]);
    const out = await withServer(version(1), GATE_DB, async ({ base: url }) => {
      const tab = await loggedIn(url, 'jaehoon');
      const pages = [];
      let cursor = null;
      for (let turn = 0; turn < 200; turn += 1) {
        const res = await tab.get(`/api/v2/posts/2/comments/4/replies${cursor === null ? '' : `?cursor=${cursor}`}`);
        expect(res.status).toBe(200);
        pages.push(ids(res.body.data.items));
        if (res.body.data.nextCursor === null) break;
        cursor = res.body.data.nextCursor;
      }
      return pages;
    });
    expect(out[0]).toEqual(four.slice(0, 3));
    expect(out.slice(0, -1).every((p) => p.length === 3)).toBe(true);
    expect([out.length, out.at(-1).length]).toEqual([101, 1]);
    expect(out.flat()).toEqual(four);
    expect(four[0]).toBe(12);
    seen.step1Default = { pages: out.length, first: out[0], second: out[1] };
  }, 90_000);

  it('🔴 쿼리 로그 — 원댓글 안 읽는 판은 답글 · 글쓴이 두 줄 · 고친 판은 원댓글 찾기(id 와 post_id) · 답글 · 글쓴이 세 줄 · 400 · 404 는 찾기에서 멈춘다', async () => {
    await copyDb(GATE_DB);
    const naive = await queriesOfSend(version('1b'), GATE_DB, 'GET', '/api/v2/posts/1/comments/1/replies');
    const fixed = await queriesOfSend(version(1), GATE_DB, 'GET', '/api/v2/posts/1/comments/1/replies');
    const reply = await queriesOfSend(version(1), GATE_DB, 'GET', '/api/v2/posts/1/comments/10/replies');
    const other = await queriesOfSend(version(1), GATE_DB, 'GET', '/api/v2/posts/2/comments/1/replies');
    expect(naive.lines).toHaveLength(2);
    expect(naive.lines[0]).toMatch(/FROM "public"\."comments" WHERE "public"\."comments"\."parent_id" = \$1 ORDER BY/);
    expect(naive.lines[1]).toMatch(/FROM "public"\."users"/);
    expect(fixed.lines).toHaveLength(3);
    expect(fixed.lines[0]).toMatch(/"public"\."comments"\."id" = \$1 AND "public"\."comments"\."post_id" = \$2/);
    expect(fixed.lines[0]).toMatch(/^prisma:query SELECT "public"\."comments"\."id", "public"\."comments"\."parent_id" FROM "public"\."comments" WHERE/);
    expect(fixed.lines.slice(1)).toEqual(naive.lines);
    expect([reply.status, reply.lines.length, other.status, other.lines.length]).toEqual([400, 1, 404, 1]);
    seen.step1Queries = { naive: naive.lines, fixed: fixed.lines, reply: reply.lines, other: other.lines };
  }, 90_000);
});

// ── 축 ② Step 2 ────────────────────────────────────────────────────────────────
const LIST20 = '2번 게시물의 댓글 — 모달이 받는 첫 페이지';
describe('축 ② Step 2 — 원댓글 목록에 답글을 실을까, 개수만 실을까', () => {
  it('🔴 강의 자료 — SQL 파일 꼴(경로 주석 · 표준 SQL 만 · INSERT 하나 + 확인 SELECT 하나 · comment_count 를 고치지 않는다) · .http 끝에 한 블록(limit=20)', () => {
    const sql = read(version('2a')(SQL_FILE));
    expect(sql.split('\n')[0]).toBe(`-- ~/instagram-api/${SQL_FILE}`);
    expect(sql.split('\n').filter((line) => /^\s*\\/.test(line))).toEqual([]);
    expect(sql).not.toMatch(/BEGIN|COMMIT|TRANSACTION|\bUPDATE\s/);
    const statements = sql.split('\n').filter((line) => !line.startsWith('--')).join('\n').split(';').map((one) => one.trim()).filter(Boolean);
    expect(statements.map((one) => one.split(/\s/)[0])).toEqual(['INSERT', 'SELECT']);
    expect(statements[0]).toMatch(/generate_series\(1, 300\)/);
    const text = read(version('2a')(HTTP_FILE));
    const before = read(version(1)(HTTP_FILE));
    expect(text.slice(before.length)).toBe(`\n### ${LIST20}\nGET http://localhost:3000/api/v2/posts/2/comments?limit=20\n`);
    expect(text.startsWith(before)).toBe(true);
    seen.sql = sql;
  });

  it('🔴 SQL 실행 — 300행 · 4번 댓글의 답글 301 · comment_count 39 그대로(확인 SELECT 301 · 39 · 39) · 글쓴이 다섯이 돌아가며 · 1분 간격 · 마지막이 지금 · 번호는 시각 차례 · 게시물의 updated_at 그대로', async () => {
    await copyDb(GATE_DB);
    const before = await onDb(GATE_DB, 'SELECT id, comment_count, updated_at FROM posts ORDER BY id');
    const out = await runSql(GATE_DB, read(version(3)(SQL_FILE)));
    expect([out.length, out[0].command, out[0].rowCount, out[1].command]).toEqual([2, 'INSERT', 300, 'SELECT']);
    expect(out[1].rows).toEqual([{ replies: '301', comment_count: 39, root_comments: '39' }]);
    expect(await onDb(GATE_DB, 'SELECT id, comment_count, updated_at FROM posts ORDER BY id')).toEqual(before);
    expect(await drift(GATE_DB)).toEqual([]);
    const rows = await onDb(GATE_DB, `SELECT c.id, c.post_id, u.username, c.content, c.created_at, c.updated_at FROM comments c JOIN users u ON u.id = c.author_id
      WHERE c.parent_id = 4 AND c.id <> 12 ORDER BY c.created_at, c.id`);
    expect(rows).toHaveLength(300);
    expect(rows.every((r) => r.post_id === 2 && r.created_at.getTime() === r.updated_at.getTime())).toBe(true);
    expect(rows.slice(0, 10).map((r) => r.username)).toEqual(['minji', 'dahye', 'nayeon', 'seungwoo', 'jaehoon', 'minji', 'dahye', 'nayeon', 'seungwoo', 'jaehoon']);
    expect(new Set(rows.map((r) => r.content)).size).toBe(10);
    expect(rows.map((r) => r.id)).toEqual(rows.map((r) => r.id).slice().sort((a, b) => a - b));
    for (let i = 1; i < rows.length; i += 1) expect(rows[i].created_at.getTime() - rows[i - 1].created_at.getTime()).toBe(60_000);
    // 마지막 답글은 «지금» — DB 의 now() 와 비교한다(컬럼이 시간대 없는 TIMESTAMP 라 Node 시계와는 9시간이 갈린다)
    const [{ lag }] = await onDb(GATE_DB, 'SELECT extract(epoch FROM now()::timestamp(3) - max(created_at))::float AS lag FROM comments WHERE parent_id = 4');
    expect(lag).toBeGreaterThanOrEqual(0);
    expect(lag).toBeLessThan(10);
    seen.sqlRun = { insert: out[0].rowCount, check: out[1].rows, first: rows[0].content, last: rows.at(-1).content };
  }, 60_000);

  it('🔴 통째로 싣는 판 — 원댓글마다 replies(일곱 필드 · 오래된 순) · 1번 게시물은 minji 원댓글에 [10, 11] · SQL 뒤 2번 첫 페이지의 4번 댓글에 답글 301 · 나머지는 []', async () => {
    await copyDb(GATE_DB);
    const before = await withServer(version('2b'), GATE_DB, async ({ base: url }) => (await (await loggedIn(url, 'jaehoon')).get('/api/v2/posts/1/comments')).body.data);
    expect(before.items.map((c) => [c.id === 1 ? 1 : 'new', ids(c.replies)])).toEqual([[1, [10, 11]], ['new', []], ['new', []], ['new', []]]);
    expect(Object.keys(before.items[0])).toEqual([...FIELDS, 'replies']);
    for (const reply of before.items[0].replies) expect(Object.keys(reply)).toEqual(FIELDS);
    await runSql(GATE_DB, read(version(3)(SQL_FILE)));
    const after = await withServer(version('2b'), GATE_DB, async ({ base: url }) => (await (await loggedIn(url, 'jaehoon')).get('/api/v2/posts/2/comments?limit=20')).body.data);
    expect(after.items).toHaveLength(20);
    expect(after.items.map((c) => c.replies.length)).toEqual([301, ...Array(19).fill(0)]);
    expect(ids(after.items[0].replies)).toEqual((await repliesOf(GATE_DB, 4)).map((r) => r.id));
    seen.step2b = { post1: before.items.map((c) => ({ id: c.id, replies: ids(c.replies) })) };
  }, 60_000);

  it('🔴 _count 판 — 원댓글마다 replyCount(여덟째 필드) · replies 없음 · 1번 게시물 [2, 0, 0, 0] · SQL 뒤 2번 첫 페이지 [301, 0 × 19]', async () => {
    await copyDb(GATE_DB);
    const before = await withServer(version(2), GATE_DB, async ({ base: url }) => (await (await loggedIn(url, 'jaehoon')).get('/api/v2/posts/1/comments')).body.data);
    expect(before.items.map((c) => c.replyCount)).toEqual([2, 0, 0, 0]);
    for (const item of before.items) expect(Object.keys(item)).toEqual([...FIELDS, 'replyCount']);
    await runSql(GATE_DB, read(version(3)(SQL_FILE)));
    const after = await withServer(version(2), GATE_DB, async ({ base: url }) => (await (await loggedIn(url, 'jaehoon')).get('/api/v2/posts/2/comments?limit=20')).body.data);
    expect(after.items.map((c) => c.replyCount)).toEqual([301, ...Array(19).fill(0)]);
    seen.step2 = { post1: before.items.map((c) => ({ id: c.id, replyCount: c.replyCount })), first: after.items[0] };
  }, 60_000);

  it('🔎 실측 — SQL 뒤 판정 DB 에서 jaehoon 이 GET /api/v2/posts/2/comments?limit=20 을 판마다 9번(첫 번째는 버린다) · 세 서버를 번갈아 · 응답 크기(바이트) · 시간(ms)', async () => {
    await copyDb(GATE_DB);
    await runSql(GATE_DB, read(version(3)(SQL_FILE)));
    const path = '/api/v2/posts/2/comments?limit=20';
    const out = await withServer(base(), GATE_DB, ({ base: a }) => withServer(version('2b'), GATE_DB, ({ base: b }) => withServer(version(2), GATE_DB, async ({ base: c }) => {
      const tabs = { start: await loggedIn(a, 'jaehoon'), embed: await loggedIn(b, 'jaehoon'), count: await loggedIn(c, 'jaehoon') };
      const m = { start: [], embed: [], count: [] };
      for (let turn = 0; turn < 9; turn += 1) {
        for (const key of Object.keys(tabs)) {
          const t = performance.now();
          const res = await tabs[key].get(path);
          const ms = performance.now() - t;
          expect(res.status).toBe(200);
          if (turn > 0) m[key].push({ ms: Math.round(ms * 10) / 10, bytes: Buffer.byteLength(res.text), length: Number(res.headers.get('content-length')) });
        }
      }
      return m;
    }, { port: PORT3 }), { port: PORT2 }), { port: PORT });
    const sum = (rows) => ({
      bytes: [...new Set(rows.map((r) => r.bytes))], length: [...new Set(rows.map((r) => r.length))],
      ms: [Math.min(...rows.map((r) => r.ms)), Math.max(...rows.map((r) => r.ms))], all: rows.map((r) => r.ms),
    });
    const report = Object.fromEntries(Object.entries(out).map(([k, rows]) => [k, sum(rows)]));
    console.log('[p3-55 실측 Step 2]', JSON.stringify(report));
    seen.measure = { setup: 'p355 판정 DB(p3-54 끝) + many-replies.sql · jaehoon 로그인 · 서버 셋 번갈아 · 9번 중 첫 번째 버림', path, report };
    for (const k of Object.keys(report)) {
      expect(report[k].bytes).toHaveLength(1);
      expect(report[k].length).toEqual(report[k].bytes);
    }
    expect(report.embed.bytes[0]).toBeGreaterThan(report.count.bytes[0] * 10);
    expect(report.count.bytes[0] - report.start.bytes[0]).toBe(20 * ',"replyCount":0'.length + (',"replyCount":301'.length - ',"replyCount":0'.length));
  }, 180_000);

  it('🔴 쿼리 로그 — 통째로 싣는 판은 원댓글 · 답글(parent_id IN …) · 글쓴이 · 답글의 글쓴이 · _count 판은 원댓글(COUNT 서브쿼리 — LEFT JOIN … GROUP BY) · 글쓴이 · 게시물 확인 줄은 둘 다 맨 앞', async () => {
    await copyDb(GATE_DB);
    await runSql(GATE_DB, read(version(3)(SQL_FILE)));
    const embed = await queriesOfSend(version('2b'), GATE_DB, 'GET', '/api/v2/posts/2/comments?limit=20');
    const count = await queriesOfSend(version(2), GATE_DB, 'GET', '/api/v2/posts/2/comments?limit=20');
    const start = await queriesOfSend(base(), GATE_DB, 'GET', '/api/v2/posts/2/comments?limit=20');
    expect(start.lines).toHaveLength(3);
    expect(embed.lines.length).toBeGreaterThan(start.lines.length);
    expect(count.lines).toHaveLength(3);
    expect(count.lines[0]).toBe(start.lines[0]);
    expect(count.lines[1]).toMatch(/COUNT\(\*\)/);
    expect(count.lines[1]).toMatch(/"parent_id"/);
    // Prisma 7 의 _count 는 «답글 수를 원댓글마다 따로 세는» 것이 아니라 comments 전체를 parent_id 로 묶어 센 표를 LEFT JOIN 한다
    expect(count.lines[1]).toContain('LEFT JOIN (SELECT "public"."comments"."parent_id", COUNT(*) AS "_aggr_count_replies" FROM "public"."comments" WHERE 1=1 GROUP BY "public"."comments"."parent_id")');
    expect(embed.lines.some((l) => /"parent_id" IN \(/.test(l))).toBe(true);
    seen.step2Queries = { start: start.lines, embed: embed.lines, count: count.lines };
  }, 120_000);
});

// ── 축 ③ Step 3 ────────────────────────────────────────────────────────────────
const C_ADD = '1번 댓글에 답글 달기';
const C_UNDO = '고치기 전 서버에서 원댓글로 달린 그 댓글 지우기';
const C_REPLY = '답글에 답글 달기';
const C_OTHER = '2번 게시물 주소로 1번 댓글에 답글 달기';
const C_CLEAN = '잘못 달린 답글 지우기';
const C_NONE = '없는 댓글에 답글 달기';
const C_WORD = 'parentId를 글자로 보낸 답글';
const ADD_TEXT = '@minji 저녁에 가면 노을도 보여요';
const OTHER_TEXT = '@minji 저도 가 보고 싶어요';
const STEP3_NEW = [
  [C_ADD, 'POST http://localhost:3000/api/v2/posts/1/comments'],
  [C_UNDO, 'DELETE http://localhost:3000/api/v2/posts/1/comments/{{firstReply.data.comment.id}}'],
  [C_REPLY, 'POST http://localhost:3000/api/v2/posts/1/comments'],
  [C_OTHER, 'POST http://localhost:3000/api/v2/posts/2/comments'],
  [C_CLEAN, 'DELETE http://localhost:3000/api/v2/posts/2/comments/{{misplaced.data.comment.id}}'],
  [C_NONE, 'POST http://localhost:3000/api/v2/posts/1/comments'],
  [C_WORD, 'POST http://localhost:3000/api/v2/posts/1/comments'],
];
const send3 = async (label, titles, db = GATE_DB) => {
  const source = compose(read(version(3)(HTTP_FILE)), [LOGIN, ...titles]);
  return (await withServer(version(label), db, () => httpyac(source))).slice(1);
};

describe('축 ③ Step 3 — 답글 달기 API', () => {
  it('🔴 강의 자료 판 — .http 끝에 요청 일곱(본문 parentId · firstReply · misplaced 에 # @name) · 앞 블록은 Step 2 그대로 · 이 판은 parentId 를 버린다 — 1번 댓글에 단 답글이 원댓글로 달리고 숫자가 4 → 5 · 그 댓글 지우기 200 으로 4', async () => {
    const text = read(version('3a')(HTTP_FILE));
    const before = read(version(2)(HTTP_FILE));
    expect(text.startsWith(before)).toBe(true);
    const added = blocksOf(text.slice(before.length));
    expect(added.blocks.map((b) => [b.title, b.request])).toEqual(STEP3_NEW);
    const bodyOf = (title) => {
      const block = blockTexts(text).find((b) => b.title === title).text;
      return block.includes('{\n') ? JSON.parse(block.slice(block.indexOf('{\n'), block.lastIndexOf('}') + 1)) : null;
    };
    expect([C_ADD, C_UNDO, C_REPLY, C_OTHER, C_CLEAN, C_NONE, C_WORD].map(bodyOf)).toEqual([
      { content: ADD_TEXT, parentId: 1 }, null, { content: '@dahye 다음엔 셋이 가요', parentId: 11 }, { content: OTHER_TEXT, parentId: 1 }, null,
      { content: '이 댓글에도 답글을 달아요', parentId: 999 }, { content: '번호를 글자로 보내요', parentId: '1' },
    ]);
    expect(text).toContain(`### ${C_OTHER}\n# @name misplaced\nPOST `);
    expect(text).toContain(`### ${C_ADD}\n# @name firstReply\nPOST `);
    await copyDb(GATE_DB);
    const runs = await send3('3a', [C_ADD, POST1, R_LIST, C_UNDO, POST1]);
    expect(runs.map((r) => r.status)).toEqual([201, 200, 200, 200, 200]);
    expect(Object.keys(runs[0].body.data.comment)).toEqual([...FIELDS]);
    expect(runs[0].body.data.commentCount).toBe(5);
    expect(runs[1].body.data.commentCount).toBe(5);
    expect(ids(runs[2].body.data.items)).toEqual([10, 11]);
    // 지우기 — jaehoon 이 단 댓글이라 200 · 원댓글이었으니 숫자가 5 → 4
    expect(runs[3].body.data).toMatchObject({ comment: { id: runs[0].body.data.comment.id, content: ADD_TEXT }, commentCount: 4 });
    expect(runs[4].body.data.commentCount).toBe(4);
    expect(await onDb(GATE_DB, 'SELECT count(*)::int AS n FROM comments WHERE id = $1', [runs[0].body.data.comment.id])).toEqual([{ n: 0 }]);
    expect(await countOf(GATE_DB, 1)).toEqual({ id: 1, count: 4, roots: 4, rows: 6 });
    // 지우기 전에는 원댓글이었다 — 같은 요청을 지우지 않고 보내 DB 를 본다
    const kept = await send3('3a', [C_ADD]);
    expect(await onDb(GATE_DB, 'SELECT post_id, parent_id FROM comments WHERE id = $1', [kept[0].body.data.comment.id])).toEqual([{ post_id: 1, parent_id: null }]);
    expect(await countOf(GATE_DB, 1)).toEqual({ id: 1, count: 5, roots: 5, rows: 7 });
    // 글자로 보낸 parentId 도 버려져 원댓글로 달린다
    const word = await send3('3a', [C_WORD]);
    expect(word.map((r) => r.status)).toEqual([201]);
    expect(await countOf(GATE_DB, 1)).toEqual({ id: 1, count: 6, roots: 6, rows: 8 });
    seen.step3a = { added: text.slice(before.length), runs: runs.map(keep) };
  }, 90_000);

  it('🔴 번호로만 찾는 판 — 1번 댓글에 답글(201 · 일곱 필드 · commentCount 4 그대로) · 답글 목록 끝에 · 2번 게시물 주소로 1번 댓글에 달면 201 — 행은 post_id 2 · parent_id 1 · 1번 댓글의 답글 목록에 섞이고(기본 3개 첫 페이지 뒤) 2번 게시물의 원댓글 목록에는 안 나온다 · 지우면 200', async () => {
    await copyDb(GATE_DB);
    const runs = await send3('3b', [C_ADD, R_LIST, C_OTHER, R_LIST, R_OTHER, C_CLEAN, R_LIST]);
    expect(runs.map((r) => r.status)).toEqual([201, 200, 201, 200, 404, 200, 200]);
    const [add, list, other, mixed, , clean, after] = runs;
    expect(Object.keys(add.body.data)).toEqual(['comment', 'commentCount']);
    expect(Object.keys(add.body.data.comment)).toEqual(FIELDS);
    expect(add.body.data).toMatchObject({ comment: { content: ADD_TEXT, username: 'jaehoon', likeCount: 0 }, commentCount: 4 });
    expect(ids(list.body.data.items)).toEqual([10, 11, add.body.data.comment.id]);
    expect(other.body.data.commentCount).toBe(39);
    expect(await onDb(GATE_DB, 'SELECT count(*)::int AS n FROM comments WHERE id = $1', [other.body.data.comment.id])).toEqual([{ n: 0 }]);
    // 답글이 넷이 되어 기본 3개 첫 페이지에는 잘못 달린 답글이 안 보인다 — 다음 페이지가 있다(hasNext)
    expect([ids(mixed.body.data.items), mixed.body.data.hasNext]).toEqual([[10, 11, add.body.data.comment.id], true]);
    expect(clean.body.data).toMatchObject({ comment: { id: other.body.data.comment.id }, commentCount: 39 });
    expect([ids(after.body.data.items), after.body.data.hasNext]).toEqual([[10, 11, add.body.data.comment.id], false]);
    expect(await drift(GATE_DB)).toEqual([]);
    expect(await countOf(GATE_DB, 1)).toEqual({ id: 1, count: 4, roots: 4, rows: 7 });
    // 지우기 전의 행 — 2번 게시물에 있고 1번 게시물의 댓글을 가리킨다 · 2번 게시물의 원댓글 목록에는 안 나온다(원댓글이 아니다)
    const left = await send3('3b', [C_OTHER]);
    expect(await onDb(GATE_DB, 'SELECT post_id, parent_id, content FROM comments WHERE id = $1', [left[0].body.data.comment.id]))
      .toEqual([{ post_id: 2, parent_id: 1, content: OTHER_TEXT }]);
    const shown = await withServer(version('3b'), GATE_DB, async ({ base: url }) => {
      const tab = await loggedIn(url, 'jaehoon');
      const one = await tab.get('/api/v2/posts/1/comments/1/replies?limit=10');
      const roots = [];
      for (const page of [await tab.get('/api/v2/posts/2/comments?limit=50')]) roots.push(...ids(page.body.data.items));
      return { one: ids(one.body.data.items), roots };
    });
    expect(shown.one).toEqual([10, 11, add.body.data.comment.id, left[0].body.data.comment.id]);
    expect(shown.roots).toHaveLength(39);
    expect(shown.roots).not.toContain(left[0].body.data.comment.id);
    expect(await countOf(GATE_DB, 2)).toEqual({ id: 2, count: 39, roots: 39, rows: 41 });
    seen.step3b = runs.map(keep);
  }, 90_000);

  it('🔴 번호로만 찾는 판 — 답글에 달면 400 CANNOT_REPLY_TO_REPLY · 없는 댓글 404 COMMENT_NOT_FOUND · 글자로 보낸 parentId 400 VALIDATION_FAILED · 원댓글 달기는 그대로(replyCount 0 · 숫자 +1)', async () => {
    await copyDb(GATE_DB);
    const runs = await send3('3b', [C_REPLY, C_NONE, C_WORD]);
    expect(runs.map((r) => r.status)).toEqual([400, 404, 400]);
    expect(runs[0].body).toEqual(err('CANNOT_REPLY_TO_REPLY', '/api/v2/posts/1/comments'));
    expect(runs[1].body).toEqual(err('COMMENT_NOT_FOUND', '/api/v2/posts/1/comments'));
    expect(runs[2].body).toMatchObject({ error: { code: 'VALIDATION_FAILED', details: { properties: { parentId: { errors: ['Invalid input: expected number, received string'] } } } } });
    expect(await counts(GATE_DB)).toEqual(await counts(TPL_DB));
    const root = await withServer(version('3b'), GATE_DB, async ({ base: url }) => (await loggedIn(url, 'jaehoon')).send('POST', '/api/v2/posts/1/comments', { content: '원댓글이에요' }));
    expect(root.status).toBe(201);
    expect(Object.keys(root.body.data.comment)).toEqual([...FIELDS, 'replyCount']);
    expect(root.body.data).toMatchObject({ comment: { replyCount: 0 }, commentCount: 5 });
    seen.step3bCases = runs.map(keep);
  }, 90_000);

  it('🔴 고친 판 — .http 의 Step 3 요청을 차례로: 1번 댓글에 201(4 그대로) · 답글에 400 · 2번 게시물 주소로 404 COMMENT_NOT_FOUND(행 없음) · 지우기는 번호를 채울 값이 없어 못 보낸다 · 없는 댓글 404 · 글자 400 · 숫자 = 원댓글', async () => {
    await copyDb(GATE_DB);
    const rowsBefore = (await onDb(GATE_DB, 'SELECT count(*)::int AS n FROM comments'))[0].n;
    const runs = await send3('3c', [C_ADD, C_REPLY, C_OTHER, C_NONE, C_WORD, R_LIST, POST1]);
    expect(runs.map((r) => r.status)).toEqual([201, 400, 404, 404, 400, 200, 200]);
    expect(runs[2].body).toEqual(err('COMMENT_NOT_FOUND', '/api/v2/posts/2/comments'));
    expect(ids(runs[5].body.data.items)).toEqual([10, 11, runs[0].body.data.comment.id]);
    expect(runs[6].body.data.commentCount).toBe(4);
    expect((await onDb(GATE_DB, 'SELECT count(*)::int AS n FROM comments'))[0].n).toBe(rowsBefore + 1);
    expect(await drift(GATE_DB)).toEqual([]);
    // 같은 .http 의 «잘못 달린 답글 지우기» — misplaced 가 404 라 주소의 번호가 비어 있다
    const clean = await send3('3c', [C_OTHER, C_CLEAN]);
    expect(clean.map((r) => r.status ?? null)).toEqual([404, null]);
    seen.step3c = runs.map(keep);
    seen.step3cClean = clean.map(keep);
  }, 90_000);

  it('🔴 고친 판 — 경우들: 없는 게시물 404 POST_NOT_FOUND · parentId 0 · -1 · 1.5 · 2147483648 · null 400 · 3번 게시물의 원댓글(8)에 3번 주소로 201 · 다른 사람(seoyeon)도 단다 · 1번 원댓글 목록의 replyCount 2 → 3 · 1번 게시물의 commentCount 4 그대로', async () => {
    await copyDb(GATE_DB);
    const out = await withServer(version('3c'), GATE_DB, async ({ base: url }) => {
      const tab = await loggedIn(url, 'jaehoon');
      const o = {};
      o.noPost = await tab.send('POST', '/api/v2/posts/99/comments', { content: '답글', parentId: 1 });
      for (const [key, parentId] of [['zero', 0], ['minus', -1], ['half', 1.5], ['big', 2147483648], ['nul', null]]) o[key] = await tab.send('POST', '/api/v2/posts/1/comments', { content: '답글', parentId });
      o.three = await tab.send('POST', '/api/v2/posts/3/comments', { content: '저도 궁금해요', parentId: 8 });
      o.seoyeon = await (await loggedIn(url, 'seoyeon')).send('POST', '/api/v2/posts/1/comments', { content: '@minji 저도요', parentId: 1 });
      o.list = await tab.get('/api/v2/posts/1/comments');
      o.post1 = await tab.get('/api/v2/posts/1');
      o.post3 = await tab.get('/api/v2/posts/3');
      return o;
    });
    expect(Object.fromEntries(Object.entries(out).map(([k, r]) => [k, [r.status, r.body.error?.code ?? null]]))).toEqual({
      noPost: [404, 'POST_NOT_FOUND'], zero: [400, 'VALIDATION_FAILED'], minus: [400, 'VALIDATION_FAILED'], half: [400, 'VALIDATION_FAILED'],
      big: [400, 'VALIDATION_FAILED'], nul: [400, 'VALIDATION_FAILED'], three: [201, null], seoyeon: [201, null], list: [200, null], post1: [200, null], post3: [200, null],
    });
    expect(out.three.body.data.commentCount).toBe(2);
    expect(out.seoyeon.body.data.comment).toMatchObject({ username: 'seoyeon', content: '@minji 저도요' });
    expect(out.list.body.data.items.map((c) => c.replyCount)).toEqual([3, 0, 0, 0]);
    expect([out.post1.body.data.commentCount, out.post3.body.data.commentCount]).toEqual([4, 2]);
    expect(await drift(GATE_DB)).toEqual([]);
    expect(await repliesOf(GATE_DB, 8)).toEqual([expect.objectContaining({ post_id: 3, username: 'jaehoon', content: '저도 궁금해요' })]);
    seen.step3cCases = Object.fromEntries(Object.entries(out).map(([k, r]) => [k, { status: r.status, body: r.body }]));
  }, 90_000);

  it('🔴 쿼리 로그 — 고친 판 답글 달기는 게시물 확인 · 원댓글 찾기(id 와 post_id) · 넣기 · 넣은 댓글 · 글쓴이 · 숫자 SQL · 숫자 읽기 · COMMIT · 번호로만 찾는 판은 찾기에 post_id 가 없다 · 400 은 찾기에서 멈춘다', async () => {
    await copyDb(GATE_DB);
    const fixed = await queriesOfSend(version('3c'), GATE_DB, 'POST', '/api/v2/posts/1/comments', { content: '쿼리를 봐요', parentId: 1 });
    const naive = await queriesOfSend(version('3b'), GATE_DB, 'POST', '/api/v2/posts/1/comments', { content: '쿼리를 봐요', parentId: 1 });
    const reply = await queriesOfSend(version('3c'), GATE_DB, 'POST', '/api/v2/posts/1/comments', { content: '쿼리를 봐요', parentId: 10 });
    expect(fixed.status).toBe(201);
    expect(fixed.lines[1]).toMatch(/"comments"\."id" = \$1 AND "public"\."comments"\."post_id" = \$2/);
    expect(naive.lines[1]).toMatch(/WHERE \("public"\."comments"\."id" = \$1 AND 1=1\)|WHERE "public"\."comments"\."id" = \$1/);
    expect(naive.lines[1]).not.toMatch(/post_id/);
    expect(fixed.lines.at(-1)).toMatch(/COMMIT/);
    expect(fixed.raw).toContain('UPDATE posts SET comment_count = comment_count + $1 WHERE id = $2');
    expect([reply.status, reply.lines.length]).toEqual([400, 2]);
    seen.step3Queries = { fixed: fixed.lines, naive: naive.lines, reply: reply.lines };
  }, 90_000);

  it('🔴 문서 — /api/docs 가 뜨고 /api/openapi.json 에 답글 목록 주소(GET 만) · 댓글 달기 본문의 parentId · 새 에러 코드 둘은 MESSAGES 에 있다 · RootComment(replyCount) · ReplyPage', async () => {
    await copyDb(GATE_DB);
    const out = await withServer(version(3), GATE_DB, async ({ base: url }) => {
      const docs = await fetch(`${url}/api/docs/`);
      const spec = await (await fetch(`${url}/api/openapi.json`)).json();
      return { docs: docs.status, spec };
    });
    expect(out.docs).toBe(200);
    const replies = out.spec.paths['/api/v2/posts/{id}/comments/{commentId}/replies'];
    expect(Object.keys(replies)).toEqual(['parameters', 'get']);
    expect(replies.get.parameters.map((p) => [p.name, p.description])).toEqual([['limit', '한 페이지의 답글 수 — 없으면 3'], ['cursor', '앞 응답의 nextCursor 그대로']]);
    expect(replies.get.responses['400'].content['application/json'].schema.properties.error.properties.code.enum).toEqual(['VALIDATION_FAILED', 'INVALID_CURSOR', 'REPLY_HAS_NO_REPLIES']);
    const post = out.spec.paths['/api/v2/posts/{id}/comments'].post;
    expect(post.requestBody.content['application/json'].schema.properties.parentId).toMatchObject({ type: 'integer', exclusiveMinimum: 0 });
    expect(post.responses['400'].content['application/json'].schema.properties.error.properties.code.enum).toContain('CANNOT_REPLY_TO_REPLY');
    expect(post.responses['404'].content['application/json'].schema.properties.error.properties.code.enum).toEqual(['POST_NOT_FOUND', 'COMMENT_NOT_FOUND']);
    expect(out.spec.components.schemas.CommentPage.properties.items.items.$ref).toBe('#/components/schemas/RootComment');
    expect(out.spec.components.schemas.ReplyPage.properties.items.items.$ref).toBe('#/components/schemas/Comment');
    expect(out.spec.components.schemas.ErrorCode.enum).toEqual(expect.arrayContaining(['REPLY_HAS_NO_REPLIES', 'CANNOT_REPLY_TO_REPLY']));
  }, 60_000);

  it('🔎 고친 판 — .http 전체를 위에서부터 보내면(학생이 처음부터 차례로 누른 것과 같은 DB) 상태 줄 · 숫자 = 원댓글', async () => {
    await copyDb(GATE_DB);
    const runs = await withServer(version(3), GATE_DB, () => httpyac(read(version(3)(HTTP_FILE))));
    seen.fullHttp = runs.map((r) => [r.title, r.status]);
    expect(runs.slice(17).map((r) => [r.title, r.status ?? null])).toEqual([
      [R_LIST, 200], [R_FIRST, 200], [R_SECOND, 200], [R_NONE, 404], [R_OTHER, 404], [R_REPLY, 400], [LIST20, 200],
      [C_ADD, 201], [C_UNDO, 200], [C_REPLY, 400], [C_OTHER, 404], [C_CLEAN, null], [C_NONE, 404], [C_WORD, 400],
    ]);
    expect(await drift(GATE_DB)).toEqual([]);
  }, 90_000);
});

// ── 축 ④ 회귀 ─────────────────────────────────────────────────────────────────
describe('축 ④ 회귀 — 시작 판(code/p3-54)과 같다(replyCount 를 뺀 나머지)', () => {
  /** 댓글 목록 끝까지 · 게시물 목록 · 좋아요 · 잘못된 커서 · 원댓글 달기 · 지우기 — 실행마다 다른 값은 지운다. */
  const tour = async (from, db) => {
    await copyDb(db);
    return withServer(from, db, async ({ base: url }) => {
      const tab = await loggedIn(url, 'jaehoon');
      const pages = [];
      let cursor = null;
      for (let turn = 0; turn < 5; turn += 1) {
        const res = await tab.get(`/api/v2/posts/2/comments${cursor === null ? '' : `?cursor=${cursor}`}`);
        pages.push(res.body.data.items.map(({ replyCount, ...c }) => c));
        if (res.body.data.nextCursor === null) break;
        cursor = res.body.data.nextCursor;
      }
      const first = await tab.get('/api/v2/posts?limit=2');
      const second = await tab.get(`/api/v2/posts?limit=2&cursor=${first.body.data.nextCursor}`);
      const like = await tab.send('PUT', '/api/v2/posts/3/likes/me');
      const unlike = await tab.send('DELETE', '/api/v2/posts/3/likes/me');
      const badCursor = await tab.get('/api/v2/posts/2/comments?cursor=abc');
      const add = await tab.send('POST', '/api/v2/posts/3/comments', { content: '회귀를 봐요' });
      const { replyCount, ...added } = add.body.data.comment;
      const del = await tab.send('DELETE', `/api/v2/posts/3/comments/${added.id}`);
      const delReply = await tab.send('DELETE', '/api/v2/posts/1/comments/11');
      const scrub = ({ id, createdAt, ...rest }) => rest;
      return {
        pages, posts: [first.body, second.body], like: like.body, unlike: unlike.body,
        badCursor: { ...badCursor.body, error: { ...badCursor.body.error, timestamp: '<t>' } },
        add: [add.status, scrub(added), add.body.data.commentCount], del: [del.status, scrub(del.body.data.comment), del.body.data.commentCount],
        delReply: [delReply.status, delReply.body.data], replyCount,
      };
    });
  };
  it('🔴 댓글 목록(첫 페이지 20 · 둘째 19) · 게시물 목록 · 좋아요 · 잘못된 커서 · 원댓글 달기·지우기 · 답글 지우기가 시작 판과 한 글자도 같다 · 원댓글 달기 응답에만 replyCount: 0 이 더해졌다', async () => {
    const a = await tour(base(), GATE_DB);
    const b = await tour(version(3), GATE2_DB);
    expect(a.replyCount).toBeUndefined();
    expect(b.replyCount).toBe(0);
    delete a.replyCount;
    delete b.replyCount;
    expect(b).toEqual(a);
    expect(a.pages.map((p) => p.length)).toEqual([20, 19]);
    expect(a.delReply[1].commentCount).toBe(4);
  }, 90_000);
});

// ── 축 ⑤ 학생 파일 차이 ───────────────────────────────────────────────────────────
describe('축 ⑤ 학생 파일 차이 — 시작 판(code/p3-54)에서 각 판까지', () => {
  it('🔴 커밋 수와 차례 — Step 1 셋 · Step 2 셋 · Step 3 넷 · 1 → 2 → 3', () => {
    expect([1, 2, 3].map((n) => stepCommits(n).length)).toEqual([3, 3, 4]);
    const order = git(['log', '--format=%H', `${baseRef()}..${LINE}`]).trim().split('\n').reverse();
    const at = LABELS.map((label) => order.indexOf(versionRef(label)));
    expect(at.every((n) => n >= 0)).toBe(true);
    expect(at).toEqual(at.slice().sort((a, b) => a - b));
    expect(baseRef()).toBe(git(['rev-parse', 'code/p3-54']).trim());
    seen.commits = Object.fromEntries(LABELS.map((label) => [label, versionRef(label)]));
  });

  it('🔴 판마다 바뀐 학생 파일 — 교안이 «바꿀 파일» 로 말할 목록 · 새 패키지 · 스키마 · 마이그레이션 · app.js 그대로', () => {
    const r = (label) => versionRef(label);
    expect(changedStudentFiles(baseRef(), r('1a'))).toEqual([HTTP_FILE]);
    expect(changedStudentFiles(r('1a'), r('1b'))).toEqual(['controllers/commentController.js', 'routes/comments.js', 'schemas/commentSchema.js', 'services/commentService.js']);
    expect(changedStudentFiles(r('1b'), r(1))).toEqual(['errors.js', 'services/commentService.js']);
    expect(changedStudentFiles(r(1), r('2a'))).toEqual([SQL_FILE, HTTP_FILE]);
    expect(changedStudentFiles(r('2a'), r('2b'))).toEqual(['services/commentService.js']);
    expect(changedStudentFiles(r('2b'), r(2))).toEqual(['services/commentService.js']);
    expect(changedStudentFiles(r(2), r('3a'))).toEqual([HTTP_FILE]);
    expect(changedStudentFiles(r('3a'), r('3b'))).toEqual(['controllers/commentController.js', 'errors.js', 'schemas/commentSchema.js', 'services/commentService.js']);
    expect(changedStudentFiles(r('3b'), r('3c'))).toEqual(['services/commentService.js']);
    expect(changedStudentFiles(r('3c'), r(3))).toEqual(['docs/openapi.js']);
    for (const rel of ['package.json', 'package-lock.json', 'prisma/schema.prisma', 'app.js', 'middlewares/params.js', 'utils/cursor.js']) expect([rel, showAt(r(3), rel)]).toEqual([rel, showAt(baseRef(), rel)]);
    expect(readdirSync(version(3)('prisma/migrations'))).toEqual(readdirSync(base()('prisma/migrations')));
    // 고친 판 Step 3 은 찾는 조건 한 줄 + 그 위 주석 한 줄
    const diff = git(['diff', '-U0', r('3b'), r('3c'), '--', 'services/commentService.js']);
    expect(diff.split('\n').filter((line) => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line))).toEqual([
      '-    // 답글을 달 댓글을 찾는다. 없는 댓글이면 404 다.',
      "-    const parent = await prisma.comment.findUnique({ where: { id: parentId }, select: { parentId: true } });",
      '+    // 주소의 게시물에 달린 댓글에만 답글을 단다. 번호만으로 찾으면 다른 게시물의 댓글에도 답글이 달린다.',
      "+    const parent = await prisma.comment.findUnique({ where: { id: parentId, postId }, select: { parentId: true } });",
    ]);
    // Step 2 _count 판은 select 한 줄과 items 한 줄(+ 주석)
    const diff2 = git(['diff', '-U0', r('2b'), r(2), '--', 'services/commentService.js']);
    expect(diff2.split('\n').filter((line) => /^\+/.test(line) && !/^\+\+\+ /.test(line))).toEqual([
      '+    // 원댓글마다 달린 답글은 받지 않고 개수만 센다. 답글은 답글 목록 주소로 따로 받는다.',
      '+    select: { ...commentFields, _count: { select: { replies: true } } },',
      '+    // 센 개수는 _count 안에 들어 있어서 replyCount 로 꺼내 둔다.',
      '+    items: page.map(({ _count, ...comment }) => ({ ...flatten(comment), replyCount: _count.replies })),',
    ]);
    // 시작 판의 getComments 가 쓰던 afterCursor · encodeCursor · decodeCursor 를 답글 목록이 그대로 부른다(복사본 없음)
    const service = showAt(r(3), 'services/commentService.js');
    expect(service.match(/function afterCursor/g)).toHaveLength(1);
    expect(service.match(/afterCursor\(decodeCursor\(cursor\)\)/g)).toHaveLength(2);
    expect(showAt(r(3), 'services/commentService.js').includes("import { encodeCursor, decodeCursor } from '../utils/cursor.js';")).toBe(true);
    seen.diffs = Object.fromEntries(LABELS.slice(1).map((label, i) => [label, git(['diff', versionRef(LABELS[i]), versionRef(label), '--', ...STUDENT_FILES])]));
    seen.files = Object.fromEntries(['routes/comments.js', 'controllers/commentController.js', 'services/commentService.js', 'schemas/commentSchema.js', 'errors.js'].map((rel) => [rel, showAt(r(3), rel)]));
    for (const label of ['1b', 1, '2b', 2, '3b', '3c']) seen[`service${label}`] = showAt(r(label), 'services/commentService.js');
  });

  it('🔴 학생 파일에 내부 어휘가 없다 · 첫 줄 경로 주석 · 새 주석에 줄표·연결어미 뒤 쉼표·쓰지 않기로 한 낱말이 없다', () => {
    const to = versionRef(3);
    for (const rel of changedStudentFiles(baseRef(), to)) {
      const text = showAt(to, rel);
      expect([rel, /게이트|판정|TDD|Step \d|p3-\d\d|회차|스냅숏/.test(text.split('\n').slice(1).join('\n'))]).toEqual([rel, false]);
      if (rel.endsWith('.js')) expect([rel, text.split('\n')[0]]).toEqual([rel, `// ~/instagram-api/${rel}`]);
      if (rel.endsWith('.sql')) expect([rel, text.split('\n')[0]]).toEqual([rel, `-- ~/instagram-api/${rel}`]);
    }
    const added = (label) => git(['diff', baseRef(), versionRef(label), '--', ...STUDENT_FILES]).split('\n').filter((line) => line.startsWith('+') && !line.startsWith('+++'));
    const comments = [...new Set(LABELS.flatMap((label) => added(label)).filter((line) => /^\+\s*(\/\/|--)/.test(line) && !/^\+(\/\/|--) ~\//.test(line)))];
    expect(comments.length).toBeGreaterThan(15);
    expect(comments.filter((line) => /—|(서|고|라|면|는데|지만|니까|으니|므로|어|아),/.test(line))).toEqual([]);
    const banned = /자리|박다|박아|박힌|결[이을로의]|갈래|몸통|판[이을으]|겹|까닭|걸리|걸린|돌리|돌려(?!주|준|줄)|가르|갈리|재다|재서|벗기|되살|짝/;
    for (const label of LABELS) expect([label, added(label).filter((line) => banned.test(line))]).toEqual([label, []]);
    seen.comments = comments;
  });

  it('🔴 post-comments.http — 이 회차는 끝에 덧붙이기만 한다 · 학생 파일의 «2번 게시물에 댓글 달기» 본문(p3-54 Step 2 에서 바꿔 보낸 «크기가 손바닥만 하네요»)이 달라도 덧붙인 부분과 이 회차 요청은 그대로다', () => {
    const start = showAt(baseRef(), HTTP_FILE);
    const end = showAt(versionRef(3), HTTP_FILE);
    expect(end.startsWith(start)).toBe(true);
    const student = start.replace('"content": "한 입만 나눠 주세요"', '"content": "크기가 손바닥만 하네요"');
    expect(student).not.toBe(start);
    const studentEnd = student + end.slice(start.length);
    // 이 회차가 보내는 블록(Step 1~3)은 학생 파일과 코드베이스 파일에서 글자가 같다
    const titles = [...STEP1_TITLES, LIST20, ...STEP3_NEW.map(([title]) => title)];
    expect(compose(studentEnd, titles)).toBe(compose(end, titles));
    expect(blockTexts(studentEnd).find((b) => b.title === ADD54).text).toContain('크기가 손바닥만 하네요');
  });
});

// ── 축 ⑥ 학생 한 사람의 흐름 ─────────────────────────────────────────────────────
describe('축 ⑥ 학생 한 사람의 흐름 — 한 DB 에서 판을 차례로 갈아 끼우며 .http 를 교안 차례로 누른다', () => {
  it('🔎 Step 1(강의 자료 → 안 읽는 판 → 고친 판) → Step 2(목록 → SQL → 통째로 → _count) → Step 3(강의 자료 → 번호로만 → 고친 판) — 끝 DB 가 «Step 4 를 시작하는 학생 DB»', async () => {
    await copyDb(GATE_DB);
    const text = read(version(3)(HTTP_FILE));
    const send = async (label, titles) => {
      const runs = await withServer(version(label), GATE_DB, () => httpyac(compose(text, [LOGIN, ...titles])));
      return { runs: runs.slice(1).map((r) => ({ title: r.title, status: r.status })), bodies: runs.slice(1).map((r) => r.body), drift: await drift(GATE_DB) };
    };
    const flow = {};
    flow.step1a = await send('1a', STEP1_TITLES);
    flow.step1b = await send('1b', STEP1_TITLES);
    flow.step1 = await send(1, STEP1_TITLES);
    flow.step2a = await send('2a', [LIST20]);
    flow.sql = (await runSql(GATE_DB, read(version(3)(SQL_FILE))))[1].rows;
    flow.step2b = await send('2b', [LIST20]);
    flow.step2 = await send(2, [LIST20]);
    flow.step3a = await send('3a', [C_ADD, POST1, R_LIST, C_UNDO]);
    flow.step3b = await send('3b', [C_ADD, R_LIST, C_REPLY, C_OTHER, R_LIST, C_CLEAN, C_NONE, C_WORD]);
    flow.step3 = await send(3, [C_OTHER, C_NONE, C_REPLY, C_WORD, R_LIST, POST1]);
    const end = await counts(GATE_DB);
    expect(flow.step1a.runs.map((r) => r.status ?? null)).toEqual([404, 404, null, 404, 404, 404]);
    expect(flow.step1b.runs.map((r) => r.status)).toEqual([200, 200, 200, 200, 200, 200]);
    expect(flow.step1.runs.map((r) => r.status)).toEqual([200, 200, 200, 404, 404, 400]);
    expect(flow.sql).toEqual([{ replies: '301', comment_count: 39, root_comments: '39' }]);
    expect(flow.step2b.bodies[0].data.items[0].replies).toHaveLength(301);
    expect(flow.step2.bodies[0].data.items[0].replyCount).toBe(301);
    expect(flow.step3a.runs.map((r) => r.status)).toEqual([201, 200, 200, 200]);
    expect([flow.step3a.bodies[0].data.commentCount, flow.step3a.bodies[3].data.commentCount]).toEqual([5, 4]);
    expect(flow.step3b.runs.map((r) => r.status)).toEqual([201, 200, 400, 201, 200, 200, 404, 400]);
    expect(flow.step3.runs.map((r) => r.status)).toEqual([404, 404, 400, 400, 200, 200]);
    for (const step of Object.values(flow)) if (step.drift) expect(step.drift).toEqual([]);
    expect(end.filter((p) => p.id <= 3)).toEqual([
      { id: 1, count: 4, roots: 4, rows: 7 },
      { id: 2, count: 39, roots: 39, rows: 340 },
      { id: 3, count: 2, roots: 2, rows: 2 },
    ]);
    expect(await repliesOf(GATE_DB, 1)).toEqual([
      { id: 10, post_id: 1, username: 'jaehoon', content: '다음엔 같이 가요' }, { id: 11, post_id: 1, username: 'dahye', content: '저도 껴주세요' },
      expect.objectContaining({ post_id: 1, username: 'jaehoon', content: ADD_TEXT }),
    ]);
    // Step 3 강의 자료 판에서 원댓글로 달린 것은 학생이 지웠다 — 같은 글은 답글 하나만 남는다
    expect(await onDb(GATE_DB, 'SELECT post_id, parent_id FROM comments WHERE content = $1', [ADD_TEXT])).toEqual([{ post_id: 1, parent_id: 1 }]);
    expect(await onDb(GATE_DB, 'SELECT id FROM comments WHERE post_id = 1 AND parent_id IS NULL ORDER BY id')).toEqual([{ id: 1 }, { id: 42 }, { id: 43 }, { id: 44 }]);
    seen.flow = { ...Object.fromEntries(Object.entries(flow).map(([k, v]) => [k, v.runs ?? v])), end };
    seen.flowEnd = await onDb(GATE_DB, `SELECT c.id, c.post_id, c.parent_id, u.username, c.content FROM comments c JOIN users u ON u.id = c.author_id
      WHERE c.post_id = 1 OR (c.post_id = 2 AND c.parent_id IS NULL) ORDER BY c.post_id, c.created_at, c.id`);
  }, 240_000);
});
