// p2-35 「관계 다루기와 $transaction」 게이트
//
// 🚨 진짜 instagram·bookstore DB 를 안 건드린다 — 전용 DB 를 p2-34 종료 상태로 세워서 쓴다.
// 🚨 이 회차는 «스키마를 안 바꾼다». 그래서 판정 축이 마이그레이션이 아니라 셋이다.
//    ① «두 번 쓰는 자리가 묶였는가» — 사이에서 실패해도 어긋난 상태가 안 남아야 한다.
//       묶기 «전» 판(snapshots/p2-35/likeService.crash.js)이 실제로 어긋나는 것까지
//       함께 잠근다. 안 그러면 「고쳤다」가 「원래 안 깨졌다」와 구분되지 않는다.
//    ② «중첩 쓰기가 고아를 안 만든다» — 게시물만 생기고 사진이 없는 상태가 못 생긴다.
//    ③ «바깥에서 본 모습이 그대로다» — 읽는 방법을 select 로 갈았는데 응답은 한 글자도
//       안 달라져야 한다. 이 회차의 이득은 «덜 받아오는 것» 이지 «다르게 주는 것» 이 아니다.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import pg from 'pg';
import { boot } from './helpers/boot.js';
import { setupP235, setupP235Bookstore } from '../sql/p2-35/setup.mjs';

const ROOT = new URL('../', import.meta.url);
const P = (rel) => new URL(rel, ROOT).pathname;
const ADMIN = { host: 'localhost', port: 5432, database: 'postgres', user: 'postgres', password: 'postgres' };
const GATE_URL = 'postgresql://postgres:postgres@localhost:5432/p235_gate';
const BOOK_ADMIN = { ...ADMIN, port: 5433 };
const BOOK_GATE_URL = 'postgresql://postgres:postgres@localhost:5433/p235_book_gate';
// `p2-38` 부터 `app.js` 가 허락 목록을 환경에서 받는다 — 학생이 `--env-file`
// 로 넣어주는 그 자리에 게이트가 자기 값을 넣는다(`boot.js` 가 정한 방식).
const ENV = { DATABASE_URL: GATE_URL, CORS_ORIGIN: 'http://localhost:5173' };
const JSON_HEADERS = { 'Content-Type': 'application/json' };

const LECTURE = P('../../part2/5-db-prisma/p2-35-transactions-lecture.md');
const ANSWERS = P('../../part2/5-db-prisma/p2-35-transactions-answers.md');
const read = (p) => readFileSync(p, 'utf8');
const exists = (p) => { try { readFileSync(p); return true; } catch { return false; } };

let db = null;
let server = null;

const prismaCli = (args, env = {}) =>
  execFileSync(P('node_modules/.bin/prisma'), args, {
    cwd: P('.'), encoding: 'utf8', env: { ...process.env, ...ENV, ...env },
  });

/** 착수 상태의 데이터 — p2-34 가 얼려둔 시드다(이 회차가 seed.js 를 다시 쓰므로). */
const seedFrozen = () =>
  execFileSync(process.execPath, [P('snapshots/p2-34-final/seed.js')],
    { cwd: P('.'), encoding: 'utf8', env: { ...process.env, ...ENV } });

/** 이 회차가 고친 시드 — 학생이 실제로 돌리는 그 파일이다. */
// 🚨 p2-36 이 `data/posts.js` 의 사진 주소를 «브라우저에서 열리는» 주소로 바꾼다.
//    이 축이 묻는 것은 «p2-35 의 중첩 쓰기 시드가 데이터를 그대로 두는가» 라서,
//    비교 대상은 이 회차 최종판이지 그 뒤에 자란 데이터가 아니다.
const seedLive = () =>
  execFileSync(process.execPath, [P('snapshots/p2-35-final/seed.js')],
    { cwd: P('.'), encoding: 'utf8', env: { ...process.env, ...ENV } });

async function bootApp(file, port, env = {}) {
  if (server) { await server.stop(); server = null; await new Promise((r) => setTimeout(r, 150)); }
  server = await boot(file, { port, env: { ...ENV, PORT: String(port), ...env }, ready: `${port}번 포트에서` });
  return server;
}

/**
 * 학생 파일은 한 글자도 안 고치고, `likeService.js` «한 장만» 바꿔 끼운 앱을 짓는다.
 * 🚨 교안 Step 1 이 보여주는 장면(사이에서 죽으면 어긋난다)을 실행으로 잠그려면
 *    라우터·앱까지 그 서비스를 보게 이어야 한다 — 작업 트리는 안 건드린다.
 */
function crashApp() {
  const dir = P('__replay__/p235');
  mkdirSync(dir, { recursive: true });
  const up = (t) => t
    .replace(/'\.\.\/db\.js'/g, "'../../db.js'")
    .replace(/'\.\.\/errors\.js'/g, "'../../errors.js'")
    .replace(/'\.\.\/middlewares\//g, "'../../middlewares/")
    .replace(/'\.\.\/schemas\//g, "'../../schemas/");

  writeFileSync(`${dir}/likeService.js`, up(read(P('snapshots/p2-35/likeService.crash.js'))));
  writeFileSync(`${dir}/postService.js`, up(read(P('services/postService.js'))));
  writeFileSync(`${dir}/posts.js`, up(read(P('routes/posts.js')))
    .replace(/'\.\.\/services\//g, "'./"));
  writeFileSync(`${dir}/app.crash.js`, read(P('app.js'))
    .replace("'./routes/posts.js'", "'./posts.js'")
    .replace("'./errors.js'", "'../../errors.js'"));
  return '__replay__/p235/app.crash.js';
}

/** 교안 Step 2 의 코드 그대로 — 묶은 판에 `throw` 가 «묶음 안» 에 들어 있다. */
function transactionCrashApp() {
  const dir = P('__replay__/p235');
  mkdirSync(dir, { recursive: true });
  const MARK = '      // 화면이 읽는 숫자는 따로 적어둔 칸이라, 켜고 끌 때마다 우리가 맞춰준다.';
  const src = read(P('services/likeService.js'))
    .replace(MARK, "      throw new Error('서버가 갑자기 멈췄어요');\n\n" + MARK);
  if (!src.includes('서버가 갑자기 멈췄어요')) throw new Error('throw 를 끼울 자리를 못 찾았다');
  const up = (t) => t
    .replace(/'\.\.\/db\.js'/g, "'../../db.js'")
    .replace(/'\.\.\/errors\.js'/g, "'../../errors.js'");
  writeFileSync(`${dir}/likeService.js`, up(src));
  writeFileSync(`${dir}/postService.js`, up(read(P('services/postService.js'))));
  writeFileSync(`${dir}/posts.js`, up(read(P('routes/posts.js')))
    .replace(/'\.\.\/services\//g, "'./")
    .replace("'../middlewares/", "'../../middlewares/")
    .replace("'../schemas/", "'../../schemas/"));
  writeFileSync(`${dir}/app.tx.js`, read(P('app.js'))
    .replace("'./routes/posts.js'", "'./posts.js'").replace("'./errors.js'", "'../../errors.js'"));
  return '__replay__/p235/app.tx.js';
}

beforeAll(async () => {
  const admin = new pg.Client(ADMIN);
  await admin.connect();
  await admin.query(
    "select pg_terminate_backend(pid) from pg_stat_activity where datname = 'p235_gate' and pid <> pg_backend_pid()");
  await admin.query('DROP DATABASE IF EXISTS p235_gate');
  await admin.query('CREATE DATABASE p235_gate');
  await admin.end();

  db = new pg.Client({ ...ADMIN, database: 'p235_gate' });
  await db.connect();
  await setupP235(db);
  seedFrozen();
}, 120000);

afterAll(async () => {
  if (server) await server.stop();
  if (db) await db.end();
  const admin = new pg.Client(ADMIN);
  await admin.connect();
  await admin.query(
    "select pg_terminate_backend(pid) from pg_stat_activity where datname = 'p235_gate' and pid <> pg_backend_pid()");
  await admin.query('DROP DATABASE IF EXISTS p235_gate');
  await admin.end();
}, 60000);

const stateOfPost1 = async () => {
  const r = await db.query(
    'select p.like_count, (select count(*)::int from post_likes where post_id = 1) likes from posts p where p.id = 1');
  return { likeCount: r.rows[0].like_count, likes: r.rows[0].likes };
};

// ── 축 ① 두 번 쓰는 자리가 묶였는가 ──────────────────────────────────────────

describe('Step 1·2 — 묶기 전에는 어긋나고, 묶은 뒤에는 안 어긋난다', () => {
  it('🔴 묶기 «전» 판은 사이에서 죽으면 어긋난 채로 남는다 (교안 Step 1 의 장면)', async () => {
    await db.query('delete from post_likes');
    await db.query('update posts set like_count = 130 where id = 1');
    await bootApp(crashApp(), 3451);

    const res = await fetch(`${server.base}/api/posts/1/likes`,
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ userId: 1 }) });

    expect(res.status, '서버가 터진다').toBe(500);
    // 🔴 이것이 이 회차가 고치려는 그 상태다 — 줄은 들어갔는데 숫자는 그대로.
    expect(await stateOfPost1()).toEqual({ likeCount: 130, likes: 1 });

    const likers = await fetch(`${server.base}/api/posts/1/likes`).then((r) => r.json());
    expect(likers, '누른 사람 목록에는 이미 이름이 있다').toEqual(['dahye']);
  });

  it('🔴 그 상태에서 «한 번 더» 누르면 숫자가 시작값보다 내려간다 (오프닝의 장면)', async () => {
    // 앞 검사가 남긴 어긋난 상태를 그대로 이어받는다 — 죽는 줄만 뺀 판으로 띄운다.
    await bootApp('app.js', 3452);

    const again = await fetch(`${server.base}/api/posts/1/likes`,
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ userId: 1 }) }).then((r) => r.json());

    expect(again, '켰다고 눌렀는데 꺼지고, 숫자는 130 에서 129 로 내려간다')
      .toEqual({ liked: false, likeCount: 129 });
    expect(await stateOfPost1()).toEqual({ likeCount: 129, likes: 0 });
  });

  it('🔴 묶은 뒤에는 «같은 실패» 에도 아무것도 안 남는다', async () => {
    await db.query('delete from post_likes');
    await db.query('update posts set like_count = 130 where id = 1');

    const src = read(P('services/likeService.js'));
    expect(src, '$transaction 으로 묶여 있어야 한다').toContain('prisma.$transaction(async (tx) =>');
    expect(src, '읽기도 같은 묶음 안에 있어야 한다').toMatch(/tx\.postLike\.findUnique/);
    expect(src, '쓰기 둘 다 tx 로 가야 한다').toMatch(/tx\.post\.update/);
    expect(src, 'prisma. 로 새는 쓰기가 있으면 안 묶인 것이다')
      .not.toMatch(/await prisma\.(postLike|post)\.(create|delete|update)/);
  });

  it('🔴 켜고 끄기가 숫자와 줄을 «함께» 움직인다', async () => {
    await db.query('delete from post_likes');
    await db.query('update posts set like_count = 130 where id = 1');
    await bootApp('app.js', 3452);

    const press = (userId) => fetch(`${server.base}/api/posts/1/likes`,
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ userId }) }).then((r) => r.json());

    expect(await press(1)).toEqual({ liked: true, likeCount: 131 });
    expect(await stateOfPost1()).toEqual({ likeCount: 131, likes: 1 });

    expect(await press(1)).toEqual({ liked: false, likeCount: 130 });
    expect(await stateOfPost1()).toEqual({ likeCount: 130, likes: 0 });
  });

  it('🔴 없는 게시물·없는 사람은 400 이고 아무것도 안 남는다', async () => {
    await db.query('delete from post_likes');
    await db.query('update posts set like_count = 130 where id = 1');

    for (const [path, body] of [['999', { userId: 1 }], ['1', { userId: 999 }]]) {
      const res = await fetch(`${server.base}/api/posts/${path}/likes`,
        { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) });
      expect(res.status, `${path} / ${JSON.stringify(body)}`).toBe(400);
    }

    expect(await stateOfPost1()).toEqual({ likeCount: 130, likes: 0 });
  });
});

// ── 🚨 교안이 «시킨 차례대로» 따라가면 적힌 결과가 나오는가 ──────────────────
//
// 🚨 이 축이 없어서 진짜 결함이 통과했다. 위 축 ① 은 검사마다 DB 를 되돌려놓고 재는데,
//    «학생은 안 되돌린다». Step 1 이 남긴 좋아요 줄을 그대로 두고 Step 2 를 하면
//    `existing` 이 «있는» 것으로 읽혀 delete 로 가고, 교안이 적어둔 세 수치가 전부
//    어긋난다(130·[] → 130·["dahye"] · liked:true/131 → liked:false/129).
//    「각 Step 이 도는가」와 「Step 을 이어서 하면 도는가」는 다른 질문이다.

describe('Step 1 → Step 2 를 «이어서» 하면 교안의 수치가 그대로 나온다', () => {
  it('🔴 Step 1 이 어긋난 줄을 남기고, 교안이 그것을 치우라고 말한다', async () => {
    seedLive();
    await bootApp(crashApp(), 3458);
    await fetch(`${server.base}/api/posts/1/likes`,
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ userId: 1 }) });
    expect(await stateOfPost1()).toEqual({ likeCount: 130, likes: 1 });

    // 교안이 이 자리에서 «치우라»고 말해야 한다 — 안 말하면 다음 Step 이 통째로 어긋난다.
    const lec = read(LECTURE);
    const step1 = lec.slice(lec.indexOf('## Step 1'), lec.indexOf('## Step 2'));
    expect(step1, 'Step 1 끝에 되돌리라는 안내가 있어야 한다').toMatch(/npm run seed/);
  });

  it('🔴 되돌린 뒤 Step 2 를 하면 교안이 적어둔 그 값이 나온다', async () => {
    seedLive();                                   // 교안이 시킨 `npm run seed`
    const lec = read(LECTURE);

    // ① throw 가 살아 있는 묶은 판 — 롤백되어 아무것도 안 남는다
    await bootApp(transactionCrashApp(), 3459);
    const res = await fetch(`${server.base}/api/posts/1/likes`,
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ userId: 1 }) });
    expect(res.status).toBe(500);
    expect(await stateOfPost1(), '묶었으니 줄도 숫자도 안 남는다').toEqual({ likeCount: 130, likes: 0 });
    expect(lec).toContain('{"id":1, ... "likeCount":130, ...}');

    // ② throw 를 지운 판 — 교안이 적은 값 그대로
    await bootApp('app.js', 3460);
    const ok = await fetch(`${server.base}/api/posts/1/likes`,
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ userId: 1 }) }).then((r) => r.json());
    expect(ok).toEqual({ liked: true, likeCount: 131 });
    expect(lec, '교안이 적어둔 값과 같아야 한다').toContain('{"liked":true,"likeCount":131}');

    const likers = await fetch(`${server.base}/api/posts/1/likes`).then((r) => r.json());
    expect(likers).toEqual(['dahye']);
  });
});

// ── 축 ③ 바깥에서 본 모습이 그대로다 ────────────────────────────────────────
//
// 🚨 이 회차의 이득은 «덜 받아오는 것» 이지 «다르게 주는 것» 이 아니다.
//    그래서 판정을 「p2-34 판 앱과 응답이 글자 그대로 같은가」로 둔다 — 그 판을
//    실제로 띄워 같은 질문을 던지고 답을 견준다. 눈으로 고른 몇 칸만 보면
//    select 가 조용히 떨어뜨린 칸을 원리적으로 못 본다(실제로 authorId 가 그랬다).

const CONTRACT_PATHS = ['/api/posts', '/api/posts/1', '/api/posts?username=minji',
  '/api/posts?limit=2', '/api/posts/999', '/api/posts/abc', '/api/posts/1/likes'];

async function contractOf(base) {
  const out = {};
  for (const path of CONTRACT_PATHS) {
    const res = await fetch(`${base}${path}`);
    out[path] = [res.status, await res.text()];
  }
  return out;
}

describe('Step 6·7 — 읽는 방법을 갈았는데 응답은 한 글자도 안 달라졌다', () => {
  let before = null;

  it('p2-34 판 앱이 그대로 뜬다 (기준선)', async () => {
    seedLive();
    await bootApp('snapshots/p2-34-final/app.js', 3453);
    before = await contractOf(server.base);
    expect(Object.keys(before)).toHaveLength(CONTRACT_PATHS.length);
  });

  it('🔴 이 회차 최종판의 응답이 그 기준선과 «글자 그대로» 같다', async () => {
    await bootApp('snapshots/p2-35-final/app.js', 3454);
    expect(await contractOf(server.base)).toEqual(before);
  });

  it('🔴 그런데 읽어 오는 양은 «줄었다» — select 가 안 쓰는 칸을 안 싣는다', async () => {
    const src = read(P('services/postService.js'));
    expect(src, 'select 로 골라 받아야 한다').toContain('const postFields = {');
    expect(src, 'include 로 통째로 받는 자리가 남아 있으면 안 된다')
      .not.toMatch(/include:\s*withRelations/);
    expect(src, 'author 에게서 필요한 것은 둘뿐이다')
      .toContain("author: { select: { username: true, profileImage: true } }");
  });
});

// ── 축 ② 중첩 쓰기 — 게시물만 생기고 사진이 없는 상태가 못 생긴다 ────────────

describe('Step 4 — 게시물과 사진을 한 번에 만든다', () => {
  const newPost = {
    authorId: 1, content: '중첩 쓰기로 만든 글', postAlt: '설명',
    imageUrls: ['/images/new-1.jpg', '/images/new-2.jpg'],
  };

  it('🔴 한 번의 create 로 사진까지 함께 생긴다', async () => {
    seedLive();
    await bootApp('app.js', 3455);

    const res = await fetch(`${server.base}/api/posts`,
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(newPost) });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.imageUrls).toEqual(['/images/new-1.jpg', '/images/new-2.jpg']);

    const r = await db.query('select img_order, image_url from post_images where post_id = $1 order by img_order',
      [body.id]);
    expect(r.rows).toEqual([
      { img_order: 1, image_url: '/images/new-1.jpg' },
      { img_order: 2, image_url: '/images/new-2.jpg' },
    ]);
  });

  it('🔴 막히면 게시물도 «안 남는다» — 사진 없는 게시물이 못 생긴다', async () => {
    const posts = await db.query('select count(*)::int c from posts');

    const res = await fetch(`${server.base}/api/posts`, {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ ...newPost, authorId: 999 }),
    });

    expect(res.status).toBe(400);
    expect((await db.query('select count(*)::int c from posts')).rows[0].c,
      '막힌 요청이 게시물을 남기면 안 된다').toBe(posts.rows[0].c);
    expect((await db.query('select count(*)::int c from posts p where not exists (select 1 from post_images i where i.post_id = p.id)')).rows[0].c,
      '사진 없는 게시물은 0 이어야 한다').toBe(0);
  });

  it('🔴 시드도 게시물과 사진을 «한 번에» 만든다 — 번호를 다시 읽는 자리가 없다', () => {
    const src = read(P('seed.js'));
    expect(src, '중첩 쓰기여야 한다').toMatch(/images:\s*\{\s*\n?\s*create:/);
    expect(src, '게시물을 넣고 번호를 다시 읽어 사진을 넣던 두 박자가 사라져야 한다')
      .not.toContain('prisma.postImage.createMany');
  });

  it('🔴 그렇게 넣어도 데이터는 p2-34 판과 «글자 그대로» 같다', async () => {
    const dump = async () => {
      const q = (sql) => db.query(sql).then((r) => r.rows);
      return {
        users: await q('select id, username, profile_image from users order by id'),
        posts: await q('select id, author_id, post_alt, content, minutes_ago, like_count, comment_count from posts order by id'),
        images: await q('select id, post_id, image_url, img_order from post_images order by id'),
        comments: await q('select id, post_id, author_id, content, like_count, minutes_ago, parent_id from comments order by id'),
      };
    };

    seedFrozen();
    const old = await dump();
    seedLive();
    expect(await dump()).toEqual(old);
  });
});

// ── 축 ④ 질의 수와 _count ───────────────────────────────────────────────────

describe('Step 5·8 — 하나씩 돌기와 함께 읽기, 그리고 개수만 세기', () => {
  const runCheck = () =>
    execFileSync(process.execPath, [P('check.js')],
      { cwd: P('.'), encoding: 'utf8', env: { ...process.env, ...ENV } });

  it('🔴 check.js 가 11 번과 3 번을 찍는다 — 교안이 인용한 그 수치다', () => {
    seedLive();
    const out = runCheck();

    expect(out).toContain('하나씩 돌기 — 게시물 5개에 질의 11번');
    expect(out).toContain('함께 읽기 — 게시물 5개에 질의 3번');
  });

  it('🚨 그 수치가 «흔들리지» 않는다 — 세 번 돌려 같은 값', () => {
    for (let i = 0; i < 3; i += 1) {
      const out = runCheck();
      expect(out).toContain('질의 11번');
      expect(out).toContain('질의 3번');
    }
  });

  it('🔴 include 의 질의 수는 «줄 수» 가 아니라 «관계 가지 수» 를 따라간다', async () => {
    // 게시물을 배로 늘려도 질의 수가 그대로여야 N+1 이 아니다.
    await db.query(
      "insert into posts (author_id, content, minutes_ago) select author_id, content, minutes_ago from posts");
    const out = runCheck();

    expect(out, '게시물이 10개가 되면 하나씩 돌기는 21번으로 늘고').toContain('게시물 10개에 질의 21번');
    expect(out, '함께 읽기는 «그대로» 3번이다').toContain('게시물 10개에 질의 3번');

    seedLive();
  });
});

// ── 직접 해보기 — 서점 ──────────────────────────────────────────────────────

describe('직접 해보기 — 서점에도 같은 셋을', () => {
  let book = null;

  beforeAll(async () => {
    const admin = new pg.Client(BOOK_ADMIN);
    await admin.connect();
    await admin.query(
      "select pg_terminate_backend(pid) from pg_stat_activity where datname = 'p235_book_gate' and pid <> pg_backend_pid()");
    await admin.query('DROP DATABASE IF EXISTS p235_book_gate');
    await admin.query('CREATE DATABASE p235_book_gate');
    await admin.end();

    book = new pg.Client({ ...BOOK_ADMIN, database: 'p235_book_gate' });
    await book.connect();
    await setupP235Bookstore(book);

    // 🚨 학생 파일은 `../generated/index.js`(자기 클라이언트)를 부른다.
    //    게이트는 회차 클라이언트로 바꿔 끼워 돌린다 — 공유 클라이언트를 안 덮으려고.
    prismaCli(['generate', '--config', 'lab/p2-35/prisma.config.js'], { BOOKSTORE_URL: BOOK_GATE_URL });
    mkdirSync(P('__replay__'), { recursive: true });
    writeFileSync(P('__replay__/p235-bookstore.js'),
      read(P('lab/p2-35/bookstore.js')).replace("'../generated/index.js'", "'../lab/generated-p2-35/index.js'"));
    // 🚨 이 회차 실습은 «p2-34 실습을 끝낸» 서점 위에서 돈다 — 그 셋을 먼저 재생한다.
    for (const n of [1, 2, 3]) {
      writeFileSync(P(`__replay__/p235-p234-practice${n}.js`),
        read(P(`lab/p2-34/practice${n}.js`)).replace("'./bookstore.js'", "'./p235-bookstore.js'"));
      execFileSync(process.execPath, [P(`__replay__/p235-p234-practice${n}.js`)],
        { cwd: P('.'), encoding: 'utf8', env: { ...process.env, BOOKSTORE_URL: BOOK_GATE_URL } });
      writeFileSync(P(`__replay__/p235-practice${n}.js`),
        read(P(`lab/p2-35/practice${n}.js`)).replace("'./bookstore.js'", "'./p235-bookstore.js'"));
    }
  }, 180000);

  afterAll(async () => {
    if (book) await book.end();
    const admin = new pg.Client(BOOK_ADMIN);
    await admin.connect();
    await admin.query(
      "select pg_terminate_backend(pid) from pg_stat_activity where datname = 'p235_book_gate' and pid <> pg_backend_pid()");
    await admin.query('DROP DATABASE IF EXISTS p235_book_gate');
    await admin.end();
  }, 60000);

  const runPractice = (n) =>
    execFileSync(process.execPath, [P(`__replay__/p235-practice${n}.js`)],
      { cwd: P('.'), encoding: 'utf8', env: { ...process.env, BOOKSTORE_URL: BOOK_GATE_URL } });

  it('🔴 1 — 재고가 0 이 되면 품절로 바뀌고, 그다음엔 막힌다', async () => {
    const out = runPractice(1);

    expect(out).toContain('리팩터링 한 권 팔았어요 — 남은 재고 1, 품절 false');
    expect(out).toContain('리팩터링 한 권 팔았어요 — 남은 재고 0, 품절 true');
    expect(out).toContain('막혔어요: 품절이에요 — 리팩터링');

    const r = await book.query('select stock, is_sold_out from books where id = 2');
    expect(r.rows[0], '재고와 품절 표시가 «함께» 움직인다').toEqual({ stock: 0, is_sold_out: true });
  });

  it('🔴 2 — 책과 표지가 함께 생기고, 막히면 책도 안 남는다', async () => {
    const out = runPractice(2);

    expect(out).toContain('실용주의 프로그래머 — 사진 2장');
    expect(out).toContain('1. /covers/pragmatic-front.jpg');
    expect(out).toContain('2. /covers/pragmatic-back.jpg');
    expect(out).toContain('막혔어요: P2003');
    expect(out).toContain('책도 사진도 안 남았어요');

    const r = await book.query("select count(*)::int c from books where title = '안 만들어질 책'");
    expect(r.rows[0].c).toBe(0);
  });

  it('🔴 3 — 개수만 받으면 훨씬 가볍다', () => {
    const out = runPractice(3);

    expect(out).toContain('통째로 받기 — 1804바이트');
    expect(out).toContain('개수만 받기 — 425바이트');
    expect(out).toContain('1번 클린 코드 — 리뷰 3개');
    expect(out).toContain('7번 오브젝트 — 리뷰 0개');
    expect(out).toContain('9번 실용주의 프로그래머 — 리뷰 0개');
  });
});

// ── 과제 — 답안 코드가 실제로 돈다 ──────────────────────────────────────────

describe('과제 [기초]·[응용] — 답안이 실제로 돈다', () => {
  /** lab 파일을 __replay__ 로 옮겨 «학생과 같은 깊이» 에서 돌린다. */
  const labCopy = (serviceSource, port) => {
    mkdirSync(P('__replay__'), { recursive: true });
    for (const f of ['commentService.js', 'commentSchema.js', 'commentRoutes.js',
                     'homework1.js', 'homework2.js']) {
      // 🚨 학생 파일은 4001 로 박혀 있는데 앞 회차 게이트들도 그 포트를 쓴다.
      //    vitest 가 파일을 «병렬로» 돌리므로 사본만 다른 포트로 옮긴다.
      const src = f === 'commentService.js' ? serviceSource : `lab/p2-35/${f}`;
      writeFileSync(P(`__replay__/p235-${f}`), read(P(src))
        .replace("'./commentRoutes.js'", "'./p235-commentRoutes.js'")
        .replace("'./commentService.js'", "'./p235-commentService.js'")
        .replace("'./commentSchema.js'", "'./p235-commentSchema.js'")
        .replaceAll('4001', String(port)));
    }
  };

  const countOf = async (postId) => {
    const r = await db.query(
      `select p.comment_count w,
              (select count(*)::int from comments c where c.post_id = p.id and c.parent_id is null) a
       from posts p where p.id = $1`, [postId]);
    return { 적힌값: r.rows[0].w, 실제원댓글: r.rows[0].a };
  };

  it('🔴 [기초] select 로 갈아도 댓글 응답이 «글자 그대로» 같다', async () => {
    seedLive();

    labCopy('lab/p2-34/commentService.js', 4020);
    await bootApp('__replay__/p235-homework1.js', 4020, { PORT: undefined });
    const before = await fetch('http://127.0.0.1:4020/api/comments?postId=1').then((r) => r.text());
    const beforeOne = await fetch('http://127.0.0.1:4020/api/comments/1').then((r) => r.text());

    labCopy('snapshots/p2-35/commentService.select-only.js', 4021);
    await bootApp('__replay__/p235-homework1.js', 4021, { PORT: undefined });
    expect(await fetch('http://127.0.0.1:4021/api/comments?postId=1').then((r) => r.text())).toBe(before);
    expect(await fetch('http://127.0.0.1:4021/api/comments/1').then((r) => r.text())).toBe(beforeOne);

    const src = read(P('snapshots/p2-35/commentService.select-only.js'));
    expect(src, 'select 로 골라 받아야 한다').toContain('const commentFields = {');
    expect(src, 'authorId 를 빠뜨리면 응답에서 조용히 사라진다').toContain('authorId: true');
  });

  it('🔴 [응용] 원댓글을 만들고 지우면 comment_count 가 따라 움직인다', async () => {
    seedLive();
    labCopy('lab/p2-35/commentService.js', 4020);
    await bootApp('__replay__/p235-homework1.js', 4020, { PORT: undefined });

    expect(await countOf(1)).toEqual({ 적힌값: 3, 실제원댓글: 3 });

    const made = await fetch('http://127.0.0.1:4020/api/comments', {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ postId: 1, authorId: 1, content: '새 원댓글' }),
    }).then((r) => r.json());
    expect(await countOf(1)).toEqual({ 적힌값: 4, 실제원댓글: 4 });

    await fetch(`http://127.0.0.1:4020/api/comments/${made.id}`, { method: 'DELETE' });
    expect(await countOf(1)).toEqual({ 적힌값: 3, 실제원댓글: 3 });
  });

  it('🔴 [응용] 답글은 그 숫자에 «안» 센다', async () => {
    const root = await fetch('http://127.0.0.1:4020/api/comments', {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ postId: 1, authorId: 1, content: '원댓글' }),
    }).then((r) => r.json());
    expect(await countOf(1)).toEqual({ 적힌값: 4, 실제원댓글: 4 });

    for (const content of ['답글 하나', '답글 둘']) {
      await fetch('http://127.0.0.1:4020/api/comments', {
        method: 'POST', headers: JSON_HEADERS,
        body: JSON.stringify({ postId: 1, authorId: 1, content, parentId: root.id }),
      });
    }
    expect(await countOf(1), '답글 둘을 달아도 숫자는 그대로').toEqual({ 적힌값: 4, 실제원댓글: 4 });

    // 답글이 달린 원댓글을 지우면 답글도 함께 사라지는데, 답글은 애초에 안 셌으니 1 만 내린다.
    await fetch(`http://127.0.0.1:4020/api/comments/${root.id}`, { method: 'DELETE' });
    expect(await countOf(1)).toEqual({ 적힌값: 3, 실제원댓글: 3 });
  });

  it('🔴 [응용] 두 쓰기가 «묶여» 있다', () => {
    const src = read(P('lab/p2-35/commentService.js'));
    expect(src, '만들 때 묶여야 한다').toMatch(/prisma\.\$transaction\(async \(tx\) => \{[\s\S]*tx\.comment\.create/);
    expect(src, '지울 때도 묶여야 한다').toMatch(/prisma\.\$transaction\(async \(tx\) => \{[\s\S]*tx\.comment\.delete/);
    expect(src, '숫자 고치기도 같은 묶음 안이어야 한다').toMatch(/tx\.post\.update/);
  });

  it('🔴 homework2 의 보고표가 두 숫자를 나란히 찍는다', () => {
    seedLive();
    const out = execFileSync(process.execPath, [P('__replay__/p235-homework2.js')],
      { cwd: P('.'), encoding: 'utf8', env: { ...process.env, ...ENV } });

    expect(out).toContain('id   comment_count   실제 원댓글');
    expect(out).toContain('    1               3             3');
    expect(out).toContain('    4               0             0');
  });
});

// ── 교안 ↔ 코드베이스 — 인용한 것이 실재한다 ────────────────────────────────

describe('인용이 코드베이스와 맞는가', () => {
  const blocksOf = (path, lang) =>
    [...read(path).matchAll(new RegExp('```' + lang + '\\n([\\s\\S]*?)```', 'g'))].map((m) => m[1].trimEnd());

  const jsSources = () => [
    'services/postService.js', 'services/likeService.js', 'seed.js', 'check.js',
    'db.js', 'errors.js', 'routes/posts.js', 'schemas/postSchema.js',
    // 교안이 「지난 시간에 쓴 것」으로 싣는 판 — 그 시점 스냅숏이 출처다.
    'snapshots/p2-34-final/services/likeService.js',
    'snapshots/p2-34-final/services/postService.js',
    // Step 1 이 «잠깐 넣었다 뺄» 한 줄 · Step 4 시점 판 · Step 6 의 로그 스위치
    'snapshots/p2-35/likeService.crash.js',
    'snapshots/p2-35/postService.step4.js',
    'snapshots/p2-35/db.logging.js',
    // 교안이 「이렇게 적으면」으로만 보여주는 둘 — 실제로 도는 판을 얼려 잠근다.
    'snapshots/p2-35/array-form.js',
    'snapshots/p2-35/count-demo.js',
    'snapshots/p2-35/n-plus-one.js',
    'snapshots/p2-35/select-include-conflict.js',
    // 답안의 과제 코드
    'snapshots/p2-35/commentService.select-only.js',
    'lab/p2-35/commentService.js', 'lab/p2-35/commentSchema.js',
    'lab/p2-35/commentRoutes.js', 'lab/p2-35/homework1.js', 'lab/p2-35/homework2.js',
    'lab/p2-35/practice1.js', 'lab/p2-35/practice2.js', 'lab/p2-35/practice3.js',
    'lab/p2-35/bookstore.js',
  ].map((f) => read(P(f)));

  const squash = (t) => t.split('\n').map((l) => l.trim().replace(/\s+/g, ' ')).join('\n');

  /** 주석·빈 줄·닫는 괄호를 걷어낸 «의미 있는 줄» — 교안은 발췌를 조각으로 싣는다. */
  const meaningful = (block) =>
    block.split('\n').map((l) => l.trim())
      .filter((l) => l && l !== '...' && !l.startsWith('//') && !/^[}\])]+,?;?$/.test(l))
      .map((l) => l.replace(/\s+/g, ' '));

  it('🔴 교안·답안의 ```javascript 줄이 전부 코드베이스에 실재한다', () => {
    // 🚨 답안도 본다 — 과제 코드가 여기 실리는데 교안만 보면 그 몫이 통째로 무검사다.
    const srcs = jsSources().map(squash);
    const missing = [];
    for (const b of [...blocksOf(LECTURE, 'javascript'), ...blocksOf(ANSWERS, 'javascript')]) {
      for (const line of meaningful(b)) {
        if (!srcs.some((s) => s.includes(line))) missing.push(line);
      }
    }
    expect(missing).toEqual([]);
  });

  it('🔴 교안이 인용한 SQL 로그가 «실제로 찍히는» 그것과 같다', async () => {
    seedLive();
    // Step 6 은 include 판, Step 7 은 select 판의 로그를 싣는다. 둘 다 실제로 띄워서 받는다.
    mkdirSync(P('__replay__/p235'), { recursive: true });
    const grab = async (serviceSrc, port) => {
      writeFileSync(P('__replay__/p235/db.js'), read(P('snapshots/p2-35/db.logging.js'))
        .replace("'@prisma/adapter-pg'", "'@prisma/adapter-pg'"));
      writeFileSync(P('__replay__/p235/postService.js'), read(P(serviceSrc))
        .replace("'../db.js'", "'./db.js'").replace("'../errors.js'", "'../../errors.js'"));
      writeFileSync(P('__replay__/p235/likeService.js'), read(P('services/likeService.js'))
        .replace("'../db.js'", "'./db.js'").replace("'../errors.js'", "'../../errors.js'"));
      writeFileSync(P('__replay__/p235/posts.js'), read(P('routes/posts.js'))
        .replace(/'\.\.\/services\//g, "'./")
        .replace("'../middlewares/", "'../../middlewares/")
        .replace("'../schemas/", "'../../schemas/")
        .replace("'../errors.js'", "'../../errors.js'"));
      writeFileSync(P('__replay__/p235/app.log.js'), read(P('app.js'))
        .replace("'./routes/posts.js'", "'./posts.js'")
        .replace("'./errors.js'", "'../../errors.js'"));
      await bootApp('__replay__/p235/app.log.js', port);
      await fetch(`${server.base}/api/posts`);
      await new Promise((r) => setTimeout(r, 300));
      return server.tail().split('\n').filter((l) => l.startsWith('prisma:query'));
    };

    const lec = read(LECTURE);
    const withInclude = await grab('snapshots/p2-34-final/services/postService.js', 3456);
    const withSelect = await grab('services/postService.js', 3457);

    expect(withInclude, 'include 판은 질의 3개').toHaveLength(3);
    expect(withSelect, 'select 판도 질의 3개').toHaveLength(3);
    // 교안이 실은 줄이 실제 로그에 «글자 그대로» 있어야 한다.
    for (const line of [...withInclude, withSelect[1], withSelect[2]]) {
      expect(lec, line.slice(0, 60)).toContain(line);
    }
    // 그리고 select 판에서 사라진 칸이 실제로 사라졌는지.
    expect(withInclude[1]).toContain('deactivated_at');
    expect(withSelect[1], 'select 로 바꾸면 안 쓰는 칸이 빠진다').not.toContain('deactivated_at');
  });

  it('🔴 교안이 더하라고 한 `.http` 요청 셋이 코드베이스에도 있다', () => {
    // 🚨 이 축이 없어서 교안이 「posts.http 에서 좋아요를 눌러봐요」라고 했는데
    //    그 파일에는 «3번 게시물 · userId 2» 만 있었다. 그대로 누르면 이 회차 장면이
    //    한 줄도 재현되지 않는다(3번은 like_count 76 이고 누르는 사람도 다르다).
    const http = read(P('requests/posts.http'));
    for (const line of [
      'GET http://localhost:3000/api/posts/1',
      'POST http://localhost:3000/api/posts/1/likes',
      'GET http://localhost:3000/api/posts/1/likes',
    ]) expect(http, line).toContain(line);
    expect(http, '누르는 사람은 dahye(1) 여야 한다').toMatch(/posts\/1\/likes[\s\S]{0,80}"userId": 1/);

    // 교안이 그 셋을 «더하라고» 말하는지도 함께 본다.
    expect(read(LECTURE), '더하라는 안내').toMatch(/`requests\/posts\.http` 맨 아래에 요청 셋을 더해/);
  });

  it('🔴 Step 8 이 `$disconnect` 를 남기라고 말한다 — 안 그러면 10초 멈춘다', () => {
    // 🚨 `p2-31` 이 실측해둔 그 10.1초. 학생은 「멈췄다」로 읽고 Ctrl+C 를 누른다.
    const lec = read(LECTURE);
    const step8 = lec.slice(lec.indexOf('## Step 8'));
    expect(step8, '맨 아래 $disconnect 줄을 그대로 두라고 말해야 한다')
      .toMatch(/\$disconnect\(\);` 줄은 그대로 둬요/);
  });

  it('🔴 교안이 인용한 트랜잭션 타임아웃 메시지가 실제 출력과 같다', () => {
    for (const phrase of [
      'Transaction API error: A commit cannot be executed on an expired transaction.',
      'The timeout for this transaction was 5000 ms',
      'Consider increasing the interactive transaction',
    ]) expect(read(LECTURE), phrase.slice(0, 40)).toContain(phrase);
  });

  it('🔴 「select 와 include 를 같이 쓰면 거절한다」가 «실제로» 그렇다', () => {
    const out = execFileSync(process.execPath, [P('snapshots/p2-35/select-include-conflict.js')],
      { cwd: P('.'), encoding: 'utf8', env: { ...process.env, ...ENV } });

    expect(out, '통과하면 교안의 주장이 거짓이다').toContain('막혔어요: PrismaClientValidationError');
  });

  it('교안과 답안이 둘 다 있다', () => {
    expect(exists(LECTURE), '교안').toBe(true);
    expect(exists(ANSWERS), '답안').toBe(true);
  });
});
