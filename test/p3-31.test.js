// p3-31 「파일 업로드 — multipart/form-data · multer · 정적 파일 제공」 게이트 — 백엔드
//
// `5-express-core` 다섯째(마지막) 회차다(`curriculum.md` 「`p3-31` 착수 결정」). 수업 백엔드에서 바뀌는 학생 파일 —
// 새 `middlewares/upload.js`(diskStorage · 확장자 표 · 크기 · 종류 · MulterError → 400) · 새 `routes/uploads.js`
// (`POST /api/uploads` → `{ imageUrls: ['/uploads/…'] }`) · `app.js`(helmet cross-origin · `/uploads` 정적 · 업로드 라우터) ·
// `services/postService.js`(게시물을 지우면 우리가 올린 사진 파일도) · `.gitignore`(`uploads/`) · `requests/uploads.http` ·
// `package.json`·`package-lock.json`(npm install multer). 강의 자료 사진은 `requests/photos/`.
// Step 1 의 multipart 들여다보기와 Step 8 의 다른 출처 화면은 실습 서버 `lab/p3-31/peek.js`(4009).
//
// 축 ① Step 1 — 들여다보기 서버: JSON · 손으로 쓴 multipart · 브라우저 폼 · enctype 을 뺀 폼
// 축 ② Step 2 — 지금 백엔드는 multipart 를 못 읽는다(400) · multer dest 판의 req.files·req.body
// 축 ③ Step 3 — express.static: 확장자 없는 파일은 octet-stream · 캐시 머리글 · 304 · 없는 파일은 우리 404
// 축 ④ Step 4 — 원래 이름 판(덮어쓰기 · 한글 깨짐) → UUID + 확장자 표 판(image/jpeg)
// 축 ⑤ Step 5 — 제한 없는 판(…undefined · 6.5MB 저장) → 제한만 단 판(500) → 끝 판(400 · 남는 파일 없음)
// 축 ⑥ Step 6 — 두 번의 요청: 올리기 → 게시물 만들기 · 사진 0장은 400
// 축 ⑦ Step 7 — 지우기: 앞 판은 파일이 남는다 · 끝 판은 지운다 · basename 을 빼면 uploads 밖 파일까지
// 축 ⑧ Step 8 — helmet 머리글: 기본값 same-origin · 끝 판 cross-origin
// 축 ⑨ 수업 백엔드 — code/p3-30 과 같은 요청에 같은 응답
// 축 ⑪ 이 회차 학생 파일 — code/p3-30 에서 바뀐 파일
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, mkdtempSync, rmSync, cpSync, symlinkSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import pg from 'pg';
import express from 'express';
import { boot } from './helpers/boot.js';
import { roundDir } from './helpers/round.js';
import { P235_MIGRATIONS } from '../sql/p2-36/setup.mjs';

const ROOT = new URL('../', import.meta.url);
const P = (rel) => new URL(rel, ROOT).pathname;
const ADMIN = { host: 'localhost', port: 5432, database: 'postgres', user: 'postgres', password: 'postgres' };
const GATE_DB = 'p331_gate';
const GATE_URL = `postgresql://postgres:postgres@localhost:5432/${GATE_DB}`;
const STUDENT_ORIGIN = 'http://localhost:3001';
const PORT = 3740;
const SIGNUP_MIGRATION = '20261029031804_add_user_signup_fields';

const read = (p) => readFileSync(p, 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 학생 파일은 이 회차 북마크 `code/p3-31` 을 풀어서 읽는다(없으면 작업트리 — 이 회차를 짓는 동안).
const ROUND = roundDir('code/p3-31');
const R = (rel) => join(ROUND.dir, rel);
const BEFORE = roundDir('code/p3-30');
const B = (rel) => join(BEFORE.dir, rel);
const SNAP = (name) => P(`snapshots/p3-31.${name}`);
const PHOTO = (name) => readFileSync(R(`requests/photos/${name}`));

const rep = (src, a, b) => {
  if (src.split(a).length !== 2) throw new Error(`바꿀 글자가 정확히 한 번 있어야 해요: ${a}`);
  return src.replace(a, b);
};

const getJson = async (url, init) => {
  const res = await fetch(url, init);
  const type = res.headers.get('content-type') ?? '';
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: type.includes('json') && text !== '' ? JSON.parse(text) : text };
};
const send = (base, method, path, { headers = {}, json } = {}) => getJson(`${base}${path}`, {
  method,
  headers: { ...headers, ...(json ? { 'Content-Type': 'application/json' } : {}) },
  body: json ? JSON.stringify(json) : undefined,
});
const plain = ({ status, body }) => ({ status, body });

/** parts: [{ name, value }] 또는 [{ name, file, filename, type }] — 브라우저의 FormData 와 같은 본문을 만든다. */
const form = (parts) => {
  const fd = new FormData();
  for (const part of parts) {
    if ('value' in part) fd.append(part.name, part.value);
    else fd.append(part.name, new Blob([part.file], { type: part.type }), part.filename);
  }
  return fd;
};
const upload = (base, path, parts) => getJson(`${base}${path}`, { method: 'POST', body: form(parts) });
const jpg = (name, filename = name, field = 'images') => ({ name: field, file: PHOTO(name), filename, type: 'image/jpeg' });

/** 그 서버가 지금까지 찍은 줄 중 «기다리고 있어요» 다음부터(스택의 at 줄은 뺀다). */
const linesAfterReady = (srv) => {
  const all = srv.tail().split('\n').filter((line) => line !== '' && !line.startsWith('    at '));
  return all.slice(all.findIndex((line) => line.includes('포트에서')) + 1);
};
const noMs = (line) => line.replace(/ \d+\.\dms$/, '');
const UUID_JPG = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.jpg$/;

// ───────── 수업 백엔드 — 학생 폴더 모양의 임시 폴더에서 띄운다(uploads/ 가 거기 생긴다) ─────────
let db = null;
const env = { DATABASE_URL: GATE_URL, CORS_ORIGIN: STUDENT_ORIGIN };
const STUDENT_FILES = ['app.js', 'db.js', 'errors.js', 'routes', 'services', 'middlewares', 'schemas', 'package.json', 'requests'];

/** overrides: { '상대 경로': 내용 | null(지우기) } · from: 어느 판에서 복사할지(기본 이 회차) */
const withServer = async (port, overrides, fn, from = R) => {
  const dir = mkdtempSync(join(tmpdir(), 'p331-srv-'));
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
    await fn({ ...srv, dir, uploads: () => (existsSync(join(dir, 'uploads')) ? readdirSync(join(dir, 'uploads')).sort() : null) });
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
  for (const dir of [...P235_MIGRATIONS, SIGNUP_MIGRATION]) {
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
}, 60000);

// ───────── 판 ─────────
const STEP2 = () => ({
  'middlewares/upload.js': read(SNAP('step2.upload.js')),
  'routes/uploads.js': read(SNAP('step2.uploads.js')),
  'app.js': read(SNAP('step2.app.js')),
});
const STEP3 = () => ({ ...STEP2(), 'app.js': read(SNAP('step3.app.js')) });
const STEP4_ORIGINAL = () => ({ ...STEP3(), 'middlewares/upload.js': read(SNAP('step4-original.upload.js')) });
const STEP4 = () => ({ ...STEP3(), 'middlewares/upload.js': read(SNAP('step4.upload.js')) });
const STEP5_LIMITS = () => ({ ...STEP3(), 'middlewares/upload.js': read(SNAP('step5-limits.upload.js')) });
const STEP5 = () => ({ ...STEP3(), 'middlewares/upload.js': read(R('middlewares/upload.js')), 'routes/uploads.js': read(SNAP('step5.uploads.js')) });
const STEP6 = () => ({ 'app.js': read(SNAP('step3.app.js')), 'services/postService.js': read(B('services/postService.js')) });

describe('축 ② — Step 2: 지금 백엔드는 multipart 를 못 읽는다 → multer dest 판', () => {
  it('🔴 code/p3-30 판에 사진을 담아 게시물을 올리면 400 — 본문이 undefined 라 «expected object, received undefined»', async () => {
    await withServer(PORT, {}, async (srv) => {
      const res = await upload(srv.base, '/api/posts', [{ name: 'content', value: '제주 바다' }, jpg('beach.jpg')]);
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('보낸 내용이 규칙에 안 맞아요');
      expect(res.body.details.errors).toEqual(['Invalid input: expected object, received undefined']);
    }, B);
  });

  it('🔴 dest 판 — 사진 두 장과 글자 하나: 201 · req.files 두 칸(이름은 32자리 16진수 · 확장자 없음) · 글자는 req.body', async () => {
    await withServer(PORT, STEP2(), async (srv) => {
      const res = await upload(srv.base, '/api/uploads', [{ name: 'content', value: '제주 바다' }, jpg('beach.jpg'), jpg('forest.jpg')]);
      expect(res.status).toBe(201);
      expect(res.body.body).toEqual({ content: '제주 바다' });
      expect(res.body.files).toHaveLength(2);
      const [first, second] = res.body.files;
      expect(Object.keys(first)).toEqual(['fieldname', 'originalname', 'encoding', 'mimetype', 'path', 'destination', 'filename', 'size']);
      expect(first).toMatchObject({ fieldname: 'images', originalname: 'beach.jpg', encoding: '7bit', mimetype: 'image/jpeg', destination: 'uploads/', size: 38232 });
      expect(first.filename).toMatch(/^[0-9a-f]{32}$/);
      expect(first.path).toBe(`uploads/${first.filename}`);
      expect(second).toMatchObject({ originalname: 'forest.jpg', size: 45897 });
      expect(srv.uploads()).toEqual([first.filename, second.filename].sort());
      expect(statSync(join(srv.dir, first.path)).size).toBe(38232);
    });
  });

  it('🔴 dest 판 — 사진 없이 글자만 보내도 201(files 빈 배열) · 이름을 image 로 보내면 500(Unexpected file field)', async () => {
    await withServer(PORT, STEP2(), async (srv) => {
      expect(plain(await upload(srv.base, '/api/uploads', [{ name: 'content', value: '글자만' }]))).toEqual({ status: 201, body: { files: [], body: { content: '글자만' } } });
      expect(plain(await upload(srv.base, '/api/uploads', [jpg('beach.jpg', 'beach.jpg', 'image')]))).toEqual({ status: 500, body: { message: '서버에서 문제가 생겼어요' } });
      await sleep(100);
      expect(srv.tail()).toContain('MulterError: Unexpected file field');
      expect(srv.uploads()).toEqual([]);
    });
  });
});

describe('축 ③ — Step 3: express.static', () => {
  it('🔴 step2 판에서는 /uploads/파일 이 우리 404', async () => {
    await withServer(PORT, STEP2(), async (srv) => {
      const { body } = await upload(srv.base, '/api/uploads', [jpg('beach.jpg')]);
      expect(plain(await send(srv.base, 'GET', `/uploads/${body.files[0].filename}`))).toEqual({ status: 404, body: { message: '그런 주소는 없어요' } });
    });
  });

  it('🔴 step3 판 — 200 · 확장자가 없으면 application/octet-stream · 캐시 머리글 셋 · 같은 ETag 로 다시 물으면 304', async () => {
    await withServer(PORT, STEP3(), async (srv) => {
      const { body } = await upload(srv.base, '/api/uploads', [jpg('beach.jpg')]);
      const url = `${srv.base}/uploads/${body.files[0].filename}`;
      const res = await fetch(url);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('application/octet-stream');
      expect(res.headers.get('content-length')).toBe('38232');
      expect(res.headers.get('cache-control')).toBe('public, max-age=0');
      expect(res.headers.get('etag')).toMatch(/^W\/"[0-9a-f]+-[0-9a-f]+"$/);
      expect(res.headers.get('last-modified')).toMatch(/GMT$/);
      expect(Buffer.from(await res.arrayBuffer()).equals(PHOTO('beach.jpg'))).toBe(true);
      // 🚨 Node fetch 는 Cache-Control 을 안 주면 no-cache 를 붙여 늘 200 이다 — 브라우저의 새로고침처럼 max-age=0 을 준다.
      const again = await fetch(url, { headers: { 'If-None-Match': res.headers.get('etag'), 'Cache-Control': 'max-age=0' } });
      expect(again.status).toBe(304);
      await sleep(100);
      expect(linesAfterReady(srv).map(noMs)).toEqual([
        'POST /api/uploads 201', `GET /uploads/${body.files[0].filename} 200`, `GET /uploads/${body.files[0].filename} 304`]);
    });
  });

  it('🔴 step3 판 — 없는 파일은 우리 404 · /uploads 폴더 밖으로는 못 나간다(../app.js 는 404)', async () => {
    await withServer(PORT, STEP3(), async (srv) => {
      expect(plain(await send(srv.base, 'GET', '/uploads/nope.jpg'))).toEqual({ status: 404, body: { message: '그런 주소는 없어요' } });
      expect((await send(srv.base, 'GET', '/uploads/..%2Fapp.js')).status).toBe(404);
    });
  });
});

describe('축 ④ — Step 4: 이름은 서버가 짓는다', () => {
  it('🔴 원래 이름 판 — 같은 이름으로 다른 사진을 올리면 앞 파일을 덮어쓴다', async () => {
    await withServer(PORT, STEP4_ORIGINAL(), async (srv) => {
      const first = await upload(srv.base, '/api/uploads', [jpg('beach.jpg', 'photo.jpg')]);
      expect(first.body.files[0]).toMatchObject({ filename: 'photo.jpg', size: 38232 });
      const second = await upload(srv.base, '/api/uploads', [jpg('forest.jpg', 'photo.jpg')]);
      expect(second.body.files[0]).toMatchObject({ filename: 'photo.jpg', size: 45897 });
      expect(srv.uploads()).toEqual(['photo.jpg']);
      const res = await fetch(`${srv.base}/uploads/photo.jpg`);
      expect(res.headers.get('content-type')).toBe('image/jpeg');
      expect(Buffer.from(await res.arrayBuffer()).equals(PHOTO('forest.jpg'))).toBe(true);
    });
  });

  it('🔴 원래 이름 판 — 한글 이름은 깨진 채 저장된다(latin1 으로 읽음)', async () => {
    await withServer(PORT, STEP4_ORIGINAL(), async (srv) => {
      const res = await upload(srv.base, '/api/uploads', [jpg('beach.jpg', '제주 바다.jpg')]);
      const broken = Buffer.from('제주 바다.jpg', 'utf8').toString('latin1');
      expect(res.body.files[0].originalname).toBe(broken);
      expect(res.body.files[0].filename).toBe(broken);
      expect(srv.uploads()).toEqual([broken]);
    });
  });

  it('🔴 UUID 판 — 이름은 UUID + .jpg · 주소로 열면 image/jpeg · 같은 이름을 두 번 올려도 파일 둘', async () => {
    await withServer(PORT, STEP4(), async (srv) => {
      const a = await upload(srv.base, '/api/uploads', [jpg('beach.jpg', 'photo.jpg')]);
      const b = await upload(srv.base, '/api/uploads', [jpg('forest.jpg', 'photo.jpg')]);
      expect(a.body.files[0].filename).toMatch(UUID_JPG);
      expect(b.body.files[0].filename).toMatch(UUID_JPG);
      expect(srv.uploads()).toHaveLength(2);
      const res = await fetch(`${srv.base}/uploads/${a.body.files[0].filename}`);
      expect(res.headers.get('content-type')).toBe('image/jpeg');
    });
  });

  it('🔴 UUID 판 — PNG 로 보낸 것은 .png', async () => {
    await withServer(PORT, STEP4(), async (srv) => {
      const res = await upload(srv.base, '/api/uploads', [{ name: 'images', file: PHOTO('beach.jpg'), filename: 'a.png', type: 'image/png' }]);
      expect(res.body.files[0].filename).toMatch(/\.png$/);
    });
  });
});

describe('축 ⑤ — Step 5: 크기·종류 제한과 400', () => {
  it('🔴 제한 없는 판(step4) — 글자 파일은 이름 끝이 undefined · 6.5MB 사진도 그대로 저장', async () => {
    await withServer(PORT, STEP4(), async (srv) => {
      const memo = await upload(srv.base, '/api/uploads', [{ name: 'images', file: PHOTO('memo.txt'), filename: 'memo.txt', type: 'text/plain' }]);
      expect(memo.status).toBe(201);
      expect(memo.body.files[0].filename).toMatch(/^[0-9a-f-]{36}undefined$/);
      const big = await upload(srv.base, '/api/uploads', [jpg('big.jpg')]);
      expect(big.status).toBe(201);
      expect(big.body.files[0].size).toBe(6552478);
      expect(srv.uploads()).toHaveLength(2);
    });
  });

  it('🔴 제한만 단 판 — 큰 사진 500(MulterError: File too large) · 글자 파일은 fileFilter 의 BadRequestError 라 400 · 이름 틀림 500', async () => {
    await withServer(PORT, STEP5_LIMITS(), async (srv) => {
      expect(plain(await upload(srv.base, '/api/uploads', [jpg('big.jpg')]))).toEqual({ status: 500, body: { message: '서버에서 문제가 생겼어요' } });
      expect(plain(await upload(srv.base, '/api/uploads', [{ name: 'images', file: PHOTO('memo.txt'), filename: 'memo.txt', type: 'text/plain' }])))
        .toEqual({ status: 400, body: { message: '사진 파일만 올릴 수 있어요' } });
      expect(plain(await upload(srv.base, '/api/uploads', [jpg('beach.jpg', 'beach.jpg', 'image')]))).toEqual({ status: 500, body: { message: '서버에서 문제가 생겼어요' } });
      await sleep(100);
      expect(srv.tail()).toContain('MulterError: File too large');
      expect(srv.tail()).toContain('code: \'LIMIT_FILE_SIZE\'');
      expect(srv.uploads()).toEqual([]);
    });
  });

  it('🔴 끝 판 — 큰 사진 400 · 글자 파일 400 · 이름 틀림 400 · 11장 400 · 실패한 요청의 파일은 하나도 안 남는다', async () => {
    await withServer(PORT, STEP5(), async (srv) => {
      expect(plain(await upload(srv.base, '/api/uploads', [jpg('beach.jpg'), jpg('big.jpg')]))).toEqual({ status: 400, body: { message: '사진 한 장은 5MB까지 올릴 수 있어요' } });
      expect(plain(await upload(srv.base, '/api/uploads', [jpg('beach.jpg'), { name: 'images', file: PHOTO('memo.txt'), filename: 'memo.txt', type: 'text/plain' }])))
        .toEqual({ status: 400, body: { message: '사진 파일만 올릴 수 있어요' } });
      expect(plain(await upload(srv.base, '/api/uploads', [jpg('beach.jpg', 'beach.jpg', 'image')]))).toEqual({ status: 400, body: { message: '사진은 images 이름으로 10장까지 보낼 수 있어요' } });
      expect(plain(await upload(srv.base, '/api/uploads', Array.from({ length: 11 }, () => jpg('beach.jpg'))))).toEqual({ status: 400, body: { message: '사진은 images 이름으로 10장까지 보낼 수 있어요' } });
      await sleep(200);
      expect(srv.uploads()).toEqual([]);
      expect(srv.tail()).not.toContain('MulterError');
    });
  });

  it('🔴 끝 판 — 종류는 보낸 쪽이 적은 것이라, 글자 파일도 image/jpeg 라고 적으면 통과한다(201)', async () => {
    await withServer(PORT, STEP5(), async (srv) => {
      const res = await upload(srv.base, '/api/uploads', [{ name: 'images', file: PHOTO('memo.txt'), filename: 'memo.jpg', type: 'image/jpeg' }]);
      expect(res.status).toBe(201);
      expect(res.body.files[0].filename).toMatch(UUID_JPG);
    });
  });
});

describe('축 ⑥ — Step 6: 두 번의 요청으로 게시물 만들기', () => {
  it('🔴 끝 판 — 올리기 201 { imageUrls: [/uploads/UUID.jpg ×2] } → 그 주소로 게시물 201 → 목록 첫 게시물 · 주소로 열면 image/jpeg', async () => {
    reseed();
    await withServer(PORT, {}, async (srv) => {
      const up = await upload(srv.base, '/api/uploads', [jpg('beach.jpg'), jpg('forest.jpg')]);
      expect(up.status).toBe(201);
      expect(Object.keys(up.body)).toEqual(['imageUrls']);
      expect(up.body.imageUrls).toHaveLength(2);
      for (const url of up.body.imageUrls) expect(url.replace('/uploads/', '')).toMatch(UUID_JPG);
      const created = await send(srv.base, 'POST', '/api/posts', { json: { authorId: 2, imageUrls: up.body.imageUrls, postAlt: '바다와 숲 사진', content: '직접 올린 사진이에요' } });
      expect(created.status).toBe(201);
      expect(created.body.imageUrls).toEqual(up.body.imageUrls);
      const list = await send(srv.base, 'GET', '/api/posts?limit=1');
      expect(list.body.items[0]).toMatchObject({ id: created.body.id, username: 'jaehoon', imageUrls: up.body.imageUrls });
      const res = await fetch(`${srv.base}${up.body.imageUrls[0]}`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('image/jpeg');
    });
    reseed();
  });

  it('🔴 끝 판 — 사진 없이 보내면 400 · multipart 가 아닌 본문도 400', async () => {
    await withServer(PORT, {}, async (srv) => {
      expect(plain(await upload(srv.base, '/api/uploads', [{ name: 'content', value: '글자만' }]))).toEqual({ status: 400, body: { message: '올릴 사진을 골라 주세요' } });
      expect(plain(await send(srv.base, 'POST', '/api/uploads', { json: { imageUrls: ['/uploads/a.jpg'] } }))).toEqual({ status: 400, body: { message: '올릴 사진을 골라 주세요' } });
      expect(srv.uploads()).toEqual([]);
    });
  });
});

describe('축 ⑦ — Step 7: 게시물을 지우면 사진 파일도', () => {
  const makePost = async (srv) => {
    const up = await upload(srv.base, '/api/uploads', [jpg('beach.jpg'), jpg('forest.jpg')]);
    const created = await send(srv.base, 'POST', '/api/posts', { json: { authorId: 2, imageUrls: up.body.imageUrls } });
    return { imageUrls: up.body.imageUrls, id: created.body.id };
  };

  it('🔴 앞 판(code/p3-30 의 postService) — 게시물은 지워지는데 파일은 남아 주소로 계속 열린다', async () => {
    reseed();
    await withServer(PORT, STEP6(), async (srv) => {
      const { id, imageUrls } = await makePost(srv);
      expect((await send(srv.base, 'DELETE', `/api/posts/${id}`)).status).toBe(200);
      expect(srv.uploads()).toHaveLength(2);
      expect((await fetch(`${srv.base}${imageUrls[0]}`)).status).toBe(200);
    });
    reseed();
  });

  it('🔴 끝 판 — 지우면 파일도 사라져 404 · 바깥 주소(picsum) 게시물은 그대로 지워진다 · 없는 게시물 404', async () => {
    reseed();
    await withServer(PORT, {}, async (srv) => {
      const { id, imageUrls } = await makePost(srv);
      const deleted = await send(srv.base, 'DELETE', `/api/posts/${id}`);
      expect(deleted.status).toBe(200);
      expect(deleted.body.imageUrls).toEqual(imageUrls);
      expect(srv.uploads()).toEqual([]);
      expect(plain(await send(srv.base, 'GET', imageUrls[0]))).toEqual({ status: 404, body: { message: '그런 주소는 없어요' } });
      const seeded = await send(srv.base, 'DELETE', '/api/posts/1');
      expect(seeded.status).toBe(200);
      expect(seeded.body.imageUrls[0]).toMatch(/^https:\/\/picsum\.photos\//);
      expect(plain(await send(srv.base, 'DELETE', '/api/posts/999'))).toEqual({ status: 404, body: { message: '그런 게시물은 없어요' } });
    });
    reseed();
  });

  it('🔴 끝 판 — 사진 주소에 ../ 가 섞여 와도 uploads 폴더 밖 파일은 안 지운다', async () => {
    reseed();
    await withServer(PORT, {}, async (srv) => {
      writeFileSync(join(srv.dir, 'victim.txt'), '지워지면 안 되는 파일');
      const created = await send(srv.base, 'POST', '/api/posts', { json: { authorId: 2, imageUrls: ['/uploads/../victim.txt'] } });
      expect(created.status).toBe(201);
      expect((await send(srv.base, 'DELETE', `/api/posts/${created.body.id}`)).status).toBe(200);
      expect(existsSync(join(srv.dir, 'victim.txt'))).toBe(true);
    });
    reseed();
  });

  it('🔴 끝 판 — 파일 하나를 못 지워도(/uploads/.. → rm(\'.\') 실패) 게시물 지우기는 200 · 나머지 파일은 지운다 · 에러는 터미널에', async () => {
    reseed();
    await withServer(PORT, {}, async (srv) => {
      const up = await upload(srv.base, '/api/uploads', [jpg('beach.jpg')]);
      const created = await send(srv.base, 'POST', '/api/posts', { json: { authorId: 2, imageUrls: ['/uploads/..', up.body.imageUrls[0]] } });
      expect(created.status).toBe(201);
      expect((await send(srv.base, 'DELETE', `/api/posts/${created.body.id}`)).status).toBe(200);
      expect(srv.uploads()).toEqual([]);
      await sleep(100);
      expect(srv.tail()).toMatch(/EISDIR|ERR_FS_EISDIR/);
    });
    reseed();
  });

  it('🔴 basename 을 뺀 판 — 같은 요청으로 uploads 폴더 밖 파일이 지워진다', async () => {
    reseed();
    await withServer(PORT, { 'services/postService.js': read(SNAP('step7-no-basename.postService.js')) }, async (srv) => {
      writeFileSync(join(srv.dir, 'victim.txt'), '지워지면 안 되는 파일');
      const created = await send(srv.base, 'POST', '/api/posts', { json: { authorId: 2, imageUrls: ['/uploads/../victim.txt'] } });
      expect((await send(srv.base, 'DELETE', `/api/posts/${created.body.id}`)).status).toBe(200);
      expect(existsSync(join(srv.dir, 'victim.txt'))).toBe(false);
    });
    reseed();
  });

  it('🔴 basename 을 뺀 판 = 끝 판에서 path.basename(…) 한 겹만 벗긴 것', () => {
    const final = read(R('services/postService.js'));
    const variant = read(SNAP('step7-no-basename.postService.js'));
    expect(variant).toBe(rep(final, "path.join('uploads', path.basename(imageUrl))", "path.join('uploads', imageUrl.replace('/uploads/', ''))"));
  });
});

describe('축 ⑧ — Step 8: helmet 과 CORP', () => {
  it('🔴 step3 판(helmet 없음) — CORP 머리글이 없다', async () => {
    await withServer(PORT, STEP3(), async (srv) => {
      const res = await fetch(`${srv.base}/`);
      expect(res.headers.get('cross-origin-resource-policy')).toBe(null);
    });
  });

  it('🔴 helmet() 기본값 판 — 사진 응답에 Cross-Origin-Resource-Policy: same-origin · X-Content-Type-Options: nosniff', async () => {
    await withServer(PORT, { 'app.js': read(SNAP('step8-default.app.js')) }, async (srv) => {
      const up = await upload(srv.base, '/api/uploads', [jpg('beach.jpg')]);
      const res = await fetch(`${srv.base}${up.body.imageUrls[0]}`);
      expect(res.headers.get('cross-origin-resource-policy')).toBe('same-origin');
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    });
  });

  it('🔴 끝 판 — cross-origin · 기본값 판과 다른 곳은 그 한 줄뿐', async () => {
    await withServer(PORT, {}, async (srv) => {
      const up = await upload(srv.base, '/api/uploads', [jpg('beach.jpg')]);
      const res = await fetch(`${srv.base}${up.body.imageUrls[0]}`);
      expect(res.headers.get('cross-origin-resource-policy')).toBe('cross-origin');
      expect(res.headers.get('x-powered-by')).toBe(null);
    });
    expect(read(SNAP('step8-default.app.js'))).toBe(rep(read(R('app.js')), "app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));", 'app.use(helmet());'));
  });
});

describe('축 ⑧-b — Step 8 🤔 3 해설의 «사진 경로에만» 판', () => {
  it('🔴 helmet() 기본값 + express.static 의 setHeaders — 사진만 cross-origin · API 응답과 없는 파일 404 는 same-origin', async () => {
    let app = rep(read(R('app.js')), "app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));", 'app.use(helmet());');
    app = rep(app, "app.use('/uploads', express.static('uploads'));",
      "app.use('/uploads', express.static('uploads', {\n  setHeaders: (res) => res.set('Cross-Origin-Resource-Policy', 'cross-origin'),\n}));");
    const lecture = read(new URL('../../../part3/5-express-core/p3-31-file-upload-lecture.md', import.meta.url).pathname);
    expect(lecture).toContain("app.use('/uploads', express.static('uploads', {\n  setHeaders: (res) => res.set('Cross-Origin-Resource-Policy', 'cross-origin'),\n}));");
    await withServer(PORT, { 'app.js': app }, async (srv) => {
      const up = await upload(srv.base, '/api/uploads', [jpg('beach.jpg')]);
      expect((await fetch(`${srv.base}${up.body.imageUrls[0]}`)).headers.get('cross-origin-resource-policy')).toBe('cross-origin');
      expect((await fetch(`${srv.base}/api/posts`)).headers.get('cross-origin-resource-policy')).toBe('same-origin');
      expect((await fetch(`${srv.base}/uploads/nope.jpg`)).headers.get('cross-origin-resource-policy')).toBe('same-origin');
    });
  });
});

describe('축 ⑨ — 수업 백엔드: code/p3-30 과 같은 요청에 같은 응답', () => {
  const REQUESTS = [
    ['GET', '/api/posts'], ['GET', '/api/posts/2'], ['GET', '/api/posts/999'], ['GET', '/api/posts/abc'],
    ['GET', '/api/posts?username=minji'], ['GET', '/api/posts?limit=2'], ['GET', '/api/posts?userId=2&limit=2'],
    ['GET', '/api/posts/3/likes'], ['GET', '/api/nope'], ['GET', '/'],
  ];
  it('🔴 읽기 요청 열 — 상태와 본문이 같다', async () => {
    reseed();
    await withServer(PORT + 1, {}, async (before) => {
      await withServer(PORT, {}, async (now) => {
        for (const [method, path] of REQUESTS) {
          expect(plain(await send(now.base, method, path)), `${method} ${path}`).toEqual(plain(await send(before.base, method, path)));
        }
      });
    }, B);
  });
});

describe('축 ⑪ — 이 회차 학생 파일', () => {
  it('🔴 package.json — multer ^2.5.0 이 dependencies 에 · 설치판 2.5.0', () => {
    const pkg = JSON.parse(read(R('package.json')));
    expect(pkg.dependencies.multer).toBe('^2.5.0');
    expect(JSON.parse(read(P('node_modules/multer/package.json'))).version).toBe('2.5.0');
  });

  it('🔴 .gitignore 에 uploads/', () => {
    expect(read(R('.gitignore'))).toContain('\n# 사용자가 올린 사진 — 코드가 아니라 데이터다\nuploads/\n# 실습 서버가 받은 파일(lab/p3-31 아래에 생기는 폴더들)\nlab/p3-31/*/\n');
  });
});

// ───────── 실습 서버 — 학생 폴더 모양(lab/p3-31/ · 위로 두 단계에 errors.js)으로 세운다 ─────────
// 🚨 실습 포트(4001~4003 · 4009 · 4011 · 4012)는 다른 세션의 실습 서버가 쥐고 있을 수 있어
//    사본의 포트 숫자를 판정 포트로 바꿔 띄운다(교안의 포트는 그대로다).
const LAB = (name) => P(`lab/p3-31/${name}`);
const lab = (name) => read(LAB(name));
const withLab = async ({ src, labPort, port }, fn) => {
  const dir = mkdtempSync(join(tmpdir(), 'p331-lab-'));
  mkdirSync(join(dir, 'lab', 'p3-31'), { recursive: true });
  cpSync(R('errors.js'), join(dir, 'errors.js'));
  cpSync(R('requests/photos'), join(dir, 'requests', 'photos'), { recursive: true });
  cpSync(LAB('hello.txt'), join(dir, 'lab', 'p3-31', 'hello.txt'));
  writeFileSync(join(dir, 'package.json'), '{"type":"module"}');
  symlinkSync(P('node_modules'), join(dir, 'node_modules'));
  writeFileSync(join(dir, 'lab', 'p3-31', 'server.js'), src.replaceAll(String(labPort), String(port)));
  const srv = await boot(join(dir, 'lab', 'p3-31', 'server.js'), { port, cwd: dir, ready: `${port}번 포트에서` });
  try {
    await fn({ ...srv, dir });
  } finally {
    await Promise.race([srv.stop(), sleep(500)]);
    rmSync(dir, { recursive: true, force: true });
  }
};
const text = (name, type = 'text/plain') => ({ name: 'file', file: Buffer.from('안녕하세요\n'), filename: name, type });

describe('축 ① — Step 1: 들여다보기 서버', () => {
  const PORT_LAB = 3745;
  it('🔴 JSON 은 보낸 글자 그대로 · 손으로 쓴 multipart 는 경계 문자열로 나뉜 파트 그대로 찍힌다', async () => {
    await withLab({ src: read(SNAP('step1.peek.js')), labPort: 4009, port: PORT_LAB }, async (srv) => {
      const json = await fetch(`${srv.base}/peek`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{\n  "content": "제주 바다"\n}' });
      expect(await json.text()).toBe('받았어요');
      const body = ['--photo-boundary', 'Content-Disposition: form-data; name="content"', '', '제주 바다', '--photo-boundary',
        'Content-Disposition: form-data; name="images"; filename="hello.txt"', 'Content-Type: text/plain', '', '안녕하세요\n', '--photo-boundary--'].join('\r\n');
      await fetch(`${srv.base}/peek`, { method: 'POST', headers: { 'Content-Type': 'multipart/form-data; boundary=photo-boundary' }, body });
      await sleep(100);
      expect(linesAfterReady(srv).map((l) => l.replace(/\r$/, ''))).toEqual([
        'application/json', '{', '  "content": "제주 바다"', '}',
        'multipart/form-data; boundary=photo-boundary', '--photo-boundary', 'Content-Disposition: form-data; name="content"',
        '', '제주 바다', '--photo-boundary', 'Content-Disposition: form-data; name="images"; filename="hello.txt"', 'Content-Type: text/plain',
        '', '안녕하세요', '', '--photo-boundary--']);
    });
  });

  it('🔴 폼 페이지에 enctype · 그것을 뺀 urlencoded 본문에는 파일 이름만 실린다', async () => {
    await withLab({ src: read(SNAP('step1.peek.js')), labPort: 4009, port: PORT_LAB }, async (srv) => {
      expect(await (await fetch(`${srv.base}/`)).text()).toContain('<form action="/peek" method="post" enctype="multipart/form-data">');
      await fetch(`${srv.base}/peek`, { method: 'POST', body: new URLSearchParams({ content: '제주 바다', images: 'hello.txt' }) });
      await sleep(100);
      expect(linesAfterReady(srv)).toEqual(['application/x-www-form-urlencoded;charset=UTF-8', 'content=%EC%A0%9C%EC%A3%BC+%EB%B0%94%EB%8B%A4&images=hello.txt']);
    });
  });

  it('🔴 끝 판 = Step 1 판 + /photo 라우트 하나', () => {
    expect(lab('peek.js')).toBe(rep(read(SNAP('step1.peek.js')), "app.listen(4009, () => {",
      "// 다른 출처(4009)의 화면이 수업 백엔드(3000)의 사진을 <img>로 띄운다.\napp.get('/photo', (req, res) => {\n  res.send('<img src=\"http://localhost:3000/uploads/올린-파일-이름.jpg\" width=\"300\">');\n});\n\napp.listen(4009, () => {"));
  });
});

describe('축 ⑩ — 실습·과제: 정답 판 · 확인 절차가 틀린 판을 가려낸다', () => {
  const PORT_LAB = 3746;
  const p1 = async (src) => {
    let out;
    await withLab({ src, labPort: 4001, port: PORT_LAB }, async (srv) => {
      const up = await upload(srv.base, '/api/files', [text('hello.txt')]);
      const open = up.body.url ? await send(srv.base, 'GET', up.body.url) : { status: null };
      const none = await upload(srv.base, '/api/files', [{ name: 'title', value: '첨부 없는 공지' }]);
      out = { up: up.status, size: up.body.size, open: open.status, body: open.body, none: none.status };
    });
    return out;
  };
  it('🔴 직접 해보기 1 — 정답 201·200·400 · array 판은 첫 요청 400 · /files 없이 붙인 판은 둘째 요청 404', async () => {
    expect(await p1(lab('practice1.js'))).toEqual({ up: 201, size: 16, open: 200, body: '안녕하세요\n', none: 400 });
    expect((await p1(rep(lab('practice1.js'), "upload.single('file')", "upload.array('file')"))).up).toBe(400);
    const noPrefix = await p1(rep(lab('practice1.js'), "app.use('/files', express.static('lab/p3-31/files'));", "app.use(express.static('lab/p3-31/files'));"));
    expect([noPrefix.up, noPrefix.open]).toEqual([201, 404]);
  });

  const p2 = async (src, port = 3747) => {
    const out = [];
    await withLab({ src, labPort: 4002, port }, async (srv) => {
      for (const parts of [[jpg('beach.jpg', 'beach.jpg', 'avatar')], [jpg('medium.jpg', 'medium.jpg', 'avatar')],
        [{ name: 'avatar', file: PHOTO('memo.txt'), filename: 'memo.txt', type: 'text/plain' }], [jpg('beach.jpg', 'beach.jpg', 'photo')]]) {
        const res = await upload(srv.base, '/api/avatar', parts);
        out.push([res.status, res.body.message ?? null]);
      }
    });
    return out;
  };
  it('🔴 직접 해보기 2 — 정답 · err 판은 «사진이 아닌 파일» 메시지만 바뀐다 · 1024 판은 첫 요청부터 400', async () => {
    expect(await p2(lab('practice2.js'))).toEqual([[201, null], [400, '프로필 사진은 1MB까지 올릴 수 있어요'],
      [400, '프로필 사진은 JPG나 PNG만 올릴 수 있어요'], [400, '프로필 사진은 avatar 이름으로 한 장만 보낼 수 있어요']]);
    expect(await p2(rep(lab('practice2.js'), 'if (err instanceof multer.MulterError) {', 'if (err) {'))).toEqual([[201, null], [400, '프로필 사진은 1MB까지 올릴 수 있어요'],
      [400, '프로필 사진을 받지 못했어요'], [400, '프로필 사진은 avatar 이름으로 한 장만 보낼 수 있어요']]);
    expect((await p2(rep(lab('practice2.js'), 'limits: { fileSize: 1024 * 1024 },', 'limits: { fileSize: 1024 },')))[0]).toEqual([400, '프로필 사진은 1MB까지 올릴 수 있어요']);
    // Step 5 의 5MB 를 그대로 둔 판 — medium.jpg(2,018,501 B)가 201 로 들어온다
    expect((await p2(rep(lab('practice2.js'), 'limits: { fileSize: 1024 * 1024 },', 'limits: { fileSize: 5 * 1024 * 1024 },')))[1]).toEqual([201, null]);
    expect(PHOTO('medium.jpg').length).toBe(2018501);
  });

  const p3 = async (src) => {
    const out = [];
    await withLab({ src, labPort: 4003, port: 3748 }, async (srv) => {
      const put = (parts) => getJson(`${srv.base}/api/avatar`, { method: 'PUT', body: form(parts) });
      const first = await put([jpg('beach.jpg', 'beach.jpg', 'avatar')]);
      const second = await put([jpg('forest.jpg', 'forest.jpg', 'avatar')]);
      out.push(first.status, second.status, (await send(srv.base, 'GET', first.body.url)).status);
      out.push((await put([{ name: 'avatar', file: PHOTO('memo.txt'), filename: 'memo.txt', type: 'text/plain' }])).status);
      out.push((await send(srv.base, 'GET', '/api/avatar')).status, (await send(srv.base, 'GET', second.body.url)).status);
      out.push((await send(srv.base, 'DELETE', '/api/avatar')).status, (await send(srv.base, 'GET', second.body.url)).status);
    });
    return out;
  };
  it('🔴 직접 해보기 3 — 정답 여덟 · 옛 파일을 안 지운 판 · 바꾼 뒤 지운 판', async () => {
    expect(await p3(lab('practice3.js'))).toEqual([200, 200, 404, 400, 200, 200, 200, 404]);
    expect((await p3(rep(lab('practice3.js'), '  if (oldUrl) await removeAvatarFile(oldUrl);\n', '')))[2]).toBe(200);
    const after = await p3(rep(lab('practice3.js'), 'if (oldUrl) await removeAvatarFile(oldUrl);', 'if (oldUrl) await removeAvatarFile(avatarUrl);'));
    expect([after[2], after[5]]).toEqual([200, 404]);
  });

  const hw1 = async (src) => {
    const out = [];
    await withLab({ src, labPort: 4011, port: 3749 }, async (srv) => {
      for (const parts of [[{ name: 'title', value: '서버 점검 안내' }, { name: 'pinned', value: 'true' }, jpg('beach.jpg', 'beach.jpg', 'image')],
        [{ name: 'title', value: '새 기능 소개' }, { name: 'pinned', value: 'false' }], [{ name: 'pinned', value: 'false' }],
        [{ name: 'title', value: '   ' }],
        [{ name: 'title', value: '사진 공지' }, { name: 'image', file: PHOTO('memo.txt'), filename: 'memo.txt', type: 'text/plain' }]]) {
        const res = await upload(srv.base, '/api/notices', parts);
        out.push([res.status, res.body.pinned ?? res.body.message]);
        if (res.body.imageUrl) out.push(['image', (await fetch(`${srv.base}${res.body.imageUrl}`)).status]);
      }
      out.push((await send(srv.base, 'GET', '/api/notices')).body.length ?? null);
    });
    return out;
  };
  it('🔴 과제 [기초] — 정답 · Boolean 판은 둘째 공지 pinned true · 제목 검사를 multer 앞에 둔 판은 셋 다 500', async () => {
    expect(await hw1(lab('homework1.js'))).toEqual([[201, true], ['image', 200], [201, false], [400, '제목을 적어 주세요'], [400, '제목을 적어 주세요'],
      [400, '공지 사진은 JPG나 PNG만 올릴 수 있어요'], 2]);
    // 학생 낭독이 찾은 «셋을 한꺼번에 빠뜨린 판»(trim 없음 · 종류 확인 없음 · 정적 주소 없음) — 새 요청 셋이 가려낸다
    let wrong = rep(lab('homework1.js'), "const title = (req.body.title ?? '').trim();", "const title = req.body.title ?? '';");
    wrong = rep(wrong, '    if (!EXTENSIONS[file.mimetype]) {', '    if (false) {');
    wrong = rep(wrong, "app.use('/notice-images', express.static('lab/p3-31/notice-images'));\n", '');
    const w = await hw1(wrong);
    expect([w[1], w[4][0], w[5][0]]).toEqual([['image', 404], 201, 201]);
    expect((await hw1(rep(lab('homework1.js'), "pinned: req.body.pinned === 'true',", 'pinned: Boolean(req.body.pinned),')))[2]).toEqual([201, true]);
    const order = await hw1(rep(lab('homework1.js'),
      "app.post('/api/notices', upload.single('image'), (req, res) => {\n  const title = (req.body.title ?? '').trim();\n\n  if (title === '') {\n    throw new BadRequestError('제목을 적어 주세요');\n  }\n",
      "function checkTitle(req, res, next) {\n  if (req.body.title.trim() === '') {\n    throw new BadRequestError('제목을 적어 주세요');\n  }\n  next();\n}\n\napp.post('/api/notices', checkTitle, upload.single('image'), (req, res) => {\n  const title = req.body.title.trim();\n"));
    // 공지를 올리는 다섯 요청이 모두 500 — 본문을 아직 아무도 안 읽어 req.body 가 undefined
    expect(order.slice(0, 5).map(([status]) => status)).toEqual([500, 500, 500, 500, 500]);
  });

  it('🔴 과제 [기초] 답안 «더 좋아요» 판 — 제목 검사에 떨어지면 저장한 사진을 지워 폴더가 빈다', async () => {
    let src = rep(lab('homework1.js'), "import express from 'express';", "import { rm } from 'node:fs/promises';\nimport express from 'express';");
    src = rep(src, "app.post('/api/notices', upload.single('image'), (req, res) => {", "app.post('/api/notices', upload.single('image'), async (req, res) => {");
    src = rep(src, "  if (title === '') {\n    throw new BadRequestError('제목을 적어 주세요');", "  if (title === '') {\n    if (req.file) await rm(req.file.path, { force: true });\n    throw new BadRequestError('제목을 적어 주세요');");
    const answer = read(new URL('../../../part3/5-express-core/p3-31-file-upload-answers.md', import.meta.url).pathname);
    expect(answer).toContain("  if (title === '') {\n    if (req.file) await rm(req.file.path, { force: true });\n    throw new BadRequestError('제목을 적어 주세요');\n  }");
    await withLab({ src, labPort: 4011, port: 3749 }, async (srv) => {
      const res = await upload(srv.base, '/api/notices', [{ name: 'pinned', value: 'false' }, jpg('beach.jpg', 'beach.jpg', 'image')]);
      expect(res.status).toBe(400);
      expect(readdirSync(join(srv.dir, 'lab', 'p3-31', 'notice-images'))).toEqual([]);
      expect((await upload(srv.base, '/api/notices', [{ name: 'title', value: '서버 점검 안내' }, jpg('beach.jpg', 'beach.jpg', 'image')])).status).toBe(201);
    });
  });

  it('🔴 과제 [기초] 답안 «더 좋아요» — 정답 판은 제목 없이 보낸 사진이 폴더에 남는다', async () => {
    await withLab({ src: lab('homework1.js'), labPort: 4011, port: 3749 }, async (srv) => {
      const res = await upload(srv.base, '/api/notices', [{ name: 'pinned', value: 'false' }, jpg('beach.jpg', 'beach.jpg', 'image')]);
      expect(res.status).toBe(400);
      expect(readdirSync(join(srv.dir, 'lab', 'p3-31', 'notice-images'))).toHaveLength(1);
    });
  });

  const hw2 = async (src) => {
    let out;
    await withLab({ src, labPort: 4012, port: 3750 }, async (srv) => {
      const up = await upload(srv.base, '/api/uploads', [jpg('beach.jpg'), jpg('forest.jpg')]);
      await send(srv.base, 'POST', '/api/posts', { json: { imageUrls: [up.body.imageUrls[0]] } });
      const now = (await send(srv.base, 'DELETE', '/api/uploads/orphans')).body.removed;
      // 30초 기다리는 대신 파일 시각을 40초 앞으로 돌린다
      const { utimesSync } = await import('node:fs');
      const dir = join(srv.dir, 'lab', 'p3-31', 'hw2-uploads');
      const past = new Date(Date.now() - 40000);
      for (const name of readdirSync(dir)) utimesSync(join(dir, name), past, past);
      const later = (await send(srv.base, 'DELETE', '/api/uploads/orphans')).body.removed;
      out = { now: now.length, later: later.map((n) => `/uploads/${n}`), used: (await fetch(`${srv.base}${up.body.imageUrls[0]}`)).status,
        orphan: (await fetch(`${srv.base}${up.body.imageUrls[1]}`)).status, second: up.body.imageUrls[1] };
    });
    return out;
  };
  it('🔴 과제 [응용] 시작 판 = 끝 판에서 청소 라우트를 «여기에 더한다» 한 줄로 바꾼 것', () => {
    const final = lab('homework2.js');
    const start = read(SNAP('homework2-start.homework2.js'));
    const route = final.slice(final.indexOf('// 올라온 지 이만큼이 안 된 파일은'), final.indexOf('app.listen(4012'));
    expect(start).toBe(final.replace(route, '// 여기에 DELETE /api/uploads/orphans 를 더한다.\n\n'));
  });

  it('🔴 과제 [응용] — 정답 · 시간 조건을 뺀 판 · 주소째 비교한 판', async () => {
    const ok = await hw2(lab('homework2.js'));
    expect([ok.now, ok.later, ok.used, ok.orphan]).toEqual([0, [ok.second], 200, 404]);
    const noAge = await hw2(rep(lab('homework2.js'), 'if (!usedNames.includes(name) && Date.now() - mtimeMs >= WAIT_MS) {', 'if (!usedNames.includes(name)) {'));
    expect(noAge.now).toBe(1);
    const url = await hw2(rep(lab('homework2.js'), 'post.imageUrls.map((url) => path.basename(url))', 'post.imageUrls'));
    expect([url.now, url.later.length, url.used]).toEqual([0, 2, 404]);
  });
});

describe('축 ⑫ — 교안·답안 코드 블록의 줄이 코드베이스에 차례대로 있다', () => {
  const TRACK = new URL('../../../part3/5-express-core/', import.meta.url).pathname;
  const fences = (file) => {
    const out = [];
    const lines = read(join(TRACK, file)).split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      const m = lines[i].match(/^```(javascript|http)$/);
      if (!m) continue;
      const body = [];
      for (i += 1; lines[i] !== '```'; i += 1) body.push(lines[i]);
      out.push({ lang: m[1], body });
    }
    return out;
  };
  const sourcesFor = (path) => {
    const rel = path.replace('~/instagram-api/', '');
    const base = rel.split('/').pop();
    const snaps = readdirSync(P('snapshots')).filter((n) => n.startsWith('p3-31.') && n.endsWith(`.${base}`)).map((n) => read(P(`snapshots/${n}`)));
    return [existsSync(P(rel)) ? read(P(rel)) : '', ...snaps];
  };
  const inOrder = (needle, hay) => {
    const lines = hay.split('\n');
    let at = 0;
    for (const want of needle) {
      const found = lines.indexOf(want, at);
      if (found === -1) return false;
      at = found + 1;
    }
    return true;
  };
  for (const file of ['p3-31-file-upload-lecture.md', 'p3-31-file-upload-answers.md']) {
    it(`🔴 ${file} — 경로 주석이 있는 javascript 블록`, () => {
      let checked = 0;
      for (const { lang, body } of fences(file)) {
        if (lang !== 'javascript' || !body[0]?.startsWith('// ~/instagram-api/')) continue;
        const needle = body.filter((l) => l.trim() !== '...' && l.trim() !== '' && !l.includes('____'));
        const ok = sourcesFor(body[0].slice(3)).some((src) => inOrder(needle.map((l) => l), src));
        expect(ok, `${body[0]} — ${needle.slice(1, 3).join(' / ')}`).toBe(true);
        checked += 1;
      }
      expect(checked).toBeGreaterThan(file.includes('lecture') ? 10 : 1);
    });
  }

  it('🔴 직접 해보기 1·2 해설의 경로 없는 조각 — 정답 파일에 차례대로 있다', () => {
    const blocks = fences('p3-31-file-upload-lecture.md').filter(({ lang, body }) => lang === 'javascript' && !body[0].startsWith('//'));
    const pick = (first) => blocks.find(({ body }) => body[0].trim().startsWith(first)).body.filter((l) => l.trim() !== '...');
    expect(inOrder(pick('const upload = multer({ dest:'), lab('practice1.js'))).toBe(true);
    expect(inOrder(pick('limits: { fileSize: 1024 * 1024 }'), lab('practice2.js'))).toBe(true);
  });

  it('🔴 교안의 .http 블록 — 요청마다 codebase 의 .http 파일에 그대로 있다', () => {
    const all = ['requests/uploads.http', ...readdirSync(P('lab/p3-31')).filter((n) => n.endsWith('.http')).map((n) => `lab/p3-31/${n}`)].map((f) => read(P(f))).join('\n');
    let checked = 0;
    for (const { lang, body } of fences('p3-31-file-upload-lecture.md')) {
      if (lang !== 'http') continue;
      if (body[0] === '### 게시물 올리기에 사진을 담아 보내기') continue; // Step 2 — 확인만 하고 지우는 요청(코드베이스 파일에 없다)
      expect(inOrder(body.filter((l) => l !== ''), all), body[0]).toBe(true);
      checked += 1;
    }
    expect(checked).toBe(13); // 2026-11-08 학생 검수 — Step 5 섞은 요청 · Step 7 폴더 밖 게시물 만들기·지우기(블록 하나)
  });
});

// ───────── 축 ⑬ — 학생 낭독 집중 검수 반영(2026-11-08) ─────────
// 학생이 따라 치며 잡은 확인 절차의 구멍 하나와, 겪기·잇기로 바꾼 주장들을 실행으로 잠근다.
describe('축 ⑬ — 학생 낭독 집중 검수 반영', () => {
  const Q = 3790;
  const LECTURE = new URL('../../../part3/5-express-core/p3-31-file-upload-lecture.md', import.meta.url).pathname;
  const ANSWERS = new URL('../../../part3/5-express-core/p3-31-file-upload-answers.md', import.meta.url).pathname;
  const BROWSE = new URL('../../../progress/reading-tools/browse.mjs', import.meta.url).pathname;

  it('🔴 직접 해보기 2 — err?.code 판은 네 요청이 정답과 같지만, 폴더가 없을 때의 디스크 에러(ENOENT)를 400 으로 숨긴다(정답은 500)', async () => {
    const codeVariant = rep(lab('practice2.js'), 'if (err instanceof multer.MulterError) {', 'if (err?.code) {');
    expect(await p2Like(codeVariant, Q)).toEqual([[201, null], [400, '프로필 사진은 1MB까지 올릴 수 있어요'],
      [400, '프로필 사진은 JPG나 PNG만 올릴 수 있어요'], [400, '프로필 사진은 avatar 이름으로 한 장만 보낼 수 있어요']]);
    for (const [src, want] of [[lab('practice2.js'), [500, '서버에서 문제가 생겼어요']], [codeVariant, [400, '프로필 사진을 받지 못했어요']]]) {
      await withLab({ src, labPort: 4002, port: Q + 1 }, async (srv) => {
        rmSync(join(srv.dir, 'lab', 'p3-31', 'avatars'), { recursive: true, force: true });
        const res = await upload(srv.base, '/api/avatar', [jpg('beach.jpg', 'beach.jpg', 'avatar')]);
        expect([res.status, res.body.message]).toEqual(want);
      });
    }
    expect(read(LECTURE)).toContain('`err?.code`');
  });

  it('🔴 Step 8 — 127.0.0.1 화면에서는 same-site 사진이 NotSameSite 로 막히고, cross-origin 은 뜬다 · localhost 화면은 둘 다 뜬다', async () => {
    const final = read(R('app.js'));
    const sameSite = rep(final, "policy: 'cross-origin'", "policy: 'same-site'");
    const pagePort = Q + 3;
    for (const [appSrc, want] of [[sameSite, { localhost: 600, ip: 0 }], [final, { localhost: 600, ip: 600 }]]) {
      await withServer(Q + 2, { 'app.js': appSrc }, async (srv) => {
        mkdirSync(join(srv.dir, 'uploads'), { recursive: true });
        writeFileSync(join(srv.dir, 'uploads', 'beach.jpg'), PHOTO('beach.jpg'));
        const page = express();
        page.get('/photo', (req, res) => res.send(`<img src="http://localhost:${Q + 2}/uploads/beach.jpg" width="300">`));
        const ps = page.listen(pagePort);
        try {
          const got = {};
          for (const [key, host] of [['localhost', 'localhost'], ['ip', '127.0.0.1']]) {
            // 화면 서버가 이 프로세스 안에 있어서 동기 실행은 막힌다 — 비동기로 기다린다
            const { stdout: out } = await promisify(execFile)(process.execPath, [BROWSE, JSON.stringify([{ goto: `http://${host}:${pagePort}/photo` }, { wait: 600 },
              { eval: "document.querySelector('img').naturalWidth" }, { console: true }])], { encoding: 'utf8', timeout: 60000 });
            got[key] = Number(out.match(/naturalWidth\n\s*(\d+)/)?.[1] ?? out.match(/naturalWidth\s+(\d+)/)?.[1]);
            if (key === 'ip' && want.ip === 0) expect(out).toContain('ERR_BLOCKED_BY_RESPONSE.NotSameSite');
          }
          expect(got).toEqual(want);
        } finally { ps.close(); }
      });
    }
    expect(read(LECTURE)).toContain('`http://127.0.0.1:4009/photo`');
  }, 120000);

  it('🔴 Step 7 겪기 — basename 을 뺀 판은 /uploads/../lab/p3-31/canary.txt 게시물을 지울 때 그 파일을 지운다 · 끝 판은 남긴다', async () => {
    for (const [post, gone] of [[read(SNAP('step7-no-basename.postService.js')), true], [read(R('services/postService.js')), false]]) {
      reseed();
      await withServer(Q + 4, { 'services/postService.js': post }, async (srv) => {
        mkdirSync(join(srv.dir, 'lab', 'p3-31'), { recursive: true });
        writeFileSync(join(srv.dir, 'lab', 'p3-31', 'canary.txt'), lab('canary.txt'));
        const created = await send(srv.base, 'POST', '/api/posts', { json: { authorId: 2, imageUrls: ['/uploads/../lab/p3-31/canary.txt'] } });
        expect(created.status).toBe(201);
        expect((await send(srv.base, 'DELETE', `/api/posts/${created.body.id}`)).status).toBe(200);
        expect(existsSync(join(srv.dir, 'lab', 'p3-31', 'canary.txt'))).toBe(!gone);
      });
    }
    reseed();
  });

  it('🔴 교안·답안 문장 — 학생 검수가 고친 자리', () => {
    const lecture = read(LECTURE);
    const answers = read(ANSWERS);
    expect(lecture + answers).not.toContain('까닭');
    expect(lecture).toContain('파일로 `hello.txt`를 고른 뒤');
    expect(lecture).not.toMatch(/upload\.fields|upload\.none\(\)/);
    expect(lecture).toContain('`VITE_API_URL`');
    expect(lecture).toContain('### 사진과 사진이 아닌 파일을 함께 보내기');
    expect(lecture).toContain('**이제 오프닝의 첫 물음에도 답할 수 있어요.**');
    expect(lecture).toContain('`requests/photos/`');
    expect(lecture).not.toContain('제가 두 도메인이 제 컴퓨터를 가리키게 해서');
  });
});

// 축 ⑩ 의 p2 와 같은 네 요청(포트만 따로)
async function p2Like(src, port) {
  const out = [];
  await withLab({ src, labPort: 4002, port }, async (srv) => {
    for (const parts of [[jpg('beach.jpg', 'beach.jpg', 'avatar')], [jpg('medium.jpg', 'medium.jpg', 'avatar')],
      [{ name: 'avatar', file: PHOTO('memo.txt'), filename: 'memo.txt', type: 'text/plain' }], [jpg('beach.jpg', 'beach.jpg', 'photo')]]) {
      const res = await upload(srv.base, '/api/avatar', parts);
      out.push([res.status, res.body.message ?? null]);
    }
  });
  return out;
}
