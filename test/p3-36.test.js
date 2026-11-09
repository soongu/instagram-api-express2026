// p3-36 「MVC 와 서비스 계층 — 관심사의 분리」 게이트 — 백엔드
//
// `7-express-auth` 첫 회차다(`curriculum.md` 「`p3-36` 착수 결정」). 응답은 한 글자도 안 바뀐다 — 계약 변경(봉투)은 `p3-37`.
// 수업 백엔드에서 바뀌는 학생 파일 — `services/userService.js`(휴대폰 번호 맞추기) · 새 `services/authService.js` ·
// 새 `controllers/`(post · auth · like · upload) · `routes/` 넷(주소 지도) · 실습 `lab/p3-36/add-user.js`(Step 2).
//
// 축 ① Step 2 — 앞 판(code/p3-35)에 관리자 스크립트를 돌리면 같은 번호의 계정이 둘 · 이 판은 409 · 행 하나
// 축 ② Step 4·5·7 — 층의 규칙: 라우터에 라우트 함수가 없다 · 서비스는 req·res·express 를 모른다 · 컨트롤러는 db 를 안 부른다
// 축 ③ 수업 백엔드 — code/p3-35 와 같은 요청에 같은 응답(상태 · 본문 · 머리글)
// 축 ④ Step 7 — 응답을 보내는 줄의 지도(controllers · app.js · legacyCursor 하나)
// 축 ⑤ 이 회차 학생 파일 — code/p3-35 에서 바뀐 파일
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, mkdtempSync, rmSync, cpSync, symlinkSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
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
const TPL_DB = 'p336_tpl';
const GATE_DB = 'p336_gate';
const GATE_URL = `postgresql://postgres:postgres@localhost:5432/${GATE_DB}`;
const PORT = 3851;

// 학생 파일은 이 회차 북마크 `code/p3-36` 을 풀어서 읽는다(없으면 작업트리 — 이 회차를 짓는 동안).
const ROUND = roundDir('code/p3-36');
const R = (rel) => join(ROUND.dir, rel);
const BEFORE = roundDir('code/p3-35');
const B = (rel) => join(BEFORE.dir, rel);

const env = { DATABASE_URL: GATE_URL, CORS_ORIGIN: 'http://localhost:3001' };
const STUDENT_FILES = ['app.js', 'db.js', 'errors.js', 'routes', 'controllers', 'services', 'middlewares', 'schemas', 'docs', 'package.json', 'requests', 'lab/p3-36'];

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
const query = async (sql) => {
  const client = new pg.Client({ ...ADMIN, database: GATE_DB });
  await client.connect();
  try {
    return (await client.query(sql)).rows;
  } finally {
    await client.end();
  }
};

/** 학생 폴더 모양의 임시 폴더에 그 판의 파일을 깔고 `app.js` 를 띄운다. */
const withServer = async (from, fn, { port = PORT } = {}) => {
  const dir = mkdtempSync(join(tmpdir(), 'p336-srv-'));
  for (const name of STUDENT_FILES) {
    if (existsSync(from(name))) cpSync(from(name), join(dir, name), { recursive: true });
  }
  // 앞 판에는 이 회차의 관리자 스크립트가 없다 — 학생이 Step 2 에서 만드는 파일이라 이 회차 것을 넣는다.
  if (!existsSync(join(dir, 'lab/p3-36/add-user.js'))) {
    mkdirSync(join(dir, 'lab/p3-36'), { recursive: true });
    cpSync(R('lab/p3-36/add-user.js'), join(dir, 'lab/p3-36/add-user.js'));
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

// ───────── 축 ① Step 2 — HTTP 를 안 거치는 통로 ─────────
describe('축 ① Step 2 — 관리자 스크립트로 가입시킨 번호', () => {
  const scene = async (from) => {
    await freshGate();
    let result = null;
    await withServer(from, async ({ dir, base }) => {
      const script = runScript(dir, 'lab/p3-36/add-user.js');
      const check = await getRes(`${base}/api/auth/check-duplicate?type=phone&value=010-5555-1234`);
      const signup = await getRes(`${base}/api/auth/signup`, json('POST', {
        emailOrPhone: '010-5555-1234', name: '김지호', username: 'jiho.kim', password: 'jiho1234',
      }));
      const rows = await query(`SELECT username, phone FROM users WHERE username LIKE 'jiho%' ORDER BY id`);
      result = { script, check, signup, rows };
    });
    return result;
  };

  it('앞 판 — 스크립트는 하이픈 그대로 저장 · 중복 확인은 «쓸 수 있어요» · 가입 201 · 같은 번호의 계정 둘', async () => {
    const { script, check, signup, rows } = await scene(B);
    expect(script.code).toBe(0);
    expect(script.out).toContain("가입시켰어요 { id: 6, username: 'jiho', profileImage: null }");
    expect(check.body).toEqual({ available: true, message: '쓸 수 있어요' });
    expect(signup.status).toBe(201);
    expect(signup.body).toEqual({ message: '가입했어요', username: 'jiho.kim' });
    expect(rows).toEqual([
      { username: 'jiho', phone: '010-5555-1234' },
      { username: 'jiho.kim', phone: '01055551234' },
    ]);
  }, 60000);

  it('이 판 — 스크립트도 숫자만 저장 · 중복 확인은 «이미 가입한 휴대폰 번호예요» · 가입 409 · 행 하나', async () => {
    const { script, check, signup, rows } = await scene(R);
    expect(script.code).toBe(0);
    expect(check.body).toEqual({ available: false, message: '이미 가입한 휴대폰 번호예요' });
    expect(signup.status).toBe(409);
    expect(signup.body).toEqual({ message: '이미 쓰고 있는 사용자 이름이나 연락처예요' });
    expect(rows).toEqual([{ username: 'jiho', phone: '01055551234' }]);
  }, 60000);

  it('이 판에서 스크립트를 두 번 돌리면 두 번째는 409 에러로 끝난다(같은 사용자 이름)', async () => {
    await freshGate();
    await withServer(R, async ({ dir }) => {
      expect(runScript(dir, 'lab/p3-36/add-user.js').code).toBe(0);
      const again = runScript(dir, 'lab/p3-36/add-user.js');
      expect(again.code).not.toBe(0);
      expect(again.out).toContain('ConflictError: 이미 쓰고 있는 사용자 이름이나 연락처예요');
    });
  }, 60000);
});

// ───────── 축 ② 층의 규칙 ─────────
describe('축 ② 층의 규칙', () => {
  const files = (dir) => readdirSync(R(dir)).filter((name) => name.endsWith('.js'));

  it('라우터 넷에는 라우트 함수가 없다 — (req, res …) 로 여는 함수 0 · 컨트롤러 이름만', () => {
    expect(files('routes').sort()).toEqual(['auth.js', 'likes.js', 'posts.js', 'uploads.js']);
    for (const name of files('routes')) {
      const src = read(R(`routes/${name}`));
      expect(src, name).not.toMatch(/\(req, res/);
      expect(src, name).not.toMatch(/\bres\./);
      expect(src, name).toMatch(/import \* as \w+Controller from '\.\.\/controllers\/\w+Controller\.js';/);
    }
  });

  it('서비스는 req·res·express 를 모르고, 컨트롤러·라우터를 부르지 않는다', () => {
    for (const name of files('services')) {
      const src = read(R(`services/${name}`));
      expect(src, name).not.toMatch(/\b(req|res)\b/);
      expect(src, name).not.toMatch(/from 'express'/);
      expect(src, name).not.toMatch(/\.\.\/(controllers|routes)\//);
    }
  });

  it('컨트롤러는 db.js(prisma)를 직접 부르지 않는다 — 데이터는 서비스를 거친다', () => {
    expect(files('controllers').sort()).toEqual(['authController.js', 'likeController.js', 'postController.js', 'uploadController.js']);
    for (const name of files('controllers')) {
      const src = read(R(`controllers/${name}`));
      expect(src, name).not.toMatch(/db\.js|prisma/);
      expect(src, name).not.toMatch(/from 'express'/);
    }
  });

  it('휴대폰 번호를 맞추는 줄은 userService 한 곳에만 있다', () => {
    const hits = [...files('routes').map((n) => `routes/${n}`), ...files('controllers').map((n) => `controllers/${n}`), ...files('services').map((n) => `services/${n}`)]
      .filter((rel) => read(R(rel)).includes(".replaceAll('-', '')"));
    expect(hits).toEqual(['services/userService.js']);
    // 앞 판에서는 라우트 두 곳에 있었다.
    expect(read(B('routes/auth.js')).split(".replaceAll('-', '')").length - 1).toBe(2);
  });
});

// ───────── 축 ③ 같은 요청에 같은 응답 ─────────
// 바뀌는 값(세션 ID · 올린 파일 이름 · 이 실행에서 만든 게시물의 시각)만 지우고 나머지는 글자 그대로 대조한다.
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
const ISO = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g;
const normalize = (value) => JSON.parse(JSON.stringify(value).replace(UUID, '<uuid>').replace(ISO, '<time>'));
const HEADERS = ['content-type', 'location', 'allow', 'cache-control', 'deprecation', 'sunset', 'set-cookie', 'etag'];

const SCRIPT = async (base) => {
  const out = [];
  const photo = readFileSync(P('requests/photos/beach.jpg'));
  const send = async (label, path, init) => {
    const res = await getRes(`${base}${path}`, init);
    const headers = Object.fromEntries(HEADERS.map((name) => [name, res.headers.get(name)]));
    // ETag 은 본문 글자로 계산한다 — 본문에 실행마다 바뀌는 값(파일 이름 · 방금 만든 시각)이 들면 ETag 도 바뀐다.
    const raw = JSON.stringify(res.body);
    if (new RegExp(UUID.source).test(raw) || new RegExp(ISO.source).test(raw)) headers.etag = headers.etag && '<본문 따라 바뀜>';
    out.push({ label, status: res.status, headers, body: res.body });
    return res;
  };
  const first = await send('목록 둘', '/api/posts?limit=2');
  await send('다음 페이지', `/api/posts?limit=2&cursor=${first.body.nextCursor}`);
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
  const created = await send('게시물 올리기', '/api/posts', json('POST', { username: 'jaehoon', content: '게이트', imageUrls: ['/images/post-8.jpg'] }));
  await send('규칙에 안 맞는 게시물', '/api/posts', json('POST', { username: 'jaehoon' }));
  await send('text/plain 게시물', '/api/posts', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'hi' });
  await send('깨진 JSON', '/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"a":' });
  await send('게시물 고치기', `/api/posts/${created.body.id}`, json('PATCH', { content: '고친 글' }));
  await send('없는 게시물 고치기', '/api/posts/999', json('PATCH', { content: '고친 글' }));
  await send('게시물 지우기', `/api/posts/${created.body.id}`, { method: 'DELETE' });
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

describe('축 ③ 수업 백엔드 — code/p3-35 와 같은 요청에 같은 응답', () => {
  it('요청 54개의 상태 코드 · 본문 · 머리글이 같다', async () => {
    await freshGate();
    let before = null;
    await withServer(B, async ({ base }) => { before = await SCRIPT(base); });
    await freshGate();
    let after = null;
    await withServer(R, async ({ base }) => { after = await SCRIPT(base); });
    expect(after.length).toBe(54);
    for (let i = 0; i < before.length; i += 1) {
      expect(after[i], before[i].label).toEqual(before[i]);
    }
    // 대조가 «빈 것끼리 같다» 가 아닌지 — 상태 코드가 고루 나왔는지 본다.
    expect(new Set(after.map((one) => one.status))).toEqual(new Set([200, 201, 400, 401, 404, 405, 409]));
  }, 120000);
});

// ───────── 축 ④ 응답을 보내는 줄의 지도 ─────────
describe('축 ④ Step 7 — 응답을 보내는 줄', () => {
  const sendLines = (from) => {
    const out = [];
    for (const dir of ['routes', 'controllers', 'services', 'middlewares']) {
      if (!existsSync(from(dir))) continue;
      for (const name of readdirSync(from(dir)).filter((n) => n.endsWith('.js'))) {
        read(from(`${dir}/${name}`)).split('\n').forEach((line) => {
          if (/\bres\./.test(line) && /\.(json|send)\(/.test(line)) out.push(`${dir}/${name}`);
        });
      }
    }
    read(from('app.js')).split('\n').forEach((line) => { if (/\bres\./.test(line) && /\.(json|send)\(/.test(line)) out.push('app.js'); });
    return out;
  };
  const count = (list) => list.reduce((acc, f) => ({ ...acc, [f]: (acc[f] ?? 0) + 1 }), {});

  it('앞 판 — 라우터 넷 · app.js · legacyCursor 에 흩어져 있다', () => {
    expect(count(sendLines(B))).toEqual({
      'routes/auth.js': 5, 'routes/likes.js': 3, 'routes/posts.js': 5, 'routes/uploads.js': 1,
      'middlewares/legacyCursor.js': 1, 'app.js': 6,
    });
  });

  it('이 판 — controllers 와 app.js, 그리고 legacyCursor 하나', () => {
    expect(count(sendLines(R))).toEqual({
      'controllers/authController.js': 5, 'controllers/likeController.js': 3, 'controllers/postController.js': 5, 'controllers/uploadController.js': 1,
      'middlewares/legacyCursor.js': 1, 'app.js': 6,
    });
  });
});

// ───────── 축 ⑤ 이 회차 학생 파일 ─────────
describe('축 ⑤ 이 회차 학생 파일 — code/p3-35 에서 바뀐 파일', () => {
  it('바뀐 파일은 넷 라우터 · 새 컨트롤러 넷 · 서비스 둘 · 실습 스크립트', () => {
    const changed = execFileSync('git', ['diff', '--name-only', 'code/p3-35', ROUND.fromBookmark ? 'code/p3-36' : 'HEAD', '--', '.', ':!test', ':!snapshots', ':!sql'], { cwd: P('.'), encoding: 'utf8' })
      .trim().split('\n').filter(Boolean).sort();
    expect(changed).toEqual([
      'controllers/authController.js', 'controllers/likeController.js', 'controllers/postController.js', 'controllers/uploadController.js',
      'lab/p3-36/add-user.js',
      'routes/auth.js', 'routes/likes.js', 'routes/posts.js', 'routes/uploads.js',
      'services/authService.js', 'services/userService.js',
    ]);
  });
});
