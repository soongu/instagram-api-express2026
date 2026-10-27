// p3-19 「서버가 «나» 를 알아보게 하기 — 쿠키와 Authorization 헤더」 게이트 — 백엔드
//
// 이 회차는 `3-auth-principles` 첫 회차다. 수업 백엔드에 로그인의 첫 판을 짓는다
// (`routes/auth.js` · `services/userService.js` · `schemas/authSchema.js` · `errors.js` 의
// `UnauthorizedError` · `app.js` 의 `cookie-parser` 와 `/api/auth` · `requests/auth.http`).
// 비밀번호는 아직 없다 — 이름만 대면 믿고 번호를 쿠키에 담아 주는 판이다(해싱은 `p3-35`).
// 판정은 학생이 치는 `node app.js` 를 그대로 띄워 진짜 포트로 왕복한다(`boot.js`).
//
// 축 ① 로그인 — 이름으로 사람을 찾아 쿠키를 준다 · 없는 이름은 401 · 이름을 안 보내면 400.
// 축 ② 나는 누구 — 쿠키의 번호로 그 사람 · 쿠키가 없거나 번호가 이상하면 401 ·
//      다른 쿠키와 섞여 와도 `cookie-parser` 가 가른다.
// 축 ③ 쿠키 값을 고치면 남이 된다(Step 5 의 주장) — 서버는 받은 번호를 그대로 믿는다.
// 축 ④ `Authorization: Bearer <번호>` 로도 알아본다(Step 8) · 헤더가 쿠키보다 먼저.
// 축 ⑤ `Set-Cookie` 의 Step 별 모양 — 옵션을 하나씩 뺀 판을 띄워 교안이 옮겨 적는 줄과 대조.
//      Step 3 의 «날것 판»(`req.headers.cookie` 를 그대로 돌려주는 임시 라우트)도 여기서 띄운다.
// 축 ⑥ `requests/auth.http` 를 httpYac 으로 — 로그인 응답의 쿠키를 기억해 다음 요청에 싣는다 ·
//      손으로 적은 `Cookie:` 에는 기억한 쿠키를 덧붙인다(`# @no-cookie-jar` 가 그것을 뺀다) ·
//      `secure: true` 판이면 httpYac 은 그 쿠키를 `http://localhost` 로 안 보내 401(Step 6 의 주장).
// 축 ⑦ 좋아요의 `/likes/{userId}` 는 이 회차가 안 걷는다 — 로그인과 상관없이 주소의 번호대로.
// 실습·과제 — `lab/p3-19/` 다섯 서버(학생 쪽 경로 주석은 `~/instagram-api/lab/…`).
//
// 🔎 크롬에서만 보이는 주장(Application 탭 · `document.cookie` · 다른 사이트의 폼·링크·이미지)은
//    이 파일이 못 본다 — 기록 `progress/p3-19-cookie-auth.md` 「브라우저 실측」 이 헤드리스 크롬으로 쟀다.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, mkdtempSync, rmSync, cpSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import pg from 'pg';
import { boot } from './helpers/boot.js';
import { setupP236 } from '../sql/p2-36/setup.mjs';

const ROOT = new URL('../', import.meta.url);
const P = (rel) => new URL(rel, ROOT).pathname;
const ADMIN = { host: 'localhost', port: 5432, database: 'postgres', user: 'postgres', password: 'postgres' };
const GATE_DB = 'p319_gate';
const GATE_URL = `postgresql://postgres:postgres@localhost:5432/${GATE_DB}`;
const ENV = { DATABASE_URL: GATE_URL, CORS_ORIGIN: 'http://localhost:5173' };
const PORT = 3491;

const read = (p) => readFileSync(p, 'utf8');

let db = null;
let server = null;

const seed = () =>
  execFileSync(process.execPath, [P('seed.js')],
    { cwd: P('.'), encoding: 'utf8', env: { ...process.env, ...ENV } });

const dropGate = async () => {
  const admin = new pg.Client(ADMIN);
  await admin.connect();
  await admin.query(
    `select pg_terminate_backend(pid) from pg_stat_activity where datname = '${GATE_DB}' and pid <> pg_backend_pid()`);
  await admin.query(`DROP DATABASE IF EXISTS ${GATE_DB}`);
  return admin;
};

beforeAll(async () => {
  const admin = await dropGate();
  await admin.query(`CREATE DATABASE ${GATE_DB}`);
  await admin.end();

  db = new pg.Client({ ...ADMIN, database: GATE_DB });
  await db.connect();
  await setupP236(db);
  seed();

  server = await boot('app.js', {
    port: PORT, env: { ...ENV, PORT: String(PORT) }, ready: `${PORT}번 포트에서`,
  });
}, 120000);

afterAll(async () => {
  if (server) await server.stop();
  if (db) await db.end();
  const admin = await dropGate();
  await admin.end();
}, 60000);

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const login = (base, username) =>
  fetch(`${base}/api/auth/login`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ username }) });
const me = async (base, headers = {}) => {
  const res = await fetch(`${base}/api/auth/me`, { headers });
  return { status: res.status, body: await res.json() };
};

// 학생 폴더를 통째로 임시 폴더에 옮겨, 파일 하나를 바꾼 판을 띄운다(p3-17 과 같은 방식).
const withVariant = async (port, replace, fn) => {
  const dir = mkdtempSync(join(tmpdir(), 'p319-variant-'));
  try {
    for (const name of ['app.js', 'db.js', 'errors.js', 'routes', 'services', 'middlewares', 'schemas', 'requests', 'package.json']) {
      cpSync(P(name), join(dir, name), { recursive: true });
    }
    symlinkSync(P('node_modules'), join(dir, 'node_modules'));
    for (const [rel, edit] of Object.entries(replace)) {
      const before = read(join(dir, rel));
      const after = edit(before);
      // 🚨 바꾸려던 글자가 없으면 «바꾼 판» 이 아니라 원래 판을 재게 된다 — 조용히 넘어가지 않는다.
      if (after === before) throw new Error(`${rel} 에서 바꿀 곳을 못 찾았다`);
      writeFileSync(join(dir, rel), after);
    }
    const variant = await boot(join(dir, 'app.js'), {
      port, env: { ...ENV, PORT: String(port) }, ready: `${port}번 포트에서`,
    });
    try {
      return await fn(variant, dir);
    } finally {
      await variant.stop();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

// 교안 Step 별 판 — 끝 판의 쿠키 옵션에서 하나씩 뺀다.
const OPTIONS_FINAL = `{
    httpOnly: true,
    sameSite: 'lax',
    maxAge: SEVEN_DAYS,
  }`;
const optionsAs = (text) => (src) => src.replace(OPTIONS_FINAL, text);
const STEP2 = (src) => src.replace(`, ${OPTIONS_FINAL}`, '');
const STEP4 = optionsAs(`{
    maxAge: SEVEN_DAYS,
  }`);
const STEP6 = optionsAs(`{
    httpOnly: true,
    maxAge: SEVEN_DAYS,
  }`);
// Step 6 의 실험 — 교안은 Step 6 판(httpOnly + maxAge)에 `secure: true` 를 더한 블록을 보인다.
const STEP6_SECURE = optionsAs(`{
    httpOnly: true,
    maxAge: SEVEN_DAYS,
    secure: true,
  }`);
// Step 3 첫 판 — 들어온 쿠키를 그대로 보여 주기만 하는 /me (교안 블록 그대로).
const ME_FINAL_START = "router.get('/me', async (req, res) => {";
const STEP3_RAW = (src) => {
  const start = src.indexOf(ME_FINAL_START);
  if (start < 0) return src;
  const end = src.indexOf('});', start) + '});'.length;
  return `${src.slice(0, start)}router.get('/me', (req, res) => {
  console.log(req.headers.cookie);
  res.json({ cookie: req.headers.cookie });
});${src.slice(end)}`;
};

// httpYac CLI 로 `.http` 를 위에서부터 보낸다 — 학생이 VS Code 에서 차례로 누르는 것과 같다.
// 🚨 httpYac 은 실행 폴더 밖의 파일을 거부한다(`Path … is not in cwd`) — 그 폴더에서 돌린다.
const sendHttp = (file, port, name = 'auth.http') => {
  const text = read(file).replaceAll('http://localhost:3000', `http://localhost:${port}`);
  const dir = mkdtempSync(join(tmpdir(), 'p319-http-'));
  try {
    writeFileSync(join(dir, name), text);
    const out = execFileSync(P('node_modules/.bin/httpyac'),
      ['send', name, '--all', '--json'], { encoding: 'utf-8', cwd: dir });
    return JSON.parse(out).requests;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

describe('축 ① — 로그인은 이름으로 사람을 찾아 쿠키를 준다', () => {
  it('🔴 jaehoon 으로 로그인하면 200 · 그 사람 · `Set-Cookie: userId=2`', async () => {
    const res = await login(server.base, 'jaehoon');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: 2, username: 'jaehoon', profileImage: 'https://picsum.photos/seed/jaehoon/40/40',
    });
    expect(res.headers.getSetCookie()).toHaveLength(1);
    expect(res.headers.getSetCookie()[0]).toMatch(/^userId=2; /);
  });

  it('🔴 시드는 이름순으로 넣는다 — dahye 1 · jaehoon 2 · minji 3 · nayeon 4(사진 없음) · seungwoo 5', async () => {
    const got = [];
    for (const name of ['dahye', 'jaehoon', 'minji', 'nayeon', 'seungwoo']) {
      const body = await (await login(server.base, name)).json();
      got.push([body.id, body.username, body.profileImage === null ? null : 'photo']);
    }
    expect(got).toEqual([
      [1, 'dahye', 'photo'], [2, 'jaehoon', 'photo'], [3, 'minji', 'photo'], [4, 'nayeon', null], [5, 'seungwoo', 'photo'],
    ]);
  });

  it('🔴 없는 이름은 401 · 쿠키를 안 준다', async () => {
    const res = await login(server.base, 'hana');
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ message: '그런 사용자는 없어요' });
    expect(res.headers.getSetCookie()).toEqual([]);
  });

  it('🔴 이름을 안 보내면 400(보낸 내용 검사)', async () => {
    const res = await fetch(`${server.base}/api/auth/login`, { method: 'POST', headers: JSON_HEADERS, body: '{}' });
    expect(res.status).toBe(400);
    expect((await res.json()).message).toBe('보낸 내용이 규칙에 안 맞아요');
  });

  it('🔴 끝 판의 쿠키는 Max-Age 7일 · HttpOnly · SameSite=Lax · Secure 없음', async () => {
    const res = await login(server.base, 'jaehoon');
    const line = res.headers.getSetCookie()[0];
    expect(line).toMatch(/^userId=2; Max-Age=604800; Path=\/; Expires=[A-Z][a-z]{2}, \d\d [A-Z][a-z]{2} \d{4} \d\d:\d\d:\d\d GMT; HttpOnly; SameSite=Lax$/);
    expect(line).not.toContain('Secure');
  });
});

describe('축 ② — 나는 누구: 쿠키의 번호로 그 사람을 찾는다', () => {
  it('🔴 쿠키가 없으면 401 「로그인이 필요해요」', async () => {
    expect(await me(server.base)).toEqual({ status: 401, body: { message: '로그인이 필요해요' } });
  });

  it('🔴 `Cookie: userId=2` 면 jaehoon', async () => {
    const { status, body } = await me(server.base, { Cookie: 'userId=2' });
    expect(status).toBe(200);
    expect(body.username).toBe('jaehoon');
  });

  it('🔴 다른 쿠키와 섞여 와도 userId 만 골라 읽는다', async () => {
    const { body } = await me(server.base, { Cookie: 'theme=dark; userId=3; lang=ko' });
    expect(body).toEqual({ id: 3, username: 'minji', profileImage: 'https://picsum.photos/seed/minji/40/40' });
  });

  it('🔴 번호가 숫자가 아니거나 없는 번호면 401', async () => {
    expect((await me(server.base, { Cookie: 'userId=abc' })).status).toBe(401);
    expect((await me(server.base, { Cookie: 'userId=999' })).status).toBe(401);
    expect((await me(server.base, { Cookie: 'userId=' })).status).toBe(401);
  });

  it('🔴 같은 이름이 두 번 오면 앞의 것을 읽는다(httpYac 이 기억한 쿠키를 뒤에 덧붙일 때)', async () => {
    expect((await me(server.base, { Cookie: 'userId=1; userId=2' })).body.username).toBe('dahye');
  });
});

describe('축 ③ — 쿠키 값을 고치면 남이 된다', () => {
  it('🔴 jaehoon 으로 로그인한 쿠키의 2 를 1 로 고치면 dahye', async () => {
    const res = await login(server.base, 'jaehoon');
    const forged = res.headers.getSetCookie()[0].split(';')[0].replace('userId=2', 'userId=1');
    expect(forged).toBe('userId=1');
    expect((await me(server.base, { Cookie: forged })).body.username).toBe('dahye');
  });
});

describe('축 ④ — `Authorization: Bearer <번호>` 로도 알아본다', () => {
  it('🔴 헤더만 있어도 그 사람', async () => {
    expect((await me(server.base, { Authorization: 'Bearer 3' })).body.username).toBe('minji');
  });

  it('🔴 헤더와 쿠키가 둘 다 오면 헤더가 먼저', async () => {
    expect((await me(server.base, { Authorization: 'Bearer 4', Cookie: 'userId=1' })).body.username).toBe('nayeon');
  });

  it('🔴 Bearer 가 아닌 헤더는 못 본 것으로 치고 쿠키를 본다 · Bearer 뒤가 숫자가 아니면 401', async () => {
    expect((await me(server.base, { Authorization: 'Basic 2', Cookie: 'userId=1' })).body.username).toBe('dahye');
    expect((await me(server.base, { Authorization: 'Bearer abc' })).status).toBe(401);
  });
});

describe('축 ⑤ — Step 별 판', () => {
  it('🔴 Step 2 판(옵션 없음) — `userId=2; Path=/`', async () => {
    await withVariant(3492, { 'routes/auth.js': STEP2 }, async (v) => {
      const res = await login(v.base, 'jaehoon');
      expect(res.headers.getSetCookie()).toEqual(['userId=2; Path=/']);
    });
  });

  it('🔴 Step 3 첫 판 — 들어온 쿠키 글자 한 줄을 그대로 돌려주고 터미널에도 찍는다', async () => {
    await withVariant(3497, { 'routes/auth.js': STEP3_RAW }, async (v) => {
      const res = await fetch(`${v.base}/api/auth/me`, { headers: { Cookie: 'userId=2' } });
      expect(await res.json()).toEqual({ cookie: 'userId=2' });
      await new Promise((r) => setTimeout(r, 200));
      expect(v.tail().split('\n')).toContain('userId=2');
    });
  });

  it('🔴 Step 4 판(maxAge) — `Max-Age=604800` 과 7일 뒤 Expires', async () => {
    await withVariant(3493, { 'routes/auth.js': STEP4 }, async (v) => {
      const before = Date.now();
      const line = (await login(v.base, 'jaehoon')).headers.getSetCookie()[0];
      expect(line).toMatch(/^userId=2; Max-Age=604800; Path=\/; Expires=.+ GMT$/);
      const expires = Date.parse(line.split('Expires=')[1]);
      expect(Math.abs(expires - (before + 7 * 24 * 60 * 60 * 1000))).toBeLessThan(5000);
    });
  });

  it('🔴 Step 6 판(httpOnly) — 끝에 `HttpOnly`', async () => {
    await withVariant(3494, { 'routes/auth.js': STEP6 }, async (v) => {
      const line = (await login(v.base, 'jaehoon')).headers.getSetCookie()[0];
      expect(line).toMatch(/^userId=2; Max-Age=604800; Path=\/; Expires=.+ GMT; HttpOnly$/);
    });
  });

  it('🔴 Step 6 의 secure 실험 판 — `HttpOnly; Secure`', async () => {
    await withVariant(3495, { 'routes/auth.js': STEP6_SECURE }, async (v) => {
      const line = (await login(v.base, 'jaehoon')).headers.getSetCookie()[0];
      expect(line).toMatch(/; HttpOnly; Secure$/);
    });
  });
});

describe('축 ⑥ — `requests/auth.http` 를 httpYac 으로', () => {
  it('🔴 다섯 요청 — 로그인 200 · 나는 누구 jaehoon(쿠키를 기억) · 없는 이름 401 · 고친 쿠키 dahye · 헤더 minji', async () => {
    const out = sendHttp(P('requests/auth.http'), PORT);
    expect(out.map((r) => r.title)).toEqual(['로그인', '나는 누구', '없는 이름으로 로그인', '쿠키를 고쳐서 보내면', '헤더로 보내면']);
    expect(out.map((r) => r.response.statusCode)).toEqual([200, 200, 401, 200, 200]);
    expect(out[0].response.headers['set-cookie']).toEqual([expect.stringMatching(/^userId=2; Max-Age=604800; Path=\//)]);
    expect(out[1].response.request.headers.cookie).toBe('userId=2');
    expect(JSON.parse(out[1].response.body).username).toBe('jaehoon');
    // 실패한 로그인도 기억한 쿠키를 싣는다 — 쿠키를 지우지 않는다
    expect(out[2].response.request.headers.cookie).toBe('userId=2');
    expect(out[3].response.request.headers.cookie).toBe('userId=1');
    expect(JSON.parse(out[3].response.body).username).toBe('dahye');
    expect(out[4].response.request.headers.cookie).toBeUndefined();
    expect(JSON.parse(out[4].response.body).username).toBe('minji');
  }, 60000);

  it('🔴 `# @no-cookie-jar` 를 빼면 기억한 쿠키가 뒤에 붙어 `userId=1; userId=2` 가 간다(그래도 dahye)', async () => {
    await withVariant(3498, { 'requests/auth.http': (s) => s.replace('### 쿠키를 고쳐서 보내면\n# @no-cookie-jar\n', '### 쿠키를 고쳐서 보내면\n') },
      async (v, dir) => {
        const out = sendHttp(join(dir, 'requests/auth.http'), 3498);
        expect(out[3].response.request.headers.cookie).toBe('userId=1; userId=2');
        expect(JSON.parse(out[3].response.body).username).toBe('dahye');
      });
  }, 60000);

  it('🔴 secure 판이면 httpYac 은 그 쿠키를 http://localhost 로 안 보내 나는 누구가 401', async () => {
    await withVariant(3496, { 'routes/auth.js': STEP6_SECURE }, async (v, dir) => {
      const out = sendHttp(join(dir, 'requests/auth.http'), 3496);
      expect(out[0].response.statusCode).toBe(200);
      expect(out[1].response.request.headers.cookie).toBeUndefined();
      expect(out[1].response.statusCode).toBe(401);
    });
  }, 60000);
});

describe('축 ⑦ — 좋아요의 `/likes/{userId}` 는 이 회차가 안 걷는다', () => {
  it('🔴 jaehoon 으로 로그인해 둔 쿠키를 실어도 `/likes/1` 은 dahye 의 좋아요로 들어간다', async () => {
    const cookie = (await login(server.base, 'jaehoon')).headers.getSetCookie()[0].split(';')[0];
    const put = await fetch(`${server.base}/api/posts/1/likes/1`, { method: 'PUT', headers: { Cookie: cookie } });
    expect(put.status).toBe(200);
    expect((await put.json()).liked).toBe(true);
    const likers = await (await fetch(`${server.base}/api/posts/1/likes`)).json();
    expect(likers).toContain('dahye');
    expect(likers).not.toContain('jaehoon');
    await fetch(`${server.base}/api/posts/1/likes/1`, { method: 'DELETE' });
    expect(await (await fetch(`${server.base}/api/posts/1/likes`)).json()).not.toContain('dahye');
  });
});

// ── 직접 해보기·과제 — 학생 폴더 `~/instagram-api/lab/` (코드베이스는 `lab/p3-19/`) ──
const bootLab = (file, port) => boot(`lab/p3-19/${file}`, { port, ready: `${port}번 포트에서` });

describe('직접 해보기 1 — 방문 횟수 쿠키', () => {
  it('🔴 쿠키 없이 오면 1 · 받은 쿠키를 돌려주면 하나씩 는다 · 이상한 값이면 처음부터', async () => {
    const lab = await bootLab('practice1.js', 4001);
    try {
      expect(lab.log.trim()).toBe('실습 서버가 4001번 포트에서 기다리고 있어요.');
      let res = await fetch(`${lab.base}/`);
      expect(await res.text()).toBe('1번째 방문이에요');
      expect(res.headers.getSetCookie()).toEqual(['visits=1; Path=/']);
      res = await fetch(`${lab.base}/`, { headers: { Cookie: 'visits=1' } });
      expect(await res.text()).toBe('2번째 방문이에요');
      expect(res.headers.getSetCookie()).toEqual(['visits=2; Path=/']);
      res = await fetch(`${lab.base}/`, { headers: { Cookie: 'userId=2; visits=7' } });
      expect(await res.text()).toBe('8번째 방문이에요');
      res = await fetch(`${lab.base}/`, { headers: { Cookie: 'visits=abc' } });
      expect(await res.text()).toBe('1번째 방문이에요');
    } finally {
      await lab.stop();
    }
  });

  it('🔴 `|| 0` 을 빠뜨린 판은 abc 에서 「NaN번째」 — 요구사항 7 이 그 판을 가른다', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'p319-lab1-'));
    try {
      writeFileSync(join(dir, 'practice1.js'),
        read(P('lab/p3-19/practice1.js')).replace('Number(req.cookies.visits) || 0', 'Number(req.cookies.visits)'));
      symlinkSync(P('node_modules'), join(dir, 'node_modules'));
      writeFileSync(join(dir, 'package.json'), '{"type":"module"}');
      const lab = await boot(join(dir, 'practice1.js'), { port: 4001, ready: '4001번 포트에서' });
      try {
        expect(await (await fetch(`${lab.base}/`, { headers: { Cookie: 'visits=abc' } })).text()).toBe('NaN번째 방문이에요');
      } finally {
        await lab.stop();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('직접 해보기 2 — 스크립트가 읽어도 되는 쿠키', () => {
  it('🔴 theme 는 그냥, loginUser 는 HttpOnly 로 준다 · 페이지 스크립트가 document.cookie 를 그린다', async () => {
    const lab = await bootLab('practice2.js', 4002);
    try {
      const res = await fetch(`${lab.base}/`);
      expect(res.headers.getSetCookie()).toEqual(['theme=dark; Path=/', 'loginUser=jaehoon; Path=/; HttpOnly']);
      const html = await res.text();
      expect(html).toContain("'스크립트가 읽은 쿠키: ' + document.cookie");
      expect(html).toContain("document.cookie.includes('theme=dark')");
    } finally {
      await lab.stop();
    }
  });

  it('🔴 시작 판은 해설 판에서 `{ httpOnly: true }` 하나만 다르다', () => {
    const start = read(P('snapshots/p3-19.practice2-start.js'));
    const done = read(P('lab/p3-19/practice2.js'));
    expect(done.replace("res.cookie('loginUser', 'jaehoon', { httpOnly: true });", "res.cookie('loginUser', 'jaehoon');")).toBe(start);
  });
});

describe('직접 해보기 3 — SameSite 세 가지', () => {
  it('🔴 /set 은 세 쿠키 · /check 는 받은 쿠키를 터미널에 찍는다 · /other-site 는 링크·폼·이미지', async () => {
    const lab = await bootLab('practice3.js', 4003);
    try {
      const set = await fetch(`${lab.base}/set`);
      expect(set.headers.getSetCookie()).toEqual([
        'strict=1; Path=/; SameSite=Strict', 'lax=1; Path=/; SameSite=Lax', 'none=1; Path=/; Secure; SameSite=None',
      ]);
      const check = await fetch(`${lab.base}/check?from=link`, { headers: { Cookie: 'lax=1; none=1' } });
      expect(await check.text()).toBe('받은 쿠키: lax=1; none=1');
      await fetch(`${lab.base}/check?from=form`, { method: 'POST' });
      await new Promise((r) => setTimeout(r, 200));
      expect(lab.tail()).toContain('GET link → lax=1; none=1');
      expect(lab.tail()).toContain('POST form → (쿠키 없음)');
      const page = await (await fetch(`${lab.base}/other-site`)).text();
      expect(page).toContain('<a href="http://localhost:4003/check?from=link">');
      expect(page).toContain('<form method="post" action="http://localhost:4003/check?from=form">');
      expect(page).toContain('<img src="http://localhost:4003/check?from=image"');
    } finally {
      await lab.stop();
    }
  });
});

describe('과제 [기초] — 언어 설정 쿠키', () => {
  it('🔴 ?lang=en 은 Hello + 30일 쿠키 · 쿠키만 있으면 그 언어 · 없거나 모르는 값이면 한국어', async () => {
    const lab = await bootLab('homework1.js', 4011);
    try {
      expect(lab.log.trim()).toBe('과제 서버가 4011번 포트에서 기다리고 있어요.');
      let res = await fetch(`${lab.base}/?lang=en`);
      expect(await res.text()).toBe('Hello');
      expect(res.headers.getSetCookie()[0]).toMatch(/^lang=en; Max-Age=2592000; Path=\/; Expires=.+ GMT$/);
      res = await fetch(`${lab.base}/`, { headers: { Cookie: 'lang=en' } });
      expect(await res.text()).toBe('Hello');
      expect(res.headers.getSetCookie()).toEqual([]);
      expect(await (await fetch(`${lab.base}/`)).text()).toBe('안녕하세요');
      res = await fetch(`${lab.base}/?lang=fr`, { headers: { Cookie: 'lang=en' } });
      expect(await res.text()).toBe('Hello');
      expect(res.headers.getSetCookie()).toEqual([]);
      res = await fetch(`${lab.base}/?lang=ko`, { headers: { Cookie: 'lang=en' } });
      expect(await res.text()).toBe('안녕하세요');
      expect(res.headers.getSetCookie()[0]).toMatch(/^lang=ko; Max-Age=2592000; /);
    } finally {
      await lab.stop();
    }
  });
});

describe('과제 [응용] — Authorization 헤더로만 받는 API 키', () => {
  it('🔴 homework2.http 네 요청 — 401(WWW-Authenticate) · 401 · 200 · 401(쿠키로는 안 된다)', async () => {
    const lab = await bootLab('homework2.js', 4012);
    try {
      expect(lab.log.trim()).toBe('과제 서버가 4012번 포트에서 기다리고 있어요.');
      const out = sendHttp(P('lab/p3-19/homework2.http'), 4012, 'homework2.http');
      expect(out.map((r) => r.title)).toEqual(['아무것도 안 싣고', '틀린 키로', '맞는 키로', '쿠키에 실어 보내면']);
      expect(out.map((r) => r.response.statusCode)).toEqual([401, 401, 200, 401]);
      expect(out.map((r) => JSON.parse(r.response.body).message)).toEqual([
        'API 키가 필요해요', 'API 키가 맞지 않아요', '비밀 내용이에요', 'API 키가 필요해요']);
      expect(out[0].response.headers['www-authenticate']).toBe('Bearer');
      expect(out[1].response.headers['www-authenticate']).toBeUndefined();
      expect(out[3].response.headers['www-authenticate']).toBe('Bearer');
    } finally {
      await lab.stop();
    }
  }, 60000);
});
