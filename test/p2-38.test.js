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
// 축 ⑪ 교안이 실은 배포 출력(로그 · 시드 펜스의 경고 첫 줄과 시드 줄 · 마이그레이션 개수)이 실제 출력과 같다.
// 축 ⑫ 답안 [기초] 5번 — 다시 시드하면 댓글 `createdAt` 이 달라진다(로컬인지 가리는 단서).
// 축 ⑬ `sslmode=require` 주소를 쓰는 서버는 뜰 때가 아니라 첫 요청 때 SSL 경고를 한 번 찍는다.
// 축 ⑭ 가드 없는 `prisma.config.js` 는 `.env` 없는 곳에서 에러 «한 줄» 로 멈춘다 — 교안 펜스와 같다.
// 축 ⑮ `.env` 를 저장하면 `--watch` 가 세 줄(Change detected · Restarting · 시작 줄)을 찍는다 — 교안 펜스와 같다.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import {
  readFileSync, existsSync, renameSync, readdirSync, rmSync, cpSync, writeFileSync,
  mkdirSync, symlinkSync,
} from 'node:fs';
import { execFileSync, spawnSync, spawn } from 'node:child_process';
import pg from 'pg';
import { boot } from './helpers/boot.js';
import { roundDir } from './helpers/round.js';

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
// 🚨 (p3-41) 그 회차부터 게시물 목록은 로그인한 사람만 받는다 — 목록을 물어보는 서버는 직전 판 `code/p3-40` 을 띄운다.
const PIN = roundDir('code/p3-40');

const read = (p) => readFileSync(p, 'utf8');
const FRONT = (rel) => read(P(`../instagram-react/${rel}`));

/** 우리 프론트가 개발할 때 서는 자리. */
const OURS = 'http://localhost:5173';
/** 배포한 화면이 서는 자리 — 학생마다 다르므로 게이트는 «모양만» 같은 값을 쓴다. */
const DEPLOYED = 'https://instagram-react.vercel.app';
const 남 = 'http://evil.example.com';

let db = null;
let server = null;

// 축 ① 이 학생과 같은 순서로 친 명령의 «실제 출력» — 축 ⑪ 이 교안 인용과 대조한다.
let 첫배포 = '';
let 둘째배포 = '';
let 시드출력 = '';

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
  PIN.cleanup();
});

describe('축 ① — 빈 데이터베이스가 «명령 두 줄» 로 쓸 수 있게 된다', () => {
  it('시작할 때는 표가 하나도 없다', async () => {
    const { rows } = await db.query(
      "select tablename from pg_tables where schemaname = 'public'");
    expect(rows).toEqual([]);
  });

  it('`prisma migrate deploy` 가 마이그레이션 전부를 올린다', async () => {
    const out = prisma(['migrate', 'deploy']);
    첫배포 = out;
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
    둘째배포 = prisma(['migrate', 'deploy']);
    const after = execFileSync('ls', [P('prisma/migrations')], { encoding: 'utf8' });
    expect(after).toBe(before);
  }, 120000);

  it('시드가 그 표를 채운다', async () => {
    시드출력 = seed();
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
    // 🚨 종료 코드는 안 본다. `.env` 가 가리키는 수업 DB 에 안 올린 마이그레이션이 있으면
    //    `migrate status` 는 설정을 잘 읽고도 exit 1 로 끝난다 — 이 축이 재는 것(설정 파일이
    //    `.env` 를 읽었나)과 상관없는 DB 상태다. 수업 DB 를 맞추려고 갈아엎지도 않는다.
    //    가드가 깨지면 설정을 읽는 자리에서 멈춰 아래 두 줄이 아예 안 찍힌다.
    const run = spawnSync('npx', ['prisma', 'migrate', 'status'],
      { cwd: P('.'), encoding: 'utf8', env });
    const out = `${run.stdout}${run.stderr}`;
    expect(out).not.toContain('ENOENT');
    expect(out).toMatch(/Datasource "db": PostgreSQL database "\w+"/);
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
      cwd: PIN.dir,
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

// ── 축 ⑪ — 교안이 실은 배포 출력이 실제 출력과 같다 ───────────────────────
// 🔑 audit 칸 retrofit(2026-09-18~)이 마이그레이션을 9 → 10개로 늘리고 폴더 이름을 옮겼다.
//    그때 교안의 개수 여섯 곳과 로그 인용은 손으로 고쳤는데 잠그는 축이 없었다(2026-09-21).
//    출력은 축 ① 이 빈 DB 에 «학생과 같은 순서로» 친 그대로다 — 여기서 다시 치지 않는다.
describe('축 ⑪ — 교안이 실은 배포 출력이 실제 출력과 같다', () => {
  const LECTURE = P('../../part2/6-fullstack-join/p2-38-fullstack-deploy-lecture.md');
  const 폴더들 = () => readdirSync(P('prisma/migrations'), { withFileTypes: true })
    .filter((d) => d.isDirectory()).map((d) => d.name).sort();
  /** `표지` 문장 바로 뒤에 오는 첫 펜스의 줄들 — `...` 과 빈 줄은 뺀다. */
  const 펜스뒤 = (표지) => {
    const src = read(LECTURE);
    const at = src.indexOf(표지);
    expect(at, `교안에서 「${표지}」 를 못 찾았다`).toBeGreaterThan(-1);
    return src.slice(at).match(/```[a-z]*\n([\s\S]*?)```/)[1]
      .split('\n').filter((l) => l.trim() && l.trim() !== '...');
  };
  const 적용줄 = (lines) => lines.filter((l) => l.startsWith('Applying migration'));

  it('첫 `migrate deploy` 인용의 줄이 전부 실제 출력에 있고, 적용 차례가 앞머리와 같다', () => {
    expect(첫배포, '축 ① 이 먼저 돌아야 한다').not.toBe('');
    const 인용 = 펜스뒤('찍히는 내용은 이래요.');
    for (const 줄 of 인용) expect(첫배포).toContain(줄);
    const 실제 = 적용줄(첫배포.split('\n'));
    expect(실제).toEqual(폴더들().map((n) => `Applying migration \`${n}\``));
    expect(실제.slice(0, 적용줄(인용).length)).toEqual(적용줄(인용));
  });

  it('배포 서비스 로그의 Prisma 두 줄이 «이미 올린 뒤» 의 `migrate deploy` 출력과 같다', () => {
    expect(둘째배포, '축 ① 이 먼저 돌아야 한다').not.toBe('');
    const 로그 = 펜스뒤('### 로그를 읽어요');
    const prisma줄 = 로그.filter((l) => /migrations found|pending migrations/.test(l));
    expect(prisma줄).toHaveLength(2);
    for (const 줄 of prisma줄) expect(둘째배포).toContain(줄);
  });

  // 🔀 2026-09-21 — 교안 Step 3 이 Neon 첫 시드의 SECURITY WARNING 을 싣는다(`p2-42` 에 맞췄다).
  //    펜스는 「경고 첫 줄 · `...` · 시드 줄」 세 줄이다. 게이트 DB 는 로컬이라 주소에 `sslmode` 가
  //    없으니 두 끝을 따로 잰다 — 마지막 줄은 축 ① 의 실제 시드와, 첫 줄은 `?sslmode=require` 를
  //    붙여 «실제로 친» 시드의 경고와. 로컬 서버는 SSL 을 안 받아 그 시드는 연결에서 실패하지만,
  //    경고는 연결을 시도할 때 찍히므로 첫 줄을 재기에는 충분하다(표는 안 건드린다).
  //    🔑 「경고 → 시드 줄」 «순서» 는 SSL 을 켠 임시 PostgreSQL + `NODE_EXTRA_CA_CERTS` 로 연결에
  //    «성공하는» 판을 한 번 실측했다(2026-09-21 · 실제 Neon 은 미실측). 게이트는 그 서버를 못 띄운다.
  const SSL_URL = `${GATE_URL}?sslmode=require`;
  const 시드펜스 = () => {
    const src = read(LECTURE);
    const 뒤 = src.slice(src.indexOf('```bash\nnpm run seed\n```'));
    return 뒤.match(/```bash\nnpm run seed\n```\s*```\n([\s\S]*?)```/)[1].trim().split('\n');
  };
  /** 학생이 치는 그 파일을 주소만 바꿔 친다 — 경고는 stderr 로 나가서 둘을 합쳐 본다. */
  const 시드전체 = (url) => {
    const r = spawnSync(process.execPath, [P('seed.js')], {
      cwd: P('.'), encoding: 'utf8', timeout: 60000,
      env: { ...process.env, DATABASE_URL: url },
    });
    return `${r.stdout}${r.stderr}`;
  };
  const 숫자빼기 = (l) => l.replace(/^\(node:\d+\)/, '(node:N)');

  it('시드 펜스의 마지막 줄이 실제 시드 출력과 글자 그대로 같다', () => {
    expect(시드출력, '축 ① 이 먼저 돌아야 한다').not.toBe('');
    expect(시드펜스().at(-1)).toBe(시드출력.trim());
  });

  it('시드 펜스의 첫 줄이 `sslmode=require` 주소로 친 시드의 실제 경고 첫 줄과 같다', () => {
    const 펜스 = 시드펜스();
    expect(펜스).toHaveLength(3);
    expect(펜스[1]).toBe('...');
    const 경고 = 시드전체(SSL_URL).split('\n').find((l) => l.includes('SECURITY WARNING'));
    expect(경고, '`sslmode=require` 주소인데 경고가 안 찍혔다').toBeDefined();
    expect(숫자빼기(펜스[0])).toBe(숫자빼기(경고));
  }, 60000);

  it('주소에 `sslmode` 가 없으면 그 경고가 안 찍힌다 — 「로컬에서는 못 봤던」 이유', () => {
    expect(시드전체(GATE_URL)).not.toContain('SECURITY WARNING');
  }, 60000);

  it('마이그레이션 «개수» 를 말하는 자리가 전부 폴더 수와 같다', () => {
    const N = 폴더들().length;
    expect(N).toBe(10);
    const src = read(LECTURE);
    const 자리 = [
      // 🔀 2026-09-23 낭독 — 「10개의 마이그레이션」·「10개의 이름」을 「마이그레이션 10개가」·「이름 10개」로 고쳤다(번역투).
      /바꾼 횟수\s+(\d+)번/g, /마이그레이션이 (\d+)개/g,
      /마이그레이션 (\d+)개가/g, /같은 (\d+)개를/g, /이름 (\d+)개/g, /(\d+) migrations found/g,
    ];
    let 센것 = 0;
    for (const re of 자리) {
      const 값들 = [...src.matchAll(re)].map((m) => Number(m[1]));
      expect(값들.length, `${re} 가 교안에 없다 — 문장을 바꿨으면 이 목록도 고친다`).toBeGreaterThan(0);
      for (const v of 값들) expect(v, `${re}`).toBe(N);
      센것 += 값들.length;
    }
    expect(센것).toBe(8);
  });
});

// ── 축 ⑫ — 답안 [기초] 5번: 다시 시드하면 `createdAt` 이 달라진다 ──────────
// 답안은 「4번에 적어둔 댓글과 «같은 `id`» 의 `createdAt` 이 다르면 로컬에서 온 것」이라 하고,
// 교안 Step 3 은 「화면의 시각 차이는 시드 시점이 가까우면 거의 없어서 확인 방법으로 못 쓴다」고 한다.
// 두 시드를 «같은 DB» 에 몇 초 사이로 실행해 두 주장을 함께 잰다 — 같은 `id` 는 내용이 같고,
// 밀리초 시각은 다르고, 화면 글자는 같다. 🔑 `id` 로 짝짓는다 — 순서로 짝지으면 서로 다른 댓글을
// 대도 「다르다」가 나와서 답안의 방법이 틀렸어도 초록이 된다(학생 낭독이 잡은 구멍).
describe('축 ⑫ — 다시 시드하면 댓글 `createdAt` 만 달라진다', () => {
  const LAB_PORT = 4138;
  const RUN = P('.p2-38-run');
  beforeAll(() => {
    // 학생 배치(`~/instagram-api/lab/homework1.js` → `../db.js`)와 같은 깊이로 펼친다 — `p2-37` 게이트와 같은 까닭.
    rmSync(RUN, { recursive: true, force: true });
    cpSync(P('lab/p2-37'), RUN, { recursive: true });
    writeFileSync(`${RUN}/homework1.js`,
      readFileSync(`${RUN}/homework1.js`, 'utf8').replaceAll('4001', String(LAB_PORT)));
  });
  afterAll(() => { rmSync(RUN, { recursive: true, force: true }); });

  const 댓글들 = async () => {
    const res = await fetch(`http://localhost:${LAB_PORT}/api/comments?postId=1&limit=2`);
    expect(res.status).toBe(200);
    return (await res.json()).items;
  };

  it('같은 `id` 는 내용이 같고 `createdAt` 은 밀리초까지 달라지며, 화면 글자는 같다', async () => {
    const s = await boot('.p2-38-run/homework1.js',
      { port: LAB_PORT, env: { ...ENV }, ready: '기다리고 있어요' });
    let 앞 = null;
    let 뒤 = null;
    try {
      앞 = await 댓글들();
      seed();
      뒤 = await 댓글들();
    } finally { await s.stop(); }

    expect(앞.length).toBeGreaterThan(0);
    // 시드는 표를 비울 때 번호도 1부터 다시 매긴다 — 같은 `id` 가 같은 댓글이다.
    expect(뒤.map((c) => c.id)).toEqual(앞.map((c) => c.id));
    for (const a of 앞) {
      const b = 뒤.find((c) => c.id === a.id);
      expect(b.content).toBe(a.content);
      expect(a.createdAt).toMatch(/\.\d{3}Z$/);
      expect(b.createdAt, '다시 시드했는데 같은 댓글의 시각이 그대로다').not.toBe(a.createdAt);
    }

    // 화면이 분 단위로 자르는 것 — 뒤 시드 30초 뒤의 «지금» 으로 둘을 같은 함수에 먹인다.
    const { timeAgo } = await import(P('../instagram-react/src/utils/timeAgo.js'));
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(Date.parse(뒤[0].createdAt) + 30_000);
      expect(뒤.map((c) => timeAgo(c.createdAt))).toEqual(앞.map((c) => timeAgo(c.createdAt)));
    } finally { vi.useRealTimers(); }
  }, 60000);
});

// ── 축 ⑬ — `sslmode=require` 주소를 쓰는 서버는 «뜰 때» 가 아니라 «첫 요청 때» 경고를 찍는다 ──
// 교안 Step 3 「이 주소를 쓰는 프로그램은 데이터베이스에 처음 연결하는 순간 이 경고를 한 번 찍어요」 와
// 답안 [기초] 3·4 「첫 요청을 받은 뒤에야 나타나요」 의 근거. 로컬 서버는 SSL 을 안 받아 그 요청은
// 500 으로 끝나지만, 보려는 것은 «언제 찍히나» 다 — 연결에 성공하는 판(임시 SSL 서버)에서도
// 뜬 뒤 첫 요청 때 찍혔다(2026-09-21 실측 · `app.js` · `lab/homework1.js` 둘 다).
describe('축 ⑬ — 서버는 첫 요청 때 SSL 경고를 한 번 찍는다', () => {
  const 포트 = 3482;

  it('뜰 때의 출력에는 없고, 첫 요청 뒤에 한 번 생기며, 두 번째 요청에는 더 안 찍힌다', async () => {
    const s = await boot('app.js', {
      port: 포트,
      cwd: PIN.dir,
      env: { DATABASE_URL: `${GATE_URL}?sslmode=require`, PORT: String(포트), CORS_ORIGIN: OURS },
      ready: `${포트}번 포트에서`,
    });
    const 센다 = () => s.tail().split('SECURITY WARNING').length - 1;
    try {
      expect(s.log).not.toContain('SECURITY WARNING');
      await 물어보기(OURS, { port: 포트 });
      await new Promise((r) => setTimeout(r, 300));
      expect(센다(), '첫 요청 뒤에 경고가 한 번 찍혀야 한다').toBe(1);
      await 물어보기(OURS, { port: 포트 });
      await new Promise((r) => setTimeout(r, 300));
      expect(센다(), '경고는 프로그램마다 한 번뿐이다').toBe(1);
    } finally { await s.stop(); }
  }, 60000);
});

// ── 교안 펜스 읽기 — 축 ⑭·⑮ 가 같이 쓴다 ─────────────────────────────────
/** `표지` 문장 바로 뒤에 오는 첫 펜스의 줄들 — `...` 과 빈 줄은 뺀다. */
function 교안펜스(표지) {
  const src = read(P('../../part2/6-fullstack-join/p2-38-fullstack-deploy-lecture.md'));
  const at = src.indexOf(표지);
  expect(at, `교안에서 「${표지}」 를 못 찾았다`).toBeGreaterThan(-1);
  return src.slice(at).match(/```[a-z]*\n([\s\S]*?)```/)[1]
    .split('\n').filter((l) => l.trim() && l.trim() !== '...');
}

// ── 축 ⑭ — 가드 없는 `prisma.config.js` 는 `.env` 없는 곳에서 에러 «한 줄» 로 멈춘다 ──
// 🔀 2026-09-23 `p2-38` 낭독 — 교안 초판은 이 에러를 두 줄(`Failed to load …` / `Error: ENOENT …`)로
//    실었는데, 학생 낭독이 새로 받은 폴더에서 치니 한 줄이었고 `Error: Error:` 가 두 번 붙었다.
//    오늘 고치기 «전» 판(조건 없이 `process.loadEnvFile()`)을 `.env` 없는 폴더에 놓고 잰다.
describe('축 ⑭ — 가드가 없으면 `.env` 없는 곳에서 Prisma 가 설정 파일부터 못 읽는다', () => {
  const RUN = P('.p2-38-noenv');
  beforeAll(() => {
    rmSync(RUN, { recursive: true, force: true });
    mkdirSync(RUN);
    cpSync(P('prisma'), `${RUN}/prisma`, { recursive: true });
    writeFileSync(`${RUN}/prisma.config.js`, read(P('prisma.config.js')).replace(
      /^if \(process\.env\.DATABASE_URL === undefined\) process\.loadEnvFile\(\);$/m,
      'process.loadEnvFile();'));
    symlinkSync(P('node_modules'), `${RUN}/node_modules`);
  });
  afterAll(() => { rmSync(RUN, { recursive: true, force: true }); });

  it('에러는 한 줄이고, 교안 펜스와 폴더 경로만 다르다', () => {
    expect(read(`${RUN}/prisma.config.js`)).toMatch(/^process\.loadEnvFile\(\);$/m);
    const env = { ...process.env };
    delete env.DATABASE_URL;
    const run = spawnSync('npx', ['prisma', 'migrate', 'status'], { cwd: RUN, encoding: 'utf8', env });
    expect(run.status).not.toBe(0);
    const 에러 = `${run.stdout}${run.stderr}`.split('\n').map((l) => l.trim()).filter((l) => l.includes('ENOENT'));
    expect(에러, '에러가 한 줄이 아니다').toHaveLength(1);
    const 교안 = 교안펜스('파일이 없으면 이 함수는 조용히 넘어가지 않고 에러를 던져요.');
    expect(교안).toHaveLength(1);
    const 경로빼기 = (l) => l.replace(/"[^"]+"/, '"<DIR>"');
    expect(경로빼기(교안[0])).toBe(경로빼기(에러[0]));
  }, 120000);
});

// ── 축 ⑮ — `.env` 를 저장하면 `--watch` 가 세 줄을 찍는다 ────────────────────
// 🔀 2026-09-23 `p2-38` 낭독 — 교안 초판은 시작 줄 하나만 실었다. 실제로는 `Change detected in '…/.env'`
//    · `Restarting 'app.js'` · 시작 줄 세 줄이고, 터미널(TTY)에서는 그 앞에 화면을 지우는 `\x1bc` 가
//    나가 창 2 에 이 세 줄만 남는다(pty 실측 · 게이트는 파이프라 지우기 문자가 안 나온다).
describe('축 ⑮ — `.env` 를 저장하면 창 2 에 세 줄이 찍힌다', () => {
  const RUN = P('.p2-38-watch');
  const 포트 = 3483;
  beforeAll(() => {
    rmSync(RUN, { recursive: true, force: true });
    mkdirSync(RUN);
    for (const f of ['app.js', 'db.js', 'errors.js', 'package.json']) cpSync(P(f), `${RUN}/${f}`);
    for (const d of ['routes', 'services', 'middlewares', 'schemas', 'data']) {
      if (existsSync(P(d))) cpSync(P(d), `${RUN}/${d}`, { recursive: true });
    }
    symlinkSync(P('node_modules'), `${RUN}/node_modules`);
    writeFileSync(`${RUN}/.env`, `DATABASE_URL="${GATE_URL}"\nPORT=${포트}\nCORS_ORIGIN=${OURS}\n`);
  });
  afterAll(() => { rmSync(RUN, { recursive: true, force: true }); });

  it('Change detected · Restarting · 시작 줄 — 교안 펜스와 경로·포트만 다르다', async () => {
    const env = { ...process.env };
    for (const k of ['NODE_ENV', 'DATABASE_URL', 'PORT', 'CORS_ORIGIN']) delete env[k];
    const child = spawn(process.execPath, ['--watch', '--env-file=.env', 'app.js'], { cwd: RUN, env });
    let out = '';
    child.stdout.on('data', (b) => { out += b; });
    child.stderr.on('data', (b) => { out += b; });
    const 기다리기 = async (조건, ms = 15000) => {
      const t = Date.now();
      while (!조건()) {
        if (Date.now() - t > ms) throw new Error(`기다리다 끝남:\n${out}`);
        await new Promise((r) => setTimeout(r, 100));
      }
    };
    try {
      await 기다리기(() => out.includes('기다리고 있어요'));
      const 앞 = out.length;
      writeFileSync(`${RUN}/.env`, `${read(`${RUN}/.env`)}# 바꿈\n`);
      await 기다리기(() => out.slice(앞).includes('기다리고 있어요'));
      const 줄들 = out.slice(앞).split('\n').map((l) => l.trim()).filter(Boolean);
      const 교안 = 교안펜스('서버를 다시 띄우면서 세 줄을 찍어요.');
      const 고르기 = (l) => l.replace(/'[^']*\.env'/, "'<ENV>'").replace(/\d+번 포트/, 'N번 포트');
      expect(줄들.map(고르기)).toEqual(교안.map(고르기));
      expect(교안[0]).toBe("Change detected in '/Users/hong/instagram-api/.env'");
      expect(교안[2]).toBe('서버가 3000번 포트에서 기다리고 있어요.');
    } finally { child.kill('SIGTERM'); }
  }, 60000);
});
