// p3-17 「내가 눌렀는지」 게이트 — 백엔드 쪽 (프론트 쪽은 instagram-next/.verify)
//
// 이 회차는 파트3(프론트) 회차지만 백엔드의 학생 파일 둘(`routes/posts.js`·
// `services/postService.js`)과 `requests/posts.http` 를 고친다. 판정은 학생이 치는
// `node app.js` 를 그대로 띄워 진짜 포트로 왕복한다(`boot.js`).
//
// 축 ① 목록이 `?userId=` 를 받아 게시물마다 `liked` 를 담는다 — 그 사람이 누른 것만.
// 축 ② `userId` 가 없으면 세지 않고 `liked: false` — `where: { userId: undefined }`
//      가 «조건 없음» 이라 누가 눌렀든 센다는 함정을 막았다.
// 축 ③ 교안 Step 2 의 함정 판(조건 없이 붙인 `_count`)은 정말로 1번을 `true` 로 준다.
// 축 ④ 쿼리 수는 그대로 3개 — `_count` 는 쿼리를 따로 안 보낸다(`p2-35` Step 8).
// 축 ⑤ 게시물 하나 · 만들기 응답에도 `liked: false` 가 붙는다(`flatten` 을 함께 쓴다).
// 축 ⑥ `requests/posts.http` 끝에 교안의 두 요청이 그대로 있다.
// 축 ⑦ 좋아요를 누르고 취소하면 목록의 `liked` 가 따라 바뀐다.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, mkdtempSync, rmSync, cpSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import pg from 'pg';
import { roundDir } from './helpers/round.js';
import { boot } from './helpers/boot.js';
import { setupP236 } from '../sql/p2-36/setup.mjs';
import { applyMigrationsAfter, P234_LAST } from './helpers/tip-schema.js';

const ROOT = new URL('../', import.meta.url);
const P = (rel) => new URL(rel, ROOT).pathname;
const ADMIN = { host: 'localhost', port: 5432, database: 'postgres', user: 'postgres', password: 'postgres' };
const GATE_DB = 'p317_gate';
const GATE_URL = `postgresql://postgres:postgres@localhost:5432/${GATE_DB}`;
const ENV = { DATABASE_URL: GATE_URL, CORS_ORIGIN: 'http://localhost:5173' };
const PORT = 3471;

const read = (p) => readFileSync(p, 'utf8');
// 🚨 (p3-33) 목록의 커서 계약이 바뀌었다(`cursor` 가 불투명 글자 · 응답에 `nextCursor`) — 이 판정은 그 직전 판 `code/p3-32` 를 띄운다.
const PIN = roundDir('code/p3-32');
const C = (rel) => join(PIN.dir, rel);

let db = null;
let server = null;

const seed = () =>
  execFileSync(process.execPath, [P('seed.js')],
    { cwd: P('.'), encoding: 'utf8', env: { ...process.env, ...ENV } });

// 착수 상태 — 지난 시간 Step 7 에서 jaehoon(2번)이 1번 게시물에 누른 좋아요 하나(131).
const startState = async () => {
  seed();
  await db.query('INSERT INTO post_likes (post_id, user_id) VALUES (1, 2)');
  await db.query('UPDATE posts SET like_count = like_count + 1 WHERE id = 1');
};

const dropGate = async () => {
  const admin = new pg.Client(ADMIN);
  await admin.connect();
  await admin.query(
    `select pg_terminate_backend(pid) from pg_stat_activity where datname = '${GATE_DB}' and pid <> pg_backend_pid()`);
  await admin.query(`DROP DATABASE IF EXISTS ${GATE_DB}`);
  return admin;
};

beforeAll(async () => {
  const admin = await dropGate();
  await admin.query(`CREATE DATABASE ${GATE_DB}`);
  await admin.end();

  db = new pg.Client({ ...ADMIN, database: GATE_DB });
  await db.connect();
  await setupP236(db);
  // 공유 Prisma 클라이언트가 tip 스키마로 만들어져 있다 — 시드가 새 컬럼을 고르니 DB 도 맞춘다(`helpers/tip-schema.js`).
  await applyMigrationsAfter(db, P234_LAST);
  await startState();

  server = await boot('app.js', {
    port: PORT, cwd: PIN.dir, env: { ...ENV, PORT: String(PORT) }, ready: `${PORT}번 포트에서`,
  });
}, 120000);

afterAll(async () => {
  if (server) await server.stop();
  PIN.cleanup();
  if (db) await db.end();
  const admin = await dropGate();
  await admin.end();
}, 60000);

const getJson = async (base, path, init) => {
  const res = await fetch(`${base}${path}`, init);
  return { status: res.status, body: await res.json() };
};
const likedOf = (body) => body.items.map((post) => [post.id, post.liked]);

// 학생 폴더를 통째로 임시 폴더에 옮겨, 파일 하나를 바꾼 판을 띄운다.
// node_modules 는 심볼릭 링크 — 학생 파일만 다르고 나머지는 같다.
const withVariant = async (port, replace, fn) => {
  const dir = mkdtempSync(join(tmpdir(), 'p317-variant-'));
  try {
    for (const name of ['app.js', 'db.js', 'errors.js', 'routes', 'services', 'middlewares', 'schemas', 'package.json']) {
      cpSync(C(name), join(dir, name), { recursive: true });
    }
    symlinkSync(P('node_modules'), join(dir, 'node_modules'));
    for (const [rel, text] of Object.entries(replace)) writeFileSync(join(dir, rel), text);
    const variant = await boot(join(dir, 'app.js'), {
      port, env: { ...ENV, PORT: String(port) }, ready: `${port}번 포트에서`,
    });
    try {
      return await fn(variant);
    } finally {
      await variant.stop();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

describe('축 ① — 목록이 «누가 보는지» 를 받아 liked 를 담는다', () => {
  it('🔴 jaehoon(2번)이 보면 1번만 true', async () => {
    const { status, body } = await getJson(server.base, '/api/posts?userId=2&limit=2');
    expect(status).toBe(200);
    expect(likedOf(body)).toEqual([[1, true], [2, false]]);
    expect(body.items[0].likeCount).toBe(131);
    expect(body.hasNext).toBe(true);
  });

  it('🔴 dahye(1번)가 보면 1번도 false — 다른 사람이 누른 것은 안 센다', async () => {
    const { body } = await getJson(server.base, '/api/posts?userId=1&limit=2');
    expect(likedOf(body)).toEqual([[1, false], [2, false]]);
  });

  it('커서와 함께 와도 그대로 — 다음 페이지에도 liked 가 있다', async () => {
    const { body } = await getJson(server.base, '/api/posts?userId=2&limit=2&cursor=2');
    expect(likedOf(body)).toEqual([[3, false], [4, false]]);
  });

  it('liked 는 imageUrls 뒤 마지막 필드 — 교안이 인용하는 응답 모양', async () => {
    const { body } = await getJson(server.base, '/api/posts?userId=2&limit=1');
    const keys = Object.keys(body.items[0]);
    expect(keys.slice(-4)).toEqual(['username', 'profileImage', 'imageUrls', 'liked']);
    expect(keys, '센 값(_count)은 응답에 안 나간다').not.toContain('_count');
  });
});

describe('축 ② — userId 가 없으면 세지 않는다', () => {
  it('🔴 userId 없이 부르면 1번도 false(jaehoon 이 눌렀는데도)', async () => {
    const { body } = await getJson(server.base, '/api/posts?limit=2');
    expect(likedOf(body)).toEqual([[1, false], [2, false]]);
  });

  it('숫자가 아닌 userId 는 없는 것과 같다 — Number(...) || undefined', async () => {
    const { body } = await getJson(server.base, '/api/posts?userId=abc&limit=2');
    expect(likedOf(body)).toEqual([[1, false], [2, false]]);
  });
});

describe('축 ③ — 교안 Step 2 의 함정 판', () => {
  it('🔴 조건 없이 _count 를 붙인 판은 userId 없이 불러도 1번이 true', async () => {
    const trap = read(P('snapshots/p3-17.step2-trap.postService.js'));
    expect(trap, '함정 판은 userId 로 가르지 않고 늘 센다').not.toMatch(/userId\s*\?/);
    await withVariant(PORT + 1, { 'services/postService.js': trap }, async (variant) => {
      const { body } = await getJson(variant.base, '/api/posts?limit=2');
      expect(likedOf(body)).toEqual([[1, true], [2, false]]);
      const mine = await getJson(variant.base, '/api/posts?userId=2&limit=2');
      expect(likedOf(mine.body), 'userId 를 주면 함정 판도 맞다 — 그래서 눈에 안 띈다').toEqual([[1, true], [2, false]]);
    });
  });
});

describe('축 ④ — _count 는 쿼리를 따로 안 보낸다', () => {
  it('🔴 userId 를 줘도 안 줘도 목록 하나에 쿼리 3개', async () => {
    const dbWithLog = read(C('db.js')).replace(
      'new PrismaClient({ adapter })', "new PrismaClient({ adapter, log: ['query'] })");
    expect(dbWithLog).toContain("log: ['query']");
    await withVariant(PORT + 2, { 'db.js': dbWithLog }, async (variant) => {
      const count = async (path) => {
        const before = variant.tail().split('prisma:query').length;
        await getJson(variant.base, path);
        await new Promise((resolve) => setTimeout(resolve, 200));
        return variant.tail().split('prisma:query').length - before;
      };
      expect(await count('/api/posts?limit=2')).toBe(3);
      expect(await count('/api/posts?userId=2&limit=2')).toBe(3);
      expect(variant.tail(), '센 값은 첫 쿼리에 함께 실려 온다').toMatch(/LEFT JOIN \(SELECT "public"\."post_likes"\."post_id", COUNT\(\*\)/);
    });
  });
});

describe('축 ⑤ — 다른 응답에도 liked: false', () => {
  it('게시물 하나', async () => {
    const { status, body } = await getJson(server.base, '/api/posts/1');
    expect(status).toBe(200);
    expect(body.liked).toBe(false);
    expect(body.imageUrls).toHaveLength(3);
  });

  it('만들기 → 지우기', async () => {
    const created = await getJson(server.base, '/api/posts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authorId: 3, imageUrls: ['https://picsum.photos/seed/p317/600/600'] }),
    });
    expect(created.status).toBe(201);
    expect(created.body.liked).toBe(false);
    const removed = await getJson(server.base, `/api/posts/${created.body.id}`, { method: 'DELETE' });
    expect(removed.body.liked).toBe(false);
  });
});

describe('축 ⑥ — requests/posts.http', () => {
  const http = read(P('requests/posts.http'));
  it('🔴 jaehoon 이 보는 목록 · dahye 가 보는 목록 두 요청이 끝에 있다', () => {
    expect(http.trimEnd().endsWith([
      '### jaehoon(2번)이 보는 최신 두 개',
      'GET http://localhost:3000/api/posts?userId=2&limit=2',
      '',
      '### dahye(1번)가 보는 최신 두 개',
      'GET http://localhost:3000/api/posts?userId=1&limit=2',
    ].join('\n'))).toBe(true);
  });

  it('앞 회차가 쓰던 요청은 한 줄도 안 바뀌었다(p3-17 직전 main 의 판 그대로 이어 붙였다)', () => {
    const before = execFileSync('git', ['show', '1b9a339cfaa549c1f8a7b5ee2b81f92eae67386e:requests/posts.http'], { cwd: P('.'), encoding: 'utf8' });
    expect(http.startsWith(before.trimEnd())).toBe(true);
  });
});

describe('축 ⑦ — 누르고 취소하면 목록이 따라온다', () => {
  it('🔴 jaehoon 이 2번을 누르면 true, 취소하면 false', async () => {
    const liked = await getJson(server.base, '/api/posts/2/likes/2', { method: 'PUT' });
    expect(liked.body).toEqual({ liked: true, likeCount: 513 });
    expect(likedOf((await getJson(server.base, '/api/posts?userId=2&limit=2')).body)).toEqual([[1, true], [2, true]]);
    const unliked = await getJson(server.base, '/api/posts/2/likes/2', { method: 'DELETE' });
    expect(unliked.body).toEqual({ liked: false, likeCount: 512 });
    expect(likedOf((await getJson(server.base, '/api/posts?userId=2&limit=2')).body)).toEqual([[1, true], [2, false]]);
  });
});

// ── 교안 인용 ─────────────────────────────────────────────────────────
const LECTURE = P('../../part3/2-react-query/p3-17-liked-and-carousel-lecture.md');
// 줄 단위로 여닫이를 센다 — 정규식으로 찾으면 앞 블록의 닫는 펜스를 여는 펜스로 읽어 짝이 밀린다.
const fences = (md, lang) => {
  const out = [];
  let open = null;
  let body = [];
  for (const line of md.split('\n')) {
    if (open === null && line.startsWith('```')) { open = line.slice(3); body = []; continue; }
    if (open !== null && line === '```') { if (open === lang) out.push(body.join('\n') + '\n'); open = null; continue; }
    if (open !== null) body.push(line);
  }
  return out;
};
const git = (rev, path) => execFileSync('git', ['show', `${rev}:${path}`], { cwd: P('.'), encoding: 'utf8' });

describe('축 ⑧ — 교안이 인용한 백엔드 코드가 그 Step 의 파일에 실재한다', () => {
  const md = read(LECTURE);
  const blocks = fences(md, 'javascript').filter((b) => b.startsWith('// ~/instagram-api/'));
  // Step 2 의 중간 판(조건 없이 붙인 _count)은 함정 판 스냅숏, 나머지는 끝 판이다.
  const sources = {
    // 🔑 (p3-30) 이 회차 당시 판 — p3-30 이 routes/posts.js 를 router.param 으로 바꾸고 좋아요를 routes/likes.js 로 뗐다.
    'routes/posts.js': [git('code/p3-17', 'routes/posts.js')],
    'services/postService.js': [read(C('services/postService.js')), read(P('snapshots/p3-17.step2-trap.postService.js'))],
  };

  it('🔴 백엔드 블록이 넷이다 — 라우트 하나 · 서비스 셋', () => {
    expect(blocks.map((b) => b.split('\n')[0])).toEqual([
      '// ~/instagram-api/routes/posts.js',
      '// ~/instagram-api/services/postService.js',
      '// ~/instagram-api/services/postService.js',
      '// ~/instagram-api/services/postService.js',
    ]);
  });

  it('🔴 블록마다 «...» 을 뺀 줄이 그 파일(어느 한 판)에 차례대로 들어 있다', () => {
    for (const block of blocks) {
      const rel = block.split('\n')[0].replace('// ~/instagram-api/', '');
      const lines = block.split('\n').slice(1).filter((l) => l !== '...' && l !== '');
      const ok = sources[rel].some((src) => {
        let at = 0;
        for (const line of lines) {
          const i = src.indexOf(`\n${line}\n`, at);
          if (i === -1) return false;
          at = i + line.length;
        }
        return true;
      });
      expect(ok, `${rel} 블록:\n${block}`).toBe(true);
    }
  });

  it('Step 2 의 함정 판 블록과 고친 판 블록은 서로 다른 판에서 왔다', () => {
    const [, , trapBlock, fixBlock] = blocks;
    expect(trapBlock).toContain('select: { ...postFields, _count: { select: { likes: { where: { userId } } } } },');
    expect(read(C('services/postService.js'))).not.toContain('select: { ...postFields, _count');
    expect(fixBlock).toContain('select: fields,');
  });

  it('🔴 교안의 .http 두 블록이 posts.http 끝의 두 요청과 같다', () => {
    // 실습 해설의 `.http`(실습 프로젝트 3002)는 빼고 백엔드 요청만 본다.
    const http = fences(md, '').filter((b) => b.startsWith('### ') && b.includes('localhost:3000/api/posts'));
    expect(http).toEqual([
      '### jaehoon(2번)이 보는 최신 두 개\nGET http://localhost:3000/api/posts?userId=2&limit=2\n',
      '### dahye(1번)가 보는 최신 두 개\nGET http://localhost:3000/api/posts?userId=1&limit=2\n',
    ]);
  });

  it('파트2 `_count` 인용 줄이 p2-35 교안에 그대로 있다', () => {
    const p235 = read(P('../../part2/5-db-prisma/p2-35-transactions-lecture.md'));
    expect(md).toContain('include: { _count: { select: { comments: { where: { parentId: null } } } } },');
    expect(p235).toContain('  include: { _count: { select: { comments: { where: { parentId: null } } } } },');
  });
});

describe('축 ⑨ — Step 1·2 의 «이렇게 하면» 주장', () => {
  it('🔴 Step 1 판(라우트만 고침)은 userId 를 실어도 응답이 `### 최신 두 개만` 과 같고 liked 가 없다', async () => {
    const step1Service = git('cb9e40e', 'services/postService.js');
    expect(step1Service, 'Step 1 커밋의 서비스는 p3-16 판 그대로').toBe(git('1b9a339cfaa549c1f8a7b5ee2b81f92eae67386e', 'services/postService.js'));
    await withVariant(PORT + 3, { 'services/postService.js': step1Service, 'routes/posts.js': git('cb9e40e', 'routes/posts.js') }, async (variant) => {
      const withUser = await getJson(variant.base, '/api/posts?userId=2&limit=2');
      const plain = await getJson(variant.base, '/api/posts?limit=2');
      expect(withUser.body).toEqual(plain.body);
      expect(withUser.body.items.every((post) => !('liked' in post))).toBe(true);
    });
  });

  it('🔴 `_count !== undefined` 없이 `_count.likes` 를 읽으면 `### 1번 게시물 지금 상태` 가 500 이다', async () => {
    const noGuard = read(C('services/postService.js')).replace(
      'liked: _count !== undefined && _count.likes > 0,', 'liked: _count.likes > 0,');
    expect(noGuard).toContain('liked: _count.likes > 0,');
    await withVariant(PORT + 4, { 'services/postService.js': noGuard }, async (variant) => {
      const one = await fetch(`${variant.base}/api/posts/1`);
      expect(one.status).toBe(500);
      const list = await getJson(variant.base, '/api/posts?userId=2&limit=2');
      expect(list.status, '목록은 _count 를 붙이니 멀쩡하다').toBe(200);
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(variant.tail()).toContain("Cannot read properties of undefined (reading 'likes')");
    });
  });
});
