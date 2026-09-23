// p2-32 「유효성 검사와 오류 처리 — HttpError 클래스 · Zod DTO 검증 미들웨어」 게이트
//
// 🚨 진짜 instagram DB 를 안 건드린다 — 전용 DB(p232_gate)를 p2-31 종료 상태로 세워서 쓴다.
// 🚨 이 회차는 p2-31 과 달리 «새 기능이 있다» — id 주입 차단·타입 검증·400 상세 메시지가
//    새로 생긴다. 그래서 계약 검사(옛 행동 유지)와 신규 행동 검사를 함께 본다.
// 🚨 p2-33 이 정규화(posts.username → author_id)를 하면서 이 회차가 «자라는 파일»로 보던
//    것들을 snapshots/p2-32-final/ 로 얼렸다. 안 얼리면 이 회차 축들이 거짓 FAIL 이 된다 —
//    캐논 「앞 회차 테스트가 자라는 파일을 live 로 보면 다음 회차 부채를 가린다」.
//    🔑 이번엔 «계약 자체»가 바뀌었다(POST 몸통이 username → authorId). 그래서 p2-31 처럼
//       동작 검사를 live 로 남겨둘 수 없다 — 남기면 옛 계약을 영원히 요구하게 된다.
//       새 계약이 안 깨졌다는 증거는 p2-33 자기 테스트가 «12요청 대조»로 따로 세운다.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, writeFileSync, unlinkSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import pg from 'pg';
import { boot } from './helpers/boot.js';
import { sendAll, changedFields } from './helpers/send-http.js';
import { setupP229Bookstore } from '../sql/p2-29/setup.mjs';
import { setupP230 } from '../sql/p2-30/setup.mjs';
import { HttpError, NotFoundError, BadRequestError } from '../errors.js';

const ROOT = new URL('../', import.meta.url);
const P = (rel) => new URL(rel, ROOT).pathname;
const GATE_URL = 'postgresql://postgres:postgres@localhost:5432/p232_gate';
const ADMIN = { host: 'localhost', port: 5432, database: 'postgres', user: 'postgres', password: 'postgres' };
const BOOK_GATE_URL = 'postgresql://postgres:postgres@localhost:5433/p232_book_gate';
const BOOK_ADMIN = { ...ADMIN, port: 5433 };
const ENV = { DATABASE_URL: GATE_URL, BOOKSTORE_URL: BOOK_GATE_URL };
const JSON_HEADERS = { 'Content-Type': 'application/json' };

const LECTURE = P('../../part2/5-db-prisma/p2-32-validation-lecture.md');
const ANSWERS = P('../../part2/5-db-prisma/p2-32-validation-answers.md');
const read = (p) => readFileSync(p, 'utf8');
const exists = (p) => { try { readFileSync(p); return true; } catch { return false; } };
const blocksOf = (path, lang) =>
  [...read(path).matchAll(new RegExp('```' + lang + '\\n([\\s\\S]*?)```', 'g'))].map((m) => m[1].trimEnd());

let db = null;
let server = null;

/** lab 파일을 «한 단 깊은» 경로로 고친 사본 — 파일 자체는 학생 표기 그대로 둔다. */
function labCopy(rel) {
  const local = rel.replace(/\.js$/, '.local.js');
  writeFileSync(P(local), read(P(rel))
    .replace(/from '\.\.\/(db|services|routes|errors|schemas|middlewares)\//g, "from '../../snapshots/p2-32-final/$1/")
    .replace(/from '\.\.\/(db|errors)\.js'/g, "from '../../snapshots/p2-32-final/$1.js'")
    // 🚨 회차마다 게이트 포트를 가른다 — vitest 가 파일을 병렬로 돌려 4001 을 공유하면 부딪힌다.
    .replaceAll('4001', '4032'));
  return local;
}
const dropCopy = (local) => { try { unlinkSync(P(local)); } catch { /* 이미 없음 */ } };

const seed = (file = 'snapshots/p2-32-final/seed.js', args = []) =>
  execFileSync(process.execPath, [P(file), ...args], { cwd: P('.'), encoding: 'utf8', env: { ...process.env, ...ENV } });

beforeAll(async () => {
  const admin = new pg.Client(ADMIN);
  await admin.connect();
  await admin.query('DROP DATABASE IF EXISTS p232_gate');
  await admin.query('CREATE DATABASE p232_gate');
  await admin.end();
  db = new pg.Client({ ...ADMIN, database: 'p232_gate' });
  await db.connect();
  // 🔀 2026-09-18 audit — 착수 상태를 p2-30 판(과제 [기초]의 댓글 updated_at 포함)으로, 시드는 p2-30 클라이언트로.
  //    gitignore 된 생성물이라 매번 만든다(output 이 회차 폴더라 수업 클라이언트를 안 덮는다).
  execFileSync(P('node_modules/.bin/prisma'), ['generate', '--config', 'snapshots/p2-30/generate.config.js'],
    { cwd: P('.'), encoding: 'utf8' });
  await setupP230(db);
  seed();   // p2-30/31 종료 상태 — 게시물 1~5 · 댓글 1~9

  const bookAdmin = new pg.Client(BOOK_ADMIN);
  await bookAdmin.connect();
  await bookAdmin.query('DROP DATABASE IF EXISTS p232_book_gate');
  await bookAdmin.query('CREATE DATABASE p232_book_gate');
  await bookAdmin.end();
  const book = new pg.Client({ ...BOOK_ADMIN, database: 'p232_book_gate' });
  await book.connect();
  await setupP229Bookstore(book);
  await book.query('ALTER TABLE books ADD COLUMN IF NOT EXISTS is_sold_out BOOLEAN NOT NULL DEFAULT false');
  await book.end();
}, 90000);

afterAll(async () => {
  if (server) { await server.stop(); server = null; }
  await db?.end();
  const admin = new pg.Client(ADMIN);
  await admin.connect();
  await admin.query(
    "select pg_terminate_backend(pid) from pg_stat_activity where datname = 'p232_gate' and pid <> pg_backend_pid()");
  await admin.query('DROP DATABASE IF EXISTS p232_gate');
  await admin.end();
  const bookAdmin = new pg.Client(BOOK_ADMIN);
  await bookAdmin.connect();
  await bookAdmin.query(
    "select pg_terminate_backend(pid) from pg_stat_activity where datname = 'p232_book_gate' and pid <> pg_backend_pid()");
  await bookAdmin.query('DROP DATABASE IF EXISTS p232_book_gate');
  await bookAdmin.end();
});

async function bootApp(file, port) {
  if (server) { await server.stop(); server = null; await new Promise((r) => setTimeout(r, 150)); }
  server = await boot(file, { port, env: { ...ENV, PORT: String(port) }, ready: `${port}번 포트에서` });
  return server;
}

// ── 클래스 계층 — instanceof 가 실제로 갈린다 ────────────────────────────────
describe('HttpError 클래스 계층', () => {
  it('NotFoundError 는 HttpError·Error 다 이고, status 404 를 갖는다', () => {
    const e = new NotFoundError('그런 게시물은 없어요');
    expect(e).toBeInstanceOf(NotFoundError);
    expect(e).toBeInstanceOf(HttpError);
    expect(e).toBeInstanceOf(Error);
    expect(e.status).toBe(404);
    expect(e.message).toBe('그런 게시물은 없어요');
  });

  it('BadRequestError 는 NotFoundError 가 아니다 — 종류가 갈린다', () => {
    const e = new BadRequestError('보낸 내용이 이상해요');
    expect(e).toBeInstanceOf(BadRequestError);
    expect(e).toBeInstanceOf(HttpError);
    expect(e).not.toBeInstanceOf(NotFoundError);
    expect(e.status).toBe(400);
  });
});

// ── 최종판 — 실제 서버로 다섯 재료가 맞물리는지 ──────────────────────────────
describe('최종판 — 실제 서버', () => {
  it('착수 상태 — p2-31 을 끝낸 표 둘이 그대로 서 있다', async () => {
    const r = await db.query('select (select count(*)::int from posts) p, (select count(*)::int from comments) c');
    expect(r.rows[0]).toEqual({ p: 5, c: 9 });
  });

  it('POST 정상 요청은 201 로 만들어진다', async () => {
    await bootApp('snapshots/p2-32-final/app.js', 3600);
    const res = await fetch(`${server.base}/api/posts`, {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ username: 'jaehoon', postImage: 'a.jpg', content: '오늘' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.username).toBe('jaehoon');
    expect(body.id).toBeTypeOf('number');
  });

  it('🔴 스키마가 받는 칸 5개와 「받지 않아요」로 적은 칸을 합치면 게시물의 칸 전부다', async () => {
    // Step 5 — 「번호·하트 수·댓글 수·작성 시각·고친 시각은 저장할 때 채워지니까 받지 않아요」.
    // 🔀 2026-09-19 audit — 고친 시각(`updatedAt`)이 생겼고, 원래부터 빠져 있던 댓글 수도 함께 적었다.
    const { postCreateSchema } = await import('../snapshots/p2-32-final/schemas/postSchema.js');
    const res = await fetch(`${server.base}/api/posts`, {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ username: 'jaehoon', postImage: 'a.jpg' }),
    });
    const body = await res.json();
    const notTaken = ['id', 'likeCount', 'commentCount', 'createdAt', 'updatedAt'];
    expect([...Object.keys(postCreateSchema.shape), ...notTaken].sort()).toEqual(Object.keys(body).sort());
    expect(read(LECTURE)).toContain('번호·하트 수·댓글 수·작성 시각·고친 시각은 저장할 때 채워지니까 받지 않아요.');
  });

  it('🔴 POST 에 id 를 실어 보내도 서버가 정한 번호로 만들어진다 — 주입 구멍이 막혔다', async () => {
    const res = await fetch(`${server.base}/api/posts`, {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ id: 999999, username: 'jaehoon', postImage: 'a.jpg' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).not.toBe(999999);
  });

  it('POST 에 postImage 가 없으면 400 이고, 어느 칸이 문제인지 details 로 온다', async () => {
    const res = await fetch(`${server.base}/api/posts`, {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ username: 'jaehoon' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toBeTruthy();
    expect(body.details.properties.postImage).toBeTruthy();
  });

  it('POST 에 username 이 빈 문자열이면 400 이다 — 있기만 해선 안 된다', async () => {
    const res = await fetch(`${server.base}/api/posts`, {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ username: '', postImage: 'a.jpg' }),
    });
    expect(res.status).toBe(400);
  });

  it('PATCH 로 likeCount 만 보내도 그대로 반영된다 — 나머지는 그대로', async () => {
    const before = await (await fetch(`${server.base}/api/posts/1`)).json();
    const res = await fetch(`${server.base}/api/posts/1`, {
      method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ likeCount: 42 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.likeCount).toBe(42);
    expect(body.username).toBe(before.username);
    expect(body.postImage).toBe(before.postImage);
  });

  it('🔴 PATCH 에 likeCount 를 글자로 보내면 400 이다 — 타입이 검증된다', async () => {
    const res = await fetch(`${server.base}/api/posts/1`, {
      method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ likeCount: '많이' }),
    });
    expect(res.status).toBe(400);
  });

  it('PATCH 로 id 를 실어 보내도 무시된다', async () => {
    const res = await fetch(`${server.base}/api/posts/1`, {
      method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ id: 777, likeCount: 3 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(1);
  });

  it('없는 번호를 고치면 — 검사가 아니라 «없다» 로 404', async () => {
    const res = await fetch(`${server.base}/api/posts/999`, {
      method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ likeCount: 3 }),
    });
    expect(res.status).toBe(404);
    expect((await res.json()).message).toBe('그런 게시물은 없어요');
  });

  it('🔴 없는 번호를 고치면서 몸통도 틀리면 — 400 이 먼저다 (몸통 검사가 DB 왕복보다 앞선다)', async () => {
    // parseId 는 «형식» 만 본다(999 는 정수라 통과) — «존재」 는 서비스가 DB 를 봐야 안다.
    // validateBody 가 parseId 다음, 서비스보다 앞에 서 있어서 몸통이 틀리면 DB 에 가지도 않는다.
    const res = await fetch(`${server.base}/api/posts/999`, {
      method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ likeCount: '많이' }),
    });
    expect(res.status).toBe(400);
  });

  it('글자 번호는 여전히 404 다 — parseId 가 그대로 지킨다', async () => {
    expect((await fetch(`${server.base}/api/posts/abc`)).status).toBe(404);
  });

  it('없는 게시물을 지우면 404 다 — 서비스가 던지고 라우터는 아무것도 안 한다', async () => {
    const res = await fetch(`${server.base}/api/posts/999`, { method: 'DELETE' });
    expect(res.status).toBe(404);
  });

  it('깨진 JSON 몸통은 여전히 400 이다 — express.json() 의 SyntaxError 갈래가 살아 있다', async () => {
    const res = await fetch(`${server.base}/api/posts`, {
      method: 'POST', headers: JSON_HEADERS, body: '{broken',
    });
    expect(res.status).toBe(400);
    expect((await res.json()).message).toBe('보낸 내용을 읽을 수 없어요');
  });

  it('없는 주소는 여전히 404 다', async () => {
    expect((await fetch(`${server.base}/api/nope`)).status).toBe(404);
  });

  it('목록·필터·정렬은 그대로다', async () => {
    expect((await (await fetch(`${server.base}/api/posts`)).json()).length).toBeGreaterThanOrEqual(5);
    expect((await (await fetch(`${server.base}/api/posts?limit=2`)).json())).toHaveLength(2);
  });

  it('🔴 댓글이 달린 게시물을 지우면 아직 500 이다 — p2-33 이월 부채 그대로', async () => {
    const res = await fetch(`${server.base}/api/posts/1`, { method: 'DELETE' });
    expect(res.status).toBe(500);
  });
});

// ── Step 4 중간 상태 — 서비스는 던지고, 고치기 라우트는 아직 칸을 골라 꺼낸다 ──────
// 🔑 2026-09-18 낭독 retrofit — Step 4 발췌가 고치기 라우트의 «칸 골라 꺼내기» 를 설명 없이
//    `req.body` 통째로 바꿔, Step 6 까지 p2-30 이 막은 `id` 주입 구멍이 다시 열려 있었다.
//    교안을 p2-31 판(골라 꺼내기 유지)으로 되돌렸으니, 그 조합이 실제로 도는지 여기서 잠근다.
describe('Step 4 중간 상태 — 실제 서버', () => {
  it('🔴 404 는 서비스와 parseId 가 넘긴 NotFoundError 로 나가고, id 는 여전히 걸러진다', async () => {
    await bootApp('snapshots/p2-32-step4/app.js', 3632);
    const b = server.base;
    const notFound = { message: '그런 게시물은 없어요' };
    expect((await fetch(`${b}/api/posts/1`)).status).toBe(200);
    for (const [path, init] of [
      ['/api/posts/999', {}],
      ['/api/posts/abc', {}],
      ['/api/posts/999', { method: 'PATCH', headers: JSON_HEADERS, body: '{"likeCount":3}' }],
      ['/api/posts/999', { method: 'DELETE' }],
    ]) {
      const res = await fetch(`${b}${path}`, init);
      expect(res.status, `${init.method ?? 'GET'} ${path}`).toBe(404);
      expect(await res.json()).toEqual(notFound);
    }
    const patched = await fetch(`${b}/api/posts/1`, {
      method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ id: 777, likeCount: 4 }),
    });
    expect(patched.status).toBe(200);
    expect((await patched.json()).id).toBe(1);
    // 만들기의 손 검사는 Step 6 까지 그대로다 — 요청 12개의 「사진 없이 올리기」 기준 답.
    const noImage = await fetch(`${b}/api/posts`, {
      method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ username: 'yuna' }),
    });
    expect(noImage.status).toBe(400);
    expect(await noImage.json()).toEqual({ message: 'username과 postImage는 꼭 있어야 해요' });
    await server.stop(); server = null;
  });

  it('🔴 완성본에서 「사진 없이 올리기」 는 같은 400 이지만 메시지와 details 가 바뀐다', async () => {
    await bootApp('snapshots/p2-32-final/app.js', 3633);
    const res = await fetch(`${server.base}/api/posts`, {
      method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ username: 'yuna' }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      message: '보낸 내용이 규칙에 안 맞아요',
      details: { errors: [], properties: { postImage: { errors: ['Invalid input: expected string, received undefined'] } } },
    });
    await server.stop(); server = null;
  });

  it('🔴 요청 12개를 시작 판·완성 판에 보내면 「사진 없이 올리기」 하나와 새 게시물의 번호·두 시각만 달라진다', async () => {
    // 교안 마지막 Step — 「시작할 때 봐둔 답과 달라지는 것은 「사진 없이 올리기」 하나예요 … 나머지 11개는
    // 새로 올린 게시물의 번호와 두 시각만 빼면 답이 그대로여야 해요」.
    // 🔀 2026-09-19 audit — 「번호와 시각」을 「번호와 두 시각」으로 맞추면서 그 주장 전체를 잠근다.
    // 요청 파일은 p2-30 부터 한 글자도 안 바뀌었다(`code/p2-30`·`code/p2-31`·`code/p2-32` 가지가 같다).
    const http = execFileSync('git', ['show', 'code/p2-31:requests/posts.http'], { cwd: P('.'), encoding: 'utf8' });
    await bootApp('snapshots/p2-31-final/app.js', 3634);
    const before = await sendAll(http, server.base);
    await bootApp('snapshots/p2-32-final/app.js', 3635);
    const after = await sendAll(http, server.base);
    expect(before).toHaveLength(12);
    expect(changedFields(before, after)).toEqual([
      '게시물 올리기: id,createdAt,updatedAt',
      '사진 없이 올리기: message,details',
      '방금 올린 게시물의 하트 수 고치기: id,createdAt,updatedAt',
      '방금 올린 게시물 지우기: id,createdAt,updatedAt',
    ]);
    expect(read(LECTURE)).toContain('나머지 11개는 새로 올린 게시물의 번호와 두 시각만 빼면 답이 그대로여야 해요.');
    await server.stop(); server = null;
  });
});

// ── 명령 블록 — 교안이 찍어둔 출력이 «실제로» 그 글자인가 ──────────────────
// 🚨 replay.py 는 이 자리를 원리적으로 못 본다 — 짝이 bash(명령)→bash(출력)이라
//    앞의 javascript 블록과 엮여 MISMATCH 다섯을 낸다(2026-09-19 실측). 그래서 이 축이 대신 잰다.
// 🔑 그 시점 학생 폴더를 «교안 블록만으로» 재현한다 — 경로 주석이 달린 javascript 블록을
//    순서대로 써 내려가면 뒤 판이 앞 판을 덮어서, 명령이 놓인 자리의 파일 상태가 그대로 선다.
//    (errors.js 는 L65 → L136, schemas/postSchema.js 는 L545 → L586 으로 자란다.)
describe('교안의 `node -e` 명령 다섯이 적어둔 출력을 그대로 낸다', () => {
  const FOLDER = P('.p2-32-blocks');   // ROOT 안이라 `zod` 가 ../node_modules 로 풀린다

  /** ```펜스를 언어·줄번호와 함께 뽑는다. */
  const fenced = () => {
    const out = [];
    let cur = null;
    read(LECTURE).split('\n').forEach((line, i) => {
      if (!line.startsWith('```')) { if (cur) cur.lines.push(line); return; }
      if (cur) { out.push(cur); cur = null; } else cur = { lang: line.slice(3).trim(), start: i + 1, lines: [] };
    });
    return out;
  };

  // replay.py 의 규칙 둘을 그대로 쓴다 — 경로는 <script> 로, `...` 는 와일드카드로.
  const SCRIPT_PATH = /(?:file:\/\/)?\/\S*?([\w.-]+\.(?:js|mjs|cjs))(:\d+)?/g;
  // 🚨 `-e` 로 돌린 코드의 스택 줄은 파일명이 `[eval1]` 이라 replay 의 경로 정규식에 안 걸린다.
  //    교안은 이 줄을 학생 컴퓨터 경로로 적으므로(하네스 관례) 그 모양으로 맞춘다.
  const EVAL_PATH = /file:\/\/\S*?\/(\[eval\d*\])/g;
  const canon = (text) => text.replace(/\n+$/, '').split('\n')
    .filter((l) => !/^Node\.js v[\d.]+$/.test(l.trim()))
    .map((l) => l.replace(EVAL_PATH, 'file:///Users/hong/instagram-api/$1'))
    .map((l) => l.replace(SCRIPT_PATH, '<script>$2'));
  const matches = (expected, actual) => {
    if (!expected.includes('    ...')) return expected.join('\n') === actual.join('\n');
    const [head, tail] = [expected.slice(0, expected.indexOf('    ...')), expected.slice(expected.indexOf('    ...') + 1)];
    return actual.slice(0, head.length).join('\n') === head.join('\n')
      && actual.slice(actual.length - tail.length).join('\n') === tail.join('\n');
  };

  it('🔴 다섯 명령이 교안이 적어둔 출력을 «글자 그대로» 낸다', () => {
    const blocks = fenced();
    rmSync(FOLDER, { recursive: true, force: true });
    mkdirSync(FOLDER, { recursive: true });
    const ran = [];
    try {
      blocks.forEach((b, i) => {
        const body = b.lines.join('\n');
        if (b.lang === 'javascript' && b.lines[0]?.startsWith('// ~/instagram-api/')) {
          const rel = b.lines[0].replace('// ~/instagram-api/', '').trim();
          mkdirSync(P(`.p2-32-blocks/${rel}`).replace(/\/[^/]+$/, ''), { recursive: true });
          writeFileSync(P(`.p2-32-blocks/${rel}`), `${body}\n`);
          return;
        }
        if (b.lang !== 'bash' || !body.startsWith('node --input-type=module')) return;
        const expected = canon(blocks[i + 1].lines.join('\n'));
        // `console.error` 를 쓰는 블록이 있어 stderr 까지 받는다 — 학생이 보는 화면이 그것이다
        const out = execFileSync('bash', ['-c', `${body.replace('node ', `${process.execPath} `)} 2>&1`],
          { cwd: FOLDER, encoding: 'utf8' });
        const actual = canon(out);
        expect(matches(expected, actual), `L${b.start} 명령 → L${blocks[i + 1].start} 출력\n기대:\n${expected.join('\n')}\n실제:\n${actual.join('\n')}`).toBe(true);
        ran.push(body);
      });
    } finally { rmSync(FOLDER, { recursive: true, force: true }); }
    // 명령 블록이 늘거나 줄면 이 축이 알아챈다 — 새 블록이 조용히 안 재지는 것을 막는다.
    // 🚨 줄 번호로 적었다가 문단 하나를 나누자 두 줄 밀려 깨졌다(2026-09-21) — «무엇을 돌렸나» 로 센다.
    expect(ran).toHaveLength(5);
    expect(ran.filter((c) => c.includes("from './errors.js'"))).toHaveLength(3);
    expect(ran.filter((c) => c.includes("from './schemas/postSchema.js'"))).toHaveLength(2);
  });
});

// ── 정적 검사 — 몸통이 실제로 가벼워졌는가 ──────────────────────────────────
describe('최종판 — 코드 모양', () => {
  it('🔴 라우터에 `if (!post)`·`res.status(404)` 가 더는 없다', () => {
    const router = read(P('snapshots/p2-32-final/routes/posts.js'));
    expect(router).not.toContain('if (!post)');
    expect(router).not.toContain('if (!deleted)');
    expect(router.match(/res\.status\(404\)/g)).toBeNull();
  });

  it('🔴 서비스에 `try`/`catch`/`P2025` 가 그대로 있다 — Prisma 이름은 여기서 끝난다', () => {
    const service = read(P('snapshots/p2-32-final/services/postService.js'));
    expect(service).toContain('P2025');
    expect(service).toContain('NotFoundError');
  });

  it('🔴 라우터가 아는 것은 이름뿐이다 — Zod 가 라우터 안이 아니라 미들웨어에 있다', () => {
    const router = read(P('snapshots/p2-32-final/routes/posts.js'));
    expect(router).not.toContain("from 'zod'");
    expect(router).toContain('validateBody');
  });

  it('app.js 의 에러 미들웨어가 instanceof 로 판별한다', () => {
    expect(read(P('snapshots/p2-32-final/app.js'))).toContain('instanceof HttpError');
  });
});

// ── lab — 서점과 댓글도 같은 재료로 선다 ──────────────────────────────────
describe('lab — 서점(직접 해보기)과 댓글(과제)', () => {
  it('직접 해보기 — 서점도 instanceof 로 갈리고, `if (!book)` 이 사라졌다', async () => {
    const copies = ['lab/p2-32/bookService.js', 'lab/p2-32/bookRoutes.js', 'lab/p2-32/practice1.js']
      .map((f) => labCopy(f));
    writeFileSync(P(copies[1]), read(P(copies[1])).replace("'./bookService.js'", "'./bookService.local.js'"));
    writeFileSync(P(copies[2]), read(P(copies[2])).replace("'./bookRoutes.js'", "'./bookRoutes.local.js'"));
    try {
      await bootApp(copies[2], 4000);
      expect((await (await fetch(`${server.base}/api/books`)).json()).length).toBeGreaterThanOrEqual(6);
      expect((await fetch(`${server.base}/api/books/1`)).status).toBe(200);
      expect((await fetch(`${server.base}/api/books/999`)).status).toBe(404);
      expect((await fetch(`${server.base}/api/books/abc`)).status).toBe(404);
      expect((await fetch(`${server.base}/api/books/999`, { method: 'DELETE' })).status).toBe(404);
    } finally { if (server) { await server.stop(); server = null; } copies.forEach(dropCopy); }
    expect(read(P('lab/p2-32/bookRoutes.js'))).not.toContain('if (!book)');
    expect(read(P('lab/p2-32/bookRoutes.js'))).not.toContain('if (!deleted)');
    expect(read(P('lab/p2-32/bookService.js'))).toContain('NotFoundError');
  });

  it('🔴 과제 [기초] — 댓글 서버도 instanceof 로 갈린다', async () => {
    const copies = ['lab/p2-32/commentService.js', 'lab/p2-32/commentRoutes.js', 'lab/p2-32/homework1.js']
      .map((f) => labCopy(f));
    writeFileSync(P(copies[1]), read(P(copies[1])).replace("'./commentService.js'", "'./commentService.local.js'"));
    writeFileSync(P(copies[2]), read(P(copies[2])).replace("'./commentRoutes.js'", "'./commentRoutes.local.js'"));
    try {
      await bootApp(copies[2], 4032);
      expect((await (await fetch(`${server.base}/api/comments`)).json())).toHaveLength(9);
      expect((await (await fetch(`${server.base}/api/comments?postId=1`)).json())).toHaveLength(3);
      expect((await fetch(`${server.base}/api/comments/1`)).status).toBe(200);
      for (const bad of ['999', 'abc']) {
        expect((await fetch(`${server.base}/api/comments/${bad}`)).status, bad).toBe(404);
        expect((await fetch(`${server.base}/api/comments/${bad}`, { method: 'DELETE' })).status, bad).toBe(404);
      }
    } finally { if (server) { await server.stop(); server = null; } copies.forEach(dropCopy); }
    expect(read(P('lab/p2-32/commentService.js')).match(/\bres\b/g)).toBeNull();
    expect(read(P('lab/p2-32/commentRoutes.js')).match(/prisma/gi)).toBeNull();
  });

  it('🔴 과제 [응용] — Zod 스키마를 서버 없이 그대로 쓴다 · 답안 출력이 «한 글자도 안 다르게» 나온다', () => {
    // 🚨 예전 판은 핵심 문구만 `toContain` 해서 `10번` 을 아무도 안 봤다(2026-09-23 게이트 Q1 — replay 는
    //    이 블록을 🈳 DB 로 여기 넘긴다). 착수 상태는 학생 이력에서 뽑았다 — 댓글을 만드는 요청은 `p2-31`·`p2-32`
    //    어디에도 없고(`comments.http` 에 POST 0개), `p2-31` 답안이 댓글이 8개면 `npm run seed` 를 치게 한다.
    //    시드는 `RESTART IDENTITY` 라 그 학생의 다음 댓글이 곧 10번이다. 이 파일의 앞 축과 상관없게 여기서 다시 세운다.
    // 답안 — 「여러분 화면의 번호는 이와 다를 수 있어요. 댓글 번호도 게시물처럼 만들 때마다 하나씩 올라가거든요.」
    //    그 이유까지 잠근다 — 한 번 더 돌리면 번호만 하나 커지고 나머지는 한 글자도 안 달라진다.
    const doc = read(ANSWERS);
    const at = doc.indexOf('`node --env-file=.env lab/homework2.js`로 실행하면 이렇게 나와요.');
    expect(at, '답안에 과제 2 실행 문장이 없습니다').toBeGreaterThan(-1);
    const fence = doc.slice(at).match(/```bash\n([\s\S]*?)```/)[1].trimEnd();
    // 🔑 펜스 첫 줄을 글자로도 적는다 — replay 가 이 테스트를 «이 출력을 보는 테스트» 로 알아보는 근거다.
    expect(fence.split('\n')[0]).toBe('10번 댓글을 만들었어요.');
    expect(fence.match(/^10번 /gm)).toHaveLength(2);
    expect(doc).toContain('여러분 화면의 번호는 이와 다를 수 있어요. 댓글 번호도 게시물처럼 만들 때마다 하나씩 올라가거든요.');

    const copies = ['lab/p2-32/commentSchema.js', 'lab/p2-32/commentService.js', 'lab/p2-32/homework2.js']
      .map((f) => labCopy(f));
    writeFileSync(P(copies[2]), read(P(copies[2]))
      .replace("'./commentSchema.js'", "'./commentSchema.local.js'")
      .replace("'./commentService.js'", "'./commentService.local.js'"));
    const run = () => execFileSync(process.execPath, [P(copies[2])],
      { cwd: P('.'), encoding: 'utf8', env: { ...process.env, ...ENV } }).trimEnd();
    try {
      seed();
      expect(run()).toBe(fence);
      expect(run()).toBe(fence.replace(/^10번 /gm, '11번 '));
    } finally { copies.forEach(dropCopy); }
  });
});

// ── 인용 — 교안·답안이 코드베이스와 byte 동일한가 ───────────────────────────
describe('인용이 코드베이스와 byte 동일한가', () => {
  const SKETCHES = [
    // Step 4 🙋 실험 — 서비스를 «일부러» 예전 판으로 되돌린 가정. 실제 파일에 없다.
    "router.get('/:id', parseId, async (req, res) => {\n  const post = await postService.getPost(req.postId);   // 아직 null 을 돌려주는 예전 서비스\n  res.json(post);\n});",
    // Step 1 — console.error 출력을 손으로 그린 설명용 스케치(실제 stack 은 절대경로).
    "console.error(e)             # class 로 만든 것\nHttpError: 그런 게시물은 없어요\n    at file:///.../errors.js:5:12\n    ...\n    { status: 404 }\n\nconsole.error({ status: 404, message: '그런 게시물은 없어요' })   # 그냥 객체\n{ status: 404, message: '그런 게시물은 없어요' }",
    // Step 3 — app.js 나머지는 안 바뀐다는 생략 표시.
    '// ...',
    // Step 5 — postCreateSchema 의 «첫 판»(postFields 로 리팩터링되기 전). 같은 Step 안에서
    // 스스로 대체된다 — 최종 파일에는 postFields 를 쓰는 두 번째 판만 남는다.
    "export const postCreateSchema = z.object({\n  username: z.string().min(1).max(50),\n  profileImage: z.string().optional(),\n  postImage: z.string().min(1),\n  postAlt: z.string().optional(),\n  content: z.string().optional(),\n});",
    // Step 5 — 손으로 짠 예전 방식의 예시(어느 파일에도 없던 걸 보여주려는 대조용).
    "if (!username || !postImage) {\n  res.status(400).json({ message: 'username과 postImage는 꼭 있어야 해요' });\n  return;\n}",
  ];
  const unannotate = (t) => t.split('\n')
    .map((l) => l.replace(/\s+\/\/ [①②③④].*$/, '').replace(/\s+$/, ''))
    .join('\n');

  const SOURCES = [
    'errors.js', 'snapshots/p2-32-final/app.js', 'db.js',
    'snapshots/p2-32-final/routes/posts.js', 'snapshots/p2-32-final/services/postService.js',
    'snapshots/p2-32-final/schemas/postSchema.js', 'middlewares/validate.js',
    'snapshots/p2-31-final/app.js', 'snapshots/p2-31-final/routes/posts.js',
    'snapshots/p2-31-final/services/postService.js',
    'snapshots/p2-32-step4/routes/posts.js',
    'lab/p2-32/practice1.js', 'lab/p2-32/bookRoutes.js', 'lab/p2-32/bookService.js',
    'lab/p2-32/commentRoutes.js', 'lab/p2-32/commentService.js', 'lab/p2-32/commentSchema.js',
    'lab/p2-32/homework1.js', 'lab/p2-32/homework2.js',
  ];
  const pool = () => SOURCES.map((f) => read(P(f))).join('\n\n@@@\n\n');

  it('🔴 교안이 인용한 자바스크립트가 전부 코드베이스 «어딘가에» 실재한다', () => {
    const src = pool();
    const missing = [];
    for (const block of blocksOf(LECTURE, 'javascript')) {
      const body = block.startsWith('//') ? block.split('\n').slice(1).join('\n') : block;
      for (const chunk of body.split(/\n\s*\n/).map((c) => unannotate(c).trim()).filter(Boolean)) {
        if (SKETCHES.includes(chunk)) continue;
        if (!src.includes(chunk)) missing.push(chunk.split('\n')[0]);
      }
    }
    expect(missing).toEqual([]);
  });

  it('🔴 답안이 인용한 자바스크립트도 전부 실재한다', () => {
    const src = pool();
    const missing = [];
    for (const block of blocksOf(ANSWERS, 'javascript')) {
      const body = block.startsWith('//') ? block.split('\n').slice(1).join('\n') : block;
      for (const chunk of body.split(/\n\s*\n/).map((c) => unannotate(c).trim()).filter(Boolean)) {
        if (SKETCHES.includes(chunk)) continue;
        if (chunk.includes('shared.js') || chunk.includes('notFound(what)') || chunk.includes('usernameSchema')) continue;
        if (!src.includes(chunk)) missing.push(chunk.split('\n')[0]);
      }
    }
    expect(missing).toEqual([]);
  });

  it('🔴 완성본으로 인용한 파일 둘이 byte 동일하다', () => {
    const pairs = [
      [LECTURE, '// ~/instagram-api/routes/posts.js', ['snapshots/p2-32-final/routes/posts.js']],
      [LECTURE, '// ~/instagram-api/services/postService.js', ['snapshots/p2-32-final/services/postService.js']],
    ];
    for (const [doc, head, files] of pairs) {
      // Step 7 전에도 부분 발췌가 같은 헤더로 시작하므로, «가장 긴»(완성본) 블록만 본다.
      const quoted = blocksOf(doc, 'javascript').filter((b) => b.startsWith(head));
      expect(quoted.length, head).toBeGreaterThanOrEqual(1);
      const fullest = quoted.reduce((a, b) => (b.length > a.length ? b : a));
      const wanted = files.map((f) => read(P(f)).trimEnd());
      expect(wanted, `${head}\n${fullest.slice(0, 80)}`).toContain(fullest);
    }
  });
});
