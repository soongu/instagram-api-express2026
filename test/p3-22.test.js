// p3-22 「프로젝트 소개와 회원가입」 게이트 — 백엔드
//
// `4-react-auth` 첫 회차다. 화면(`instagram-next`)의 회원가입이 부를 API 를 수업 백엔드에 처음 짓는다
// (`curriculum.md` 「`p3-22` 착수 결정」 ①). 비밀번호는 «규칙만 검사하고 저장하지 않는다» — 지금 로그인이
// 이름만 대면 믿는 판(`p3-19`·`p3-20`)이라 같은 단계이고, 비밀번호 컬럼과 해싱은 `p3-35` 가 더한다.
// 판정은 학생이 치는 `node app.js` 를 그대로 띄워 진짜 포트로 왕복한다(`boot.js`).
//
// 축 ① 마이그레이션 — `users` 에 email·phone·name(셋 다 NULL 허용) · email·phone 은 UNIQUE · 있던 다섯 명은 NULL.
// 축 ② 가입 — `POST /api/auth/signup` 201 `{ message, username }` · 휴대폰 번호는 하이픈을 빼고 저장 ·
//      비밀번호는 어디에도 안 남는다 · 규칙에 안 맞으면 400(details) · 겹치면 409.
// 축 ③ Step 3 의 중간 판 — `createUser` 가 P2002 를 안 잡으면 겹친 가입이 500(스냅숏).
// 축 ④ 중복 확인 — `GET /api/auth/check-duplicate?type=&value=` `{ available, message }` · type 이 셋 밖이면 400.
// 축 ⑤ 가입한 사람은 지금 로그인(이름만)으로 바로 들어온다.
// 축 ⑥ `requests/auth.http` 를 httpYac 으로 — 앞 여섯 요청 뒤에 가입·중복 확인 넷.
// 축 ⑦ 🔀 2026-10-30 학생 낭독 집중 검수 — Step 6 이 화면이 막은 네 값을 `.http` 로 «화면을 거치지 않고» 보내 400 을 받는다.
//      그 요청은 회차를 닫은 «뒤» 에 더했다 — 북마크 `code/p3-22` 가 아니라 선의 tip(`main`)의 `requests/auth.http` 끝에 있다
//      (트랙 캐논 「지나간 회차의 결함은 선 위에서 고친다」). 교안의 `### 규칙에 안 맞는 값으로 가입` 블록 · 400 블록과 대조한다.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, mkdtempSync, rmSync, writeFileSync, cpSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import pg from 'pg';
import { boot } from './helpers/boot.js';
import { roundDir } from './helpers/round.js';
import { applyMigrationsAfter } from './helpers/tip-schema.js';
import { P235_MIGRATIONS } from '../sql/p2-36/setup.mjs';

const ROOT = new URL('../', import.meta.url);
const P = (rel) => new URL(rel, ROOT).pathname;
const ADMIN = { host: 'localhost', port: 5432, database: 'postgres', user: 'postgres', password: 'postgres' };
const GATE_DB = 'p322_gate';
const GATE_URL = `postgresql://postgres:postgres@localhost:5432/${GATE_DB}`;
const ENV = { DATABASE_URL: GATE_URL, CORS_ORIGIN: 'http://localhost:5173' };
const PORT = 3622;
const SNAP_PORT = 3623;
const MIGRATION = '20261029031804_add_user_signup_fields';

const read = (p) => readFileSync(p, 'utf8');

// 교안 — 분리 worktree 에서도 찾게 git 공통 디렉터리(…/code/instagram-api/.git)에서 트랙으로 올라간다.
const COMMON = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: P('.'), encoding: 'utf8' }).trim();
const LECTURE = join(COMMON, '..', '..', '..', 'part3/4-react-auth/p3-22-signup-lecture.md');
/** 교안에서 첫 줄이 `first` 인 `tag` 펜스의 줄들(펜스 줄 제외). */
const lectureFence = (tag, first) => {
  const lines = read(LECTURE).split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === '```' + tag && lines[i + 1] === first) {
      const end = lines.indexOf('```', i + 1);
      return lines.slice(i + 1, end);
    }
  }
  return null;
};

// 학생 파일은 이 회차 북마크 `code/p3-22` 를 풀어서 읽는다(없으면 작업트리 — 이 회차를 짓는 동안).
const ROUND = roundDir('code/p3-22');
const R = (rel) => join(ROUND.dir, rel);

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

const bootApp = (dir, port) => boot(join(dir, 'app.js'), {
  port, env: { ...ENV, PORT: String(port) }, ready: `${port}번 포트에서`,
});

beforeAll(async () => {
  const admin = await dropGate();
  await admin.query(`CREATE DATABASE ${GATE_DB}`);
  await admin.end();

  db = new pg.Client({ ...ADMIN, database: GATE_DB });
  await db.connect();
  for (const dir of [...P235_MIGRATIONS, MIGRATION]) {
    await db.query(read(R(`prisma/migrations/${dir}/migration.sql`)));
  }
  // 🚨 2026-11-10 p3-39 — 작업트리 스키마에 users.password_hash 가 생겼다. 시드가 작업트리 클라이언트로 돌아 그 칸까지 고르므로
  //    (P2022) 이 회차의 마이그레이션 뒤로 tip 의 것을 얹는다. 이 회차의 학생 파일은 그 칸을 읽지도 쓰지도 않는다(test/helpers/tip-schema.js).
  await applyMigrationsAfter(db, MIGRATION);
  seed();

  server = await bootApp(ROUND.dir, PORT);
}, 120000);

afterAll(async () => {
  if (server) await server.stop();
  if (db) await db.end();
  const admin = await dropGate();
  await admin.end();
  ROUND.cleanup();
}, 60000);

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const post = async (base, path, body) => {
  const res = await fetch(`${base}${path}`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json(), headers: res.headers };
};
const signup = (base, body) => post(base, '/api/auth/signup', body);
const check = async (base, query) => {
  const res = await fetch(`${base}/api/auth/check-duplicate?${query}`);
  return { status: res.status, body: await res.json() };
};
const userRow = async (username) =>
  (await db.query('SELECT username, email, phone, name FROM users WHERE username = $1', [username])).rows[0];

// 학생 폴더를 임시 폴더에 옮겨 둔다(파일 하나를 바꾼 판을 띄울 때).
const STUDENT = ['app.js', 'db.js', 'errors.js', 'routes', 'services', 'middlewares', 'schemas', 'package.json'];
const copyStudent = (from, prefix) => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  for (const name of STUDENT) cpSync(join(from, name), join(dir, name), { recursive: true });
  symlinkSync(P('node_modules'), join(dir, 'node_modules'));
  return dir;
};

describe('축 ① — users 에 칸 셋을 더하는 마이그레이션', () => {
  it('🔴 스키마 — email·phone 은 UNIQUE 이고 name 과 함께 비워 둘 수 있다(String?)', () => {
    const schema = read(R('prisma/schema.prisma'));
    expect(schema).toContain('  email        String?   @unique @db.VarChar(255)\n');
    expect(schema).toContain('  phone        String?   @unique @db.VarChar(20)\n');
    expect(schema).toContain('  name         String?   @db.VarChar(50)\n');
    expect(schema).not.toMatch(/password/);
  });

  it('🔴 마이그레이션 SQL — 컬럼 셋을 더하고 UNIQUE 인덱스 둘', () => {
    const sql = read(R(`prisma/migrations/${MIGRATION}/migration.sql`));
    expect(sql).toContain('ALTER TABLE "users" ADD COLUMN     "email" VARCHAR(255),\nADD COLUMN     "name" VARCHAR(50),\nADD COLUMN     "phone" VARCHAR(20);');
    expect(sql).toContain('CREATE UNIQUE INDEX "users_email_key" ON "users"("email");');
    expect(sql).toContain('CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");');
  });

  it('🔴 있던 다섯 명은 셋 다 NULL — NULL 끼리는 UNIQUE 에 안 걸린다', async () => {
    const { rows } = await db.query(
      `SELECT username, email, phone, name FROM users WHERE username IN ('dahye','jaehoon','minji','nayeon','seungwoo') ORDER BY id`);
    expect(rows).toHaveLength(5);
    for (const row of rows) expect([row.email, row.phone, row.name]).toEqual([null, null, null]);
  });
});

describe('축 ② — 가입: POST /api/auth/signup', () => {
  it('🔴 이메일로 가입하면 201 · `{ message: "가입했어요", username }` · 테이블에 이메일과 성명', async () => {
    const res = await signup(server.base,
      { emailOrPhone: 'sora@example.com', name: '한소라', username: 'sora', password: 'sora1234' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ message: '가입했어요', username: 'sora' });
    expect(await userRow('sora')).toEqual({ username: 'sora', email: 'sora@example.com', phone: null, name: '한소라' });
  });

  it('🔴 휴대폰 번호로 가입하면 하이픈을 빼고 phone 에 · email 은 NULL', async () => {
    const res = await signup(server.base,
      { emailOrPhone: '010-1234-5678', name: '오지훈', username: 'jihoon', password: 'jihoon1234' });
    expect(res.status).toBe(201);
    expect(await userRow('jihoon')).toEqual({ username: 'jihoon', email: null, phone: '01012345678', name: '오지훈' });
  });

  it('🔴 비밀번호는 어디에도 안 남는다 — 테이블에도 응답에도', async () => {
    const { rows } = await db.query(`SELECT * FROM users WHERE username = 'sora'`);
    expect(JSON.stringify(rows[0])).not.toContain('sora1234');
    expect(Object.keys(rows[0])).not.toContain('password');
  });

  it('🔴 규칙에 안 맞으면 400 「보낸 내용이 규칙에 안 맞아요」 · details 에 칸마다 문장', async () => {
    const res = await signup(server.base, { emailOrPhone: 'abc', name: ' ', username: 'so ra', password: '1234' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('보낸 내용이 규칙에 안 맞아요');
    expect(res.body.details.properties).toEqual({
      emailOrPhone: { errors: ['이메일 주소나 휴대폰 번호를 적어 주세요'] },
      name: { errors: ['성명을 적어 주세요'] },
      username: { errors: ['사용자 이름은 영문, 숫자, 밑줄(_), 마침표(.)만 쓸 수 있어요'] },
      password: { errors: ['비밀번호는 8자 이상이어야 해요'] },
    });
    expect((await db.query(`SELECT count(*)::int AS n FROM users WHERE username = 'so ra'`)).rows[0].n).toBe(0);
  });

  it('🔴 이미 있는 사용자 이름 · 이메일 · 휴대폰 번호(하이픈 있든 없든)는 409 「이미 쓰고 있는 …」', async () => {
    const conflict = { message: '이미 쓰고 있는 사용자 이름이나 연락처예요' };
    const sameName = await signup(server.base,
      { emailOrPhone: 'new1@example.com', name: '김재훈', username: 'jaehoon', password: 'jaehoon1234' });
    expect(sameName).toMatchObject({ status: 409, body: conflict });
    const sameEmail = await signup(server.base,
      { emailOrPhone: 'sora@example.com', name: '다른 소라', username: 'sora2', password: 'sora1234' });
    expect(sameEmail).toMatchObject({ status: 409, body: conflict });
    const samePhone = await signup(server.base,
      { emailOrPhone: '01012345678', name: '다른 지훈', username: 'jihoon2', password: 'jihoon1234' });
    expect(samePhone).toMatchObject({ status: 409, body: conflict });
    expect((await db.query(`SELECT count(*)::int AS n FROM users WHERE username IN ('sora2','jihoon2')`)).rows[0].n).toBe(0);
  });
});

describe('축 ③ — Step 3 중간 판: P2002 를 안 잡으면 500', () => {
  it('🔴 `snapshots/p3-22.step3-no-conflict.userService.js` 판으로 같은 이름 가입 → 500 「서버에서 문제가 생겼어요」', async () => {
    const dir = copyStudent(ROUND.dir, 'p322-step3-');
    cpSync(P('snapshots/p3-22.step3-no-conflict.userService.js'), join(dir, 'services/userService.js'));
    const app = await bootApp(dir, SNAP_PORT);
    try {
      const res = await signup(app.base,
        { emailOrPhone: 'x9@example.com', name: '김재훈', username: 'jaehoon', password: 'jaehoon1234' });
      expect(res).toMatchObject({ status: 500, body: { message: '서버에서 문제가 생겼어요' } });
      expect(app.tail()).toContain('Unique constraint failed on the constraint: `users_username_key`');
      expect(app.tail()).toContain("code: 'P2002'");
    } finally {
      await app.stop();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('🔴 스냅숏은 끝 판에서 try/catch 만 뺀 것', () => {
    const final = read(R('services/userService.js'));
    const snap = read(P('snapshots/p3-22.step3-no-conflict.userService.js'));
    expect(snap).not.toContain('P2002');
    expect(final).toContain("if (error.code === 'P2002')");
  });
});

describe('축 ④ — 중복 확인: GET /api/auth/check-duplicate', () => {
  it('🔴 쓰고 있는 사용자 이름 → available false · 처음 보는 이름 → true', async () => {
    expect(await check(server.base, 'type=username&value=jaehoon')).toEqual({
      status: 200, body: { available: false, message: '이미 쓰고 있는 사용자 이름이에요' },
    });
    expect(await check(server.base, 'type=username&value=yuna')).toEqual({
      status: 200, body: { available: true, message: '쓸 수 있어요' },
    });
  });

  it('🔴 이메일 · 휴대폰 번호(하이픈을 빼고 찾는다)', async () => {
    expect((await check(server.base, 'type=email&value=sora@example.com')).body)
      .toEqual({ available: false, message: '이미 가입한 이메일이에요' });
    expect((await check(server.base, 'type=phone&value=010-1234-5678')).body)
      .toEqual({ available: false, message: '이미 가입한 휴대폰 번호예요' });
    expect((await check(server.base, 'type=phone&value=01012345678')).body.available).toBe(false);
    expect((await check(server.base, 'type=phone&value=010-9999-0000')).body.available).toBe(true);
    // 가입은 앞뒤 공백을 지우고 저장하니(signupSchema 의 trim) 중복 확인도 지운 값으로 찾는다.
    expect((await check(server.base, 'type=email&value=%20sora@example.com%20')).body.available).toBe(false);
  });

  it('🔴 type 이 셋 밖이거나 value 가 비면 400', async () => {
    expect((await check(server.base, 'type=name&value=한소라')).status).toBe(400);
    expect((await check(server.base, 'type=username&value=')).status).toBe(400);
    expect((await check(server.base, 'type=username')).status).toBe(400);
  });
});

describe('축 ⑤ — 가입한 사람은 지금 로그인(이름만)으로 들어온다', () => {
  it('🔴 sora 로 로그인 → 200 · /me 가 sora', async () => {
    const res = await fetch(`${server.base}/api/auth/login`,
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ username: 'sora' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ username: 'sora', profileImage: null });
    const cookie = res.headers.getSetCookie()[0].split(';')[0];
    const me = await fetch(`${server.base}/api/auth/me`, { headers: { Cookie: cookie } });
    expect((await me.json()).username).toBe('sora');
  });
});

describe('축 ⑥ — requests/auth.http 를 httpYac 으로', () => {
  it('🔴 열 요청 — 앞 여섯은 그대로 · 가입 201 · 같은 이름 409 · 중복 확인 둘', async () => {
    await db.query(`DELETE FROM users WHERE username IN ('sora', 'jihoon')`);
    const text = read(R('requests/auth.http')).replaceAll('http://localhost:3000', `http://localhost:${PORT}`);
    const dir = mkdtempSync(join(tmpdir(), 'p322-http-'));
    try {
      writeFileSync(join(dir, 'auth.http'), text);
      const out = execFileSync(P('node_modules/.bin/httpyac'), ['send', 'auth.http', '--all', '--json'],
        { encoding: 'utf-8', cwd: dir });
      const requests = JSON.parse(out).requests;
      const names = requests.map((r) => r.name);
      expect(names).toEqual([
        '로그인', '나는 누구', '없는 이름으로 로그인', '쿠키를 고쳐서 보내면', '헤더로 보내면', '로그아웃',
        '회원가입', '이미 있는 사용자 이름으로 가입', '사용자 이름 중복 확인', '휴대폰 번호 중복 확인',
      ]);
      const status = requests.map((r) => r.response.statusCode);
      expect(status.slice(6)).toEqual([201, 409, 200, 200]);
      expect(JSON.parse(requests[6].response.body)).toEqual({ message: '가입했어요', username: 'sora' });
      expect(JSON.parse(requests[8].response.body)).toEqual({ available: false, message: '이미 쓰고 있는 사용자 이름이에요' });
      expect(JSON.parse(requests[9].response.body)).toEqual({ available: true, message: '쓸 수 있어요' });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('축 ⑦ — Step 6: 화면이 막은 값을 `.http` 로 보내면 서버가 400 으로 막는다(main 의 auth.http 끝)', () => {
  const NAME = '### 규칙에 안 맞는 값으로 가입';

  it('🔴 교안의 요청 블록이 main 의 `requests/auth.http` 맨 끝 요청과 글자까지 같다', () => {
    const block = lectureFence('http', NAME);
    expect(block, '교안 Step 6 에 그 요청 블록이 없다').not.toBeNull();
    const file = read(P('requests/auth.http'));
    expect(file.endsWith(`${block.join('\n')}\n`)).toBe(true);
  });

  it('🔴 httpYac 으로 보내면 400 · 본문이 교안의 400 블록과 같다 · 행은 안 생긴다', async () => {
    const text = read(P('requests/auth.http')).replaceAll('http://localhost:3000', `http://localhost:${PORT}`);
    const dir = mkdtempSync(join(tmpdir(), 'p322-http7-'));
    try {
      writeFileSync(join(dir, 'auth.http'), text);
      const out = execFileSync(P('node_modules/.bin/httpyac'), ['send', 'auth.http', '--name', '규칙에 안 맞는 값으로 가입', '--json'],
        { encoding: 'utf-8', cwd: dir });
      const [res] = JSON.parse(out).requests;
      expect(res.response.statusCode).toBe(400);
      const quoted = lectureFence('bash', 'HTTP/1.1 400 Bad Request');
      expect(quoted, '교안에 400 블록이 없다').not.toBeNull();
      expect(quoted[1]).toBe('');
      expect(JSON.parse(res.response.body)).toEqual(JSON.parse(quoted.slice(2).join('\n')));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
    expect((await db.query(`SELECT count(*)::int AS n FROM users WHERE username = 'so ra'`)).rows[0].n).toBe(0);
  });
});
