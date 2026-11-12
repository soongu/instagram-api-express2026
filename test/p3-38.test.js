// p3-38 「새 화면은 v2 로 — 화면 잇기와 API 문서」 게이트 — 백엔드
//
// `7-express-auth` 셋째 회차다(`curriculum.md` 「`p3-38` 착수 결정」). 화면 쪽(수업 프로젝트)은 `instagram-next/.verify` 가 잰다.
// 수업 백엔드에서 바뀌는 학생 파일 — 새 `middlewares/deprecation.js`(날짜 상수 둘 · setDeprecation · oldApiNotice) ·
// `middlewares/legacyCursor.js`(그 상수를 쓴다) · `app.js`(문서 두 줄을 API 마운트 위로 · 옛 마운트 줄에 oldApiNotice) ·
// `docs/openapi.js`(한 장에 두 버전 + 가입 · errorOf · ErrorCode) · 새 `requests/deprecation.http` · 실습 `lab/p3-38/`.
//
// 축 ① Step 6 — 옛 주소에만 Deprecation · Sunset · Link (새 주소 · 새 주소의 없는 주소 · 문서 · 뿌리 주소에는 없다)
// 축 ② 같은 요청 54개 — 옛 주소 · 새 주소 모두 code/p3-37 과 같다(옛 주소에 세 머리글이 더해진 것 · 옛 커서의 Link 만 다르다)
// 축 ③ Step 6 중간 판 — 문서 두 줄이 마운트 아래면 문서 주소에도 알림이 붙는다(겪기)
// 축 ④ Step 7 — 문서(두 버전 · 봉투 · 가입 409 의 세 코드 · ErrorCode = MESSAGES 의 키 · 옛 주소 deprecated · 끝나는 날은 상수에서)
// 축 ⑤ MESSAGES 에 없는 코드를 문서에 적으면 서버가 뜨지 않는다
// 축 ⑥ 이 회차 학생 파일 — code/p3-37 에서 바뀐 파일
// 축 ⑦ 직접 해보기 3 · 과제 [기초] — 시작 판 · 정답 판 · 틀린 판
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
const TPL_DB = 'p338_tpl';
const GATE_DB = 'p338_gate';
const GATE_URL = `postgresql://postgres:postgres@localhost:5432/${GATE_DB}`;
const PORT = 3891;

// 학생 파일은 이 회차 북마크 `code/p3-38` 을 풀어서 읽는다(없으면 작업트리 — 이 회차를 짓는 동안).
const ROUND = roundDir('code/p3-38');
const R = (rel) => join(ROUND.dir, rel);
const BEFORE = roundDir('code/p3-37');
const B = (rel) => join(BEFORE.dir, rel);

const env = { DATABASE_URL: GATE_URL, CORS_ORIGIN: 'http://localhost:3001' };
const STUDENT_FILES = ['app.js', 'db.js', 'errors.js', 'responses.js', 'routes', 'controllers', 'services', 'middlewares', 'schemas', 'docs', 'package.json', 'requests', 'lab/p3-38'];

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
  const dir = mkdtempSync(join(tmpdir(), 'p338-srv-'));
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
  // 🚨 2026-11-10 p3-39 — 작업트리 스키마에 users.password_hash 가 생겼다. 시드가 작업트리 클라이언트로 돌아 그 칸까지 고르므로
  //    (P2022) 이 회차의 마이그레이션 뒤로 tip 의 것을 얹는다. 이 회차의 학생 파일은 그 칸을 읽지도 쓰지도 않는다(test/helpers/tip-schema.js).
  await applyMigrationsAfter(tpl, '20261106135135_add_posts_feed_index');
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

// ───────── 축 ②·③ 같은 요청 54개 ─────────
// 바뀌는 값(세션 ID · 올린 파일 이름 · 이 실행에서 만든 게시물의 시각)만 지우고 나머지는 글자 그대로 대조한다.
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
const ISO = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g;
const normalize = (value) => JSON.parse(JSON.stringify(value).replace(UUID, '<uuid>').replace(ISO, '<time>').replace(/Expires=[^;"]+/g, 'Expires=<date>'));
const HEADERS = ['content-type', 'location', 'allow', 'cache-control', 'deprecation', 'sunset', 'link', 'set-cookie', 'etag'];

// 같은 요청을 주소 앞부분(/api · /api/v2)만 바꿔 보낸다 — `p3-37` 판정 축 ②·③ 의 54개 그대로.
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

const NOTICE = { deprecation: '@1796083200', sunset: 'Mon, 01 Mar 2027 00:00:00 GMT', link: '</api/docs>; rel="deprecation"; type="text/html"' };
const noticeOf = (res) => ({ deprecation: res.headers.get('deprecation'), sunset: res.headers.get('sunset'), link: res.headers.get('link') });
const NONE = { deprecation: null, sunset: null, link: null };

// ───────── 축 ① 옛 주소에만 알림 ─────────
describe('축 ① Step 6 — 옛 주소에만 Deprecation · Sunset · Link', () => {
  let got = null;
  beforeAll(async () => {
    await freshGate();
    await withServer(R, async ({ base }) => {
      got = {};
      for (const path of ['/api/posts?limit=2', '/api/v2/posts?limit=2', '/api/nope', '/api/v2/nope', '/api/openapi.json', '/api/docs/', '/', '/api/posts?cursor=2', '/api/v2/posts?cursor=2', '/api/posts/999', '/api/auth/me']) {
        got[path] = await getRes(`${base}${path}`);
      }
    });
  }, 60000);

  it('옛 주소 — 성공 · 404 · 401 모두 세 머리글', () => {
    for (const path of ['/api/posts?limit=2', '/api/nope', '/api/posts/999', '/api/auth/me']) expect(noticeOf(got[path]), path).toEqual(NOTICE);
  });
  it('새 주소 · 새 주소의 없는 주소 · 문서 · 뿌리 주소 — 없다', () => {
    for (const path of ['/api/v2/posts?limit=2', '/api/v2/nope', '/api/openapi.json', '/api/docs/', '/']) expect(noticeOf(got[path]), path).toEqual(NONE);
    expect(got['/api/v2/nope'].body).toEqual({ error: { code: 'ROUTE_NOT_FOUND', message: '그런 주소는 없어요' } });
  });
  it('옛 커서 — 새 주소에서도 같은 값 하나씩(상수 한 곳)', () => {
    for (const path of ['/api/posts?cursor=2', '/api/v2/posts?cursor=2']) expect(noticeOf(got[path]), path).toEqual(NOTICE);
  });
  it('날짜 상수는 deprecation.js 한 곳 — legacyCursor 에는 날짜가 없다', () => {
    expect(read(R('middlewares/legacyCursor.js'))).not.toMatch(/new Date\(/);
    expect(read(R('middlewares/legacyCursor.js'))).toContain("import { setDeprecation } from './deprecation.js';");
    expect(read(R('middlewares/deprecation.js')).match(/new Date\(/g)).toHaveLength(2);
  });
});

// ───────── 축 ② 같은 요청 54개 ─────────
let before = null;
let now = null;
let beforeV2 = null;
let nowV2 = null;

describe('축 ② 같은 요청 54개 — code/p3-37 과 같다', () => {
  beforeAll(async () => {
    await freshGate();
    await withServer(B, async ({ base }) => { before = await SCRIPT(base, '/api'); });
    await freshGate();
    await withServer(R, async ({ base }) => { now = await SCRIPT(base, '/api'); });
    await freshGate();
    await withServer(B, async ({ base }) => { beforeV2 = await SCRIPT(base, '/api/v2'); });
    await freshGate();
    await withServer(R, async ({ base }) => { nowV2 = await SCRIPT(base, '/api/v2'); });
  }, 240000);

  // 캐시 줄이 본문 읽기 앞으로 올라가, 본문을 못 읽은 실패(깨진 JSON)에도 private, no-cache 가 붙는다.
  const cacheFix = (one) => (one.label === '깨진 JSON' ? { 'cache-control': 'private, no-cache' } : {});

  it('옛 주소 — 상태 코드 · 본문 · 다른 머리글은 그대로, 세 머리글이 더해졌다(뿌리 주소만 빼고 · 깨진 JSON 포함)', () => {
    expect(now.length).toBe(54);
    expect(before.find((one) => one.label === '깨진 JSON').headers['cache-control']).toBeNull();
    for (let i = 0; i < before.length; i += 1) {
      const { label } = before[i];
      const expected = label === '뿌리 주소' ? before[i].headers : { ...before[i].headers, ...NOTICE, ...cacheFix(before[i]) };
      expect({ ...now[i], headers: { ...now[i].headers, etag: null } }, label).toEqual({ ...before[i], headers: { ...expected, etag: null } });
      expect(now[i].headers.etag, label).toBe(before[i].headers.etag);
    }
  });

  it('새 주소 — 그대로(옛 커서 응답에 Link · 깨진 JSON 에 캐시 줄만 더해졌다)', () => {
    expect(nowV2.length).toBe(54);
    for (let i = 0; i < beforeV2.length; i += 1) {
      const { label } = beforeV2[i];
      const expected = { ...beforeV2[i].headers, ...(beforeV2[i].headers.deprecation ? { link: NOTICE.link } : {}), ...cacheFix(beforeV2[i]) };
      expect(nowV2[i], label).toEqual({ ...beforeV2[i], headers: expected });
    }
    expect(nowV2.filter((one) => one.headers.link).map((one) => one.label)).toEqual(['옛 커서', '없는 옛 커서']);
  });
});

// ───────── 축 ③ Step 6 중간 판 ─────────
describe('축 ③ Step 6 중간 판 — 문서 두 줄이 마운트 아래에 있으면', () => {
  const SNAP = P('snapshots/p3-38.step6-docs-below.app.js');

  it('스냅숏은 code/p3-37 의 app.js 에 알림 두 줄만 더한 판이다(import · 버전 표시 바로 아래)', () => {
    const was = read(B('app.js'));
    const expected = was
      .replace("import { apiVersion } from './middlewares/version.js';\n", "import { apiVersion } from './middlewares/version.js';\nimport { oldApiNotice } from './middlewares/deprecation.js';\n")
      .replace("app.use('/api/v2', apiVersion(2));\napp.use(express.json());\n", "app.use('/api/v2', apiVersion(2));\n// 옛 주소로 온 요청에는 언제까지 받을지 알린다 — 본문을 못 읽은 실패에도 붙게 이것도 본문을 읽기 전에.\napp.use('/api', oldApiNotice);\napp.use(express.json());\n");
    expect(expected).not.toBe(was);
    expect(read(SNAP)).toBe(expected);
  });

  it('최종 판은 스냅숏에서 문서 두 줄과 캐시 줄을 버전 표시 위로 옮긴 판이다', () => {
    const lines = (text) => text.split('\n').filter((line) => line.trim() !== '' && !line.startsWith('//')).sort();
    expect(lines(read(R('app.js')))).toEqual(lines(read(SNAP)));
    const app = read(R('app.js'));
    expect(app.indexOf("app.use('/api', privateNoCache);")).toBeLessThan(app.indexOf("app.get('/api/openapi.json'"));
    expect(app.indexOf("app.use('/api/docs'")).toBeLessThan(app.indexOf("app.use('/api/v2', apiVersion(2));"));
    expect(app.indexOf("app.use('/api', oldApiNotice);")).toBeLessThan(app.indexOf('app.use(express.json());'));
  });

  it('문서 주소에도 알림이 붙는다 → 최종 판은 문서를 위로 올려 붙지 않는다', async () => {
    await freshGate();
    const from = (name) => (name === 'app.js' ? SNAP : R(name));
    await withServer(from, async ({ base }) => {
      expect(noticeOf(await getRes(`${base}/api/openapi.json`))).toEqual(NOTICE);
      expect(noticeOf(await getRes(`${base}/api/docs/`))).toEqual(NOTICE);
      expect(noticeOf(await getRes(`${base}/api/v2/posts?limit=1`))).toEqual(NONE);
      expect(noticeOf(await getRes(`${base}/api/v2/nope`))).toEqual(NONE);
    });
  }, 60000);
});

// ───────── 축 ④ 문서 ─────────
describe('축 ④ Step 7 — 문서', () => {
  let doc = null;
  beforeAll(async () => {
    await freshGate();
    await withServer(R, async ({ base }) => { doc = (await getRes(`${base}/api/openapi.json`)).body; });
  }, 60000);

  it('한 장에 두 버전 + 가입', () => {
    expect(doc.openapi).toBe('3.2.0');
    expect(Object.keys(doc.paths)).toEqual(['/api/v2/posts', '/api/v2/auth/signup', '/api/posts']);
  });
  it('새 주소 — 성공은 data 에 · 실패는 그 응답이 보낼 수 있는 코드만', () => {
    const list = doc.paths['/api/v2/posts'].get.responses;
    expect(list[200].content['application/json'].schema).toEqual({ type: 'object', required: ['data'], properties: { data: { $ref: '#/components/schemas/PostPage' } } });
    expect(list[400].content['application/json'].schema.properties.error.properties.code.enum).toEqual(['VALIDATION_FAILED', 'INVALID_CURSOR']);
    const signup = doc.paths['/api/v2/auth/signup'].post.responses;
    expect(signup[409].content['application/json'].schema.properties.error.properties.code.enum).toEqual(['USERNAME_TAKEN', 'EMAIL_TAKEN', 'PHONE_TAKEN']);
    expect(signup[201].content['application/json'].schema.required).toEqual(['data']);
  });
  it('ErrorCode 는 MESSAGES 의 키 그대로 — 문서에 적힌 코드는 모두 그 안에 있다', async () => {
    const { MESSAGES } = await import(`${R('errors.js')}?t=${Date.now()}`);
    expect(doc.components.schemas.ErrorCode.enum).toEqual(Object.keys(MESSAGES));
    const used = JSON.stringify(doc.paths).match(/"enum":\[[^\]]*\]/g).flatMap((one) => JSON.parse(one.slice(7)));
    for (const code of used) expect(Object.keys(MESSAGES)).toContain(code);
  });
  it('옛 주소 — deprecated · 끝나는 날과 옮길 주소 · 옛 형식 응답', () => {
    for (const method of ['get', 'post']) {
      const op = doc.paths['/api/posts'][method];
      expect(op.deprecated, method).toBe(true);
      expect(op.description).toBe('옛 주소예요. 2027-03-01에 끝나요. 같은 일을 하는 /api/v2 주소로 옮기세요.');
    }
    expect(doc.paths['/api/posts'].get.responses[200].content['application/json'].schema).toEqual({ $ref: '#/components/schemas/PostPage' });
    expect(doc.paths['/api/v2/posts'].get.deprecated).toBeUndefined();
  });
});

// ───────── 축 ⑤ 없는 코드를 적으면 ─────────
describe('축 ⑤ MESSAGES 에 없는 코드를 문서에 적으면', () => {
  it('서버가 뜨지 않고 그 코드 이름을 찍는다', () => {
    const dir = mkdtempSync(join(tmpdir(), 'p338-typo-'));
    try {
      for (const name of STUDENT_FILES) if (existsSync(R(name))) cpSync(R(name), join(dir, name), { recursive: true });
      symlinkSync(P('node_modules'), join(dir, 'node_modules'));
      const docs = join(dir, 'docs/openapi.js');
      const src = read(docs);
      expect(src).toContain("errorOf('USERNAME_TAKEN', 'EMAIL_TAKEN', 'PHONE_TAKEN')");
      writeFileSync(docs, src.replace("errorOf('USERNAME_TAKEN', 'EMAIL_TAKEN', 'PHONE_TAKEN')", "errorOf('USERNAME_TAKEN', 'EMAIL_TAKEN', 'PHONE_TAKN')"));
      const out = runScript(dir, 'app.js');
      expect(out.code).not.toBe(0);
      expect(out.out).toContain('Error: MESSAGES에 없는 에러 코드예요: PHONE_TAKN');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ───────── 축 ⑥ 바뀐 학생 파일 ─────────
describe('축 ⑥ 이 회차 학생 파일', () => {
  it('code/p3-37 에서 바뀐 학생 파일', () => {
    const files = [];
    const walk = (base, rel = '') => {
      for (const entry of readdirSync(join(base, rel), { withFileTypes: true })) {
        const p = join(rel, entry.name);
        if (entry.isDirectory()) walk(base, p); else files.push(p);
      }
    };
    const changed = [];
    for (const name of STUDENT_FILES) {
      const list = [];
      if (!existsSync(R(name))) continue;
      if (readdirSync(join(R(name), '..')).includes(name.split('/').pop()) && !name.includes('.')) {
        files.length = 0; walk(R(name)); list.push(...files.map((f) => join(name, f)));
      } else list.push(name);
      for (const f of list) if (!existsSync(B(f)) || read(B(f)) !== read(R(f))) changed.push(f);
    }
    expect(changed.sort()).toEqual([
      'app.js', 'docs/openapi.js', 'lab/p3-38/homework1.http', 'lab/p3-38/homework1.js', 'lab/p3-38/notices.http', 'lab/p3-38/notices.js',
      'middlewares/deprecation.js', 'middlewares/legacyCursor.js', 'requests/deprecation.http',
    ]);
  });
});

// ───────── 축 ⑦ 직접 해보기 3 · 과제 [기초] ─────────
// 실습 서버는 사본의 포트를 바꿔 띄운다(실습 포트를 다른 세션이 쥐고 있을 수 있다).
const runLab = async (src, port, fn, ready) => {
  const dir = mkdtempSync(join(tmpdir(), 'p338-lab-'));
  symlinkSync(P('node_modules'), join(dir, 'node_modules'));
  const file = join(dir, 'server.js');
  writeFileSync(file, src.replaceAll(/app\.listen\(\d+,/g, `app.listen(${port},`).replaceAll(/(\d{4})번 포트에서/g, `${port}번 포트에서`));
  const srv = await boot(file, { port, cwd: dir, env: {}, ready: `${port}번 포트에서` });
  try { await fn(`http://localhost:${port}`); } finally { await Promise.race([srv.stop(), sleep(500)]); rmSync(dir, { recursive: true, force: true }); }
};
const LAB_PORT = 3893;
const LAB_NOTICE = { deprecation: '@1796083200', sunset: 'Mon, 01 Mar 2027 00:00:00 GMT', link: null };

describe('축 ⑦ 직접 해보기 3 — 공지 서버의 옛 주소 알림', () => {
  const START = P('snapshots/p3-38.practice3-start.notices.js');
  const ANSWER = R('lab/p3-38/notices.js');
  // notices.http 다섯 요청
  const check = async (base) => ({
    old: noticeOf(await getRes(`${base}/api/notices`)),
    v2: noticeOf(await getRes(`${base}/api/v2/notices`)),
    oldNope: noticeOf(await getRes(`${base}/api/notice`)),
    v2Nope: noticeOf(await getRes(`${base}/api/v2/notice`)),
    oldBroken: noticeOf(await getRes(`${base}/api/notices`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"title":' })),
  });
  const RIGHT = { old: LAB_NOTICE, v2: NONE, oldNope: LAB_NOTICE, v2Nope: NONE, oldBroken: LAB_NOTICE };
  const NOTICE_BLOCK = "// 옛 주소로 온 요청에는 끝나는 날을 알린다 — 본문을 못 읽은 실패에도 붙게 본문을 읽기 전에.\napp.use('/api', (req, res, next) => {\n  if (res.locals.apiVersion !== 2) {\n    res.set('Deprecation', `@${DEPRECATED_AT.getTime() / 1000}`);\n    res.set('Sunset', SUNSET_AT.toUTCString());\n  }\n  next();\n});\n";

  it('시작 판은 지난 시간 공지 서버에서 첫 줄 · 포트 · 문장만 다르다', () => {
    const was = read(B('lab/p3-37/notices.js'));
    expect(read(START)).toBe(was.replace('lab/p3-37/notices.js', 'lab/p3-38/notices.js').replace('app.listen(4001,', 'app.listen(4003,').replace('4001번 포트에서', '4003번 포트에서'));
  });
  it('notices.http 는 다섯 요청 — 마지막은 옛 주소로 깨진 JSON', () => {
    expect(read(R('lab/p3-38/notices.http')).match(/^### .+$/gm)).toEqual(['### 옛 주소로 목록', '### 새 주소로 목록', '### 옛 주소의 없는 주소', '### 새 주소의 없는 주소', '### 옛 주소로 깨진 JSON 보내기']);
  });
  it('시작 판 — 다섯 요청 모두 알림이 없다', async () => {
    await runLab(read(START), LAB_PORT, async (base) => expect(await check(base)).toEqual({ old: NONE, v2: NONE, oldNope: NONE, v2Nope: NONE, oldBroken: NONE }));
  }, 30000);
  it('정답 판 — 옛 주소 셋에만', async () => {
    expect(read(ANSWER)).toContain(NOTICE_BLOCK);
    await runLab(read(ANSWER), LAB_PORT, async (base) => expect(await check(base)).toEqual(RIGHT));
  }, 30000);
  it('틀린 판 ① 버전을 안 보는 판 — 둘째 · 넷째 요청이 가려낸다', async () => {
    const wrong = read(ANSWER).replace("  if (res.locals.apiVersion !== 2) {\n    res.set('Deprecation', `@${DEPRECATED_AT.getTime() / 1000}`);\n    res.set('Sunset', SUNSET_AT.toUTCString());\n  }\n", "  res.set('Deprecation', `@${DEPRECATED_AT.getTime() / 1000}`);\n  res.set('Sunset', SUNSET_AT.toUTCString());\n");
    expect(wrong).not.toBe(read(ANSWER));
    await runLab(wrong, LAB_PORT, async (base) => expect(await check(base)).toEqual({ ...RIGHT, v2: LAB_NOTICE, v2Nope: LAB_NOTICE }));
  }, 30000);
  it('틀린 판 ② 옛 주소를 붙이는 줄에 단 판 — 마지막 요청(깨진 JSON)이 가려낸다', async () => {
    const fn = NOTICE_BLOCK.slice(NOTICE_BLOCK.indexOf('(req, res, next) =>'), NOTICE_BLOCK.lastIndexOf('}') + 1);
    const wrong = read(ANSWER).replace(NOTICE_BLOCK, '').replace("app.use('/api', api);", `const oldApiNotice = ${fn};\napp.use('/api', oldApiNotice, api);`);
    expect(wrong).not.toBe(read(ANSWER));
    await runLab(wrong, LAB_PORT, async (base) => expect(await check(base)).toEqual({ ...RIGHT, oldBroken: NONE }));
  }, 30000);
});

describe('축 ⑦ 과제 [기초] — 공지 서버의 문서', () => {
  const HW = R('lab/p3-38/homework1.js');
  it('문서 — 두 버전 · 봉투 · 코드 · 옛 주소 deprecated · 문서 주소에는 알림이 없다', async () => {
    await runLab(read(HW), LAB_PORT, async (base) => {
      const doc = await getRes(`${base}/api/openapi.json`);
      expect(noticeOf(doc)).toEqual(NONE);
      expect(Object.keys(doc.body.paths)).toEqual(['/api/v2/notices', '/api/notices']);
      expect(doc.body.paths['/api/v2/notices'].post.responses[400].content['application/json'].schema.properties.error.properties.code.enum).toEqual(['TITLE_REQUIRED', 'INVALID_BODY']);
      expect(doc.body.paths['/api/notices'].get.deprecated).toBe(true);
      expect(doc.body.paths['/api/notices'].get.description).toBe('옛 주소예요. 2027-03-01에 끝나요. /api/v2/notices 주소로 옮기세요.');
      expect(doc.body.components.schemas.ErrorCode.enum).toEqual(['TITLE_REQUIRED', 'INVALID_BODY', 'ROUTE_NOT_FOUND', 'INTERNAL_ERROR']);
      expect(noticeOf(await getRes(`${base}/api/notices`))).toEqual(LAB_NOTICE);
      expect(noticeOf(await getRes(`${base}/api/docs/`))).toEqual(NONE);
      expect((await getRes(`${base}/api/v2/notices`)).body).toEqual({ data: [{ id: 1, title: '서버 점검 안내' }, { id: 2, title: '새 기능 소개' }] });
    });
  }, 30000);
  it('틀린 판 — 문서를 버전 표시 아래에 두면 문서 주소에 알림이 붙는다', async () => {
    const src = read(HW);
    const block = src.slice(src.indexOf('// 문서는 버전과 상관없는 주소라'), src.indexOf('// 새 주소로 온 요청이라는 것을'));
    const wrong = src.replace(block, '').replace('app.use(express.json());\n', `app.use(express.json());\n${block}`);
    expect(wrong).not.toBe(src);
    await runLab(wrong, LAB_PORT, async (base) => expect(noticeOf(await getRes(`${base}/api/openapi.json`))).toEqual(LAB_NOTICE));
  }, 30000);
});

// ───────── 축 ⑧ 교안·답안의 백엔드 코드 블록 ─────────
describe('축 ⑧ 교안·답안의 백엔드 코드 블록은 줄마다 그 파일에 실재한다', () => {
  const TRACK_DIR = new URL('../../', ROOT).pathname;
  const DOCS = ['part3/7-express-auth/p3-38-screen-to-v2-lecture.md', 'part3/7-express-auth/p3-38-screen-to-v2-answers.md'].map((f) => join(TRACK_DIR, f));
  const blocks = (file) => {
    const out = [];
    let open = null;
    for (const line of read(file).split('\n')) {
      if (line.startsWith('```')) {
        if (open) { out.push(open); open = null; } else if (line === '```javascript') open = [];
      } else if (open) open.push(line);
    }
    return out.filter((b) => (b[0] ?? '').startsWith('// ~/instagram-api/'));
  };
  // 그 블록이 실재할 수 있는 판 — 최종 파일 · Step 6 중간 판(app.js) · 직접 해보기 3 시작 판(notices.js)
  const versions = (rel) => [R(rel), rel === 'app.js' ? P('snapshots/p3-38.step6-docs-below.app.js') : null,
    rel === 'lab/p3-38/notices.js' ? P('snapshots/p3-38.practice3-start.notices.js') : null].filter(Boolean).map(read);

  it('블록마다 한 판에 줄이 모두 있다', () => {
    const all = DOCS.flatMap(blocks);
    expect(all.length).toBe(11);
    for (const b of all) {
      const rel = b[0].replace('// ~/instagram-api/', '');
      const lines = b.slice(1).filter((l) => l.trim() !== '' && l.trim() !== '...');
      expect(versions(rel).some((text) => lines.every((l) => text.includes(l))), `${b[0]}\n${lines.join('\n')}`).toBe(true);
    }
  });

  it('deprecation.js 블록은 파일 통째 · requests/deprecation.http 블록은 byte 그대로', () => {
    const lecture = read(DOCS[0]);
    const dep = read(R('middlewares/deprecation.js'));
    expect(lecture).toContain(`\`\`\`javascript\n${dep}\`\`\``);
    expect(lecture).toContain(`\`\`\`http\n${read(R('requests/deprecation.http'))}\`\`\``);
  });

  it('Step 7 의 서버가 멈추는 출력 — 교안 블록의 줄이 실제 출력에 있다', () => {
    const dir = mkdtempSync(join(tmpdir(), 'p338-typo2-'));
    try {
      for (const name of STUDENT_FILES) if (existsSync(R(name))) cpSync(R(name), join(dir, name), { recursive: true });
      symlinkSync(P('node_modules'), join(dir, 'node_modules'));
      const docs = join(dir, 'docs/openapi.js');
      writeFileSync(docs, read(docs).replace("'EMAIL_TAKEN', 'PHONE_TAKEN')", "'EMAIL_TAKEN', 'PHONE_TAKN')"));
      const out = runScript(dir, 'app.js').out.replaceAll(`file://${dir}`, 'file:///Users/hong/instagram-api').replaceAll(`file:///private${dir}`, 'file:///Users/hong/instagram-api');
      const lecture = read(DOCS[0]);
      const i = lecture.indexOf('```bash\nfile:///Users/hong/instagram-api/docs/openapi.js:20');
      const block = lecture.slice(i + 8, lecture.indexOf('```', i + 8)).split('\n').filter((l) => l !== '' && l !== '...' && !l.startsWith('Failed running'));
      for (const l of block) expect(out, l).toContain(l);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ───────── 축 ⑨ 학생 낭독 집중 검수(2026-11-10) — 학생 상태에서 따라 한 결과 ─────────
// 학생 상태 — 게시물 최신순 9·1·2·3·4·5 · 9번은 HTTP 캐싱 회차에 jaehoon(2번)이 눌러 둔 하트 · 다음 사람 37.
describe('축 ⑨ 학생 낭독 집중 검수', () => {
  const TRACK_DIR = new URL('../../', ROOT).pathname;
  const LEC = () => read(join(TRACK_DIR, 'part3/7-express-auth/p3-38-screen-to-v2-lecture.md'));
  const ANS = () => read(join(TRACK_DIR, 'part3/7-express-auth/p3-38-screen-to-v2-answers.md'));
  const bodyOnly = (md) => md.replace(/<details>[\s\S]*?<\/details>/g, '');
  const prior = (rel) => bodyOnly(read(join(TRACK_DIR, rel)));
  const raw = (rel) => read(join(TRACK_DIR, rel));
  const NEXT_REPO = P('../instagram-next');
  const nextFile = (rel) => execFileSync('git', ['-C', NEXT_REPO, 'show', `code/p3-38:${rel}`], { encoding: 'utf8' });

  it('Step 2 하트 — 맨 위 카드가 이미 누른 하트면 처음은 DELETE(1 → 0) · 다시 누르면 PUT(0 → 1)', async () => {
    await freshGate();
    await withServer(R, async ({ base }) => {
      const made = await getRes(`${base}/api/v2/posts`, json('POST', { authorId: 3, content: '제주 왔어요 🌊', imageUrls: ['/images/post-8.jpg'] }));
      const id = made.body.data.id;
      await getRes(`${base}/api/v2/posts/${id}/likes/2`, { method: 'PUT' });
      const top = (await getRes(`${base}/api/v2/posts?userId=2&limit=2`)).body.data.items[0];
      expect([top.id, top.liked, top.likeCount]).toEqual([id, true, 1]);
      expect((await getRes(`${base}/api/v2/posts/${id}/likes/2`, { method: 'DELETE' })).body).toEqual({ data: { liked: false, likeCount: 0 } });
      expect((await getRes(`${base}/api/v2/posts/${id}/likes/2`, { method: 'PUT' })).body).toEqual({ data: { liked: true, likeCount: 1 } });
    });
    // 9번 하트를 누른 것은 HTTP 캐싱 회차 본문이다.
    expect(prior('part3/6-api-design/p3-35-http-caching-lecture.md')).toContain('맨 위 카드(지난 시간에 올린 9번 게시물)의 빈 하트를 눌러 볼게요.');
    const md = LEC();
    expect(md).not.toContain('하트를 눌러 보면 `PUT /api/v2/posts/…/likes/2`가 가고');
    expect(md).toContain('누르면 `DELETE /api/v2/posts/9/likes/2`가 가고 좋아요 수가 1에서 0으로 바뀌어요. 한 번 더 누르면 `PUT /api/v2/posts/9/likes/2`가 가고 1로 돌아와요.');
  }, 60000);

  it('Step 2 끝 — 고친 것은 성공 쪽뿐이라는 말이 있다(로그인 실패 문장은 Step 4 까지 «(401)»)', () => {
    expect(LEC()).toContain('실패한 응답을 읽는 쪽은 아직 옛 형식을 찾아요');
  });

  it('Step 4 표 — «5곳» 은 상태 코드나 서버 문장을 읽는 곳 · 그 기준을 말한다', () => {
    const md = LEC();
    expect(md).toContain('실패한 응답에서 상태 코드나 서버 문장을 읽는 곳을 모아 보면 5곳이고');
    // 응답에서 아무것도 안 읽고 실패만 다루는 곳 — 피드의 고정 문장 · 좋아요 되돌리기 · error.js
    expect(nextFile('components/FeedList.jsx')).toContain('게시물을 불러오지 못했습니다.');
    expect(nextFile('hooks/useLikePost.js')).toContain('onError');
    expect(md).toContain('응답에서 아무것도 읽지 않으니 빼고 셌어요');
  });

  it('Step 5 사용자 이름 장면 — 교안이 준 값으로 하면 창 B 201 · 창 A 409 USERNAME_TAKEN', async () => {
    const md = LEC();
    expect(md).toContain('창 A는 `010-5151-0003`과 `yuri03`으로, 창 B는 번호는 `010-5151-0004`로 다르게, 사용자 이름은 `yuri03`으로 같게 해서');
    await freshGate();
    await withServer(R, async ({ base }) => {
      const b = await getRes(`${base}/api/v2/auth/signup`, json('POST', { emailOrPhone: '010-5151-0004', name: '한다른', username: 'yuri03', password: 'other1234' }));
      expect(b.status).toBe(201);
      const a = await getRes(`${base}/api/v2/auth/signup`, json('POST', { emailOrPhone: '010-5151-0003', name: '최유리', username: 'yuri03', password: 'yuri1234' }));
      expect([a.status, a.body.error.code, a.body.error.message]).toEqual([409, 'USERNAME_TAKEN', '이미 쓰고 있는 사용자 이름이에요']);
    });
  }, 60000);

  it('Step 6 legacyCursor — 날짜 상수 둘 위의 주석도 지운다 · import 줄을 더한다', () => {
    const before = read(B('middlewares/legacyCursor.js'));
    const after = read(R('middlewares/legacyCursor.js'));
    const COMMENT = '// 옛 커서를 언제부터 쓰지 말라고 했는지와, 언제부터 받지 않을지.';
    expect(before).toContain(`${COMMENT}\nconst DEPRECATED_AT`);
    expect(after).not.toContain(COMMENT);
    expect(after).toContain("import { setDeprecation } from './deprecation.js';");
    expect(LEC()).toContain('날짜 상수 둘과 그 위 주석 한 줄을 지우고');
  });

  it('Step 6 — 고치기 전에 적어 둔 옛 주소 «게시물 목록» 의 ETag 가 고친 뒤에도 같다(헤더 셋만 더해진다)', async () => {
    await freshGate();
    let was;
    await withServer(B, async ({ base }) => {
      const res = await getRes(`${base}/api/posts?limit=2`);
      was = { etag: res.headers.get('etag'), body: res.body, notice: noticeOf(res) };
    });
    await withServer(R, async ({ base }) => {
      const res = await getRes(`${base}/api/posts?limit=2`);
      expect(res.headers.get('etag')).toBe(was.etag);
      expect(res.body).toEqual(was.body);
      expect([was.notice, noticeOf(res)]).toEqual([NONE, NOTICE]);
    });
    expect(read(R('requests/envelope.http'))).toContain('### 게시물 목록\nGET {{api}}/posts?limit=2');
    const md = LEC();
    expect(md).toContain('«게시물 목록»을 보내, 응답 헤더의 `ETag` 값을 적어 두세요');
    expect(md).toContain('`ETag`는 적어 둔 값과 같아요');
  }, 60000);

  it('Step 6 🙋 — 문서 두 줄만 올리고 privateNoCache 를 아래에 두면 문서 응답에서 Cache-Control 이 빠진다 · 함께 올리면 붙는다', async () => {
    const app = read(R('app.js'));
    const CACHE = "// API 응답은 받아 둬도 되지만, 쓸 때마다 서버에 확인하게 한다.\napp.use('/api', privateNoCache);\n\n";
    expect(app).toContain(CACHE);
    const wrong = app.replace(CACHE, '').replace('// 새 주소 — 버전은 위에서 적어 두었다.', `${CACHE}// 새 주소 — 버전은 위에서 적어 두었다.`);
    expect(wrong).not.toBe(app);
    const tmp = mkdtempSync(join(tmpdir(), 'p338-cache-'));
    writeFileSync(join(tmp, 'app.js'), wrong);
    try {
      await freshGate();
      await withServer((name) => (name === 'app.js' ? join(tmp, 'app.js') : R(name)), async ({ base }) => {
        expect((await getRes(`${base}/api/openapi.json`)).headers.get('cache-control')).toBeNull();
        expect((await getRes(`${base}/api/posts?limit=2`)).headers.get('cache-control')).toBe('private, no-cache');
      });
      await withServer(R, async ({ base }) => {
        expect((await getRes(`${base}/api/openapi.json`)).headers.get('cache-control')).toBe('private, no-cache');
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
    expect(LEC()).toContain('문서 두 줄만 올리고 이 줄을 아래에 두면 문서 응답에서 `Cache-Control`이 빠져요.');
  }, 60000);

  it('Step 7 — 새 주소 게시물 400 의 에러 코드를 교안이 말한다(블록에 못 실은 넷째)', () => {
    const doc = read(R('docs/openapi.js'));
    expect(doc).toContain("errorOf('VALIDATION_FAILED', 'INVALID_CURSOR')");
    expect(doc).toContain("errorOf('VALIDATION_FAILED', 'INVALID_BODY', 'USER_NOT_FOUND')");
    const md = LEC();
    expect(md).toContain('목록의 400은 `VALIDATION_FAILED`와 깨진 커서의 `INVALID_CURSOR`');
    expect(md).toContain('`USER_NOT_FOUND`');
  });

  it('Step 7 — 가입 409 의 Enum 세 값은 FIELD 의 키 셋과 같다(빠뜨린 코드도 이 대조에서 드러난다)', () => {
    const doc = read(R('docs/openapi.js'));
    const enum409 = doc.match(/409: \{[^\n]*errorOf\(([^)]*)\)/)[1].match(/'([A-Z_]+)'/g).map((s) => s.slice(1, -1));
    const form = nextFile('app/(auth)/_components/SignupForm.jsx');
    const field = form.slice(form.indexOf('const FIELD = {'), form.indexOf('};', form.indexOf('const FIELD = {'))).match(/^ {2}([A-Z_]+):/gm).map((s) => s.trim().slice(0, -1));
    expect([...field].sort()).toEqual([...enum409].sort());
    expect(LEC()).toContain('`FIELD`에 적은 키 셋과 같은지');
  });

  it('Step 7 — Object.hasOwn 의 뜻 · 계약 테스트의 뜻을 그 자리에서 준다', () => {
    const md = LEC();
    expect(md).toContain('`Object.hasOwn(객체, 키)`는 그 객체에 그 키가 있는지 알려 줘요.');
    expect(raw('part3/6-api-design/p3-34-versioning-docs-answers.md')).toContain('계약 테스트(contract test)라고 불러요');
    expect(md).not.toContain('버저닝을 배울 때 이야기한 계약 테스트');
    expect(md).toContain('실제 응답을 문서의 스키마로 검사하는 테스트');
  });

  it('과제 [기초] — 옛 주소의 성공 응답은 배열 그대로 · 확인 6 이 그 스키마를 본다', async () => {
    await runLab(read(R('lab/p3-38/homework1.js')), LAB_PORT, async (base) => {
      const doc = (await getRes(`${base}/api/openapi.json`)).body;
      expect(doc.paths['/api/notices'].get.responses[200].content['application/json'].schema.type).toBe('array');
      expect(doc.paths['/api/v2/notices'].get.responses[200].content['application/json'].schema.required).toEqual(['data']);
    });
    const md = LEC();
    expect(md).toContain('옛 주소의 성공 응답은 지금 보내는 대로 배열 그대로 적어요');
    expect(md).toContain('`"type": "array"`');
  }, 30000);

  it('과제 [응용] — 확인 5 에 «버튼이 켜져 있고 400» · «별명만 어긴 값» · 답안에 extend 와 z.object', () => {
    const md = LEC();
    expect(md).toContain('«구독하기» 버튼은 켜져 있어야 하고');
    expect(md).toContain('별명만 규칙을 어긴 채 다시 눌러요');
    expect(md).toContain('`subscribeSchema.extend({ … })`');
    expect(ANS()).toContain('`z.object`로 두 필드를 다시 적어도 돼요');
  });

  it('잇기 — 앞 회차 본문(토글 밖)에 있는 것을 받는다', () => {
    const md = LEC();
    // p3-24 Step 7 — axios 와 나란히 놓고 «본문 안을 한 번 더 열어 볼 필요도 없어요»
    expect(prior('part3/4-react-auth/p3-24-fetch-wrapper-lecture.md')).toContain('그 본문 안을 한 번 더 열어 볼 필요도 없어요');
    expect(md).toContain('«그 본문 안을 한 번 더 열어 볼 필요도 없어요»');
    // p3-22 Step 8 — 그때는 같은 사용자 이름 · p3-37 Step 2 — 코드로 짚은 그 장면
    expect(prior('part3/4-react-auth/p3-22-signup-lecture.md')).toContain('`haneul.lee@example.com`·`이하늘`·`haneul`·`haneul1234`로 먼저 가입해요');
    expect(md).not.toContain('같은 번호로 먼저 가입하는 장면을 만들어요');
    expect(md).toContain('그때는 사용자 이름이 겹쳤는데');
    expect(prior('part3/7-express-auth/p3-37-response-envelope-lecture.md')).toContain('화면이 요청을 두 번 더 보내서 알아내는 셈이에요.');
    expect(md).toContain('지난 시간 Step 2에서 코드로만 짚은 장면이에요.');
    // p3-34 Step 4 — /api/v2/zzz 의 404 에도 v1 헤더
    expect(prior('part3/6-api-design/p3-34-versioning-docs-lecture.md')).toContain('`/api/v2/zzz`처럼 없는 주소로 온 요청도 v1 라우터를 지나가서, 그 404에도 두 헤더가 붙어요.');
    expect(md).toContain('`/api/v2/zzz`의 404 응답에까지');
    // Step 3 — 복사가 아니라 옮기는 이유
    expect(md).toContain('같은 검색에 형식이 다른 주소가 둘 생기기 때문이에요');
  });

  it('잇기 — 토글·답안·과제에만 있던 것은 출처를 밝힌다', () => {
    const md = LEC();
    // p3-37 🤔 해설 — 기준 문장과 로그인 실패 합치기는 토글 안에만 있다
    const p337 = raw('part3/7-express-auth/p3-37-response-envelope-lecture.md');
    expect(p337).toContain('**기준은 «받는 쪽이 그 코드를 보고 다른 일을 하는가»예요.**');
    expect(bodyOnly(p337)).not.toContain('**기준은 «받는 쪽이 그 코드를 보고 다른 일을 하는가»예요.**');
    expect(md).toContain('지난 시간 «같이 생각해보기»에서 에러 코드를 얼마나 잘게 나눌지 이야기하면서');
    expect(md).toContain('지난 시간 «같이 생각해보기»에서 비밀번호가 생기면');
    // p3-24 🤔 해설 — 서버가 문장도 지어 보낸다
    expect(md).toContain('서버가 보낸 문장을 그대로 보여 줘도 될지 이야기하면서');
    // p3-37 생각해볼 주제 1 해설 — 섞어 쓰기
    expect(raw('part3/7-express-auth/p3-37-response-envelope-answers.md')).toContain('실무에서는 둘을 섞는 경우가 많아요.');
    expect(md).toContain('지난 시간 생각해볼 주제 1의 해설이 실무에서 많이 쓴다고 소개한 방식');
    // p3-34 과제 [응용] — 한 문서에 두 버전
    expect(raw('part3/6-api-design/p3-34-versioning-docs-lecture.md')).toContain('### [응용] 버전 둘의 문서');
    expect(md).toContain('버저닝을 배운 시간의 과제 [응용]에서');
    // 생각해볼 주제 1 · 3 — 앞 회차 주제를 받는다
    expect(md).toContain('지난 시간 생각해볼 주제 1에서');
    expect(ANS()).toContain('버저닝을 배울 때 생각해볼 주제 1');
  });
});
