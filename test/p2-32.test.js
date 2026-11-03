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
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import pg from 'pg';
import { boot } from './helpers/boot.js';
import { setupP229, setupP229Bookstore } from '../sql/p2-29/setup.mjs';
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
  await setupP229(db);
  await db.query('ALTER TABLE posts ADD COLUMN IF NOT EXISTS created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP');
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

  it('🔴 과제 [응용] — Zod 스키마를 서버 없이 그대로 쓴다', () => {
    const copies = ['lab/p2-32/commentSchema.js', 'lab/p2-32/commentService.js', 'lab/p2-32/homework2.js']
      .map((f) => labCopy(f));
    writeFileSync(P(copies[2]), read(P(copies[2]))
      .replace("'./commentSchema.js'", "'./commentSchema.local.js'")
      .replace("'./commentService.js'", "'./commentService.local.js'"));
    try {
      const out = execFileSync(process.execPath, [P(copies[2])],
        { cwd: P('.'), encoding: 'utf8', env: { ...process.env, ...ENV } });
      expect(out).toContain('댓글을 만들었어요');
      expect(out).toContain('댓글을 다시 지웠어요');
      expect(out).toContain('일부러 틀린 입력은 막혔어요');
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
    // Step 4 — parseId·서비스가 throw 로 바뀐 «직후, Zod 이전» 중간 상태(patch 만 validateBody
    // 가 없다). 실제로 돌려서 검증했다(404·200 둘 다 확인) 但 파일로 얼려두지 않아 SOURCES
    // 풀에는 없다. 앞뒤 GET·DELETE 조각은 최종판과 동일해 SKETCHES 없이도 통과한다.
    "router.patch('/:id', parseId, async (req, res) => {\n  const post = await postService.updatePost(req.postId, req.body);",
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
