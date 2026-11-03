// p2-38 「밖으로 내보내기」 게이트
//
// 🚨 이 회차의 판정 축은 «남의 컴퓨터에서도 도는가» 다. 앞 회차들이 전부
//    «내 컴퓨터 안에서» 끝났으므로, 이 회차가 새로 주장하는 것은 **내 컴퓨터에만
//    있던 것 셋(데이터베이스 · `.env` 파일 · 생성된 Prisma 클라이언트)이 없어도
//    서버가 서는가** 다. 셋을 갈라 재지 않으면 「배포했다」가 무엇을 뜻하는지
//    교안이 뭉뚱그리게 된다.
//
// 축 ① 빈 데이터베이스에 `migrate deploy` 만으로 표가 서고 시드가 들어간다.
// 축 ② `.env` 가 «없어도» Prisma 명령이 돈다 — 환경변수를 먼저 본다.
// 축 ③ 그런데 `.env` 만 있고 환경변수가 없는 «평소 자리» 도 안 깨졌다.
// 축 ④ `npm start` 는 `--env-file` 없이 뜬다 — 배포에서 값은 환경이 준다.
// 축 ⑤ 클라이언트는 «만들어야» 생긴다 — `npm install` 이 대신 안 해준다.
// 축 ⑥ 허락 목록이 코드에 안 남았다 — `CORS_ORIGIN` 에서 읽는다.
// 축 ⑦ 값만 바꾸면 코드를 안 고치고 허락 범위가 달라진다 — 배포 주소가 그 자리다.
// 축 ⑧ 값이 없으면 «시끄럽게» 죽는다 — 조용히 전부 막히지 않는다.
// 축 ⑨ 프론트 — 가짜 서버 주소가 코드에 안 박혀 있다.
// 축 ⑩ 앞 회차가 안 깨졌다.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, existsSync, renameSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import pg from 'pg';
import { boot } from './helpers/boot.js';

const ROOT = new URL('../', import.meta.url);
const P = (rel) => new URL(rel, ROOT).pathname;
const ADMIN = { host: 'localhost', port: 5432, database: 'postgres', user: 'postgres', password: 'postgres' };

// 🚨 이 회차의 게이트 DB 는 «비어 있는 채로» 시작해야 한다. 다른 회차처럼 SQL 픽스처를
//    부어놓고 시작하면 축 ① 이 재려는 것(마이그레이션이 표를 «세운다») 이 이미
//    끝나 있어서, 아무것도 안 보고 초록을 찍는다.
const GATE_DB = 'p238_gate';
const GATE_URL = `postgresql://postgres:postgres@localhost:5432/${GATE_DB}`;
const ENV = { DATABASE_URL: GATE_URL };
const PORT = 3468;

const read = (p) => readFileSync(p, 'utf8');
const FRONT = (rel) => read(P(`../instagram-react/${rel}`));

/** 우리 프론트가 개발할 때 서는 자리. */
const OURS = 'http://localhost:5173';
/** 배포한 화면이 서는 자리 — 학생마다 다르므로 게이트는 «모양만» 같은 값을 쓴다. */
const DEPLOYED = 'https://instagram-react.vercel.app';
const 남 = 'http://evil.example.com';

let db = null;
let server = null;

/** 학생이 배포에서 치는 그 명령을 그대로 — `.env` 를 안 읽고 환경변수만 받는다. */
const prisma = (args, env = ENV) =>
  execFileSync('npx', ['prisma', ...args],
    { cwd: P('.'), encoding: 'utf8', env: { ...process.env, ...env } });

const seed = (env = ENV) =>
  execFileSync(process.execPath, [P('seed.js')],
    { cwd: P('.'), encoding: 'utf8', env: { ...process.env, ...env } });

const 물어보기 = (origin, { port = PORT, path: p = '/api/posts?limit=1' } = {}) =>
  fetch(`http://localhost:${port}${p}`, { headers: origin ? { Origin: origin } : {} });

beforeAll(async () => {
  const admin = new pg.Client(ADMIN);
  await admin.connect();
  await admin.query(
    `select pg_terminate_backend(pid) from pg_stat_activity where datname = '${GATE_DB}' and pid <> pg_backend_pid()`);
  await admin.query(`DROP DATABASE IF EXISTS ${GATE_DB}`);
  await admin.query(`CREATE DATABASE ${GATE_DB}`);
  await admin.end();

  db = new pg.Client({ ...ADMIN, database: GATE_DB });
  await db.connect();
}, 60000);

afterAll(async () => {
  await server?.stop();
  await db?.end();
});

describe('축 ① — 빈 데이터베이스가 «명령 두 줄» 로 쓸 수 있게 된다', () => {
  it('시작할 때는 표가 하나도 없다', async () => {
    const { rows } = await db.query(
      "select tablename from pg_tables where schemaname = 'public'");
    expect(rows).toEqual([]);
  });

  it('`prisma migrate deploy` 가 마이그레이션 전부를 올린다', async () => {
    const out = prisma(['migrate', 'deploy']);
    expect(out).toContain('migrations have been successfully applied');

    const { rows } = await db.query(
      "select tablename from pg_tables where schemaname = 'public' order by tablename");
    const 표 = rows.map((r) => r.tablename);
    expect(표).toContain('users');
    expect(표).toContain('posts');
    expect(표).toContain('comments');
    expect(표).toContain('post_images');
    expect(표).toContain('post_likes');
  }, 120000);

  it('`migrate deploy` 는 «새 마이그레이션을 만들지» 않는다 — 있는 것만 올린다', () => {
    // `migrate dev` 와 갈리는 자리다. 배포 DB 를 보고 스키마를 고쳐 쓰면 안 된다.
    const before = execFileSync('ls', [P('prisma/migrations')], { encoding: 'utf8' });
    prisma(['migrate', 'deploy']);
    const after = execFileSync('ls', [P('prisma/migrations')], { encoding: 'utf8' });
    expect(after).toBe(before);
  }, 120000);

  it('시드가 그 표를 채운다', async () => {
    seed();
    const { rows } = await db.query('select count(*)::int as n from posts');
    expect(rows[0].n).toBeGreaterThan(0);
  }, 60000);
});

describe('축 ② — `.env` 가 «없어도» Prisma 명령이 돈다', () => {
  /** `.env` 를 잠깐 치우고 돌린다 — 배포한 곳에는 그 파일이 없다. */
  const env파일없이 = (fn) => {
    const live = P('.env');
    const hidden = P('.env.__p238__');
    const 있었다 = existsSync(live);
    if (있었다) renameSync(live, hidden);
    try {
      return fn();
    } finally {
      if (있었다) renameSync(hidden, live);
    }
  };

  it('`.env` 없이 `migrate deploy` 가 환경변수만 받아 돈다', () => {
    const out = env파일없이(() => prisma(['migrate', 'deploy']));
    expect(out).toContain('migrations found');
  }, 120000);

  it('`.env` 는 검사 뒤에 제자리로 돌아와 있다', () => {
    expect(existsSync(P('.env'))).toBe(true);
    expect(existsSync(P('.env.__p238__'))).toBe(false);
  });

  it('`prisma.config.js` 가 환경변수를 «먼저» 본다', () => {
    const src = read(P('prisma.config.js'));
    // 조건 없이 `process.loadEnvFile()` 을 부르면 파일이 없을 때 ENOENT 로 던진다.
    expect(src).toMatch(/process\.env\.DATABASE_URL/);
    expect(src).not.toMatch(/^\s*process\.loadEnvFile\(\);/m);
  });
});

describe('축 ③ — 평소 자리(내 컴퓨터)가 안 깨졌다', () => {
  it('`.env` 만 있고 환경변수가 없어도 Prisma 가 돈다', () => {
    // 학생이 늘 치는 모양이다. 가드를 넣다가 이쪽을 깨뜨리면 수업이 멈춘다.
    const env = { ...process.env };
    delete env.DATABASE_URL;
    const out = execFileSync('npx', ['prisma', 'migrate', 'status'],
      { cwd: P('.'), encoding: 'utf8', env });
    expect(out).toContain('migrations found');
  }, 120000);
});

describe('축 ④ — `npm start` 는 `--env-file` 없이 뜬다', () => {
  it('`start` 에 `--env-file` 이 없다 — 배포에서 값은 환경이 준다', () => {
    const pkg = JSON.parse(read(P('package.json')));
    expect(pkg.scripts.start).not.toContain('--env-file');
    expect(pkg.scripts.dev).toContain('--env-file=.env');
  });

  it('환경변수만 주면 서버가 뜨고 시드한 데이터를 준다', async () => {
    server = await boot('app.js', {
      port: PORT,
      env: { ...ENV, PORT: String(PORT), CORS_ORIGIN: OURS },
      ready: `${PORT}번 포트에서`,
    });
    const res = await 물어보기(OURS);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBeGreaterThan(0);
  }, 60000);
});

describe('축 ⑤ — Prisma 클라이언트는 «만들어야» 생긴다', () => {
  it('`@prisma/client` 에 설치하며 대신 만들어주는 스크립트가 없다', () => {
    const pkg = JSON.parse(read(P('node_modules/@prisma/client/package.json')));
    expect(pkg.scripts?.postinstall).toBeUndefined();
    expect(pkg.scripts?.prepare).toBeUndefined();
  });

  it('`build` 가 만들기와 올리기를 둘 다 한다', () => {
    const pkg = JSON.parse(read(P('package.json')));
    expect(pkg.scripts.build).toContain('prisma generate');
    expect(pkg.scripts.build).toContain('prisma migrate deploy');
  });

  it('`npm run build` 가 실제로 돈다', () => {
    const out = execFileSync('npm', ['run', 'build'],
      { cwd: P('.'), encoding: 'utf8', env: { ...process.env, ...ENV } });
    expect(out).toMatch(/Generated Prisma Client|generated/i);
  }, 180000);
});

describe('축 ⑥ — 허락 목록이 코드에 안 남았다', () => {
  it('`app.js` 가 `CORS_ORIGIN` 에서 읽는다', () => {
    const src = read(P('app.js'));
    expect(src).toContain('process.env.CORS_ORIGIN');
  });

  it('주소 목록이 코드에 다시 안 적혀 있다', () => {
    const src = read(P('app.js'));
    // 코드에 남아 있으면 «뺀 것이 아니다» — `p2-37` 과제가 정한 판정이다.
    expect(src).not.toContain("'http://localhost:5173'");
    expect(src).not.toMatch(/origin:\s*\[\s*['"]http/);
  });

  it('`.env.example` 이 그 이름을 알려준다', () => {
    const src = read(P('.env.example'));
    expect(src).toContain('CORS_ORIGIN');
    expect(src).toContain('DATABASE_URL');
  });
});

describe('축 ⑦ — 값만 바꾸면 허락 범위가 달라진다', () => {
  const 둘 = `${OURS},${DEPLOYED}`;
  const P2 = 3469;
  let s2 = null;

  afterAll(async () => { await s2?.stop(); });

  it('배포 주소를 값에 더하면 «코드를 안 고치고» 그쪽도 허락받는다', async () => {
    s2 = await boot('app.js', {
      port: P2,
      env: { ...ENV, PORT: String(P2), CORS_ORIGIN: 둘 },
      ready: `${P2}번 포트에서`,
    });

    const 개발 = await 물어보기(OURS, { port: P2 });
    expect(개발.headers.get('access-control-allow-origin')).toBe(OURS);

    const 배포 = await 물어보기(DEPLOYED, { port: P2 });
    expect(배포.headers.get('access-control-allow-origin')).toBe(DEPLOYED);
  }, 60000);

  it('되비치는 것은 «부른 쪽» 하나뿐이다 — 헤더에 출처를 둘 못 적는다', async () => {
    const res = await 물어보기(DEPLOYED, { port: P2 });
    const 허락 = res.headers.get('access-control-allow-origin');
    expect(허락).toBe(DEPLOYED);
    expect(허락).not.toContain(',');
    expect(허락).not.toContain(OURS);
  });

  it('목록에 없는 곳은 여전히 헤더를 못 받는다', async () => {
    const res = await 물어보기(남, { port: P2 });
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('축 ⑧ — 값이 없으면 «시끄럽게» 죽는다', () => {
  it('`CORS_ORIGIN` 없이 띄우면 서버가 뜨지 못하고 이유를 말한다', async () => {
    // 조용히 빈 목록으로 넘어가면 서버는 멀쩡히 뜨고 «모든 요청이 말없이 막힌다».
    // 그때 학생은 화면만 보고 원인을 못 찾는다 — `p2-37` 답안이 정한 판정이다.
    //
    // 🚨 «뜨면 안 되는 것» 을 재는 자리라, 뜨고 말았을 때 그 서버를 반드시 끈다.
    //    안 끄면 다음 판이 그 포트에서 「이미 물려 있습니다」로 죽고, 그 죽음은
    //    코드 결함이 아니라 앞판이 남긴 것이라 판정이 거짓이 된다(실제로 그랬다).
    const 포트 = 3481;
    let 샜다 = null;
    let 던진것 = null;
    try {
      샜다 = await boot('app.js',
        { port: 포트, env: { ...ENV, PORT: String(포트) }, ready: `${포트}번 포트에서`, timeoutMs: 6000 });
    } catch (err) {
      던진것 = err;
    } finally {
      await 샜다?.stop();
    }

    expect(샜다, '`CORS_ORIGIN` 이 없는데도 서버가 떴습니다 — 조용히 넘어가고 있습니다').toBeNull();
    expect(던진것?.message).toMatch(/CORS_ORIGIN|split|undefined/);
  }, 30000);
});

describe('축 ⑨ — 프론트: 가짜 서버 주소가 코드에 안 박혀 있다', () => {
  it('`api.js` 가 가짜 서버 주소를 환경에서 받는다', () => {
    const src = FRONT('src/services/api.js');
    expect(src).toContain('VITE_FAKE_SERVER');
    expect(src).not.toContain('http://localhost:3001');
  });

  it('`.env.example` 이 두 이름을 다 알려준다', () => {
    const src = FRONT('.env.example');
    expect(src).toContain('VITE_API_URL');
    expect(src).toContain('VITE_FAKE_SERVER');
  });
});

describe('축 ⑩ — 앞 회차가 안 깨졌다', () => {
  it('`p2-37` — 프록시 규칙이 그대로 우리 서버를 가리킨다', () => {
    const src = FRONT('vite.config.js');
    expect(src).toMatch(/['"]\/api['"]\s*:\s*['"]http:\/\/localhost:3000['"]/);
  });

  it('`p2-37` — 앱이 서버 주소를 환경에서 받는다', () => {
    const src = FRONT('src/services/api.js');
    expect(src).toContain('import.meta.env.VITE_API_URL');
  });

  it('`p2-36` — 목록은 여전히 커서 봉투로 온다', async () => {
    const res = await 물어보기(OURS);
    const body = await res.json();
    expect(body).toHaveProperty('items');
    expect(body).toHaveProperty('hasNext');
  });

  it('`p2-25` — 서버는 여전히 `PORT` 를 환경에서 받는다', () => {
    expect(read(P('app.js'))).toContain('process.env.PORT');
  });
});
