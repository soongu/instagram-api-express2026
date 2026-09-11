// p2-31 「길을 계층으로 가른다 — Router → Service → Prisma」 게이트
//
// 🚨 진짜 instagram DB 를 안 건드린다 — 전용 DB(p231_gate)를 p2-30 종료 상태로 세워서 쓴다.
// 🚨 이 회차는 «새 기능이 0» 이라, 가장 중요한 축이 「바깥에서 보면 아무것도 안 달라졌다」다.
//    그래서 p2-30 이 잠근 계약을 이 회차 최종판에 «그대로» 다시 물린다.
// 🚨 교안이 「이렇게 하면 이렇게 된다」고 주장하는 중간 상태는 snapshots/p2-31/ 로 얼려
//    실제로 띄운다. 산문으로만 적힌 주장은 어느 게이트도 못 보기 때문이다.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import pg from 'pg';
import { boot } from './helpers/boot.js';
import { setupP229 } from '../sql/p2-29/setup.mjs';

const ROOT = new URL('../', import.meta.url);
const P = (rel) => new URL(rel, ROOT).pathname;
const GATE_URL = 'postgresql://postgres:postgres@localhost:5432/p231_gate';
const ADMIN = { host: 'localhost', port: 5432, database: 'postgres', user: 'postgres', password: 'postgres' };
const ENV = { DATABASE_URL: GATE_URL };
const JSON_HEADERS = { 'Content-Type': 'application/json' };

const LECTURE = P('../../part2/5-db-prisma/p2-31-layers-lecture.md');
const ANSWERS = P('../../part2/5-db-prisma/p2-31-layers-answers.md');
const read = (p) => readFileSync(p, 'utf8');
const exists = (p) => { try { readFileSync(p); return true; } catch { return false; } };
const blocksOf = (path, lang) =>
  [...read(path).matchAll(new RegExp('```' + lang + '\\n([\\s\\S]*?)```', 'g'))].map((m) => m[1].trimEnd());

let db = null;
let server = null;

/** lab 파일을 «한 단 깊은» 경로로 고친 사본 — 파일 자체는 학생 표기 그대로 둔다. */
function labCopy(rel) {
  const local = rel.replace(/\.js$/, '.local.js');
  writeFileSync(P(local), read(P(rel))
    .replace(/from '\.\.\/(db|services|routes)\//g, "from '../../$1/")
    .replace(/from '\.\.\/db\.js'/g, "from '../../db.js'"));
  return local;
}
const dropCopy = (local) => { try { unlinkSync(P(local)); } catch { /* 이미 없음 */ } };

const seed = (file = 'seed.js', args = []) =>
  execFileSync(process.execPath, [P(file), ...args], { cwd: P('.'), encoding: 'utf8', env: { ...process.env, ...ENV } });

beforeAll(async () => {
  const admin = new pg.Client(ADMIN);
  await admin.connect();
  await admin.query('DROP DATABASE IF EXISTS p231_gate');
  await admin.query('CREATE DATABASE p231_gate');
  await admin.end();
  db = new pg.Client({ ...ADMIN, database: 'p231_gate' });
  await db.connect();
  await setupP229(db);
  await db.query('ALTER TABLE posts ADD COLUMN IF NOT EXISTS created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP');
  seed();   // p2-30 종료 상태 — 게시물 1~5 · 댓글 1~9
}, 60000);

afterAll(async () => {
  if (server) { await server.stop(); server = null; }
  await db?.end();
  const admin = new pg.Client(ADMIN);
  await admin.connect();
  await admin.query(
    "select pg_terminate_backend(pid) from pg_stat_activity where datname = 'p231_gate' and pid <> pg_backend_pid()");
  await admin.query('DROP DATABASE IF EXISTS p231_gate');
  await admin.end();
});

async function bootApp(file, port) {
  if (server) { await server.stop(); server = null; await new Promise((r) => setTimeout(r, 150)); }
  server = await boot(file, { port, env: { ...ENV, PORT: String(port) }, ready: `${port}번 포트에서` });
  return server;
}

/** 게시물 주소 다섯이 계약대로 답하는가 — 어느 시점 판에 물려도 같은 답이 나와야 한다. */
async function contractHolds(base, { notFoundOn404 = true } = {}) {
  const out = {};
  out.list = (await (await fetch(`${base}/api/posts`)).json()).length;
  out.one = (await fetch(`${base}/api/posts/1`)).status;
  out.missing = (await fetch(`${base}/api/posts/999`)).status;
  out.letters = (await fetch(`${base}/api/posts/abc`)).status;
  out.patchMissing = (await fetch(`${base}/api/posts/999`, {
    method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ content: 'x' }) })).status;
  out.deleteMissing = (await fetch(`${base}/api/posts/999`, { method: 'DELETE' })).status;
  out.filtered = (await (await fetch(`${base}/api/posts?username=minji`)).json()).length;
  out.limited = (await (await fetch(`${base}/api/posts?limit=2`)).json()).length;
  out.thinBody = (await fetch(`${base}/api/posts`, {
    method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ content: 'x' }) })).status;
  out.noRoute = (await fetch(`${base}/api/nope`)).status;
  if (notFoundOn404) out.missingBody = await (await fetch(`${base}/api/posts/999`)).json();
  return out;
}

const CONTRACT = {
  list: 5, one: 200, missing: 404, letters: 404, patchMissing: 404, deleteMissing: 404,
  filtered: 2, limited: 2, thinBody: 400, noRoute: 404,
  missingBody: { message: '그런 게시물은 없어요' },
};

// ── 착수 상태 ───────────────────────────────────────────────────────────────
describe('착수 상태 — 「지난 시간 그대로」에서 출발한다', () => {
  it('p2-30 을 끝낸 학생의 표 둘이 그대로 서 있다', async () => {
    const r = await db.query('select (select count(*)::int from posts) p, (select count(*)::int from comments) c');
    expect(r.rows[0]).toEqual({ p: 5, c: 9 });
  });

  it('🔴 시작하는 `app.js` 가 112줄이고, 한 파일이 주소 여섯을 들고 있다', () => {
    const before = read(P('snapshots/p2-30.final.app.js'));
    expect(before.trimEnd().split('\n')).toHaveLength(112);
    expect(before.match(/^app\.(?:get|post|patch|delete)\(/gm)).toHaveLength(6);
    expect(before.match(/^app\.(?:get|post|patch|delete)\('\/api\/posts/gm)).toHaveLength(5);
  });

  it('🔴 되풀이되는 검사가 «세 곳» 이고, Prisma 이름이 여섯 번 나온다', () => {
    const before = read(P('snapshots/p2-30.final.app.js'));
    expect(before.match(/Number\(req\.params\.id\)/g)).toHaveLength(3);
    expect(before.match(/Number\.isInteger/g)).toHaveLength(3);
    expect(before.match(/prisma/gi)).toHaveLength(6);
    expect(before.match(/P2025/g)).toHaveLength(1);
  });

  it('시작 판도 계약을 지킨다 — 오늘 바꾸는 것은 «생김새» 이지 «답» 이 아니다', async () => {
    await bootApp('snapshots/p2-30.final.app.js', 3500);
    expect(await contractHolds(server.base)).toEqual(CONTRACT);
  });
});

// ── Step 2~6 — 중간 상태를 실제로 띄운다 ────────────────────────────────────
describe('중간 상태 — 얼려둔 판이 교안이 말하는 대로 «실제로» 돈다', () => {
  it('Step 2 — 주소만 라우터로 옮긴 판이 계약을 그대로 지킨다', async () => {
    await bootApp('snapshots/p2-31/step2/app.js', 3501);
    expect(await contractHolds(server.base)).toEqual(CONTRACT);
  });

  it('Step 3 — 검사를 미들웨어로 뺀 판도 계약을 그대로 지킨다', async () => {
    await bootApp('snapshots/p2-31/step3/app.js', 3502);
    expect(await contractHolds(server.base)).toEqual(CONTRACT);
  });

  it('Step 4 — 읽기 둘만 서비스로 간 판도 계약을 그대로 지킨다', async () => {
    await bootApp('snapshots/p2-31/step4/app.js', 3503);
    expect(await contractHolds(server.base)).toEqual(CONTRACT);
  });

  it('Step 5 — 다섯 다 서비스로 갔는데 `app.js` 의 `P2025` 갈래가 «아직 일하고 있다»', async () => {
    await bootApp('snapshots/p2-31/step5/app.js', 3504);
    expect(await contractHolds(server.base)).toEqual(CONTRACT);
    expect(read(P('snapshots/p2-31/step5/app.js'))).toContain("err.code === 'P2025'");
    expect(read(P('snapshots/p2-31/step5/services/postService.js'))).not.toContain('P2025');
  });

  it('🔴 Step 5 에서 그 갈래만 지우면 고치기·지우기가 «500 이 된다»', async () => {
    // 이 회차의 몸통 — 그 갈래가 일하고 있었다는 증거다. 서비스가 받아주기 «전» 에
    // 지우면 Prisma 가 던진 것을 아무도 안 받아 500 으로 나간다.
    await bootApp('snapshots/p2-31/step5-broken/app.js', 3505);
    const out = await contractHolds(server.base, { notFoundOn404: false });
    expect(out.patchMissing).toBe(500);
    expect(out.deleteMissing).toBe(500);
    expect(out.missing).toBe(404);   // 읽기는 `null` 이라 멀쩡하다 — 갈리는 곳이 둘뿐이다
    await new Promise((r) => setTimeout(r, 200));
    expect(server.tail()).toContain('P2025');
  });
});

// ── 최종판 ──────────────────────────────────────────────────────────────────
describe('최종판 — 층이 갈렸는데 바깥에서 보면 아무것도 안 달라졌다', () => {
  it('🔴 계약 열 가지가 시작 판과 «글자 그대로» 같다', async () => {
    await bootApp('app.js', 3506);
    expect(await contractHolds(server.base)).toEqual(CONTRACT);
  });

  it('🔴 `app.js` 에 Prisma 도 `P2025` 도 한 번도 안 나온다', () => {
    const app = read(P('app.js'));
    expect(app.match(/prisma/gi)).toBeNull();
    expect(app.match(/P2025/g)).toBeNull();
    expect(app.trimEnd().split('\n')).toHaveLength(35);
  });

  it('🔴 서비스는 `req` 도 `res` 도 모른다', () => {
    const service = read(P('services/postService.js'));
    expect(service.match(/\bres\b/g)).toBeNull();
    expect(service.match(/\breq\b/g)).toBeNull();
    expect(service.match(/\bstatus\b/g)).toBeNull();
  });

  it('🔴 라우터는 Prisma 를 모른다 — 그 이름이 한 번도 안 나온다', () => {
    expect(read(P('routes/posts.js')).match(/prisma/gi)).toBeNull();
  });

  it('🔴 되풀이되던 검사가 «한 곳» 으로 모였다', () => {
    const router = read(P('routes/posts.js'));
    expect(router.match(/Number\(req\.params\.id\)/g)).toHaveLength(1);
    expect(router.match(/Number\.isInteger/g)).toHaveLength(1);
    expect(router.match(/parseId/g)).toHaveLength(4);   // 정의 1 + 쓰는 자리 3
  });

  it('🔴 파일을 나눴더니 줄 수는 «늘었다» — 112 → 151', () => {
    const n = (f) => read(P(f)).trimEnd().split('\n').length;
    expect(n('app.js') + n('routes/posts.js') + n('services/postService.js')).toBe(151);
    expect(n('snapshots/p2-30.final.app.js')).toBe(112);
  });

  it('요청 파일을 한 글자도 안 고쳤다 — p2-30 이 쓴 그대로다', () => {
    const current = read(P('requests/posts.http'));
    const atP230 = execFileSync('git', ['show', 'HEAD:requests/posts.http'], { cwd: P('.'), encoding: 'utf8' });
    expect(current).toBe(atP230);
  });

  it('🔴 댓글이 달린 게시물을 지우면 «아직» 500 이다 — p2-33 이월 부채 그대로', async () => {
    await bootApp('app.js', 3507);
    const res = await fetch(`${server.base}/api/posts/1`, { method: 'DELETE' });
    expect(res.status).toBe(500);
    await new Promise((r) => setTimeout(r, 200));
    expect(server.tail()).toContain('P2003');
  });

  it('🔴 서비스는 서버 없이도 쓸 수 있다 — `res` 를 안 쓴 값이 이것이다', () => {
    const local = labCopy('lab/p2-31/homework2.js');
    try {
      const out = execFileSync(process.execPath, [P(local)],
        { cwd: P('.'), encoding: 'utf8', env: { ...process.env, ...ENV } });
      expect(out).toContain('게시물을 만들었어요');
      expect(out).toContain('게시물을 다시 지웠어요');
    } finally { dropCopy(local); }
  });

  it('🔴 `$disconnect()` 를 빼면 «다 찍고도» 10초를 더 앉아 있는다', () => {
    // 🚨 처음에 이걸 「바로 끝난다」고 적었다가 게이트 타임아웃(5s)에 걸려 규명했다.
    //    찍히는 것은 0.1초 안에 다 찍히고, 그 뒤 Prisma 풀이 스스로 닫힐 때까지
    //    프로세스가 안 죽는다 — 세 번 재서 10.14 · 10.14 · 10.14 로 «흔들리지도» 않는다.
    //    학생 화면에서는 「끝난 것 같은데 프롬프트가 안 돌아온다」로 보인다.
    const local = labCopy('lab/p2-31/homework2.js');
    const naive = local.replace('.local.js', '.naive.local.js');
    writeFileSync(P(naive), read(P(local)).replace("\nawait prisma.$disconnect();\n", '\n'));
    try {
      const run = (f) => {
        const t = Date.now();
        execFileSync(process.execPath, [P(f)], { cwd: P('.'), encoding: 'utf8', env: { ...process.env, ...ENV } });
        return Date.now() - t;
      };
      expect(run(naive)).toBeGreaterThan(5000);
      expect(run(local)).toBeLessThan(3000);
    } finally { dropCopy(local); dropCopy(naive); }
  }, 40000);
});

// ── 교안·답안 (집필되면 켜진다) ─────────────────────────────────────────────
describe.skipIf(!exists(LECTURE))('인용이 코드베이스와 byte 동일한가', () => {
  it('자리표시자', () => { expect(true).toBe(true); });
});
