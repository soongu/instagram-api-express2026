// p2-36 「두 세계가 처음 만난다」 게이트
//
// 🚨 이 회차의 판정 축은 «계약» 이라, 한쪽만 봐서는 아무것도 증명되지 않는다.
//    그래서 이 파일은 **프론트 소스에서 «실제로 만드는» 질의와 몸통을 뽑아** 진짜
//    서버에 먹인다. 스텁으로 짠 짝은 우리가 «상상한» 서버라서, 상상이 틀리면 그
//    틀린 상상을 검증할 뿐이다(2026-09 트랙 실측 — 클라이언트를 갈아타면 앞 회차
//    스텁이 조용히 통과했다).
//
// 축 ① 목록 계약 — {items, hasNext} 로 주고, 커서가 중복·누락 없이 끝까지 간다.
// 축 ② 프론트가 보내는 그 질의·그 몸통이 «그대로» 통한다.
// 축 ③ 사진 주소가 브라우저에서 열리는 주소다.
// 축 ④ 아직 못 잇는 화면은 «정말로» 없다 — 교안이 그렇게 말하니 사실이어야 한다.
// 축 ⑤ 앞 회차가 가르친 것이 안 깨졌다.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import pg from 'pg';
import { boot } from './helpers/boot.js';
import { setupP236 } from '../sql/p2-36/setup.mjs';
import { applyMigrationsAfter, P234_LAST } from './helpers/tip-schema.js';

const ROOT = new URL('../', import.meta.url);
const P = (rel) => new URL(rel, ROOT).pathname;
const ADMIN = { host: 'localhost', port: 5432, database: 'postgres', user: 'postgres', password: 'postgres' };
const GATE_URL = 'postgresql://postgres:postgres@localhost:5432/p236_gate';
// `p2-38` 부터 `app.js` 가 허락 목록을 환경에서 받는다 — 학생이 `--env-file`
// 로 넣어주는 그 자리에 게이트가 자기 값을 넣는다(`boot.js` 가 정한 방식).
const ENV = { DATABASE_URL: GATE_URL, CORS_ORIGIN: 'http://localhost:5173' };
const JSON_HEADERS = { 'Content-Type': 'application/json' };
const PORT = 3461;

const read = (p) => readFileSync(p, 'utf8');
const FRONT = (rel) => read(P(`../instagram-react/src/${rel}`));

let db = null;
let usersColumnsAtRound = [];
let server = null;

const seed = () =>
  execFileSync(process.execPath, [P('seed.js')],
    { cwd: P('.'), encoding: 'utf8', env: { ...process.env, ...ENV } });

beforeAll(async () => {
  const admin = new pg.Client(ADMIN);
  await admin.connect();
  await admin.query(
    "select pg_terminate_backend(pid) from pg_stat_activity where datname = 'p236_gate' and pid <> pg_backend_pid()");
  await admin.query('DROP DATABASE IF EXISTS p236_gate');
  await admin.query('CREATE DATABASE p236_gate');
  await admin.end();

  db = new pg.Client({ ...ADMIN, database: 'p236_gate' });
  await db.connect();
  await setupP236(db);
  // 이 회차 «당시» 의 사람 테이블 컬럼 — 아래 tip 따라잡기가 뒤 회차 컬럼(`name` 등)을 더하기 전에 잡아 둔다.
  usersColumnsAtRound = (await db.query(
    "select column_name from information_schema.columns where table_name = 'users'")).rows.map((x) => x.column_name);
  // 공유 Prisma 클라이언트가 tip 스키마로 만들어져 있다 — 시드가 새 컬럼을 고르니 DB 도 맞춘다(`helpers/tip-schema.js`).
  await applyMigrationsAfter(db, P234_LAST);
  seed();

  server = await boot('app.js', {
    port: PORT, env: { ...ENV, PORT: String(PORT) }, ready: `${PORT}번 포트에서`,
  });
}, 120000);

afterAll(async () => {
  if (server) await server.stop();
  if (db) await db.end();
  const admin = new pg.Client(ADMIN);
  await admin.connect();
  await admin.query(
    "select pg_terminate_backend(pid) from pg_stat_activity where datname = 'p236_gate' and pid <> pg_backend_pid()");
  await admin.query('DROP DATABASE IF EXISTS p236_gate');
  await admin.end();
}, 60000);

const GET = (path) => fetch(`${server.base}${path}`);
const getJson = async (path) => {
  const res = await GET(path);
  return { status: res.status, body: await res.json() };
};

// ── 축 ① 목록 계약 ─────────────────────────────────────────────────────
describe('Step 2 — 목록은 맨 배열이 아니라 봉투로 온다', () => {
  it('🔴 `items` 와 `hasNext` 두 칸으로 온다', async () => {
    const { status, body } = await getJson('/api/posts?limit=2');
    expect(status).toBe(200);
    expect(Array.isArray(body), '맨 배열이면 프론트가 `items` 를 못 찾는다').toBe(false);
    expect(Object.keys(body).sort()).toEqual(['hasNext', 'items']);
    expect(body.items).toHaveLength(2);
    expect(body.hasNext).toBe(true);
  });

  it('🔴 마지막 장에서 `hasNext` 가 거짓이 된다 — 안 그러면 화면이 영영 더 부른다', async () => {
    const { body } = await getJson('/api/posts?limit=99');
    expect(body.items).toHaveLength(5);
    expect(body.hasNext).toBe(false);
  });

  it('한 장 더 달라고 해서 알아낸다 — 다음 장이 없으면 그 장이 딱 채워진다', async () => {
    const { body } = await getJson('/api/posts?limit=5');
    expect(body.items).toHaveLength(5);
    expect(body.hasNext, '다섯 개뿐인데 다섯을 달라면 다음은 없다').toBe(false);
  });

  it('`limit` 을 안 주면 기본값으로 다섯을 준다', async () => {
    const { body } = await getJson('/api/posts');
    expect(body.items).toHaveLength(5);
  });
});

describe('Step 2 — 커서가 중복도 빠뜨림도 안 만든다', () => {
  const 끝까지 = async (limit) => {
    const 모은것 = [];
    let cursor = null;
    for (let 장 = 0; 장 < 20; 장 += 1) {
      const q = `/api/posts?limit=${limit}` + (cursor ? `&cursor=${cursor}` : '');
      const { body } = await getJson(q);
      모은것.push(...body.items.map((p) => p.id));
      if (!body.hasNext) return 모은것;
      cursor = body.items[body.items.length - 1].id;
    }
    throw new Error('커서가 안 끝난다');
  };

  it('🔴 두 개씩 넘겨 다섯을 «정확히 한 번씩» 모은다', async () => {
    const ids = await 끝까지(2);
    expect(ids).toEqual([1, 2, 3, 4, 5]);
  });

  it('장 크기를 바꿔도 같은 차례가 나온다', async () => {
    expect(await 끝까지(1)).toEqual([1, 2, 3, 4, 5]);
    expect(await 끝까지(3)).toEqual([1, 2, 3, 4, 5]);
  });

  it('🔴 새 게시물이 «맨 앞» 에 끼어도 중복·누락이 없다 — 쪽 번호였다면 어긋날 자리다', async () => {
    const 만들기 = await fetch(`${server.base}/api/posts`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        authorId: 1, postAlt: '방금', content: '방금 올린 것',
        imageUrls: ['https://picsum.photos/seed/zzz/600/600'],
      }),
    });
    const 새것 = await 만들기.json();
    expect(만들기.status).toBe(201);

    const ids = await 끝까지(2);
    expect(ids[0], '가장 최신이 맨 앞이다').toBe(새것.id);
    expect([...ids].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 새것.id]);
    expect(new Set(ids).size).toBe(ids.length);

    await fetch(`${server.base}/api/posts/${새것.id}`, { method: 'DELETE' });
  });
});

// ── 축 ② 프론트가 «실제로 보내는» 것을 그대로 먹인다 ────────────────────
describe('Step 3 — 프론트가 만드는 질의가 그대로 통한다', () => {
  const hook = () => FRONT('hooks/usePosts.js');

  it('프론트의 질의 조립 줄을 찾을 수 있다 (이 검사의 전제)', () => {
    expect(hook()).toContain('`limit=${PER_PAGE}&cursor=${cursor}`');
    expect(hook()).toContain('`limit=${PER_PAGE}`');
    expect(hook()).toContain('`username=${selectedUser}&${condition}`');
  });

  it('🔴 프론트가 «그대로» 만드는 첫 장 질의가 통한다', async () => {
    const PER_PAGE = Number(hook().match(/const PER_PAGE = (\d+)/)[1]);
    const { status, body } = await getJson(`/api/posts?limit=${PER_PAGE}`);
    expect(status).toBe(200);
    expect(body.items).toHaveLength(PER_PAGE);
  });

  it('🔴 프론트가 만드는 다음 장 질의도 통한다', async () => {
    const PER_PAGE = Number(hook().match(/const PER_PAGE = (\d+)/)[1]);
    const 첫장 = await getJson(`/api/posts?limit=${PER_PAGE}`);
    const cursor = 첫장.body.items[첫장.body.items.length - 1].id;
    const { status, body } = await getJson(`/api/posts?limit=${PER_PAGE}&cursor=${cursor}`);
    expect(status).toBe(200);
    expect(body.items.map((p) => p.id)).not.toContain(cursor);
  });

  it('🔴 사람을 고른 질의도 통한다 — 조건과 커서가 같이 실린다', async () => {
    const { status, body } = await getJson('/api/posts?username=minji&limit=2');
    expect(status).toBe(200);
    expect(body.items.every((p) => p.username === 'minji')).toBe(true);
    expect(body.items.length).toBeGreaterThan(0);
  });
});

// ── 축 ②-b 몇 분 전 — 서버는 «시각» 을 주고 화면이 센다 ───────────────
describe('Step 5 — 몇 분 전이 숫자가 아니라 시각으로 온다', () => {
  // 🔑 화면이 쓰는 그 함수를 그대로 불러와 진짜 서버의 답에 먹인다 (이 파일의 원칙).
  const 화면의timeAgo = async () =>
    (await import(P('../instagram-react/src/utils/timeAgo.js'))).timeAgo;

  it('🔴 목록 한 건에 `minutesAgo` 가 없고 두 시각이 ISO 글자로 온다 — 옛 화면이 「분 전」만 그린 까닭', async () => {
    const { body } = await getJson('/api/posts?limit=99');
    for (const post of body.items) {
      expect(post, `${post.id}번에 옛 칸이 남았다`).not.toHaveProperty('minutesAgo');
      expect(post.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(post.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    }
  });

  it('🔴 시드 직후 화면에는 12분 전 · 45분 전 · 3시간 전 · 5시간 전 · 7시간 전 — 교안의 표', async () => {
    const timeAgo = await 화면의timeAgo();
    const { body } = await getJson('/api/posts?limit=99');
    expect(body.items.map((p) => p.id)).toEqual([1, 2, 3, 4, 5]);
    expect(body.items.map((p) => timeAgo(p.createdAt)))
      .toEqual(['12분 전', '45분 전', '3시간 전', '5시간 전', '7시간 전']);
  });

  it('🔴 방금 올린 게시물은 「방금 전」 — 서버가 만든 순간을 두 시각에 똑같이 적어 돌려준다', async () => {
    const timeAgo = await 화면의timeAgo();
    const res = await fetch(`${server.base}/api/posts`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        authorId: 2, postAlt: '내가 올린 사진', content: '',
        imageUrls: ['https://picsum.photos/seed/now/600/600'],
      }),
    });
    const 만든것 = await res.json();
    expect(res.status).toBe(201);
    expect(만든것).not.toHaveProperty('minutesAgo');
    expect(만든것.createdAt).toBe(만든것.updatedAt);
    expect(timeAgo(만든것.createdAt)).toBe('방금 전');

    await fetch(`${server.base}/api/posts/${만든것.id}`, { method: 'DELETE' });
  });
});

describe('Step 5·6 — 프론트가 보내는 몸통이 서버가 받는 모양이다', () => {
  it('🔴 올리기 몸통이 Zod 를 통과한다 — 프론트가 적는 칸 넷 그대로', async () => {
    const 모달 = FRONT('components/CreateFeedModal.jsx');
    const 몸통 = 모달.slice(모달.indexOf('postApi.create({'), 모달.indexOf('onCreate(created)'));
    expect(몸통).toContain('authorId: MY_USER_ID');
    const MY = Number(FRONT('services/api.js').match(/MY_USER_ID = (\d+)/)[1]);

    const res = await fetch(`${server.base}/api/posts`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        authorId: MY,
        postAlt: '내가 올린 사진',
        content: '',
        imageUrls: ['data:image/png;base64,iVBORw0KGgo='],
      }),
    });
    const 만든것 = await res.json();
    expect(res.status, `서버 답: ${JSON.stringify(만든것)}`).toBe(201);
    expect(만든것.username, '번호만 보냈는데 서버가 이름을 채워 돌려준다').toBe('jaehoon');
    expect(만든것.imageUrls).toHaveLength(1);

    await fetch(`${server.base}/api/posts/${만든것.id}`, { method: 'DELETE' });
  });

  it('🔴 이름을 보내던 앞 회차 몸통은 이제 «거절» 된다 — 그래서 프론트를 고쳐야 했다', async () => {
    const res = await fetch(`${server.base}/api/posts`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        username: 'jaehoon', profileImage: 'x', postImage: 'y',
        postAlt: 'z', content: '', minutesAgo: 0, likeCount: 0, commentCount: 0,
      }),
    });
    expect(res.status).toBe(400);
  });

  // 🔀 2026-10-01 — `p2-34` 가 좋아요를 `PUT`·`DELETE /posts/:id/likes/:userId` 로 나눴다(트랙
  //    CLAUDE.md 「우리가 바꾼 계약」). 프론트 `api.js` 의 두 함수가 «실제로 만드는» 주소를 뽑아
  //    그대로 보낸다 — 함수 이름이나 주소 모양이 어긋나면 여기가 빨개진다.
  it('🔴 좋아요는 누르기(PUT)와 취소(DELETE)로 나뉘어 있다 — 프론트가 만드는 그 주소로', async () => {
    const MY = Number(FRONT('services/api.js').match(/MY_USER_ID = (\d+)/)[1]);
    const 보내기 = (method) =>
      fetch(`${server.base}/api${frontLikePath(method, 1, MY)}`, { method }).then((r) => r.json());

    const 처음 = (await getJson('/api/posts/1')).body.likeCount;
    expect(await 보내기('PUT')).toEqual({ liked: true, likeCount: 처음 + 1 });
    expect(await 보내기('DELETE')).toEqual({ liked: false, likeCount: 처음 });

    const r = await db.query('select count(*)::int c from post_likes where post_id = 1');
    expect(r.rows[0].c, '취소했으면 행도 없어야 한다').toBe(0);

    const old = await fetch(`${server.base}/api/posts/1/likes`, {
      method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ userId: MY }),
    });
    expect(old.status, '옛 토글 주소는 이제 없다').toBe(404);
    expect(FRONT('services/api.js'), '프론트에 토글 길이 남으면 하트가 404 를 받는다').not.toContain('toggleLike');
  });
});

/**
 * 프론트 `postApi` 가 좋아요 요청에 쓰는 주소를 그 소스에서 뽑아 번호를 채운다.
 * `likePost: (id, userId) => api.put(`/posts/${id}/likes/${userId}`)` → `/posts/1/likes/2`
 */
function frontLikePath(method, id, userId) {
  const 이름 = { PUT: 'likePost', DELETE: 'unlikePost' }[method];
  const 함수 = { PUT: 'put', DELETE: 'delete' }[method];
  const m = FRONT('services/api.js').match(
    new RegExp(`${이름}: \\(id, userId\\) => api\\.${함수}\\(\`([^\`]+)\`\\)`));
  expect(m, `프론트 api.js 에 ${이름} 이 api.${함수} 로 있어야 한다`).toBeTruthy();
  return m[1].replace('${id}', String(id)).replace('${userId}', String(userId));
}

// ── Step 7 · 교안이 따라가는 숫자 ────────────────────────────────────────
// 교안 Step 7 과 직접 해보기 3 이 학생에게 보여주는 숫자를 «그 순서 그대로» 진짜 서버에 보낸다.
// 화면 쪽 동작(하트가 비었으면 누르기, 채워졌으면 취소)은 react `src/p2-36.test.jsx` 가 잠근다.
describe('Step 7 — 좋아요 장면의 숫자가 교안 그대로다', () => {
  afterAll(() => seed());

  it('🔴 PATCH 131 → 누르기 132 → (새로고침 뒤) 또 누르기 132 → 취소 131 → dahye 132 → jaehoon 133', async () => {
    seed();
    const MY = Number(FRONT('services/api.js').match(/MY_USER_ID = (\d+)/)[1]);
    const 보내기 = (method, userId) =>
      fetch(`${server.base}/api${frontLikePath(method, 1, userId)}`, { method }).then((r) => r.json());
    const 누른사람 = async () => (await getJson('/api/posts/1/likes')).body;

    expect((await getJson('/api/posts/1')).body.likeCount, '시드 직후').toBe(130);

    // 바꾸기 전 화면 — 숫자를 계산해 적어 보낸다(`p2-21` 판 `updateLikeCount`).
    expect(FRONT('services/p2-21.final.api.snapshot.js'))
      .toContain('updateLikeCount: (id, likeCount) => api.patch(`/posts/${id}`, { likeCount }),');
    const patched = await fetch(`${server.base}/api/posts/1`, {
      method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ likeCount: 131 }),
    });
    expect(patched.status).toBe(200);
    expect(await 누른사람(), '숫자만 적어서 누가 눌렀는지는 안 남는다').toEqual([]);

    expect(await 보내기('PUT', MY)).toEqual({ liked: true, likeCount: 132 });
    expect(await 누른사람()).toEqual(['jaehoon']);

    // 새로고침한 화면은 하트가 비어 있어 누르기를 한 번 더 보낸다 — 토글이었다면 131 이었다.
    expect(await 보내기('PUT', MY)).toEqual({ liked: true, likeCount: 132 });
    expect(await 보내기('DELETE', MY)).toEqual({ liked: false, likeCount: 131 });
    expect(await 누른사람()).toEqual([]);

    // 직접 해보기 3 — `.http` 의 그 요청 그대로 보낸 뒤, 화면에서 jaehoon 이 누른다.
    const http = read(P('requests/posts.http'));
    const 줄 = http.split('### 1번 게시물에 dahye가 좋아요\n')[1].split('\n')[0];
    expect(줄).toBe('PUT http://localhost:3000/api/posts/1/likes/1');
    const dahye = await fetch(줄.replace('PUT http://localhost:3000', server.base), { method: 'PUT' });
    expect(await dahye.json()).toEqual({ liked: true, likeCount: 132 });
    expect(await 보내기('PUT', MY)).toEqual({ liked: true, likeCount: 133 });
    expect(await 누른사람()).toEqual(['dahye', 'jaehoon']);
    // 직접 해보기 3 의 5 — 새로고침 뒤 꺼져 보이는 하트를 또 눌러도 133 그대로다.
    expect(await 보내기('PUT', MY)).toEqual({ liked: true, likeCount: 133 });

    const lec = read(P('../../part2/6-fullstack-join/p2-36-connect-front-back-lecture.md'));
    const step7 = lec.slice(lec.indexOf('## Step 7'), lec.indexOf('## Step 8'));
    for (const 문구 of ['130에서 131이 되고', '131이 132가 돼요', '숫자가 133이 되고', '숫자는 133 그대로이고 하트만 켜져야', '["dahye","jaehoon"]']) {
      expect(step7, 문구).toContain(문구);
    }
  });
});

// ── 축 ③ 사진 주소 ─────────────────────────────────────────────────────
describe('Step 4 — 사진 주소가 «브라우저에서 열리는» 주소다', () => {
  it('🔴 응답의 사진·프로필 주소가 전부 절대 주소다', async () => {
    const { body } = await getJson('/api/posts?limit=99');
    for (const post of body.items) {
      expect(post.profileImage, `${post.username} 의 프로필`).toMatch(/^https?:\/\//);
      for (const url of post.imageUrls) expect(url).toMatch(/^https?:\/\//);
    }
  });

  it('🔴 상대 경로가 한 줄도 안 남았다 — 남으면 프론트 제 주소로 풀려 깨진다', async () => {
    const r = await db.query(
      "select count(*)::int c from post_images where image_url like '/%'");
    expect(r.rows[0].c).toBe(0);
    const u = await db.query(
      "select count(*)::int c from users where profile_image like '/%'");
    expect(u.rows[0].c).toBe(0);
  });

  it('사진은 차례대로 온다 — 첫 장이 화면에 걸리는 그 장이다', async () => {
    const { body } = await getJson('/api/posts/1');
    expect(body.imageUrls).toEqual([
      'https://picsum.photos/seed/post1/600/600',
      'https://picsum.photos/seed/post1b/600/600',
      'https://picsum.photos/seed/post1c/600/600',
    ]);
  });
});

// ── 축 ④ 아직 못 잇는 화면 ─────────────────────────────────────────────
describe('Step 7 — 프로필과 스토리는 우리 서버에 «정말로» 없다', () => {
  it('🔴 둘 다 404 다 — 교안이 「아직 없어요」라고 말하니 사실이어야 한다', async () => {
    expect((await GET('/api/profiles?username=jaehoon')).status).toBe(404);
    expect((await GET('/api/stories')).status).toBe(404);
  });

  it('🔴 사람 표에 프로필 화면이 요구하는 칸이 «없다» — 그래서 못 준다', async () => {
    const 칸 = usersColumnsAtRound;
    expect(칸).toContain('username');
    expect(칸).not.toContain('name');
    expect(칸).not.toContain('follower_count');
    const t = await db.query(
      "select to_regclass('public.follows') as t");
    expect(t.rows[0].t, '팔로우 표가 없으니 팔로워 수를 셀 수도 없다').toBeNull();
  });
});

// ── 축 ⑤ 앞 회차가 안 깨졌다 ───────────────────────────────────────────
describe('바깥에서 본 나머지 모습은 그대로다', () => {
  it('한 건 조회는 봉투 없이 그 게시물 자체를 준다', async () => {
    const { status, body } = await getJson('/api/posts/1');
    expect(status).toBe(200);
    expect(body.id).toBe(1);
    expect(body.items, '목록만 봉투에 담는다').toBeUndefined();
  });

  it('없는 번호는 404, 숫자가 아닌 번호도 404 (p2-30·p2-31)', async () => {
    expect((await GET('/api/posts/999')).status).toBe(404);
    expect((await GET('/api/posts/abc')).status).toBe(404);
  });

  it('깨진 몸통은 400 이고 안내가 붙는다 (p2-32)', async () => {
    const res = await fetch(`${server.base}/api/posts`, {
      method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ authorId: 'x' }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toHaveProperty('details');
  });

  it('누가 눌렀는지 묻는 길도 그대로다 (p2-34)', async () => {
    const { status, body } = await getJson('/api/posts/1/likes');
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });
});

// ── 인용 대조 — 교안·답안이 실은 코드가 코드베이스와 같은가 ─────────────
describe('인용이 코드베이스와 맞는가', () => {
  const LECTURE = P('../../part2/6-fullstack-join/p2-36-connect-front-back-lecture.md');
  const ANSWERS = P('../../part2/6-fullstack-join/p2-36-connect-front-back-answers.md');
  const squash = (t) => t.replace(/\s+/g, ' ').trim();
  const blocksOf = (path, lang) =>
    [...read(path).matchAll(new RegExp('```' + lang + '\\n([\\s\\S]*?)```', 'g'))].map((m) => m[1]);
  // 주석·빈 줄·닫는 괄호만 있는 줄은 어디에나 있어 대조가 무의미하다.
  // 🔑 «설명용으로 덧단» 꼬리 주석은 떼고 대조한다 — 교안이 전/후를 나란히 보일 때
  //    `postImage={post.postImage} // 전` 처럼 적는데, 코드 쪽에 그 주석이 있을 리 없다.
  //    (캐논: 주석 단 발췌는 주석을 떼고 대조하고 생략 스케치는 목록으로 잠근다.)
  const meaningful = (b) =>
    b.split('\n').map((l) => squash(l).replace(/\s*\/\/[^"'`]*$/, '').trim())
      .filter((l) => l.length > 12 && !l.startsWith('//') && !/^[}\]);,]+$/.test(l));

  const sources = () => [
    'services/postService.js', 'services/likeService.js', 'routes/posts.js',
    'schemas/postSchema.js', 'data/posts.js', 'seed.js', 'db.js', 'errors.js',
    'lab/p2-36/commentService.js', 'lab/p2-36/commentRoutes.js', 'lab/p2-36/homework2.js',
    '../instagram-react/src/services/api.js',
    '../instagram-react/src/hooks/usePosts.js',
    '../instagram-react/src/components/FeedList.jsx',
    '../instagram-react/src/components/FeedItemActions.jsx',
    '../instagram-react/src/components/CreateFeedModal.jsx',
    '../instagram-react/src/components/FeedItem.jsx',
    '../instagram-react/src/components/FeedItemContent.jsx',
    '../instagram-react/src/components/FeedItemCaption.jsx',
    '../instagram-react/src/utils/timeAgo.js',
    // 🔑 교안은 «바꾸기 전» 코드도 인용한다 — 그것도 실재하는 코드다.
    //    이 회차 시작 시점(p2-21 최종판)이 얼려져 있으니 그것을 코퍼스에 함께 둔다.
    '../instagram-react/src/services/p2-21.final.api.snapshot.js',
    // 🔑 그리고 이 회차가 «만든» 판도 얼려 둔다 (2026-09-13 `p2-37`).
    //    `p2-37` 이 `baseURL` 을 환경변수로 빼내므로 live 파일에는 이 회차가 인용한
    //    `baseURL: "http://localhost:3000/api"` 가 없어진다. 그 인용은 여전히 참이고
    //    (이 회차가 실제로 그렇게 적게 했다) 소급 수정할 대상이 아니라, 그 시점
    //    파일을 코퍼스에 두는 것이 맞다 — `p2-36` 이 `p2-34` 에 해준 것과 같은 처리다.
    '../instagram-react/src/services/p2-36.final.api.snapshot.js',
    '../instagram-react/src/hooks/p2-21.final.usePosts.snapshot.js',
    '../instagram-react/src/components/p2-21.final.FeedList.snapshot.jsx',
    '../instagram-react/src/components/p2-21.final.FeedItemActions.snapshot.jsx',
    '../instagram-react/src/components/p2-21.final.CreateFeedModal.snapshot.jsx',
    // `p2-36` Step 5 가 `minutesAgo` 를 `createdAt` 으로 바꾸기 «전» 의 세 파일.
    '../instagram-react/src/components/p2-21.final.FeedItem.snapshot.jsx',
    '../instagram-react/src/components/p2-21.final.FeedItemContent.snapshot.jsx',
    '../instagram-react/src/components/p2-21.final.FeedItemCaption.snapshot.jsx',
  ].map((f) => squash(read(P(f))))
    // 🔑 (p3-30) 이 회차 당시의 routes/posts.js — p3-30 이 parseId 를 router.param 으로 바꾸고 좋아요 라우트를 routes/likes.js 로 뗐다.
    .concat(squash(execFileSync('git', ['show', 'code/p2-36:routes/posts.js'], { cwd: P('.'), encoding: 'utf8' })));

  for (const [이름, path] of [['교안', LECTURE], ['답안', ANSWERS]]) {
    for (const lang of ['js', 'jsx', 'javascript']) {
      it(`🔴 ${이름}의 \`\`\`${lang} 줄이 전부 코드베이스에 실재한다`, () => {
        const srcs = sources();
        const missing = [];
        for (const b of blocksOf(path, lang)) {
          for (const line of meaningful(b)) {
            if (!srcs.some((s) => s.includes(line))) missing.push(line);
          }
        }
        expect(missing).toEqual([]);
      });
    }
  }

  it('🔴 교안이 인용한 응답 본문이 서버가 실제로 내는 것과 같다', async () => {
    const lec = read(LECTURE);
    // 검사에 걸린 응답 — 교안이 `details` 모양을 그대로 싣는다.
    const res = await fetch(`${server.base}/api/posts`, {
      method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ postAlt: 'x' }),
    });
    const body = await res.json();
    expect(lec).toContain('"message": "보낸 내용이 규칙에 안 맞아요"');
    expect(Object.keys(body.details).sort(), '교안이 properties 한 겹을 그린다')
      .toEqual(['errors', 'properties']);
    expect(lec, '그 한 겹이 교안에도 있어야 한다').toContain('"properties": {');
  });

  it('🔴 요청 본문이 100KB 를 넘으면 413 과 「보낸 내용을 읽을 수 없어요」 — Step 6 머리의 ⚠️', async () => {
    const 올리기 = (kb) => fetch(`${server.base}/api/posts`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        authorId: 2, postAlt: 'x', content: '',
        imageUrls: [`data:image/jpeg;base64,${'A'.repeat(kb * 1024)}`],
      }),
    });
    // 70KB 사진은 글자로 바꾸면 93KB 쯤 — 한도 안이라 올라간다.
    const 작은것 = await 올리기(Math.ceil(70 * 4 / 3));
    expect(작은것.status).toBe(201);
    await fetch(`${server.base}/api/posts/${(await 작은것.json()).id}`, { method: 'DELETE' });

    const 큰것 = await 올리기(150);
    expect(큰것.status).toBe(413);
    expect(await 큰것.json()).toEqual({ message: '보낸 내용을 읽을 수 없어요' });

    const lec = read(LECTURE);
    expect(lec).toContain('100KB가 넘는 요청 본문은 받지 않는데');
    expect(lec).toContain('413과 함께 「보낸 내용을 읽을 수 없어요」가 오는데');
    // ⚠️ 가 Step 6 의 «첫 업로드보다 앞» 에 있어야 한다 — 큰 사진이면 첫 장면(400)부터 413 으로 바뀐다.
    const step6 = lec.slice(lec.indexOf('## Step 6'));
    expect(step6.indexOf('⚠️ **오늘 올릴 사진은 작은 것으로')).toBeLessThan(step6.indexOf('「만들기」를 눌러'));
  });

  it('🔴 Step 5 가 싣는 수치가 실물과 같다 — 가짜 서버의 32 · 시드 직후 표 다섯 줄', async () => {
    const lec = read(LECTURE);
    // 비교 상자의 왼쪽 — 가짜 서버 1번 게시물(jaehoon)의 숫자.
    const mock = JSON.parse(read(P('../instagram-react/mock/db.json')));
    expect(mock.posts[0].username).toBe('jaehoon');
    expect(mock.posts[0].minutesAgo).toBe(32);
    expect(lec).toContain(' 가짜 서버   minutesAgo: 32\n');

    // 표의 오른쪽 칸 — 이 파일 위쪽 축이 진짜 서버 답으로 이미 계산해 확인한 그 다섯 글자.
    const 줄들 = [['12', '12분 전'], ['45', '45분 전'], ['180', '3시간 전'], ['300', '5시간 전'], ['420', '7시간 전']];
    for (const [숫자, 화면] of 줄들) {
      expect(lec).toContain(` ${숫자.padEnd(24)}${화면}\n`);
    }
    const 시드 = read(P('data/posts.js'));
    expect([...시드.matchAll(/minutesAgo: (\d+)/g)].map((m) => m[1])).toEqual(줄들.map(([n]) => n));
  });

  it('🔴 교안이 더하라는 `.http` 요청과 이름으로 부르는 요청이 전부 요청 파일에 있다', () => {
    // 🚨 초판은 이미 파일에 있는 요청(`### 최신 두 개만` · `### 1번 게시물에 dahye가 좋아요`)을
    //    «새로 적으라» 고 했고, 봉투로 바뀐 뒤 깨지는 `{{list[0].id}}` 를 말하지 않았다(2026-09-22 낭독).
    const lec = read(LECTURE);
    const http = read(P('requests/posts.http'));
    for (const q of blocksOf(LECTURE, 'http')) {
      expect(http, q.split('\n')[0]).toContain(q.trim());
    }
    const 제목들 = [...lec.matchAll(/`(### [^`]+)`/g)].map((m) => m[1]);
    expect(제목들.length, '요청을 제목으로 부른다').toBeGreaterThanOrEqual(4);
    for (const 제목 of 제목들) expect(http, 제목).toContain(`${제목}\n`);

    expect(http).toContain('GET http://localhost:3000/api/posts/{{list.items[0].id}}');
    expect(http, '옛 배열 판이 남으면 목록이 봉투가 된 뒤 이 요청이 깨진다').not.toContain('{{list[0].id}}');
    expect(lec).toContain('`{{list.items[0].id}}`로 고쳐주세요');
    // 앞 회차가 인용한 옛 줄은 얼린 판에 남아 있다(`p2-30` 게이트가 그것을 본다).
    expect(read(P('snapshots/p2-35.posts.http'))).toContain('{{list[0].id}}');
  });

  it('🔴 답글도 제 게시물 번호를 갖는다 — 답안이 댓글 5개가 사라진 이유를 `post` 관계로 설명한다', async () => {
    // 🚨 답안 초판은 「답글은 게시물이 아니라 원댓글을 가리켜서, 원댓글이 사라져 답글이 사라진다」고 했다.
    //    학생 에이전트가 부모 외래 키를 뺀 채 게시물을 지워도 답글이 지워지는 것을 보였다(2026-09-22).
    const { rows } = await db.query(
      'select r.id, r.post_id, p.post_id as parent_post from comments r join comments p on p.id = r.parent_id');
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.post_id, `답글 ${r.id}`).toBe(r.parent_post);

    const ans = read(ANSWERS);
    expect(ans).not.toContain('답글은 게시물이 아니라 원댓글을 가리키고');
    expect(ans).toContain('`Comment`의 `post` 관계로 바로 지워지거든요');
  });

  it('🔴 교안이 시킨 세 요청의 결과가 교안이 적은 그대로다', async () => {
    const lec = read(LECTURE);
    expect(lec).toContain('?limit=2             items = 1, 2      hasNext = true');
    expect(lec).toContain('?limit=2&cursor=2    items = 3, 4      hasNext = true');
    expect(lec).toContain('?limit=2&cursor=4    items = 5         hasNext = false');

    for (const [q, ids, next] of [
      ['?limit=2', [1, 2], true], ['?limit=2&cursor=2', [3, 4], true],
      ['?limit=2&cursor=4', [5], false],
    ]) {
      const { body } = await getJson(`/api/posts${q}`);
      expect(body.items.map((p) => p.id), q).toEqual(ids);
      expect(body.hasNext, q).toBe(next);
    }
  });
});
