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
import { execFileSync } from 'node:child_process';
import pg from 'pg';
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
    expect(read(R('.gitignore'))).toContain('\n# 사용자가 올린 사진 — 코드가 아니라 데이터다\nuploads/\n');
  });
});
