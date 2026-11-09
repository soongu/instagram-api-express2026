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

describe('축 ② — Step 2: 실험 판(max-age=60)', () => {
  it('🔴 snapshots/p3-35.step2-max-age.app.js — 목록 응답에 Cache-Control: max-age=60', async () => {
    reseed();
    await withServer(PORT, { 'app.js': read(P('snapshots/p3-35.step2-max-age.app.js')) }, async (srv) => {
      const res = await getRes(`${srv.base}${LIST}`);
      expect(res.status).toBe(200);
      expect(res.headers.get('cache-control')).toBe('max-age=60');
      // 사진은 /api 밖이라 실험 줄을 안 지난다
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
