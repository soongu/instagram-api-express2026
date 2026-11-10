// p3-40 「로그인과 비밀번호 확인」 게이트 — 백엔드
//
// `7-express-auth` 다섯째 회차다(`curriculum.md` 「`p3-40` 착수 결정」 — `p3-39` 에서 나눴다).
// Step 1~8 본문은 수업 백엔드, 실습·과제는 `lab/p3-40/`. 화면(가입 화면의 72바이트)은 `instagram-next/.verify` 가 본다.
// Step 마다의 판은 커밋 제목의 «(Step N)» 표식으로 꺼낸다(그 커밋을 임시 폴더에 풀어 띄운다).
//
// 축 ① Step 1 — code/p3-39: 틀린 비밀번호로도 200 · 검사를 지나면 password 가 사라진다
// 축 ② Step 2 — 맞는 비밀번호 200 · 틀리면 401 · 해시가 NULL 인 사람은 500(«data and hash arguments required») · 응답에 해시가 없다
// 축 ③ Step 3·4 — NULL 은 401(compare 전에 끝나 빠르다) · 관리자 스크립트로 정하면 200 · 없는 이름이면 USER_NOT_FOUND
// 축 ④ Step 4 — 시드: 다섯 명 모두 $2b$12$ · «이름1234» 와 맞는다 · 출력은 한 줄 그대로
//        교안의 두 명령(확인용 DB instagram_seed)을 이름만 바꿔 그대로 — DB 를 만든다 · 시드 한 줄 · DATABASE_URL 이 .env 를 이긴다 · SQL 결과 표
// 축 ⑤ Step 5 — 문장이 하나로(옛 주소·새 주소) · timing.js: 없는 이름·비밀번호가 없는 사람은 빠르고 틀린 비밀번호만 느리다
// 축 ⑥ Step 6 — timing.js: 셋이 비슷하다 · 가짜 해시와 비교한 경우는 실패
// 축 ⑦ Step 7 — 고치기 전: 긴 비밀번호로 가입 → 앞 24자만 같아도 200 · 고친 뒤: 가입 400(문장) · 이미 가입한 사람은 그대로 · 문서의 설명
// 축 ⑧ Step 8 — cost 를 13 으로 올리면 맞는 로그인 한 번에 해시가 $2b$13$ · 다시 12 로 내려도 13 그대로
// 축 ⑨ auth.http 전체를 tip 서버에 차례로 보낸 상태 코드
// 축 ⑩ 직접 해보기 1 — 비밀번호 바꾸기(틀린 판 셋)
// 축 ⑪ 직접 해보기 2 — 비밀번호 찾기(시작 판 · 정답 판 · 문장만 바꾼 판)
// 축 ⑫ 직접 해보기 3 — 글자 수와 바이트 수(.length 판은 셋째 줄이 다르다)
// 축 ⑬ 과제 [기초] · [응용]
// 축 ⑭ 이 회차 학생 파일 — code/p3-39 에서 바뀐 파일
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, mkdtempSync, rmSync, cpSync, symlinkSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import pg from 'pg';
import bcrypt from 'bcrypt';
import { boot } from './helpers/boot.js';
import { roundDir } from './helpers/round.js';
import { sendAll } from './helpers/send-http.js';

const ROOT = new URL('../', import.meta.url);
const P = (rel) => new URL(rel, ROOT).pathname;
const read = (path) => readFileSync(path, 'utf8');
const ADMIN = { host: 'localhost', port: 5432, database: 'postgres', user: 'postgres', password: 'postgres' };
const TPL_DB = 'p340_tpl';
const GATE_DB = 'p340_gate';
const SEED_DB = 'p340_seed';
// 교안의 두 명령을 그대로 돌리는 확인용 DB · 일부러 .env 에 적는 다른 이름(명령 앞 DATABASE_URL 이 지면 이 DB 가 생긴다)
const SEED_CMD_DB = 'p340_seedcmd';
const ENVFILE_DB = 'p340_envfile';
const GATE_URL = `postgresql://postgres:postgres@localhost:5432/${GATE_DB}`;
const PORT = 3910;
const LAB_PORT = 3912;

// 학생 파일은 이 회차 북마크 `code/p3-40` 을 풀어서 읽는다(없으면 작업트리 — 이 회차를 짓는 동안).
const ROUND = roundDir('code/p3-40');
const R = (rel) => join(ROUND.dir, rel);
const BEFORE = roundDir('code/p3-39');
const B = (rel) => join(BEFORE.dir, rel);
const LAB = (rel) => R(`lab/p3-40/${rel}`);

const env = { DATABASE_URL: GATE_URL, CORS_ORIGIN: 'http://localhost:3001' };
const STUDENT_FILES = ['app.js', 'db.js', 'errors.js', 'responses.js', 'routes', 'controllers', 'services', 'middlewares', 'schemas', 'docs', 'package.json', 'requests', 'seed.js', 'data', 'lab/p3-36', 'lab/p3-40'];

// Step N 의 판 — 그 회차 북마크(없으면 main)의 로그에서 «feat(p3-40): … (Step N)» 커밋을 찾아 임시 폴더에 푼다.
const hasRef = (ref) => {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', ref], { cwd: P('.'), stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
};
const LINE = hasRef('refs/heads/code/p3-40') ? 'code/p3-40' : 'main';
const commitOf = (n) => {
  const log = execFileSync('git', ['log', '--format=%H %s', `code/p3-39..${LINE}`], { cwd: P('.'), encoding: 'utf8' });
  const hits = log.split('\n').filter((l) => / feat\(p3-40\): /.test(l) && l.includes(`(Step ${n})`));
  if (hits.length === 0) throw new Error(`(Step ${n}) 커밋이 없다`);
  return hits[0].split(' ')[0];
};
const dirs = [];
const stepDir = (n) => {
  const dir = mkdtempSync(join(tmpdir(), `p340-step${n}-`));
  const tar = execFileSync('git', ['archive', '--format=tar', commitOf(n)], { cwd: P('.'), maxBuffer: 1 << 28 });
  execFileSync('tar', ['-x', '-C', dir], { input: tar });
  dirs.push(dir);
  return (rel) => join(dir, rel);
};

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
const gate = async (sql, params) => {
  const client = new pg.Client({ ...ADMIN, database: GATE_DB });
  await client.connect();
  try {
    return (await client.query(sql, params)).rows;
  } finally {
    await client.end();
  }
};

/** 판정 DB 를 템플릿에서 새로 만든다 — 학생 상태처럼 시드 다섯은 비밀번호가 없다(NULL). */
const freshGate = () => admin(async (client) => {
  await kick(client, GATE_DB);
  await client.query(`DROP DATABASE IF EXISTS ${GATE_DB}`);
  await kick(client, TPL_DB);
  await client.query(`CREATE DATABASE ${GATE_DB} TEMPLATE ${TPL_DB}`);
});

/** 학생 폴더 모양의 임시 폴더에 그 판의 파일을 깐다. */
const studentDir = (from) => {
  const dir = mkdtempSync(join(tmpdir(), 'p340-srv-'));
  for (const name of STUDENT_FILES) {
    if (existsSync(from(name))) cpSync(from(name), join(dir, name), { recursive: true });
  }
  symlinkSync(P('node_modules'), join(dir, 'node_modules'));
  return dir;
};
/** 그 판의 `app.js` 를 띄운다. `edit(dir)` 로 띄우기 전에 파일을 고칠 수 있다. */
const withServer = async (from, fn, { port = PORT, edit } = {}) => {
  const dir = studentDir(from);
  if (edit) edit(dir);
  const srv = await boot(join(dir, 'app.js'), { port, cwd: dir, env: { ...env, PORT: String(port) }, ready: `${port}번 포트에서` });
  try {
    await fn({ ...srv, dir, base: `http://localhost:${port}` });
  } finally {
    await Promise.race([srv.stop(), sleep(500)]);
    rmSync(dir, { recursive: true, force: true });
  }
};
/** `node <파일>` 을 그 폴더에서 돌리고 출력을 돌려준다. */
const run = (dir, file, extraEnv = {}) => {
  try {
    return { code: 0, out: execFileSync(process.execPath, [file], { cwd: dir, encoding: 'utf8', env: { ...process.env, ...extraEnv }, stdio: 'pipe' }) };
  } catch (error) {
    return { code: error.status, out: `${error.stdout}${error.stderr}` };
  }
};
const post = async (base, path, body) => {
  const started = performance.now();
  const res = await fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: text === '' ? text : JSON.parse(text), ms: performance.now() - started };
};
// httpYac 의 «쿠키를 기억하지 않기» 표시 줄은 이 도우미가 모른다 — 쿠키를 안 다루니 지우고 보낸다.
const httpOf = (file) => read(file).replace(/^# @no-cookie-jar\n/gm, '');
const signupSeoyeon = (base) => post(base, '/api/v2/auth/signup', { emailOrPhone: 'seoyeon@example.com', name: '박서연', username: 'seoyeon', password: 'instagram1234' });
const hashOf = async (username) => (await gate('SELECT password_hash FROM users WHERE username = $1', [username]))[0]?.password_hash;

/** timing.js 를 그 서버 주소로 바꿔 돌리고 세 줄의 ms 를 돌려준다. */
const timing = (from, port) => {
  const dir = mkdtempSync(join(tmpdir(), 'p340-timing-'));
  dirs.push(dir);
  writeFileSync(join(dir, 'timing.js'), read(from('lab/p3-40/timing.js')).replaceAll('localhost:3000', `localhost:${port}`));
  const { code, out } = run(dir, 'timing.js');
  expect(code).toBe(0);
  const rows = out.trim().split('\n');
  expect(rows).toHaveLength(3);
  return rows.map((row) => Number(row.match(/ (\d+) ms$/)[1]));
};

const LONG = '우리집첫째강아지이름은초코이고둘째강아지이름은보리예요';
const SAME24 = `${LONG.slice(0, 24)}람이에요`;

beforeAll(async () => {
  await admin(async (client) => {
    for (const name of [GATE_DB, TPL_DB, SEED_DB, SEED_CMD_DB, ENVFILE_DB]) {
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
  // 학생 DB 는 앞 회차 시드로 들어간 다섯이 비밀번호가 없다 — 그 판(code/p3-39)의 seed.js 로 넣는다.
  execFileSync(process.execPath, [B('seed.js')], {
    cwd: BEFORE.dir, encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: `postgresql://postgres:postgres@localhost:5432/${TPL_DB}` },
  });
}, 120000);

afterAll(async () => {
  await admin(async (client) => {
    for (const name of [GATE_DB, TPL_DB, SEED_DB, SEED_CMD_DB, ENVFILE_DB]) {
      await kick(client, name);
      await client.query(`DROP DATABASE IF EXISTS ${name}`);
    }
  });
  ROUND.cleanup();
  BEFORE.cleanup();
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

describe('축 ① Step 1 — 지금 로그인(code/p3-39)', () => {
  it('🔴 seoyeon 은 틀린 비밀번호로도 200 · 비밀번호 없이 보내도 200', async () => {
    await freshGate();
    await withServer(B, async ({ base }) => {
      expect((await signupSeoyeon(base)).status).toBe(201);
      const wrong = await post(base, '/api/v2/auth/login', { username: 'seoyeon', password: 'wrong-password' });
      expect(wrong.status).toBe(200);
      expect(wrong.body).toEqual({ data: { id: 6, username: 'seoyeon', profileImage: null } });
      expect((await post(base, '/api/v2/auth/login', { username: 'seoyeon' })).status).toBe(200);
    });
  });

  it('🔴 loginSchema 를 지나면 password 가 사라진다 · findUserByUsername 은 해시를 고르지 않는다', async () => {
    const { loginSchema } = await import(B('schemas/authSchema.js'));
    expect(loginSchema.parse({ username: 'seoyeon', password: 'wrong-password' })).toEqual({ username: 'seoyeon' });
    expect(read(B('services/userService.js'))).toContain('const userFields = { id: true, username: true, profileImage: true };');
    expect(read(B('services/userService.js'))).toContain('return prisma.user.findUnique({ where: { username }, select: userFields });');
    expect(read(B('middlewares/validate.js'))).toContain('    req.body = result.data;');
  });
});

describe('축 ② Step 2 — 해시와 비교', () => {
  it('🔴 맞으면 200 · 틀리면 401 · NULL 인 jaehoon 은 500(터미널에 data and hash arguments required) · 응답에 해시가 없다', async () => {
    const S2 = stepDir(2);
    await freshGate();
    await withServer(S2, async ({ base, tail }) => {
      await signupSeoyeon(base);
      const ok = await post(base, '/api/v2/auth/login', { username: 'seoyeon', password: 'instagram1234' });
      expect(ok.status).toBe(200);
      expect(ok.body).toEqual({ data: { id: 6, username: 'seoyeon', profileImage: null } });
      expect(ok.ms).toBeGreaterThan(100);
      const wrong = await post(base, '/api/v2/auth/login', { username: 'seoyeon', password: 'wrong-password' });
      expect(wrong.status).toBe(401);
      expect(wrong.body).toEqual({ error: { code: 'LOGIN_FAILED', message: '그런 사용자는 없어요' } });
      const nobody = await post(base, '/api/v2/auth/login', { username: 'hana', password: 'hana1234' });
      expect(nobody.status).toBe(401);
      const jaehoon = await post(base, '/api/v2/auth/login', { username: 'jaehoon', password: 'jaehoon1234' });
      expect(jaehoon.status).toBe(500);
      expect(jaehoon.body).toEqual({ error: { code: 'INTERNAL_ERROR', message: '서버에서 문제가 생겼어요' } });
      await sleep(200); // 로거 줄은 응답을 다 보낸 뒤에 찍힌다 — 스택보다 늦다
      expect(tail()).toContain('Error: data and hash arguments required');
      expect(tail()).toMatch(/POST \/api\/v2\/auth\/login 500 [\d.]+ms/);
      const missing = await post(base, '/api/v2/auth/login', { username: 'seoyeon' });
      expect(missing.status).toBe(400);
      expect(missing.body.error.details.properties.password.errors).toEqual(['Invalid input: expected string, received undefined']);
    });
    expect(read(S2('services/userService.js'))).not.toContain('findUserByUsername');
  });
});

describe('축 ③ Step 3·4 — 비밀번호가 없는 사람', () => {
  it('🔴 Step 3 판은 NULL 처리만 — setPassword · set-password.js · 새 시드는 Step 4 에 든다', () => {
    const S3 = stepDir(3);
    const src = read(S3('services/userService.js'));
    expect(src).toContain('  if (!user || user.passwordHash === null) return null;');
    expect(src).not.toContain('setPassword');
    expect(existsSync(S3('lab/p3-40/set-password.js'))).toBe(false);
    expect(read(S3('seed.js'))).not.toContain('userService');
  });

  it('🔴 NULL 이면 401(빠르다) · 관리자 스크립트로 정하면 200 · 없는 이름이면 USER_NOT_FOUND', async () => {
    const S4 = stepDir(4);
    await freshGate();
    await withServer(S4, async ({ base, dir }) => {
      await post(base, '/api/v2/auth/login', { username: 'hana', password: 'hana1234' }); // 서버가 막 떠서 느린 첫 DB 요청을 걸러 낸다
      const before = await post(base, '/api/v2/auth/login', { username: 'jaehoon', password: 'jaehoon1234' });
      expect(before.status).toBe(401);
      expect(before.body).toEqual({ error: { code: 'LOGIN_FAILED', message: '그런 사용자는 없어요' } });
      expect(before.ms).toBeLessThan(80);
      const { code, out } = run(dir, 'lab/p3-40/set-password.js', { DATABASE_URL: GATE_URL });
      expect(code).toBe(0);
      expect(out).toBe("비밀번호를 정했어요 {\n  id: 2,\n  username: 'jaehoon',\n  profileImage: 'https://picsum.photos/seed/jaehoon/40/40'\n}\n");
      expect((await hashOf('jaehoon')).startsWith('$2b$12$')).toBe(true);
      expect((await post(base, '/api/v2/auth/login', { username: 'jaehoon', password: 'jaehoon1234' })).status).toBe(200);
      // 이름을 없는 사람으로 바꾸면 Prisma 의 P2025 가 USER_NOT_FOUND 로 바뀌어 던져진다.
      writeFileSync(join(dir, 'lab/p3-40/set-hana.js'), read(join(dir, 'lab/p3-40/set-password.js')).replace("'jaehoon', 'jaehoon1234'", "'hana', 'hana1234'"));
      const hana = run(dir, 'lab/p3-40/set-hana.js', { DATABASE_URL: GATE_URL });
      expect(hana.code).toBe(1);
      expect(hana.out).toContain('NotFoundError: 그런 사용자는 없어요');
      expect(hana.out).toContain("code: 'USER_NOT_FOUND'");
    });
  });

  it('🔴 시드 — 다섯 명 모두 $2b$12$ 이고 «이름1234» 와 맞는다 · 출력은 한 줄 그대로', async () => {
    const S4 = stepDir(4);
    await admin(async (client) => client.query(`CREATE DATABASE ${SEED_DB}`));
    const url = `postgresql://postgres:postgres@localhost:5432/${SEED_DB}`;
    const db = new pg.Client({ ...ADMIN, database: SEED_DB });
    await db.connect();
    try {
      for (const dir of readdirSync(S4('prisma/migrations')).filter((name) => name !== 'migration_lock.toml').sort()) {
        await db.query(read(S4(`prisma/migrations/${dir}/migration.sql`)));
      }
      const dir = studentDir(S4);
      dirs.push(dir);
      const { code, out } = run(dir, 'seed.js', { DATABASE_URL: url });
      expect(code).toBe(0);
      expect(out).toBe('사람 5명, 게시물 5개, 사진 8장, 댓글 9개, 답글 3개를 넣었어요.\n');
      const { rows } = await db.query('SELECT id, username, password_hash FROM users ORDER BY id');
      expect(rows.map((row) => [row.id, row.username])).toEqual([[1, 'dahye'], [2, 'jaehoon'], [3, 'minji'], [4, 'nayeon'], [5, 'seungwoo']]);
      for (const row of rows) {
        expect(row.password_hash.startsWith('$2b$12$')).toBe(true);
        expect(await bcrypt.compare(`${row.username}1234`, row.password_hash)).toBe(true);
      }
      expect(new Set(rows.map((row) => row.password_hash)).size).toBe(5);
    } finally {
      await db.end();
    }
  }, 60000);

  it('🔴 시드 — 교안의 두 명령 그대로(DB 이름만 바꿔) · 확인용 DB 를 만든다 · 시드 한 줄 · 명령 앞 DATABASE_URL 이 .env 를 이긴다 · SQL 결과 표', async () => {
    const S4 = stepDir(4);
    const lecture = read(join(new URL('../../', ROOT).pathname, 'part3/7-express-auth/p3-40-login-password-check-lecture.md'));
    const fence = lecture.split('```bash\n').slice(1).map((b) => b.split('\n```')[0]).find((b) => b.includes('instagram_seed'));
    expect(fence.split('\n')).toEqual([
      'DATABASE_URL="postgresql://postgres:postgres@localhost:5432/instagram_seed" npx prisma migrate deploy',
      'DATABASE_URL="postgresql://postgres:postgres@localhost:5432/instagram_seed" npm run seed',
    ]);
    const dir = studentDir(S4);
    dirs.push(dir);
    cpSync(S4('prisma'), join(dir, 'prisma'), { recursive: true });
    cpSync(S4('prisma.config.js'), join(dir, 'prisma.config.js'));
    // 학생의 .env 는 수업 DB 를 가리킨다 — 판정은 다른 이름을 둬서, 명령 앞의 값이 지면 그 DB 가 생겨 드러나게 한다.
    writeFileSync(join(dir, '.env'), `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/${ENVFILE_DB}"\n`);
    const cmdEnv = { HOME: process.env.HOME, PATH: `${dirname(process.execPath)}:/usr/bin:/bin`, npm_config_update_notifier: 'false' };
    const outs = fence.replaceAll('instagram_seed', SEED_CMD_DB).split('\n')
      .map((cmd) => execFileSync('/bin/bash', ['-c', `${cmd} 2>&1`], { cwd: dir, encoding: 'utf8', env: cmdEnv }));
    expect(outs[0]).toContain(`PostgreSQL database ${SEED_CMD_DB} created at localhost:5432`);
    expect(outs[0]).toContain('All migrations have been successfully applied.');
    expect(outs[1].trimEnd().split('\n').at(-1)).toBe('사람 5명, 게시물 5개, 사진 8장, 댓글 9개, 답글 3개를 넣었어요.');
    const made = await admin(async (client) => (await client.query(
      'SELECT datname FROM pg_database WHERE datname = ANY($1) ORDER BY datname', [[SEED_CMD_DB, ENVFILE_DB]])).rows.map((row) => row.datname));
    expect(made).toEqual([SEED_CMD_DB]);
    // 교안의 쿼리를 그대로 보내 결과 표(머리글 두 줄 아래)와 맞댄다
    const query = 'SELECT username, left(password_hash, 7) AS password_hash FROM users ORDER BY id;';
    expect(lecture).toContain(`\`\`\`sql\n${query}\n\`\`\``);
    const table = lecture.split(`${query}\n\`\`\`\n\n\`\`\`\n`)[1].split('\n```')[0].split('\n');
    expect(table.slice(0, 2)).toEqual([' username   password_hash', ' ========   =============']);
    const db = new pg.Client({ ...ADMIN, database: SEED_CMD_DB });
    await db.connect();
    try {
      const { rows } = await db.query(query);
      expect(table.slice(2).map((line) => line.trim().split(/\s+/))).toEqual(rows.map((row) => [row.username, row.password_hash]));
      expect(table[2]).toBe(' dahye      $2b$12$');
    } finally {
      await db.end();
    }
  }, 120000);
});

describe('축 ⑤ Step 5 — 문장은 하나 · 시간은 다르다', () => {
  it('🔴 옛 주소·새 주소 모두 «사용자 이름이나 비밀번호가 맞지 않아요» · USER_NOT_FOUND 문장은 그대로', async () => {
    const S5 = stepDir(5);
    expect(read(S5('errors.js'))).toContain("  LOGIN_FAILED: '사용자 이름이나 비밀번호가 맞지 않아요',\n");
    expect(read(S5('errors.js'))).toContain("  USER_NOT_FOUND: '그런 사용자는 없어요',\n");
    await freshGate();
    await withServer(S5, async ({ base }) => {
      const v2 = await post(base, '/api/v2/auth/login', { username: 'hana', password: 'hana1234' });
      expect(v2.body).toEqual({ error: { code: 'LOGIN_FAILED', message: '사용자 이름이나 비밀번호가 맞지 않아요' } });
      const old = await post(base, '/api/auth/login', { username: 'hana', password: 'hana1234' });
      expect(old.status).toBe(401);
      expect(old.body).toEqual({ message: '사용자 이름이나 비밀번호가 맞지 않아요' });
    });
  });

  it('🔴 timing.js — 없는 이름·비밀번호가 없는 사람은 0.1초 안쪽 · 틀린 비밀번호만 0.15초를 넘는다', async () => {
    const S5 = stepDir(5);
    await freshGate();
    await withServer(S5, async ({ base }) => {
      await signupSeoyeon(base);
      const [nobody, nullUser, wrong] = timing(S5, PORT);
      expect(nobody).toBeLessThan(100);
      expect(nullUser).toBeLessThan(100);
      expect(wrong).toBeGreaterThan(150);
    });
  }, 30000);
});

describe('축 ⑥ Step 6 — 가짜 해시', () => {
  it('🔴 timing.js — 셋 다 0.15초를 넘고 서로 0.06초 안쪽', async () => {
    const S6 = stepDir(6);
    await freshGate();
    await withServer(S6, async ({ base }) => {
      await signupSeoyeon(base);
      timing(S6, PORT); // 서버가 막 떠서 느린 첫 요청을 걸러 낸다
      const ms = timing(S6, PORT);
      for (const value of ms) expect(value).toBeGreaterThan(150);
      expect(Math.max(...ms) - Math.min(...ms)).toBeLessThan(60);
    });
  }, 60000);

  it('🔴 가짜 해시와 비교한 경우는 무엇이 맞든 실패 — 조건에 user.passwordHash === null', () => {
    const src = read(stepDir(6)('services/userService.js'));
    expect(src).toContain('const DUMMY_HASH = await bcrypt.hash(randomUUID(), PASSWORD_COST);');
    expect(src).toContain('  const matched = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);');
    expect(src).toContain('  if (!user || user.passwordHash === null || !matched) return null;');
  });
});

describe('축 ⑦ Step 7 — 72바이트', () => {
  it('🔴 고치기 전(Step 6 판) — 긴 비밀번호로 가입 201 · 앞 24자만 같은 비밀번호로 200 · 앞 24자만 쳐도 200', async () => {
    expect(new TextEncoder().encode(LONG).length).toBe(81);
    expect(LONG.length).toBe(27);
    await freshGate();
    await withServer(stepDir(6), async ({ base }) => {
      expect((await post(base, '/api/v2/auth/signup', { emailOrPhone: 'jiwon@example.com', name: '김지원', username: 'jiwon', password: LONG })).status).toBe(201);
      expect((await post(base, '/api/v2/auth/login', { username: 'jiwon', password: SAME24 })).status).toBe(200);
      expect((await post(base, '/api/v2/auth/login', { username: 'jiwon', password: LONG.slice(0, 24) })).status).toBe(200);
      expect((await post(base, '/api/v2/auth/login', { username: 'jiwon', password: LONG.slice(0, 23) })).status).toBe(401);
    });
  });

  it('🔴 고친 뒤 — 같은 가입은 400(비밀번호 문장) · 이미 가입한 jiwon 은 여전히 200 · 짧게 저장한 사람은 긴 입력과 안 맞는다', async () => {
    await freshGate();
    await withServer(stepDir(6), async ({ base }) => {
      await post(base, '/api/v2/auth/signup', { emailOrPhone: 'jiwon@example.com', name: '김지원', username: 'jiwon', password: LONG });
    });
    await withServer(stepDir(7), async ({ base }) => {
      const again = await post(base, '/api/v2/auth/signup', { emailOrPhone: 'jiwon2@example.com', name: '김지원', username: 'jiwon2', password: LONG });
      expect(again.status).toBe(400);
      expect(again.body.error.details.properties.password.errors).toEqual(['비밀번호가 너무 길어요. 영문은 72자, 한글은 24자까지 쓸 수 있어요']);
      expect((await post(base, '/api/v2/auth/login', { username: 'jiwon', password: SAME24 })).status).toBe(200);
      await signupSeoyeon(base);
      expect((await post(base, '/api/v2/auth/login', { username: 'seoyeon', password: `instagram1234${'x'.repeat(80)}` })).status).toBe(401);
      const docs = await (await fetch(`${base}/api/openapi.json`)).json();
      const schema = docs.paths['/api/v2/auth/signup'].post.requestBody.content['application/json'].schema;
      expect(schema.properties.password).toEqual({ type: 'string', minLength: 8, description: '8자 이상, 72바이트까지(영문 72자, 한글 24자)' });
    });
    const { loginSchema } = await import(stepDir(7)('schemas/authSchema.js'));
    expect(loginSchema.safeParse({ username: 'jiwon', password: LONG }).success).toBe(true);
  });
});

describe('축 ⑧ Step 8 — cost 올리기', () => {
  it('🔴 13 으로 올리면 맞는 로그인 한 번에 $2b$13$ · 다시 12 로 내려도 13 그대로 · 틀린 로그인은 안 바꾼다', async () => {
    await freshGate();
    const to13 = (dir) => {
      const file = join(dir, 'services/userService.js');
      writeFileSync(file, read(file).replace('const PASSWORD_COST = 12;', 'const PASSWORD_COST = 13;'));
    };
    await withServer(R, async ({ base }) => { await signupSeoyeon(base); });
    expect((await hashOf('seoyeon')).startsWith('$2b$12$')).toBe(true);
    await withServer(R, async ({ base }) => {
      expect((await post(base, '/api/v2/auth/login', { username: 'seoyeon', password: 'wrong-password' })).status).toBe(401);
      expect((await hashOf('seoyeon')).startsWith('$2b$12$')).toBe(true);
      const first = await post(base, '/api/v2/auth/login', { username: 'seoyeon', password: 'instagram1234' });
      expect(first.status).toBe(200);
      expect((await hashOf('seoyeon')).startsWith('$2b$13$')).toBe(true);
      const second = await post(base, '/api/v2/auth/login', { username: 'seoyeon', password: 'instagram1234' });
      expect(second.ms).toBeLessThan(first.ms);
    }, { edit: to13 });
    await withServer(R, async ({ base }) => {
      expect((await post(base, '/api/v2/auth/login', { username: 'seoyeon', password: 'instagram1234' })).status).toBe(200);
      expect((await hashOf('seoyeon')).startsWith('$2b$13$')).toBe(true);
    });
  }, 30000);
});

describe('축 ⑨ auth.http — tip 서버에 차례로', () => {
  it('🔴 요청마다 상태 코드(쿠키 없이 보낸다 — «나는 누구» 는 401)', async () => {
    await freshGate();
    await withServer(R, async ({ base, dir }) => {
      run(dir, 'lab/p3-40/set-password.js', { DATABASE_URL: GATE_URL });
      const results = await sendAll(httpOf(R('requests/auth.http')), base);
      expect(results.map((r) => [r.title, r.status])).toEqual([
        ['로그인', 200],
        ['나는 누구', 401],
        ['없는 이름으로 로그인', 401],
        ['비밀번호를 저장한 사람으로 로그인', 401],
        ['틀린 비밀번호로 로그인', 401],
        ['쿠키를 고쳐서 보내면', 401],
        ['헤더로 보내면', 401],
        ['로그아웃', 200],
        ['회원가입', 201],
        ['이미 있는 사용자 이름으로 가입', 409],
        ['사용자 이름 중복 확인', 200],
        ['휴대폰 번호 중복 확인', 200],
        ['규칙에 안 맞는 값으로 가입', 400],
        ['해시로 저장되는지 볼 가입', 201],
        ['같은 비밀번호로 한 사람 더 가입', 201],
        ['긴 비밀번호로 가입', 400],
        ['앞 24자만 같은 비밀번호로 로그인', 401],
      ]);
      // seoyeon 이 가입한 뒤에 한 번 더 보내면 — 맞는 비밀번호는 200, 틀린 비밀번호는 401
      const again = Object.fromEntries((await sendAll(httpOf(R('requests/auth.http')), base)).map((r) => [r.title, r]));
      expect(again['비밀번호를 저장한 사람으로 로그인'].status).toBe(200);
      expect(again['비밀번호를 저장한 사람으로 로그인'].body).toEqual({ id: 8, username: 'seoyeon', profileImage: null });
      expect(again['틀린 비밀번호로 로그인'].body).toEqual({ message: '사용자 이름이나 비밀번호가 맞지 않아요' });
      expect(again['로그인'].body).toEqual({ id: 2, username: 'jaehoon', profileImage: 'https://picsum.photos/seed/jaehoon/40/40' });
    });
  }, 30000);
});

describe('축 ⑩ 직접 해보기 1 — 비밀번호 바꾸기', () => {
  const variant = (edit) => {
    const dir = mkdtempSync(join(tmpdir(), 'p340-pr1-'));
    dirs.push(dir);
    symlinkSync(P('node_modules'), join(dir, 'node_modules'));
    writeFileSync(join(dir, 'practice1.js'), edit(read(LAB('practice1.js'))).replaceAll('4001', String(LAB_PORT)));
    return join(dir, 'practice1.js');
  };
  const statuses = async (file) => {
    const srv = await boot(file, { port: LAB_PORT, ready: '동아리 서버' });
    try {
      return (await sendAll(read(LAB('practice1.http')).replaceAll('localhost:4001', `localhost:${LAB_PORT}`), `http://localhost:${LAB_PORT}`)).map((r) => r.status);
    } finally {
      await srv.stop();
    }
  };

  it('🔴 시작 판은 빈칸 둘 · 정답 판 401 · 200 · 401 · 200', async () => {
    const start = read(P('snapshots/p3-40.practice1-start.practice1.js'));
    expect(start.match(/____/g)).toHaveLength(2);
    expect(start.replace('if (!member || !(await ____)) {', 'if (!member || !(await bcrypt.compare(currentPassword, member.passwordHash))) {').replace('member.passwordHash = ____;', 'member.passwordHash = await bcrypt.hash(newPassword, COST);')).toBe(read(LAB('practice1.js')));
    expect(await statuses(variant((s) => s))).toEqual([401, 200, 401, 200]);
  });

  it('🔴 틀린 판 셋 — 지금 비밀번호를 안 보면 첫 줄 200 · 받은 글자 그대로 넣으면 넷째 401 · await 를 빠뜨리면 넷째 500', async () => {
    expect(await statuses(variant((s) => s.replace('if (!member || !(await bcrypt.compare(currentPassword, member.passwordHash))) {', 'if (!member) {')))).toEqual([200, 200, 401, 200]);
    expect(await statuses(variant((s) => s.replace('member.passwordHash = await bcrypt.hash(newPassword, COST);', 'member.passwordHash = newPassword;')))).toEqual([401, 200, 401, 401]);
    expect(await statuses(variant((s) => s.replace('member.passwordHash = await bcrypt.hash(newPassword, COST);', 'member.passwordHash = bcrypt.hash(newPassword, COST);')))).toEqual([401, 200, 500, 500]);
  });
});

describe('축 ⑪ 직접 해보기 2 — 비밀번호 찾기', () => {
  const check = async (src) => {
    const dir = mkdtempSync(join(tmpdir(), 'p340-pr2-'));
    dirs.push(dir);
    symlinkSync(P('node_modules'), join(dir, 'node_modules'));
    writeFileSync(join(dir, 'practice2.js'), src.replaceAll('4002', String(LAB_PORT)));
    writeFileSync(join(dir, 'practice2-check.js'), read(LAB('practice2-check.js')).replaceAll('4002', String(LAB_PORT)));
    const srv = await boot(join(dir, 'practice2.js'), { port: LAB_PORT, ready: '비밀번호 찾기 서버' });
    try {
      const { code, out } = run(dir, 'practice2-check.js');
      expect(code).toBe(0);
      await sleep(400);
      return { rows: out.trim().split('\n').map((row) => row.match(/ (\d{3}) (.+) · 평균 (\d+)ms$/).slice(1)), log: srv.tail() };
    } finally {
      await srv.stop();
    }
  };

  it('🔴 시작 판 — 200 과 404 · 문장이 다르고 300ms 차이', async () => {
    const { rows } = await check(read(P('snapshots/p3-40.practice2-start.practice2.js')));
    expect(rows.map(([status, message]) => [status, message])).toEqual([['200', '비밀번호를 다시 정하는 메일을 보냈어요'], ['404', '그 이메일로 가입한 사람은 없어요']]);
    expect(Number(rows[0][2])).toBeGreaterThan(250);
    expect(Number(rows[1][2])).toBeLessThan(50);
  });

  it('🔴 정답 판 — 같은 200 문장 · 둘 다 50ms 안쪽 · 메일은 가입한 이메일에만 다섯 번', async () => {
    const { rows, log } = await check(read(LAB('practice2.js')));
    const same = '그 이메일로 가입한 계정이 있다면 비밀번호를 다시 정하는 메일을 보냈어요';
    expect(rows.map(([status, message]) => [status, message])).toEqual([['200', same], ['200', same]]);
    for (const [, , ms] of rows) expect(Number(ms)).toBeLessThan(50);
    expect(log.match(/bomi@example\.com 주소로 비밀번호를 다시 정하는 메일을 보냈어요/g)).toHaveLength(5);
    expect(log).not.toContain('nobody@example.com');
  });

  it('🔴 문장만 바꾸고 메일을 기다리는 판 — 확인 스크립트가 시간 차이로 가린다', async () => {
    const src = read(P('snapshots/p3-40.practice2-start.practice2.js'))
      .replace("return res.status(404).json({ message: '그 이메일로 가입한 사람은 없어요' });", "return res.json({ message: '그 이메일로 가입한 계정이 있다면 비밀번호를 다시 정하는 메일을 보냈어요' });")
      .replace("res.json({ message: '비밀번호를 다시 정하는 메일을 보냈어요' });", "res.json({ message: '그 이메일로 가입한 계정이 있다면 비밀번호를 다시 정하는 메일을 보냈어요' });");
    const { rows } = await check(src);
    expect(rows[0][1]).toBe(rows[1][1]);
    expect(Number(rows[0][2]) - Number(rows[1][2])).toBeGreaterThan(200);
  });
});

describe('축 ⑫ 직접 해보기 3 — 글자 수와 바이트 수', () => {
  const EXPECTED = 'length 72 · 72바이트 · 통과\nlength 73 · 73바이트 · 거절\nlength 24 · 72바이트 · 통과\nlength 25 · 75바이트 · 거절\nlength 36 · 72바이트 · 통과\nlength 38 · 76바이트 · 거절\nlength 32 · 74바이트 · 거절\n';
  it('🔴 정답 판 일곱 줄 · 시작 판은 빈칸 둘', () => {
    expect(read(P('snapshots/p3-40.practice3-start.practice3.js')).match(/____/g)).toHaveLength(2);
    expect(run(LAB('.'), 'practice3.js')).toEqual({ code: 0, out: EXPECTED });
  });
  it('🔴 바이트 대신 .length 를 쓴 판은 셋째 줄이 «24바이트»', () => {
    const file = LAB('.p340-length.js');
    writeFileSync(file, read(LAB('practice3.js')).replace('new TextEncoder().encode(password).length', 'password.length'));
    try {
      const { out } = run(LAB('.'), '.p340-length.js');
      expect(out.split('\n')[2]).toBe('length 24 · 24바이트 · 통과');
    } finally {
      rmSync(file, { force: true });
    }
  });
});

describe('축 ⑬ 과제', () => {
  const copyTo = (name, edit = (s) => s, port) => {
    const dir = mkdtempSync(join(tmpdir(), `p340-${name}-`));
    dirs.push(dir);
    symlinkSync(P('node_modules'), join(dir, 'node_modules'));
    writeFileSync(join(dir, `${name}.js`), edit(read(LAB(`${name}.js`))).replaceAll(String(port), String(LAB_PORT)));
    return dir;
  };

  it('🔴 [기초] .http 201 · 200 · 401 · 401 · 400 · 두 실패 문장이 같고 시간이 비슷하다 · 가짜 해시를 뺀 판은 없는 이메일이 빠르다', async () => {
    const http = read(LAB('homework1.http')).replaceAll('localhost:4011', `localhost:${LAB_PORT}`);
    const timingFor = (dir) => {
      writeFileSync(join(dir, 't.js'), read(LAB('homework1-timing.js')).replaceAll('4011', String(LAB_PORT)));
      const { out } = run(dir, 't.js');
      return out.trim().split('\n').map((row) => Number(row.match(/ (\d+) ms$/)[1]));
    };
    const good = copyTo('homework1', (s) => s, 4011);
    let srv = await boot(join(good, 'homework1.js'), { port: LAB_PORT, ready: '동아리 가입 서버' });
    try {
      const results = await sendAll(http, `http://localhost:${LAB_PORT}`);
      expect(results.map((r) => r.status)).toEqual([201, 200, 401, 401, 400]);
      expect(results[2].body).toEqual(results[3].body);
      expect(results[2].body).toEqual({ message: '이메일이나 비밀번호가 맞지 않아요' });
      const [nobody, wrong] = timingFor(good);
      expect(nobody).toBeGreaterThan(150);
      expect(Math.abs(nobody - wrong)).toBeLessThan(60);
    } finally {
      await srv.stop();
    }
    const noDummy = copyTo('homework1', (s) => s.replace('const matched = await bcrypt.compare(password, member?.passwordHash ?? DUMMY_HASH);', "const matched = member ? await bcrypt.compare(password, member.passwordHash) : false;"), 4011);
    srv = await boot(join(noDummy, 'homework1.js'), { port: LAB_PORT, ready: '동아리 가입 서버' });
    try {
      await sendAll(http, `http://localhost:${LAB_PORT}`);
      const [nobody, wrong] = timingFor(noDummy);
      expect(nobody).toBeLessThan(50);
      expect(wrong).toBeGreaterThan(150);
    } finally {
      await srv.stop();
    }
  }, 60000);

  it('🔴 [응용] 다섯 번 틀리면 맞는 비밀번호도 429(Retry-After 60) · 다른 이메일은 그대로 · 성공하면 기록을 지운다 · 1분이 지나면 다시', async () => {
    const base = `http://localhost:${LAB_PORT}`;
    const login = (email, password) => post(base, '/login', { email, password });
    const dir = copyTo('homework2', (s) => s, 4012);
    let srv = await boot(join(dir, 'homework2.js'), { port: LAB_PORT, ready: '동아리 가입 서버' });
    try {
      await post(base, '/members', { email: 'bomi@example.com', password: 'club2026!' });
      for (let i = 0; i < 4; i += 1) expect((await login('bomi@example.com', 'club2025!')).status).toBe(401);
      expect((await login('bomi@example.com', 'club2026!')).status).toBe(200); // 성공하면 지운다
      for (let i = 0; i < 5; i += 1) expect((await login('bomi@example.com', 'club2025!')).status).toBe(401);
      const locked = await login('bomi@example.com', 'club2026!');
      expect(locked.status).toBe(429);
      expect(locked.headers.get('retry-after')).toBe('60');
      expect(locked.body).toEqual({ message: '로그인 시도가 너무 많아요. 잠시 뒤에 다시 시도해 주세요' });
      expect((await login('gaeun@example.com', 'club2026!')).status).toBe(401);
    } finally {
      await srv.stop();
    }
    const short = copyTo('homework2', (s) => s.replace('const WINDOW_MS = 60 * 1000;', 'const WINDOW_MS = 1000;'), 4012);
    srv = await boot(join(short, 'homework2.js'), { port: LAB_PORT, ready: '동아리 가입 서버' });
    try {
      await post(base, '/members', { email: 'bomi@example.com', password: 'club2026!' });
      for (let i = 0; i < 5; i += 1) await login('bomi@example.com', 'club2025!');
      expect((await login('bomi@example.com', 'club2026!')).status).toBe(429);
      await sleep(1100);
      expect((await login('bomi@example.com', 'club2026!')).status).toBe(200);
    } finally {
      await srv.stop();
    }
  }, 60000);
});

describe('축 ⑭ 이 회차 학생 파일', () => {
  it('🔴 code/p3-39 에서 바뀐 학생 파일', () => {
    const changed = execFileSync('git', ['diff', '--name-only', 'code/p3-39', LINE, '--', '.', ':(exclude)test', ':(exclude)snapshots'], { cwd: P('.'), encoding: 'utf8' }).trim().split('\n').sort();
    expect(changed).toEqual([
      'controllers/authController.js',
      'errors.js',
      'lab/p3-40/homework1-timing.js',
      'lab/p3-40/homework1.http',
      'lab/p3-40/homework1.js',
      'lab/p3-40/homework2.http',
      'lab/p3-40/homework2.js',
      'lab/p3-40/practice1.http',
      'lab/p3-40/practice1.js',
      'lab/p3-40/practice2-check.js',
      'lab/p3-40/practice2.js',
      'lab/p3-40/practice3.js',
      'lab/p3-40/set-password.js',
      'lab/p3-40/timing.js',
      'requests/auth.http',
      'schemas/authSchema.js',
      'seed.js',
      'services/authService.js',
      'services/userService.js',
    ]);
  });
});

describe('축 ⑮ 교안·답안의 코드 블록은 줄마다 그 파일에 실재한다', () => {
  const TRACK_DIR = new URL('../../', ROOT).pathname;
  const DOCS = ['part3/7-express-auth/p3-40-login-password-check-lecture.md', 'part3/7-express-auth/p3-40-login-password-check-answers.md'].map((f) => join(TRACK_DIR, f));
  const fences = (file, lang) => {
    const out = [];
    let open = null;
    for (const line of read(file).split('\n')) {
      if (line.startsWith('```')) {
        if (open) { out.push(open); open = null; } else if (line === `\`\`\`${lang}`) open = [];
      } else if (open) open.push(line);
    }
    return out;
  };
  const showAt = (ref, rel) => {
    try {
      return execFileSync('git', ['show', `${ref}:${rel}`], { cwd: P('.'), encoding: 'utf8', stdio: 'pipe' });
    } catch {
      return null;
    }
  };
  const SNAP = { 'lab/p3-40/practice1.js': 'p3-40.practice1-start.practice1.js', 'lab/p3-40/practice2.js': 'p3-40.practice2-start.practice2.js', 'lab/p3-40/practice3.js': 'p3-40.practice3-start.practice3.js' };
  // 그 블록이 실재할 수 있는 판 — 최종 파일 · Step 2~8 커밋의 판 · 직접 해보기 시작 판
  const versions = (rel) => [
    existsSync(R(rel)) ? read(R(rel)) : null,
    ...[2, 3, 4, 5, 6, 7, 8].map((n) => showAt(commitOf(n), rel)),
    SNAP[rel] ? read(P(`snapshots/${SNAP[rel]}`)) : null,
  ].filter(Boolean);

  it('🔴 javascript 블록마다 한 판에 줄이 모두 있다(수업 화면 블록은 instagram-next/.verify 가 본다)', () => {
    const all = DOCS.flatMap((d) => fences(d, 'javascript')).filter((b) => (b[0] ?? '').startsWith('// ~/instagram-api/'));
    expect(all.length).toBe(23);
    for (const b of all) {
      const rel = b[0].replace('// ~/instagram-api/', '');
      const lines = b.filter((l) => l.trim() !== '' && l.trim() !== '...');
      expect(versions(rel).some((text) => lines.every((l) => text.split('\n').includes(l))), `${rel}\n${lines.join('\n')}`).toBe(true);
    }
  }, 30000);

  it('🔴 http 블록 — auth.http 의 Step 2·7 요청 · practice1·homework1·homework2.http 통째', () => {
    const [lecture] = DOCS.map(read);
    const blocks = fences(DOCS[0], 'http');
    expect(blocks).toHaveLength(5);
    const http = read(R('requests/auth.http')).split('\n');
    for (const b of blocks.filter((x) => ['### 로그인', '### 긴 비밀번호로 가입'].includes(x[0]))) for (const l of b.filter((x) => x.trim() !== '...')) expect(http, l).toContain(l);
    for (const f of ['practice1.http', 'homework1.http', 'homework2.http']) expect(lecture).toContain(`\`\`\`http\n${read(LAB(f))}\`\`\``);
  });

  it('🔴 실행 출력 — practice3 일곱 줄은 글자 그대로 · timing·확인 스크립트 출력은 그 파일의 라벨 그대로', () => {
    const [lecture, answers] = DOCS.map(read);
    expect(lecture).toContain(`\`\`\`\n${run(LAB('.'), 'practice3.js').out}\`\`\``);
    const labels = (file) => [...read(LAB(file)).matchAll(/console\.log\('([^']*)',/g)].map((m) => m[1]);
    for (const l of labels('timing.js')) expect(lecture).toMatch(new RegExp(`\n${l} \\d+ ms\n`));
    for (const l of labels('practice2-check.js')) expect(lecture).toContain(`\n${l} 200 `);
    for (const l of labels('homework1-timing.js')) expect(answers).toMatch(new RegExp(`\n${l} \\d+ ms\n`));
    expect(lecture).toContain('비밀번호를 정했어요 {\n  id: 2,\n  username: \'jaehoon\',\n  profileImage: \'https://picsum.photos/seed/jaehoon/40/40\'\n}');
  });
});
