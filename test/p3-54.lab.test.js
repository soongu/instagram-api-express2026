// p3-54 「댓글 달고 지우기」 게이트 — 백엔드 실습(직접 해보기 1 · 2 · 과제 [응용])
// 내부 검증 전용 — 교안에 한 줄도 인용하지 않는다.
//
// 소재는 상품 리뷰(p3-53 실습 이어서) — 메모리 배열(lab/p3-54/shop-data.js)로 답하는 Express 실습 서버다(데이터베이스를 안 쓴다).
// 로그인은 p3-41 직접 해보기 3 처럼 수업 백엔드의 requireLogin 을 불러 쓴다 — 학생은 수업 백엔드(3000)에서 jaehoon 으로 로그인하고,
// 같은 쿠키(accessToken · Path=/)가 실습 서버(4001)에도 실린다. requireLogin 은 토큰의 서명과 기한만 본다(데이터베이스를 안 찾는다).
// 판정은 수업 백엔드를 3932 에, 실습 서버를 3933~3935 에 띄운다 — 실습 사본은 포트 두 곳(app.listen 의 수 · 기다린다는 문장)만 바꾼다.
// 판정 DB 는 `p354_api_lab` 하나(실습 커밋의 마이그레이션 + 시드 — 로그인에 jaehoon 의 비밀번호만 있으면 된다).
// 커밋 — 제목 끝이 «(직접 해보기 1)» · «(직접 해보기 2)» · «(과제 [응용])» 인 feat(p3-54) 커밋 · 같은 표식이 여럿이면 가장 뒤 커밋이 그 판.
// 나눠 주는 빈칸 판은 snapshots/p3-54/practice1-start.js · practice2-start.js(경로 주석은 학생 쪽 표기 그대로).
//
// 축 ① 나눠 주는 파일 — shop-data.js(p3-53 판에서 바꾼 곳 · 숫자 = 숨기지 않은 리뷰 수 · 2번 = 수업 DB 의 jaehoon) · 빈칸 판이 비운 채로 node --check · 빈칸 자리 말고는 정답 판과 같다
// 축 ② 직접 해보기 1 — 정답 판 · 틀린 판(본문에서 글쓴이 · 숫자를 안 올림 · 응답에 숫자 없음 · 200 · 빈칸 그대로) × practice1.http
// 축 ③ 직접 해보기 2 — 정답 판 · 틀린 판(번호로만 찾음 · 숨긴 리뷰에도 내림 · 권한 확인 빠짐 · 파는 사람도 허락 · 숫자를 안 내림) × practice2.http
// 축 ④ 과제 [응용] — 정답 판 · 틀린 판(상태와 상관없이 ±1 · 파는 사람 확인 빠짐 · 번호로만 찾음) × homework2.http
// 축 ⑤ 학생 파일 차이 — 실습 커밋은 lab/p3-54/ · snapshots/p3-54/ 만 · 경로 주석 · 쓰지 않기로 한 낱말 · 로그인 없이 401
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, mkdtempSync, rmSync, symlinkSync, writeFileSync, openSync, closeSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import pg from 'pg';
import { boot } from './helpers/boot.js';

const ROOT = new URL('../', import.meta.url);
const P = (rel) => new URL(rel, ROOT).pathname;
const read = (path) => readFileSync(path, 'utf8');
const LAB = 'lab/p3-54';
const STUDENT_PORT = 4001;
const API_PORT = 3932;
const LAB_PORT = 3933;
const PG_PORT = Number(process.env.P354_PG_PORT ?? 5432);
const ADMIN = { host: 'localhost', port: PG_PORT, database: 'postgres', user: 'postgres', password: 'postgres' };
const DB = 'p354_api_lab';
const SECRET = 'q2Xh0v9bGm4RkT7sYp1wLc8nZf3uJd6eHa5iVo0rQyE';
const ENV = {
  CORS_ORIGIN: 'http://localhost:3001', JWT_SECRET: SECRET, DATABASE_URL: `postgresql://postgres:postgres@localhost:${PG_PORT}/${DB}`,
  GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret', SITE_URL: `http://localhost:${API_PORT}`,
  KAKAO_CLIENT_ID: 'test-kakao', KAKAO_CLIENT_SECRET: 'test-kakao-secret', NAVER_CLIENT_ID: 'test-naver', NAVER_CLIENT_SECRET: 'test-naver-secret',
};
const hasRef = (ref) => {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', ref], { cwd: P('.'), stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
};
const LINE = process.env.P354_LINE ?? (hasRef('refs/heads/code/p3-54') ? 'code/p3-54' : 'HEAD');
/** 제목 끝 표식으로 커밋 하나 — 같은 표식이 여럿이면 가장 뒤 커밋. */
const commitOf = (mark) => {
  const log = execFileSync('git', ['log', '-n', '400', '--format=%H %s', LINE], { cwd: P('.'), encoding: 'utf8' });
  const hit = log.split('\n').find((l) => / feat\(p3-54\): /.test(l) && l.endsWith(`(${mark})`));
  if (!hit) throw new Error(`(${mark}) 커밋이 없다`);
  return hit.split(' ')[0];
};
const COMMITS = { practice1: '직접 해보기 1', practice2: '직접 해보기 2', homework2: '과제 [응용]' };
const showAt = (ref, rel) => execFileSync('git', ['show', `${ref}:${rel}`], { cwd: P('.'), encoding: 'utf8' });
const dirs = [];
const seen = {};

const admin = async (fn) => {
  const client = new pg.Client(ADMIN);
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
};
const dropDb = () => admin(async (client) => {
  await client.query(`select pg_terminate_backend(pid) from pg_stat_activity where datname = '${DB}' and pid <> pg_backend_pid()`);
  await client.query(`DROP DATABASE IF EXISTS ${DB}`);
});

/** 학생 폴더 모양의 사본 — 그 실습 커밋을 풀고 node_modules 를 잇는다. `edit` 는 실습 파일 글자를 바꾼다. */
const studentCopy = (which, edit) => {
  const dir = mkdtempSync(join(tmpdir(), 'p354-lab-'));
  dirs.push(dir);
  const tar = execFileSync('git', ['archive', '--format=tar', commitOf(COMMITS[which])], { cwd: P('.'), maxBuffer: 1 << 28 });
  execFileSync('tar', ['-x', '-C', dir], { input: tar });
  // 나눠 주는 데이터는 직접 해보기 1 에서 한 번 받는다
  writeFileSync(join(dir, LAB, 'shop-data.js'), showAt(commitOf(COMMITS.practice1), `${LAB}/shop-data.js`));
  symlinkSync(P('node_modules'), join(dir, 'node_modules'));
  if (edit) {
    const file = join(dir, LAB, `${which}.js`);
    writeFileSync(file, edit(read(file)));
  }
  return dir;
};
/** 글자 하나를 바꾼다 — 바꿀 글자가 꼭 한 번 있어야 한다. */
const swap = (a, b) => (text) => {
  if (text.split(a).length !== 2) throw new Error(`바꿀 글자가 없거나 여럿이다: ${a}`);
  return text.replace(a, b);
};
/** 학생 쪽 포트 4001 을 판정 포트로 — 바꾸는 곳은 app.listen 의 수와 기다린다는 문장 둘뿐이어야 한다. */
const onPort = (dir, which, port) => {
  const file = join(dir, LAB, `${which}.js`);
  const source = read(file);
  expect(source.split(String(STUDENT_PORT)).length - 1).toBe(2);
  expect(source).toMatch(new RegExp(`^app\\.listen\\(${STUDENT_PORT}, \\(\\) => \\{\\n  console\\.log\\('리뷰 서버가 ${STUDENT_PORT}번 포트에서 기다리고 있어요\\.'\\);\\n\\}\\);\\n$`, 'm'));
  writeFileSync(file, source.replaceAll(String(STUDENT_PORT), String(port)));
};
/** httpYac CLI 로 .http 한 파일을 통째로 — 수업 백엔드 주소(3000)와 실습 서버 주소(4001)를 판정 포트로. */
const httpyac = async (source) => {
  const dir = mkdtempSync(join(tmpdir(), 'p354-labhttp-'));
  dirs.push(dir);
  writeFileSync(join(dir, 'send.http'), source.replaceAll('http://localhost:3000', `http://localhost:${API_PORT}`).replaceAll(`http://localhost:${STUDENT_PORT}`, `http://localhost:${LAB_PORT}`));
  const fd = openSync(join(dir, 'out.json'), 'w');
  await new Promise((resolve, reject) => {
    const child = spawn(P('node_modules/.bin/httpyac'), ['send', 'send.http', '--all', '--json'], { cwd: dir, stdio: ['ignore', fd, 'inherit'] });
    child.on('error', reject);
    child.on('exit', resolve);
  });
  closeSync(fd);
  const parse = (text) => {
    try { return JSON.parse(text); } catch { return text; }
  };
  return JSON.parse(read(join(dir, 'out.json'))).requests.map((r) => ({ title: r.title, status: r.response?.statusCode, body: parse(r.response?.body), rawBody: r.response?.body }));
};

/** 수업 백엔드 — 실습 커밋의 학생 파일 그대로(로그인만 쓴다). */
let api;
beforeAll(async () => {
  await dropDb();
  await admin((client) => client.query(`CREATE DATABASE ${DB}`));
  const dir = studentCopy('homework2');
  const client = new pg.Client({ ...ADMIN, database: DB });
  await client.connect();
  for (const name of readdirSync(join(dir, 'prisma/migrations')).filter((n) => n !== 'migration_lock.toml').sort()) {
    await client.query(read(join(dir, `prisma/migrations/${name}/migration.sql`)));
  }
  await client.end();
  const childEnv = { ...process.env, DATABASE_URL: ENV.DATABASE_URL };
  delete childEnv.NODE_ENV;
  execFileSync(process.execPath, [join(dir, 'seed.js')], { cwd: dir, env: childEnv });
  api = await boot(join(dir, 'app.js'), { port: API_PORT, cwd: dir, env: { ...ENV, PORT: String(API_PORT) }, ready: `${API_PORT}번 포트에서` });
}, 120_000);

afterAll(async () => {
  if (api) await Promise.race([api.stop(), sleep(500)]);
  await dropDb();
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  if (process.env.P354_LAB_SEEN) writeFileSync(process.env.P354_LAB_SEEN, JSON.stringify(seen, null, 2));
});

/** 실습 서버 하나를 띄워 그 실습의 .http 를 위에서부터 보낸다. */
const runLab = async (which, edit) => {
  const dir = studentCopy(which, edit);
  onPort(dir, which, LAB_PORT);
  const lab = await boot(join(dir, LAB, `${which}.js`), { port: LAB_PORT, cwd: dir, env: ENV, ready: `${LAB_PORT}번 포트에서` });
  try {
    const runs = await httpyac(read(join(dir, LAB, `${which}.http`)));
    await sleep(100);
    return { runs: runs.map(({ title, status, body }) => ({ title, status, body })), log: lab.tail() };
  } finally {
    await Promise.race([lab.stop(), sleep(500)]);
  }
};
/** 실행마다 다른 시각은 지운다. */
const scrub = (runs) => runs.map((r) => {
  const body = structuredClone(r.body);
  if (body?.review?.createdAt) body.review.createdAt = '<createdAt>';
  return { ...r, body };
});
/** 정답 판과 처음 달라지는 요청 — 제목 · 정답 · 틀린 판. */
const firstDiff = (right, wrong) => {
  const [a, b] = [scrub(right), scrub(wrong)];
  const at = a.findIndex((r, i) => JSON.stringify(r) !== JSON.stringify(b[i]));
  return at === -1 ? null : { at, title: a[at].title, right: { status: a[at].status, body: a[at].body }, wrong: { status: b[at].status, body: b[at].body } };
};

// ── 축 ① 나눠 주는 파일 ────────────────────────────────────────────────────────────
describe('축 ① 나눠 주는 파일', () => {
  it('🔴 shop-data.js — p3-53 판에서 사람 2번이 jaehoon · 상품에 sellerId · reviewCount · 6 의 글쓴이 sujin · 9 는 jaehoon 이 8 을 한 번 더 올려 숨긴 것 · reviewCount = 숨기지 않은 리뷰 수', async () => {
    const at = commitOf(COMMITS.practice1);
    const data = await import(join(studentCopy('practice1'), LAB, 'shop-data.js'));
    const before = await import(join(studentCopy('practice1'), 'lab/p3-53/shop-data.js'));
    expect(data.users).toEqual(before.users.map((u) => (u.id === 2 ? { id: 2, username: 'jaehoon' } : u)));
    expect(data.products).toEqual([
      { id: 1, name: '무선 이어폰', sellerId: 5, reviewCount: 8 },
      { id: 2, name: '텀블러', sellerId: 2, reviewCount: 2 },
      { id: 3, name: '노트북 거치대', sellerId: 4, reviewCount: 0 },
    ]);
    for (const product of data.products) {
      expect([product.id, product.reviewCount]).toEqual([product.id, data.reviews.filter((r) => r.productId === product.id && !r.hidden).length]);
    }
    const changed = data.reviews.filter((r) => JSON.stringify(r) !== JSON.stringify(before.reviews.find((b) => b.id === r.id)));
    expect(changed.map((r) => r.id)).toEqual([6, 9]);
    expect(data.reviews.find((r) => r.id === 6).authorId).toBe(3);
    expect(data.reviews.find((r) => r.id === 9)).toEqual({ id: 9, productId: 1, authorId: 2, content: '한 번 충전하면 일주일 써요', createdAt: '2026-11-05T13:06:00.000Z', hidden: true });
    expect(data.reviews.map((r) => r.id)).toEqual(before.reviews.map((r) => r.id));
    // jaehoon 의 리뷰는 2 · 8 · 9(숨김) — 파는 상품(2)에는 리뷰를 안 썼다
    expect(data.reviews.filter((r) => r.authorId === 2).map((r) => [r.id, r.productId, r.hidden])).toEqual([[2, 1, false], [8, 1, false], [9, 1, true]]);
    // 수업 DB 의 jaehoon 번호도 2(시드가 이름 차례로 넣는다)
    const client = new pg.Client({ ...ADMIN, database: DB });
    await client.connect();
    expect((await client.query("SELECT id FROM users WHERE username = 'jaehoon'")).rows).toEqual([{ id: 2 }]);
    await client.end();
    seen.shopData = showAt(at, `${LAB}/shop-data.js`);
  }, 30_000);

  it('🔴 빈칸 판 — 비운 채로 node --check 를 지난다 · 빈칸 자리 말고는 정답 판과 같다(직접 해보기 1 은 넷 · 2 는 셋) · 경로 주석은 학생 쪽', () => {
    for (const [which, n] of [['practice1', 4], ['practice2', 3]]) {
      const start = read(P(`snapshots/p3-54/${which}-start.js`));
      const answer = showAt(commitOf(COMMITS[which]), `${LAB}/${which}.js`);
      expect(start.split('\n')[0]).toBe(`// ~/instagram-api/${LAB}/${which}.js`);
      execFileSync(process.execPath, ['--check', P(`snapshots/p3-54/${which}-start.js`)]);
      const a = start.split('\n');
      const b = answer.split('\n');
      expect(a.length).toBe(b.length);
      const differ = a.map((line, i) => [line, b[i]]).filter(([x, y]) => x !== y);
      expect(differ.length).toBe(n);
      expect(differ.every(([x]) => x.includes('____'))).toBe(true);
      // 여는 줄을 통째로 비운 칸이 없다
      expect(differ.every(([x]) => x.trim() !== '____')).toBe(true);
      seen[`${which}Start`] = start;
      seen[`${which}Blanks`] = differ;
    }
  });
});

// ── 축 ② 직접 해보기 1 ─────────────────────────────────────────────────────────────
const P1_WRONG = {
  bodyAuthor: swap('createReview(Number(req.params.id), res.locals.userId, req.body.content)', 'createReview(Number(req.params.id), req.body.authorId, req.body.content)'),
  noCount: swap('  const reviewCount = changeReviewCount(product, 1);', '  const reviewCount = product.reviewCount;'),
  noCountInBody: swap('  return { review: toItem(review), reviewCount };', '  return toItem(review);'),
  status200: swap('  res.status(201).json(result);', '  res.status(200).json(result);'),
};
describe('축 ② 직접 해보기 1 — 리뷰 달기', () => {
  let right;
  it('🔴 정답 판 — 로그인 200 · 3번 상품에 리뷰 201 { review: 13번 · 글쓴이 jaehoon(본문의 authorId 1 은 무시) , reviewCount: 1 } · 공백만 400 · 없는 상품 404', async () => {
    right = (await runLab('practice1')).runs;
    expect(right.map((r) => [r.title, r.status])).toEqual([
      ['jaehoon으로 로그인 — 수업 백엔드', 200], ['3번 상품에 리뷰 달기', 201], ['공백만 보낸 리뷰', 400], ['없는 상품에 리뷰 달기', 404],
    ]);
    expect(right[1].body).toEqual({ review: { id: 13, authorId: 2, content: '높이를 바꿀 수 있어서 목이 편해요', createdAt: expect.stringMatching(/^\d{4}-\d\d-\d\dT/), username: 'jaehoon' }, reviewCount: 1 });
    expect(right[2].body).toEqual({ message: '보낸 내용이 규칙에 안 맞아요' });
    expect(right[3].body).toEqual({ message: '그런 상품은 없어요' });
    seen.practice1 = { http: read(P(`${LAB}/practice1.http`)), runs: right };
  }, 40_000);

  it('🔴 틀린 판마다 처음 달라지는 곳 — 모두 «3번 상품에 리뷰 달기»(본문 글쓴이는 500 · 숫자를 안 올리면 reviewCount 0 · 숫자를 안 실으면 리뷰만 · 200) · 빈칸 그대로면 500', async () => {
    const diffs = {};
    for (const [name, edit] of Object.entries(P1_WRONG)) diffs[name] = firstDiff(right, (await runLab('practice1', edit)).runs);
    const blank = await runLab('practice1', () => read(P('snapshots/p3-54/practice1-start.js')));
    diffs.blank = firstDiff(right, blank.runs);
    seen.practice1Wrong = diffs;
    expect(Object.fromEntries(Object.entries(diffs).map(([k, d]) => [k, [d.title, d.wrong.status]]))).toEqual({
      bodyAuthor: ['3번 상품에 리뷰 달기', 500], noCount: ['3번 상품에 리뷰 달기', 201], noCountInBody: ['3번 상품에 리뷰 달기', 201],
      status200: ['3번 상품에 리뷰 달기', 200], blank: ['3번 상품에 리뷰 달기', 500],
    });
    expect(diffs.noCount.wrong.body.reviewCount).toBe(0);
    expect(Object.keys(diffs.noCountInBody.wrong.body)).toEqual(['id', 'authorId', 'content', 'createdAt', 'username']);
    expect(blank.log).toMatch(/ReferenceError: ____ is not defined/);
  }, 120_000);
});

// ── 축 ③ 직접 해보기 2 ─────────────────────────────────────────────────────────────
const P2_WRONG = {
  idOnly: swap('reviews.find((one) => one.id === reviewId && one.productId === productId)', 'reviews.find((one) => one.id === reviewId)'),
  hiddenToo: swap('changeReviewCount(product, review.hidden ? 0 : -1)', 'changeReviewCount(product, -1)'),
  noPermission: swap('  if (review.authorId !== userId) throw fail(403,', '  if (false) throw fail(403,'),
  sellerToo: swap('  if (review.authorId !== userId) throw fail(403,', '  if (review.authorId !== userId && products.find((item) => item.id === productId).sellerId !== userId) throw fail(403,'),
  noChange: swap('changeReviewCount(product, review.hidden ? 0 : -1)', 'changeReviewCount(product, 0)'),
};
describe('축 ③ 직접 해보기 2 — 리뷰 지우기', () => {
  let right;
  it('🔴 정답 판 — 숨긴 내 리뷰 200(숫자 8 그대로) · 다른 상품 주소 404 · 내 리뷰 200(8 → 7) · 내가 파는 상품에 남이 쓴 리뷰 403 · 남이 쓴 리뷰 403 · 없는 리뷰 404', async () => {
    right = (await runLab('practice2')).runs;
    expect(right.map((r) => [r.title, r.status])).toEqual([
      ['jaehoon으로 로그인 — 수업 백엔드', 200], ['숨긴 내 리뷰 지우기', 200], ['다른 상품 주소로 내 리뷰 지우기', 404], ['내 리뷰 지우기', 200],
      ['내가 파는 상품에 남이 쓴 리뷰 지우기', 403], ['남이 쓴 리뷰 지우기', 403], ['없는 리뷰 지우기', 404],
    ]);
    expect(right[1].body).toEqual({ review: { id: 9, authorId: 2, content: '한 번 충전하면 일주일 써요', createdAt: '2026-11-05T13:06:00.000Z', username: 'jaehoon' }, reviewCount: 8 });
    expect(right[2].body).toEqual({ message: '그런 리뷰는 없어요' });
    expect(right[3].body).toEqual({ review: { id: 8, authorId: 2, content: '한 번 충전하면 일주일 써요', createdAt: '2026-11-05T13:05:00.000Z', username: 'jaehoon' }, reviewCount: 7 });
    expect([right[4].body, right[5].body]).toEqual([{ message: '내가 쓴 리뷰만 지울 수 있어요' }, { message: '내가 쓴 리뷰만 지울 수 있어요' }]);
    expect(right[6].body).toEqual({ message: '그런 리뷰는 없어요' });
    seen.practice2 = { http: read(P(`${LAB}/practice2.http`)), runs: right };
  }, 40_000);

  it('🔴 틀린 판마다 처음 달라지는 곳 — 번호로만은 «다른 상품 주소»(200 · 텀블러 숫자 2 → 1) · 숨긴 것도 내리면 «숨긴 내 리뷰»(7) · 권한 확인 빠짐과 파는 사람도 허락은 «내가 파는 상품에 남이 쓴 리뷰»(200) · 숫자를 안 내리면 «내 리뷰»(8)', async () => {
    const diffs = {};
    for (const [name, edit] of Object.entries(P2_WRONG)) diffs[name] = firstDiff(right, (await runLab('practice2', edit)).runs);
    seen.practice2Wrong = diffs;
    expect(Object.fromEntries(Object.entries(diffs).map(([k, d]) => [k, [d.title, d.wrong.status, d.wrong.body.reviewCount ?? null]]))).toEqual({
      idOnly: ['다른 상품 주소로 내 리뷰 지우기', 200, 1],
      hiddenToo: ['숨긴 내 리뷰 지우기', 200, 7],
      noPermission: ['내가 파는 상품에 남이 쓴 리뷰 지우기', 200, 1],
      sellerToo: ['내가 파는 상품에 남이 쓴 리뷰 지우기', 200, 1],
      noChange: ['내 리뷰 지우기', 200, 8],
    });
    // 권한 확인이 빠진 판은 «남이 쓴 리뷰» 도 200 · 파는 사람도 허락한 판은 거기서 403(1번 상품은 jisoo 가 판다)
    const all = async (edit) => (await runLab('practice2', edit)).runs.map((r) => r.status);
    expect(await all(P2_WRONG.noPermission)).toEqual([200, 200, 404, 200, 200, 200, 404]);
    expect(await all(P2_WRONG.sellerToo)).toEqual([200, 200, 404, 200, 200, 403, 404]);
  }, 180_000);
});

// ── 축 ④ 과제 [응용] ─────────────────────────────────────────────────────────────
const HW_WRONG = {
  alwaysMove: swap('  if (review.hidden !== hidden) amount = hidden ? -1 : 1;', '  amount = hidden ? -1 : 1;'),
  noSeller: swap("  if (product.sellerId !== userId) throw fail(403, '내가 파는 상품의 리뷰만 숨기거나 다시 보일 수 있어요');\n", ''),
  idOnly: swap('reviews.find((one) => one.id === reviewId && one.productId === productId)', 'reviews.find((one) => one.id === reviewId)'),
};
describe('축 ④ 과제 [응용] — 리뷰 숨기기', () => {
  let right;
  it('🔴 정답 판 — 숨기기 2 → 1 · 한 번 더 숨겨도 1 · 다시 보이기 2 · 보이는 리뷰를 보여도 2 · 남이 파는 상품 403 · 다른 상품 주소 404 · hidden 없이 400', async () => {
    right = (await runLab('homework2')).runs;
    expect(right.map((r) => [r.title, r.status, r.body.reviewCount ?? r.body.message ?? null])).toEqual([
      ['jaehoon으로 로그인 — 수업 백엔드', 200, null],
      ['내가 파는 상품의 리뷰 숨기기', 200, 1],
      ['같은 리뷰를 한 번 더 숨기기', 200, 1],
      ['숨긴 리뷰를 다시 보이기', 200, 2],
      ['보이는 리뷰를 다시 보이기', 200, 2],
      ['남이 파는 상품의 리뷰 숨기기', 403, '내가 파는 상품의 리뷰만 숨기거나 다시 보일 수 있어요'],
      ['다른 상품 주소로 리뷰 숨기기', 404, '그런 리뷰는 없어요'],
      ['hidden 없이 보내기', 400, '보낸 내용이 규칙에 안 맞아요'],
    ]);
    expect(right[1].body.review).toEqual({ id: 10, authorId: 1, content: '뚜껑이 조금 뻑뻑해요', createdAt: '2026-11-10T12:45:00.000Z', username: 'yuna', hidden: true });
    seen.homework2 = { http: read(P(`${LAB}/homework2.http`)), runs: right, answer: read(P(`${LAB}/homework2.js`)) };
  }, 40_000);

  it('🔴 틀린 판마다 처음 달라지는 곳 — 늘 ±1 은 «한 번 더 숨기기»(0) · 파는 사람 확인 빠짐은 «남이 파는 상품»(200) · 번호로만은 «다른 상품 주소»(200 · 텀블러 숫자 1)', async () => {
    const diffs = {};
    for (const [name, edit] of Object.entries(HW_WRONG)) diffs[name] = firstDiff(right, (await runLab('homework2', edit)).runs);
    seen.homework2Wrong = diffs;
    expect(Object.fromEntries(Object.entries(diffs).map(([k, d]) => [k, [d.title, d.wrong.status, d.wrong.body.reviewCount ?? null]]))).toEqual({
      alwaysMove: ['같은 리뷰를 한 번 더 숨기기', 200, 0],
      noSeller: ['남이 파는 상품의 리뷰 숨기기', 200, 7],
      idOnly: ['다른 상품 주소로 리뷰 숨기기', 200, 1],
    });
  }, 120_000);
});

// ── 축 ⑤ 학생 파일 차이 · 로그인 ─────────────────────────────────────────────────────
describe('축 ⑤ 학생 파일 차이 · 로그인', () => {
  it('🔴 실습 커밋은 lab/p3-54/ · snapshots/p3-54/ 만 · 첫 줄 경로 주석 · 내부 어휘 · 쓰지 않기로 한 낱말 · 주석의 줄표와 연결어미 뒤 쉼표가 없다', () => {
    const banned = /자리|박다|박아|박힌|결[이을로의]|갈래|몸통|판[이을으]|겹|까닭|걸리|걸린|돌리|돌려(?!주|준|줄)|가르|갈리|재다|재서|벗기|되살|짝/;
    const files = {
      practice1: ['lab/p3-54/practice1.http', 'lab/p3-54/practice1.js', 'lab/p3-54/shop-data.js', 'snapshots/p3-54/practice1-start.js'],
      practice2: ['lab/p3-54/practice2.http', 'lab/p3-54/practice2.js', 'snapshots/p3-54/practice2-start.js'],
      homework2: ['lab/p3-54/homework2.http', 'lab/p3-54/homework2.js'],
    };
    for (const [which, list] of Object.entries(files)) {
      const at = commitOf(COMMITS[which]);
      expect(execFileSync('git', ['diff', '--name-only', `${at}^`, at], { cwd: P('.'), encoding: 'utf8' }).trim().split('\n')).toEqual(list);
      for (const rel of list.filter((r) => r.endsWith('.js'))) {
        const text = showAt(at, rel);
        expect([rel, text.split('\n')[0]]).toEqual([rel, `// ~/instagram-api/${rel.replace('snapshots/p3-54/', 'lab/p3-54/').replace('-start', '')}`]);
        expect([rel, /게이트|판정|TDD|Step \d|p3-\d\d|회차|스냅숏/.test(text.split('\n').slice(1).join('\n'))]).toEqual([rel, false]);
        expect([rel, text.split('\n').filter((line) => banned.test(line))]).toEqual([rel, []]);
        // 주석에 문장 안 줄표(—)와 연결어미 뒤 쉼표가 없다
        expect([rel, text.split('\n').slice(1).filter((line) => /^\s*\/\//.test(line) && /—|(서|고|라|면|는데|지만|니까|으니|므로|어|아),/.test(line))]).toEqual([rel, []]);
      }
    }
  });

  it('🔴 로그인 없이 보내면 세 실습 모두 401 «로그인이 필요해요» · 수업 백엔드의 쿠키가 실습 서버에도 실린다(httpYac)', async () => {
    const out = {};
    for (const which of ['practice1', 'practice2', 'homework2']) {
      const dir = studentCopy(which);
      onPort(dir, which, LAB_PORT);
      const lab = await boot(join(dir, LAB, `${which}.js`), { port: LAB_PORT, cwd: dir, env: ENV, ready: `${LAB_PORT}번 포트에서` });
      try {
        const method = { practice1: 'POST', practice2: 'DELETE', homework2: 'PATCH' }[which];
        const path = { practice1: '/api/products/3/reviews', practice2: '/api/products/1/reviews/8', homework2: '/api/products/2/reviews/10' }[which];
        const res = await fetch(`http://localhost:${LAB_PORT}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: method === 'DELETE' ? undefined : '{"content":"x","hidden":true}' });
        out[which] = [res.status, await res.json()];
      } finally {
        await Promise.race([lab.stop(), sleep(500)]);
      }
    }
    expect(out).toEqual({
      practice1: [401, { message: '로그인이 필요해요' }], practice2: [401, { message: '로그인이 필요해요' }], homework2: [401, { message: '로그인이 필요해요' }],
    });
  }, 60_000);
});

// ── 축 ⑥ 교안 대조(실습 둘) ─────────────────────────────────────────────────────────
// 원고는 읽기만 한다. 경로는 `P354_LECTURE` 로만 받는다(없으면 «건너뜀»). 고칠 곳은 `P354_LAB_LECTURE_REPORT=<파일>` 에 { line, lecture, measured }.
const LECTURE_MD = process.env.P354_LECTURE ?? null;
if (!LECTURE_MD) console.log('\n🚨🚨🚨 실습 축 ⑥ 교안 대조 — 건너뜀 (P354_LECTURE 가 없다) 🚨🚨🚨\n');
const describeLecture = LECTURE_MD ? describe : describe.skip;
const lectureProblems = [];
const problem = (line, lecture, measured) => lectureProblems.push({ line, lecture, measured });
afterAll(() => {
  if (process.env.P354_LAB_LECTURE_REPORT) writeFileSync(process.env.P354_LAB_LECTURE_REPORT, JSON.stringify(lectureProblems, null, 2));
});
const lectureLines = () => read(LECTURE_MD).split('\n');
/** «### 직접 해보기 — …» 절 하나의 줄 범위(다음 ### 🤔 · ## · --- 앞까지). */
const labSection = (title) => {
  const lines = lectureLines();
  const start = lines.findIndex((line) => line.startsWith(`### 직접 해보기 — ${title}`));
  if (start === -1) throw new Error(`«직접 해보기 — ${title}» 절이 없다`);
  let end = lines.findIndex((line, i) => i > start && (/^### 🤔/.test(line) || /^## /.test(line) || line === '---'));
  if (end === -1) end = lines.length;
  return { start, end, lines: lines.slice(start, end) };
};
const fencesIn = ({ start, lines }) => {
  const out = [];
  let cur = null;
  lines.forEach((line, i) => {
    if (cur) { if (line.startsWith('```')) { out.push(cur); cur = null; } else cur.body.push(line); return; }
    if (line.startsWith('```')) cur = { lang: line.slice(3).trim(), body: [], line: start + i + 1 };
  });
  return out;
};
const tablesIn = ({ start, lines }) => {
  const out = [];
  let cur = null;
  let inFence = false;
  const cellsOf = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
  lines.forEach((line, i) => {
    if (line.startsWith('```')) inFence = !inFence;
    if (!inFence && line.startsWith('|')) {
      if (!cur) { cur = { header: cellsOf(line), rows: [], lines: [] }; return; }
      if (/^\|[\s:|-]+\|$/.test(line.trim())) return;
      cur.rows.push(cellsOf(line));
      cur.lines.push(start + i + 1);
      return;
    }
    if (cur) { out.push(cur); cur = null; }
  });
  if (cur) out.push(cur);
  return out;
};
const isElision = (line) => ['// ...', '...'].includes(line.trim());
const inOrder = (body, file) => {
  let at = 0;
  const lines = file.split('\n');
  for (const line of body.filter((one) => one.trim() !== '' && !isElision(one))) {
    const found = lines.indexOf(line, at);
    if (found === -1) return false;
    at = found + 1;
  }
  return true;
};
/** 정답 판 · 틀린 판의 실행 — 앞 축이 잰 것을 쓰고, 없으면 여기서 잰다. */
const runsCache = {};
const runsOf = async (which, name, edit) => (runsCache[`${which}:${name}`] ??= await runLab(which, edit));
const WRONGS = {
  practice1: ['bodyAuthor', 'noCount', 'noCountInBody', 'status200', 'blank'],
  practice2: ['idOnly', 'hiddenToo', 'noChange', 'noPermission', 'sellerToo'],
};
const editOf = (which, name) => {
  if (name === 'blank') return () => read(P('snapshots/p3-54/practice1-start.js'));
  return (which === 'practice1' ? P1_WRONG : P2_WRONG)[name];
};
/** 확인 목록 한 줄 — «제목» · 상태 코드 · reviewCount · message(«…» 둘째) · username. */
const parseCheck = (text) => ({
  title: /«(.+?)»/.exec(text)?.[1],
  status: Number(/(\d{3})/.exec(text.replace(/\(.*?\)/g, ''))?.[1]),
  reviewCount: /`reviewCount`가 (\d+)/.exec(text)?.[1],
  message: [...text.matchAll(/«(.+?)»/g)].map((m) => m[1]).find((one, i) => i > 0),
  username: /`review\.username`이 `"(\w+)"`/.exec(text)?.[1],
});

describeLecture(LECTURE_MD ? '실습 축 ⑥ 교안 대조 — 직접 해보기 1 · 2' : '🚨 건너뜀(P354_LECTURE 없음) — 실습 축 ⑥ 교안 대조', () => {
  for (const [which, title, startFile] of [['practice1', '리뷰 달기', 'practice1-start.js'], ['practice2', '리뷰 지우기', 'practice2-start.js']]) {
    it(`🔴 ${title} — 나눠 주는 빈칸 판은 글자까지 · 해설 발췌는 정답 판에 같은 차례로 있다`, () => {
      const before = lectureProblems.length;
      const fences = fencesIn(labSection(title)).filter((f) => f.lang === 'javascript');
      const [given, answer] = fences;
      if (!given || `${given.body.join('\n')}\n` !== read(P(`snapshots/p3-54/${startFile}`))) problem(given?.line ?? null, `${which} 빈칸 판 블록`, `snapshots/p3-54/${startFile} 와 글자가 다르다`);
      if (!answer || !inOrder(answer.body, showAt(commitOf(COMMITS[which]), `${LAB}/${which}.js`))) problem(answer?.line ?? null, `${which} 해설 발췌`, '정답 판에 같은 차례로 없다');
      expect(fences.length).toBe(2);
      expect(lectureProblems.slice(before)).toEqual([]);
    });

    it(`🔴 ${title} — 확인 문장(상태 · reviewCount · 문장 · 글쓴이)이 정답 판 실행과 같다`, async () => {
      const before = lectureProblems.length;
      const sec = labSection(title);
      const right = (await runsOf(which, 'right')).runs;
      const checkLines = sec.lines.map((line, i) => [sec.start + i + 1, line]).filter(([, line]) => /^\d+\. «/.test(line));
      expect(checkLines.length).toBe(right.length - 1);
      for (const [line, text] of checkLines) {
        const c = parseCheck(text);
        const run = right.find((r) => r.title === c.title);
        if (!run) { problem(line, text, '그런 제목의 요청이 .http 에 없다'); continue; }
        const got = [run.status, run.body.reviewCount, run.body.message, run.body.review?.username];
        const said = [c.status, c.reviewCount === undefined ? run.body.reviewCount : Number(c.reviewCount), c.message ?? run.body.message, c.username ?? run.body.review?.username];
        if (JSON.stringify(said) !== JSON.stringify(got)) problem(line, text, `${run.status} · reviewCount ${run.body.reviewCount} · ${run.body.message ?? ''} · ${run.body.review?.username ?? ''}`);
      }
      expect(lectureProblems.slice(before)).toEqual([]);
    }, 60_000);

    it(`🔴 ${title} — 해설 표 «처음 달라지는 곳» 이 틀린 판마다 실측과 같다`, async () => {
      const before = lectureProblems.length;
      const sec = labSection(title);
      const right = (await runsOf(which, 'right')).runs;
      const checkTitles = sec.lines.filter((line) => /^\d+\. «/.test(line)).map((line) => /«(.+?)»/.exec(line)[1]);
      const table = tablesIn(sec).find((t) => t.header[0] === '이렇게 쓰면');
      expect(table.rows.length).toBe(WRONGS[which].length);
      for (const [i, name] of WRONGS[which].entries()) {
        const wrongRun = await runsOf(which, name, editOf(which, name));
        const d = firstDiff(right, wrongRun.runs);
        const text = table.rows[i][1];
        const pairs = [...text.matchAll(/확인 (\d)[^·]*?(\d{3})/g)].map((m) => [Number(m[1]), Number(m[2])]);
        const firstNo = Number(/확인 (\d)/.exec(text)?.[1]);
        const okTitle = checkTitles[firstNo - 1] === d?.title;
        const okPairs = pairs.every(([no, status]) => wrongRun.runs[no]?.status === status);
        const rc = /`reviewCount`가 (?:\d+에서 )?(\d+)/.exec(text)?.[1];
        const okCount = rc === undefined || Number(rc) === d?.wrong.body.reviewCount;
        const okMissing = !/`reviewCount`가 없어요/.test(text) || (d && !('reviewCount' in d.wrong.body));
        const okLog = !/ReferenceError/.test(text) || /ReferenceError: ____ is not defined/.test(wrongRun.log);
        const okMessage = !/«서버에서 문제가 생겼어요»/.test(text) || d?.wrong.body.message === '서버에서 문제가 생겼어요';
        if (!(okTitle && okPairs && okCount && okMissing && okLog && okMessage)) {
          problem(table.lines[i], `${table.rows[i][0]} → ${text}`, `처음 달라지는 곳 «${d?.title}»(확인 ${checkTitles.indexOf(d?.title) + 1}) · ${d?.wrong.status} · reviewCount ${d?.wrong.body.reviewCount} · 전체 상태 ${wrongRun.runs.slice(1).map((r) => r.status).join(' ')}`);
        }
      }
      expect(lectureProblems.slice(before)).toEqual([]);
    }, 240_000);
  }

  it('🔴 과제 [응용] 리뷰 숨기기 — 확인 문장 일곱(상태 · review.hidden · reviewCount · 문장)과 요구사항의 에러 문장 셋(상태 · 문장)이 정답 판 실행과 같다 · review 에 hidden 이 실린다', async () => {
    const before = lectureProblems.length;
    const lines = lectureLines();
    const start = lines.findIndex((line) => line.startsWith('### [응용] 리뷰 숨기기'));
    expect(start).toBeGreaterThan(-1);
    let end = lines.findIndex((line, i) => i > start && (line === '---' || /^##{1,2} /.test(line)));
    if (end === -1) end = lines.length;
    const sec = lines.slice(start, end).map((text, i) => [start + i + 1, text]);
    const at = (label) => sec.findIndex(([, text]) => text.trim() === label);
    const reqs = sec.slice(at('**요구사항**'), at('**확인**')).filter(([, text]) => /^\d+\. /.test(text));
    const checks = sec.slice(at('**확인**')).filter(([, text]) => /^\d+\. «/.test(text));
    const right = (await runsOf('homework2', 'right')).runs;
    expect([reqs.length, checks.length, right.length - 1]).toEqual([5, 7, 7]);
    // 확인 일곱
    for (const [line, text] of checks) {
      const c = parseCheck(text);
      const run = right.find((r) => r.title === c.title);
      if (!run) { problem(line, text, '그런 제목의 요청이 homework2.http 에 없다'); continue; }
      const hidden = /`review\.hidden`이 `(true|false)`/.exec(text)?.[1];
      const said = [Number.isNaN(c.status) ? run.status : c.status, c.reviewCount === undefined ? run.body.reviewCount : Number(c.reviewCount), c.message ?? run.body.message, hidden === undefined ? run.body.review?.hidden : hidden === 'true'];
      const got = [run.status, run.body.reviewCount, run.body.message, run.body.review?.hidden];
      if (JSON.stringify(said) !== JSON.stringify(got)) problem(line, text, `${run.status} · reviewCount ${run.body.reviewCount ?? ''} · ${run.body.message ?? ''} · hidden ${run.body.review?.hidden ?? ''}`);
    }
    // 요구사항의 에러 문장 셋 — 상태 코드와 «문장» 이 그 상태로 답한 요청의 실제 문장과 같다
    const errors = reqs.map(([line, text]) => [line, text, /(\d{3}) «(.+?)»/.exec(text)]).filter(([, , m]) => m);
    expect(errors.length).toBe(3);
    for (const [line, text, m] of errors) {
      const run = right.find((r) => r.status === Number(m[1]));
      if (!run || run.body.message !== m[2]) problem(line, text, run ? `${run.status} «${run.body.message}»` : `${m[1]} 으로 답한 요청이 없다`);
    }
    // 요구사항 5 — 200 과 { review, reviewCount } · review 에 hidden
    const ok = right.filter((r) => r.status === 200 && r.body.review);
    if (!ok.every((r) => Object.keys(r.body).join(',') === 'review,reviewCount' && typeof r.body.review.hidden === 'boolean')) problem(reqs[4][0], reqs[4][1], JSON.stringify(ok.map((r) => Object.keys(r.body))));
    expect(lectureProblems.slice(before)).toEqual([]);
  }, 60_000);

  it('🔴 산문 — 나눠 주는 데이터 · jaehoon 의 리뷰 · 다시 띄우지 않고 한 번 더 보내면 reviewCount 2', async () => {
    const before = lectureProblems.length;
    const data = await import(join(studentCopy('practice1'), LAB, 'shop-data.js'));
    const lines = lectureLines();
    const find = (re) => {
      const at = lines.findIndex((line) => re.test(line));
      return at === -1 ? null : { line: at + 1, text: lines[at], m: re.exec(lines[at]) };
    };
    const claims = [
      [/사람 (\d+)명 · 상품 (\d+)개 · 리뷰 (\d+)개 — 2번 사람이 (\w+)이고, \w+은 텀블러\((\d)번 상품\)를 팔아요/, (m) => [`${m[1]} · ${m[2]} · ${m[3]} · ${m[4]} · ${m[5]}`, `${data.users.length} · ${data.products.length} · ${data.reviews.length} · ${data.users.find((u) => u.id === 2).username} · ${data.products.find((p) => p.sellerId === 2).id}`]],
      // 번호 목록(«2번 · 8번» 처럼 « · » 나 «과» 로 이은 것) + 숨긴 N번
      [/jaehoon이 쓴 리뷰는 무선 이어폰\(1번 상품\)의 ((?:\d+번(?: · |, )?)+)과 숨긴 (\d+)번이고, jaehoon이 파는 상품은 텀블러\((\d)번 상품\)/, (m) => [`${[...m[1].matchAll(/(\d+)번/g)].map((n) => n[1]).join(',')} · 숨김 ${m[2]} · ${m[3]}`, `${data.reviews.filter((r) => r.authorId === 2 && !r.hidden).map((r) => r.id).join(',')} · 숨김 ${data.reviews.filter((r) => r.authorId === 2 && r.hidden).map((r) => r.id).join(',')} · ${data.products.find((p) => p.sellerId === 2).id}`]],
      [/서버를 다시 띄우지 않고 확인 1을 한 번 더 보내면 `reviewCount`가 (\d+)가 돼요/, async (m) => {
        const dir = studentCopy('practice1');
        onPort(dir, 'practice1', LAB_PORT);
        const http = read(join(dir, LAB, 'practice1.http'));
        const blocks = http.split(/^### /m).slice(1).map((b) => `### ${b.trimEnd()}\n`);
        const lab = await boot(join(dir, LAB, 'practice1.js'), { port: LAB_PORT, cwd: dir, env: ENV, ready: `${LAB_PORT}번 포트에서` });
        try {
          const runs = await httpyac([blocks[0], blocks[1], blocks[1]].join('\n'));
          return [m[1], `${runs[2].body.reviewCount}`];
        } finally {
          await Promise.race([lab.stop(), sleep(500)]);
        }
      }],
    ];
    for (const [re, measure] of claims) {
      const hit = find(re);
      if (!hit) { problem(null, `꼴 ${re}`, '교안에서 못 찾았다'); continue; }
      const [said, got] = await measure(hit.m);
      if (said !== got) problem(hit.line, hit.text.trim(), got);
    }
    expect(lectureProblems.slice(before)).toEqual([]);
  }, 60_000);
});
