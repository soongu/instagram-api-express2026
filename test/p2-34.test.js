// p2-34 「한 칸으로 안 되는 관계들 — post_images · 자기 참조 · N:M」 게이트
//
// 🚨 진짜 instagram·bookstore DB 를 안 건드린다 — 전용 DB 를 p2-33 종료 상태로 세워서 쓴다.
// 🚨 이 회차의 판정 축은 셋이다.
//    ① «칸을 늘리는 대신 줄을 늘렸는가» — 사진이 표로 나가고 옛 칸이 사라진 뒤에도
//       5장이 하나도 안 없어져야 한다. 마이그레이션이 데이터를 살려 건너보내는 축이다.
//    ② «세 관계가 실제로 막을 것을 막는가» — 자기 참조는 남의 글 답글을 막고,
//       N:M 은 같은 사람이 두 번 누르는 것을 막는다. 「적어두기만 한 규칙」이 아니다.
//    ③ «바깥에서 본 모습» — 응답에 imageUrls 가 배열로 실린다.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import pg from 'pg';
import { boot } from './helpers/boot.js';
import { setupP234, setupP234Bookstore, P234_LAB_MIGRATIONS } from '../sql/p2-34/setup.mjs';

const ROOT = new URL('../', import.meta.url);
const P = (rel) => new URL(rel, ROOT).pathname;
const ADMIN = { host: 'localhost', port: 5432, database: 'postgres', user: 'postgres', password: 'postgres' };
const GATE_URL = 'postgresql://postgres:postgres@localhost:5432/p234_gate';
const SHADOW_URL = 'postgresql://postgres:postgres@localhost:5432/p234_shadow';
const BOOK_ADMIN = { ...ADMIN, port: 5433 };
const BOOK_GATE_URL = 'postgresql://postgres:postgres@localhost:5433/p234_book_gate';
const ENV = { DATABASE_URL: GATE_URL };
const JSON_HEADERS = { 'Content-Type': 'application/json' };

const LECTURE = P('../../part2/5-db-prisma/p2-34-more-relations-lecture.md');
const ANSWERS = P('../../part2/5-db-prisma/p2-34-more-relations-answers.md');
const read = (p) => readFileSync(p, 'utf8');
const exists = (p) => { try { readFileSync(p); return true; } catch { return false; } };

let db = null;
let server = null;

const prismaCli = (args, env = {}) =>
  execFileSync(P('node_modules/.bin/prisma'), args, {
    cwd: P('.'), encoding: 'utf8',
    env: { ...process.env, ...ENV, SHADOW_DATABASE_URL: SHADOW_URL, ...env },
  });

/** 이 회차가 만드는 마이그레이션 — 착수 상태 위에 이것만 얹는다. */
const P234_MIGRATIONS = [
  '20261001142735_add_post_images',
  '20261001142828_move_images_to_table',
  '20261001143803_add_comment_replies',
  '20261001144541_add_post_likes',
];

async function applyRoundMigrations() {
  for (const dir of P234_MIGRATIONS) {
    await db.query(read(P(`prisma/migrations/${dir}/migration.sql`)));
  }
}

async function bootApp(file, port) {
  if (server) { await server.stop(); server = null; await new Promise((r) => setTimeout(r, 150)); }
  server = await boot(file, { port, env: { ...ENV, PORT: String(port) }, ready: `${port}번 포트에서` });
  return server;
}

/** 착수 상태의 데이터를 넣는다 — p2-33 이 얼려둔 시드(그 시점 클라이언트를 쓴다). */
const seedFrozen = () =>
  execFileSync(process.execPath, [P('snapshots/p2-33-final/seed.js')],
    { cwd: P('.'), encoding: 'utf8', env: { ...process.env, ...ENV } });

/** 이 회차가 고친 시드 — 🚨 `p2-35` 가 중첩 쓰기로 다시 고치므로 그 «시점» 을 얼려서 본다. */
const seedLive = () =>
  execFileSync(process.execPath, [P('snapshots/p2-34-final/seed.js')],
    { cwd: P('.'), encoding: 'utf8', env: { ...process.env, ...ENV } });

beforeAll(async () => {
  const admin = new pg.Client(ADMIN);
  await admin.connect();
  for (const name of ['p234_gate', 'p234_shadow']) {
    await admin.query(
      `select pg_terminate_backend(pid) from pg_stat_activity where datname = '${name}' and pid <> pg_backend_pid()`);
    await admin.query(`DROP DATABASE IF EXISTS ${name}`);
    await admin.query(`CREATE DATABASE ${name}`);
  }
  await admin.end();

  db = new pg.Client({ ...ADMIN, database: 'p234_gate' });
  await db.connect();
  await setupP234(db);

  // 착수 상태의 데이터를 넣은 «뒤에» 이 회차 마이그레이션을 얹는다 —
  // 「이미 들어 있는 다섯 장이 살아서 건너오는가」가 축 ① 이라 순서가 뒤집히면 안 본 것이 된다.
  seedFrozen();
  await applyRoundMigrations();
}, 120000);

afterAll(async () => {
  if (server) await server.stop();
  if (db) await db.end();
  const admin = new pg.Client(ADMIN);
  await admin.connect();
  for (const name of ['p234_gate', 'p234_shadow']) {
    await admin.query(
      `select pg_terminate_backend(pid) from pg_stat_activity where datname = '${name}' and pid <> pg_backend_pid()`);
    await admin.query(`DROP DATABASE IF EXISTS ${name}`);
  }
  await admin.end();
}, 60000);

// ── 축 ① 사진이 칸에서 표로 — 다섯 장이 하나도 안 없어진다 ──────────────────

describe('Step 1·2 — 사진을 표로 빼면서 다섯 장을 살려 보낸다', () => {
  it('착수 상태에는 사진이 posts 의 칸 하나였다 (옮기고 나면 그 칸이 없다)', async () => {
    const r = await db.query(
      "select column_name from information_schema.columns where table_name = 'posts' and column_name = 'post_image'");
    expect(r.rows, 'post_image 칸은 옮긴 뒤 사라져야 한다').toEqual([]);
  });

  it('🔴 다섯 장이 post_images 로 건너왔다 — 한 장도 안 잃는다', async () => {
    const r = await db.query('select post_id, image_url, img_order from post_images order by post_id');
    expect(r.rows).toEqual([
      { post_id: 1, image_url: '/images/post-1.jpg', img_order: 1 },
      { post_id: 2, image_url: '/images/post-2.jpg', img_order: 1 },
      { post_id: 3, image_url: '/images/post-3.jpg', img_order: 1 },
      { post_id: 4, image_url: '/images/post-6.jpg', img_order: 1 },
      { post_id: 5, image_url: '/images/post-7.jpg', img_order: 1 },
    ]);
  });

  it('게시물을 지우면 그 사진 줄도 함께 사라진다 (onDelete: Cascade)', async () => {
    await db.query('insert into post_images (post_id, image_url, img_order) values (5, $1, 2)', ['/images/post-7b.jpg']);
    const before = await db.query('select count(*)::int c from post_images where post_id = 5');
    expect(before.rows[0].c).toBe(2);

    await db.query('delete from comments where post_id = 5');
    await db.query('delete from posts where id = 5');

    const after = await db.query('select count(*)::int c from post_images where post_id = 5');
    expect(after.rows[0].c, '게시물이 사라지면 사진도 따라가야 한다').toBe(0);
  });
});

// ── 축 ③ 바깥에서 본 모습 — 사진이 배열로 나간다 ────────────────────────────

describe('Step 3 — 응답에 imageUrls 가 배열로 실린다', () => {
  beforeAll(async () => {
    // 🚨 여기부터는 «고친» 시드다 — post_images 를 비우는 목록에 넣고 사진을 여러 장 넣는다.
    //    안 고치면 TRUNCATE 가 「외래 키가 걸린 테이블은 못 비운다」로 막힌다.
    // Step 3 시점 시드 사본을 만들어 둔다(학생과 같은 깊이에서 돌게).
    mkdirSync(P('__replay__'), { recursive: true });
    writeFileSync(P('__replay__/p234-seed-step3.mjs'),
      read(P('snapshots/p2-34/seed.step3.js')).replace(/from '\.\//g, "from '../"));

    seedLive();
    // 🚨 이 회차의 앱을 띄운다 — p2-35 판을 띄우면 그 회차가 고친 select·$transaction 을
    //    p2-34 교안의 주장으로 재게 된다(audit retrofit 때 실제로 그래서 빨개졌다).
    await bootApp('snapshots/p2-34-final/app.js', 3441);
  }, 60000);

  it('🚨 Step 3 시점 시드가 실제로 돌고, 교안이 인용한 그 줄을 찍는다', async () => {
    // 🚨 그때는 post_likes 도 답글도 «없다». 게이트 DB 에는 있으므로 그 시점 DB 를 따로 세운다
    //    (있는 채로 돌리면 교안이 말한 그 TRUNCATE 실패가 나는 것이 맞다).
    const admin = new pg.Client(ADMIN);
    await admin.connect();
    await admin.query('DROP DATABASE IF EXISTS p234_step3_gate');
    await admin.query('CREATE DATABASE p234_step3_gate');
    await admin.end();

    const step3 = new pg.Client({ ...ADMIN, database: 'p234_step3_gate' });
    await step3.connect();
    await setupP234(step3);
    for (const dir of P234_MIGRATIONS.slice(0, 2)) {
      await step3.query(read(P(`prisma/migrations/${dir}/migration.sql`)));
    }
    await step3.end();

    const out = execFileSync(process.execPath, [P('__replay__/p234-seed-step3.mjs')],
      { cwd: P('.'), encoding: 'utf8',
        env: { ...process.env, DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/p234_step3_gate' } });

    expect(out.trim()).toBe('사람 5명, 게시물 5개, 사진 8장, 댓글 9개를 넣었어요.');
    expect(read(LECTURE)).toContain('사람 5명, 게시물 5개, 사진 8장, 댓글 9개를 넣었어요.');

    const admin2 = new pg.Client(ADMIN);
    await admin2.connect();
    await admin2.query('DROP DATABASE IF EXISTS p234_step3_gate');
    await admin2.end();
  }, 60000);

  it('🔴 목록 응답이 postImage 대신 imageUrls 배열을 싣는다', async () => {
    const res = await fetch('http://127.0.0.1:3441/api/posts');
    const posts = await res.json();

    expect(res.status).toBe(200);
    expect(posts).toHaveLength(5);
    for (const post of posts) {
      expect(post, 'postImage 는 이제 없다').not.toHaveProperty('postImage');
      expect(Array.isArray(post.imageUrls), 'imageUrls 는 배열이다').toBe(true);
    }
  });

  it('🔴 사진이 여럿인 게시물은 img_order 차례대로 나온다', async () => {
    const res = await fetch('http://127.0.0.1:3441/api/posts/2');
    const post = await res.json();

    expect(post.imageUrls).toEqual(['/images/post-2.jpg', '/images/post-2b.jpg']);
  });

  it('글쓴이 이름은 지난 시간 그대로 평평하게 실린다', async () => {
    const res = await fetch('http://127.0.0.1:3441/api/posts/2');
    const post = await res.json();

    expect(post.username).toBe('minji');
    expect(post).not.toHaveProperty('author');
    expect(post).not.toHaveProperty('images');
  });

  it('🔴 게시물을 만들 때 사진을 여러 장 함께 보낸다', async () => {
    const res = await fetch('http://127.0.0.1:3441/api/posts', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        authorId: 1,
        postAlt: '두 장짜리',
        content: '사진 두 장을 올려봐요',
        imageUrls: ['/images/post-8.jpg', '/images/post-9.jpg'],
      }),
    });
    const post = await res.json();

    expect(res.status).toBe(201);
    expect(post.imageUrls).toEqual(['/images/post-8.jpg', '/images/post-9.jpg']);
    expect(post.username).toBe('dahye');
  });

  it('🚨 `.http` 의 「없는 사람 번호」 요청이 뜻을 잃지 않는다 — imageUrls 를 빼면 다른 400 이 온다', async () => {
    // 🚨 교안이 고치라고 한 두 곳 중 하나를 빠뜨리면 이 요청이 조용히 죽는다.
    //    Zod 가 먼저 걸어서 「그런 사용자는 없어요」 대신 「규칙에 안 맞아요」가 온다.
    const http = read(P('requests/posts.http'));
    expect(http, '학생이 고칠 대상이 코드베이스에도 반영돼야 한다').not.toContain('postImage');

    const body = { authorId: 999, imageUrls: ['/images/post-8.jpg'] };
    const good = await fetch('http://127.0.0.1:3441/api/posts',
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) });
    expect(good.status).toBe(400);
    expect((await good.json()).message).toBe('그런 사용자는 없어요');

    // 사진을 빼면 «다른» 400 이 온다 — 그것이 교안이 경고한 그 장면이다.
    const bad = await fetch('http://127.0.0.1:3441/api/posts',
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ authorId: 999 }) });
    expect(bad.status).toBe(400);
    expect((await bad.json()).message).toBe('보낸 내용이 규칙에 안 맞아요');
  });

  it('사진을 한 장도 안 보내면 400 이다 — 사진 없는 게시물은 없다', async () => {
    const res = await fetch('http://127.0.0.1:3441/api/posts', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ authorId: 1, content: '사진이 없어요', imageUrls: [] }),
    });

    expect(res.status).toBe(400);
  });
});

// ── 축 ② 자기 참조 — 같은 표가 자기를 가리킨다 ──────────────────────────────

describe('Step 4·5 — 답글은 같은 표에 들어가고 parent_id 로 원댓글을 가리킨다', () => {
  beforeAll(() => { seedLive(); }, 60000);

  it('🚨 Step 5 의 check.js 가 실제로 돌고, 교안이 인용한 줄이 그대로 나온다', () => {
    // 🚨 학생은 이 파일에 «더하는» 것이지 갈아치우는 것이 아니다 —
    //    그래서 위쪽에 p2-33 이 남긴 「N번 {postAlt} — 댓글 N개」 줄이 먼저 찍힌다.
    const out = execFileSync(process.execPath, [P('snapshots/p2-34-final/check.js')],
      { cwd: P('.'), encoding: 'utf8', env: { ...process.env, ...ENV } });

    for (const line of [
      'comments 테이블의 행은 모두 12개예요.',
      '그중 원댓글은 9개고, 나머지는 어딘가에 달린 답글이에요.',
      '1번 "저도 가봤어요" — 답글 2개',
      '    └ 10번 "다음엔 같이 가요"',
      '    └ 11번 "저도 껴주세요"',
      '2번 "사진 잘 나왔네요" — 답글 0개',
      '3번 "다음에 같이 가요" — 답글 0개',
      '4번 "크루아상 색이 좋네요" — 답글 1개',
      '    └ 12번 "이번엔 잘 구워졌어요"',
      '5번 "레시피 공유해주세요" — 답글 0개',
    ]) {
      expect(out, `실행 출력에 없다 — ${line}`).toContain(line);
      expect(read(LECTURE), `교안에 없다 — ${line}`).toContain(line);
    }

    // 🚨 교안 본문이 근거로 쓰는 «생략된 위쪽» 줄 — 이것이 없으면
    //    「1번 게시물의 댓글이 3개가 아니라 5개로 나온 것도」가 가리킬 데가 없어진다.
    expect(out, '원댓글 3 + 답글 2 = 5').toContain('1번 노을 진 한강 — 댓글 5개');
    expect(read(LECTURE)).toContain('1번 게시물의 댓글이 3개가 아니라 5개로 나온 것도');
  });

  it('🔴 댓글 표에 답글까지 12줄이 들어가고, 원댓글은 9개다', async () => {
    const r = await db.query(`
      select count(*)::int total,
             count(*) filter (where parent_id is null)::int roots,
             count(*) filter (where parent_id is not null)::int replies
      from comments`);

    expect(r.rows[0]).toEqual({ total: 12, roots: 9, replies: 3 });
  });

  it('답글은 원댓글과 «같은 게시물» 에 달려 있다', async () => {
    const r = await db.query(`
      select count(*)::int n from comments child
      join comments parent on parent.id = child.parent_id
      where child.post_id <> parent.post_id`);

    expect(r.rows[0].n, '게시물이 어긋난 답글이 있으면 안 된다').toBe(0);
  });

  it('🔴 원댓글만 걸러 읽으면 답글이 딸려 온다', async () => {
    // 🚨 `p2-35` 가 `check.js` 를 질의 «세는» 도구로 다시 쓴다 — 그 «시점» 을 얼려서 돌린다.
    const out = execFileSync(process.execPath, [P('snapshots/p2-34-final/check.js')],
      { cwd: P('.'), encoding: 'utf8', env: { ...process.env, ...ENV } });

    expect(out).toContain('comments 테이블의 행은 모두 12개예요.');
    expect(out).toContain('그중 원댓글은 9개고');
    expect(out).toContain('1번 "저도 가봤어요" — 답글 2개');
    expect(out).toContain('4번 "크루아상 색이 좋네요" — 답글 1개');
  });

  it('🚨 답글 시드의 바깥을 map 으로 쓰면 배열 9개가 넘어가 Prisma 가 거절한다 — 그래서 flatMap 이다', async () => {
    // 🚨 교안 Step 5 의 flatMap 그림이 기대는 사실 — 원댓글 9개 중 답글이 있는 것은 1번·4번뿐이라
    //    안쪽 map 은 배열 9개(빈 배열 7개)를 돌려주고, 펴면 답글 3개만 남는다.
    const { comments } = await import(P('snapshots/p2-34-final/data/comments.js'));
    const inner = comments.map((comment) => comment.replies ?? []);
    expect(inner.map((replies) => replies.length)).toEqual([2, 0, 0, 1, 0, 0, 0, 0, 0]);
    expect(inner.flat()).toHaveLength(3);

    // 학생이 바깥을 map 으로 적었을 때 실제로 무엇이 나오나 — 이 회차 끝 시드에서 그 한 곳만 바꾼다.
    const live = read(P('snapshots/p2-34-final/seed.js'));
    expect(live).toContain('data: createdComments.flatMap((comment, index) =>');
    mkdirSync(P('__replay__'), { recursive: true });
    writeFileSync(P('__replay__/p234-seed-map.mjs'), live
      .replace('createdComments.flatMap(', 'createdComments.map(')
      .replace(/from '\.\//g, "from '../snapshots/p2-34-final/"));

    let stderr = '';
    try {
      execFileSync(process.execPath, [P('__replay__/p234-seed-map.mjs')],
        { cwd: P('.'), encoding: 'utf8', stdio: 'pipe', env: { ...process.env, ...ENV } });
    } catch (e) {
      stderr = e.stderr;
    } finally {
      // 답글만 빠진 채 멈춘 DB 를 이 회차 끝 상태로 되돌린다 — 아래 축이 12줄을 센다.
      seedLive();
    }

    expect(stderr, '시드가 답글을 넣는 줄에서 멈춰야 한다').toContain('PrismaClientValidationError');
    expect(stderr).toContain('Argument `data`: Invalid value provided.');
    for (const phrase of ['PrismaClientValidationError', 'Invalid value provided', '배열 9개가 든 배열']) {
      expect(read(LECTURE), `교안에 없다 — ${phrase}`).toContain(phrase);
    }
  }, 60000);

  it('🔴 없는 댓글에 답글을 달면 막힌다 — 자기 표라고 봐주지 않는다', async () => {
    await expect(db.query(
      'insert into comments (post_id, author_id, content, parent_id) values (1, 1, $1, 999)',
      ['없는 댓글에 다는 답글'],
    )).rejects.toMatchObject({ code: '23503' });
  });

  it('🔴 원댓글을 지우면 그 답글도 함께 사라진다 (onDelete: Cascade)', async () => {
    const before = await db.query('select count(*)::int c from comments');
    expect(before.rows[0].c).toBe(12);

    await db.query('delete from comments where id = 1');

    const after = await db.query(`
      select count(*)::int total, count(*) filter (where parent_id = 1)::int orphans from comments`);
    expect(after.rows[0], '원댓글 1 + 답글 2 = 3줄이 사라진다').toEqual({ total: 9, orphans: 0 });
  });
});

// ── 축 ② N:M — 가운데 표가 「누가 어디에」 한 쌍을 받는다 ────────────────────

describe('Step 6·7 — 좋아요는 가운데 표가 받고, 같은 쌍은 한 번만 들어간다', () => {
  beforeAll(async () => {
    seedLive();
    await bootApp('snapshots/p2-34-final/app.js', 3442);
  }, 60000);

  it('🔴 암묵적 N:M 으로 적으면 칸 이름이 A·B 가 된다 — 그래서 안 쓴다', () => {
    // 🚨 이 회차가 «명시적 중간 모델» 을 고른 근거다. 학생은 p2-27·p2-28 에서
    //    원시 SQL 로 표를 열어보는 법을 배웠는데, A·B 로는 무엇이 무엇인지 모른다.
    const file = P('snapshots/p2-34/implicit-nm.prisma');
    const sql = prismaCli(['migrate', 'diff', '--from-empty', '--to-schema', file, '--script']);

    expect(sql).toContain('CREATE TABLE "_Likes"');
    expect(sql).toContain('"A" INTEGER NOT NULL');
    expect(sql).toContain('"B" INTEGER NOT NULL');
  });

  it('🔴 우리 표는 이름이 있는 칸을 갖고, 같은 쌍에 UNIQUE 가 걸린다', async () => {
    const cols = await db.query(
      "select column_name from information_schema.columns where table_name = 'post_likes' order by ordinal_position");
    expect(cols.rows.map((r) => r.column_name)).toEqual(['id', 'post_id', 'user_id']);

    await db.query('insert into post_likes (post_id, user_id) values (1, 2)');
    await expect(db.query('insert into post_likes (post_id, user_id) values (1, 2)'))
      .rejects.toMatchObject({ code: '23505' });
    await db.query('delete from post_likes where post_id = 1 and user_id = 2');
  });

  // 🔀 2026-10-01 사용자 결정 — 토글(`POST /likes` 한 주소) 대신 누르기·취소를 나눈다.
  //    같은 요청을 두 번 보내도(응답을 못 받아 다시 보냄 · 더블클릭 · 탭 둘) 결과가 같아야 한다.
  const likeUrl = (postId, userId) => `http://127.0.0.1:3442/api/posts/${postId}/likes/${userId}`;
  const send = (method, postId, userId) =>
    fetch(likeUrl(postId, userId), { method }).then(async (r) => ({ status: r.status, body: await r.json() }));
  const rowsOf = async (postId) =>
    (await db.query('select count(*)::int c from post_likes where post_id = $1', [postId])).rows[0].c;

  it('🔴 누르기를 두 번 보내도 결과가 같다 — 줄도 숫자도 한 번만 늘어난다', async () => {
    const first = await send('PUT', 3, 2);
    expect(first).toEqual({ status: 200, body: { liked: true, likeCount: 77 } });   // 시드가 76 으로 넣는다

    const again = await send('PUT', 3, 2);
    expect(again, '두 번째도 같은 답').toEqual({ status: 200, body: { liked: true, likeCount: 77 } });
    expect(await rowsOf(3), '줄은 하나뿐').toBe(1);
  });

  it('🔴 취소를 두 번 보내도 결과가 같다 — 숫자가 시작값 아래로 안 내려간다', async () => {
    const first = await send('DELETE', 3, 2);
    expect(first).toEqual({ status: 200, body: { liked: false, likeCount: 76 } });

    const again = await send('DELETE', 3, 2);
    expect(again, '두 번째도 같은 답').toEqual({ status: 200, body: { liked: false, likeCount: 76 } });
    expect(await rowsOf(3), '줄도 사라진다').toBe(0);
  });

  it('🔴 좋아요는 게시물을 «고친» 것이 아니다 — 누르고 취소해도 posts.updated_at 이 그대로다', async () => {
    // 🔀 2026-10-01 사용자 결정 — Prisma 의 post.update 로 숫자를 고치면 @updatedAt 이 「게시물을 고친 시각」을
    //    바꾼다(p2-29 정의 「마지막으로 고친 시각」 · p2-36 「updatedAt 은 게시물을 고친 시각」과 어긋난다).
    //    좋아요 수만 $executeRaw 로 고친다 — p2-29 ⚠️ 「SQL UPDATE 로 고치면 updated_at 은 그대로」의 회수.
    const at = async () => (await db.query('select updated_at from posts where id = 4')).rows[0].updated_at.toISOString();
    const before = await at();
    await new Promise((r) => setTimeout(r, 20));
    await send('PUT', 4, 5);
    await send('PUT', 4, 5);
    await send('DELETE', 4, 5);
    await send('DELETE', 4, 5);
    expect(await at()).toBe(before);
  });

  it('🚨 같은 누르기가 «동시에» 열 번 와도 줄 하나 · 숫자 +1 — 넣을지 말지를 데이터베이스가 정한다', async () => {
    // 🚨 응답에 실린 숫자는 요청마다 다를 수 있다 — 넣은 요청이 숫자를 고치기 «전에» 답한 요청이 있을 수
    //    있어서다(그 틈은 p2-35 트랜잭션의 몫). 여기서는 «끝난 뒤의 테이블» 만 본다.
    const before = (await db.query('select like_count from posts where id = 5')).rows[0].like_count;
    const all = await Promise.all(Array.from({ length: 10 }, () => send('PUT', 5, 4)));
    expect(all.map((r) => r.status)).toEqual(Array(10).fill(200));
    expect(await rowsOf(5)).toBe(1);
    const after = (await db.query('select like_count from posts where id = 5')).rows[0].like_count;
    expect(after, '숫자도 한 번만 오른다').toBe(before + 1);
    await send('DELETE', 5, 4);
  });

  it('🚨 p2-35 오프닝 재료 — 행만 들어가고 숫자는 안 오른 채 멈춘 뒤에 다시 누르면, 숫자는 끝내 안 오른다', async () => {
    // 이 회차 예고는 「행은 들어갔는데 숫자는 안 올라간 상태로 남아요」까지만 말한다 — 「다시 누르면」·「취소하면」은
    // p2-35 오프닝이 쓸 재료라 일부러 안 팔았다(progress/like-split-plan.md). 두 번의 쓰기 사이에서 멈춘 상태를
    // 행만 손으로 넣어 만든다 — 다시 누르면 행이 이미 있으니 count 0, 숫자는 그대로다.
    const before = (await db.query('select like_count from posts where id = 2')).rows[0].like_count;
    await db.query('insert into post_likes (post_id, user_id) values (2, 1)');

    const retry = await send('PUT', 2, 1);
    expect(retry).toEqual({ status: 200, body: { liked: true, likeCount: before } });
    expect(await rowsOf(2)).toBe(1);

    // 그 상태에서 취소하면 시작값보다 하나 «내려간다»
    const undo = await send('DELETE', 2, 1);
    expect(undo.body).toEqual({ liked: false, likeCount: before - 1 });
    await db.query('update posts set like_count = $1 where id = 2', [before]);
  });

  it('여러 사람이 같은 게시물에 누르면 줄이 사람 수만큼 쌓인다', async () => {
    for (const userId of [1, 2, 3]) await send('PUT', 4, userId);

    const res = await fetch('http://127.0.0.1:3442/api/posts/4/likes');
    expect(await res.json()).toEqual(['dahye', 'jaehoon', 'minji']);
  });

  it('없는 사람 번호로 누르면 404 이다 — 주소가 가리키는 것이 없다', async () => {
    const res = await send('PUT', 1, 999);
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('그런 게시물이나 사용자는 없어요');
  });

  it('없는 게시물에서 취소하면 404 이다 — 지울 줄이 없어 지나가고, 숫자를 고칠 때 걸린다', async () => {
    const res = await send('DELETE', 999, 2);
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('그런 게시물은 없어요');
  });

  it('사람 번호 자리에 숫자가 아닌 것이 오면 404 이다', async () => {
    const res = await send('PUT', 1, 'abc');
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('그런 사용자는 없어요');
  });

  it('🚨 옛 토글 주소(`POST /likes`)는 이제 없다', async () => {
    const res = await fetch('http://127.0.0.1:3442/api/posts/3/likes', {
      method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ userId: 2 }),
    });
    expect(res.status).toBe(404);
  });

  it('🚨 적어둔 like_count 와 표의 줄 수는 «같지 않다» — 생각해볼 주제의 재료다', async () => {
    const r = await db.query(`
      select p.like_count, (select count(*)::int from post_likes l where l.post_id = p.id) rows
      from posts p where p.id = 1`);

    expect(r.rows[0].like_count).toBe(130);
    expect(r.rows[0].rows, '줄은 0개인데 칸에는 130 이 적혀 있다').toBe(0);
  });
});

// ── 직접 해보기 — 서점에서 세 관계를 한 번씩 ────────────────────────────────

// ── audit 칸 — 시각은 숫자가 아니라 두 시각이다 ─────────────────────────────

describe('audit 칸 — 시드가 minutes_ago 가 아니라 두 시각을 넣는다', () => {
  let seedOut = '';

  beforeAll(() => { seedOut = seedLive(); }, 60000);

  it('🔴 minutes_ago 칸은 두 표 어디에도 없고 audit 칸 넷이 서 있다', async () => {
    const r = await db.query(`
      select table_name, column_name from information_schema.columns
       where table_name in ('posts', 'comments')
         and column_name in ('minutes_ago', 'created_at', 'updated_at')
       order by table_name, column_name`);

    expect(r.rows).toEqual([
      { table_name: 'comments', column_name: 'created_at' },
      { table_name: 'comments', column_name: 'updated_at' },
      { table_name: 'posts', column_name: 'created_at' },
      { table_name: 'posts', column_name: 'updated_at' },
    ]);

    // 🚨 칸 «이름» 은 교안에도 0건이어야 한다. `minutesAgo`(데이터 파일의 다리)는 남는다.
    for (const [name, path] of [['교안', LECTURE], ['답안', ANSWERS]]) {
      expect(read(path), name).not.toContain('minutes_ago');
    }
  });

  it('🚨 이 회차 끝 시드가 실제로 돌고, 교안이 인용한 그 줄을 찍는다', () => {
    const line = '사람 5명, 게시물 5개, 사진 8장, 댓글 9개, 답글 3개를 넣었어요.';

    expect(seedOut.trim()).toBe(line);
    expect(read(LECTURE)).toContain(line);
  });

  it('🔴 시드가 넣은 두 시각이 줄마다 같다 — 답글 3줄까지', async () => {
    const posts = await db.query('select id, created_at, updated_at from posts order by id');
    const comments = await db.query(
      'select id, parent_id, created_at, updated_at from comments order by id');

    expect(posts.rows).toHaveLength(5);
    expect(comments.rows).toHaveLength(12);
    // 🚨 답글도 withTimes 를 거치는 자리다 — 안 거치면 시드가 `Unknown argument minutesAgo` 로 죽는다.
    expect(comments.rows.filter((r) => r.parent_id !== null)).toHaveLength(3);

    for (const row of [...posts.rows, ...comments.rows]) {
      expect(row.created_at.getTime(), `${row.id}번 — 한 번도 안 고쳤으니 두 시각이 같다`)
        .toBe(row.updated_at.getTime());
    }
  });

  it('🔴 답글은 원댓글보다 «늦다» — 데이터에 적어둔 분이 그대로 차례가 된다', async () => {
    const r = await db.query(`
      select c.id, c.created_at, p.id parent_id, p.created_at parent_created_at
        from comments c join comments p on p.id = c.parent_id
       order by c.id`);

    expect(r.rows).toHaveLength(3);
    for (const row of r.rows) {
      expect(row.created_at.getTime(), `${row.id}번 답글이 ${row.parent_id}번 원댓글보다 늦다`)
        .toBeGreaterThan(row.parent_created_at.getTime());
    }
  });
});

describe('직접 해보기 1~3 — 서점에도 같은 셋이 있다', () => {
  let book = null;

  beforeAll(async () => {
    const admin = new pg.Client(BOOK_ADMIN);
    await admin.connect();
    await admin.query(
      "select pg_terminate_backend(pid) from pg_stat_activity where datname = 'p234_book_gate' and pid <> pg_backend_pid()");
    await admin.query('DROP DATABASE IF EXISTS p234_book_gate');
    await admin.query('CREATE DATABASE p234_book_gate');
    await admin.end();

    book = new pg.Client({ ...BOOK_ADMIN, database: 'p234_book_gate' });
    await book.connect();
    await setupP234Bookstore(book);
    for (const dir of P234_LAB_MIGRATIONS) {
      await book.query(read(P(`lab/p2-34/migrations/${dir}/migration.sql`)));
    }

    // 🚨 학생 파일은 `../generated/index.js`(자기 클라이언트)를 부른다.
    //    게이트는 회차 클라이언트로 바꿔 끼워 돌린다 — 공유 클라이언트를 안 덮으려고.
    prismaCli(['generate', '--config', 'lab/p2-34/prisma.config.js'], { BOOKSTORE_URL: BOOK_GATE_URL });
    mkdirSync(P('__replay__'), { recursive: true });
    writeFileSync(P('__replay__/p234-bookstore.js'),
      read(P('lab/p2-34/bookstore.js')).replace("'../generated/index.js'", "'../lab/generated-p2-34/index.js'"));
    for (const n of [1, 2, 3]) {
      writeFileSync(P(`__replay__/p234-practice${n}.js`),
        read(P(`lab/p2-34/practice${n}.js`)).replace("'./bookstore.js'", "'./p234-bookstore.js'"));
    }
  }, 180000);

  afterAll(async () => {
    if (book) await book.end();
    const admin = new pg.Client(BOOK_ADMIN);
    await admin.connect();
    await admin.query(
      "select pg_terminate_backend(pid) from pg_stat_activity where datname = 'p234_book_gate' and pid <> pg_backend_pid()");
    await admin.query('DROP DATABASE IF EXISTS p234_book_gate');
    await admin.end();
  }, 60000);

  const runPractice = (n) =>
    execFileSync(process.execPath, [P(`__replay__/p234-practice${n}.js`)],
      { cwd: P('.'), encoding: 'utf8', env: { ...process.env, BOOKSTORE_URL: BOOK_GATE_URL } });

  it('🔴 1 — 책에 사진 여러 장이 차례대로 딸린다', () => {
    const out = runPractice(1);

    expect(out).toContain('1번 클린 코드 — 사진 2장: /covers/clean-code-front.jpg, /covers/clean-code-back.jpg');
    expect(out).toContain('2번 리팩터링 — 사진 1장: /covers/refactoring-front.jpg');
    expect(out).toContain('4번 테스트 주도 개발 — 사진 0장');
  });

  it('🔴 2 — 리뷰에 답글이 달리고 원글만 걸러 읽힌다', () => {
    const out = runPractice(2);

    expect(out).toContain('리뷰 테이블의 행은 모두 7개고, 원글은 6개예요.');
    expect(out).toContain('1번 jaehoon — 답글 1개');
    expect(out).toContain('2번 minji — 답글 0개');
  });

  it('🔴 3 — 책과 태그가 가운데 표로 이어지고, 같은 쌍은 P2002 로 막힌다', () => {
    const out = runPractice(3);

    expect(out).toContain('1번 클린 코드 — 실무, 고전');
    expect(out).toContain('8번 클린 아키텍처 — 설계');
    expect(out).toContain('4번 테스트 주도 개발 — 태그 없음');
    expect(out).toContain('막혔어요: P2002');
    expect(out, '두 번 들어가면 안 된다').not.toContain('두 번 들어갔어요');
  });
});

// ── 교안 ↔ 코드베이스 — 인용한 것이 실재한다 ────────────────────────────────

describe('인용이 코드베이스와 맞는가', () => {
  const blocksOf = (path, lang) =>
    [...read(path).matchAll(new RegExp('```' + lang + '\\n([\\s\\S]*?)```', 'g'))].map((m) => m[1].trimEnd());

  const prismaSources = () => [
    'prisma/schema.prisma', 'lab/p2-34/schema.prisma',
    // 교안 Step 2 는 «지우라고» 한 줄을 싣는다 — 그 줄은 착수 시점 스키마에 있다.
    'snapshots/p2-34/schema.before.prisma',
    // 교안이 「이렇게 적으면」으로만 보여주는 둘 — 우리 앱에는 안 만들지만 실제로 서는 판이다.
    'snapshots/p2-34/implicit-nm.prisma', 'snapshots/p2-34/one-to-one.prisma',
  ].map((f) => read(P(f)));

  const jsSources = () => [
    // 🚨 `p2-35` 가 $transaction·중첩 쓰기·select 로 이 셋을 고친다 — 그 «시점» 을 얼려서 본다.
    'snapshots/p2-34-final/services/postService.js',
    'snapshots/p2-34-final/services/likeService.js',
    'snapshots/p2-34-final/seed.js',
    'snapshots/p2-34-final/check.js',
    // 🔀 좋아요 주소가 PUT·DELETE 로 갈렸다(2026-10-01) — 라이브는 `p2-35` 세션이 따라 바꿀 때까지 토글 판이다.
    'snapshots/p2-34-final/schemas/postSchema.js', 'snapshots/p2-34-final/routes/posts.js', 'db.js', 'errors.js',
    'snapshots/p2-34-final/data/posts.js', 'data/comments.js',
    // Step 3 시점 시드 — 그때는 post_likes 가 아직 없어 비우기 목록이 한 칸 짧다.
    'snapshots/p2-34/seed.step3.js',
    'lab/p2-34/practice1.js', 'lab/p2-34/practice2.js', 'lab/p2-34/practice3.js',
    'lab/p2-34/bookstore.js',
    // 답안의 과제 코드가 여기 있다.
    'lab/p2-34/commentSchema.js', 'lab/p2-34/commentService.js',
    'lab/p2-34/commentRoutes.js', 'lab/p2-34/homework1.js', 'lab/p2-34/homework2.js',
    // 답안의 「이렇게 하면 더 좋아요」 — 완성본에 없는 «제안» 이라 따로 얼려 실행으로 잠근다.
    'snapshots/p2-34/commentService.depth-limit.js',
  ].map((f) => read(P(f)));

  const sqlSources = () =>
    [...P234_MIGRATIONS.map((d) => `prisma/migrations/${d}/migration.sql`),
     ...P234_LAB_MIGRATIONS.map((d) => `lab/p2-34/migrations/${d}/migration.sql`)]
      .map((f) => read(P(f)))
      // 🚨 교안 Step 6 은 «우리가 안 쓰는» 암묵적 N:M 의 SQL 도 보여준다.
      //    그것은 마이그레이션이 아니라 migrate diff 의 출력이라 여기서 직접 받아 온다.
      .concat(prismaCli(['migrate', 'diff', '--from-empty',
        '--to-schema', P('snapshots/p2-34/implicit-nm.prisma'), '--script']));

  const squash = (t) => t.split('\n').map((l) => l.trim().replace(/\s+/g, ' ')).join('\n');

  /** 주석·빈 줄·닫는 괄호를 걷어낸 «의미 있는 줄» — 교안은 발췌를 조각으로 싣는다.
   *  붙여 쓴 공백은 정렬용이라 하나로 눌러서 견준다. */
  const meaningful = (block) =>
    block.split('\n').map((l) => l.trim())
      // `...` 은 캐논의 «생략» 표기라 인용 대조 대상이 아니다.
      .filter((l) => l && l !== '...' && !l.startsWith('//') && !l.startsWith('--') && !/^[}\])]+,?;?$/.test(l))
      .map((l) => l.replace(/\s+/g, ' '));

  it('🔴 교안·답안의 ```prisma 줄이 전부 코드베이스 스키마에 실재한다', () => {
    const srcs = prismaSources().map(squash);
    const missing = [];
    for (const b of [...blocksOf(LECTURE, 'prisma'), ...blocksOf(ANSWERS, 'prisma')]) {
      for (const line of meaningful(b)) {
        if (!srcs.some((s) => s.includes(line))) missing.push(line);
      }
    }
    expect(missing).toEqual([]);
  });

  it('🔴 교안의 ```sql 줄이 전부 마이그레이션에 실재한다', () => {
    const srcs = sqlSources().map(squash);
    const missing = [];
    for (const b of blocksOf(LECTURE, 'sql')) {
      for (const line of meaningful(b)) {
        if (!srcs.some((s) => s.includes(line))) missing.push(line);
      }
    }
    expect(missing).toEqual([]);
  });

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

  it('🚨 교안이 인용한 CLI 경고·오류가 실제 출력과 같다', () => {
    const lec = read(LECTURE);
    for (const phrase of [
      'You are about to drop the column `post_image` on the `posts` table, which still contains 5 non-null values.',
      '? Are you sure you want to create this migration? › (y/N)',
      'You can now edit it and apply it by running prisma migrate dev.',
      'cannot truncate a table referenced in a foreign key constraint',
    ]) expect(lec, phrase.slice(0, 45)).toContain(phrase);
  });

  it('🚨 착수 스냅숏이 p2-33 종료 스키마와 byte 동일하다 — 사슬이 끊기면 앞 회차와 갈린다', () => {
    // 🚨 audit retrofit 때 실제로 갈라져 있었다 — 앞 회차가 뒤쪽만 고치면 여기가 조용히 옛 판으로 남는다.
    expect(read(P('snapshots/p2-34/schema.before.prisma')))
      .toBe(read(P('snapshots/p2-33-final/prisma/schema.prisma')));
  });

  it('교안과 답안이 둘 다 있다', () => {
    expect(exists(LECTURE), '교안').toBe(true);
    expect(exists(ANSWERS), '답안').toBe(true);
  });
});

// ── 과제 — 답안 코드가 실제로 돈다 ──────────────────────────────────────────

describe('과제 [기초]·[응용] — 답안이 실제로 돈다', () => {
  /** lab 파일을 __replay__ 로 옮겨 «학생과 같은 깊이» 에서 돌린다. */
  const labCopy = () => {
    mkdirSync(P('__replay__'), { recursive: true });
    for (const f of ['commentService.js', 'commentSchema.js', 'commentRoutes.js',
                     'homework1.js', 'homework2.js']) {
      // 🚨 학생 파일은 4001 로 박혀 있는데 p2-30·p2-31·p2-32 게이트도 그 포트를 쓴다.
      //    vitest 가 파일을 «병렬로» 돌리므로 사본만 다른 포트로 옮긴다.
      writeFileSync(P(`__replay__/p234-${f}`), read(P(`lab/p2-34/${f}`))
        .replace("'./commentRoutes.js'", "'./p234-commentRoutes.js'")
        .replace("'./commentService.js'", "'./p234-commentService.js'")
        .replace("'./commentSchema.js'", "'./p234-commentSchema.js'")
        .replaceAll('4001', '4010'));
    }
  };

  beforeAll(async () => {
    labCopy();
    seedLive();
    await bootApp('__replay__/p234-homework1.js', 4010);
  }, 60000);

  it('🔴 [기초] 목록에 원댓글만 나오고 답글은 그 안에 담긴다', async () => {
    const res = await fetch('http://127.0.0.1:4010/api/comments?postId=1');
    const comments = await res.json();

    expect(comments).toHaveLength(3);
    expect(comments[0].username).toBe('minji');
    expect(comments[0].replies.map((r) => r.content))
      .toEqual(['다음엔 같이 가요', '저도 껴주세요']);
    expect(comments[1].replies).toEqual([]);
  });

  it('🔴 [기초] 답글의 postId 는 원댓글에서 물려받는다 — 요청에서 안 받는다', async () => {
    const res = await fetch('http://127.0.0.1:4010/api/comments', {
      method: 'POST',
      headers: JSON_HEADERS,
      // 🚨 일부러 «틀린» postId 를 보낸다. 원댓글 4번은 2번 게시물 것이다.
      body: JSON.stringify({ postId: 1, authorId: 5, content: '저도요', parentId: 4 }),
    });
    const created = await res.json();

    expect(res.status).toBe(201);
    expect(created.postId, '보낸 1 이 아니라 원댓글의 2 를 따라간다').toBe(2);
    expect(created.parentId).toBe(4);
  });

  it('🔴 [기초] 없는 댓글에 답글을 달면 400 이다', async () => {
    const res = await fetch('http://127.0.0.1:4010/api/comments', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ postId: 1, authorId: 5, content: 'x', parentId: 999 }),
    });

    expect(res.status).toBe(400);
    expect((await res.json()).message).toBe('그런 댓글은 없어요');
  });

  it('🚨 답안의 「더 좋아요」 한 줄이 실제로 답글의 답글을 막는다', async () => {
    // 제안도 돌려본다 — 안 돌려보면 답안이 「이렇게 하면 된다」고 거짓을 말할 수 있다.
    writeFileSync(P('__replay__/p234-depth-commentService.js'),
      read(P('snapshots/p2-34/commentService.depth-limit.js')));
    writeFileSync(P('__replay__/p234-depth-commentRoutes.js'),
      read(P('lab/p2-34/commentRoutes.js'))
        .replace("'./commentService.js'", "'./p234-depth-commentService.js'")
        .replace("'./commentSchema.js'", "'./p234-commentSchema.js'"));
    writeFileSync(P('__replay__/p234-depth-homework1.js'),
      read(P('lab/p2-34/homework1.js'))
        .replace("'./commentRoutes.js'", "'./p234-depth-commentRoutes.js'")
        // 🚨 학생 파일은 포트를 4001 로 박아 둔다 — 앞 서버와 안 부딪히게 사본만 옮긴다.
        .replaceAll('4001', '4011'));

    seedLive();
    await bootApp('__replay__/p234-depth-homework1.js', 4011);

    // 10번은 1번 댓글에 달린 «답글» 이다 — 거기에 또 달면 막혀야 한다.
    const res = await fetch('http://127.0.0.1:4011/api/comments', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ postId: 1, authorId: 5, content: '답글의 답글', parentId: 10 }),
    });

    expect(res.status).toBe(400);
    expect((await res.json()).message).toBe('답글에는 답글을 달 수 없어요');
  }, 60000);

  it('🔴 [응용] 적어둔 숫자를 실제 줄 수로 맞춘다', async () => {
    await bootApp('__replay__/p234-homework1.js', 4010);
    seedLive();
    const out = execFileSync(process.execPath, [P('__replay__/p234-homework2.js')],
      { cwd: P('.'), encoding: 'utf8', env: { ...process.env, ...ENV } });

    expect(out).toContain('고치기 전');
    expect(out).toContain('    1          130            0');
    expect(out).toContain('고친 뒤');
    expect(out).toContain('    1            2            2');
    expect(out).toContain('    4            0            0');
  });

  it('🔴 답안이 실은 답글 JSON 이 실제 응답과 칸 이름·차례까지 같다', async () => {
    seedLive();
    await bootApp('__replay__/p234-homework1.js', 4010);

    // 답안의 「6. 확인」 순서 그대로 — 먼저 원댓글(13번), 그 원댓글에 답글(14번).
    const rootRes = await fetch('http://127.0.0.1:4010/api/comments', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ postId: 1, authorId: 3, content: '저도 한강 좋아해요' }),
    });
    const root = await rootRes.json();

    expect(rootRes.status).toBe(201);
    expect(root.id, '시드 12줄 다음 번호').toBe(13);
    expect(root.parentId).toBe(null);

    const res = await fetch('http://127.0.0.1:4010/api/comments', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ postId: 2, authorId: 5, content: '저도요', parentId: 13 }),
    });
    const reply = await res.json();

    expect(res.status).toBe(201);
    expect(reply).toMatchObject({
      id: 14, postId: 1, authorId: 5, content: '저도요', likeCount: 0, parentId: 13, username: 'seungwoo',
    });
    // 🚨 방금 만든 답글이라 두 시각이 «같은 값» 이고, 시드 시각이 아니라 요청을 보낸 순간이다.
    expect(reply.createdAt).toBe(reply.updatedAt);
    expect(Date.now() - new Date(reply.createdAt).getTime(),
      '요청을 보낸 순간이지 시드 시각이 아니다').toBeLessThan(60000);

    // 답안 블록이 그 응답과 같은 칸을 같은 차례로 싣는다 — minutes_ago 가 빠지고 두 시각이 들어온 자리다.
    const block = [...read(ANSWERS).matchAll(/```json\n([\s\S]*?)```/g)]
      .map((m) => m[1]).find((b) => b.includes('"id": 14'));

    expect(block, '답안의 14번 답글 JSON').toBeTruthy();
    expect(Object.keys(JSON.parse(block))).toEqual(Object.keys(reply));
  });
});
