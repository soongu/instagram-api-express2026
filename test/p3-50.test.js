// p3-50 「끝까지 못 간 올리기」 게이트 — 백엔드(교안 Step 4~8 · 직접 해보기 3)
// 내부 검증 전용 — 교안에 한 줄도 인용하지 않는다.
//
// `8-fullstack-features` 둘째 회차다(`curriculum.md` 「`p3-50` 착수 결정」 ①~⑧). Step 1~3 은 화면이라 백엔드 커밋이 없다.
// Step 마다의 판은 커밋 제목의 «(Step N)» 표식으로 꺼낸다(같은 표식이 여럿이면 가장 뒤 커밋). 백엔드의 시작 판은 `code/p3-48` 이다.
// 🔑 짓는 동안 `P350_WT=N` 을 주면 Step N 의 판을 커밋 대신 작업트리에서 읽는다(Red 를 실제 동작으로 보려고).
// 🔑 포트 — 수업 백엔드 3793 · 둘째 서버 3794. 🚨 3793 은 p3-31 판정(사진 화면)도 쓴다 — 두 파일을 함께 돌리지 않는다
//    (Express 5 는 포트가 물려 있어도 «기다리고 있어요» 를 찍고 끝나서, 요청이 남의 서버로 가 404 가 난다 — 실제로 한 번 겪었다).
// 🔑 `.http` 는 send-http.js 대신 httpYac CLI 로 보낸다 — 로그인 쿠키 단지 · `< ./photos/…` 파일 본문 · `{{uploaded.data.imageUrls[0]}}` 를
//    학생이 쓰는 도구 그대로 처리하게. 출력은 파일로 받는다(파이프로 받으면 64KB 에서 끊긴다).
// 🔑 DB — `p350_` 로 시작하는 것만 만들고 지운다.
//
// 축 ① Step 4 — photo-owner.http 를 httpYac 으로 · 사진 404 · jaehoon 게시물 imageUrls 그대로
// 축 ② Step 5 — 업로드 기록 테이블 · 이미 있는 사진 채우기 · 올리기가 기록을 남긴다 · 기록 쓰기 실패 · 시드
// 축 ③ Step 6 — 내가 올리고 아직 안 쓴 사진만 · 바깥 주소 · 동시 둘 · 스냅숏 둘
// 축 ④ Step 7 — 지울 때는 기록으로(세 경우 · 관리자)
// 축 ⑤ Step 8 — 아무 게시물에도 쓰이지 않은 사진 치우기 · 뜰 때 한 번 · 거부 처리
// 축 ⑥ 학생 파일 차이 — Step 마다 바뀐 학생 파일 목록(교안 인용 블록 대조는 교안 집필 뒤에 더한다)
// 축 ⑦ 직접 해보기 3
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, mkdtempSync, mkdirSync, rmSync, cpSync, symlinkSync, existsSync, readdirSync, writeFileSync, openSync, closeSync } from 'node:fs';
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
const TPL_DB = 'p350_tpl';
const GATE_DB = 'p350_gate';
const dbUrl = (name) => `postgresql://postgres:postgres@localhost:5432/${name}`;
const GATE_URL = dbUrl(GATE_DB);
// 아무도 안 듣는 포트 — 데이터베이스가 꺼진 서버를 흉내 낸다.
const DOWN_URL = 'postgresql://postgres:postgres@localhost:5499/p350_down';
const PORT = 3793;
const PORT2 = 3794;
const SITE = `http://localhost:${PORT}`;
const SECRET = 'q2Xh0v9bGm4RkT7sYp1wLc8nZf3uJd6eHa5iVo0rQyE';
const PROVIDER_ENV = {
  GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret', SITE_URL: SITE,
  KAKAO_CLIENT_ID: 'test-kakao', KAKAO_CLIENT_SECRET: 'test-kakao-secret',
  NAVER_CLIENT_ID: 'test-naver', NAVER_CLIENT_SECRET: 'test-naver-secret',
};
const env = { DATABASE_URL: GATE_URL, CORS_ORIGIN: 'http://localhost:3001', JWT_SECRET: SECRET, ...PROVIDER_ENV };
const STUDENT_FILES = ['app.js', 'db.js', 'errors.js', 'responses.js', 'routes', 'controllers', 'services', 'middlewares', 'schemas', 'strategies', 'docs', 'package.json', 'requests', 'seed.js', 'data', 'prisma', 'prisma.config.js', '.env.example'];
const BASE_REF = 'code/p3-48';
const UUID_FILE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|gif)$/;

const hasRef = (ref) => {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', ref], { cwd: P('.'), stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
};
const LINE = hasRef('refs/heads/code/p3-50') ? 'code/p3-50' : 'main';
const WT = process.env.P350_WT ? Number(process.env.P350_WT) : null;
const commitOf = (n) => {
  const log = execFileSync('git', ['log', '-n', '400', '--format=%H %s', LINE], { cwd: P('.'), encoding: 'utf8' });
  const hits = log.split('\n').filter((l) => / feat\(p3-50\): /.test(l) && l.endsWith(`(Step ${n})`));
  if (hits.length === 0) throw new Error(`(Step ${n}) 커밋이 없다`);
  return hits[0].split(' ')[0];
};
const dirs = [];
const refDirs = new Map();
/** 커밋(또는 브랜치) 하나를 임시 폴더에 풀어 둔다. */
const refDir = (ref) => {
  if (refDirs.has(ref)) return refDirs.get(ref);
  const dir = mkdtempSync(join(tmpdir(), 'p350-ref-'));
  const tar = execFileSync('git', ['archive', '--format=tar', ref], { cwd: P('.'), maxBuffer: 1 << 28 });
  execFileSync('tar', ['-x', '-C', dir], { input: tar });
  dirs.push(dir);
  const at = (rel) => join(dir, rel);
  refDirs.set(ref, at);
  return at;
};
/** Step N 의 판 — 3 이하는 지난 회차 북마크 그대로다(백엔드 커밋이 없다). */
const stepDir = (n) => {
  if (n === WT) return (rel) => P(rel);
  return n <= 3 ? refDir(BASE_REF) : refDir(commitOf(n));
};
/** Step N 의 커밋 — 작업트리에서 읽는 Step 이면 null(git diff 가 작업트리와 비교한다). */
const stepRef = (n) => (n === WT ? null : n <= 3 ? BASE_REF : commitOf(n));
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
const gate = (sql, params) => onDb(GATE_DB, sql, params);
const dropDb = (name) => admin(async (client) => {
  await kick(client, name);
  await client.query(`DROP DATABASE IF EXISTS ${name}`);
});
/** 템플릿 DB 를 복사한 판정 DB — `from` 판에 템플릿에 없는 마이그레이션이 있으면(Step 5 부터) 그것도 얹는다. */
const BASE_MIGRATIONS = new Set();
const newMigrations = (from) => readdirSync(from('prisma/migrations'))
  .filter((name) => name !== 'migration_lock.toml' && !BASE_MIGRATIONS.has(name)).sort();
const copyDb = async (name, template = TPL_DB) => {
  await admin(async (client) => {
    await kick(client, name);
    await client.query(`DROP DATABASE IF EXISTS ${name}`);
    await kick(client, template);
    await client.query(`CREATE DATABASE ${name} TEMPLATE ${template}`);
  });
};
const freshGate = async (from = stepDir(4)) => {
  await copyDb(GATE_DB);
  for (const name of newMigrations(from)) await gate(read(from(`prisma/migrations/${name}/migration.sql`)));
};
const count = async (table) => Number((await gate(`SELECT count(*) AS n FROM ${table}`))[0].n);
const userIdOf = async (username) => (await gate('SELECT id FROM users WHERE username = $1', [username]))[0]?.id;
/** 기록을 사람 이름과 함께 — 파일 이름 순. */
const uploadRows = async (db = GATE_DB) => (await onDb(db, `SELECT u.file_name, us.username AS uploader, u.post_id, u.created_at
  FROM uploads u JOIN users us ON us.id = u.uploader_id ORDER BY u.file_name`));

const replaceIn = (dir, rel, a, b) => {
  const text = read(join(dir, rel));
  if (text.split(a).length !== 2) throw new Error(`${rel} 에 바꿀 글자가 없거나 여럿이다: ${a}`);
  writeFileSync(join(dir, rel), text.replace(a, b));
};
const studentDir = (from, edit) => {
  const dir = mkdtempSync(join(tmpdir(), 'p350-srv-'));
  for (const name of STUDENT_FILES) {
    if (existsSync(from(name))) cpSync(from(name), join(dir, name), { recursive: true });
  }
  symlinkSync(P('node_modules'), join(dir, 'node_modules'));
  if (edit) edit(dir);
  dirs.push(dir);
  return dir;
};
const start = (dir, { port = PORT, extraEnv = {} } = {}) => {
  const all = { ...env, ...extraEnv, PORT: String(port) };
  return boot(join(dir, 'app.js'), { port, cwd: dir, env: all, ready: `${port}번 포트에서` });
};
const stop = (srv) => Promise.race([srv.stop(), sleep(500)]);
/** 그 판의 학생 파일 사본을 띄운다. `dir` 을 주면 그 폴더(사진이 남아 있는 폴더)를 그대로 띄운다. */
const withServer = async (from, fn, { edit, port = PORT, extraEnv, dir } = {}) => {
  const at = dir ?? studentDir(from, edit);
  const srv = await start(at, { port, extraEnv });
  try {
    return await fn({ ...srv, dir: at, base: `http://localhost:${port}` });
  } finally {
    await stop(srv);
  }
};
const filesIn = (dir) => (existsSync(join(dir, 'uploads')) ? readdirSync(join(dir, 'uploads')).sort() : []);

/** 쿠키를 기억하는 탭 하나 — 리다이렉트는 따라가지 않는다. */
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
      // Refresh 토큰 쿠키는 Path 가 /api/v2/auth 라 이 탭의 요청에는 안 싣는다 — Access 토큰만 기억한다.
      if (name !== 'accessToken') continue;
      if (value === '' || /Expires=Thu, 01 Jan 1970/.test(line)) jar.delete(name);
      else jar.set(name, value);
    }
    const text = await res.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = text; }
    return { status: res.status, headers: res.headers, body: parsed };
  };
  return {
    send,
    get: (path) => send('GET', path),
    post: (path, body) => send('POST', path, body),
    del: (path) => send('DELETE', path),
    login: (username, password = PASSWORDS[username]) => send('POST', '/api/v2/auth/login', { username, password }),
  };
};
// 학생 DB 에서 비밀번호가 있는 사람 — jaehoon 은 p3-40 의 set-password.js, seoyeon · doyun 은 p3-39 에 auth.http 로 가입.
// 🚨 시드의 «이름1234» 는 p3-40 의 확인용 DB 에만 들어갔다 — 학생 DB 의 다른 시드 사람은 password_hash 가 NULL 이다.
const PASSWORDS = { jaehoon: 'jaehoon1234', seoyeon: 'instagram1234', doyun: 'instagram1234' };
/** requests/auth.http 의 가입 블록 본문 그대로(seoyeon · doyun). */
const signupBodies = () => read(P('requests/auth.http')).split(/^### /m)
  .filter((block) => /^POST \S+\/auth\/signup$/m.test(block) && /"username": "(seoyeon|doyun)"/.test(block))
  .map((block) => JSON.parse(block.slice(block.indexOf('{'), block.lastIndexOf('}') + 1)));
/**
 * 판정 DB 를 학생 DB 처럼 — 시드 사람 가운데 jaehoon 말고는 비밀번호를 지우고, seoyeon · doyun 을 가입 API 로 넣는다.
 * `base` 는 그 DB 로 띄운 서버.
 */
const toStudentState = async (db, base) => {
  await onDb(db, "UPDATE users SET password_hash = NULL WHERE username <> 'jaehoon'");
  const bodies = signupBodies();
  expect(bodies.map((b) => b.username)).toEqual(['seoyeon', 'doyun']);
  for (const body of bodies) {
    const res = await fetch(`${base}/api/v2/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    expect(res.status).toBe(201);
  }
};
const photo = (name) => readFileSync(P(`requests/photos/${name}`));
/** 사진을 올린다 — `names` 는 requests/photos 의 파일 이름들. */
const upload = (tab, names, path = '/api/v2/uploads') => {
  const form = new FormData();
  for (const name of names) form.append('images', new Blob([photo(name)], { type: 'image/jpeg' }), name);
  return tab.send('POST', path, form);
};
const newPost = (tab, imageUrls, content = '게시물', path = '/api/v2/posts') => tab.post(path, { imageUrls, postAlt: content, content });
const fileOf = (url) => url.split('/').pop();
/** 로그인 없이 쓸 Access 토큰 — 데이터베이스를 안 보는 로그인 확인(requireLogin)을 그대로 지난다. */
const tokenFor = (userId, role = 'USER') => jwt.sign({ sid: randomUUID(), role }, SECRET, { subject: String(userId), expiresIn: 900, algorithm: 'HS256' });

/** httpYac CLI 로 `.http` 한 파일을 통째로 보낸다(`--all --json`) — 학생이 VS Code 에서 위에서부터 차례로 누르는 것과 같다. */
const httpyac = async (source, port = PORT) => {
  const dir = mkdtempSync(join(tmpdir(), 'p350-http-'));
  dirs.push(dir);
  cpSync(P('requests/photos'), join(dir, 'photos'), { recursive: true });
  writeFileSync(join(dir, 'send.http'), source.replaceAll('http://localhost:3000', `http://localhost:${port}`));
  // 🚨 출력을 파이프로 받으면 httpYac 이 64KB 에서 끊긴 채 끝난다(사진이 든 요청 본문까지 실려 크다) — 파일로 받는다.
  const fd = openSync(join(dir, 'out.json'), 'w');
  await new Promise((resolve, reject) => {
    const child = spawn(P('node_modules/.bin/httpyac'), ['send', 'send.http', '--all', '--json'], { cwd: dir, stdio: ['ignore', fd, 'inherit'] });
    child.on('error', reject);
    child.on('exit', resolve);
  });
  closeSync(fd);
  const stdout = read(join(dir, 'out.json'));
  const parse = (text) => {
    try { return JSON.parse(text); } catch { return text; }
  };
  return JSON.parse(stdout).requests.map((r) => ({ name: r.name, title: r.title, status: r.response?.statusCode, body: parse(r.response?.body), raw: r }));
};

/** 교안에 인용할 실측 글자 — `P350_SEEN=경로` 를 주면 파일로 남긴다(보고용). */
const seen = {};
const scrub = (text, dir) => text.replaceAll(`/private${dir}`, '~/instagram-api').replaceAll(dir, '~/instagram-api').replace(/\d+(\.\d+)?ms/g, 'Nms');

beforeAll(async () => {
  await admin(async (client) => {
    for (const name of [GATE_DB, TPL_DB]) {
      await kick(client, name);
      await client.query(`DROP DATABASE IF EXISTS ${name}`);
    }
    await client.query(`CREATE DATABASE ${TPL_DB}`);
  });
  // 템플릿은 지난 회차(code/p3-48)의 마이그레이션 + 시드 — Step 5 의 마이그레이션은 freshGate 가 그 판에서 얹는다.
  const base = stepDir(1);
  for (const dir of readdirSync(base('prisma/migrations')).filter((name) => name !== 'migration_lock.toml').sort()) {
    BASE_MIGRATIONS.add(dir);
    await onDb(TPL_DB, read(base(`prisma/migrations/${dir}/migration.sql`)));
  }
  const seedDir = studentDir(base);
  execFileSync(process.execPath, [join(seedDir, 'seed.js')], {
    cwd: seedDir, encoding: 'utf8', env: { ...process.env, DATABASE_URL: dbUrl(TPL_DB) },
  });
  await withServer(base, ({ base: url }) => toStudentState(TPL_DB, url), { port: PORT2, extraEnv: { DATABASE_URL: dbUrl(TPL_DB) } });
}, 120_000);

afterAll(async () => {
  for (const name of [GATE_DB, TPL_DB, 'p350_legacy_base', 'p350_legacy', 'p350_legacy2', 'p350_legacy3', 'p350_seed', 'p350_del6', 'p350_del7']) await dropDb(name);
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  if (process.env.P350_SEEN) writeFileSync(process.env.P350_SEEN, JSON.stringify(seen, null, 2));
});

// ── 축 ① Step 4 — 남의 사진 주소 ────────────────────────────────────────────────
describe('축 ① Step 4 — 남의 사진 주소로 게시물을 만들고 지우면', () => {
  it('🔴 바뀐 학생 파일은 새 requests/photo-owner.http 하나', () => {
    expect(changedStudentFiles(BASE_REF, stepRef(4))).toEqual(['requests/photo-owner.http']);
  });

  it('🔴 학생 DB 에서 시드 사람 minji 로 로그인하면 401 LOGIN_FAILED — 비밀번호가 있는 둘째 사람은 seoyeon', async () => {
    await freshGate(stepDir(4));
    const out = await withServer(stepDir(4), async ({ base }) => ({
      minji: await browser(base).login('minji', 'minji1234'),
      seoyeon: await browser(base).login('seoyeon'),
    }));
    expect([out.minji.status, out.minji.body.error.code]).toEqual([401, 'LOGIN_FAILED']);
    expect([out.seoyeon.status, out.seoyeon.body.data.username]).toEqual([200, 'seoyeon']);
    expect(read(stepDir(4)('requests/photo-owner.http'))).not.toContain('minji');
  }, 30_000);

  it('🔴 photo-owner.http 여덟 요청 — seoyeon 의 게시물 201 · 지우기 200 · 사진 404 · jaehoon 의 게시물은 같은 주소 그대로', async () => {
    await freshGate(stepDir(4));
    const out = await withServer(stepDir(4), async ({ dir }) => {
      const sent = await httpyac(read(stepDir(4)('requests/photo-owner.http')));
      return { sent, files: filesIn(dir) };
    });
    const { sent } = out;
    expect(sent.map((r) => [r.title, r.status])).toEqual([
      ['jaehoon으로 로그인', 200],
      ['사진 올리기', 201],
      ['그 사진으로 게시물 만들기', 201],
      ['seoyeon으로 로그인', 200],
      ['seoyeon이 jaehoon의 사진 주소로 게시물 만들기', 201],
      ['seoyeon이 그 게시물 지우기', 200],
      ['사진 열기', 404],
      ['jaehoon의 게시물 다시 보기', 200],
    ]);
    const url = sent[1].body.data.imageUrls[0];
    expect(fileOf(url)).toMatch(UUID_FILE);
    expect(sent[2].body.data).toMatchObject({ username: 'jaehoon', imageUrls: [url] });
    expect(sent[4].body.data).toMatchObject({ username: 'seoyeon', imageUrls: [url] });
    expect(sent[5].body.data).toMatchObject({ id: sent[4].body.data.id, username: 'seoyeon', imageUrls: [url] });
    // /uploads 는 /api/v2 밖이라 옛 모양의 404 다
    expect(sent[6].body).toEqual({ message: '그런 주소는 없어요' });
    expect(sent[7].body.data).toMatchObject({ id: sent[2].body.data.id, username: 'jaehoon', imageUrls: [url] });
    expect(out.files).toEqual([]);
    seen.step4 = sent.map((r) => ({ title: r.title, status: r.status, body: r.body }));
  }, 60_000);
});

// ── 축 ② Step 5 — 업로드 기록 테이블 ─────────────────────────────────────────────
const SHADOW_ENV = process.env.PRISMA_SCHEMA_ENGINE_BINARY ? { PRISMA_SCHEMA_ENGINE_BINARY: process.env.PRISMA_SCHEMA_ENGINE_BINARY } : {};
/** 학생 폴더에서 `npx prisma …` 를 친다 — 학생 화면에 나오는 글자(stdout + stderr)를 돌려준다. */
const prismaCli = async (dir, args, url) => {
  const childEnv = { ...process.env, ...SHADOW_ENV, DATABASE_URL: url };
  delete childEnv.NODE_ENV;
  delete childEnv.VITEST;
  try {
    const { stdout, stderr } = await execFileAsync(join(dir, 'node_modules/.bin/prisma'), args, { cwd: dir, encoding: 'utf8', env: childEnv });
    return { ok: true, out: `${stdout}${stderr}` };
  } catch (error) {
    return { ok: false, out: `${error.stdout}${error.stderr}` };
  }
};
/** 학생 폴더에서 `node seed.js` — 성공하면 출력, 실패하면 그 에러 글자. */
const runSeed = async (dir, url) => {
  const childEnv = { ...process.env, DATABASE_URL: url };
  delete childEnv.NODE_ENV;
  try {
    const { stdout } = await execFileAsync(process.execPath, ['seed.js'], { cwd: dir, encoding: 'utf8', env: childEnv });
    return { ok: true, out: stdout };
  } catch (error) {
    return { ok: false, out: `${error.stdout}${error.stderr}` };
  }
};
const LEGACY_BASE = 'p350_legacy_base';
/**
 * `p3-49` 끝 학생 DB 와 비슷한 상태를 Step 4 서버로 만든다 — 학생이 화면에서 하던 일을 API 로 한다.
 * 사람은 학생 DB 처럼 — 비밀번호가 있는 jaehoon · seoyeon(M) · doyun(D). M 으로 시작하는 게시물은 seoyeon 의 것이다.
 * A: jaehoon 이 올려 자기 게시물(J1) · seoyeon 이 같은 주소로(M1, 안 지움)
 * B: jaehoon 이 올려 자기 게시물 둘(J2 · J3)
 * C: jaehoon 이 올려 자기 게시물(J4) · seoyeon 이 같은 주소로 만들었다 지움 — 파일이 없다
 * D·E: seoyeon 이 두 장을 올려 게시물 하나(M3)
 * F: doyun 이 올리고 게시물을 안 만듦(파일만 있다)
 * 시드 게시물 다섯은 바깥 주소(https://picsum.photos/…)다.
 */
const buildLegacy = async () => {
  await dropDb(LEGACY_BASE);
  await admin((client) => client.query(`CREATE DATABASE ${LEGACY_BASE}`));
  const dir = studentDir(stepDir(4));
  const url = dbUrl(LEGACY_BASE);
  const deployed = await prismaCli(dir, ['migrate', 'deploy'], url);
  expect(deployed.ok, deployed.out).toBe(true);
  expect((await runSeed(dir, url)).out).toBe('사람 5명, 게시물 5개, 사진 8장, 댓글 9개, 답글 3개를 넣었어요.\n');
  const urls = await withServer(stepDir(4), async ({ base }) => {
    await toStudentState(LEGACY_BASE, base);
    const [j, m, d] = [browser(base), browser(base), browser(base)];
    for (const [tab, name] of [[j, 'jaehoon'], [m, 'seoyeon'], [d, 'doyun']]) expect((await tab.login(name)).status).toBe(200);
    const A = (await upload(j, ['beach.jpg'])).body.data.imageUrls[0];
    const J1 = (await newPost(j, [A], 'J1')).body.data.id;
    const M1 = (await newPost(m, [A], 'M1')).body.data.id;
    const B = (await upload(j, ['forest.jpg'])).body.data.imageUrls[0];
    const J2 = (await newPost(j, [B], 'J2')).body.data.id;
    const J3 = (await newPost(j, [B], 'J3')).body.data.id;
    const C = (await upload(j, ['beach.jpg'])).body.data.imageUrls[0];
    const J4 = (await newPost(j, [C], 'J4')).body.data.id;
    const M2 = (await newPost(m, [C], 'M2')).body.data.id;
    expect((await m.del(`/api/v2/posts/${M2}`)).status).toBe(200);
    const [D, E] = (await upload(m, ['beach.jpg', 'forest.jpg'])).body.data.imageUrls;
    const M3 = (await newPost(m, [D, E], 'M3')).body.data.id;
    const F = (await upload(d, ['forest.jpg'])).body.data.imageUrls[0];
    return { A, B, C, D, E, F, J1, M1, J2, J3, J4, M3 };
  }, { extraEnv: { DATABASE_URL: url }, dir });
  return { ...urls, dir, files: filesIn(dir) };
};
let legacy;
/** 옛 DB 는 한 번만 만든다 — 축 ② 와 축 ④ 가 함께 쓴다. */
const getLegacy = async () => {
  legacy ??= await buildLegacy();
  return legacy;
};
const postTime = async (db, id) => (await onDb(db, 'SELECT created_at FROM posts WHERE id = $1', [id]))[0].created_at;
/** Step 5 의 마이그레이션 폴더 이름과 SQL. */
const step5Migration = () => {
  const [name] = newMigrations(stepDir(5));
  return { name, sql: read(stepDir(5)(`prisma/migrations/${name}/migration.sql`)) };
};
/** 채우기 부분(손으로 더한 INSERT) — 마이그레이션 SQL 에서 «-- 이미» 로 시작하는 주석부터 끝까지. */
const backfillOf = (sql) => sql.slice(sql.indexOf('\n-- 이미') + 1);

describe('축 ② Step 5 — 업로드 기록 테이블 · 이미 있는 사진 채우기', () => {
  beforeAll(getLegacy, 120_000);

  it('🔴 바뀐 학생 파일 — schema.prisma · 새 마이그레이션 · 새 services/uploadService.js · controllers/uploadController.js · seed.js', () => {
    const { name } = step5Migration();
    expect(name).toMatch(/^\d{14}_add_uploads$/);
    expect(changedStudentFiles(stepRef(4), stepRef(5))).toEqual([
      'controllers/uploadController.js', `prisma/migrations/${name}/migration.sql`, 'prisma/schema.prisma', 'seed.js', 'services/uploadService.js',
    ]);
    for (const rel of ['package.json']) expect(read(stepDir(5)(rel))).toBe(read(stepDir(4)(rel)));
  });

  it('🔎 p3-49 끝과 비슷한 DB — 게시물 11개 · /uploads/ 사진 줄 7개 · 파일은 C 만 없다 · F 는 게시물이 없다', async () => {
    const { A, B, C, D, E, F } = legacy;
    expect(legacy.files).toEqual([A, B, D, E, F].map(fileOf).sort());
    const rows = await onDb(LEGACY_BASE, "SELECT p.id, u.username, pi.image_url FROM post_images pi JOIN posts p ON p.id = pi.post_id JOIN users u ON u.id = p.author_id WHERE pi.image_url LIKE '/uploads/%' ORDER BY p.id, pi.img_order");
    expect(rows.map((r) => [r.username, r.image_url])).toEqual([
      ['jaehoon', A], ['seoyeon', A], ['jaehoon', B], ['jaehoon', B], ['jaehoon', C], ['seoyeon', D], ['seoyeon', E],
    ]);
    expect(Number((await onDb(LEGACY_BASE, 'SELECT count(*) AS n FROM posts'))[0].n)).toBe(11);
  });

  it('🔴 migrate dev — 채우기가 /uploads/ 사진마다 먼저 만든 게시물 하나에 · 올린 사람은 그 게시물을 쓴 사람 · 시각은 그 게시물의 시각 · F 는 기록이 없다', async () => {
    await copyDb('p350_legacy', LEGACY_BASE);
    const dir = studentDir(stepDir(5));
    const applied = await prismaCli(dir, ['migrate', 'dev'], dbUrl('p350_legacy'));
    seen.step5MigrateDev = scrub(applied.out, dir);
    expect(applied.ok, applied.out).toBe(true);
    expect(applied.out).toContain(`Applying migration \`${step5Migration().name}\``);
    const { A, B, C, D, E, J1, J2, J4, M3 } = legacy;
    const rows = await uploadRows('p350_legacy');
    const want = [[A, 'jaehoon', J1], [B, 'jaehoon', J2], [C, 'jaehoon', J4], [D, 'seoyeon', M3], [E, 'seoyeon', M3]]
      .map(([url, who, post]) => [fileOf(url), who, post]).sort((a, b) => a[0].localeCompare(b[0]));
    expect(rows.map((r) => [r.file_name, r.uploader, r.post_id])).toEqual(want);
    for (const row of rows) expect(row.created_at).toEqual(await postTime('p350_legacy', row.post_id));
    seen.step5Backfill = rows.map((r) => ({ ...r, created_at: r.created_at.toISOString() }));
  }, 60_000);

  it('🔴 파일 이름 꺼내기는 앱의 path.basename 과 같은 결과', async () => {
    const urls = ['/uploads/9b1c4c7e-2d6a-4f0e-9a3b-1c2d3e4f5a6b.jpg', '/uploads/a.png', '/uploads/../lab/p3-31/canary.txt', '/uploads/../secret.txt', '/uploads/x/y.webp'];
    const expr = /(substring|split_part|regexp_replace)\([^)]*image_url[^)]*\)/i.exec(backfillOf(step5Migration().sql))?.[0];
    expect(expr, '채우기의 파일 이름 식').toBeTruthy();
    // 교안 설명 — «/ 로 나눈 마지막 조각»(PostgreSQL 14 부터 음수 위치)
    expect(expr).toBe(`split_part(pi."image_url", '/', -1)`);
    const { default: path } = await import('node:path');
    for (const url of urls) {
      const [{ name }] = await onDb(TPL_DB, `SELECT ${expr.replace(/(pi\.)?"?image_url"?/g, '$$1::text')} AS name`, [url]);
      expect([url, name]).toEqual([url, path.basename(url)]);
    }
    seen.step5FileNameExpr = expr;
  });

  it('🔴 DISTINCT ON 을 뺀 판(스냅숏)은 같은 주소가 두 게시물에 있어 23505 — 앞의 CREATE TABLE 은 남고 마이그레이션은 «실패» · 고쳐 다시 치면 reset 을 묻는다 · 테이블을 지우고 resolve --rolled-back 하면 고친 판이 들어간다', async () => {
    const { name, sql } = step5Migration();
    const snap = read(P('snapshots/p3-50/step5-no-distinct.migration.sql'));
    expect(snap).toBe(sql.replace('SELECT DISTINCT ON ("file_name")\n', 'SELECT\n'));
    await copyDb('p350_legacy2', LEGACY_BASE);
    const url = dbUrl('p350_legacy2');
    const dir = studentDir(stepDir(5), (d) => writeFileSync(join(d, `prisma/migrations/${name}/migration.sql`), snap));
    const failed = await prismaCli(dir, ['migrate', 'dev'], url);
    expect(failed.ok).toBe(false);
    expect(failed.out).toContain('Error: P3018');
    expect(failed.out).toContain('Database error code: 23505');
    const dup = fileOf(legacy.A) < fileOf(legacy.B) ? fileOf(legacy.A) : fileOf(legacy.B);
    expect(failed.out).toContain(`DETAIL: Key (file_name)=(${dup}) already exists.`);
    // Prisma 는 마이그레이션 SQL 을 한 트랜잭션으로 묶지 않는다 — 실패한 INSERT 앞의 CREATE TABLE · 인덱스 · 외래 키는 남는다
    expect(await onDb('p350_legacy2', "SELECT to_regclass('uploads')::text AS t")).toEqual([{ t: 'uploads' }]);
    expect(Number((await onDb('p350_legacy2', 'SELECT count(*) AS n FROM uploads'))[0].n)).toBe(0);
    expect(await onDb('p350_legacy2', 'SELECT finished_at, applied_steps_count FROM _prisma_migrations WHERE migration_name = $1', [name])).toEqual([{ finished_at: null, applied_steps_count: 0 }]);
    const status = await prismaCli(dir, ['migrate', 'status'], url);
    expect(status.out).toContain(`Following migration have failed:\n${name}`);
    // 고친 판(DISTINCT ON)으로 바꿔 다시 치면 — 데이터를 다 지우는 reset 을 묻는다(터미널이 아니면 묻지 못하고 멈춘다)
    writeFileSync(join(dir, `prisma/migrations/${name}/migration.sql`), sql);
    const again = await prismaCli(dir, ['migrate', 'dev'], url);
    expect(again.ok).toBe(false);
    expect(again.out).toContain(`- The migration \`${name}\` failed.`);
    expect(again.out).toContain('We need to reset the "public" schema at "localhost:5432"');
    // 되돌리는 길 — 남은 테이블을 지우고, 그 마이그레이션을 «되돌렸다» 고 적은 뒤 다시
    await onDb('p350_legacy2', 'DROP TABLE "uploads"');
    const resolved = await prismaCli(dir, ['migrate', 'resolve', '--rolled-back', name], url);
    expect(resolved.out).toContain(`Migration ${name} marked as rolled back.`);
    const fixed = await prismaCli(dir, ['migrate', 'dev'], url);
    expect(fixed.ok, fixed.out).toBe(true);
    expect((await uploadRows('p350_legacy2')).length).toBe(5);
    seen.step5NoDistinct = { failed: scrub(failed.out, dir), status: scrub(status.out, dir), again: scrub(again.out, dir), resolved: scrub(resolved.out, dir), fixed: scrub(fixed.out, dir) };
  }, 90_000);

  it('🔎 --create-only 로 만든 SQL — 손으로 더한 채우기 앞까지가 Prisma 가 만든 그대로', async () => {
    await copyDb('p350_legacy3', LEGACY_BASE);
    const { name, sql } = step5Migration();
    const dir = studentDir(stepDir(5), (d) => rmSync(join(d, `prisma/migrations/${name}`), { recursive: true }));
    const created = await prismaCli(dir, ['migrate', 'dev', '--create-only', '--name', 'add_uploads'], dbUrl('p350_legacy3'));
    seen.step5CreateOnly = scrub(created.out, dir);
    expect(created.ok, created.out).toBe(true);
    const [made] = readdirSync(join(dir, 'prisma/migrations')).filter((n) => n.endsWith('_add_uploads'));
    expect(read(join(dir, 'prisma/migrations', made, 'migration.sql'))).toBe(sql.slice(0, sql.indexOf('\n-- 이미') + 1).replace(/\n\n$/, '\n'));
    expect(await onDb('p350_legacy3', "SELECT to_regclass('uploads') AS t")).toEqual([{ t: null }]);
  }, 60_000);

  it('🔴 사진을 올리면 기록이 남는다 — 올린 사람 · 게시물은 비어 있음 · 응답은 Step 4 판과 같은 모양(새 주소 · 옛 주소)', async () => {
    const shapes = {};
    for (const n of [4, 5]) {
      await freshGate(stepDir(n));
      shapes[n] = await withServer(stepDir(n), async ({ base, dir }) => {
        const tab = browser(base);
        await tab.login('jaehoon');
        const v2 = await upload(tab, ['beach.jpg', 'forest.jpg']);
        const v1 = await upload(tab, ['beach.jpg'], '/api/uploads');
        const shape = (res) => [res.status, JSON.stringify(res.body).replace(/[0-9a-f-]{36}/g, 'UUID')];
        return { v2: shape(v2), v1: shape(v1), urls: [...v2.body.data.imageUrls, ...v1.body.imageUrls], files: filesIn(dir) };
      });
    }
    expect(shapes[5].v2).toEqual(shapes[4].v2);
    expect(shapes[5].v1).toEqual(shapes[4].v1);
    expect(shapes[5].v2).toEqual([201, '{"data":{"imageUrls":["/uploads/UUID.jpg","/uploads/UUID.jpg"]}}']);
    expect(shapes[5].v1).toEqual([201, '{"imageUrls":["/uploads/UUID.jpg"]}']);
    const rows = await uploadRows();
    expect(rows.map((r) => [r.file_name, r.uploader, r.post_id])).toEqual(shapes[5].urls.map(fileOf).sort().map((f) => [f, 'jaehoon', null]));
    expect(shapes[5].files).toEqual(shapes[5].urls.map(fileOf).sort());
  }, 60_000);

  it('🔴 기록을 못 남기면(데이터베이스가 꺼짐) 500 · 저장한 파일을 지운다 — 지우지 않는 판(스냅숏)은 파일이 기록 없이 남는다', async () => {
    const token = tokenFor(2);
    const tryUpload = async (edit) => withServer(stepDir(5), async ({ base, dir, tail }) => {
      const form = new FormData();
      form.append('images', new Blob([photo('beach.jpg')], { type: 'image/jpeg' }), 'beach.jpg');
      const res = await fetch(`${base}/api/v2/uploads`, { method: 'POST', body: form, headers: { Cookie: `accessToken=${token}` } });
      await sleep(200);
      return { status: res.status, body: await res.json(), files: filesIn(dir), log: scrub(tail(), dir) };
    }, { edit, extraEnv: { DATABASE_URL: DOWN_URL } });
    const fixed = await tryUpload();
    expect([fixed.status, fixed.body.error.code, fixed.files]).toEqual([500, 'INTERNAL_ERROR', []]);
    const snap = read(P('snapshots/p3-50/step5-no-remove.uploadService.js'));
    // 스냅숏은 Step 5 판에서 try … catch 만 뺀 것이다
    expect(snap).toBe(read(stepDir(5)('services/uploadService.js')).replace(
      /  try \{\n    await prisma\.upload\.createMany\(\{\n      data: (.*)\n    \}\);\n  \} catch \(error\) \{\n[^]*?\n    throw error;\n  \}\n/,
      '  await prisma.upload.createMany({\n    data: $1\n  });\n'));
    const noRemove = await tryUpload((d) => writeFileSync(join(d, 'services/uploadService.js'), snap));
    expect([noRemove.status, noRemove.body.error.code, noRemove.files.length]).toEqual([500, 'INTERNAL_ERROR', 1]);
    expect(noRemove.files[0]).toMatch(UUID_FILE);
    seen.step5RecordFails = { fixed, noRemove };
  }, 60_000);

  it('🔴 시드 — Step 5 판은 그대로 한 줄 · uploads 를 빼먹은 TRUNCATE(Step 4 판 seed.js)는 0A000 으로 멈춘다', async () => {
    await copyDb('p350_seed', 'p350_legacy');
    const ok = await runSeed(studentDir(stepDir(5)), dbUrl('p350_seed'));
    expect(ok).toEqual({ ok: true, out: '사람 5명, 게시물 5개, 사진 8장, 댓글 9개, 답글 3개를 넣었어요.\n' });
    expect(Number((await onDb('p350_seed', 'SELECT count(*) AS n FROM uploads'))[0].n)).toBe(0);
    const old = await runSeed(studentDir(stepDir(4)), dbUrl('p350_seed'));
    expect(old.ok).toBe(false);
    expect(old.out).toContain('cannot truncate a table referenced in a foreign key constraint');
    seen.step5OldSeed = old.out.split('\n').filter((l) => /0A000|truncate|uploads|Table/.test(l)).slice(0, 12);
  }, 60_000);
});

// ── 축 ③ Step 6 — 내가 올리고 아직 안 쓴 사진만 ──────────────────────────────────
const NOT_AVAILABLE = '내가 올리고 아직 게시물에 쓰지 않은 사진만 넣을 수 있어요';
/** 사진 파일 없이 기록만 넣는다 — 게시물 만들기는 기록만 본다. */
const fakeUpload = async (username, fileName = `${randomUUID()}.jpg`) => {
  await gate('INSERT INTO uploads (file_name, uploader_id) VALUES ($1, (SELECT id FROM users WHERE username = $2))', [fileName, username]);
  return `/uploads/${fileName}`;
};
const recordOf = async (url) => (await gate('SELECT u.post_id, us.username AS uploader FROM uploads u JOIN users us ON us.id = u.uploader_id WHERE file_name = $1', [fileOf(url)]))[0];
const postsWith = async (url) => (await gate('SELECT post_id FROM post_images WHERE image_url = $1 ORDER BY post_id', [url])).map((r) => r.post_id);
/** 토큰 쿠키를 실은 요청 — 로그인 요청 없이(데이터베이스를 안 쓰고) 그 사람으로 보낸다. */
const asUser = (base, userId) => {
  const token = tokenFor(userId);
  return (imageUrls, content = '게시물') => fetch(`${base}/api/v2/posts`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `accessToken=${token}` },
    body: JSON.stringify({ imageUrls, postAlt: content, content }),
  }).then(async (res) => ({ status: res.status, body: await res.json() }));
};
/** 같은 사람이 같은 사진으로 게시물 둘을 «같은 순간에» — 상태 코드 둘과 그 주소가 든 게시물 수. */
const raceOnce = async (base, jaehoonId) => {
  const url = await fakeUpload('jaehoon');
  const post = asUser(base, jaehoonId);
  const results = await Promise.all([post([url], '같은 순간 A'), post([url], '같은 순간 B')]);
  return `${results.map((r) => r.status).sort().join('+')} → 게시물 ${(await postsWith(url)).length}개`;
};
const tally = (list) => list.reduce((acc, key) => ({ ...acc, [key]: (acc[key] ?? 0) + 1 }), {});
const RACE_RUNS = 30;
/** 동시 둘 — 서버 하나로 30번(풀이 데워진 채) · 띄울 때마다 한 번씩 10번(빈 풀) · 띄우고 요청 하나 뒤 10번(연결 하나). */
const raceProfile = async (from, edit) => {
  await freshGate(from);
  const jaehoonId = await userIdOf('jaehoon');
  const warm = await withServer(from, async ({ base }) => {
    const out = [];
    for (let i = 0; i < RACE_RUNS; i += 1) out.push(await raceOnce(base, jaehoonId));
    return out;
  }, { edit });
  const empty = [];
  const one = [];
  for (let i = 0; i < 10; i += 1) {
    empty.push(await withServer(from, async ({ base }) => raceOnce(base, jaehoonId), { edit }));
    one.push(await withServer(from, async ({ base }) => {
      const tab = browser(base);
      await tab.login('jaehoon');
      return raceOnce(base, jaehoonId);
    }, { edit }));
  }
  return { warm: tally(warm), empty: tally(empty), one: tally(one) };
};
const races = {};
seen.step6Races = races;
const UNUSED_CONDITION = ', postId: null }';

describe('축 ③ Step 6 — 내가 올리고 아직 어느 게시물에도 쓰지 않은 사진만 넣는다', () => {
  it('🔴 바뀐 학생 파일 — errors.js · services/postService.js · docs/openapi.js · photo-owner.http 끝에 두 블록', () => {
    expect(changedStudentFiles(stepRef(5), stepRef(6))).toEqual(['docs/openapi.js', 'errors.js', 'requests/photo-owner.http', 'services/postService.js']);
    // Step 4 판 여덟 블록은 한 글자도 안 바뀌고, 끝에 «다시 로그인» · «같은 사진으로 게시물 하나 더» 가 붙는다
    const before = read(stepDir(4)('requests/photo-owner.http'));
    const after = read(stepDir(6)('requests/photo-owner.http'));
    expect(after.startsWith(before)).toBe(true);
    expect(after.slice(before.length).match(/^### .+$/gm)).toEqual(['### jaehoon으로 다시 로그인', '### 같은 사진으로 게시물 하나 더']);
    expect(read(stepDir(6)('errors.js'))).toContain(`  IMAGE_NOT_AVAILABLE: '${NOT_AVAILABLE}',\n`);
  });

  it('🔴 seoyeon 이 jaehoon 의 사진 주소로 — 쓴 것이든 안 쓴 것이든 400 IMAGE_NOT_AVAILABLE · 게시물을 만들지 않는다 · 같은 사람의 둘째 게시물도 400', async () => {
    await freshGate(stepDir(6));
    const out = await withServer(stepDir(6), async ({ base }) => {
      const [j, m] = [browser(base), browser(base)];
      await j.login('jaehoon');
      await m.login('seoyeon');
      const [used, unused] = (await upload(j, ['beach.jpg', 'forest.jpg'])).body.data.imageUrls;
      const first = await newPost(j, [used], '내 바다');
      const posts = await count('posts');
      const minjiUsed = await newPost(m, [used], 'seoyeon 이 jaehoon 이 쓴 사진으로');
      const minjiUnused = await newPost(m, [unused], 'seoyeon 이 jaehoon 이 안 쓴 사진으로');
      const second = await newPost(j, [used], '같은 사진 한 번 더');
      const v1 = await newPost(m, [unused], '옛 주소로', '/api/posts');
      return { first, minjiUsed, minjiUnused, second, v1, posts, after: await count('posts'), used, unused };
    });
    expect(out.first.status).toBe(201);
    for (const res of [out.minjiUsed, out.minjiUnused, out.second]) {
      expect([res.status, res.body.error.code, res.body.error.message, res.body.error.path]).toEqual([400, 'IMAGE_NOT_AVAILABLE', NOT_AVAILABLE, '/api/v2/posts']);
    }
    expect([out.v1.status, out.v1.body]).toEqual([400, { message: NOT_AVAILABLE }]);
    expect(out.after).toBe(out.posts);
    expect(await recordOf(out.used)).toEqual({ post_id: out.first.body.data.id, uploader: 'jaehoon' });
    expect(await recordOf(out.unused)).toEqual({ post_id: null, uploader: 'jaehoon' });
    seen.step6Refused = { minjiUsed: out.minjiUsed.body, v1: out.v1.body };
  }, 30_000);

  it('🔴 바깥 주소 · data URL · /images/ 는 기록과 상관없이 201 — 섞어 보내면 우리 사진만 기록에 붙는다', async () => {
    await freshGate(stepDir(6));
    const out = await withServer(stepDir(6), async ({ base }) => {
      const tab = browser(base);
      await tab.login('jaehoon');
      const [mine] = (await upload(tab, ['beach.jpg'])).body.data.imageUrls;
      const outside = await newPost(tab, ['https://picsum.photos/seed/p350/600/600'], '바깥 주소');
      const dataUrl = await newPost(tab, ['data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='], 'data URL');
      const images = await newPost(tab, ['/images/post-8.jpg'], '옛 사진 주소');
      const mixed = await newPost(tab, ['https://picsum.photos/seed/p350b/600/600', mine], '섞어서');
      return { outside, dataUrl, images, mixed, mine };
    });
    expect([out.outside.status, out.dataUrl.status, out.images.status, out.mixed.status]).toEqual([201, 201, 201, 201]);
    expect(await recordOf(out.mine)).toEqual({ post_id: out.mixed.body.data.id, uploader: 'jaehoon' });
    expect(out.mixed.body.data.imageUrls).toEqual(['https://picsum.photos/seed/p350b/600/600', out.mine]);
  }, 30_000);

  it('🔎 한 요청에 같은 주소를 두 번 — Step 5 판은 201(사진 두 장) · Step 6 판은 400(바뀐 기록 1 ≠ 사진 2) · 실패한 만들기도 게시물 번호를 하나 쓴다', async () => {
    const twice = {};
    for (const n of [5, 6]) {
      await freshGate(stepDir(n));
      twice[n] = await withServer(stepDir(n), async ({ base }) => {
        const tab = browser(base);
        await tab.login('jaehoon');
        const [a] = (await upload(tab, ['beach.jpg'])).body.data.imageUrls;
        const res = await newPost(tab, [a, a], '같은 주소 두 번');
        const next = await newPost(tab, ['https://picsum.photos/seed/p350c/600/600'], '다음 게시물');
        return { status: res.status, code: res.body.error?.code, images: res.body.data?.imageUrls?.length, nextId: next.body.data.id };
      });
    }
    expect(twice[5]).toMatchObject({ status: 201, images: 2 });
    expect(twice[6]).toMatchObject({ status: 400, code: 'IMAGE_NOT_AVAILABLE' });
    // 시드 다섯 뒤 — Step 5 판은 6(두 번 주소) · 7(다음), Step 6 판은 6 이 되돌려져도 번호는 쓰여 다음이 7
    expect([twice[5].nextId, twice[6].nextId]).toEqual([7, 7]);
    seen.step6Twice = twice;
  }, 30_000);

  it('🔴 Step 6 판의 photo-owner.http 를 처음부터 끝까지 — seoyeon 의 게시물 400 · 지우기는 이름 없는 값을 못 채워 안 나간다 · 사진 200 · jaehoon 게시물 그대로 · jaehoon 의 둘째 게시물도 400', async () => {
    await freshGate(stepDir(6));
    const out = await withServer(stepDir(6), async ({ dir }) => ({ sent: await httpyac(read(stepDir(6)('requests/photo-owner.http'))), files: filesIn(dir) }));
    const { sent } = out;
    seen.step6Replay = sent.map((r) => ({ title: r.title, status: r.status, body: r.status === 200 && typeof r.body === 'string' ? '(사진 바이트)' : r.body }));
    expect(sent.map((r) => [r.title, r.status ?? '안 나감'])).toEqual([
      ['jaehoon으로 로그인', 200], ['사진 올리기', 201], ['그 사진으로 게시물 만들기', 201], ['seoyeon으로 로그인', 200],
      ['seoyeon이 jaehoon의 사진 주소로 게시물 만들기', 400], ['seoyeon이 그 게시물 지우기', '안 나감'],
      ['사진 열기', 200], ['jaehoon의 게시물 다시 보기', 200],
      ['jaehoon으로 다시 로그인', 200], ['같은 사진으로 게시물 하나 더', 400],
    ]);
    for (const i of [4, 9]) expect([sent[i].body.error.code, sent[i].body.error.message]).toEqual(['IMAGE_NOT_AVAILABLE', NOT_AVAILABLE]);
    const url = sent[1].body.data.imageUrls[0];
    expect(sent[7].body.data).toMatchObject({ id: sent[2].body.data.id, imageUrls: [url] });
    expect(out.files).toEqual([fileOf(url)]);
    expect(await recordOf(url)).toEqual({ post_id: sent[2].body.data.id, uploader: 'jaehoon' });
    expect(await postsWith(url)).toEqual([sent[2].body.data.id]);
  }, 60_000);

  it('🔴 동시에 같은 사진으로 게시물 둘(같은 사람) — 데워진 풀 30번 · 빈 풀 10번 · 연결 하나 10번 모두 201 하나 + 400 하나 · 게시물 1개', async () => {
    races.step6 = await raceProfile(stepDir(6));
    expect(races.step6).toEqual({ warm: { '201+400 → 게시물 1개': RACE_RUNS }, empty: { '201+400 → 게시물 1개': 10 }, one: { '201+400 → 게시물 1개': 10 } });
  }, 240_000);

  it('🔎 Step 5 판 — 같은 순간의 둘이 둘 다 201(그 사진이 든 게시물 2개)', async () => {
    races.step5 = await raceProfile(stepDir(5));
    expect(races.step5.warm).toEqual({ '201+201 → 게시물 2개': RACE_RUNS });
  }, 240_000);

  it('🔎 «아직 안 썼다» 조건만 뺀 판(스냅숏) — 같은 사람의 둘째 게시물이 201 이고 기록이 둘째 게시물로 옮겨 간다', async () => {
    const snap = read(P('snapshots/p3-50/step6-no-unused-condition.postService.js'));
    const src = read(stepDir(6)('services/postService.js'));
    expect(src.split(UNUSED_CONDITION).length).toBe(2);
    expect(snap).toBe(src.replace(UNUSED_CONDITION, ' }'));
    await freshGate(stepDir(6));
    const out = await withServer(stepDir(6), async ({ base }) => {
      const tab = browser(base);
      await tab.login('jaehoon');
      const [a] = (await upload(tab, ['beach.jpg'])).body.data.imageUrls;
      const first = await newPost(tab, [a], '첫째');
      const afterFirst = await recordOf(a);
      const second = await newPost(tab, [a], '둘째');
      return { a, first: first.body.data.id, second: [second.status, second.body.data?.id], afterFirst, afterSecond: await recordOf(a) };
    }, { edit: (d) => writeFileSync(join(d, 'services/postService.js'), snap) });
    expect(out.second[0]).toBe(201);
    expect(out.afterFirst.post_id).toBe(out.first);
    expect(out.afterSecond.post_id).toBe(out.second[1]);
    expect(await postsWith(out.a)).toEqual([out.first, out.second[1]]);
    seen.step6NoUnused = out;
  }, 30_000);

  it('🔎 먼저 살펴보고 따로 바꾸는 판(스냅숏 · 사이에 1초) — 동시 둘이 둘 다 201 · 게시물 2개', async () => {
    const snap = read(P('snapshots/p3-50/step6-check-then-update.postService.js'));
    expect(snap).toContain('await setTimeout(1000);');
    races.checkThenUpdateSlow = await raceProfile(stepDir(6), (d) => writeFileSync(join(d, 'services/postService.js'), snap));
    expect(races.checkThenUpdateSlow.warm).toEqual({ '201+201 → 게시물 2개': RACE_RUNS });
  }, 400_000);

  it('🔎 먼저 살펴보고 따로 바꾸는 판 — 1초 늦추는 줄 없이', async () => {
    const snap = read(P('snapshots/p3-50/step6-check-then-update.postService.js'));
    const fast = snap.replace(/\n *\/\/ [^\n]*\n *await setTimeout\(1000\);\n/, '\n').replace("import { setTimeout } from 'node:timers/promises';\n", '');
    expect(fast).not.toContain('setTimeout');
    races.checkThenUpdateFast = await raceProfile(stepDir(6), (d) => writeFileSync(join(d, 'services/postService.js'), fast));
    const total = (t) => Object.values(t).reduce((a, b) => a + b, 0);
    expect([total(races.checkThenUpdateFast.warm), total(races.checkThenUpdateFast.empty), total(races.checkThenUpdateFast.one)]).toEqual([RACE_RUNS, 10, 10]);
  }, 240_000);

  it('🔴 문서 — 게시물 만들기(새 주소)의 400 에 IMAGE_NOT_AVAILABLE', async () => {
    const { openapi } = await import(stepDir(6)('docs/openapi.js'));
    const codes = openapi.paths['/api/v2/posts'].post.responses[400].content['application/json'].schema.properties.error.properties.code.enum;
    expect(codes).toEqual(['VALIDATION_FAILED', 'INVALID_BODY', 'IMAGE_NOT_AVAILABLE']);
  });

  it('🔎 고치기(PATCH)는 사진을 받지 않는다 — imageUrls 를 보내도 사진은 그대로', async () => {
    await freshGate(stepDir(6));
    const out = await withServer(stepDir(6), async ({ base }) => {
      const [j, m] = [browser(base), browser(base)];
      await j.login('jaehoon');
      await m.login('seoyeon');
      const [a] = (await upload(j, ['beach.jpg'])).body.data.imageUrls;
      const mine = await newPost(m, ['https://picsum.photos/seed/p350d/600/600'], 'seoyeon 글');
      const patched = await m.send('PATCH', `/api/v2/posts/${mine.body.data.id}`, { imageUrls: [a], content: '고친 글' });
      return { status: patched.status, imageUrls: patched.body.data.imageUrls, content: patched.body.data.content, record: await recordOf(a) };
    });
    expect(out).toEqual({ status: 200, imageUrls: ['https://picsum.photos/seed/p350d/600/600'], content: '고친 글', record: { post_id: null, uploader: 'jaehoon' } });
  }, 30_000);
});

// ── 축 ④ Step 7 — 지울 때는 기록으로 ──────────────────────────────────────────────
/** 옛 DB(p3-49 끝과 비슷한 상태)의 사본에 Step 5 마이그레이션을 SQL 로 얹고, 그 사진 폴더까지 복사한 학생 폴더를 띄운다. */
const withLegacyServer = async (n, name, fn, { edit } = {}) => {
  await copyDb(name, LEGACY_BASE);
  await onDb(name, step5Migration().sql);
  const dir = studentDir(stepDir(n), (d) => {
    cpSync(join(legacy.dir, 'uploads'), join(d, 'uploads'), { recursive: true });
    if (edit) edit(d);
  });
  return withServer(stepDir(n), fn, { dir, extraEnv: { DATABASE_URL: dbUrl(name) } });
};
/** 지우기 장면 — 사람마다 탭 하나 · 관리자는 seungwoo(토큰의 역할도 ADMIN). 지울 때마다 남은 파일과 A·B 주소의 상태를 적는다. */
const deleteScene = async (n, name, edit) => withLegacyServer(n, name, async ({ base, dir }) => {
  const { A, B, J1, M1, J3, J4, M3 } = legacy;
  const [j, m] = [browser(base), browser(base)];
  await j.login('jaehoon');
  await m.login('seoyeon');
  await onDb(name, "UPDATE users SET role = 'ADMIN' WHERE username = 'seungwoo'");
  const [{ id: adminId }] = await onDb(name, "SELECT id FROM users WHERE username = 'seungwoo'");
  const adminToken = tokenFor(adminId, 'ADMIN');
  const adminDelete = (id) => fetch(`${base}/api/v2/posts/${id}`, { method: 'DELETE', headers: { Cookie: `accessToken=${adminToken}` } }).then((res) => res.status);
  const name4 = { [fileOf(A)]: 'A', [fileOf(B)]: 'B', [fileOf(legacy.D)]: 'D', [fileOf(legacy.E)]: 'E', [fileOf(legacy.F)]: 'F' };
  const state = async () => ({
    files: filesIn(dir).map((f) => name4[f] ?? 'G').sort().join(''),
    A: (await fetch(`${base}${A}`)).status,
    B: (await fetch(`${base}${B}`)).status,
  });
  const steps = [];
  const step = async (label, run) => steps.push({ label, status: await run(), ...(await state()) });
  steps.push({ label: '처음', ...(await state()) });
  await step('seoyeon 이 M1(A — 기록은 J1 것) 지우기', async () => (await m.del(`/api/v2/posts/${M1}`)).status);
  await step('jaehoon 이 J3(B — 기록은 J2 것) 지우기', async () => (await j.del(`/api/v2/posts/${J3}`)).status);
  await step('jaehoon 이 J4(C — 기록 있음 · 파일 없음) 지우기', async () => (await j.del(`/api/v2/posts/${J4}`)).status);
  await step('jaehoon 이 시드 게시물 1(바깥 주소) 지우기', async () => (await j.del('/api/v2/posts/1')).status);
  await step('관리자 seungwoo 가 seoyeon 의 M3(D·E) 지우기', async () => adminDelete(M3));
  let G;
  await step('jaehoon 이 새로 올린 G 로 게시물을 만들고 지우기', async () => {
    [G] = (await upload(j, ['forest.jpg'])).body.data.imageUrls;
    const id = (await newPost(j, [G], '새 게시물')).body.data.id;
    return (await j.del(`/api/v2/posts/${id}`)).status;
  });
  await step('jaehoon 이 J1(A — 기록 있음) 지우기', async () => (await j.del(`/api/v2/posts/${J1}`)).status);
  const records = (await onDb(name, 'SELECT file_name FROM uploads ORDER BY file_name')).map((r) => name4[r.file_name] ?? (r.file_name === fileOf(legacy.C) ? 'C' : r.file_name === fileOf(G) ? 'G' : '?')).sort().join('');
  return { steps, records };
}, { edit });

/** `.http` 의 마지막 블록 n 개. */
const lastBlocks = (source, n) => source.split(/^(?=### )/m).slice(-n).join('');
/**
 * VS Code 의 httpYac 처럼 앞서 보낸 응답 값과 쿠키를 이어 쓴다 — CLI 는 실행마다 새로 시작해서 `# @name` 값과 쿠키를 잊으므로,
 * 앞 실행에서 받은 값을 그 자리에 글자로 채우고 쿠키를 헤더로 싣는다(보내는 요청은 VS Code 가 보낼 것과 같다).
 */
const continueWith = (source, values, cookie) => {
  let out = source;
  for (const [expr, value] of Object.entries(values)) out = out.replaceAll(`{{${expr}}}`, value);
  return out.replace(/^(GET|POST|DELETE|PATCH|PUT) .+$/gm, (line) => `${line}\nCookie: ${cookie}`);
};
const accessTokenOf = (res) => [].concat(res.raw.response.headers['set-cookie'] ?? [])
  .map((line) => /^accessToken=([^;]+)/.exec(line)?.[1]).find(Boolean);
/**
 * 학생 흐름 — Step 6 판에서 photo-owner.http 를 위에서부터 다 보낸다 → postService.js 를 `second` 판으로 바꿔 서버를 다시 띄운다 →
 * Step 7 판 파일 끝의 두 블록(«jaehoon의 게시물 지우기» · «사진 다시 열기»)만 보낸다.
 */
const step7Replay = async (second) => {
  await freshGate(stepDir(6));
  const dir = studentDir(stepDir(6));
  const first = await withServer(stepDir(6), async () => httpyac(read(stepDir(6)('requests/photo-owner.http'))), { dir });
  const url = first[1].body.data.imageUrls[0];
  const postId = first[2].body.data.id;
  const recordBefore = await recordOf(url);
  writeFileSync(join(dir, 'services/postService.js'), read(stepDir(second)('services/postService.js')));
  const blocks = continueWith(lastBlocks(read(stepDir(7)('requests/photo-owner.http')), 2),
    { 'jaehoonPost.data.id': String(postId), 'uploaded.data.imageUrls[0]': url }, `accessToken=${accessTokenOf(first[8])}`);
  const out = await withServer(stepDir(second), async ({ tail }) => {
    const sent = await httpyac(blocks);
    await sleep(150);
    return { sent, log: scrub(tail(), dir) };
  }, { dir });
  return {
    url, postId, recordBefore,
    sent: out.sent.map((r) => ({ title: r.title, status: r.status, body: r.body })),
    log: out.log, record: await recordOf(url) ?? null, files: filesIn(dir), posts: await postsWith(url),
  };
};

describe('축 ④ Step 7 — 게시물을 지울 때는 그 게시물에 쓴 기록의 파일만 지운다', () => {
  beforeAll(getLegacy, 120_000);

  it('🔴 바뀐 학생 파일 — services/postService.js · photo-owner.http 끝에 두 블록', () => {
    expect(changedStudentFiles(stepRef(6), stepRef(7))).toEqual(['requests/photo-owner.http', 'services/postService.js']);
    expect(read(stepDir(7)('services/postService.js'))).not.toContain('path.basename(imageUrl)), { force: true }');
  });

  it('🔴 같은 장면을 Step 6 판(주소로 지우던 판)과 Step 7 판에 — 기록이 없는 게시물은 파일을 안 지운다 · 관리자도 같은 길', async () => {
    const before = await deleteScene(6, 'p350_del6');
    const after = await deleteScene(7, 'p350_del7');
    seen.step7Scenes = { step6: before, step7: after };
    const row = (s) => s.steps.map((x) => [x.label, x.status ?? '-', x.files, x.A, x.B]);
    expect(row(before)).toEqual([
      ['처음', '-', 'ABDEF', 200, 200],
      ['seoyeon 이 M1(A — 기록은 J1 것) 지우기', 200, 'BDEF', 404, 200],
      ['jaehoon 이 J3(B — 기록은 J2 것) 지우기', 200, 'DEF', 404, 404],
      ['jaehoon 이 J4(C — 기록 있음 · 파일 없음) 지우기', 200, 'DEF', 404, 404],
      ['jaehoon 이 시드 게시물 1(바깥 주소) 지우기', 200, 'DEF', 404, 404],
      ['관리자 seungwoo 가 seoyeon 의 M3(D·E) 지우기', 200, 'F', 404, 404],
      ['jaehoon 이 새로 올린 G 로 게시물을 만들고 지우기', 200, 'F', 404, 404],
      ['jaehoon 이 J1(A — 기록 있음) 지우기', 200, 'F', 404, 404],
    ]);
    expect(row(after)).toEqual([
      ['처음', '-', 'ABDEF', 200, 200],
      ['seoyeon 이 M1(A — 기록은 J1 것) 지우기', 200, 'ABDEF', 200, 200],
      ['jaehoon 이 J3(B — 기록은 J2 것) 지우기', 200, 'ABDEF', 200, 200],
      ['jaehoon 이 J4(C — 기록 있음 · 파일 없음) 지우기', 200, 'ABDEF', 200, 200],
      ['jaehoon 이 시드 게시물 1(바깥 주소) 지우기', 200, 'ABDEF', 200, 200],
      ['관리자 seungwoo 가 seoyeon 의 M3(D·E) 지우기', 200, 'ABF', 200, 200],
      ['jaehoon 이 새로 올린 G 로 게시물을 만들고 지우기', 200, 'ABF', 200, 200],
      ['jaehoon 이 J1(A — 기록 있음) 지우기', 200, 'BF', 404, 200],
    ]);
    // 지운 게시물의 기록은 함께 지워졌다(onDelete: Cascade) — 남은 기록은 B(J2) 하나
    expect(after.records).toBe('B');
  }, 120_000);

  it('🔴 Step 7 판 photo-owner.http 끝 두 블록 — Step 6 에서 다 보낸 뒤 Step 7 로 바꿔 두 블록만: 지우기 200 · 사진 다시 열기 404 · 기록도 사라진다 — Step 6 판으로 보내도 결과가 같다', async () => {
    const before = read(stepDir(6)('requests/photo-owner.http'));
    const after = read(stepDir(7)('requests/photo-owner.http'));
    expect(after.startsWith(before)).toBe(true);
    expect(after.slice(before.length).match(/^### .+$/gm)).toEqual(['### jaehoon의 게시물 지우기', '### 사진 다시 열기']);
    expect(changedStudentFiles(stepRef(6), stepRef(7))).toEqual(['requests/photo-owner.http', 'services/postService.js']);
    const on7 = await step7Replay(7);
    const on6 = await step7Replay(6);
    seen.step7Replay = { step7: on7, step6: on6 };
    for (const scene of [on7, on6]) {
      expect(scene.recordBefore).toEqual({ post_id: scene.postId, uploader: 'jaehoon' });
      expect(scene.sent.map((r) => [r.title, r.status])).toEqual([['jaehoon의 게시물 지우기', 200], ['사진 다시 열기', 404]]);
      expect(scene.sent[0].body.data).toMatchObject({ id: scene.postId, username: 'jaehoon', imageUrls: [scene.url] });
      expect(scene.sent[1].body).toEqual({ message: '그런 주소는 없어요' });
      expect([scene.record, scene.files, scene.posts]).toEqual([null, [], []]);
      expect(scene.log.replace(/[0-9a-f-]{36}/, 'UUID')).toBe(`서버가 ${PORT}번 포트에서 기다리고 있어요.\nDELETE /api/v2/posts/${scene.postId} 200 Nms\nGET /uploads/UUID.jpg 404 Nms\n`);
    }
  }, 120_000);

  it('🔎 Step 7 판에 «아직 안 썼다» 조건만 뺀 판 — 같은 사람의 둘째 게시물로 기록이 옮겨 가 첫 게시물을 지워도 파일이 남고, 둘째를 지우면 첫 게시물의 사진이 404', async () => {
    await freshGate(stepDir(7));
    const out = await withServer(stepDir(7), async ({ base }) => {
      const tab = browser(base);
      await tab.login('jaehoon');
      const [a] = (await upload(tab, ['beach.jpg'])).body.data.imageUrls;
      const first = (await newPost(tab, [a], '첫째')).body.data.id;
      const second = (await newPost(tab, [a], '둘째')).body.data.id;
      const record = await recordOf(a);
      await tab.del(`/api/v2/posts/${first}`);
      const afterFirst = (await fetch(`${base}${a}`)).status;
      const third = (await newPost(tab, [a], '셋째')).body.data.id;
      await tab.del(`/api/v2/posts/${third}`);
      const afterThird = (await fetch(`${base}${a}`)).status;
      const secondNow = (await tab.get(`/api/v2/posts/${second}`)).body.data.imageUrls;
      return { recordPost: record.post_id === second ? 'second' : 'first', afterFirst, afterThird, secondKeeps: secondNow[0] === a };
    }, { edit: (d) => replaceIn(d, 'services/postService.js', UNUSED_CONDITION, ' }') });
    expect(out).toEqual({ recordPost: 'second', afterFirst: 200, afterThird: 404, secondKeeps: true });
    seen.step7NoUnused = out;
  }, 30_000);
});

// ── 축 ⑤ Step 8 — 아무 게시물에도 쓰이지 않은 사진 치우기 ──────────────────────────
const CLEANED = (n) => `아무 게시물에도 쓰이지 않은 사진 ${n}장을 지웠어요.`;
/** 사진 파일을 학생 폴더에 두고 기록을 넣는다 — `ago` 는 올린 지 얼마나 됐는지(SQL interval) · `post` 는 붙일 게시물 번호. */
const plant = async (dir, { who = 'jaehoon', ago = '0 seconds', post = null, file = true } = {}) => {
  const fileName = `${randomUUID()}.jpg`;
  if (file) {
    mkdirSync(join(dir, 'uploads'), { recursive: true });
    writeFileSync(join(dir, 'uploads', fileName), photo('beach.jpg'));
  }
  await gate(`INSERT INTO uploads (file_name, uploader_id, post_id, created_at)
    VALUES ($1, (SELECT id FROM users WHERE username = $2), $3, now() - $4::interval)`, [fileName, who, post, ago]);
  return fileName;
};
const recordNames = async () => (await gate('SELECT file_name FROM uploads ORDER BY file_name')).map((r) => r.file_name);
/** 서버를 띄우고 뜰 때의 청소가 끝날 만큼 기다린다. */
const settle = (ms = 600) => sleep(ms);
/** Step 8 판 uploadService.js 의 «고르기» 와 «지우기» 사이에 늦추는 줄을 넣는다. */
const SLOW_CLEANUP = (dir) => replaceIn(dir, 'services/uploadService.js',
  '  const removed = [];\n', '  await new Promise((resolve) => setTimeout(resolve, 2000));\n  const removed = [];\n');
const NO_RECHECK = (dir) => replaceIn(dir, 'services/uploadService.js',
  'deleteMany({ where: { id: upload.id, postId: null } })', 'deleteMany({ where: { id: upload.id } })');
/** 서버 프로세스를 띄워 끝날 때까지(또는 `ms` 까지) 기다린다 — 꺼졌는지와 터미널 글자를 돌려준다. */
const runFor = (dir, ms, extraEnv = {}, args = ['app.js']) => new Promise((resolve) => {
  const childEnv = { ...process.env, ...env, ...extraEnv, PORT: String(PORT2) };
  delete childEnv.NODE_ENV;
  delete childEnv.VITEST;
  const child = spawn(process.execPath, args, { cwd: dir, env: childEnv });
  let log = '';
  child.stdout.on('data', (b) => { log += b; });
  child.stderr.on('data', (b) => { log += b; });
  // node --watch 는 SIGTERM 을 받으면 스스로 끝나므로(signal 이 null) «우리가 껐는가» 를 따로 적는다.
  let killed = false;
  const timer = setTimeout(() => { killed = true; child.kill(); }, ms);
  child.on('exit', (code) => {
    clearTimeout(timer);
    resolve({ exited: !killed, code, log: scrub(log, dir) });
  });
});

describe('축 ⑤ Step 8 — 올린 지 오래됐는데 아무 게시물에도 쓰이지 않은 사진을 서버가 치운다', () => {
  it('🔴 바뀐 학생 파일 — services/uploadService.js · app.js', () => {
    expect(changedStudentFiles(stepRef(7), stepRef(8))).toEqual(['app.js', 'services/uploadService.js']);
  });

  it('🔴 뜰 때 한 번 — 오래된 안 쓴 것만 지운다(파일 없는 기록 포함) · 새 것 · 게시물에 쓴 것은 남는다 · 터미널에 한 줄', async () => {
    await freshGate(stepDir(8));
    const dir = studentDir(stepDir(8));
    const oldUnused = await plant(dir, { ago: '2 hours' });
    const oldMissing = await plant(dir, { ago: '3 hours', file: false });
    const fresh = await plant(dir, { ago: '10 minutes' });
    const oldUsed = await plant(dir, { ago: '2 hours', post: 1 });
    const out = await withServer(stepDir(8), async ({ base, tail }) => {
      await settle();
      return { log: scrub(tail(), dir), old: (await fetch(`${base}/uploads/${oldUnused}`)).status, used: (await fetch(`${base}/uploads/${oldUsed}`)).status };
    }, { dir });
    expect(out.log).toBe(`서버가 ${PORT}번 포트에서 기다리고 있어요.\n${CLEANED(2)}\n`);
    expect([out.old, out.used]).toEqual([404, 200]);
    expect(await recordNames()).toEqual([fresh, oldUsed].sort());
    expect(filesIn(dir)).toEqual([fresh, oldUsed].sort());
    expect(oldMissing).toBeTruthy();
    seen.step8Startup = out.log;
  }, 30_000);

  it('🔴 치울 것이 없으면 아무것도 안 찍는다', async () => {
    await freshGate(stepDir(8));
    const log = await withServer(stepDir(8), async ({ tail }) => {
      await settle();
      return tail();
    });
    expect(log).toBe(`서버가 ${PORT}번 포트에서 기다리고 있어요.\n`);
  }, 30_000);

  it('🔴 정해 둔 간격마다 다시 — 간격만 0.3초로 바꾼 판에서, 서버가 뜬 뒤에 오래된 기록이 생겨도 곧 치운다', async () => {
    const src = read(stepDir(8)('app.js'));
    expect(src).toContain('const CLEANUP_INTERVAL = 10 * 60 * 1000;\n');
    expect(src).toContain('cleanUpUploads();\nsetInterval(cleanUpUploads, CLEANUP_INTERVAL);\n');
    expect(read(stepDir(8)('services/uploadService.js'))).toContain('const UNUSED_UPLOAD_LIFETIME = 60 * 60 * 1000;');
    await freshGate(stepDir(8));
    const dir = studentDir(stepDir(8), (d) => replaceIn(d, 'app.js', 'const CLEANUP_INTERVAL = 10 * 60 * 1000;', 'const CLEANUP_INTERVAL = 300;'));
    const out = await withServer(stepDir(8), async ({ tail }) => {
      await settle();
      const late = await plant(dir, { ago: '2 hours' });
      await sleep(900);
      return { late, log: scrub(tail(), dir) };
    }, { dir });
    expect(out.log).toBe(`서버가 ${PORT}번 포트에서 기다리고 있어요.\n${CLEANED(1)}\n`);
    expect(await recordNames()).toEqual([]);
  }, 30_000);

  it('🔴 청소가 고른 뒤 지우기 전에 게시물에 들어간 사진은 안 지운다 — 다시 확인하는 조건(postId: null)을 뺀 판은 그 게시물의 사진이 404', async () => {
    const scene = async (edit) => {
      await freshGate(stepDir(8));
      const dir = studentDir(stepDir(8), edit);
      const name = await plant(dir, { ago: '2 hours' });
      return withServer(stepDir(8), async ({ base, tail }) => {
        // 서버가 뜨자마자 청소가 그 기록을 골라 2초 쉬는 사이에, 올린 사람이 그 사진으로 게시물을 만든다
        const tab = browser(base);
        await tab.login('jaehoon');
        const made = await newPost(tab, [`/uploads/${name}`], '청소하는 사이에');
        await sleep(2600);
        return { made: made.status, photo: (await fetch(`${base}/uploads/${name}`)).status, record: (await recordNames()).includes(name), log: scrub(tail(), dir) };
      }, { dir });
    };
    const fixed = await scene(SLOW_CLEANUP);
    const noRecheck = await scene((d) => { SLOW_CLEANUP(d); NO_RECHECK(d); });
    expect(fixed).toMatchObject({ made: 201, photo: 200, record: true });
    expect(fixed.log).not.toContain('장을 지웠어요');
    expect(noRecheck).toMatchObject({ made: 201, photo: 404, record: false });
    expect(noRecheck.log).toContain(CLEANED(1));
    seen.step8DuringCleanup = { fixed, noRecheck };
  }, 60_000);

  it('🔴 청소가 실패해도(데이터베이스가 꺼짐) 서버는 꺼지지 않는다 — try … catch 를 뺀 판(스냅숏)은 처리되지 않은 거부로 꺼진다(node app.js · node --watch)', async () => {
    const snap = read(P('snapshots/p3-50/step8-no-catch.app.js'));
    const src = read(stepDir(8)('app.js'));
    const derived = src.replace(
      /async function cleanUpUploads\(\) \{\n  try \{\n([^]*?)\n  \} catch \(error\) \{\n[^]*?\n  \}\n\}\n/,
      (all, body) => `async function cleanUpUploads() {\n${body.split('\n').map((line) => line.slice(2)).join('\n')}\n}\n`);
    expect(snap).toBe(derived);
    const down = { DATABASE_URL: DOWN_URL };
    const fixed = await runFor(studentDir(stepDir(8)), 2500, down);
    expect(fixed.exited, fixed.log).toBe(false);
    expect(fixed.log).toContain(`서버가 ${PORT2}번 포트에서 기다리고 있어요.`);
    expect(fixed.log).toContain('ECONNREFUSED');
    const noCatch = await runFor(studentDir(stepDir(8), (d) => writeFileSync(join(d, 'app.js'), snap)), 2500, down);
    expect([noCatch.exited, noCatch.code]).toEqual([true, 1]);
    expect(noCatch.log).toContain('ECONNREFUSED');
    const watch = await runFor(studentDir(stepDir(8), (d) => writeFileSync(join(d, 'app.js'), snap)), 2500, down, ['--watch', 'app.js']);
    expect(watch.exited).toBe(false);
    expect(watch.log).toContain("Failed running 'app.js'");
    seen.step8Rejection = { fixed: fixed.log, noCatch: noCatch.log, watch: watch.log };
  }, 60_000);

  it('🔎 시연 — 화면에서 만들기만 막아 기록 하나를 남긴 뒤 시각을 당기고 서버를 다시 켠다: 2시간 · 1시간은 지운다 · 59분은 안 지운다', async () => {
    const pull = {};
    for (const interval of ['2 hours', '1 hour', '59 minutes']) {
      await freshGate(stepDir(8));
      const dir = studentDir(stepDir(8));
      const first = await withServer(stepDir(8), async ({ base }) => {
        const tab = browser(base);
        await tab.login('jaehoon');
        const [url] = (await upload(tab, ['beach.jpg'])).body.data.imageUrls;
        return url;
      }, { dir });
      await gate(`UPDATE uploads SET created_at = created_at - INTERVAL '${interval}' WHERE post_id IS NULL;`);
      pull[interval] = await withServer(stepDir(8), async ({ base, tail }) => {
        await settle();
        return { log: scrub(tail(), dir).trim().split('\n').slice(1).join('\n'), photo: (await fetch(`${base}${first}`)).status, records: (await recordNames()).length, files: filesIn(dir).length };
      }, { dir });
    }
    expect(pull).toEqual({
      '2 hours': { log: CLEANED(1), photo: 404, records: 0, files: 0 },
      '1 hour': { log: CLEANED(1), photo: 404, records: 0, files: 0 },
      '59 minutes': { log: '', photo: 200, records: 1, files: 1 },
    });
    seen.step8Demo = pull;
  }, 60_000);

  it('🔴 Step 5 판에서 만든 게시물의 사진은 기록에 게시물이 안 적힌다(post_id NULL) — Step 8 판으로 바꾸고 2시간 당겨 띄우면 청소가 그 게시물의 사진을 지운다', async () => {
    await freshGate(stepDir(5));
    const dir5 = studentDir(stepDir(5));
    const made = await withServer(stepDir(5), async ({ base }) => {
      const tab = browser(base);
      await tab.login('jaehoon');
      const [url] = (await upload(tab, ['beach.jpg'])).body.data.imageUrls;
      const post = await newPost(tab, [url], 'Step 5 판에서 올린 게시물');
      return { url, status: post.status, id: post.body.data.id };
    }, { dir: dir5 });
    expect(made.status).toBe(201);
    expect(await recordOf(made.url)).toEqual({ post_id: null, uploader: 'jaehoon' });
    await gate("UPDATE uploads SET created_at = created_at - INTERVAL '2 hours' WHERE post_id IS NULL;");
    // Step 6~8 은 마이그레이션이 없어 같은 DB 그대로 — 학생 파일만 Step 8 판으로, 사진 폴더는 그대로
    const dir8 = studentDir(stepDir(8), (d) => cpSync(join(dir5, 'uploads'), join(d, 'uploads'), { recursive: true }));
    const out = await withServer(stepDir(8), async ({ base, tail }) => {
      await settle();
      const tab = browser(base);
      await tab.login('jaehoon');
      return { log: scrub(tail(), dir8).split('\n')[1], photo: (await fetch(`${base}${made.url}`)).status, post: (await tab.get(`/api/v2/posts/${made.id}`)).body.data.imageUrls };
    }, { dir: dir8 });
    expect(out).toEqual({ log: CLEANED(1), photo: 404, post: [made.url] });
    expect(await recordOf(made.url)).toBeUndefined();
    seen.step5to8Hazard = out;
  }, 60_000);

  it('🔎 기록이 없는 옛 파일은 청소가 못 본다 — 옛 DB 에 Step 5 마이그레이션을 얹은 폴더: 파일 5 · 기록 5(그중 하나는 파일이 없다) · 기록 없는 파일 F', async () => {
    await getLegacy();
    const out = await withLegacyServer(8, 'p350_clean8', async ({ dir }) => {
      await settle();
      const files = filesIn(dir);
      const records = (await onDb('p350_clean8', 'SELECT file_name FROM uploads')).map((r) => r.file_name);
      return { files: files.length, records: records.length, withoutRecord: files.filter((f) => !records.includes(f)), withoutFile: records.filter((f) => !files.includes(f)) };
    });
    await dropDb('p350_clean8');
    expect(out).toEqual({ files: 5, records: 5, withoutRecord: [fileOf(legacy.F)], withoutFile: [fileOf(legacy.C)] });
    seen.step8Untracked = out;
  }, 60_000);
});

// ── 축 ⑥ 학생 파일 차이 ────────────────────────────────────────────────────────
// 교안이 인용할 코드 블록의 줄이 각 Step 커밋에 있는지는 교안을 쓴 뒤 이 축에 더한다(지금은 바뀐 파일 목록만 잠근다).
describe('축 ⑥ 학생 파일 차이 — code/p3-48 에서 Step 마다', () => {
  it('🔴 Step 마다 바뀐 학생 파일 · 새 패키지 없음', () => {
    const changed = {};
    for (const n of [4, 5, 6, 7, 8]) changed[n] = changedStudentFiles(BASE_REF, stepRef(n));
    const { name } = step5Migration();
    expect(changed[8]).toEqual([
      'app.js', 'controllers/uploadController.js', 'docs/openapi.js', 'errors.js', `prisma/migrations/${name}/migration.sql`, 'prisma/schema.prisma',
      'requests/photo-owner.http', 'seed.js', 'services/postService.js', 'services/uploadService.js',
    ]);
    for (const n of [4, 5, 6, 7, 8]) {
      expect(showAt(stepRef(n) ?? 'HEAD', 'package.json')).toBe(showAt(BASE_REF, 'package.json'));
      expect(showAt(stepRef(n) ?? 'HEAD', 'package-lock.json')).toBe(showAt(BASE_REF, 'package-lock.json'));
    }
    seen.changedFiles = changed;
  });

  it('🔴 학생 파일에 내부 어휘가 없다 — 게이트 · 판정 · TDD · Step 번호 · 회차 번호(경로 lab/p3-50/ 는 빼고) · 첫 줄 경로 주석', () => {
    const labs = execFileSync('git', ['ls-tree', '--name-only', LINE, 'lab/p3-50/'], { cwd: P('.'), encoding: 'utf8' }).trim().split('\n');
    expect(labs).toEqual(['lab/p3-50/practice3-check.js', 'lab/p3-50/practice3.js']);
    const files = changedStudentFiles(BASE_REF, LINE).concat(labs);
    for (const rel of files) {
      const text = showAt(LINE, rel);
      expect([rel, /게이트|판정|TDD|Step \d|p3-\d\d/.test(text.replace(/lab\/p3-50\//g, ''))]).toEqual([rel, false]);
      if (rel.endsWith('.js')) expect([rel, text.split('\n')[0]]).toEqual([rel, `// ~/instagram-api/${rel}`]);
    }
  });

  it('🔴 이 회차가 새로 쓴 주석·문장에 쓰지 않기로 한 낱말이 없다', () => {
    // «돌려준다»(값을 돌려주다 — return)는 이 코드베이스가 늘 쓰는 다른 낱말이라 뺀다
    const banned = /자리|박다|박아|박힌|결[이을로의]|갈래|몸통|판[이을으]|겹|까닭|걸리|걸린|돌리|돌려(?!주|준|줄)|가르|갈리|재다|재서|벗기|되살|고아/;
    const diff = execFileSync('git', ['diff', BASE_REF, LINE, '--', ...STUDENT_FILES, 'lab/p3-50'], { cwd: P('.'), encoding: 'utf8' });
    const added = diff.split('\n').filter((line) => line.startsWith('+') && !line.startsWith('+++'));
    expect(added.filter((line) => banned.test(line))).toEqual([]);
  });
});

// ── 축 ⑦ 직접 해보기 3 ─────────────────────────────────────────────────────────
const LAB = (name) => showAt(LINE, `lab/p3-50/${name}`);
const ANSWER_WHERE = '    where: { fileName, uploaderId: userId, postId: null },\n';
/** practice3.js 의 where 한 줄을 바꾼 판 — 바꿀 줄이 없으면 던진다. */
const practiceWith = (where) => {
  const src = LAB('practice3.js');
  if (src.split(ANSWER_WHERE).length !== 2) throw new Error('practice3.js 의 where 줄이 정답 판과 다르다');
  return src.replace(ANSWER_WHERE, `    where: ${where},\n`);
};
/** 학생 폴더 모양의 사본에서 `node lab/p3-50/practice3-check.js` — `.env` 대신 환경 변수로 DATABASE_URL. */
const runCheck = async (practice) => {
  const dir = studentDir(stepDir(8), (d) => {
    mkdirSync(join(d, 'lab/p3-50'), { recursive: true });
    writeFileSync(join(d, 'lab/p3-50/practice3.js'), practice);
    writeFileSync(join(d, 'lab/p3-50/practice3-check.js'), LAB('practice3-check.js'));
  });
  const childEnv = { ...process.env, ...env };
  delete childEnv.NODE_ENV;
  try {
    return (await execFileAsync(process.execPath, ['lab/p3-50/practice3-check.js'], { cwd: dir, encoding: 'utf8', env: childEnv })).stdout;
  } catch (error) {
    return `${error.stdout}${error.stderr}`;
  }
};
const OK3 = '같은 사진을 두 게시물에 동시에 적기: true · false\nminji가 올린 사진 적기: false\njaehoon의 다른 사진은 그대로: true\n';

describe('축 ⑦ 직접 해보기 3 — 조건을 붙인 updateMany 의 count', () => {
  it('🔴 시작 판(스냅숏)은 정답 판에서 where 한 줄만 다르다 · 확인 절차가 시작 판 · 틀린 판 넷을 모두 가린다 · 확인용 행은 남지 않는다', async () => {
    const start = read(P('snapshots/p3-50/practice3-start.js'));
    expect(start).toBe(LAB('practice3.js').replace(ANSWER_WHERE, '    // 지금은 파일 이름만 본다 — 조건 두 가지를 더 채운다.\n    where: { fileName },\n'));
    await freshGate(stepDir(8));
    const before = { posts: await count('posts'), uploads: await count('uploads') };
    const outs = {
      answer: await runCheck(LAB('practice3.js')),
      start: await runCheck(start),
      noUnused: await runCheck(practiceWith('{ fileName, uploaderId: userId }')),
      noUploader: await runCheck(practiceWith('{ fileName, postId: null }')),
      noFileName: await runCheck(practiceWith('{ uploaderId: userId, postId: null }')),
    };
    expect(outs.answer).toBe(OK3);
    expect(outs.start).toBe('같은 사진을 두 게시물에 동시에 적기: true · true\nminji가 올린 사진 적기: true\njaehoon의 다른 사진은 그대로: true\n');
    expect(outs.noUnused).toBe('같은 사진을 두 게시물에 동시에 적기: true · true\nminji가 올린 사진 적기: false\njaehoon의 다른 사진은 그대로: true\n');
    expect(outs.noUploader).toBe('같은 사진을 두 게시물에 동시에 적기: true · false\nminji가 올린 사진 적기: true\njaehoon의 다른 사진은 그대로: true\n');
    expect(outs.noFileName).toBe('같은 사진을 두 게시물에 동시에 적기: false · false\nminji가 올린 사진 적기: false\njaehoon의 다른 사진은 그대로: false\n');
    for (const [key, out] of Object.entries(outs)) if (key !== 'answer') expect([key, out]).not.toEqual([key, OK3]);
    expect({ posts: await count('posts'), uploads: await count('uploads') }).toEqual(before);
    seen.practice3 = outs;
  }, 60_000);

  it('🔴 where 가 텅 빈 판도 수업 DB 의 기록을 망가뜨리지 않는다 — 바뀐 다른 기록을 원래 값으로 고쳐 두고 알린다', async () => {
    await freshGate(stepDir(8));
    await fakeUpload('jaehoon');
    await gate("INSERT INTO uploads (file_name, uploader_id, post_id) VALUES ('kept-1.jpg', (SELECT id FROM users WHERE username = 'minji'), 2), ('kept-2.jpg', (SELECT id FROM users WHERE username = 'jaehoon'), 1)");
    const snapshot = async () => gate('SELECT file_name, post_id FROM uploads ORDER BY file_name');
    const before = await snapshot();
    const posts = await count('posts');
    const out = await runCheck(practiceWith('{}'));
    expect(out).toBe('같은 사진을 두 게시물에 동시에 적기: false · false\nminji가 올린 사진 적기: false\njaehoon의 다른 사진은 그대로: false\n'
      + '확인용이 아닌 기록 3개가 바뀌어서 원래 값으로 고쳐 두었어요. where 에 fileName 이 있는지 보세요.\n');
    expect(await snapshot()).toEqual(before);
    expect(await count('posts')).toBe(posts);
    seen.practice3Empty = out;
  }, 60_000);

  it('🔴 연결이 하나 열린 뒤에도 · 여러 번 돌려도 정답 판은 같은 세 줄(10번)', async () => {
    await freshGate(stepDir(8));
    const outs = [];
    for (let i = 0; i < 10; i += 1) outs.push(await runCheck(LAB('practice3.js')));
    expect(tally(outs)).toEqual({ [OK3]: 10 });
  }, 120_000);
});
