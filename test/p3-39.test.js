// p3-39 「회원가입과 해싱 — 비밀번호를 해시로 저장하기」 게이트 — 백엔드
//
// `7-express-auth` 넷째 회차다(`curriculum.md` 「`p3-39` 착수 결정」 — 확인 쪽은 새 `p3-40`).
// Step 1~5 본문은 실습 `lab/p3-39/`, Step 6 은 수업 백엔드(`password_hash` 마이그레이션 · `authService.signup` 이 bcrypt).
//
// 축 ① Step 1 — hash.js: 같은 글자 → 같은 해시 · 한 글자 → 다른 해시 · 늘 64글자
// 축 ② Step 2 — users-sha256.js 의 해시는 적어 둔 비밀번호의 SHA-256(같은 비밀번호 둘은 같은 해시) · 예시 10만 개 · cost-sha256
// 축 ③ Step 3 — 솔트: 같은 비밀번호도 해시가 다르다 · cost-salted 는 사람 수만큼 50만 번
// 축 ④ 직접 해보기 1 — checkPassword · 시작 판(빈칸)도 문법은 통과 · 틀린 판 둘이 걸린다
// 축 ⑤ Step 4 — cost 와 시간(두 배씩) · 해시 글자에 cost 가 든다 · cost-bcrypt 가 10만 번을 짐작
// 축 ⑥ Step 5 — hashSync 동안 /ping 이 기다리고 hash 는 안 기다린다 · 다섯을 한꺼번에 보내면 다섯째가 한 번 더
// 축 ⑦ 직접 해보기 2 — 0.25초를 넘지 않는 가장 큰 cost
// 축 ⑧ Step 6 — 가입이 해시를 저장한다(NULL 인 사람 · 받은 글자는 DB 어디에도 없다 · 응답에는 안 나간다)
// 축 ⑨ 같은 요청 54개 — code/p3-38 과 같다(옛 주소 · 새 주소)
// 축 ⑩ 직접 해보기 3 — 관리자 스크립트(비밀번호를 주면 해시 · 빼면 NULL — 해시는 userService.createUser 가 한다)
// 축 ⑪ 과제 [기초] · [응용]
// 축 ⑫ 이 회차 학생 파일 — code/p3-38 에서 바뀐 파일
// 축 ⑬ 교안·답안의 코드 블록은 줄마다 그 파일에 실재한다 · 매번 같은 출력(hash.js)은 글자 그대로
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, mkdtempSync, rmSync, cpSync, symlinkSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import pg from 'pg';
import bcrypt from 'bcrypt';
import { boot } from './helpers/boot.js';
import { roundDir } from './helpers/round.js';

const ROOT = new URL('../', import.meta.url);
const P = (rel) => new URL(rel, ROOT).pathname;
const read = (path) => readFileSync(path, 'utf8');
const ADMIN = { host: 'localhost', port: 5432, database: 'postgres', user: 'postgres', password: 'postgres' };
const TPL_DB = 'p339_tpl';
const GATE_DB = 'p339_gate';
const GATE_URL = `postgresql://postgres:postgres@localhost:5432/${GATE_DB}`;
const PORT = 3900;
const LAB_PORT = 3902;
const HW_PORT = 3903;

// 학생 파일은 이 회차 북마크 `code/p3-39` 를 풀어서 읽는다(없으면 작업트리 — 이 회차를 짓는 동안).
const ROUND = roundDir('code/p3-39');
const R = (rel) => join(ROUND.dir, rel);
const BEFORE = roundDir('code/p3-38');
const B = (rel) => join(BEFORE.dir, rel);
const LAB = (rel) => R(`lab/p3-39/${rel}`);

const env = { DATABASE_URL: GATE_URL, CORS_ORIGIN: 'http://localhost:3001' };
const STUDENT_FILES = ['app.js', 'db.js', 'errors.js', 'responses.js', 'routes', 'controllers', 'services', 'middlewares', 'schemas', 'docs', 'package.json', 'requests', 'lab/p3-39'];
const sha256 = (text) => createHash('sha256').update(text).digest('hex');

// 예시 테이블에 적어 둔 사람들의 비밀번호 — 교안이 말하는 것과 같아야 한다(파일에는 해시만 있다).
const PASSWORDS = { jaehoon: 'jaehoon1234', minji: 'minji2000', dahye: 'qwer1234', seungwoo: 'qwer1234', nayeon: 'n@Y30n-summer!27' };

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

/** 판정 DB 를 템플릿에서 새로 만든다 — 두 판이 시각까지 같은 데이터에서 출발한다. */
const freshGate = () => admin(async (client) => {
  await kick(client, GATE_DB);
  await client.query(`DROP DATABASE IF EXISTS ${GATE_DB}`);
  await kick(client, TPL_DB);
  await client.query(`CREATE DATABASE ${GATE_DB} TEMPLATE ${TPL_DB}`);
});

/** 학생 폴더 모양의 임시 폴더에 그 판의 파일을 깐다. */
const studentDir = (from) => {
  const dir = mkdtempSync(join(tmpdir(), 'p339-srv-'));
  for (const name of STUDENT_FILES) {
    if (existsSync(from(name))) cpSync(from(name), join(dir, name), { recursive: true });
  }
  symlinkSync(P('node_modules'), join(dir, 'node_modules'));
  return dir;
};
/** 그 판의 `app.js` 를 띄운다. */
const withServer = async (from, fn, { port = PORT } = {}) => {
  const dir = studentDir(from);
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
const lines = (out) => out.trim().split('\n');

const getRes = async (url, init) => {
  const res = await fetch(url, init);
  const type = res.headers.get('content-type') ?? '';
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: type.includes('json') && text !== '' ? JSON.parse(text) : text, ms: 0 };
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

describe('축 ① Step 1 — hash.js', () => {
  it('🔴 같은 글자는 같은 해시 · 한 글자만 달라도 다른 해시 · 넷 다 64글자', () => {
    const { code, out } = run(LAB('.'), 'hash.js');
    expect(code).toBe(0);
    const [a, b, c, d] = lines(out);
    expect(lines(out)).toHaveLength(4);
    for (const line of [a, b, c, d]) expect(line).toMatch(/^[0-9a-f]{64}$/);
    expect(a).toBe(b);
    expect(a).toBe(sha256('jaehoon1234'));
    expect(c).not.toBe(a);
    expect(c).toBe(sha256('jaehoon1235'));
    expect(d).toBe(sha256('비밀번호가 아무리 길어도 해시의 길이는 같아요'));
  });
});

describe('축 ② Step 2 — 솔트 없는 SHA-256', () => {
  it('🔴 users-sha256.js 의 해시는 적어 둔 비밀번호의 SHA-256 · dahye 와 seungwoo 는 같은 해시', async () => {
    const { users } = await import(LAB('users-sha256.js'));
    expect(users.map((user) => user.username)).toEqual(Object.keys(PASSWORDS));
    for (const user of users) expect(user.hash).toBe(sha256(PASSWORDS[user.username]));
    expect(users.find((u) => u.username === 'dahye').hash).toBe(users.find((u) => u.username === 'seungwoo').hash);
    expect(read(LAB('users-sha256.js'))).not.toContain('qwer1234');
  });

  it('🔴 예시 비밀번호는 겹치지 않는 10만 개', async () => {
    const { samplePasswords } = await import(LAB('words.js'));
    const passwords = [...samplePasswords()];
    expect(passwords).toHaveLength(100000);
    expect(new Set(passwords).size).toBe(100000);
  });

  it('🔴 cost-sha256.js — 10만 번 해시하는 데 1초 안쪽', () => {
    const { code, out } = run(LAB('.'), 'cost-sha256.js');
    expect(code).toBe(0);
    const [, ms] = out.trim().match(/^SHA-256으로 100000번 해시하는 데 (\d+)ms 걸렸어요\.$/);
    expect(Number(ms)).toBeLessThan(1000);
  });
});

describe('축 ③ Step 3 — 솔트', () => {
  it('🔴 salt.js — 같은 비밀번호를 두 번 해시해도 솔트와 해시가 다르고, 해시는 솔트 + 비밀번호의 SHA-256', () => {
    const { code, out } = run(LAB('.'), 'salt.js');
    expect(code).toBe(0);
    const pairs = [...out.matchAll(/salt: '([0-9a-f]{32})',\s+hash: '([0-9a-f]{64})'/g)].map((m) => ({ salt: m[1], hash: m[2] }));
    expect(pairs).toHaveLength(2);
    expect(pairs[0].salt).not.toBe(pairs[1].salt);
    expect(pairs[0].hash).not.toBe(pairs[1].hash);
    for (const { salt, hash } of pairs) expect(hash).toBe(sha256(salt + 'qwer1234'));
  });

  it('🔴 users-salted.js — 솔트가 다섯 다 다르고 dahye 와 seungwoo 의 해시도 다르다', async () => {
    const { users } = await import(LAB('users-salted.js'));
    expect(new Set(users.map((u) => u.salt)).size).toBe(5);
    for (const user of users) expect(user.hash).toBe(sha256(user.salt + PASSWORDS[user.username]));
    expect(users.find((u) => u.username === 'dahye').hash).not.toBe(users.find((u) => u.username === 'seungwoo').hash);
  });

  it('🔴 cost-salted.js — 다섯 사람 몫이라 50만 번', () => {
    const { code, out } = run(LAB('.'), 'cost-salted.js');
    expect(code).toBe(0);
    expect(out.trim()).toMatch(/^5명의 솔트를 붙여 500000번 해시하는 데 \d+ms 걸렸어요\.$/);
  });
});

describe('축 ④ 직접 해보기 1 — checkPassword', () => {
  const variant = (body) => {
    const dir = mkdtempSync(join(tmpdir(), 'p339-p1-'));
    writeFileSync(join(dir, 'practice1.js'), body);
    const result = run(dir, 'practice1.js');
    rmSync(dir, { recursive: true, force: true });
    return result;
  };

  it('🔴 정답 판 — true · false · true', () => {
    expect(lines(run(LAB('.'), 'practice1.js').out)).toEqual(['true', 'false', 'true']);
  });

  it('🔴 시작 판 — 빈칸 넷 · 비운 채로도 문법은 통과 · 정답 판과 빈칸만 다르다', () => {
    const start = read(P('snapshots/p3-39.practice1-start.practice1.js'));
    expect(start.match(/____/g)).toHaveLength(4);
    execFileSync(process.execPath, ['--check', P('snapshots/p3-39.practice1-start.practice1.js')]);
    const answer = read(LAB('practice1.js'));
    const pattern = start.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replaceAll('____', '.+?');
    expect(answer).toMatch(new RegExp(`^${pattern}$`, 's'));
  });

  it('🔴 틀린 판 — 솔트를 빼고 다시 해시하면 · 솔트를 새로 만들면 첫 줄이 false', () => {
    const answer = read(LAB('practice1.js'));
    const noSalt = answer.replace('const hash = sha256(saved.salt + password);', 'const hash = sha256(password);');
    const newSalt = answer.replace('const hash = sha256(saved.salt + password);', 'const { hash } = hashPassword(password);');
    expect(noSalt).not.toBe(answer);
    expect(newSalt).not.toBe(answer);
    expect(lines(variant(noSalt).out)[0]).toBe('false');
    expect(lines(variant(newSalt).out)[0]).toBe('false');
  });
});

describe('축 ⑤ Step 4 — bcrypt', () => {
  it('🔴 cost.js — 8·10·12·14 차례 · 해시 글자에 그 cost 가 든다 · 둘 올리면 서너 배', () => {
    const { code, out } = run(LAB('.'), 'cost.js');
    expect(code).toBe(0);
    const rows = lines(out).map((line) => line.match(/^cost (\d+): (\d+)ms {2}(\$2b\$(\d\d)\$[./A-Za-z0-9]{53})$/));
    expect(rows.every(Boolean)).toBe(true);
    expect(rows.map((m) => Number(m[1]))).toEqual([8, 10, 12, 14]);
    for (const m of rows) expect(Number(m[4])).toBe(Number(m[1]));
    const ms = rows.map((m) => Number(m[2]));
    expect(ms[3] / ms[2]).toBeGreaterThan(3);
    expect(ms[3] / ms[2]).toBeLessThan(5.5);
    expect(ms[2]).toBeGreaterThan(80);
  }, 30000);

  it('🔴 cost-bcrypt.js — 20번 해시한 시간으로 10만 번을 몇 시간으로 짐작한다', () => {
    const { code, out } = run(LAB('.'), 'cost-bcrypt.js');
    expect(code).toBe(0);
    const [first, second] = lines(out);
    expect(lines(out)).toHaveLength(2);
    const [, each] = first.match(/^bcrypt\(cost 12\)로 20번 해시해 보니 한 번에 (\d+)ms 걸렸어요\.$/);
    const [, hours] = second.match(/^같은 방식으로 10만 번 해시하려면 (\d+\.\d)시간쯤 걸려요\.$/);
    expect(Math.abs(Number(hours) - (Number(each) * 100000) / 3600000)).toBeLessThan(0.2);
  }, 30000);
});

// Step 5 의 실습 서버 · 부하 스크립트는 포트 4003 을 쓴다 — 판정은 사본의 포트만 바꿔 띄운다.
const withLabServer = async (file, port, fn) => {
  const dir = mkdtempSync(join(tmpdir(), 'p339-lab-'));
  cpSync(LAB('.'), dir, { recursive: true });
  for (const name of readdirSync(dir).filter((n) => n.endsWith('.js') || n.endsWith('.http'))) {
    writeFileSync(join(dir, name), read(join(dir, name)).replaceAll('4003', String(port)).replaceAll('4011', String(port)));
  }
  symlinkSync(P('node_modules'), join(dir, 'node_modules'));
  const srv = await boot(join(dir, file), { port, cwd: dir, ready: `${port}번 포트에서` });
  try {
    await fn({ dir, srv });
  } finally {
    await Promise.race([srv.stop(), sleep(500)]);
    rmSync(dir, { recursive: true, force: true });
  }
};

describe('축 ⑥ Step 5 — 서버도 그 시간을 치른다', () => {
  it('🔴 load.js — hashSync 동안 /ping 이 기다리고, hash 동안은 안 기다린다 · 다섯을 한꺼번에 보내면 다섯째만 한 번 더', async () => {
    await withLabServer('signup-server.js', LAB_PORT, async ({ dir, srv }) => {
      expect(srv.log).toContain(`${LAB_PORT}번 포트에서 가입 실습 서버가 돌아가요`);
      const { code, out } = run(dir, 'load.js');
      expect(code).toBe(0);
      const [sync, async, many] = lines(out);
      const [, syncMs, syncPing] = sync.match(/^\/signup-sync (\d+)ms · 그사이에 보낸 \/ping (\d+)ms$/).map(Number);
      const [, asyncMs, asyncPing] = async.match(/^\/signup (\d+)ms · 그사이에 보낸 \/ping (\d+)ms$/).map(Number);
      expect(syncPing).toBeGreaterThan(100);
      expect(syncPing).toBeLessThan(syncMs);
      expect(asyncPing).toBeLessThan(50);
      expect(asyncMs).toBeGreaterThan(100);
      const times = many.match(/^\/signup 다섯 개를 한꺼번에: (.+)ms$/)[1].split('ms · ').map(Number);
      expect(times).toHaveLength(5);
      const sorted = [...times].sort((a, b) => a - b);
      expect(sorted[4] / sorted[3]).toBeGreaterThan(1.6);
      expect(sorted[3] / sorted[0]).toBeLessThan(1.3);
    });
  }, 30000);
});

describe('축 ⑦ 직접 해보기 2 — cost 고르기', () => {
  it('🔴 0.25초를 넘은 줄에서 멈추고, 그 바로 앞의 cost 를 고른다', () => {
    const { code, out } = run(LAB('.'), 'practice2.js');
    expect(code).toBe(0);
    const all = lines(out);
    const rows = all.slice(0, -1).map((line) => line.match(/^cost (\d+): (\d+)ms$/).slice(1).map(Number));
    const [, chosen] = all.at(-1).match(/^이 컴퓨터에서 고를 cost: (\d+)$/).map(Number);
    expect(rows[0][0]).toBe(10);
    const over = rows.find(([, ms]) => ms > 250);
    if (over) {
      expect(rows.at(-1)).toEqual(over);
      expect(chosen).toBe(over[0] - 1);
    } else {
      expect(chosen).toBe(15);
    }
  }, 60000);
});

describe('축 ⑧ Step 6 — 가입이 해시를 저장한다', () => {
  beforeAll(freshGate);

  it('🔴 마이그레이션 SQL — password_hash TEXT 한 칸(NULL 허용)', () => {
    const [dir] = readdirSync(R('prisma/migrations')).filter((name) => name.endsWith('_add_user_password_hash'));
    expect(dir).toMatch(/^2026111\d{7}_add_user_password_hash$/);
    expect(read(R(`prisma/migrations/${dir}/migration.sql`))).toBe('-- AlterTable\nALTER TABLE "users" ADD COLUMN     "password_hash" TEXT;\n');
    expect(read(R('prisma/schema.prisma'))).toContain('  passwordHash String?   @map("password_hash")\n');
  });

  it('🔴 auth.http 의 두 가입 — 해시가 $2b$12$ 로 시작하고 서로 다르다 · 받은 글자는 DB 어디에도 없다 · 다른 사람은 NULL', async () => {
    await withServer(R, async ({ base, tail }) => {
      for (const [username, name] of [['seoyeon', '박서연'], ['doyun', '최도윤']]) {
        const started = performance.now();
        const res = await getRes(`${base}/api/auth/signup`, json('POST', { emailOrPhone: `${username}@example.com`, name, username, password: 'instagram1234' }));
        expect(performance.now() - started).toBeGreaterThan(100);
        expect(res.status).toBe(201);
        expect(res.body).toEqual({ message: '가입했어요', username });
      }
      const rows = await gate('SELECT username, password_hash FROM users ORDER BY id');
      const hashOf = Object.fromEntries(rows.map((row) => [row.username, row.password_hash]));
      expect(hashOf.seoyeon.startsWith('$2b$12$')).toBe(true);
      expect(hashOf.doyun.startsWith('$2b$12$')).toBe(true);
      expect(hashOf.seoyeon).not.toBe(hashOf.doyun);
      expect(await bcrypt.compare('instagram1234', hashOf.seoyeon)).toBe(true);
      for (const name of ['dahye', 'jaehoon', 'minji', 'nayeon', 'seungwoo']) expect(hashOf[name]).toBeNull();
      const dump = await gate('SELECT row_to_json(u)::text AS row FROM users u');
      expect(dump.map((r) => r.row).join('\n')).not.toContain('instagram1234');
      // 요청 기록에서 가입만 0.1초를 넘는다.
      const signupLines = tail().split('\n').filter((line) => line.startsWith('POST /api/auth/signup 201'));
      expect(signupLines).toHaveLength(2);
      for (const line of signupLines) expect(Number(line.match(/ ([\d.]+)ms$/)[1])).toBeGreaterThan(100);
    });
  }, 60000);

  it('🔴 응답에는 해시가 안 나간다 — 가입 · 로그인 · 나는 누구(옛 주소 · 새 주소)', async () => {
    await withServer(R, async ({ base }) => {
      const bodies = [];
      bodies.push((await getRes(`${base}/api/v2/auth/signup`, json('POST', { emailOrPhone: 'hyejin@example.com', name: '정혜진', username: 'hyejin', password: 'hyejin1234' }))).body);
      for (const api of ['/api', '/api/v2']) {
        const login = await getRes(`${base}${api}/auth/login`, json('POST', { username: 'seoyeon' }));
        bodies.push(login.body);
        const cookie = login.headers.get('set-cookie').split(';')[0];
        bodies.push((await getRes(`${base}${api}/auth/me`, { headers: { Cookie: cookie } })).body);
      }
      expect(bodies[0]).toEqual({ data: { message: '가입했어요', username: 'hyejin' } });
      expect(bodies[1]).toEqual({ id: 6, username: 'seoyeon', profileImage: null });
      expect(bodies[3]).toEqual({ data: { id: 6, username: 'seoyeon', profileImage: null } });
      const text = JSON.stringify(bodies);
      for (const word of ['password', 'Hash', '$2b$']) expect(text).not.toContain(word);
    });
  }, 60000);

  it('🔴 가입 규칙은 그대로 — 7자 비밀번호는 400 이고 아무것도 저장하지 않는다', async () => {
    await withServer(R, async ({ base }) => {
      const res = await getRes(`${base}/api/v2/auth/signup`, json('POST', { emailOrPhone: 'mina@example.com', name: '이미나', username: 'mina', password: '1234567' }));
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
      expect(await gate("SELECT count(*)::int AS n FROM users WHERE username = 'mina'")).toEqual([{ n: 0 }]);
    });
  }, 30000);
});

// ───────── 축 ⑨ 같은 요청 54개 ─────────
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
const ISO = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g;
const normalize = (value) => JSON.parse(JSON.stringify(value).replace(UUID, '<uuid>').replace(ISO, '<time>').replace(/Expires=[^;"]+/g, 'Expires=<date>'));
const HEADERS = ['content-type', 'location', 'allow', 'cache-control', 'deprecation', 'sunset', 'link', 'set-cookie', 'etag'];
// `p3-38` 판정 축 ② 의 54개 그대로 — 가입은 이제 해시를 저장하지만 응답은 한 글자도 안 바뀐다.
const SCRIPT = async (base, api) => {
  const out = [];
  const photo = readFileSync(P('requests/photos/beach.jpg'));
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

describe('축 ⑨ 같은 요청 54개 — code/p3-38 과 같다', () => {
  for (const api of ['/api', '/api/v2']) {
    it(`🔴 ${api}`, async () => {
      await freshGate();
      let before;
      await withServer(B, async ({ base }) => { before = await SCRIPT(base, api); });
      await freshGate();
      let after;
      await withServer(R, async ({ base }) => { after = await SCRIPT(base, api); });
      expect(after).toHaveLength(54);
      expect(after).toEqual(before);
    }, 90000);
  }
});

describe('축 ⑩ 직접 해보기 3 — 관리자 스크립트', () => {
  beforeAll(freshGate);

  it('🔴 비밀번호를 주면 $2b$12$ 해시가 들어가고, password 줄을 빼고 이름만 바꿔 한 번 더 실행하면 그 사람은 NULL', async () => {
    const dir = studentDir(R);
    try {
      const done = run(join(dir, 'lab/p3-39'), 'practice3.js', env);
      expect(done.code).toBe(0);
      expect(done.out).toContain("가입시켰어요 { id: 6, username: 'admin.hong', profileImage: null }");
      const [{ password_hash: hash }] = await gate("SELECT password_hash FROM users WHERE username = 'admin.hong'");
      expect(hash.startsWith('$2b$12$')).toBe(true);
      expect(await bcrypt.compare('admin1234!', hash)).toBe(true);
      const again = run(join(dir, 'lab/p3-39'), 'practice3.js', env);
      expect(again.code).not.toBe(0);
      expect(again.out).toContain("code: 'USERNAME_TAKEN'");
      const answer = read(LAB('practice3.js'));
      const noPassword = answer.replace("  password: 'admin1234!',\n", '').replace("username: 'admin.hong'", "username: 'admin.kim'").replace("phone: '010-7777-1234'", "phone: '010-7777-5678'");
      expect(noPassword).not.toContain('password');
      writeFileSync(join(dir, 'lab/p3-39/practice3.js'), noPassword);
      expect(run(join(dir, 'lab/p3-39'), 'practice3.js', env).code).toBe(0);
      expect(await gate("SELECT password_hash FROM users WHERE username = 'admin.kim'")).toEqual([{ password_hash: null }]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30000);

  it('🔴 해시는 userService.createUser 한 곳에서 — authService 에는 bcrypt 가 없다', () => {
    expect(read(R('services/userService.js'))).toContain("await bcrypt.hash(password, PASSWORD_COST)");
    expect(read(R('services/authService.js'))).not.toContain('bcrypt');
  });
});

describe('축 ⑪ 과제', () => {
  it('🔴 [기초] homework1.http — 201 · 201 · 409 · 400 · 목록은 이메일만 · 서버 기록의 두 해시는 다르다', async () => {
    await withLabServer('homework1.js', HW_PORT, async ({ dir, srv }) => {
      const http = read(join(dir, 'homework1.http'));
      const requests = http.split(/^### /m).slice(1).map((block) => {
        const [title, ...rest] = block.split('\n');
        const [start] = rest;
        const [method, url] = start.split(' ');
        const body = rest.join('\n').split('\n\n')[1]?.trim();
        return { title, method, url, body };
      });
      expect(requests.map((r) => r.title)).toEqual(['가입', '같은 비밀번호로 한 사람 더 가입', '이미 가입한 이메일', '짧은 비밀번호', '회원 목록']);
      const statuses = [];
      let list;
      for (const r of requests) {
        const res = await getRes(r.url, r.body ? { method: r.method, headers: { 'Content-Type': 'application/json' }, body: r.body } : { method: r.method });
        statuses.push(res.status);
        list = res.body;
      }
      expect(statuses).toEqual([201, 201, 409, 400, 200]);
      expect(list).toEqual([{ email: 'bomi@example.com' }, { email: 'gaeun@example.com' }]);
      const hashes = [...srv.tail().matchAll(/passwordHash: '(\$2b\$12\$[./A-Za-z0-9]{53})'/g)].map((m) => m[1]);
      expect(hashes).toHaveLength(2);
      expect(hashes[0]).not.toBe(hashes[1]);
    });
  }, 30000);

  it('🔴 [기초] 답안 «이렇게 하면 더 좋아요» — 같은 이메일 둘을 한꺼번에 보내면 원래 판은 둘 다 201, 넣기 직전에 다시 보는 판은 201 하나 · 409 하나', async () => {
    const twice = async (file) => {
      let statuses;
      await withLabServer(file, HW_PORT, async () => {
        const send = () => fetch(`http://localhost:${HW_PORT}/members`, json('POST', { email: 'same@example.com', password: 'club2026!' })).then((r) => r.status);
        statuses = (await Promise.all([send(), send()])).sort();
      });
      return statuses;
    };
    expect(await twice('homework1.js')).toEqual([201, 201]);
    const recheck = read(P('snapshots/p3-39.homework1-recheck.js'));
    expect(recheck.replace(/  \/\/ 해시를 기다리는[^\n]*\n  if \(members\.some[^\n]*\n[^\n]*\n  \}\n/, '')).toBe(read(LAB('homework1.js')));
    const dir = mkdtempSync(join(tmpdir(), 'p339-recheck-'));
    try {
      writeFileSync(join(dir, 'homework1.js'), recheck.replaceAll('4011', String(HW_PORT)));
      symlinkSync(P('node_modules'), join(dir, 'node_modules'));
      const srv = await boot(join(dir, 'homework1.js'), { port: HW_PORT, cwd: dir, ready: `${HW_PORT}번 포트에서` });
      try {
        const send = () => fetch(`http://localhost:${HW_PORT}/members`, json('POST', { email: 'same@example.com', password: 'club2026!' })).then((r) => r.status);
        expect((await Promise.all([send(), send()])).sort()).toEqual([201, 409]);
      } finally {
        await Promise.race([srv.stop(), sleep(500)]);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30000);

  it('🔴 [응용] homework2.js — 세 줄 · 솔트 없음은 다섯 사람도 같은 시간 · bcrypt 는 다섯 사람이 한 사람의 5배', () => {
    const { code, out } = run(LAB('.'), 'homework2.js');
    expect(code).toBe(0);
    const [plain, salted, hashed] = lines(out);
    expect(lines(out)).toHaveLength(3);
    const p = plain.match(/^솔트 없는 SHA-256 — 한 사람 (\d+)ms · 다섯 사람 (\d+)ms$/);
    expect(p[1]).toBe(p[2]);
    expect(salted).toMatch(/^솔트 \+ SHA-256 — 한 사람 \d+ms · 다섯 사람 \d+ms$/);
    const h = hashed.match(/^bcrypt cost 12 — 한 사람 (\d+\.\d)시간 · 다섯 사람 (\d+\.\d)시간$/);
    expect(Math.abs(Number(h[2]) - Number(h[1]) * 5)).toBeLessThan(0.3);
  }, 30000);
});

describe('축 ⑫ 이 회차 학생 파일 — code/p3-38 에서 바뀐 파일', () => {
  it('🔴 바뀐 학생 파일은 이것뿐이다', () => {
    if (!ROUND.fromBookmark) return;
    const out = execFileSync('git', ['diff', '--name-only', 'code/p3-38', 'code/p3-39', '--', '.', ':!test', ':!snapshots'], { cwd: P('.'), encoding: 'utf8' });
    const changed = out.trim().split('\n').filter((name) => !name.startsWith('lab/p3-39/'));
    expect(changed.sort()).toEqual([
      'controllers/authController.js',
      'package-lock.json',
      'package.json',
      expect.stringMatching(/^prisma\/migrations\/2026111\d{7}_add_user_password_hash\/migration\.sql$/),
      'prisma/schema.prisma',
      'requests/auth.http',
      'schemas/authSchema.js',
      'services/authService.js',
      'services/userService.js',
    ]);
    expect(JSON.parse(read(R('package.json'))).dependencies.bcrypt).toBe('^6.0.0');
  });
});

// ───────── 축 ⑬ 교안·답안의 코드 블록 ─────────
describe('축 ⑬ 교안·답안의 코드 블록은 줄마다 그 파일에 실재한다', () => {
  const TRACK_DIR = new URL('../../', ROOT).pathname;
  const DOCS = ['part3/7-express-auth/p3-39-signup-hashing-lecture.md', 'part3/7-express-auth/p3-39-signup-hashing-answers.md'].map((f) => join(TRACK_DIR, f));
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
  // 그 블록이 실재할 수 있는 판 — 최종 파일 · 직접 해보기 1 시작 판 · 과제 [기초] 답안의 «더 좋아요» 판
  const versions = (rel) => [R(rel), rel === 'lab/p3-39/practice1.js' ? P('snapshots/p3-39.practice1-start.practice1.js') : null].filter(Boolean).map(read);

  it('🔴 javascript 블록마다 한 판에 줄이 모두 있다(경로 주석이 없는 블록은 «더 좋아요» 판)', () => {
    const all = DOCS.flatMap((d) => fences(d, 'javascript'));
    expect(all.length).toBe(22);
    for (const b of all) {
      const head = b[0] ?? '';
      const lines = b.filter((l) => l.trim() !== '' && l.trim() !== '...' && !l.startsWith('// ~/'));
      const texts = head.startsWith('// ~/instagram-api/') ? versions(head.replace('// ~/instagram-api/', '')) : [read(P('snapshots/p3-39.homework1-recheck.js'))];
      expect(texts.some((text) => lines.every((l) => text.includes(l))), `${head}\n${lines.join('\n')}`).toBe(true);
    }
  });

  it('🔴 http · prisma · sql 블록 — auth.http 끝 두 요청 · homework1.http 통째 · User 모델 · migration.sql', () => {
    const [lecture] = DOCS.map(read);
    const http = read(R('requests/auth.http'));
    expect(lecture).toContain(`\`\`\`http\n${http.slice(http.indexOf('### 해시로 저장되는지 볼 가입'))}\`\`\``);
    expect(lecture).toContain(`\`\`\`http\n${read(LAB('homework1.http'))}\`\`\``);
    expect(lecture).toContain(`\`\`\`prisma\n${read(R('prisma/schema.prisma')).match(/model User \{.*?\n\}/s)[0]}\n\`\`\``);
    const [dir] = readdirSync(R('prisma/migrations')).filter((name) => name.endsWith('_add_user_password_hash'));
    expect(lecture).toContain(`\`\`\`sql\n${read(R(`prisma/migrations/${dir}/migration.sql`))}\`\`\``);
    expect(lecture).toContain(`Applying migration \`${dir}\``);
  });

  it('🔴 hash.js 의 출력 블록은 실제 출력과 글자 그대로', () => {
    const lecture = read(DOCS[0]);
    const { out } = run(LAB('.'), 'hash.js');
    expect(lecture).toContain(`\`\`\`\n${out}\`\`\``);
  });
});
