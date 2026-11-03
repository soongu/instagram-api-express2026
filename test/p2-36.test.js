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

  it('🔴 좋아요는 `userId` 하나로 켜지고 꺼진다', async () => {
    const MY = Number(FRONT('services/api.js').match(/MY_USER_ID = (\d+)/)[1]);
    const 누르기 = () => fetch(`${server.base}/api/posts/1/likes`, {
      method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ userId: MY }),
    }).then((r) => r.json());

    const 처음 = (await getJson('/api/posts/1')).body.likeCount;
    const 켠뒤 = await 누르기();
    expect(켠뒤).toEqual({ liked: true, likeCount: 처음 + 1 });
    const 끈뒤 = await 누르기();
    expect(끈뒤).toEqual({ liked: false, likeCount: 처음 });

    const r = await db.query('select count(*)::int c from post_likes where post_id = 1');
    expect(r.rows[0].c, '껐으면 줄도 없어야 한다').toBe(0);
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
    const r = await db.query(
      "select column_name from information_schema.columns where table_name = 'users'");
    const 칸 = r.rows.map((x) => x.column_name);
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
  ].map((f) => squash(read(P(f))));

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
