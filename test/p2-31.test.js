// p2-31 「길을 계층으로 가른다 — Router → Service → Prisma」 게이트
//
// 🚨 진짜 instagram DB 를 안 건드린다 — 전용 DB(p231_gate)를 p2-30 종료 상태로 세워서 쓴다.
// 🚨 이 회차는 «새 기능이 0» 이라, 가장 중요한 축이 「바깥에서 보면 아무것도 안 달라졌다」다.
//    그래서 p2-30 이 잠근 계약을 이 회차 최종판에 «그대로» 다시 물린다.
// 🚨 교안이 「이렇게 하면 이렇게 된다」고 주장하는 중간 상태는 snapshots/p2-31/ 로 얼려
//    실제로 띄운다. 산문으로만 적힌 주장은 어느 게이트도 못 보기 때문이다.
// 🚨 p2-33 이 정규화(posts.username → author_id)를 하면서 이 회차가 «자라는 파일»로 보던
//    것들을 snapshots/p2-32-final/ 로 얼렸다. 안 얼리면 이 회차 축들이 거짓 FAIL 이 된다 —
//    캐논 「앞 회차 테스트가 자라는 파일을 live 로 보면 다음 회차 부채를 가린다」.
//    🔑 이번엔 «계약 자체»가 바뀌었다(POST 몸통이 username → authorId). 그래서 p2-31 처럼
//       동작 검사를 live 로 남겨둘 수 없다 — 남기면 옛 계약을 영원히 요구하게 된다.
//       새 계약이 안 깨졌다는 증거는 p2-33 자기 테스트가 «12요청 대조»로 따로 세운다.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import pg from 'pg';
import { boot } from './helpers/boot.js';
import { sendAll, changedFields } from './helpers/send-http.js';
import { setupP229Bookstore } from '../sql/p2-29/setup.mjs';
import { setupP230 } from '../sql/p2-30/setup.mjs';

const ROOT = new URL('../', import.meta.url);
const P = (rel) => new URL(rel, ROOT).pathname;
const GATE_URL = 'postgresql://postgres:postgres@localhost:5432/p231_gate';
const ADMIN = { host: 'localhost', port: 5432, database: 'postgres', user: 'postgres', password: 'postgres' };
// 🚨 서점 실습도 «전용 DB» 에서 띄운다. 5433 의 진짜 `bookstore` 를 쓰면 학생이
//    손으로 따라가던 상태를 게이트가 갈아엎는다(이 트랙이 instagram 에서 겪은 그것).
const BOOK_GATE_URL = 'postgresql://postgres:postgres@localhost:5433/p231_book_gate';
const BOOK_ADMIN = { ...ADMIN, port: 5433 };
const ENV = { DATABASE_URL: GATE_URL, BOOKSTORE_URL: BOOK_GATE_URL };
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
    .replace(/from '\.\.\/(db|services|routes)\//g, "from '../../snapshots/p2-32-final/$1/")
    .replace(/from '\.\.\/db\.js'/g, "from '../../snapshots/p2-32-final/db.js'")
    // 🚨 회차마다 게이트 포트를 가른다 — vitest 가 파일을 병렬로 돌려 4001 을 공유하면 부딪힌다.
    .replaceAll('4001', '4031'));
  return local;
}
const dropCopy = (local) => { try { unlinkSync(P(local)); } catch { /* 이미 없음 */ } };

const seed = (file = 'snapshots/p2-32-final/seed.js', args = []) =>
  execFileSync(process.execPath, [P(file), ...args], { cwd: P('.'), encoding: 'utf8', env: { ...process.env, ...ENV } });

beforeAll(async () => {
  const admin = new pg.Client(ADMIN);
  await admin.connect();
  await admin.query('DROP DATABASE IF EXISTS p231_gate');
  await admin.query('CREATE DATABASE p231_gate');
  await admin.end();
  db = new pg.Client({ ...ADMIN, database: 'p231_gate' });
  await db.connect();
  // 🔀 2026-09-18 audit — 착수 상태를 p2-30 판(과제 [기초]의 댓글 updated_at 포함)으로, 시드는 p2-30 클라이언트로.
  //    gitignore 된 생성물이라 매번 만든다(output 이 회차 폴더라 수업 클라이언트를 안 덮는다).
  execFileSync(P('node_modules/.bin/prisma'), ['generate', '--config', 'snapshots/p2-30/generate.config.js'],
    { cwd: P('.'), encoding: 'utf8' });
  await setupP230(db);
  seed();   // p2-30 종료 상태 — 게시물 1~5 · 댓글 1~9

  const bookAdmin = new pg.Client(BOOK_ADMIN);
  await bookAdmin.connect();
  await bookAdmin.query('DROP DATABASE IF EXISTS p231_book_gate');
  await bookAdmin.query('CREATE DATABASE p231_book_gate');
  await bookAdmin.end();
  const book = new pg.Client({ ...BOOK_ADMIN, database: 'p231_book_gate' });
  await book.connect();
  await setupP229Bookstore(book);
  // p2-29 직접 해보기가 더한 칸 — 이게 없으면 서점 라우트가 전부 500 이다
  await book.query('ALTER TABLE books ADD COLUMN IF NOT EXISTS is_sold_out BOOLEAN NOT NULL DEFAULT false');
  await book.end();
}, 90000);

afterAll(async () => {
  if (server) { await server.stop(); server = null; }
  await db?.end();
  const admin = new pg.Client(ADMIN);
  await admin.connect();
  await admin.query(
    "select pg_terminate_backend(pid) from pg_stat_activity where datname = 'p231_gate' and pid <> pg_backend_pid()");
  await admin.query('DROP DATABASE IF EXISTS p231_gate');
  await admin.end();
  const bookAdmin = new pg.Client(BOOK_ADMIN);
  await bookAdmin.connect();
  await bookAdmin.query(
    "select pg_terminate_backend(pid) from pg_stat_activity where datname = 'p231_book_gate' and pid <> pg_backend_pid()");
  await bookAdmin.query('DROP DATABASE IF EXISTS p231_book_gate');
  await bookAdmin.end();
});

/** 스냅숏이 부르는 `../db.js` 는 live 클라이언트다 — p2-33 정규화 뒤로는 이 회차 DB 를 모른다. */
function frozenDb(rel) {
  const src = read(P(rel));
  if (!src.includes("from '../db.js'")) return rel;
  const local = rel.replace(/\.js$/, '.frozen.js');
  writeFileSync(P(local), src.replace("from '../db.js'", "from './p2-32-final/db.js'"));
  return local;
}

async function bootApp(file, port) {
  file = frozenDb(file);
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
// 🚨 이 회차가 «본» 파일 셋(app.js·routes/posts.js·services/postService.js)은
//    `p2-32` 가 live 로 계속 고친다(HttpError·Zod). 그래서 「p2-31 최종판」은
//    p2-30 이 그랬던 것과 같은 이유로 `snapshots/p2-31.final.*.js` 로 얼려서 본다 —
//    안 얼리면 이 축 넷이 거짓 FAIL 이 된다.
describe('최종판 — 층이 갈렸는데 바깥에서 보면 아무것도 안 달라졌다', () => {
  it('🔴 계약 열 가지가 시작 판과 «글자 그대로» 같다', async () => {
    await bootApp('snapshots/p2-31-final/app.js', 3506);
    expect(await contractHolds(server.base)).toEqual(CONTRACT);
  });

  it('🔴 요청 12개를 나누기 전·뒤 서버에 보내면 달라지는 값은 새 게시물의 번호·작성 시각·고친 시각 셋뿐이다', async () => {
    // 교안 「시작하기 전에」의 비교 기준 — 「달라지는 값은 딱 셋 … 그 세 값 말고는 글자 하나까지 같아야 해요」.
    // 🔀 2026-09-19 audit — 게시물에 `updatedAt` 이 생겨 고치기 요청이 그 값을 바꾼다. 둘이던 것이 셋이 됐다.
    // 요청 파일은 이 회차가 안 고친 그것(`code/p2-30` 가지)을 보낸다 — 위 「한 글자도 안 고쳤다」 축과 같은 출처다.
    const http = execFileSync('git', ['show', 'code/p2-30:requests/posts.http'], { cwd: P('.'), encoding: 'utf8' });
    await bootApp('snapshots/p2-30.final.app.js', 3508);
    const before = await sendAll(http, server.base);
    await bootApp('snapshots/p2-31-final/app.js', 3509);
    const after = await sendAll(http, server.base);
    expect(before).toHaveLength(12);
    expect(changedFields(before, after)).toEqual([
      '게시물 올리기: id,createdAt,updatedAt',
      '방금 올린 게시물의 하트 수 고치기: id,createdAt,updatedAt',
      '방금 올린 게시물 지우기: id,createdAt,updatedAt',
    ]);
    // 고친 시각은 번호·작성 시각과 «따로» 움직인다 — 고치기 응답에서 작성 시각과 갈린다
    const patched = after.find((r) => r.title === '방금 올린 게시물의 하트 수 고치기');
    expect(patched.body.updatedAt).not.toBe(patched.body.createdAt);
    expect(read(LECTURE)).toContain('번호(`id`), 작성 시각(`createdAt`), 고친 시각(`updatedAt`)');
    expect(read(LECTURE)).toContain('**그 세 값 말고는 글자 하나까지 같아야 해요.**');
  });

  it('🔴 시드를 다시 넣으면 게시물 5개의 두 시각만 «모두» 바뀐다 — 처음 봐둔 답과 그 시각을 빼고 비교하는 이유', async () => {
    // 교안 「시작하기 전에」 — 「시드는 실행할 때마다 게시물 5개의 두 시각을 새로 계산해서 넣으니까, 그 뒤로는 처음 봐둔 답과
    // 비교할 때 그 시각들도 빼고 보세요」. 두 낭독이 함께 잡은 모순(2026-09-19)을 잠근다 — 답을 «새로» 받게 하면
    // 라우트가 망가진 채 끊긴 경우 망가진 답이 기준이 된다(재낭독이 잡았다). 그래서 «시각만» 달라지는지까지 본다.
    await bootApp('snapshots/p2-31-final/app.js', 3510);
    const before = await (await fetch(`${server.base}/api/posts`)).json();
    await new Promise((r) => setTimeout(r, 20));   // 같은 밀리초에 다시 넣지 않게
    seed();
    const after = await (await fetch(`${server.base}/api/posts`)).json();
    expect(after.map((p) => p.id)).toEqual(before.map((p) => p.id));
    after.forEach((p, i) => {
      expect(p.createdAt, `${p.id}번`).not.toBe(before[i].createdAt);
      expect(p.updatedAt, `${p.id}번`).not.toBe(before[i].updatedAt);
    });
    const strip = ({ createdAt, updatedAt, ...rest }) => rest;
    expect(after.map(strip)).toEqual(before.map(strip));
    expect(read(LECTURE)).toContain('게시물 5개의 두 시각을 새로 계산해서 넣으니까, 그 뒤로는 처음 봐둔 답과 비교할 때 그 시각들도 빼고 보세요.');
  });

  it('🔴 `app.js` 에 Prisma 도 `P2025` 도 한 번도 안 나온다', () => {
    const app = read(P('snapshots/p2-31-final/app.js'));
    expect(app.match(/prisma/gi)).toBeNull();
    expect(app.match(/P2025/g)).toBeNull();
    expect(app.trimEnd().split('\n')).toHaveLength(35);
  });

  it('🔴 서비스는 `req` 도 `res` 도 모른다', () => {
    const service = read(P('snapshots/p2-31-final/services/postService.js'));
    expect(service.match(/\bres\b/g)).toBeNull();
    expect(service.match(/\breq\b/g)).toBeNull();
    expect(service.match(/\bstatus\b/g)).toBeNull();
  });

  it('🔴 라우터는 Prisma 를 모른다 — 그 이름이 한 번도 안 나온다', () => {
    expect(read(P('snapshots/p2-31-final/routes/posts.js')).match(/prisma/gi)).toBeNull();
  });

  it('🔴 되풀이되던 검사가 «한 곳» 으로 모였다', () => {
    const router = read(P('snapshots/p2-31-final/routes/posts.js'));
    expect(router.match(/Number\(req\.params\.id\)/g)).toHaveLength(1);
    expect(router.match(/Number\.isInteger/g)).toHaveLength(1);
    expect(router.match(/parseId/g)).toHaveLength(4);   // 정의 1 + 쓰는 자리 3
  });

  it('🔴 파일을 나눴더니 줄 수는 «늘었다» — 112 → 151', () => {
    const n = (f) => read(P(f)).trimEnd().split('\n').length;
    expect(n('snapshots/p2-31-final/app.js') + n('snapshots/p2-31-final/routes/posts.js')
      + n('snapshots/p2-31-final/services/postService.js')).toBe(151);
    expect(n('snapshots/p2-30.final.app.js')).toBe(112);
  });

  it('🔴 요청 파일을 한 글자도 안 고쳤다 — `code/p2-30` 가지가 들고 있는 그대로다', () => {
    // 🚨 `HEAD` 와 대조하면 이 회차가 커밋할 때마다 기준이 따라 움직여 늘 통과한다.
    //    비교 대상은 «지난 회차가 심어둔 가지» 여야 한다.
    // 🚨 live 를 보면 안 된다 — p2-33 이 POST 몸통을 authorId 로 바꾸면서 이 파일을 고친다.
    //    이 축이 묻는 것은 «p2-31 이 고쳤나» 이므로 가지 둘을 맞대야 한다.
    const current = execFileSync('git', ['show', 'code/p2-31:requests/posts.http'], { cwd: P('.'), encoding: 'utf8' });
    const atP230 = execFileSync('git', ['show', 'code/p2-30:requests/posts.http'], { cwd: P('.'), encoding: 'utf8' });
    expect(current).toBe(atP230);
    expect(current.match(/^### /gm)).toHaveLength(12);
  });

  it('🔴 댓글이 달린 게시물을 지우면 «아직» 500 이다 — p2-33 이월 부채 그대로', async () => {
    await bootApp('snapshots/p2-31-final/app.js', 3507);
    const res = await fetch(`${server.base}/api/posts/1`, { method: 'DELETE' });
    expect(res.status).toBe(500);
    await new Promise((r) => setTimeout(r, 200));
    expect(server.tail()).toContain('P2003');
  });

  /** 답안 과제 2 의 기대 출력 — 「`node --env-file=.env lab/homework2.js`로 실행하면 이렇게 나와요.」 바로 뒤 펜스. */
  const homework2Fence = () => {
    const doc = read(ANSWERS);
    const at = doc.indexOf('`node --env-file=.env lab/homework2.js`로 실행하면 이렇게 나와요.');
    expect(at, '답안에 과제 2 실행 문장이 없습니다').toBeGreaterThan(-1);
    return doc.slice(at).match(/```bash\n([\s\S]*?)```/)[1].trimEnd();
  };
  const runHomework2 = () => {
    const local = labCopy('lab/p2-31/homework2.js');
    try {
      return execFileSync(process.execPath, [P(local)],
        { cwd: P('.'), encoding: 'utf8', env: { ...process.env, ...ENV } }).trimEnd();
    } finally { dropCopy(local); }
  };

  it('🔴 서비스는 서버 없이도 쓸 수 있다 — 시드를 막 넣은 판에서 답안 출력이 «한 글자도 안 다르게» 나온다', () => {
    // 🚨 예전 판은 `toContain('게시물을 만들었어요')` 만 봐서 `6번` 도, 최신순 목록 세 줄도 아무도 안 봤다
    //    (2026-09-23 게이트 Q1 — replay 는 이 블록을 🈳 DB 로 여기 넘긴다). 답안이 그 번호의 전제를 직접
    //    적어둔다 — 「위 출력은 시드를 막 넣은 데이터베이스에서 실행해서 6번이 나왔는데」. 이 파일의 앞 축들이
    //    요청 12개를 보내며 번호를 먹었으니 그 전제를 여기서 다시 세운다.
    // 🔑 펜스 첫 줄을 글자로도 적는다 — replay 는 «테스트 파일에 출력 글자가 한 조각이라도 있는가» 로
    //    🈳 DB 와 DB-NONE 을 가르므로, 펜스를 답안에서 읽어 오기만 하면 가장 센 대조가 DB-NONE 으로 보인다.
    const fence = homework2Fence();
    expect(fence.split('\n')[0]).toBe('6번 게시물을 만들었어요.');
    seed();
    expect(runHomework2()).toBe(fence);
    expect(read(ANSWERS)).toContain('위 출력은 시드를 막 넣은 데이터베이스에서 실행해서 6번이 나왔는데');
  });

  it('🔴 요청 12개를 한 번 보낸 뒤에는 번호만 «하나» 커진다 — 「여러분 화면의 번호는 이보다 클 거예요」', async () => {
    // 답안 — 「오늘 요청 12개를 보낼 때마다 게시물을 하나씩 올렸다 지웠는데, 새로 만들 때마다 다음 번호가
    //    붙고 지운 번호는 다시 쓰지 않거든요」. 학생이 수업에서 한 일(요청 파일을 위에서부터)을 한 번 되풀이한다.
    //    🔑 번호 말고는 목록·문구가 한 글자도 안 달라야 한다 — 올렸다 지운 게시물이 목록에 안 남는다는 뜻이다.
    seed();
    await bootApp('snapshots/p2-31-final/app.js', 3511);
    const http = execFileSync('git', ['show', 'code/p2-31:requests/posts.http'], { cwd: P('.'), encoding: 'utf8' });
    const sent = await sendAll(http, server.base);
    await server.stop(); server = null;
    expect(sent.filter((r) => r.title === '게시물 올리기').map((r) => r.status)).toEqual([201]);
    const fence = homework2Fence();
    expect(fence.match(/^6(번 | )/gm)).toHaveLength(3);
    expect(runHomework2()).toBe(fence.replace(/^6(번 | )/gm, '7$1'));
    expect(read(ANSWERS)).toContain('여러분 화면의 번호는 이보다 클 거예요.');
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

// ── 직접 해보기 · 과제 — lab 도 같은 세 층으로 간다 ─────────────────────────
describe('lab — 서점과 댓글도 같은 모양으로 선다', () => {
  /** 서점 서버를 띄우고 여덟 가지를 재는다. 어느 시점 판에 물려도 같은 답이어야 한다. */
  async function bookContract(base) {
    return {
      list: (await (await fetch(`${base}/api/books`)).json()).length,
      one: (await fetch(`${base}/api/books/1`)).status,
      missing: (await fetch(`${base}/api/books/999`)).status,
      letters: (await fetch(`${base}/api/books/abc`)).status,
      deleteMissing: (await fetch(`${base}/api/books/999`, { method: 'DELETE' })).status,
      deleteLetters: (await fetch(`${base}/api/books/abc`, { method: 'DELETE' })).status,
      byAuthor: (await (await fetch(`${base}/api/books?author=${encodeURIComponent('로버트 마틴')}`)).json()).length,
      noRoute: (await fetch(`${base}/api/nope`)).status,
    };
  }
  const BOOKS = { list: 6, one: 200, missing: 404, letters: 404, deleteMissing: 404,
                  deleteLetters: 404, byAuthor: 2, noRoute: 404 };

  it('직접 해보기 1 — 주소만 라우터로 옮긴 서점이 여덟을 지킨다', async () => {
    await bootApp('snapshots/p2-31/lab1/practice1.js', 4000);
    expect(await bookContract(server.base)).toEqual(BOOKS);
  });

  it('직접 해보기 2 — 검사를 미들웨어로 뺀 서점도 여덟을 지킨다', async () => {
    await bootApp('snapshots/p2-31/lab2/practice1.js', 4000);
    expect(await bookContract(server.base)).toEqual(BOOKS);
  });

  it('직접 해보기 3 — 서비스까지 간 서점도 여덟을 지키고, `P2025` 가 practice1 에서 사라진다', async () => {
    const local = labCopy('lab/p2-31/practice1.js');
    try {
      await bootApp(local, 4000);
      expect(await bookContract(server.base)).toEqual(BOOKS);
    } finally { if (server) { await server.stop(); server = null; } dropCopy(local); }
    expect(read(P('lab/p2-31/practice1.js'))).not.toContain('P2025');
    expect(read(P('lab/p2-31/bookService.js'))).toContain('P2025');
    expect(read(P('lab/p2-31/bookRoutes.js')).match(/bookstore/g)).toBeNull();
  });

  it('🔴 과제 1 — 댓글 서버도 세 층으로 서고 같은 답을 낸다', async () => {
    const copies = ['lab/p2-31/commentService.js', 'lab/p2-31/commentRoutes.js', 'lab/p2-31/homework1.js']
      .map((f) => labCopy(f));
    // 사본끼리 서로를 부르게 이어준다 (파일 자체는 학생 표기 그대로다)
    writeFileSync(P(copies[1]), read(P(copies[1])).replace("'./commentService.js'", "'./commentService.local.js'"));
    writeFileSync(P(copies[2]), read(P(copies[2])).replace("'./commentRoutes.js'", "'./commentRoutes.local.js'"));
    try {
      await bootApp(copies[2], 4031);
      expect((await (await fetch(`${server.base}/api/comments`)).json())).toHaveLength(9);
      expect((await (await fetch(`${server.base}/api/comments?postId=1`)).json())).toHaveLength(3);
      expect((await fetch(`${server.base}/api/comments/1`)).status).toBe(200);
      for (const bad of ['999', 'abc']) {
        expect((await fetch(`${server.base}/api/comments/${bad}`)).status, bad).toBe(404);
        expect((await fetch(`${server.base}/api/comments/${bad}`, { method: 'DELETE' })).status, bad).toBe(404);
      }
      expect((await fetch(`${server.base}/api/nope`)).status).toBe(404);

      // 🔀 2026-09-19 audit — 답안이 보여준 목록 첫 항목이 실제 첫 항목과 같다(시각 두 칸의 값만 빼고)
      const list = await (await fetch(`${server.base}/api/comments`)).json();
      const shown = JSON.parse(blocksOf(ANSWERS, 'json').find((b) => b.includes('"저도 가봤어요"')));
      expect(Object.keys(shown)).toEqual(Object.keys(list[0]));
      expect(shown).not.toHaveProperty('minutesAgo');
      expect({ ...shown, createdAt: null, updatedAt: null }).toEqual({ ...list[0], createdAt: null, updatedAt: null });
      // 한 번도 안 고친 댓글이라 두 시각이 같다 — 답안이 이것을 확인 기준으로 준다
      expect(list[0].updatedAt).toBe(list[0].createdAt);
      expect(shown.updatedAt).toBe(shown.createdAt);
      // 「시드를 마지막으로 실행한 시각에서 8분을 뺀 값」 — 1분을 뺀 3번 댓글과 7분 차이다
      const gap = Date.parse(list[2].createdAt) - Date.parse(list[0].createdAt);
      expect(Math.abs(gap - 7 * 60 * 1000)).toBeLessThan(1000);
      // 교안의 날짜 흐름 — 댓글 updated_at 마이그레이션(p2-29 과제) 뒤, 정규화 마이그레이션(p2-33) 앞
      expect(Date.parse(shown.createdAt)).toBeGreaterThan(Date.parse('2026-09-30T11:49:26Z'));
      expect(Date.parse(shown.createdAt)).toBeLessThan(Date.parse('2026-10-01T12:03:33Z'));
      expect(read(ANSWERS)).toContain('8분을 뺀 값');
    } finally { if (server) { await server.stop(); server = null; } copies.forEach(dropCopy); }
    expect(read(P('lab/p2-31/commentService.js')).match(/\bres\b/g)).toBeNull();
    expect(read(P('lab/p2-31/commentRoutes.js')).match(/prisma/gi)).toBeNull();
  });
});

// ── 인용 ────────────────────────────────────────────────────────────────────
describe('인용이 코드베이스와 byte 동일한가', () => {
  // 🚨 교안은 «주석을 단 발췌» 와 «생략 스케치» 를 함께 쓴다. 앞은 주석만 떼면 진짜
  //    코드여야 하므로 떼고 대조하고, 뒤는 실행되는 코드가 아니라 설명용 그림이라
  //    출처가 없다 — 그래서 «명시적으로 적어둔 것만» 통과시킨다. 목록에 없는 스케치가
  //    새로 생기면 FAIL 이 나고, 그게 이 목록이 해야 할 일이다.
  const SKETCHES = [
    "router.get('/', (req, res) => { ... });",
    "router.get('/:id', parseId, async (req, res) => { ... });\n//                 ^^^^^^^  먼저 이걸 거친다",
    "import * as postService from '../services/postService.js';",
    "import { prisma } from '../db.js';\nimport * as postService from '../services/postService.js';",
    "import postsRouter from './routes/posts.js';\n\napp.use('/api/posts', postsRouter);",
    "function parseId(field, message) {\n  return (req, res, next) => { ... };\n}",
    "try {\n  // 게시물을 만들고 읽고 지우는 일\n} finally {\n  await prisma.$disconnect();\n}",
    "app.use((err, req, res, next) => {\n  if (err.code === 'P2025') {\n    res.status(404).json({ message: '그런 게시물은 없어요' });\n    return;\n  }\n  ...\n});",
    "import express from 'express';\n\nconst router = express.Router();\n\nrouter.get('/', (req, res) => { ... });",
  ];
  /** 발췌에 붙인 설명 주석(`// ① 주소`)을 떼어낸다 — 그 «아래» 코드는 진짜여야 한다. */
  const unannotate = (t) => t.split('\n')
    .map((l) => l.replace(/\s+\/\/ [①②③④].*$/, '').replace(/\s+$/, ''))
    .join('\n');

  const SOURCES = [
    'db.js',
    'snapshots/p2-31-final/app.js', 'snapshots/p2-31-final/routes/posts.js',
    'snapshots/p2-31-final/services/postService.js',
    'snapshots/p2-30.final.app.js',
    'snapshots/p2-31/step2/app.js', 'snapshots/p2-31/step2/routes/posts.js',
    'snapshots/p2-31/step3/routes/posts.js',
    'snapshots/p2-31/step4/routes/posts.js', 'snapshots/p2-31/step4/services/postService.js',
    'snapshots/p2-31/step5/routes/posts.js', 'snapshots/p2-31/step5/services/postService.js',
    'lab/p2-31/practice1.js', 'lab/p2-31/bookRoutes.js', 'lab/p2-31/bookService.js',
    'lab/p2-31/bookstore.js', 'lab/p2-31/homework1.js', 'lab/p2-31/homework2.js',
    'lab/p2-31/commentRoutes.js', 'lab/p2-31/commentService.js',
    'snapshots/p2-31/lab1/practice1.js', 'snapshots/p2-31/lab1/bookRoutes.js',
    'snapshots/p2-31/lab2/practice1.js', 'snapshots/p2-31/lab2/bookRoutes.js',
    'snapshots/p2-31/lab3/bookService.js', 'snapshots/p2-31/lab3/bookRoutes.js',
  ];
  /** 코드베이스 표기 → 학생 표기. 교안은 «학생 쪽» 이 정전이다. */
  const asStudent = (t) => t
    .replace(/from '\.\.\/\.\.\/\.\.\/lab\/generated\/index\.js'/g, "from './generated/index.js'")
    .replace(/from '\.\.\/generated\/index\.js'/g, "from './generated/index.js'");

  const pool = () => SOURCES.map((f) => asStudent(read(P(f)))).join('\n\n@@@\n\n');

  it('🔴 교안이 인용한 자바스크립트가 전부 코드베이스 «어딘가에» 실재한다', () => {
    const src = pool();
    const missing = [];
    for (const block of blocksOf(LECTURE, 'javascript')) {
      const body = block.startsWith('//') ? block.split('\n').slice(1).join('\n') : block;
      for (const chunk of body.split(/\n\s*\n/).map((c) => unannotate(c).trim()).filter(Boolean)) {
        if (SKETCHES.includes(chunk)) continue;
        if (!src.includes(chunk)) missing.push(chunk.split('\n')[0]);
      }
    }
    expect(missing).toEqual([]);
  });

  it('🔴 답안이 인용한 자바스크립트도 전부 실재한다', () => {
    const src = pool();
    const missing = [];
    for (const block of blocksOf(ANSWERS, 'javascript')) {
      const body = block.startsWith('//') ? block.split('\n').slice(1).join('\n') : block;
      for (const chunk of body.split(/\n\s*\n/).map((c) => unannotate(c).trim()).filter(Boolean)) {
        if (SKETCHES.includes(chunk)) continue;
        if (!src.includes(chunk)) missing.push(chunk.split('\n')[0]);
      }
    }
    expect(missing).toEqual([]);
  });

  it('🔴 완성본으로 인용한 파일 넷이 byte 동일하다', () => {
    const pairs = [
      [LECTURE, '// ~/instagram-api/app.js', ['snapshots/p2-31/step2/app.js', 'snapshots/p2-31-final/app.js']],
      [LECTURE, '// ~/instagram-api/routes/posts.js',
        ['snapshots/p2-31/step2/routes/posts.js', 'snapshots/p2-31-final/routes/posts.js']],
      [LECTURE, '// ~/instagram-api/services/postService.js',
        ['snapshots/p2-31/step4/services/postService.js', 'snapshots/p2-31-final/services/postService.js']],
      [LECTURE, '// ~/instagram-api/lab/bookRoutes.js', ['snapshots/p2-31/lab2/bookRoutes.js']],
      [LECTURE, '// ~/instagram-api/lab/practice1.js', ['snapshots/p2-31/lab1/practice1.js']],
      [LECTURE, '// ~/instagram-api/lab/bookService.js', ['snapshots/p2-31/lab3/bookService.js']],
      [ANSWERS, '// ~/instagram-api/lab/commentService.js', ['lab/p2-31/commentService.js']],
      [ANSWERS, '// ~/instagram-api/lab/commentRoutes.js', ['lab/p2-31/commentRoutes.js']],
      [ANSWERS, '// ~/instagram-api/lab/homework1.js', ['lab/p2-31/homework1.js']],
      [ANSWERS, '// ~/instagram-api/lab/homework2.js', ['lab/p2-31/homework2.js']],
    ];
    for (const [doc, head, files] of pairs) {
      const quoted = blocksOf(doc, 'javascript').filter((b) => b.startsWith(head));
      expect(quoted.length, head).toBeGreaterThanOrEqual(1);
      const wanted = files.map((f) => asStudent(read(P(f))).trimEnd());
      for (const q of quoted) expect(wanted, `${head}\n${q.slice(0, 80)}`).toContain(q);
    }
  });

  it('🔴 답안이 인용한 `.http` 가 코드베이스와 같다', () => {
    const quoted = [...read(ANSWERS).matchAll(/```\n(### 댓글 목록[\s\S]*?)```/g)].map((m) => m[1].trimEnd());
    expect(quoted).toHaveLength(1);
    expect(read(P('lab/p2-31/comments.http')).trimEnd()).toBe(quoted[0]);
  });

  it('🔴 교안이 인용한 터미널 출력이 실제 출력 안에 있다', () => {
    const bash = blocksOf(LECTURE, 'bash');
    const quoted = bash.find((b) => b.includes('PrismaClientKnownRequestError'));
    const codeLine = bash.find((b) => b.includes("code: 'P2025'"));
    expect(quoted).toBeTruthy();
    // 🚨 이 Step 의 주제가 「`P2025` 라는 이름이 어디서 오나」라, 그 이름이 실제로 찍히는
    //    줄까지 대조한다. 발췌를 나눠 인용하므로 블록 «둘» 을 다 봐야 한다.
    expect(codeLine, "`code: 'P2025',` 발췌가 없습니다").toBeTruthy();
    // 실제로 그 에러를 내는 판을 띄워서 대조한다 — 산문 주장으로 두지 않는다
    return (async () => {
      await bootApp('snapshots/p2-31/step5-broken/app.js', 3508);
      expect((await fetch(`${server.base}/api/posts/999`, { method: 'DELETE' })).status).toBe(500);
      await new Promise((r) => setTimeout(r, 300));
      for (const line of [...quoted.split('\n'), ...codeLine.split('\n')]
        .map((l) => l.trimEnd()).filter(Boolean)) {
        expect(server.tail(), line).toContain(line);
      }
      await server.stop(); server = null;
    })();
  });
});
