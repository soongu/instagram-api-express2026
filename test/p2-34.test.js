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
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import pg from 'pg';
import { boot } from './helpers/boot.js';
import { setupP234 } from '../sql/p2-34/setup.mjs';

const ROOT = new URL('../', import.meta.url);
const P = (rel) => new URL(rel, ROOT).pathname;
const ADMIN = { host: 'localhost', port: 5432, database: 'postgres', user: 'postgres', password: 'postgres' };
const GATE_URL = 'postgresql://postgres:postgres@localhost:5432/p234_gate';
const SHADOW_URL = 'postgresql://postgres:postgres@localhost:5432/p234_shadow';
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
  '20260911142735_add_post_images',
  '20260911142828_move_images_to_table',
  '20260911143803_add_comment_replies',
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

/** 이 회차가 고친 시드 — 학생이 실제로 돌리는 그 파일이다. */
const seedLive = () =>
  execFileSync(process.execPath, [P('seed.js')],
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
    //    안 고치면 TRUNCATE 가 「외래 키가 걸린 표는 못 비운다」로 막힌다.
    seedLive();
    await bootApp('app.js', 3441);
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
    const out = execFileSync(process.execPath, [P('check.js')],
      { cwd: P('.'), encoding: 'utf8', env: { ...process.env, ...ENV } });

    expect(out).toContain('comments 표의 줄은 모두 12개예요.');
    expect(out).toContain('그중 원댓글은 9개고');
    expect(out).toContain('1번 "저도 가봤어요" — 답글 2개');
    expect(out).toContain('4번 "크루아상 색이 좋네요" — 답글 1개');
  });

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
