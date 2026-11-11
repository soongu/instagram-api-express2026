// p3-35 「HTTP 캐싱 — 묻지 않게 · 만들기 전에 비교 · 화면 캐시와 나눠 맡기」 게이트 — 백엔드
//
// `6-api-design` 마지막 회차다(`curriculum.md` 「`p3-35` 착수 결정」).
// 수업 백엔드에서 바뀌는 학생 파일 — 새 `middlewares/cache.js` · `app.js`(`/api` 에 `privateNoCache` ·
// `express.static('uploads', { maxAge: '1y', immutable: true })`) · 새 `requests/cache.http`.
//
// 축 ① Step 1 — 앞 판(code/p3-34): JSON 응답에 Cache-Control 이 없고 ETag 만 · If-None-Match 가 같으면 304
// 축 ② Step 2 — 실험 판(max-age=60 한 줄): 목록 응답에 max-age=60
// 축 ③ Step 3 — /api 응답은 private, no-cache · 304 는 그대로 · /uploads 는 이 줄을 안 지난다
// 축 ④ Step 4 — /uploads 사진은 public, max-age=31536000, immutable
// 축 ⑤ Step 5~6 — 실습 서버 lab/p3-35/notices.js(만들기 전에 비교 · 메모리 캐시와 무효화)
// 축 ⑥ 직접 해보기 · 과제 — 정답 판 · 틀린 판
// 축 ⑦ 학생 파일 — code/p3-34 에서 바뀐 파일 · 교안 코드 블록 줄 실재
// 축 ⑧ 학생 상태(최신순 9·1·2·3·4·5)와 앞 회차 잇기 — 2026-11-10 학생 낭독 집중 검수
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, mkdtempSync, rmSync, cpSync, symlinkSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import pg from 'pg';
import { boot } from './helpers/boot.js';
import { roundDir } from './helpers/round.js';
import { applyMigrationsAfter } from './helpers/tip-schema.js';

const ROOT = new URL('../', import.meta.url);
const P = (rel) => new URL(rel, ROOT).pathname;
const read = (path) => readFileSync(path, 'utf8');
const ADMIN = { host: 'localhost', port: 5432, database: 'postgres', user: 'postgres', password: 'postgres' };
const GATE_DB = 'p335_gate';
const GATE_URL = `postgresql://postgres:postgres@localhost:5432/${GATE_DB}`;
const PORT = 3831;

const ROUND = roundDir('code/p3-35');
const R = (rel) => join(ROUND.dir, rel);
const BEFORE = roundDir('code/p3-34');
const B = (rel) => join(BEFORE.dir, rel);

const getRes = async (url, init) => {
  const res = await fetch(url, init);
  const type = res.headers.get('content-type') ?? '';
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: type.includes('json') && text !== '' ? JSON.parse(text) : text };
};

let db = null;
const env = { DATABASE_URL: GATE_URL, CORS_ORIGIN: 'http://localhost:3001' };
const STUDENT_FILES = ['app.js', 'db.js', 'errors.js', 'routes', 'services', 'middlewares', 'schemas', 'docs', 'package.json', 'requests'];

/** overrides: { '상대 경로': 내용 | null(지우기) } · from: 어느 판에서 복사할지(기본 이 회차) */
const withServer = async (port, overrides, fn, from = R) => {
  const dir = mkdtempSync(join(tmpdir(), 'p335-srv-'));
  for (const name of STUDENT_FILES) {
    if (existsSync(from(name))) cpSync(from(name), join(dir, name), { recursive: true });
  }
  symlinkSync(P('node_modules'), join(dir, 'node_modules'));
  for (const [name, src] of Object.entries(overrides)) {
    if (src === null) rmSync(join(dir, name), { force: true });
    else {
      mkdirSync(join(dir, name, '..'), { recursive: true });
      writeFileSync(join(dir, name), src);
    }
  }
  const srv = await boot(join(dir, 'app.js'), { port, cwd: dir, env: { ...env, PORT: String(port) }, ready: `${port}번 포트에서` });
  try {
    await fn({ ...srv, dir });
  } finally {
    await Promise.race([srv.stop(), sleep(500)]);
    rmSync(dir, { recursive: true, force: true });
  }
};

const dropGate = async () => {
  const admin = new pg.Client(ADMIN);
  await admin.connect();
  await admin.query(
    `select pg_terminate_backend(pid) from pg_stat_activity where datname = '${GATE_DB}' and pid <> pg_backend_pid()`);
  await admin.query(`DROP DATABASE IF EXISTS ${GATE_DB}`);
  return admin;
};
const reseed = () => execFileSync(process.execPath, [P('seed.js')], { cwd: P('.'), encoding: 'utf8', env: { ...process.env, ...env } });

beforeAll(async () => {
  const admin = await dropGate();
  await admin.query(`CREATE DATABASE ${GATE_DB}`);
  await admin.end();
  db = new pg.Client({ ...ADMIN, database: GATE_DB });
  await db.connect();
  for (const dir of readdirSync(R('prisma/migrations')).filter((name) => name !== 'migration_lock.toml').sort()) {
    await db.query(read(R(`prisma/migrations/${dir}/migration.sql`)));
  }
  // 🚨 2026-11-10 p3-39 — 작업트리 스키마에 users.password_hash 가 생겼다. 시드가 작업트리 클라이언트로 돌아 그 칸까지 고르므로
  //    (P2022) 이 회차의 마이그레이션 뒤로 tip 의 것을 얹는다. 이 회차의 학생 파일은 그 칸을 읽지도 쓰지도 않는다(test/helpers/tip-schema.js).
  await applyMigrationsAfter(db, '20261106135135_add_posts_feed_index');
  reseed();
}, 120000);

afterAll(async () => {
  if (db) await db.end();
  const admin = await dropGate();
  await admin.end();
  ROUND.cleanup();
  BEFORE.cleanup();
});

const LIST = '/api/posts?userId=2&limit=2';
// 🚨 fetch 는 If-None-Match 를 손으로 실으면 Cache-Control: no-cache 를 덧붙이고, Express 의 fresh 는 그 헤더를 보면
//    늘 200 이다 — Cache-Control 을 먼저 실어 두면 덧붙이지 않는다(p3-27 캐논).
const ask = (etag) => ({ 'If-None-Match': etag, 'Cache-Control': 'max-age=0' });
const PHOTO = P('requests/photos/beach.jpg');

/** 사진 한 장을 올리고 그 주소(/uploads/…)를 돌려준다 */
const upload = async (base) => {
  const form = new FormData();
  form.append('images', new Blob([readFileSync(PHOTO)], { type: 'image/jpeg' }), 'beach.jpg');
  const res = await getRes(`${base}/api/uploads`, { method: 'POST', body: form });
  expect(res.status).toBe(201);
  return res.body.imageUrls[0];
};

describe('축 ① — Step 1: 앞 판은 Cache-Control 없이 ETag 만', () => {
  it('🔴 code/p3-34 — 목록 응답에 Cache-Control 이 없고 ETag 가 있다 · 그 ETag 를 If-None-Match 로 보내면 304', async () => {
    reseed();
    await withServer(PORT, {}, async (before) => {
      const first = await getRes(`${before.base}${LIST}`);
      expect(first.status).toBe(200);
      expect(first.headers.get('cache-control')).toBeNull();
      const etag = first.headers.get('etag');
      expect(etag).toMatch(/^W\/"[0-9a-f]+-/);
      const again = await getRes(`${before.base}${LIST}`, { headers: ask(etag) });
      expect(again.status).toBe(304);
      expect(again.body).toBe('');
      // 304 도 응답을 다 만든 뒤에 비교한다 — 로거 줄이 200 과 같은 꼴로 찍힌다
      await sleep(200);
      expect(before.tail()).toMatch(/GET \/api\/posts\?userId=2&limit=2 304 [\d.]+ms/);
    }, B);
  });
});

describe('축 ② — Step 2: 실험 판(/api/posts 에 max-age=60)', () => {
  it('🔴 snapshots/p3-35.step2-max-age.app.js — 목록 응답에 Cache-Control: max-age=60', async () => {
    reseed();
    await withServer(PORT, { 'app.js': read(P('snapshots/p3-35.step2-max-age.app.js')) }, async (srv) => {
      const res = await getRes(`${srv.base}${LIST}`);
      expect(res.status).toBe(200);
      expect(res.headers.get('cache-control')).toBe('max-age=60');
      // «나는 누구» 는 /api/posts 밖이라 실험 줄을 안 지난다 — 서버가 다시 뜨면 화면이 로그인 화면으로 간다
      expect((await getRes(`${srv.base}/api/auth/me`)).headers.get('cache-control')).toBeNull();
      // 사진도 /api 밖이라 실험 줄을 안 지난다
      const url = await upload(srv.base);
      expect((await getRes(`${srv.base}${url}`)).headers.get('cache-control')).toBe('public, max-age=0');
    });
  });
});

describe('축 ③ — Step 3: /api 응답은 private, no-cache', () => {
  it('🔴 목록 · 나는 누구(401) · 없는 주소(404) 모두 private, no-cache', async () => {
    reseed();
    await withServer(PORT, {}, async (srv) => {
      const list = await getRes(`${srv.base}${LIST}`);
      expect(list.status).toBe(200);
      expect(list.headers.get('cache-control')).toBe('private, no-cache');
      const me = await getRes(`${srv.base}/api/auth/me`);
      expect(me.status).toBe(401);
      expect(me.headers.get('cache-control')).toBe('private, no-cache');
      const none = await getRes(`${srv.base}/api/zzz`);
      expect(none.status).toBe(404);
      expect(none.headers.get('cache-control')).toBe('private, no-cache');
    });
  });

  it('🔴 ETag 와 304 는 그대로 — 같으면 304 · 좋아요를 누른 뒤에는 200 과 새 ETag', async () => {
    reseed();
    await withServer(PORT, {}, async (srv) => {
      const first = await getRes(`${srv.base}${LIST}`);
      const etag = first.headers.get('etag');
      expect((await getRes(`${srv.base}${LIST}`, { headers: ask(etag) })).status).toBe(304);
      const liked = await getRes(`${srv.base}/api/posts/1/likes/2`, { method: 'PUT' });
      expect(liked.status).toBe(200);
      const after = await getRes(`${srv.base}${LIST}`, { headers: ask(etag) });
      expect(after.status).toBe(200);
      expect(after.headers.get('etag')).not.toBe(etag);
      expect(after.body.items[0]).toMatchObject({ id: 1, liked: true });
    });
  });

  it('🔴 requests/cache.http — 첫 요청의 ETag 를 둘째 요청 자리에 붙이면 304', async () => {
    reseed();
    await withServer(PORT, {}, async (srv) => {
      const http = read(R('requests/cache.http'));
      expect(http.split(/^### /m).slice(1).map((chunk) => chunk.split('\n')[0])).toEqual(['게시물 목록', '받아 둔 ETag로 다시 확인하기']);
      const first = await getRes(`${srv.base}${LIST}`);
      const etag = first.headers.get('etag');
      expect(http).toContain(`GET http://localhost:3000${LIST}\nIf-None-Match: 위 응답의 ETag 값\n`);
      // httpYac 은 손으로 적은 If-None-Match 를 그대로 보낸다(Cache-Control 을 덧붙이지 않는다 — 2026-11-09 실측)
      const again = await getRes(`${srv.base}${LIST}`, { headers: ask(etag) });
      expect(again.status).toBe(304);
      expect(again.headers.get('etag')).toBe(etag);
    });
  });

  it('🔴 Swagger UI 정적 파일도 /api 아래라 private, no-cache(express.static 이 이미 있는 값을 안 덮어쓴다)', async () => {
    await withServer(PORT, {}, async (srv) => {
      const css = await getRes(`${srv.base}/api/docs/swagger-ui.css`);
      expect(css.status).toBe(200);
      expect(css.headers.get('cache-control')).toBe('private, no-cache');
    });
  });
});

describe('축 ④ — Step 4: 사진은 1년 + immutable', () => {
  it('🔴 /uploads 사진은 public, max-age=31536000, immutable · ETag·Last-Modified 도 그대로', async () => {
    await withServer(PORT, {}, async (srv) => {
      const url = await upload(srv.base);
      const photo = await getRes(`${srv.base}${url}`);
      expect(photo.status).toBe(200);
      expect(photo.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
      expect(photo.headers.get('etag')).toMatch(/^W\//);
      expect(photo.headers.get('last-modified')).not.toBeNull();
    });
  });

  it('🔴 앞 판(code/p3-34)의 사진은 public, max-age=0', async () => {
    await withServer(PORT, {}, async (before) => {
      const url = await upload(before.base);
      expect((await getRes(`${before.base}${url}`)).headers.get('cache-control')).toBe('public, max-age=0');
    }, B);
  });
});

// ── 실습 서버 — 학생 폴더 모양(lab/p3-35/ 아래 · middlewares/ 는 ../../)의 임시 폴더에 두고 포트만 바꿔 띄운다
const LAB = (name) => read(R(`lab/p3-35/${name}`));
const PHOTO_ID = '0b6f2c1e-6f1d-4a54-9a43-1f5b8f0c9d21';
const withLab = async (src, labPort, port, fn) => {
  const dir = mkdtempSync(join(tmpdir(), 'p335-lab-'));
  symlinkSync(P('node_modules'), join(dir, 'node_modules'));
  cpSync(R('middlewares'), join(dir, 'middlewares'), { recursive: true });
  cpSync(R('package.json'), join(dir, 'package.json'));
  mkdirSync(join(dir, 'lab/p3-35'), { recursive: true });
  // 직접 해보기 1 의 사진 — 교안이 cp 로 만들게 하는 두 파일
  mkdirSync(join(dir, 'lab/p3-35/avatars'));
  mkdirSync(join(dir, 'lab/p3-35/photos'));
  cpSync(P('requests/photos/beach.jpg'), join(dir, 'lab/p3-35/avatars/jaehoon.jpg'));
  cpSync(P('requests/photos/forest.jpg'), join(dir, `lab/p3-35/photos/${PHOTO_ID}.jpg`));
  const body = src.replaceAll(`listen(${labPort}`, `listen(${port}`).replaceAll(`${labPort}번 포트`, `${port}번 포트`);
  writeFileSync(join(dir, 'lab/p3-35/server.js'), body);
  const srv = await boot(join(dir, 'lab/p3-35/server.js'), { port, cwd: dir, ready: `${port}번 포트에서` });
  try {
    await fn(srv);
  } finally {
    await Promise.race([srv.stop(), sleep(500)]);
    rmSync(dir, { recursive: true, force: true });
  }
};
const swap = (src, from, to) => {
  expect(src.split(from).length - 1, from).toBe(1);
  return src.replace(from, to);
};
const built = (srv) => (srv.tail().match(/공지 목록을 만들었어요/g) ?? []).length;
const logLine = (srv, re) => srv.tail().split('\n').filter((line) => re.test(line));
const ms = (line) => Number(line.match(/([\d.]+)ms$/)[1]);
const title = (title) => ({ method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) });

describe('축 ⑤ — Step 5: 만들기 전에 비교', () => {
  it('🔴 시작 판 — 304 로 끝나도 목록을 만든다(0.3초 · «공지 목록을 만들었어요» 두 줄)', async () => {
    await withLab(read(P('snapshots/p3-35.step5-start.notices.js')), 4013, 3832, async (srv) => {
      const first = await getRes(`${srv.base}/api/notices`);
      expect(first.status).toBe(200);
      expect(first.body).toHaveLength(3);
      const etag = first.headers.get('etag');
      expect(etag).toMatch(/^W\//);
      const again = await getRes(`${srv.base}/api/notices`, { headers: ask(etag) });
      expect(again.status).toBe(304);
      await sleep(200);
      expect(built(srv)).toBe(2);
      const [line] = logLine(srv, /GET \/api\/notices 304/);
      expect(ms(line)).toBeGreaterThan(290);
    });
  });

  it('🔴 Step 5 판 — ETag "v1" 을 먼저 정하고 같으면 만들지 않고 304(한 줄 · 빠르다) · 고친 뒤에는 "v2" 로 다시 만든다', async () => {
    await withLab(read(P('snapshots/p3-35.step5.notices.js')), 4013, 3832, async (srv) => {
      const first = await getRes(`${srv.base}/api/notices`);
      expect(first.headers.get('etag')).toBe('"v1"');
      const again = await getRes(`${srv.base}/api/notices`, { headers: ask('"v1"') });
      expect(again.status).toBe(304);
      await sleep(200);
      expect(built(srv)).toBe(1);
      const [line] = logLine(srv, /GET \/api\/notices 304/);
      expect(ms(line)).toBeLessThan(50);
      expect((await getRes(`${srv.base}/api/notices/1`, title('서버 점검 시간 변경'))).status).toBe(200);
      const after = await getRes(`${srv.base}/api/notices`, { headers: ask('"v1"') });
      expect(after.status).toBe(200);
      expect(after.headers.get('etag')).toBe('"v2"');
      expect(after.body[0].title).toBe('서버 점검 시간 변경');
    });
  });

  it('🔴 Step 5 판 — 처음 오는 요청(If-None-Match 없음)은 올 때마다 만든다', async () => {
    await withLab(read(P('snapshots/p3-35.step5.notices.js')), 4013, 3832, async (srv) => {
      for (let turn = 0; turn < 3; turn += 1) expect((await getRes(`${srv.base}/api/notices`)).status).toBe(200);
      await sleep(200);
      expect(built(srv)).toBe(3);
    });
  });

  it('🔴 Cache-Control: no-cache 를 실은 요청(강력 새로고침 · Disable cache)은 번호가 같아도 만든다', async () => {
    await withLab(read(P('snapshots/p3-35.step5.notices.js')), 4013, 3832, async (srv) => {
      await getRes(`${srv.base}/api/notices`);
      const forced = await getRes(`${srv.base}/api/notices`, { headers: { 'If-None-Match': '"v1"', 'Cache-Control': 'no-cache' } });
      expect(forced.status).toBe(200);
      await sleep(200);
      expect(built(srv)).toBe(2);
    });
  });
});

describe('축 ⑤ — Step 6: 메모리 캐시와 무효화', () => {
  it('🔴 끝 판 — 처음 오는 요청 셋에도 한 번만 만든다 · 고치면 다시 만든다 · 지우면 목록에서 빠진다', async () => {
    await withLab(LAB('notices.js'), 4013, 3832, async (srv) => {
      for (let turn = 0; turn < 3; turn += 1) expect((await getRes(`${srv.base}/api/notices`)).status).toBe(200);
      await sleep(200);
      expect(built(srv)).toBe(1);
      const fast = logLine(srv, /GET \/api\/notices 200/).slice(1);
      expect(fast.every((line) => ms(line) < 50)).toBe(true);
      await getRes(`${srv.base}/api/notices/1`, title('서버 점검 시간 변경'));
      expect((await getRes(`${srv.base}/api/notices`)).body[0].title).toBe('서버 점검 시간 변경');
      expect((await getRes(`${srv.base}/api/notices/2`, { method: 'DELETE' })).status).toBe(204);
      const list = await getRes(`${srv.base}/api/notices`, { headers: ask('"v2"') });
      expect(list.status).toBe(200);
      expect(list.headers.get('etag')).toBe('"v3"');
      expect(list.body.map((notice) => notice.id)).toEqual([1, 3]);
      await sleep(200);
      expect(built(srv)).toBe(3);
    });
  });

  it('🔴 DELETE 에서 changed() 를 빠뜨린 판 — 지운 공지가 목록에 남고, 받아 둔 브라우저에는 304', async () => {
    await withLab(read(P('snapshots/p3-35.step6-forgot.notices.js')), 4013, 3832, async (srv) => {
      await getRes(`${srv.base}/api/notices`);
      expect((await getRes(`${srv.base}/api/notices/2`, { method: 'DELETE' })).status).toBe(204);
      expect((await getRes(`${srv.base}/api/notices`, { headers: ask('"v1"') })).status).toBe(304);
      expect((await getRes(`${srv.base}/api/notices`)).body.map((notice) => notice.id)).toEqual([1, 2, 3]);
    });
  });

  it('🔴 끝 판이 Step 5 판에 더한 cachedList 줄은 다섯(선언 · 비우기 · 검사 · 담기 · 응답)', () => {
    const final = LAB('notices.js');
    const step5 = read(P('snapshots/p3-35.step5.notices.js'));
    const extra = final.split('\n').filter((line) => !step5.split('\n').includes(line) && line.trim() !== '' && line.trim() !== '}');
    expect(extra.filter((line) => line.includes('cachedList'))).toHaveLength(5);
  });
});

const lines = (srv, re) => (srv.tail().match(re) ?? []).length;
const START = (name) => read(P(`snapshots/p3-35.${name.replace('.js', '')}-start.${name}`));

describe('축 ⑥ — 직접 해보기 1: 응답마다 Cache-Control 고르기(4001)', () => {
  const heads = async (base) => {
    const get = async (path, init) => (await getRes(`${base}${path}`, init)).headers.get('cache-control');
    return {
      avatar: await get('/avatars/jaehoon.jpg'),
      photo: await get(`/photos/${PHOTO_ID}.jpg`),
      notices: await get('/api/notices'),
      me: await get('/api/me', { headers: { Cookie: 'user=jaehoon' } }),
    };
  };
  it('🔴 시작 판 — 프로필 사진도 1년 · API 응답에는 Cache-Control 이 없다', async () => {
    await withLab(START('practice1.js'), 4001, 3833, async (srv) => {
      expect(await heads(srv.base)).toEqual({ avatar: 'public, max-age=31536000, immutable', photo: 'public, max-age=31536000, immutable', notices: null, me: null });
    });
  });
  it('🔴 정답 판 — 프로필 사진은 매번 확인 · 게시물 사진은 1년 · 공지 no-cache · 내 정보 private, no-cache', async () => {
    await withLab(LAB('practice1.js'), 4001, 3833, async (srv) => {
      expect(await heads(srv.base)).toEqual({ avatar: 'public, max-age=0', photo: 'public, max-age=31536000, immutable', notices: 'no-cache', me: 'private, no-cache' });
      expect((await getRes(`${srv.base}/api/me`, { headers: { Cookie: 'user=jaehoon' } })).body).toEqual({ username: 'jaehoon' });
    });
  });
});

describe('축 ⑥ — 직접 해보기 2: 글 하나 — 만들기 전에 비교(4002)', () => {
  const OLD = '"1-1762650000000"';
  const check = async (srv) => {
    const first = await getRes(`${srv.base}/api/articles/1`);
    const again = await getRes(`${srv.base}/api/articles/1`, { headers: ask(OLD) });
    await sleep(200);
    const builtBefore = lines(srv, /1번 글을 만들었어요/g);
    await getRes(`${srv.base}/api/articles/1`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: '글을 조금 고쳤어요.' }) });
    const after = await getRes(`${srv.base}/api/articles/1`, { headers: ask(OLD) });
    return { firstEtag: first.headers.get('etag'), again: again.status, builtBefore, after: after.status, afterBody: after.body.body ?? null };
  };
  it('🔴 정답 판 — ETag "1-1762650000000" · 같으면 304 에 «만들었어요» 한 줄뿐 · 고친 뒤에는 200', async () => {
    await withLab(LAB('practice2.js'), 4002, 3834, async (srv) => {
      expect(await check(srv)).toEqual({ firstEtag: OLD, again: 304, builtBefore: 1, after: 200, afterBody: '글을 조금 고쳤어요.' });
      expect((await getRes(`${srv.base}/api/articles/9`)).status).toBe(404);
    });
  });
  it('🔴 시작 판 — 손으로 적은 ETag 가 Express 의 W/ 값과 달라 늘 200 · 두 번 만든다', async () => {
    await withLab(START('practice2.js'), 4002, 3834, async (srv) => {
      const got = await check(srv);
      expect(got.firstEtag).toMatch(/^W\//);
      expect(got.again).toBe(200);
      expect(got.builtBefore).toBe(2);
    });
  });
  it('🔴 틀린 판 — ETag 에 글 번호만 넣으면 고친 뒤에도 304(옛 글)', async () => {
    const wrong = swap(LAB('practice2.js'), '`"${article.id}-${article.updatedAt}"`', '`"${article.id}"`');
    await withLab(wrong, 4002, 3834, async (srv) => {
      await getRes(`${srv.base}/api/articles/1`);
      await getRes(`${srv.base}/api/articles/1`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: '글을 조금 고쳤어요.' }) });
      expect((await getRes(`${srv.base}/api/articles/1`, { headers: ask('"1"') })).status).toBe(304);
    });
  });
  it('🔴 틀린 판 — 글 번호만 넣으면 .http 의 손으로 적은 "1-1762650000000" 과 달라 둘째 요청부터 200 · 첫 etag 가 "1"', async () => {
    const wrong = swap(LAB('practice2.js'), '`"${article.id}-${article.updatedAt}"`', '`"${article.id}"`');
    await withLab(wrong, 4002, 3834, async (srv) => {
      expect((await getRes(`${srv.base}/api/articles/1`)).headers.get('etag')).toBe('"1"');
      expect((await getRes(`${srv.base}/api/articles/1`, { headers: ask(OLD) })).status).toBe(200);
    });
  });
  it('🔴 틀린 판 — 304 뒤 return 을 빠뜨리면 304 는 가지만 «만들었어요» 가 찍힌다', async () => {
    const wrong = swap(LAB('practice2.js'), '    res.status(304).end();\n    return;\n', '    res.status(304).end();\n');
    await withLab(wrong, 4002, 3834, async (srv) => {
      await getRes(`${srv.base}/api/articles/1`);
      expect((await getRes(`${srv.base}/api/articles/1`, { headers: ask(OLD) })).status).toBe(304);
      await sleep(600);
      expect(lines(srv, /1번 글을 만들었어요/g)).toBe(2);
    });
  });
});

describe('축 ⑥ — 직접 해보기 3: 주소마다 담는 메모리 캐시(4003)', () => {
  const PATCH = { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: '서버 점검 시간 변경' }) };
  const views = async (base) => ({
    all: (await getRes(`${base}/api/notices`)).body.map((n) => `${n.id}:${n.title}`),
    pinned: (await getRes(`${base}/api/notices?pinned=true`)).body.map((n) => `${n.id}:${n.title}`),
  });
  it('🔴 정답 판 — 두 목록을 두 번씩 받아도 두 번만 만든다 · 고치면 두 목록 모두 새 제목', async () => {
    await withLab(LAB('practice3.js'), 4003, 3835, async (srv) => {
      expect(await views(srv.base)).toEqual({ all: ['1:서버 점검 안내', '2:새 기능 소개', '3:이용 약관 변경'], pinned: ['1:서버 점검 안내', '3:이용 약관 변경'] });
      await views(srv.base);
      await sleep(200);
      expect(lines(srv, /목록을 만들었어요/g)).toBe(2);
      await getRes(`${srv.base}/api/notices/1`, PATCH);
      expect(await views(srv.base)).toEqual({ all: ['1:서버 점검 시간 변경', '2:새 기능 소개', '3:이용 약관 변경'], pinned: ['1:서버 점검 시간 변경', '3:이용 약관 변경'] });
    });
  });
  it('🔴 시작 판 — 받을 때마다 만든다(넷)', async () => {
    await withLab(START('practice3.js'), 4003, 3835, async (srv) => {
      await views(srv.base);
      await views(srv.base);
      await sleep(200);
      expect(lines(srv, /목록을 만들었어요/g)).toBe(4);
    });
  });
  it('🔴 틀린 판 — PATCH 에서 cache.delete(req.originalUrl) 이면 지우는 키가 /api/notices/1 이라 두 목록 모두 옛 제목', async () => {
    await withLab(swap(LAB('practice3.js'), 'cache.clear();', 'cache.delete(req.originalUrl);'), 4003, 3835, async (srv) => {
      await views(srv.base);
      await getRes(`${srv.base}/api/notices/1`, PATCH);
      const after = await views(srv.base);
      expect(after.all[0]).toBe('1:서버 점검 안내');
      expect(after.pinned[0]).toBe('1:서버 점검 안내');
    });
  });
  it('🔴 틀린 판 — 키를 req.path 로 잡으면 먼저 받은 목록이 다른 주소에도 간다', async () => {
    await withLab(swap(LAB('practice3.js'), 'const key = req.originalUrl;', 'const key = req.path;'), 4003, 3835, async (srv) => {
      const got = await views(srv.base);
      expect(got.pinned).toEqual(got.all);
    });
  });
});

describe('축 ⑥ — 과제 [기초]: 프로필의 버전과 304(4011)', () => {
  const OLD = '"jaehoon-1"';
  const check = async (srv) => {
    const first = await getRes(`${srv.base}/api/profiles/jaehoon`);
    const again = await getRes(`${srv.base}/api/profiles/jaehoon`, { headers: ask(OLD) });
    await sleep(200);
    const builtBefore = lines(srv, /jaehoon 프로필을 만들었어요/g);
    await getRes(`${srv.base}/api/profiles/jaehoon/follow`, { method: 'POST' });
    const after = await getRes(`${srv.base}/api/profiles/jaehoon`, { headers: ask(OLD) });
    const none = await getRes(`${srv.base}/api/profiles/nobody`);
    return { cc: first.headers.get('cache-control'), etag: first.headers.get('etag'), again: again.status, builtBefore, after: after.status, count: after.body.followerCount ?? null, noneCc: none.headers.get('cache-control'), none: none.status };
  };
  it('🔴 정답 판', async () => {
    await withLab(LAB('homework1.js'), 4011, 3836, async (srv) => {
      expect(await check(srv)).toEqual({ cc: 'public, no-cache', etag: OLD, again: 304, builtBefore: 1, after: 200, count: 121, noneCc: 'public, no-cache', none: 404 });
    });
  });
  it('🔴 시작 판 — Cache-Control 이 없고 손으로 적은 ETag 로는 200 · 두 번 만든다', async () => {
    await withLab(START('homework1.js'), 4011, 3836, async (srv) => {
      const got = await check(srv);
      expect([got.cc, got.again, got.builtBefore]).toEqual([null, 200, 2]);
    });
  });
  it('🔴 틀린 판 — 사용자 이름만 넣으면 첫 etag 가 "jaehoon" 이고 손으로 적은 "jaehoon-1" 에는 200', async () => {
    await withLab(swap(LAB('homework1.js'), '`"${profile.username}-${profile.version}"`', '`"${profile.username}"`'), 4011, 3836, async (srv) => {
      expect((await getRes(`${srv.base}/api/profiles/jaehoon`)).headers.get('etag')).toBe('"jaehoon"');
      expect((await getRes(`${srv.base}/api/profiles/jaehoon`, { headers: ask(OLD) })).status).toBe(200);
    });
  });
  it('🔴 틀린 판 — 팔로우에서 version 을 안 올리면 팔로워가 늘어도 304(옛 숫자)', async () => {
    await withLab(swap(LAB('homework1.js'), '  profile.version += 1;\n', ''), 4011, 3836, async (srv) => {
      expect((await check(srv)).after).toBe(304);
    });
  });
});

describe('축 ⑥ — 과제 [응용]: 만료 시간이 있는 캐시(4012)', () => {
  const add = (base) => getRes(`${base}/api/posts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hashtags: ['맛집'] }) });
  const top = async (base) => (await getRes(`${base}/api/hashtags/popular`)).body[0];
  it('🔴 정답 판 — public, max-age=10 · 10초 안에는 한 번만 센다 · 새 게시물은 10초 뒤에 반영', async () => {
    await withLab(LAB('homework2.js'), 4012, 3837, async (srv) => {
      const first = await getRes(`${srv.base}/api/hashtags/popular`);
      expect(first.headers.get('cache-control')).toBe('public, max-age=10');
      expect(first.body).toEqual([{ name: '여행', count: 2 }, { name: '바다', count: 2 }, { name: '맛집', count: 1 }]);
      await add(srv.base);
      await add(srv.base);
      expect(await top(srv.base)).toEqual({ name: '여행', count: 2 });
      await sleep(200);
      expect(lines(srv, /인기 해시태그를 셌어요/g)).toBe(1);
      await sleep(10000);
      expect(await top(srv.base)).toEqual({ name: '맛집', count: 3 });
      await sleep(200);
      expect(lines(srv, /인기 해시태그를 셌어요/g)).toBe(2);
    });
  }, 20000);
  it('🔴 시작 판 — 받을 때마다 센다 · Cache-Control 이 없다 · 새 게시물이 바로 보인다', async () => {
    await withLab(START('homework2.js'), 4012, 3837, async (srv) => {
      const first = await getRes(`${srv.base}/api/hashtags/popular`);
      expect(first.headers.get('cache-control')).toBeNull();
      await add(srv.base);
      await add(srv.base);
      expect(await top(srv.base)).toEqual({ name: '맛집', count: 3 });
      await sleep(200);
      expect(lines(srv, /인기 해시태그를 셌어요/g)).toBe(2);
    });
  });
  it('🔴 틀린 판 — 시각을 안 보면 10초가 지나도 옛 결과', async () => {
    await withLab(swap(LAB('homework2.js'), 'saved === null || Date.now() - saved.countedAt >= TEN_SECONDS', 'saved === null'), 4012, 3837, async (srv) => {
      await getRes(`${srv.base}/api/hashtags/popular`);
      await add(srv.base);
      await add(srv.base);
      await sleep(10300);
      expect(await top(srv.base)).toEqual({ name: '여행', count: 2 });
    });
  }, 20000);
});

// ── 답안이 «흔한 실수 · 더 좋아요» 에서 주장하는 동작
describe('축 ⑥ — 답안의 주장', () => {
  it('🔴 [기초] 미들웨어를 라우트 아래에 두면 프로필 응답에도 라우트의 404 에도 Cache-Control 이 없다', async () => {
    const src = LAB('homework1.js');
    const mw = "// 프로필은 누가 보든 같다 — 공유 캐시에 둬도 되지만, 쓸 때마다 서버에 확인하게 한다.\napp.use('/api', (req, res, next) => {\n  res.set('Cache-Control', 'public, no-cache');\n  next();\n});\n\n";
    const moved = swap(src, mw, '').replace("app.listen(4011", `${mw}app.listen(4011`);
    await withLab(moved, 4011, 3836, async (srv) => {
      expect((await getRes(`${srv.base}/api/profiles/jaehoon`)).headers.get('cache-control')).toBeNull();
      expect((await getRes(`${srv.base}/api/profiles/nobody`)).headers.get('cache-control')).toBeNull();
    });
  });
  it('🔴 [기초] ETag 를 req.fresh 뒤(res.json 바로 위)에 정하면 304 는 res.send 가 보내지만 두 번 만든다 · 304 도 0.3초', async () => {
    const src = LAB('homework1.js');
    const set = "  res.set('ETag', `\"${profile.username}-${profile.version}\"`);\n";
    const after = swap(swap(src, set, ''), '  res.json(await render(profile));', `${set}  res.json(await render(profile));`);
    await withLab(after, 4011, 3836, async (srv) => {
      expect((await getRes(`${srv.base}/api/profiles/jaehoon`)).headers.get('etag')).toBe('"jaehoon-1"');
      expect((await getRes(`${srv.base}/api/profiles/jaehoon`, { headers: ask('"jaehoon-1"') })).status).toBe(304);
      await sleep(200);
      expect(lines(srv, /jaehoon 프로필을 만들었어요/g)).toBe(2);
      expect(ms(logLine(srv, /GET \/api\/profiles\/jaehoon 304/)[0])).toBeGreaterThan(290);
    });
  });
  it('🔴 [응용] 받을 때마다 센 시각을 새로 적으면 요청이 이어지는 동안 10초가 지나도 다시 세지 않는다', async () => {
    const wrong = swap(LAB('homework2.js'), '  res.json(saved.hashtags);', '  saved.countedAt = Date.now();\n  res.json(saved.hashtags);');
    await withLab(wrong, 4012, 3837, async (srv) => {
      for (let turn = 0; turn < 6; turn += 1) {
        await getRes(`${srv.base}/api/hashtags/popular`);
        await sleep(2000);
      }
      expect(lines(srv, /인기 해시태그를 셌어요/g)).toBe(1);
    });
  }, 20000);
  it('🔴 [응용] 만료된 뒤 요청 셋이 동시에 오면 셋 다 센다', async () => {
    const short = swap(LAB('homework2.js'), 'const TEN_SECONDS = 10 * 1000;', 'const TEN_SECONDS = 1000;');
    await withLab(short, 4012, 3837, async (srv) => {
      await getRes(`${srv.base}/api/hashtags/popular`);
      await sleep(1100);
      await Promise.all([0, 1, 2].map(() => getRes(`${srv.base}/api/hashtags/popular`)));
      await sleep(200);
      expect(lines(srv, /인기 해시태그를 셌어요/g)).toBe(4);
    });
  });
});

const LECTURE = () => read(P('../../part3/6-api-design/p3-35-http-caching-lecture.md'));
const ANSWERS = () => read(P('../../part3/6-api-design/p3-35-http-caching-answers.md'));
/** 마크다운의 펜스를 차례대로 { lang, body, line } 으로 */
const fences = (md) => {
  const out = [];
  let open = null;
  md.split('\n').forEach((text, index) => {
    const m = text.match(/^```(\S*)$/);
    if (!m) { if (open) open.body.push(text); return; }
    if (open) { out.push({ ...open, body: open.body.join('\n') }); open = null; } else open = { lang: m[1], body: [], line: index + 1 };
  });
  return out;
};

describe('축 ⑦ — 학생 파일과 교안 블록', () => {
  it('🔴 code/p3-34 에서 바뀐 학생 파일', () => {
    const changed = execFileSync('git', ['diff', '--name-only', 'code/p3-34', ROUND.fromBookmark ? 'code/p3-35' : 'HEAD', '--', '.', ':(exclude)test', ':(exclude)lab', ':(exclude)snapshots'], { cwd: P('.'), encoding: 'utf8' }).trim().split('\n').sort();
    expect(changed).toEqual([
      'app.js',
      'middlewares/cache.js',
      'requests/cache.http',
      // requests/rest.http 는 p3-32 학생 낭독 집중 검수(2026-11-09 · 84f5d11)가 main 에서 고쳤다 — 이 회차의 변경이 아니다.
      'requests/rest.http',
    ]);
  });

  it('🔴 교안의 코드 블록 — 줄마다 그 파일(또는 그 Step 의 판)에 실재한다', () => {
    const owners = {
      '// ~/instagram-api/app.js': [read(R('app.js')), read(P('snapshots/p3-35.step2-max-age.app.js'))],
      '// ~/instagram-api/middlewares/cache.js': [read(R('middlewares/cache.js'))],
      '// ~/instagram-api/services/postService.js': [read(P('snapshots/p3-35.step1-log.postService.js'))],
      '// ~/instagram-api/node_modules/express/lib/response.js': [read(P('node_modules/express/lib/response.js'))],
      '// ~/instagram-api/lab/p3-35/notices.js': [LAB('notices.js'), read(P('snapshots/p3-35.step5-start.notices.js')), read(P('snapshots/p3-35.step5.notices.js')), read(P('snapshots/p3-35.step6-forgot.notices.js'))],
      '// ~/instagram-api/lab/p3-31/peek.js': [read(R('lab/p3-31/peek.js'))],
      '// ~/instagram-api/lab/p3-35/practice1.js': [LAB('practice1.js'), START('practice1.js')],
      '// ~/instagram-api/lab/p3-35/practice2.js': [LAB('practice2.js'), START('practice2.js')],
      '// ~/instagram-api/lab/p3-35/practice3.js': [LAB('practice3.js'), START('practice3.js')],
      '// ~/instagram-api/lab/p3-35/homework1.js': [START('homework1.js')],
      '// ~/instagram-api/lab/p3-35/homework2.js': [START('homework2.js')],
    };
    let seen = 0;
    for (const f of fences(LECTURE()).filter((one) => one.lang === 'javascript')) {
      const [head, ...rest] = f.body.split('\n');
      expect(owners[head], `L${f.line}: ${head}`).toBeDefined();
      seen += 1;
      const hay = owners[head].join('\n');
      for (const line of rest.filter((one) => one.trim() !== '')) expect(hay, `L${f.line}: ${line}`).toContain(line);
    }
    expect(seen).toBeGreaterThanOrEqual(20);
    // 시작 판을 통째로 싣는 블록은 그 파일과 byte 같다
    const whole = fences(LECTURE()).filter((f) => f.lang === 'javascript').map((f) => `${f.body}\n`);
    for (const name of ['practice1.js', 'practice2.js', 'practice3.js', 'homework1.js', 'homework2.js']) expect(whole, name).toContain(START(name));
    expect(whole).toContain(read(P('snapshots/p3-35.step5-start.notices.js')));
    expect(whole).toContain(read(R('middlewares/cache.js')));
  });

  it('🔴 교안의 요청 블록은 .http 와 byte 같다 · bash 블록은 직접 해보기 1 의 사진 준비', () => {
    const http = fences(LECTURE()).filter((f) => f.lang === 'http').map((f) => `${f.body}\n`);
    expect(http).toEqual([read(R('requests/cache.http')), LAB('practice1.http'), LAB('notices.http'), LAB('practice2.http'), LAB('practice3.http'), LAB('homework1.http'), LAB('homework2.http')]);
    const bash = fences(LECTURE()).filter((f) => f.lang === 'bash').map((f) => f.body);
    expect(bash).toEqual([`mkdir -p lab/p3-35/avatars lab/p3-35/photos\ncp requests/photos/beach.jpg lab/p3-35/avatars/jaehoon.jpg\ncp requests/photos/forest.jpg lab/p3-35/photos/${PHOTO_ID}.jpg`]);
  });
});

describe('축 ⑦ — 답안 블록', () => {
  it('🔴 답안의 코드 블록은 과제 정답 파일과 byte 같고, 요청 블록은 .http 와 byte 같다', () => {
    const blocks = fences(ANSWERS());
    expect(blocks.filter((f) => f.lang === 'javascript').map((f) => `${f.body}\n`)).toEqual([LAB('homework1.js'), LAB('homework2.js')]);
    expect(blocks.filter((f) => f.lang === 'http').map((f) => `${f.body}\n`)).toEqual([LAB('homework1.http'), LAB('homework2.http')]);
  });
});

// ── 축 ⑧ — 학생 상태와 앞 회차 잇기(2026-11-10 학생 낭독 집중 검수)
// 지난 시간까지 교안을 따라온 학생의 수업 DB 는 최신순 9·1·2·3·4·5다 — p3-32 Step 7 이 7·8번을 올리고, p3-34 Step 2 가
// 7번을 지운 뒤 posts.http «게시물 올리기» 로 9번을 올리고 8번을 지웠다. jaehoon(2번)은 1번 게시물에 좋아요를 눌러 두었다.
// 교안의 개수·커서·ETag 는 이 상태로 적는다(시드 다섯 판으로 적었던 것이 학생 낭독 FAIL).
const send = (base, method, path, json) => getRes(`${base}${path}`, json === undefined
  ? { method }
  : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(json) });
// 🚨 (p3-41) 그 회차가 posts.http «게시물 올리기» 의 authorId 줄을 지웠다(글쓴이는 로그인 정보로) — 이 회차 학생이 보낸 판(code/p3-40)을 읽는다.
const httpBody = (file, name) => {
  const text = execFileSync('git', ['show', `code/p3-40:requests/${file}`], { cwd: P('.'), encoding: 'utf8' });
  const block = text.split('\n### ').find((one) => one.replace(/^### /, '').startsWith(`${name}\n`));
  return JSON.parse(block.slice(block.indexOf('{'), block.lastIndexOf('}') + 1));
};
// 학생 파일의 «게시물 올리기» 는 p3-16 Step 6 이 사진 주소를 picsum 으로 바꾼 판이다(본문 길이가 ETag 앞부분을 정한다).
const PICSUM = ['https://picsum.photos/seed/post8/600/600', 'https://picsum.photos/seed/post9/600/600'];
const studentState = async (base) => {
  reseed();
  await db.query("SELECT setval('posts_id_seq', 6)");
  expect((await send(base, 'PUT', '/api/posts/1/likes/2')).status).toBe(200);
  const rest = httpBody('rest.http', '게시물 올리기 — Location 보기');
  for (let n = 0; n < 2; n += 1) expect((await send(base, 'POST', '/api/posts', rest)).status).toBe(201);
  expect((await send(base, 'DELETE', '/api/posts/7')).status).toBe(200);
  const nine = await send(base, 'POST', '/api/posts', { ...httpBody('posts.http', '게시물 올리기'), imageUrls: PICSUM });
  expect([nine.status, nine.body.id]).toEqual([201, 9]);
  expect((await send(base, 'DELETE', '/api/posts/8')).status).toBe(200);
};
const decode = (cursor) => JSON.parse(Buffer.from(cursor, 'base64url').toString());
/** 화면처럼 첫 페이지부터 nextCursor 를 따라 끝까지 — { path, res } */
const walk = async (base) => {
  const pages = [];
  let cursor = null;
  do {
    const path = `${LIST}${cursor ? `&cursor=${cursor}` : ''}`;
    const res = await getRes(`${base}${path}`);
    pages.push({ path, res });
    cursor = res.body.nextCursor;
  } while (cursor);
  return pages;
};
/** <details> 토글을 뺀 본문 */
const bodyOnly = (md) => md.replace(/<details>[\s\S]*?<\/details>/g, '');
const prior = (rel) => bodyOnly(read(P(`../../${rel}`)));
const kind = (line) => {
  if (line === '게시물 목록을 만들었어요') return 'built';
  if (/^GET \/api\/auth\/me 304 [\d.]+ms$/.test(line)) return 'me304';
  const m = line.match(/^GET \/api\/posts\?userId=2&limit=2(?:&cursor=(\S+))? 304 [\d.]+ms$/);
  if (m) return m[1] ? `page${decode(m[1]).id}` : 'page';
  return line;
};

describe('축 ⑧ — 학생 상태: 지난 시간까지 따라온 수업 DB 는 최신순 9·1·2·3·4·5', () => {
  it('🔴 오프닝·Step 1 — 게시물 6개를 2개씩 3페이지 · 다음 커서를 풀면 1번·3번 · 첫 페이지 ETag 는 W/"3b6- · 교안 로그·헤더가 그 값', async () => {
    await withServer(PORT, {}, async (before) => {
      await studentState(before.base);
      const pages = await walk(before.base);
      expect(pages.map(({ res }) => res.body.items.map((post) => post.id))).toEqual([[9, 1], [2, 3], [4, 5]]);
      expect(pages.slice(0, 2).map(({ res }) => decode(res.body.nextCursor).id)).toEqual([1, 3]);
      expect(pages[0].res.body.items.map((post) => post.liked)).toEqual([false, true]);
      expect(pages[0].res.headers.get('etag')).toMatch(/^W\/"3b6-/);
    }, B);
    const lecture = LECTURE();
    expect(lecture).not.toContain('시드 그대로라면');
    expect(lecture).toContain('지난 시간에 9번을 올리고 7번과 8번을 지웠으니 6개예요.');
    expect(lecture).toContain('게시물 6개를 2개씩 받으니 목록은 3페이지예요');
    expect(lecture).toContain('맨 위 카드(지난 시간에 올린 9번 게시물)의 빈 하트를 눌러 볼게요.');
    // 교안 로그 펜스의 커서는 모두 1번·3번 게시물을 가리킨다(오프닝 · Step 1 확인용 줄 · Step 3)
    const cursors = [...lecture.matchAll(/cursor=(eyJ[A-Za-z0-9_-]+)/g)].map((m) => decode(m[1]).id);
    expect(cursors).toEqual([1, 3, 1, 3, 1, 3]);
    expect(lecture).not.toMatch(/W\/"3c9-/);
    expect(lecture).toContain('etag: W/"3b6-');
    expect(prior('part3/6-api-design/p3-34-versioning-docs-lecture.md')).toContain("fetch('/api/posts/8', { method: 'DELETE' });");
  });

  it('🔴 Step 1 확인용 줄 — getPosts 맨 앞의 console.log 가 304 로 끝난 목록 요청마다 찍힌다 · 교안의 로그 펜스가 그 차례', async () => {
    const snap = read(P('snapshots/p3-35.step1-log.postService.js'));
    const base = read(B('services/postService.js')).split('\n');
    expect(snap.split('\n').filter((line) => !base.includes(line))).toEqual([
      '  // 확인용 — 목록을 만들 때마다 터미널에 찍는다(Step 2 에서 지운다).',
      "  console.log('게시물 목록을 만들었어요');",
    ]);
    await withServer(PORT, { 'services/postService.js': snap }, async (srv) => {
      await studentState(srv.base);
      const pages = await walk(srv.base);
      await sleep(200);
      const from = srv.tail().length;
      // 탭에 돌아오면 화면은 세 페이지를 차례로 다시 받고, 브라우저는 받아 둔 ETag 를 싣는다
      const again = [];
      for (const { path, res } of pages) again.push((await getRes(`${srv.base}${path}`, { headers: ask(res.headers.get('etag')) })).status);
      await sleep(200);
      expect(again).toEqual([304, 304, 304]);
      const fresh = srv.tail().slice(from).split('\n').filter((line) => line !== '').map(kind);
      expect(fresh).toEqual(['built', 'page', 'built', 'page1', 'built', 'page3']);
    }, B);
    const lecture = LECTURE();
    const block = fences(lecture).find((f) => f.lang === '' && f.body.includes('게시물 목록을 만들었어요'));
    expect(block).toBeDefined();
    // «나는 누구» 는 첫 페이지와 함께 출발해 첫 확인용 줄 뒤에 끝난다(헤드리스 크롬으로 탭을 다섯 번 다녀와 늘 이 차례였다)
    expect(block.body.split('\n').map(kind)).toEqual(['built', 'me304', 'page', 'built', 'page1', 'built', 'page3']);
    expect(lecture).toContain('**목록 요청 3개가 모두 304로 끝났는데, «게시물 목록을 만들었어요»도 세 번 찍혔어요.**');
    expect(lecture).toContain('먼저 Step 1에서 `getPosts`에 넣은 확인용 두 줄을 지우고,');
    expect(lecture).not.toContain('304 줄의 시간을 보면 200 줄과 크게 다르지 않아요');
  });

  it('🔴 Step 4 — 따라온 학생의 peek.js 에는 p3-31 Step 8 이 시킨 사진 파일 이름이 들어 있다 · 교안은 임시 이름이라고 하지 않는다', () => {
    expect(prior('part3/5-express-core/p3-31-file-upload-lecture.md')).toContain('`올린-파일-이름.jpg`는 방금 응답에 온 첫 사진의 파일 이름으로 바꿔 적어요.');
    const lecture = LECTURE();
    expect(lecture).not.toContain('임시 이름이 들어 있어요');
    expect(lecture).not.toContain('없다면 `requests/uploads.http`');
    expect(lecture).toContain('그 사진은 지금도 `uploads` 폴더에 있어요.');
  });

  it('🔴 «취소할 수 없다» 는 «그 응답만 골라» 로 좁힌다 · Clear-Site-Data 는 🙋 토글에서만', () => {
    const lecture = LECTURE();
    expect(lecture).not.toContain('`max-age`를 취소할 수 없어요');
    expect(lecture).not.toContain('서버가 취소할 수 없으니');
    expect(lecture).toContain('**서버는 한 번 내보낸 `max-age`를 그 응답만 골라 취소할 수 없어요.**');
    expect(lecture).not.toContain('서버가 그 응답만 골라 취소할 수 없으니');
    expect(lecture).toContain('### 이미 내보낸 60초는 브라우저가 지켜요');
    expect(bodyOnly(lecture)).not.toContain('Clear-Site-Data');
    expect(lecture).toContain('`Clear-Site-Data: "cache"`');
  });
});

describe('축 ⑧ — 앞 회차에 잇는 문장: 그 회차 «본문»(토글 밖)에 그 사실이 있다', () => {
  it('🔴 stale·fresh 는 React Query 를 배울 때 부른 말 그대로 — 오늘 교안·답안에 «신선»·«낡» 이 없다', () => {
    expect(prior('part3/2-react-query/p3-12-why-react-query-lecture.md')).toContain('«오래된(stale)»');
    expect(prior('part3/2-react-query/p3-13-use-mutation-lecture.md')).toContain('`Fresh` — 오래되지 않은 데이터예요.');
    for (const md of [LECTURE(), ANSWERS()]) expect(md).not.toMatch(/신선|낡/);
    expect(LECTURE()).toContain('React Query를 배울 때 받은 데이터를 «오래된(stale)» 데이터와 «오래되지 않은(fresh)» 데이터로 나눴죠.');
  });

  it('🔴 서버 쪽 캐시와 무효화는 Next.js 의 캐시를 배울 때 — "use cache" · updateTag · cacheLife', () => {
    const p311 = prior('part3/1-nextjs/p3-11-cache-components-lecture.md');
    expect(p311).toContain('이 일을 무효화(invalidation)라고 부르고');
    expect(p311).toContain('**그 태그가 붙은 캐시를 곧바로 버려요.**');
    expect(p311).toContain('## Step 4: 얼마나 오래 쓸까요 — `cacheLife`');
    const lecture = LECTURE();
    expect(lecture).toContain('Next.js에서 `updateTag`로 캐시를 비운 일도');
    expect(lecture).toContain('서버 쪽 캐시는 Next.js의 캐시를 배울 때');
    expect(lecture).toContain('`cacheLife`로 시간을 정한 것과 같은 방법이에요.');
  });

  it('🔴 사진의 304 는 파일 업로드를 배울 때 · 빌드 파일 이름의 글자는 React 웹 개발을 시작할 때', () => {
    expect(prior('part3/5-express-core/p3-31-file-upload-lecture.md')).toContain('`Cache-Control: public, max-age=0`은 «저장해 둬도 되지만, 쓸 때마다 서버에 아직 같은지 물어보라»는 뜻이라');
    expect(prior('part2/1-react-start/p2-06-render-deploy-lecture.md')).toContain('파일 내용에서 계산한 값이라 내용이 바뀌면 이름도 바뀌고, 그래서 브라우저가 옛날 파일을 계속 쓰는 일이 안 생겨요.');
    const lecture = LECTURE();
    expect(lecture).toContain('그때 사진을 새로고침하며 본 그 304예요.');
    expect(lecture).toContain('`index-B0_TG7A5.js`');
    expect(lecture).not.toMatch(/`Cache-Control`도 `Last-Modified`도/);
    expect(lecture).toContain('`Last-Modified`(마지막으로 고친 시각)도 없어서');
  });

  it('🔴 «프록시» 는 오늘 말하는 저장하는 쪽과 수업 프로젝트의 넘겨주는 쪽을 가른다 · private·public 을 안 적어도 공유 캐시는 저장할 수 있다', () => {
    const lecture = LECTURE();
    expect(lecture).toContain('수업 프로젝트의 `rewrites`나 `proxy.js`처럼');
    expect(lecture).toContain('둘 다 적지 않아도 공유 캐시는 응답을 저장할 수 있어요');
    // Vary 두 문단은 🙋 토글 안으로
    expect(bodyOnly(lecture)).not.toContain('Vary: Cookie');
    expect(lecture).toContain('`Vary: Cookie`');
  });
});

describe('축 ⑧ — 직접 해보기 2 · 과제 [응용] 답안', () => {
  const OLD = '"1-1762650000000"';
  const check = async (srv) => {
    const first = await getRes(`${srv.base}/api/articles/1`);
    const again = await getRes(`${srv.base}/api/articles/1`, { headers: ask(OLD) });
    await sleep(200);
    const builtBefore = lines(srv, /1번 글을 만들었어요/g);
    await getRes(`${srv.base}/api/articles/1`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: '글을 조금 고쳤어요.' }) });
    const after = await getRes(`${srv.base}/api/articles/1`, { headers: ask(OLD) });
    return { firstEtag: first.headers.get('etag'), again: again.status, builtBefore, after: after.status, afterBody: after.body.body ?? null };
  };
  it('🔴 글자를 직접 비교한 판도 요구사항을 통과한다 · W/ 를 붙인 요청은 둘 다 304 지만 그 판은 만든 뒤 304 · 해설이 그 사실을 말한다', async () => {
    const strict = swap(LAB('practice2.js'), '  if (req.fresh) {', "  if (req.get('If-None-Match') === res.get('ETag')) {");
    const weak = async (srv) => {
      const before = lines(srv, /1번 글을 만들었어요/g);
      const res = await getRes(`${srv.base}/api/articles/1`, { headers: ask('W/"1-1762650000000"') });
      await sleep(400);
      return { status: res.status, built: lines(srv, /1번 글을 만들었어요/g) - before };
    };
    await withLab(strict, 4002, 3834, async (srv) => {
      expect(await weak(srv)).toEqual({ status: 304, built: 1 });
    });
    await withLab(strict, 4002, 3834, async (srv) => {
      expect(await check(srv)).toEqual({ firstEtag: OLD, again: 304, builtBefore: 1, after: 200, afterBody: '글을 조금 고쳤어요.' });
    });
    await withLab(LAB('practice2.js'), 4002, 3834, async (srv) => {
      expect(await weak(srv)).toEqual({ status: 304, built: 0 });
    });
    expect(LECTURE()).toContain('글자 그대로 비교해도(`req.get(\'If-None-Match\')`) 요구사항은 모두 통과해요.');
  });

  it('🔴 과제 [응용] 답안 — 몇 번째 요청에서 다시 세는지는 말하지 않는다', () => {
    expect(ANSWERS()).not.toContain('다섯 번은');
  });
});
