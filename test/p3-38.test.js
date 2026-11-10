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
      expect(out.out).toContain('Error: MESSAGES 에 없는 에러 코드예요: PHONE_TAKN');
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
      expect(doc.body.paths['/api/notices'].get.description).toBe('옛 주소예요. 2027-03-01에 끝나요. /api/v2/notices 로 옮기세요.');
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
