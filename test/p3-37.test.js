// p3-37 「응답 봉투와 에러 코드」 게이트 — 백엔드
//
// `7-express-auth` 둘째 회차다(`curriculum.md` 「`p3-37` 착수 결정」). 봉투는 새 주소 `/api/v2` 에만 씌우고,
// 옛 주소 `/api/…` 는 옛 모양 그대로 둔다(파트2 프로젝트가 이미 나간 옛 화면이다 — `p3-34` 답안 주제 1).
// 수업 백엔드에서 바뀌는 학생 파일 — `app.js`(API 라우터 하나를 두 주소에 · 없는 주소는 에러 미들웨어로 · 에러 미들웨어가 sendError) ·
// 새 `middlewares/version.js` · 새 `responses.js` · `errors.js`(코드 → 문장 표 · 클래스는 코드를 받는다) ·
// 컨트롤러 넷 · `middlewares/legacyCursor.js` · 코드를 던지는 서비스 셋과 미들웨어 넷 · 새 `requests/envelope.http` · 실습 `lab/p3-37/`.
//
// 축 ① Step 2 — 가입 409 두 가지가 앞 판에서는 같은 본문 · 이 판의 새 주소에서는 코드가 갈린다 · which-key.js 가 제약 이름을 찍는다
// 축 ② 옛 주소 — code/p3-36 과 같은 요청 54개에 같은 응답(바뀌는 것은 409 의 문장 둘과 그 ETag 뿐)
// 축 ③ 새 주소 — 같은 요청 54개가 상태 코드 · 머리글은 그대로, 본문은 봉투에 담겨 온다 · 요청마다 기대하는 코드
// 축 ④ 봉투 밖 — 뿌리 주소의 글자 · API 문서 JSON · 새 주소의 없는 주소는 봉투 404 · 옛 주소의 없는 주소는 옛 모양
// 축 ⑤ Step 5·7 — `res.json` 을 부르는 줄은 responses.js 둘과 app.js 의 문서 한 줄뿐
// 축 ⑥ Step 6 — 던지는 코드는 모두 표에 있고, 표의 코드는 모두 어딘가에서 쓴다 · 서비스에는 문장이 없다
// 축 ⑦ 이 회차 학생 파일 — code/p3-36 에서 바뀐 파일
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, mkdtempSync, rmSync, cpSync, symlinkSync, existsSync, readdirSync } from 'node:fs';
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
const TPL_DB = 'p337_tpl';
const GATE_DB = 'p337_gate';
const GATE_URL = `postgresql://postgres:postgres@localhost:5432/${GATE_DB}`;
const PORT = 3871;

// 학생 파일은 이 회차 북마크 `code/p3-37` 을 풀어서 읽는다(없으면 작업트리 — 이 회차를 짓는 동안).
const ROUND = roundDir('code/p3-37');
const R = (rel) => join(ROUND.dir, rel);
const BEFORE = roundDir('code/p3-36');
const B = (rel) => join(BEFORE.dir, rel);

const env = { DATABASE_URL: GATE_URL, CORS_ORIGIN: 'http://localhost:3001' };
const STUDENT_FILES = ['app.js', 'db.js', 'errors.js', 'responses.js', 'routes', 'controllers', 'services', 'middlewares', 'schemas', 'docs', 'package.json', 'requests', 'lab/p3-37'];

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

/** 판정 DB 를 템플릿에서 새로 만든다 — 두 판이 시각까지 같은 데이터에서 출발한다. */
const freshGate = () => admin(async (client) => {
  await kick(client, GATE_DB);
  await client.query(`DROP DATABASE IF EXISTS ${GATE_DB}`);
  await kick(client, TPL_DB);
  await client.query(`CREATE DATABASE ${GATE_DB} TEMPLATE ${TPL_DB}`);
});

/** 학생 폴더 모양의 임시 폴더에 그 판의 파일을 깔고 `app.js` 를 띄운다. */
const withServer = async (from, fn, { port = PORT } = {}) => {
  const dir = mkdtempSync(join(tmpdir(), 'p337-srv-'));
  for (const name of STUDENT_FILES) {
    if (existsSync(from(name))) cpSync(from(name), join(dir, name), { recursive: true });
  }
  symlinkSync(P('node_modules'), join(dir, 'node_modules'));
  const srv = await boot(join(dir, 'app.js'), { port, cwd: dir, env: { ...env, PORT: String(port) }, ready: `${port}번 포트에서` });
  try {
    await fn({ ...srv, dir, base: `http://localhost:${port}` });
  } finally {
    await Promise.race([srv.stop(), sleep(500)]);
    rmSync(dir, { recursive: true, force: true });
  }
};
const runScript = (dir, rel) => {
  try {
    return { code: 0, out: execFileSync(process.execPath, [rel], { cwd: dir, encoding: 'utf8', env: { ...process.env, ...env }, stdio: 'pipe' }) };
  } catch (error) {
    return { code: error.status, out: `${error.stdout}${error.stderr}` };
  }
};

const getRes = async (url, init) => {
  const res = await fetch(url, init);
  const type = res.headers.get('content-type') ?? '';
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: type.includes('json') && text !== '' ? JSON.parse(text) : text };
};
const json = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

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
  execFileSync(process.execPath, [P('seed.js')], {
    cwd: P('.'), encoding: 'utf8',
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
});

// ───────── 축 ① Step 2 — 가입 409 는 어느 칸이 겹쳤나 ─────────
const TAEYANG = { emailOrPhone: '010-4242-7777', name: '한태양', username: 'taeyang', password: 'taeyang12' };
const SAME_PHONE = { emailOrPhone: '010-4242-7777', name: '한태양', username: 'taeyang2', password: 'taeyang12' };
const SAME_NAME = { emailOrPhone: '010-4242-8888', name: '김재훈', username: 'jaehoon', password: 'jaehoon12' };

describe('축 ① Step 2 — 가입 409 두 가지', () => {
  const scene = async (from, prefix) => {
    await freshGate();
    let result = null;
    await withServer(from, async ({ base, dir }) => {
      const first = await getRes(`${base}${prefix}/auth/signup`, json('POST', TAEYANG));
      const phone = await getRes(`${base}${prefix}/auth/signup`, json('POST', SAME_PHONE));
      const name = await getRes(`${base}${prefix}/auth/signup`, json('POST', SAME_NAME));
      result = { first, phone, name, dir };
      if (existsSync(join(dir, 'lab/p3-37/which-key.js'))) result.script = runScript(dir, 'lab/p3-37/which-key.js');
    });
    return result;
  };

  it('앞 판 — 둘 다 409 · 본문이 글자까지 같다(화면은 어느 칸인지 모른다)', async () => {
    const { first, phone, name } = await scene(B, '/api');
    expect(first.status).toBe(201);
    expect(phone.status).toBe(409);
    expect(name.status).toBe(409);
    expect(phone.body).toEqual({ message: '이미 쓰고 있는 사용자 이름이나 연락처예요' });
    expect(name.body).toEqual(phone.body);
  }, 60000);

  it('which-key.js — 데이터베이스는 어느 제약이 막았는지 안다(users_username_key · users_phone_key)', async () => {
    const { script } = await scene(R, '/api');
    expect(script.code).toBe(0);
    const lines = script.out;
    expect(lines).toContain("P2002 {\n  originalCode: '23505',\n  originalMessage: 'duplicate key value violates unique constraint \"users_username_key\"',");
    expect(lines).toContain("constraint: { index: 'users_username_key' }");
    expect(lines).toContain("constraint: { index: 'users_phone_key' }");
    expect(lines.indexOf('users_username_key')).toBeLessThan(lines.indexOf('users_phone_key'));
  }, 60000);

  it('이 판의 새 주소 — 같은 409 둘이 코드로 갈린다', async () => {
    const { phone, name } = await scene(R, '/api/v2');
    expect(phone.status).toBe(409);
    expect(phone.body).toEqual({ error: { code: 'PHONE_TAKEN', message: '이미 가입한 휴대폰 번호예요' } });
    expect(name.status).toBe(409);
    expect(name.body).toEqual({ error: { code: 'USERNAME_TAKEN', message: '이미 쓰고 있는 사용자 이름이에요' } });
  }, 60000);

  it('이 판의 옛 주소 — 모양은 그대로 { message } · 문장만 칸에 맞게 갈린다', async () => {
    const { phone, name } = await scene(R, '/api');
    expect(phone.body).toEqual({ message: '이미 가입한 휴대폰 번호예요' });
    expect(name.body).toEqual({ message: '이미 쓰고 있는 사용자 이름이에요' });
  }, 60000);
});

// ───────── 축 ②·③ 같은 요청 54개 ─────────
// 바뀌는 값(세션 ID · 올린 파일 이름 · 이 실행에서 만든 게시물의 시각)만 지우고 나머지는 글자 그대로 대조한다.
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
const ISO = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g;
const normalize = (value) => JSON.parse(JSON.stringify(value).replace(UUID, '<uuid>').replace(ISO, '<time>').replace(/Expires=[^;"]+/g, 'Expires=<date>'));
const HEADERS = ['content-type', 'location', 'allow', 'cache-control', 'deprecation', 'sunset', 'set-cookie', 'etag'];

// 같은 요청을 주소 앞부분(/api · /api/v2)만 바꿔 보낸다 — `p3-36` 판정 축 ③ 의 54개 그대로.
// 🚨 단 «게시물 올리기» 본문은 authorId 로 고쳤다 — p3-36 판은 username 을 보내 400 이었고, 그래서 201 · Location · 고치기 · 지우기를 실제로는 안 재고 있었다.
const SCRIPT = async (base, api) => {
  const out = [];
  const photo = readFileSync(P('requests/photos/beach.jpg'));
  // 봉투를 벗긴 «값» — 다음 요청에 쓸 커서·번호·쿠키를 꺼낼 때 쓴다.
  const value = (res) => (api === '/api/v2' && res.body?.data !== undefined ? res.body.data : res.body);
  const send = async (label, path, init) => {
    const res = await getRes(`${base}${path.startsWith('/api') ? api + path.slice(4) : path}`, init);
    const headers = Object.fromEntries(HEADERS.map((name) => [name, res.headers.get(name)]));
    const raw = JSON.stringify(res.body);
    if (new RegExp(UUID.source).test(raw) || new RegExp(ISO.source).test(raw)) headers.etag = headers.etag && '<본문 따라 바뀜>';
    if (headers.location) headers.location = headers.location.replace(/\d+$/, '<id>');
    out.push({ label, status: res.status, headers, body: res.body });
    return res;
  };
  const first = await send('목록 둘', '/api/posts?limit=2');
  await send('다음 페이지', `/api/posts?limit=2&cursor=${value(first).nextCursor}`);
  await send('목록', '/api/posts');
  await send('2번 사람이 보는 목록', '/api/posts?userId=2');
  await send('이름으로 거르기', '/api/posts?username=minji');
  await send('옛 커서', '/api/posts?cursor=2');
  await send('없는 옛 커서', '/api/posts?cursor=999');
  await send('규칙에 안 맞는 limit', '/api/posts?limit=0');
  await send('깨진 커서', '/api/posts?cursor=abc');
  await send('게시물 하나', '/api/posts/1');
  await send('숫자 아닌 번호', '/api/posts/abc');
  await send('없는 게시물', '/api/posts/999');
  const created = await send('게시물 올리기', '/api/posts', json('POST', { authorId: 2, content: '게이트', imageUrls: ['/images/post-8.jpg'] }));
  await send('규칙에 안 맞는 게시물', '/api/posts', json('POST', { username: 'jaehoon' }));
  await send('text/plain 게시물', '/api/posts', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'hi' });
  await send('깨진 JSON', '/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"a":' });
  await send('게시물 고치기', `/api/posts/${value(created).id}`, json('PATCH', { content: '고친 글' }));
  await send('없는 게시물 고치기', '/api/posts/999', json('PATCH', { content: '고친 글' }));
  await send('게시물 지우기', `/api/posts/${value(created).id}`, { method: 'DELETE' });
  await send('없는 게시물 지우기', '/api/posts/999', { method: 'DELETE' });
  await send('받지 않는 HTTP 메서드', '/api/posts/1', { method: 'PUT' });
  await send('좋아요 목록', '/api/posts/1/likes');
  await send('좋아요', '/api/posts/1/likes/4', { method: 'PUT' });
  await send('좋아요 또', '/api/posts/1/likes/4', { method: 'PUT' });
  await send('좋아요 취소', '/api/posts/1/likes/4', { method: 'DELETE' });
  await send('없는 게시물 좋아요', '/api/posts/999/likes/4', { method: 'PUT' });
  await send('없는 사람 좋아요', '/api/posts/1/likes/999', { method: 'PUT' });
  await send('숫자 아닌 사람', '/api/posts/1/likes/x', { method: 'PUT' });
  await send('좋아요를 POST로', '/api/posts/1/likes', { method: 'POST' });
  await send('가입(이메일)', '/api/auth/signup', json('POST', { emailOrPhone: 'sora@example.com', name: '한소라', username: 'sora', password: 'sora1234' }));
  await send('가입(휴대폰)', '/api/auth/signup', json('POST', { emailOrPhone: '010-1234-5678', name: '박하늘', username: 'haneul', password: 'haneul12' }));
  await send('이미 있는 이름', '/api/auth/signup', json('POST', { emailOrPhone: 'jaehoon@example.com', name: '김재훈', username: 'jaehoon', password: 'jaehoon1234' }));
  await send('같은 번호 다른 모양', '/api/auth/signup', json('POST', { emailOrPhone: '01012345678', name: '박하늘', username: 'haneul2', password: 'haneul12' }));
  await send('규칙에 안 맞는 가입', '/api/auth/signup', json('POST', { emailOrPhone: 'x', name: '', username: '한글', password: '1' }));
  await send('중복 확인 이름', '/api/auth/check-duplicate?type=username&value=sora');
  await send('중복 확인 번호', '/api/auth/check-duplicate?type=phone&value=010-1234-5678');
  await send('중복 확인 번호 하이픈 없이', '/api/auth/check-duplicate?type=phone&value=01012345678');
  await send('중복 확인 이메일', '/api/auth/check-duplicate?type=email&value=%20sora@example.com%20');
  await send('중복 확인 빈 번호', '/api/auth/check-duplicate?type=phone&value=010-9999-0000');
  await send('중복 확인 틀린 종류', '/api/auth/check-duplicate?type=name&value=a');
  const login = await send('로그인', '/api/auth/login', json('POST', { username: 'jaehoon' }));
  await send('없는 이름으로 로그인', '/api/auth/login', json('POST', { username: 'hana' }));
  const cookie = login.headers.get('set-cookie').split(';')[0];
  await send('나는 누구', '/api/auth/me', { headers: { Cookie: cookie } });
  await send('헤더로 나는 누구', '/api/auth/me', { headers: { Authorization: `Bearer ${cookie.split('=')[1]}` } });
  await send('쿠키 없이 나는 누구', '/api/auth/me');
  await send('고친 쿠키', '/api/auth/me', { headers: { Cookie: 'sessionId=1' } });
  await send('로그아웃', '/api/auth/logout', { method: 'POST', headers: { Cookie: cookie } });
  await send('로그아웃 뒤 나는 누구', '/api/auth/me', { headers: { Cookie: cookie } });
  await send('로그인을 GET으로', '/api/auth/login');
  const form = new FormData();
  form.append('images', new Blob([photo], { type: 'image/jpeg' }), 'beach.jpg');
  await send('사진 올리기', '/api/uploads', { method: 'POST', body: form });
  await send('사진 없이 올리기', '/api/uploads', { method: 'POST', body: new FormData() });
  const memo = new FormData();
  memo.append('images', new Blob(['memo'], { type: 'text/plain' }), 'memo.txt');
  await send('사진 아닌 파일', '/api/uploads', { method: 'POST', body: memo });
  await send('없는 주소', '/api/nope');
  await send('뿌리 주소', '/');
  return normalize(out);
};

// 요청마다 새 주소가 내야 할 에러 코드 — 실패 응답 23개
const CODES = {
  '없는 옛 커서': null,
  '규칙에 안 맞는 limit': 'VALIDATION_FAILED',
  '깨진 커서': 'INVALID_CURSOR',
  '숫자 아닌 번호': 'POST_NOT_FOUND',
  '없는 게시물': 'POST_NOT_FOUND',
  '규칙에 안 맞는 게시물': 'VALIDATION_FAILED',
  'text/plain 게시물': 'VALIDATION_FAILED',
  '깨진 JSON': 'INVALID_BODY',
  '없는 게시물 고치기': 'POST_NOT_FOUND',
  '없는 게시물 지우기': 'POST_NOT_FOUND',
  '받지 않는 HTTP 메서드': 'METHOD_NOT_ALLOWED',
  '없는 게시물 좋아요': 'POST_OR_USER_NOT_FOUND',
  '없는 사람 좋아요': 'POST_OR_USER_NOT_FOUND',
  '숫자 아닌 사람': 'USER_NOT_FOUND',
  '좋아요를 POST로': 'METHOD_NOT_ALLOWED',
  '이미 있는 이름': 'USERNAME_TAKEN',
  '같은 번호 다른 모양': 'PHONE_TAKEN',
  '규칙에 안 맞는 가입': 'VALIDATION_FAILED',
  '중복 확인 틀린 종류': 'VALIDATION_FAILED',
  '없는 이름으로 로그인': 'LOGIN_FAILED',
  '쿠키 없이 나는 누구': 'LOGIN_REQUIRED',
  '고친 쿠키': 'LOGIN_REQUIRED',
  '로그아웃 뒤 나는 누구': 'LOGIN_REQUIRED',
  '로그인을 GET으로': 'METHOD_NOT_ALLOWED',
  '사진 없이 올리기': 'NO_IMAGES',
  '사진 아닌 파일': 'NOT_AN_IMAGE',
  '없는 주소': 'ROUTE_NOT_FOUND',
};

let before = null;
let oldPath = null;
let newPath = null;

describe('축 ②·③ 같은 요청 54개 — 옛 주소와 새 주소', () => {
  beforeAll(async () => {
    await freshGate();
    await withServer(B, async ({ base }) => { before = await SCRIPT(base, '/api'); });
    await freshGate();
    await withServer(R, async ({ base }) => { oldPath = await SCRIPT(base, '/api'); });
    await freshGate();
    await withServer(R, async ({ base }) => { newPath = await SCRIPT(base, '/api/v2'); });
  }, 180000);

  it('축 ② 옛 주소 — code/p3-36 과 같다(409 의 문장 둘과 그 ETag 만 바뀐다)', () => {
    expect(oldPath.length).toBe(54);
    const changed = { '이미 있는 이름': '이미 쓰고 있는 사용자 이름이에요', '같은 번호 다른 모양': '이미 가입한 휴대폰 번호예요' };
    for (let i = 0; i < before.length; i += 1) {
      const label = before[i].label;
      if (changed[label]) {
        expect(before[i].body, label).toEqual({ message: '이미 쓰고 있는 사용자 이름이나 연락처예요' });
        expect(oldPath[i].body, label).toEqual({ message: changed[label] });
        expect({ ...oldPath[i], body: null, headers: { ...oldPath[i].headers, etag: null } }, label)
          .toEqual({ ...before[i], body: null, headers: { ...before[i].headers, etag: null } });
        continue;
      }
      expect(oldPath[i], label).toEqual(before[i]);
    }
    expect(new Set(oldPath.map((one) => one.status))).toEqual(new Set([200, 201, 400, 401, 404, 405, 409]));
  });

  it('축 ③ 새 주소 — 상태 코드와 머리글은 옛 주소와 같고, 본문은 봉투에 담긴다', () => {
    expect(newPath.length).toBe(54);
    let errors = 0;
    for (let i = 0; i < oldPath.length; i += 1) {
      const old = oldPath[i];
      const now = newPath[i];
      expect(now.label).toBe(old.label);
      expect(now.status, old.label).toBe(old.status);
      // ETag 은 본문으로 계산한다 — 봉투가 더해져 값이 다르다. 있는지만 같으면 된다.
      expect({ ...now.headers, etag: Boolean(now.headers.etag) }, old.label).toEqual({ ...old.headers, etag: Boolean(old.headers.etag) });
      if (old.label === '뿌리 주소') {
        expect(now.body).toBe(old.body);
        continue;
      }
      if (old.status < 400) {
        expect(now.body, old.label).toEqual({ data: old.body });
        continue;
      }
      errors += 1;
      expect(Object.keys(now.body), old.label).toEqual(['error']);
      const { code, message, details } = now.body.error;
      expect(code, old.label).toBe(CODES[old.label]);
      expect(message, old.label).toBe(old.body.message);
      expect(details, old.label).toEqual(old.body.details);
      // details 가 없으면 키도 없다 — { "code", "message" } 만 실린다.
      if (old.body.details === undefined) expect(Object.keys(now.body.error), old.label).toEqual(['code', 'message']);
    }
    expect(errors).toBe(Object.values(CODES).filter(Boolean).length);
    // 봉투에 success 를 두지 않는다 — 성공·실패는 상태 줄이 말한다.
    expect(JSON.stringify(newPath)).not.toContain('"success"');
  });

  it('축 ③ 옛 커서로 없는 번호를 보내면 — 컨트롤러 밖(legacyCursor)의 빈 목록도 봉투에 담긴다', () => {
    const one = newPath.find((x) => x.label === '없는 옛 커서');
    expect(one.status).toBe(200);
    expect(one.body).toEqual({ data: { items: [], hasNext: false, nextCursor: null } });
    expect(one.headers.deprecation).toBe('@1796083200');
  });
});

// ───────── 축 ④ 봉투 밖 · 없는 주소 ─────────
describe('축 ④ 봉투를 씌우지 않는 응답과 없는 주소', () => {
  it('API 문서 JSON 은 OpenAPI 모양 그대로 · 새 주소의 없는 주소는 봉투 404 · /api/v2 밖의 없는 주소는 옛 모양', async () => {
    await freshGate();
    await withServer(R, async ({ base }) => {
      const doc = await getRes(`${base}/api/openapi.json`);
      expect(doc.status).toBe(200);
      expect(doc.body.openapi).toBe('3.2.0');
      expect(doc.body.data).toBeUndefined();
      expect((await getRes(`${base}/api/v2/nope`)).body).toEqual({ error: { code: 'ROUTE_NOT_FOUND', message: '그런 주소는 없어요' } });
      expect((await getRes(`${base}/api/v2/post`)).status).toBe(404);
      expect((await getRes(`${base}/api/nope`)).body).toEqual({ message: '그런 주소는 없어요' });
      expect((await getRes(`${base}/nope`)).body).toEqual({ message: '그런 주소는 없어요' });
      const docs = await fetch(`${base}/api/docs/`);
      expect(docs.status).toBe(200);
      expect(docs.headers.get('content-type')).toContain('text/html');
    });
  }, 60000);
});

// ───────── 축 ⑤ 응답 본문을 보내는 줄 ─────────
describe('축 ⑤ Step 5·7 — res.json 을 부르는 줄', () => {
  const sendLines = (from) => {
    const out = [];
    const scan = (rel) => read(from(rel)).split('\n').forEach((line) => {
      if (/\bres\./.test(line) && /\.(json|send)\(/.test(line)) out.push(rel);
    });
    for (const dir of ['routes', 'controllers', 'services', 'middlewares']) {
      for (const name of readdirSync(from(dir)).filter((n) => n.endsWith('.js'))) scan(`${dir}/${name}`);
    }
    for (const rel of ['app.js', 'responses.js', 'errors.js']) if (existsSync(from(rel))) scan(rel);
    return out.reduce((acc, f) => ({ ...acc, [f]: (acc[f] ?? 0) + 1 }), {});
  };

  it('앞 판 — 컨트롤러 넷 · app.js · legacyCursor', () => {
    expect(sendLines(B)).toEqual({
      'controllers/authController.js': 5, 'controllers/likeController.js': 3, 'controllers/postController.js': 5, 'controllers/uploadController.js': 1,
      'middlewares/legacyCursor.js': 1, 'app.js': 6,
    });
  });

  it('이 판 — responses.js 의 네 줄(두 버전 × 성공·실패)과 app.js 의 뿌리 주소 · 문서 두 줄뿐', () => {
    expect(sendLines(R)).toEqual({ 'responses.js': 4, 'app.js': 2 });
    const app = read(R('app.js'));
    expect(app).toContain("res.send('인스타그램 서버가 살아 있어요');");
    expect(app).toContain('res.json(openapi);');
  });
});

// ───────── 축 ⑥ 코드와 문장 ─────────
describe('축 ⑥ Step 6 — 에러 코드와 문장 표', () => {
  const sources = () => ['app.js', ...['routes', 'controllers', 'services', 'middlewares']
    .flatMap((dir) => readdirSync(R(dir)).filter((n) => n.endsWith('.js')).map((n) => `${dir}/${n}`))];

  it('던지는 코드는 모두 표에 있고, 표의 코드는 모두 어딘가에서 쓴다', async () => {
    const { MESSAGES } = await import(R('errors.js'));
    const all = sources().map((rel) => read(R(rel))).join('\n');
    const used = new Set([...all.matchAll(/'([A-Z][A-Z_]+[A-Z])'/g)].map((m) => m[1]).filter((code) => /_/.test(code) || code in MESSAGES));
    for (const code of used) if (/(NOT_FOUND|TAKEN|FAILED|REQUIRED|INVALID|NO_|NOT_AN|IMAGE|ALLOWED|INTERNAL|UNEXPECTED)/.test(code)) expect(MESSAGES, code).toHaveProperty(code);
    for (const code of Object.keys(MESSAGES)) expect(used.has(code), code).toBe(true);
    expect(Object.keys(MESSAGES).length).toBe(19);
  });

  it('서비스와 미들웨어에는 사람이 읽을 문장이 없다 — 문장은 errors.js 표에만', () => {
    for (const rel of sources().filter((r) => r.startsWith('services/') || r.startsWith('middlewares/'))) {
      const code = read(R(rel)).split('\n').filter((line) => !/^\s*\/\//.test(line)).join('\n');
      expect(code, rel).not.toMatch(/'[^']*[가-힣][^']*'/);
    }
  });

  it('같은 문장은 한 번만 — 앞 판에서 다섯 곳에 흩어져 있던 «그런 게시물은 없어요»', () => {
    const count = (from, files) => files.map((rel) => read(from(rel)).split('그런 게시물은 없어요').length - 1).reduce((a, b) => a + b, 0);
    const files = ['services/postService.js', 'services/likeService.js', 'middlewares/params.js', 'errors.js'];
    expect(count(B, files)).toBe(5);
    expect(count(R, files)).toBe(1);
  });
});

// ───────── 축 ⑦ 이 회차 학생 파일 ─────────
describe('축 ⑦ 이 회차 학생 파일 — code/p3-36 에서 바뀐 파일', () => {
  it('바뀐 파일 · 실습은 lab/p3-37/ 만', () => {
    const changed = execFileSync('git', ['diff', '--name-only', 'code/p3-36', ROUND.fromBookmark ? 'code/p3-37' : 'HEAD', '--', '.', ':!test', ':!snapshots', ':!sql', ':!lab'], { cwd: P('.'), encoding: 'utf8' })
      .trim().split('\n').filter(Boolean).sort();
    expect(changed).toEqual([
      'app.js',
      'controllers/authController.js', 'controllers/likeController.js', 'controllers/postController.js', 'controllers/uploadController.js',
      'errors.js',
      'middlewares/legacyCursor.js', 'middlewares/methods.js', 'middlewares/params.js', 'middlewares/upload.js', 'middlewares/validate.js', 'middlewares/version.js',
      'requests/envelope.http',
      'responses.js',
      'services/authService.js', 'services/likeService.js', 'services/postService.js', 'services/userService.js',
    ]);
    const lab = execFileSync('git', ['diff', '--name-only', 'code/p3-36', ROUND.fromBookmark ? 'code/p3-37' : 'HEAD', '--', 'lab'], { cwd: P('.'), encoding: 'utf8' })
      .trim().split('\n').filter(Boolean);
    expect(lab.every((one) => one.startsWith('lab/p3-37/'))).toBe(true);
    expect(lab).toContain('lab/p3-37/which-key.js');
  });
});

// ───────── 축 ⑧ Step 7 중간 판 — 버전 표시가 express.json() 보다 늦으면 ─────────
describe('축 ⑧ Step 7 — 본문을 못 읽은 실패는 라우터에 닿기 전에 난다', () => {
  const withApp = async (src, fn) => {
    const dir = mkdtempSync(join(tmpdir(), 'p337-mid-'));
    for (const name of STUDENT_FILES) {
      if (existsSync(R(name))) cpSync(R(name), join(dir, name), { recursive: true });
    }
    symlinkSync(P('node_modules'), join(dir, 'node_modules'));
    cpSync(src, join(dir, 'app.js'));
    const srv = await boot(join(dir, 'app.js'), { port: PORT, cwd: dir, env: { ...env, PORT: String(PORT) }, ready: `${PORT}번 포트에서` });
    try {
      await fn(`http://localhost:${PORT}`);
    } finally {
      await Promise.race([srv.stop(), sleep(500)]);
      rmSync(dir, { recursive: true, force: true });
    }
  };
  const broken = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"a":' };

  it('중간 판(apiVersion(2) 가 /api/v2 마운트 줄에) — 깨진 JSON 만 옛 모양 · 없는 게시물은 새 모양', async () => {
    await freshGate();
    await withApp(P('snapshots/p3-37.step7-version-late.app.js'), async (base) => {
      expect(await getRes(`${base}/api/v2/posts`, broken)).toMatchObject({ status: 400, body: { message: '보낸 내용을 읽을 수 없어요' } });
      expect((await getRes(`${base}/api/v2/posts/999`)).body).toEqual({ error: { code: 'POST_NOT_FOUND', message: '그런 게시물은 없어요' } });
    });
  }, 60000);

  it('이 판(express.json() 위에서 버전을 적는다) — 깨진 JSON 도 새 모양', async () => {
    await freshGate();
    await withApp(R('app.js'), async (base) => {
      expect(await getRes(`${base}/api/v2/posts`, broken)).toMatchObject({ status: 400, body: { error: { code: 'INVALID_BODY', message: '보낸 내용을 읽을 수 없어요' } } });
    });
  }, 60000);
});
