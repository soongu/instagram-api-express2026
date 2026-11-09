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
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, mkdtempSync, rmSync, cpSync, symlinkSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import pg from 'pg';
import { boot } from './helpers/boot.js';
import { roundDir } from './helpers/round.js';

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
      '// ~/instagram-api/node_modules/express/lib/response.js': [read(P('node_modules/express/lib/response.js'))],
      '// ~/instagram-api/lab/p3-35/notices.js': [LAB('notices.js'), read(P('snapshots/p3-35.step5-start.notices.js')), read(P('snapshots/p3-35.step5.notices.js')), read(P('snapshots/p3-35.step6-forgot.notices.js'))],
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
