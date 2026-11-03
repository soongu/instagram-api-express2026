// p2-30 「Prisma 로 CRUD — 라우트 다섯 · 시딩 · 쿼리 파라미터」 게이트
//
// 🚨 진짜 instagram DB 를 안 건드린다 — 전용 DB(p230_gate)를 p2-29 종료 상태로 세워서 쓴다.
// 🚨 교안이 「이렇게 하면 이렇게 된다」고 주장하는 «중간 상태» 는 snapshots 로 얼려 실제로 띄운다.
//    산문으로만 적힌 주장은 어느 게이트도 못 보기 때문이다(p2-24 에서 셋이 정반대였다).
// 🚨 lab 파일은 학생 표기(`../db.js`)라 그대로는 안 돈다 — 사본에서 한 단 더 깊게 고쳐 띄운다.
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
import { setupP229 } from '../sql/p2-29/setup.mjs';

const ROOT = new URL('../', import.meta.url);
const P = (rel) => new URL(rel, ROOT).pathname;
const GATE_URL = 'postgresql://postgres:postgres@localhost:5432/p230_gate';
const ADMIN = { host: 'localhost', port: 5432, database: 'postgres', user: 'postgres', password: 'postgres' };
const ENV = { DATABASE_URL: GATE_URL };
const JSON_HEADERS = { 'Content-Type': 'application/json' };

// 🚨 **이 회차가 보는 `app.js` 는 «얼린 판» 이다** (2026-09-11 `p2-31` 착수 시).
//    `p2-31` 이 그 파일을 `routes/`·`services/` 로 가르면서 라우트가 통째로 빠져나가,
//    live 로 보면 이 회차 축 넷이 거짓 FAIL 을 낸다(「주소 다섯」·「Number 셋」·완성본
//    byte 동일·인용 출처). `p2-30` 이 `p2-25` 에게 한 것과 같은 처리다.
const P230_APP = P('snapshots/p2-30.final.app.js');
const LECTURE = P('../../part2/5-db-prisma/p2-30-prisma-crud-lecture.md');
const ANSWERS = P('../../part2/5-db-prisma/p2-30-prisma-crud-answers.md');
const read = (p) => readFileSync(p, 'utf8');
const blocksOf = (path, lang) =>
  [...read(path).matchAll(new RegExp('```' + lang + '\\n([\\s\\S]*?)```', 'g'))].map((m) => m[1].trimEnd());

let db = null;
let server = null;

/** lab 파일을 «한 단 깊은» 경로로 고친 사본 — 파일 자체는 학생 표기 그대로 둔다. */
function labCopy(rel) {
  const local = rel.replace(/\.js$/, '.local.js');
  writeFileSync(P(local), read(P(rel))
    .replace(/from '\.\.\/db\.js'/g, "from '../../snapshots/p2-32-final/db.js'")
    .replace(/from '\.\.\/data\//g, "from '../../snapshots/p2-33-final/data/")
    // 🚨 회차마다 게이트 포트를 가른다 — vitest 가 파일을 병렬로 돌려 4001 을 공유하면 부딪힌다.
    .replaceAll('4001', '4030'));
  return local;
}
const dropCopy = (local) => { try { unlinkSync(P(local)); } catch { /* 이미 없음 */ } };

const seed = (file = 'snapshots/p2-32-final/seed.js', args = []) =>
  execFileSync(process.execPath, [P(frozenDb(file)), ...args], { cwd: P('.'), encoding: 'utf8', env: { ...process.env, ...ENV } });

beforeAll(async () => {
  const admin = new pg.Client(ADMIN);
  await admin.connect();
  await admin.query('DROP DATABASE IF EXISTS p230_gate');
  await admin.query('CREATE DATABASE p230_gate');
  await admin.end();
  db = new pg.Client({ ...ADMIN, database: 'p230_gate' });
  await db.connect();
  await setupP229(db);
  await db.query('ALTER TABLE posts ADD COLUMN IF NOT EXISTS created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP');
}, 60000);

afterAll(async () => {
  if (server) { await server.stop(); server = null; }
  await db?.end();
  const admin = new pg.Client(ADMIN);
  await admin.connect();
  // 🚨 남은 연결을 먼저 끊는다. 서버·시드가 연 Prisma 연결이 살아 있으면
  //    DROP DATABASE 가 「다른 사용자가 쓰는 중」으로 죽는다(테스트는 다 통과한 뒤라
  //    이 실패는 정리 실패이지 판정이 아니다 — 그래서 더 헷갈린다).
  await admin.query(
    "select pg_terminate_backend(pid) from pg_stat_activity where datname = 'p230_gate' and pid <> pg_backend_pid()");
  await admin.query('DROP DATABASE IF EXISTS p230_gate');
  await admin.end();
});

/** 스냅숏이 부르는 `../db.js` 는 live 클라이언트다 — p2-33 이 정규화한 뒤로는 이 회차
 *  게이트 DB(글자 판)를 모른다. 그 한 줄만 얼린 판으로 바꿔 돌린다.
 *  🔑 커밋된 스냅숏 파일 자체는 «안 건드린다» — 교안 byte 대조와 「실재」 축이 그것을 본다. */
function frozenDb(rel) {
  const src = read(P(rel));
  if (!src.includes("from '../db.js'")) return rel;
  const local = rel.replace(/\.js$/, '.frozen.js');
  writeFileSync(P(local), src.replace("from '../db.js'", "from './p2-32-final/db.js'"));
  return local;
}

async function bootApp(file, port = 3400) {
  file = frozenDb(file);
  // 🚨 앞 서버가 포트를 놓는 데 한 박자가 걸린다 — 안 기다리면 다음 it 이
  //    「포트가 이미 물려 있다」로 죽는다(교안이 아니라 환경 문제다).
  if (server) { await server.stop(); server = null; await new Promise((r) => setTimeout(r, 150)); }
  server = await boot(file, { port, env: { ...ENV, PORT: String(port) }, ready: `${port}번 포트에서` });
  return server;
}

// ── 착수 상태 ───────────────────────────────────────────────────────────────
describe('착수 상태 — 「지난 시간 그대로」에서 출발한다', () => {
  it('p2-29 를 끝낸 학생의 표 둘이 그대로 서 있다', async () => {
    const r = await db.query('select (select count(*)::int from posts) p, (select count(*)::int from comments) c');
    expect(r.rows[0]).toEqual({ p: 5, c: 9 });
  });

  it('🔴 교안이 말하는 「주소 다섯 개」가 실제 수와 같다', () => {
    // 🚨 p2-23·p2-25 가 두 번 틀린 자리다(`/` 를 세느냐 마느냐). 게시물 주소는 다섯,
    //    파일 전체 라우트는 여섯이다. 교안은 «게시물 주소» 다섯을 말한다.
    const app = read(P230_APP);
    expect(app.match(/^app\.(?:get|post|patch|delete)\('\/api\/posts/gm)).toHaveLength(5);
    expect(app.match(/^app\.(?:get|post|patch|delete)\(/gm)).toHaveLength(6);
    expect(read(LECTURE)).toContain('주소 다섯 개');
  });

  it('🔴 `:id` 를 쓰는 주소가 셋이고, 숫자로 바꿔주는 줄도 셋이다', () => {
    const app = read(P230_APP);
    expect(app.match(/'\/api\/posts\/:id'/g)).toHaveLength(3);
    expect(app.match(/Number\(req\.params\.id\)/g)).toHaveLength(3);
    expect(app.match(/Number\.isInteger/g)).toHaveLength(3);
    // 🔀 2026-09-14 「숫자로 바꿔주는 줄」이 들어 있던 「오늘의 숫자」 절이 트랙 캐논으로 전량 삭제됐다(`b8faf61`).
    //    같은 뜻은 마무리 「핵심 세 가지」 둘째 줄에 남아 있어 그 문장을 본다 — 절을 되살리지 않는다.
    expect(read(LECTURE)).toContain('숫자로 바꿔주는 것만으로는 모자라서');
  });
});

// ── Step 1 — 반쯤 간 서버 ───────────────────────────────────────────────────
describe('Step 1 — 목록만 갈아 끼운 판이 실제로 그렇게 돈다', () => {
  it('서버가 «정상으로 뜨고» 목록은 다섯을 준다', async () => {
    await bootApp('snapshots/p2-30.step1.app.js', 3401);
    expect(server.log).toContain('3401번 포트에서');
    const res = await fetch(`${server.base}/api/posts`);
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveLength(5);
  });

  it('🔴 나머지 넷은 `ReferenceError: Post is not defined` 로 500 이다', async () => {
    await bootApp('snapshots/p2-30.step1.app.js', 3402);
    for (const [method, path] of [['GET', '/api/posts/1'], ['PATCH', '/api/posts/1'],
                                  ['DELETE', '/api/posts/1'], ['POST', '/api/posts']]) {
      const res = await fetch(`${server.base}${path}`, {
        method, headers: JSON_HEADERS,
        body: method === 'GET' || method === 'DELETE' ? undefined : JSON.stringify({ username: 'a', postImage: '/a.jpg' }),
      });
      expect(res.status, `${method} ${path}`).toBe(500);
    }
    await new Promise((r) => setTimeout(r, 200));
    expect(server.tail()).toContain('ReferenceError: Post is not defined');
    expect(read(LECTURE)).toContain('ReferenceError: Post is not defined');
  });
});

// ── Step 2 — 번호가 글자로 온다 ─────────────────────────────────────────────
describe('Step 2 — 글자를 그대로 넘기면 Prisma 가 «막는다»', () => {
  it('🔴 순진한 번역판이 교안이 인용한 그 문구로 터진다', async () => {
    await bootApp('snapshots/p2-30.step2.naive.app.js', 3403);
    expect((await fetch(`${server.base}/api/posts/1`)).status).toBe(500);
    await new Promise((r) => setTimeout(r, 200));
    // 교안이 인용한 에러 전문이 실제 출력 안에 그대로 있어야 한다
    const quoted = blocksOf(LECTURE, 'bash').find((b) => b.includes('PrismaClientValidationError'));
    expect(quoted).toBeTruthy();
    for (const line of quoted.split('\n').map((l) => l.trimEnd()).filter(Boolean)) {
      expect(server.tail(), line).toContain(line);
    }
  });

  it('🔴 교안이 「이러면 또 난다」고 한 `take` 판이 실제로 그 에러를 낸다', async () => {
    await bootApp('snapshots/p2-30.step8.broken.app.js', 3421);
    expect((await fetch(`${server.base}/api/posts?limit=2`)).status).toBe(500);
    await new Promise((r) => setTimeout(r, 200));
    expect(server.tail()).toContain('Argument `take`: Invalid value provided. Expected Int, provided String.');
    expect(read(LECTURE)).toContain('Argument `take`: Invalid value provided. Expected Int, provided String.');
  });

  it('고친 판은 404 를 내고 500 이 안 난다', async () => {
    await bootApp('snapshots/p2-32-final/app.js', 3404);
    for (const bad of ['abc', '1.5', '999']) {
      const res = await fetch(`${server.base}/api/posts/${bad}`);
      expect(res.status, bad).toBe(404);
      expect(await res.json()).toEqual({ message: '그런 게시물은 없어요' });
    }
    expect((await fetch(`${server.base}/api/posts/1`)).status).toBe(200);
  });
});

// ── Step 3 — 받을 칸을 고른다 ───────────────────────────────────────────────
describe('Step 3 — `...req.body` 가 여는 구멍 둘', () => {
  it('🔴 순진한 판은 모르는 이름에 500 을 낸다', async () => {
    await bootApp('snapshots/p2-30.step3.naive.app.js', 3405);
    const res = await fetch(`${server.base}/api/posts`, {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ username: 'yuna', postImage: '/i.jpg', nickname: '유나' }),
    });
    expect(res.status).toBe(500);
    await new Promise((r) => setTimeout(r, 200));
    expect(server.tail()).toContain('Unknown argument `nickname`');
    expect(read(LECTURE)).toContain('Unknown argument `nickname`');
  });

  it('🔴 순진한 판은 `id` 를 실어 보내면 «201 로 통과»시킨다', async () => {
    await bootApp('snapshots/p2-30.step3.naive.app.js', 3406);
    const made = await fetch(`${server.base}/api/posts`, {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ id: 777, username: 'hacker', postImage: '/h.jpg' }),
    });
    expect(made.status).toBe(201);
    expect((await made.json()).id).toBe(777);
    // 그리고 다음 자동 번호는 778 이 «아니다» — 교안이 이 수를 근거로 위험을 설명한다
    const next = await fetch(`${server.base}/api/posts`, {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ username: 'yuna', postImage: '/y.jpg' }),
    });
    expect((await next.json()).id).toBeLessThan(777);
    // 🚨 문구가 아니라 «주장» 을 잠근다 — 교안이 778 을 반례로 들고 있는지만 본다.
    //    문구를 그대로 박으면 문장을 다듬을 때마다 거짓 FAIL 이 난다(실제로 두 번 났다).
    expect(read(LECTURE)).toMatch(/778이 아니/);
  });

  it('고친 판은 모르는 이름도 `id` 도 그냥 무시한다', async () => {
    await bootApp('snapshots/p2-32-final/app.js', 3407);
    const res = await fetch(`${server.base}/api/posts`, {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ id: 888, username: 'yuna', postImage: '/y.jpg', nickname: '유나' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).not.toBe(888);
    expect(body.likeCount).toBe(0);      // 스키마 기본값이 준다
    expect(body.commentCount).toBe(0);
    expect(body.minutesAgo).toBe(0);
  });
});

// ── Step 4 — 없는 번호가 터진다 ─────────────────────────────────────────────
describe('Step 4 — `null` 이 아니라 «던진다»', () => {
  it('🔴 P2025 갈래가 없으면 지난 시간의 404 가 500 이 된다', async () => {
    await bootApp('snapshots/p2-30.step4.naive.app.js', 3408);
    for (const [method, body] of [['PATCH', JSON.stringify({ likeCount: 7 })], ['DELETE', undefined]]) {
      const res = await fetch(`${server.base}/api/posts/999`, { method, headers: JSON_HEADERS, body });
      expect(res.status, method).toBe(500);
    }
    await new Promise((r) => setTimeout(r, 200));
    expect(server.tail()).toContain('P2025');
  });

  it('갈래를 넣은 판은 404 로 돌아온다 — 겉이 지난 시간과 같아진다', async () => {
    await bootApp('snapshots/p2-32-final/app.js', 3409);
    for (const [method, body] of [['PATCH', JSON.stringify({ likeCount: 7 })], ['DELETE', undefined]]) {
      const res = await fetch(`${server.base}/api/posts/999`, { method, headers: JSON_HEADERS, body });
      expect(res.status, method).toBe(404);
      expect(await res.json()).toEqual({ message: '그런 게시물은 없어요' });
    }
  });

  it('🔴 고치기도 받을 이름을 고른다 — 모르는 이름·`id` 에 500 이 안 난다', async () => {
    // 🚨 Step 3 이 만들기의 구멍 둘을 막았는데 고치기는 안 막으면, 같은 몸통을 PATCH 로
    //    보낼 때 그대로 500 이 난다(초고가 그랬고 독립 정독자가 잡았다).
    await bootApp('snapshots/p2-32-final/app.js', 3415);
    for (const body of [{ nickname: 'x' }, { id: 999 }]) {
      const res = await fetch(`${server.base}/api/posts/1`, {
        method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(body),
      });
      expect(res.status, JSON.stringify(body)).toBe(200);
      expect((await res.json()).id, JSON.stringify(body)).toBe(1);
    }
    // 안 보낸 칸은 그대로 남는다 — data 의 undefined 는 「안 바꿈」이다
    const before = await (await fetch(`${server.base}/api/posts/1`)).json();
    const after = await (await fetch(`${server.base}/api/posts/1`, {
      method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ likeCount: 7 }),
    })).json();
    expect(after.likeCount).toBe(7);
    expect(after.content).toBe(before.content);
    expect(after.username).toBe(before.username);
  });

  it('🔴 `p2-23` 이 가르친 「깨진 몸통 400」이 안 덮였다', async () => {
    // 🚨 p2-25 가 「통째로 500 을 내면 400 이 덮인다」를 이 회차 최고의 함정으로 다뤘다.
    //    P2025 갈래를 맨 위에 넣어도 그 아래 err.status 갈래가 살아 있어야 한다.
    await bootApp('snapshots/p2-32-final/app.js', 3410);
    const res = await fetch(`${server.base}/api/posts`, {
      method: 'POST', headers: JSON_HEADERS, body: '{"username"',
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ message: '보낸 내용을 읽을 수 없어요' });
  });
});

// ── Step 6 — 시드 ───────────────────────────────────────────────────────────
describe('Step 6 — 시드는 «언제 돌려도 같은 결과» 다', () => {
  it('🔴 게시물만 지우려 하면 외래 키가 P2003 으로 막는다', async () => {
    const probe = '__replay__/p230-fk.mjs';
    writeFileSync(P(probe), `
import { prisma } from '../db.js';
try { await prisma.post.deleteMany({}); console.log('NOT-BLOCKED'); }
catch (e) { console.log('BLOCKED ' + e.code); }
await prisma.$disconnect();`);
    const out = execFileSync(process.execPath, [P(probe)], { encoding: 'utf8', env: { ...process.env, ...ENV } });
    expect(out).toContain('BLOCKED P2003');
    expect(read(LECTURE)).toContain('comments_post_id_fkey');
    dropCopy(probe);
  });

  it('🔴 `deleteMany` 만 쓰면 번호가 1 부터 «안» 시작한다', async () => {
    const probe = '__replay__/p230-num.mjs';
    writeFileSync(P(probe), `
import { prisma } from '../snapshots/p2-32-final/db.js';
import { posts } from '../snapshots/p2-33-final/data/posts.js';
await prisma.comment.deleteMany({});
await prisma.post.deleteMany({});
await prisma.post.createMany({ data: posts.map((p) => ({ ...p })) });
const made = await prisma.post.findMany({ orderBy: { id: 'asc' } });
console.log(JSON.stringify(made.map((p) => p.id)));
await prisma.$disconnect();`);
    const out = execFileSync(process.execPath, [P(probe)], { encoding: 'utf8', env: { ...process.env, ...ENV } });
    const ids = JSON.parse(out.trim().split('\n').at(-1));
    expect(ids[0]).toBeGreaterThan(1);
    expect(read(LECTURE)).toContain('1부터가 아니에요');
    dropCopy(probe);
  });

  it('우리 시드는 1 부터 다섯, 댓글 아홉을 넣는다', () => {
    const out = seed();
    expect(out).toContain('게시물 5개와 댓글 9개를 넣었어요.');
    expect(blocksOf(LECTURE, 'bash')).toContain('게시물 5개와 댓글 9개를 넣었어요.');
  });

  it('두 번 돌려도 같다 — 번호까지 같다', async () => {
    seed(); seed();
    const r = await db.query('select id from posts order by id');
    expect(r.rows.map((x) => x.id)).toEqual([1, 2, 3, 4, 5]);
    const c = await db.query('select count(*)::int n from comments');
    expect(c.rows[0].n).toBe(9);
  });

  it('🔴 시각이 줄마다 «다르다» — 안 그러면 Step 8 정렬이 아무 일도 안 한다', async () => {
    seed();
    const r = await db.query('select count(distinct created_at)::int n from posts');
    expect(r.rows[0].n).toBe(5);
  });
});

// ── Step 7·8 — 쿼리 파라미터 ────────────────────────────────────────────────
describe('Step 7·8 — 조건 · 정렬 · 개수', () => {
  // 🚨 서버를 «한 번만» 띄운다. it 마다 재기동하면 포트를 놓는 사이에 다음 it 이
  //    달려들어 「이미 물려 있다」로 죽는다 — 교안이 아니라 게이트가 만든 실패다.
  beforeAll(async () => { seed(); await bootApp('snapshots/p2-32-final/app.js', 3420); }, 30000);

  it('조건을 안 보내면 전부, 보내면 그 사람 것만', async () => {
    expect(await (await fetch(`${server.base}/api/posts`)).json()).toHaveLength(5);
    const minji = await (await fetch(`${server.base}/api/posts?username=minji`)).json();
    expect(minji.map((p) => p.username)).toEqual(['minji', 'minji']);
  });

  it('🔴 이상한 값을 보내도 500 이 안 난다 — `|| undefined` 가 받는다', async () => {
    for (const q of ['?limit=abc', '?limit=', '?limit=0', '?limit=-1']) {
      const res = await fetch(`${server.base}/api/posts${q}`);
      expect(res.status, q).toBe(200);
    }
  });

  it('정렬이 «실제로» 최신순이다 — 시드가 시각을 다르게 줬으니까', async () => {
    const posts = await (await fetch(`${server.base}/api/posts`)).json();
    const times = posts.map((p) => new Date(p.createdAt).getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    expect(posts.map((p) => p.minutesAgo)).toEqual([...posts.map((p) => p.minutesAgo)].sort((a, b) => a - b));
  });

  afterAll(async () => { if (server) { await server.stop(); server = null; } });

  it('개수와 조건을 함께 걸 수 있다', async () => {
    expect(await (await fetch(`${server.base}/api/posts?limit=2`)).json()).toHaveLength(2);
    expect(await (await fetch(`${server.base}/api/posts?username=minji&limit=1`)).json()).toHaveLength(1);
  });
});

// ── 과제 ────────────────────────────────────────────────────────────────────
describe('과제 1 — 댓글 주소', () => {
  it('목록·조건·하나·지우기가 답안대로 돈다', async () => {
    seed();
    const local = labCopy('lab/p2-30/homework1.js');
    try {
      server = await boot(local, { port: 4030, env: ENV, ready: '4030번 포트에서' });
      expect(await (await fetch('http://localhost:4030/api/comments')).json()).toHaveLength(9);
      const two = await (await fetch('http://localhost:4030/api/comments?postId=2')).json();
      expect(two.map((c) => c.postId)).toEqual([2, 2, 2, 2]);
      // 🔴 글자가 와도 500 이 아니라 «조건 없음» 으로 받는다
      expect(await (await fetch('http://localhost:4030/api/comments?postId=abc')).json()).toHaveLength(9);
      expect((await fetch('http://localhost:4030/api/comments/1')).status).toBe(200);
      expect((await fetch('http://localhost:4030/api/comments/999')).status).toBe(404);
      expect((await fetch('http://localhost:4030/api/comments/abc')).status).toBe(404);
      expect((await fetch('http://localhost:4030/api/comments/9', { method: 'DELETE' })).status).toBe(200);
      expect((await fetch('http://localhost:4030/api/comments/999', { method: 'DELETE' })).status).toBe(404);
    } finally { await server?.stop(); server = null; dropCopy(local); }
  }, 30000);

  it('🚨 포트 5000 을 안 쓴다 — macOS AirPlay 가 그 번호를 쥐고 있다', () => {
    for (const f of ['lab/p2-30/homework1.js', 'lab/p2-30/practice1.js', 'lab/p2-30/bookstore.js'])
      expect(read(P(f)), f).not.toContain('5000');
    expect(read(LECTURE)).toContain('AirPlay');
  });
});

describe('과제 2 — 안전한 시드', () => {
  it('이미 있으면 안 넣고, `--force` 면 넣는다', () => {
    const local = labCopy('lab/p2-30/homework2.js');
    try {
      seed();                                                   // 다섯이 있는 상태로 만든다
      expect(seed(local)).toContain('이미 5개 있어서 아무것도 안 했어요');
      expect(seed(local, ['--force'])).toContain('게시물 5개와 댓글 9개를 넣었어요');
    } finally { dropCopy(local); }
  }, 30000);
});

// ── 교안 ↔ 코드베이스 ──────────────────────────────────────────────────────
describe('인용이 코드베이스와 byte 동일한가', () => {
  // 🚨 스냅숏은 `snapshots/` 아래 있어 «불러오는 줄 하나만» 학생 표기와 다르다.
  // 🚨 얼린 스냅숏은 게이트가 돌 수 있게 경로가 한 단 깊다 — 학생 표기로 되돌려 대조한다.
  const asStudent = (src) => src
    .replace("from '../db.js'", "from './db.js'")
    .replaceAll("from '../../data/", "from './data/")
    .replaceAll("from '../p2-33-final/data/", "from './data/");   // 🚨 p2-34 가 데이터를 키워 얼렸다   // 🚨 둘 있다 — replace 는 첫 건만 바꾼다

  it('🔴 교안의 `app.js` 완성본이 코드베이스와 byte 동일하다', () => {
    // 🚨 p2-24 가 이 검사 없이 배포됐다가 독립 정독자에게 「맞춰볼 데가 없다」로 잡혔다.
    const quoted = blocksOf(LECTURE, 'javascript').filter((b) => b.startsWith('// ~/instagram-api/app.js'));
    expect(quoted.length).toBeGreaterThanOrEqual(1);
    expect(quoted.at(-1)).toBe(asStudent(read(P230_APP)).trimEnd());
  });

  it('교안이 인용한 `db.js`·`seed.js`·데이터 파일이 코드베이스와 같다', () => {
    for (const [head, file] of [['// ~/instagram-api/db.js', 'db.js'],
                                ['// ~/instagram-api/seed.js', 'snapshots/p2-32-final/seed.js'],
                                ['// ~/instagram-api/data/posts.js', 'snapshots/p2-33-final/data/posts.js'],
                                ['// ~/instagram-api/data/comments.js', 'snapshots/p2-33-final/data/comments.js']]) {
      const quoted = blocksOf(LECTURE, 'javascript').filter((b) => b.startsWith(head));
      expect(quoted.length, head).toBe(1);
      expect(quoted[0], head).toBe(asStudent(read(P(file))).trimEnd());
    }
  });

  it('교안이 인용한 자바스크립트가 전부 코드베이스 «어딘가에» 실재한다', () => {
    // 🚨 「app.js 조각」만 볼 게 아니다 — 교안은 db.js·seed.js·데이터·실습 파일도
    //    조각으로 인용한다. 출처를 좁게 잡으면 그 몫이 통째로 무검사가 된다.
    const sources = ['snapshots/p2-30.final.app.js', 'db.js', 'snapshots/p2-32-final/seed.js', 'snapshots/p2-33-final/check.js',
                     'snapshots/p2-33-final/data/posts.js', 'snapshots/p2-33-final/data/comments.js',
                     'lab/p2-30/bookstore.js', 'lab/p2-30/practice1.js', 'lab/p2-30/practice2.js',
                     'snapshots/p2-30.seed.naive.js', 'snapshots/p2-30.step7.app.js',
                     'snapshots/p2-30.step8.app.js', 'snapshots/p2-30.step8.broken.app.js',
                     'snapshots/p2-30.step7.practice2.js',
                     'snapshots/p2-30.step1.app.js', 'snapshots/p2-30.step2.naive.app.js',
                     'snapshots/p2-30.step3.naive.app.js', 'snapshots/p2-30.step4.naive.app.js']
      .map((f) => asStudent(read(P(f))).replace("'../generated/", "'./generated/").replace("'../lab/p2-30/bookstore.js'", "'./bookstore.js'"));
    sources.push(execFileSync('git', ['show', 'code/p2-25:app.js'], { cwd: P('.'), encoding: 'utf8' }));
    // 답안이 보여주는 「이렇게 하면 더 좋아요」 갈래는 완성본에 없는 «제안» 이라 따로 둔다
    sources.push("  if (err.code === 'P2003') {\n    res.status(409).json({ message: '댓글이 달린 게시물은 지울 수 없어요' });\n    return;\n  }");
    sources.push("if (process.env.NODE_ENV === 'production') {\n  console.log('배포 환경에서는 시드를 안 돌려요.');\n  process.exit(1);\n}");
    const missing = [];
    for (const block of blocksOf(LECTURE, 'javascript')) {
      const body = block.startsWith('//') ? block.split('\n').slice(1).join('\n').trim() : block.trim();
      if (!body) continue;
      for (const chunk of body.split(/\n\s*\n/).map((c) => c.trim()).filter(Boolean))
        if (!sources.some((s) => s.includes(chunk))) missing.push(chunk.split('\n')[0]);
    }
    expect(missing).toEqual([]);
  });

  it('답안이 인용한 lab 파일이 코드베이스와 같다', () => {
    for (const [head, file] of [['// ~/instagram-api/lab/homework1.js', 'lab/p2-30/homework1.js'],
                                ['// ~/instagram-api/lab/homework2.js', 'lab/p2-30/homework2.js']]) {
      const quoted = blocksOf(ANSWERS, 'javascript').filter((b) => b.startsWith(head));
      expect(quoted.length, head).toBe(1);
      expect(quoted[0], head).toBe(read(P(file)).trimEnd());
    }
  });

  it('교안이 인용한 실습 파일이 코드베이스와 같다', () => {
    for (const [head, file] of [['// ~/instagram-api/lab/bookstore.js', 'lab/p2-30/bookstore.js'],
                                ['// ~/instagram-api/lab/practice1.js', 'lab/p2-30/practice1.js']]) {
      const quoted = blocksOf(LECTURE, 'javascript').filter((b) => b.startsWith(head));
      expect(quoted.length, head).toBe(1);
      // 🚨 실습 파일은 «생성된» 클라이언트를 부르는데, 코드베이스는 한 단 깊어 `../generated` 다
      expect(quoted[0].replace("'./generated/", "'../generated/"), head).toBe(read(P(file)).trimEnd());
    }
  });

  it('🔴 교안이 인용한 `.http` 가 그 시점 요청 파일과 같다', () => {
    // 🚨 출처가 둘이다 — 「고친 뒤」는 지금 파일, 「고치기 전」은 p2-25 시점 스냅숏.
    //    한쪽만 보면 교안이 대조용으로 보여주는 옛 판이 거짓 FAIL 로 잡힌다.
    const sources = [read(P('requests/posts.http')), read(P('snapshots/p2-25.posts.http'))];
    const missing = [];
    for (const q of blocksOf(LECTURE, 'http')) {
      if (!q.startsWith('###')) continue;         // 본문이 «보여주기만» 하는 요청 (파일에 안 넣는다)
      if (q.includes(':4030')) continue;          // 과제용 (답안 몫)
      if (!sources.some((src) => src.includes(q.trim()))) missing.push(q.split('\n')[0]);
    }
    expect(missing).toEqual([]);
  });
});
