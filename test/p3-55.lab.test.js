// p3-55 「대댓글」 게이트 — 백엔드 실습(직접 해보기 1 · 2 · 과제 [응용])
// 내부 검증 전용 — 교안에 한 줄도 인용하지 않는다.
//
// 소재는 상품 리뷰(p3-53 · p3-54 실습 이어서) — 메모리 배열(lab/p3-55/shop-data.js)로 답하는 Express 실습 서버다(데이터베이스를 안 쓴다).
// 리뷰와 «판매자 답변» 이 한 배열에 있고 답변은 parentId 에 리뷰 번호가 든다(수업의 comments 와 같은 자기 참조 꼴).
// 직접 해보기 1(답변 목록)과 과제 [응용](리뷰 목록의 replyCount)은 로그인이 없다. 직접 해보기 2(답변 달기)는 p3-54 처럼 수업 백엔드의 requireLogin 을 불러 쓴다.
// 판정은 수업 백엔드를 3972 에, 실습 서버를 3973 에 띄운다 — 실습 사본은 포트 두 곳(app.listen 의 수 · 기다린다는 문장)만 바꾼다.
// 판정 DB 는 `p355_api_lab` 하나(실습 커밋의 마이그레이션 + 시드 — 로그인에 jaehoon 의 비밀번호만 있으면 된다).
// 커밋 — 제목 끝이 «(직접 해보기 1)» · «(직접 해보기 2)» · «(과제 [응용])» 인 feat(p3-55) 커밋.
// 나눠 주는 빈칸 판은 snapshots/p3-55/practice1-start.js · practice2-start.js(경로 주석은 학생 쪽 표기 그대로).
//
// 축 ① 나눠 주는 파일 — shop-data.js(p3-54 판에 parentId · 답변 여섯 · reviewCount 그대로 · 답변은 파는 사람이 썼다) · 빈칸 판이 비운 채로 node --check · 빈칸 자리 말고는 정답 판과 같다
// 축 ② 직접 해보기 1 — 정답 판 · 틀린 판(번호로만 · 답변 확인 빠짐 · 상품으로 거름 · 기본 20 · 정렬 빠짐 · 번호 비교 빠짐 · 커서 시각만 · 빈칸 그대로) × practice1.http
// 축 ③ 직접 해보기 2 — 정답 판 · 틀린 판(번호로만 · 답변의 답변 허락 · 파는 사람 확인 빠짐 · 답변도 숫자 +1 · 빈칸 그대로) × practice2.http · 로그인 없이 401
// 축 ④ 과제 [응용] — 정답 판 · 틀린 판(답변도 목록에 · 상품의 답변 전부를 셈 · 숨긴 리뷰도 · replyCount 빠짐) × homework2.http
// 축 ⑤ 학생 파일 차이 — 실습 커밋은 lab/p3-55/ · snapshots/p3-55/ 만 · 경로 주석 · 쓰지 않기로 한 낱말
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
const LAB = 'lab/p3-55';
const STUDENT_PORT = 4001;
const API_PORT = 3972;
const LAB_PORT = 3973;
const PG_PORT = Number(process.env.P355_PG_PORT ?? 5432);
const ADMIN = { host: 'localhost', port: PG_PORT, database: 'postgres', user: 'postgres', password: 'postgres' };
const DB = 'p355_api_lab';
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
const LINE = process.env.P355_LINE ?? (hasRef('refs/heads/code/p3-55') ? 'code/p3-55' : 'HEAD');
/** 제목 끝 표식으로 커밋 하나 — 같은 표식이 여럿이면 가장 뒤 커밋. */
const commitOf = (mark) => {
  const log = execFileSync('git', ['log', '-n', '400', '--format=%H %s', LINE], { cwd: P('.'), encoding: 'utf8' });
  const hit = log.split('\n').find((l) => / feat\(p3-55\): /.test(l) && l.endsWith(`(${mark})`));
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
const studentCopy = (which, edit, dataEdit) => {
  const dir = mkdtempSync(join(tmpdir(), 'p355-lab-'));
  dirs.push(dir);
  const tar = execFileSync('git', ['archive', '--format=tar', commitOf(COMMITS[which])], { cwd: P('.'), maxBuffer: 1 << 28 });
  execFileSync('tar', ['-x', '-C', dir], { input: tar });
  // 나눠 주는 데이터는 직접 해보기 1 에서 한 번 받는다
  writeFileSync(join(dir, LAB, 'shop-data.js'), showAt(commitOf(COMMITS.practice1), `${LAB}/shop-data.js`));
  // 확인이 학생에게 shop-data.js 를 잠깐 고쳐 보게 하는 장면(과제 [응용] 확인 5)
  if (dataEdit) writeFileSync(join(dir, LAB, 'shop-data.js'), dataEdit(read(join(dir, LAB, 'shop-data.js'))));
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
  const dir = mkdtempSync(join(tmpdir(), 'p355-labhttp-'));
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
  return JSON.parse(read(join(dir, 'out.json'))).requests.map((r) => ({ title: r.title, status: r.response?.statusCode ?? null, body: parse(r.response?.body) ?? null }));
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
  if (process.env.P355_LAB_SEEN) writeFileSync(process.env.P355_LAB_SEEN, JSON.stringify(seen, null, 2));
});

/** 실습 서버 하나를 띄워 그 실습의 .http 를 위에서부터 보낸다. */
const runLab = async (which, edit, dataEdit) => {
  const dir = studentCopy(which, edit, dataEdit);
  onPort(dir, which, LAB_PORT);
  const lab = await boot(join(dir, LAB, `${which}.js`), { port: LAB_PORT, cwd: dir, env: ENV, ready: `${LAB_PORT}번 포트에서` });
  try {
    const runs = await httpyac(read(join(dir, LAB, `${which}.http`)));
    await sleep(100);
    return { runs, log: lab.tail() };
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
const brief = (diffs) => Object.fromEntries(Object.entries(diffs).map(([k, d]) => [k, d === null ? null : [d.title, d.wrong.status]]));
const itemIds = (r) => r.body.items.map((x) => x.id);

// ── 축 ① 나눠 주는 파일 ────────────────────────────────────────────────────────────
describe('축 ① 나눠 주는 파일', () => {
  it('🔴 shop-data.js — p3-54 판의 리뷰마다 parentId: null · 답변 여섯(13 · 16 · 14 · 15 → 1번 리뷰 · 17 → 5번 · 18 → 6번) · 답변은 그 상품을 파는 사람이 썼다 · reviewCount 는 그대로(숨기지 않은 리뷰 수 · 답변은 안 센다)', async () => {
    const data = await import(join(studentCopy('practice1'), LAB, 'shop-data.js'));
    const before = await import(join(studentCopy('practice1'), 'lab/p3-54/shop-data.js'));
    expect(data.users).toEqual(before.users);
    expect(data.products).toEqual(before.products);
    const roots = data.reviews.filter((r) => r.parentId === null);
    expect(roots).toEqual(before.reviews.map((r) => ({ id: r.id, productId: r.productId, parentId: null, ...Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'id' && k !== 'productId')) })));
    const answers = data.reviews.filter((r) => r.parentId !== null);
    expect(answers.map((r) => [r.id, r.parentId, r.productId, r.createdAt])).toEqual([
      [13, 1, 1, '2026-11-02T10:00:00.000Z'], [16, 1, 1, '2026-11-02T10:05:00.000Z'], [14, 1, 1, '2026-11-02T10:02:00.000Z'],
      [15, 1, 1, '2026-11-02T10:05:00.000Z'], [17, 5, 1, '2026-11-04T09:00:00.000Z'], [18, 6, 2, '2026-11-04T12:00:00.000Z'],
    ]);
    for (const a of answers) {
      const parent = data.reviews.find((r) => r.id === a.parentId);
      expect([a.id, parent.productId, parent.parentId, a.hidden, a.authorId]).toEqual([a.id, a.productId, null, false, data.products.find((p) => p.id === a.productId).sellerId]);
    }
    for (const product of data.products) {
      expect([product.id, product.reviewCount]).toEqual([product.id, roots.filter((r) => r.productId === product.id && !r.hidden).length]);
    }
    seen.shopData = showAt(commitOf(COMMITS.practice1), `${LAB}/shop-data.js`);
  }, 30_000);

  it('🔴 빈칸 판 — 비운 채로 node --check 를 지난다 · 빈칸 자리 말고는 정답 판과 같다(직접 해보기 1 은 다섯 · 2 는 넷) · 경로 주석은 학생 쪽', () => {
    for (const [which, n] of [['practice1', 5], ['practice2', 4]]) {
      const start = read(P(`snapshots/p3-55/${which}-start.js`));
      const answer = showAt(commitOf(COMMITS[which]), `${LAB}/${which}.js`);
      expect(start.split('\n')[0]).toBe(`// ~/instagram-api/${LAB}/${which}.js`);
      execFileSync(process.execPath, ['--check', P(`snapshots/p3-55/${which}-start.js`)]);
      const a = start.split('\n');
      const b = answer.split('\n');
      expect(a.length).toBe(b.length);
      const differ = a.map((line, i) => [line, b[i]]).filter(([x, y]) => x !== y);
      expect(differ.length).toBe(n);
      expect(differ.every(([x]) => x.split('____').length === 2)).toBe(true);
      expect(differ.every(([x]) => x.trim() !== '____')).toBe(true);
      seen[`${which}Start`] = start;
      seen[`${which}Blanks`] = differ;
    }
  });
});

// ── 축 ② 직접 해보기 1 ─────────────────────────────────────────────────────────────
const P1_TITLES = ['1번 리뷰에 달린 답변 — 첫 페이지', '1번 리뷰에 달린 답변 — 둘째 페이지', '답변이 없는 리뷰', '다른 상품 주소로 1번 리뷰의 답변', '답변 번호로 물으면', '없는 리뷰의 답변'];
const P1_WRONG = {
  idOnly: swap('reviews.find((one) => one.id === reviewId && one.productId === productId)', 'reviews.find((one) => one.id === reviewId)'),
  noParentCheck: swap("  if (review.parentId !== null) throw fail(400, '답변에는 답변이 없어요');\n", ''),
  byProduct: swap('reviews.filter((one) => one.parentId === reviewId)', 'reviews.filter((one) => one.productId === productId && one.parentId !== null)'),
  limit20: swap('{ limit = 3, cursor }', '{ limit = 20, cursor }'),
  noSort: swap('reviews.filter((one) => one.parentId === reviewId).sort(byOldest)', 'reviews.filter((one) => one.parentId === reviewId)'),
  noTieBreak: swap('  return a.id - b.id;\n', '  return 0;\n'),
  timeOnlyCursor: swap('review.createdAt >= createdAt && (review.createdAt > createdAt || review.id > id)', 'review.createdAt > createdAt'),
};
describe('축 ② 직접 해보기 1 — 답변 목록', () => {
  let right;
  it('🔴 정답 판 — 첫 페이지 13 · 14 · 15(3개 · hasNext) → 커서로 16 · 답변이 없는 리뷰 [] · 다른 상품 주소 404 · 답변 번호 400 · 없는 리뷰 404', async () => {
    right = (await runLab('practice1')).runs;
    expect(right.map((r) => [r.title, r.status])).toEqual(P1_TITLES.map((t, i) => [t, [200, 200, 200, 404, 400, 404][i]]));
    expect(right[0].body.items).toEqual([
      { id: 13, authorId: 5, content: '좋게 봐 주셔서 고마워요', createdAt: '2026-11-02T10:00:00.000Z', username: 'jisoo' },
      { id: 14, authorId: 5, content: '케이스 색은 두 가지예요', createdAt: '2026-11-02T10:02:00.000Z', username: 'jisoo' },
      { id: 15, authorId: 5, content: '이어팁은 세 가지 크기가 들어 있어요', createdAt: '2026-11-02T10:05:00.000Z', username: 'jisoo' },
    ]);
    expect([right[0].body.hasNext, JSON.parse(Buffer.from(right[0].body.nextCursor, 'base64url').toString())]).toEqual([true, { createdAt: '2026-11-02T10:05:00.000Z', id: 15 }]);
    expect(right[1].body).toEqual({ items: [{ id: 16, authorId: 5, content: '충전 케이스도 따로 팔아요', createdAt: '2026-11-02T10:05:00.000Z', username: 'jisoo' }], hasNext: false, nextCursor: null });
    expect(right[2].body).toEqual({ items: [], hasNext: false, nextCursor: null });
    expect([right[3].body, right[4].body, right[5].body]).toEqual([{ message: '그런 리뷰는 없어요' }, { message: '답변에는 답변이 없어요' }, { message: '그런 리뷰는 없어요' }]);
    seen.practice1 = { http: read(P(`${LAB}/practice1.http`)), runs: right };
  }, 40_000);

  it('🔴 틀린 판마다 처음 달라지는 곳 — 번호로만은 «다른 상품 주소»(200) · 답변 확인 빠짐은 «답변 번호»(200 []) · 상품으로 거르면 둘째 페이지(5번 리뷰의 답변 17이 끼어든다) · 기본 20 · 정렬 빠짐 · 번호 비교 빠짐은 첫 페이지 · 커서를 시각만 보면 둘째 페이지(16이 빠진다) · 빈칸 그대로면 500', async () => {
    const diffs = {};
    const wrongRuns = {};
    for (const [name, edit] of Object.entries(P1_WRONG)) {
      wrongRuns[name] = (await runLab('practice1', edit)).runs;
      diffs[name] = firstDiff(right, wrongRuns[name]);
    }
    const blank = await runLab('practice1', () => read(P('snapshots/p3-55/practice1-start.js')));
    diffs.blank = firstDiff(right, blank.runs);
    seen.practice1Wrong = diffs;
    expect(brief(diffs)).toEqual({
      idOnly: ['다른 상품 주소로 1번 리뷰의 답변', 200],
      noParentCheck: ['답변 번호로 물으면', 200],
      byProduct: ['1번 리뷰에 달린 답변 — 둘째 페이지', 200],
      limit20: ['1번 리뷰에 달린 답변 — 첫 페이지', 200],
      noSort: ['1번 리뷰에 달린 답변 — 첫 페이지', 200],
      noTieBreak: ['1번 리뷰에 달린 답변 — 첫 페이지', 200],
      timeOnlyCursor: ['1번 리뷰에 달린 답변 — 둘째 페이지', 200],
      blank: ['1번 리뷰에 달린 답변 — 첫 페이지', 500],
    });
    expect(itemIds(diffs.idOnly.wrong)).toEqual([13, 14, 15]);
    expect(diffs.noParentCheck.wrong.body).toEqual({ items: [], hasNext: false, nextCursor: null });
    expect(itemIds(diffs.limit20.wrong)).toEqual([13, 14, 15, 16]);
    expect(itemIds(diffs.noSort.wrong)).toEqual([13, 16, 14]);
    expect(itemIds(diffs.noTieBreak.wrong)).toEqual([13, 14, 16]);
    expect(diffs.timeOnlyCursor.wrong.body.items).toEqual([]);
    expect(itemIds({ body: wrongRuns.byProduct[0].body })).toEqual([13, 14, 15]);
    expect(wrongRuns.byProduct[1].body.items.map((x) => x.id)).toEqual([16, 17]);
    expect(blank.log).toMatch(/ReferenceError: ____ is not defined/);
  }, 180_000);
});

// ── 축 ③ 직접 해보기 2 ─────────────────────────────────────────────────────────────
const P2_WRONG = {
  idOnly: swap('reviews.find((one) => one.id === parentId && one.productId === productId)', 'reviews.find((one) => one.id === parentId)'),
  answerOfAnswer: swap("    if (parent.parentId !== null) throw fail(400, '답변에는 답변을 달 수 없어요');\n", ''),
  noSeller: swap("    if (product.sellerId !== userId) throw fail(403, '내가 파는 상품의 리뷰에만 답변을 달 수 있어요');\n", ''),
  countAnswers: swap('changeReviewCount(product, parentId === undefined ? 1 : 0)', 'changeReviewCount(product, 1)'),
};
describe('축 ③ 직접 해보기 2 — 답변 달기', () => {
  let right;
  it('🔴 정답 판 — 로그인 200 · 10번 리뷰에 답변 201 { review: 19번 · jaehoon , reviewCount: 2 그대로 } · 답변(18)에 400 · 다른 상품 주소 404 · 남이 파는 상품 403 · 3번 상품에 리뷰 201(0 → 1)', async () => {
    right = (await runLab('practice2')).runs;
    expect(right.map((r) => [r.title, r.status])).toEqual([
      ['jaehoon으로 로그인 — 수업 백엔드', 200], ['10번 리뷰에 답변 달기', 201], ['답변에 답변 달기', 400], ['다른 상품 주소로 답변 달기', 404],
      ['남이 파는 상품의 리뷰에 답변 달기', 403], ['3번 상품에 리뷰 달기', 201],
    ]);
    expect(right[1].body).toEqual({ review: { id: 19, authorId: 2, content: '쓰다 보면 조금씩 부드러워져요', createdAt: expect.stringMatching(/^\d{4}-\d\d-\d\dT/), username: 'jaehoon' }, reviewCount: 2 });
    expect([right[2].body, right[3].body, right[4].body]).toEqual([
      { message: '답변에는 답변을 달 수 없어요' }, { message: '그런 리뷰는 없어요' }, { message: '내가 파는 상품의 리뷰에만 답변을 달 수 있어요' },
    ]);
    expect(right[5].body).toMatchObject({ review: { id: 20, username: 'jaehoon' }, reviewCount: 1 });
    seen.practice2 = { http: read(P(`${LAB}/practice2.http`)), runs: right };
  }, 40_000);

  it('🔴 틀린 판마다 처음 달라지는 곳 — 번호로만은 «다른 상품 주소»(403 — 1번 상품은 jisoo 가 판다) · 답변의 답변을 허락하면 «답변에 답변»(201) · 파는 사람 확인 빠짐은 «남이 파는 상품»(201) · 답변도 세면 첫 답변의 reviewCount 3 · 빈칸 그대로면 500', async () => {
    const diffs = {};
    for (const [name, edit] of Object.entries(P2_WRONG)) diffs[name] = firstDiff(right, (await runLab('practice2', edit)).runs);
    const blank = await runLab('practice2', () => read(P('snapshots/p3-55/practice2-start.js')));
    diffs.blank = firstDiff(right, blank.runs);
    seen.practice2Wrong = diffs;
    expect(brief(diffs)).toEqual({
      idOnly: ['다른 상품 주소로 답변 달기', 403],
      answerOfAnswer: ['답변에 답변 달기', 201],
      noSeller: ['남이 파는 상품의 리뷰에 답변 달기', 201],
      countAnswers: ['10번 리뷰에 답변 달기', 201],
      blank: ['10번 리뷰에 답변 달기', 500],
    });
    expect(diffs.countAnswers.wrong.body.reviewCount).toBe(3);
    expect(blank.log).toMatch(/ReferenceError: ____ is not defined/);
  }, 180_000);

  it('🔴 로그인 없이 보내면 401 «로그인이 필요해요»', async () => {
    const dir = studentCopy('practice2');
    onPort(dir, 'practice2', LAB_PORT);
    const lab = await boot(join(dir, LAB, 'practice2.js'), { port: LAB_PORT, cwd: dir, env: ENV, ready: `${LAB_PORT}번 포트에서` });
    try {
      const res = await fetch(`http://localhost:${LAB_PORT}/api/products/2/reviews`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"content":"x","parentId":10}' });
      expect([res.status, await res.json()]).toEqual([401, { message: '로그인이 필요해요' }]);
    } finally {
      await Promise.race([lab.stop(), sleep(500)]);
    }
  }, 30_000);
});

// ── 축 ④ 과제 [응용] ─────────────────────────────────────────────────────────────
const HW_WRONG = {
  answersListed: swap(' && review.parentId === null && !review.hidden)', ' && !review.hidden)'),
  productAnswers: swap('reviews.filter((one) => one.parentId === review.id).length', 'reviews.filter((one) => one.productId === review.productId && one.parentId !== null).length'),
  hiddenToo: swap(' && review.parentId === null && !review.hidden)', ' && review.parentId === null)'),
  noReplyCount: swap('    replyCount: reviews.filter((one) => one.parentId === review.id).length,\n', ''),
};
describe('축 ④ 과제 [응용] — 리뷰 목록의 replyCount', () => {
  let right;
  it('🔴 정답 판 — 1번 상품 여덟(1 · 2 · 4 · 5 · 7 · 8 · 11 · 12 · replyCount 4 · 0 · 0 · 1 · 0 …) · 2번 상품 둘(6 → 1 · 10 → 0) · 리뷰가 없는 상품 [] · 없는 상품 404', async () => {
    right = (await runLab('homework2')).runs;
    expect(right.map((r) => [r.title, r.status])).toEqual([['1번 상품의 리뷰', 200], ['2번 상품의 리뷰', 200], ['리뷰가 없는 상품의 리뷰', 200], ['없는 상품의 리뷰', 404]]);
    expect(right[0].body.map((r) => [r.id, r.replyCount])).toEqual([[1, 4], [2, 0], [4, 0], [5, 1], [7, 0], [8, 0], [11, 0], [12, 0]]);
    expect(right[1].body.map((r) => [r.id, r.replyCount])).toEqual([[6, 1], [10, 0]]);
    expect(Object.keys(right[0].body[0])).toEqual(['id', 'authorId', 'content', 'createdAt', 'username', 'replyCount']);
    expect([right[2].body, right[3].body]).toEqual([[], { message: '그런 상품은 없어요' }]);
    seen.homework2 = { http: read(P(`${LAB}/homework2.http`)), runs: right, answer: read(P(`${LAB}/homework2.js`)) };
  }, 40_000);

  it('🔴 틀린 판마다 처음 달라지는 곳 — 모두 «1번 상품의 리뷰»(답변이 끼어든다 · 상품의 답변 전부 5 · 숨긴 리뷰 3 · replyCount 없음)', async () => {
    const diffs = {};
    for (const [name, edit] of Object.entries(HW_WRONG)) diffs[name] = firstDiff(right, (await runLab('homework2', edit)).runs);
    seen.homework2Wrong = diffs;
    expect(brief(diffs)).toEqual(Object.fromEntries(Object.keys(HW_WRONG).map((k) => [k, ['1번 상품의 리뷰', 200]])));
    expect(diffs.answersListed.wrong.body.map((r) => r.id)).toEqual([1, 13, 14, 15, 16, 2, 4, 5, 17, 7, 8, 11, 12]);
    expect(diffs.productAnswers.wrong.body.map((r) => r.replyCount)).toEqual(Array(8).fill(5));
    expect(diffs.hiddenToo.wrong.body.map((r) => r.id)).toContain(3);
    expect(diffs.noReplyCount.wrong.body[0].replyCount).toBeUndefined();
  }, 120_000);

  it('🔴 확인 5 — 11번의 createdAt 을 11월 11일로 바꾸면 11번이 맨 끝(… 8 · 12 · 11) · 번호로만 정렬한 판은 확인 1~4 를 모두 지나고 여기서만 11 · 12 그대로', async () => {
    const later = swap("createdAt: '2026-11-09T20:00:00.000Z'", "createdAt: '2026-11-11T09:00:00.000Z'");
    const idOnly = swap('    .sort(byOldest)\n', '    .sort((a, b) => a.id - b.id)\n');
    const moved = (await runLab('homework2', null, later)).runs;
    expect(moved[0].body.map((r) => r.id)).toEqual([1, 2, 4, 5, 7, 8, 12, 11]);
    const wrongPlain = (await runLab('homework2', idOnly)).runs;
    expect(firstDiff(right, wrongPlain)).toBeNull();
    const wrongMoved = (await runLab('homework2', idOnly, later)).runs;
    expect(wrongMoved[0].body.map((r) => r.id)).toEqual([1, 2, 4, 5, 7, 8, 11, 12]);
    seen.homework2Check5 = { moved: moved[0].body.map((r) => r.id), idOnlyMoved: wrongMoved[0].body.map((r) => r.id) };
  }, 120_000);
});

// ── 축 ⑤ 학생 파일 차이 ─────────────────────────────────────────────────────────────
describe('축 ⑤ 학생 파일 차이', () => {
  it('🔴 실습 커밋은 lab/p3-55/ · snapshots/p3-55/ 만 · 첫 줄 경로 주석 · 내부 어휘 · 쓰지 않기로 한 낱말 · 주석의 줄표와 연결어미 뒤 쉼표가 없다', () => {
    const banned = /자리|박다|박아|박힌|결[이을로의]|갈래|몸통|판[이을으]|겹|까닭|걸리|걸린|돌리|돌려(?!주|준|줄)|가르|갈리|재다|재서|벗기|되살|짝/;
    const files = {
      practice1: ['lab/p3-55/practice1.http', 'lab/p3-55/practice1.js', 'lab/p3-55/shop-data.js', 'snapshots/p3-55/practice1-start.js'],
      practice2: ['lab/p3-55/practice2.http', 'lab/p3-55/practice2.js', 'snapshots/p3-55/practice2-start.js'],
      homework2: ['lab/p3-55/homework2.http', 'lab/p3-55/homework2.js'],
    };
    for (const [which, list] of Object.entries(files)) {
      const at = commitOf(COMMITS[which]);
      expect(execFileSync('git', ['diff', '--name-only', `${at}^`, at], { cwd: P('.'), encoding: 'utf8' }).trim().split('\n')).toEqual(list);
      for (const rel of list.filter((r) => r.endsWith('.js'))) {
        const text = showAt(at, rel);
        expect([rel, text.split('\n')[0]]).toEqual([rel, `// ~/instagram-api/${rel.replace('snapshots/p3-55/', 'lab/p3-55/').replace('-start', '')}`]);
        expect([rel, /게이트|판정|TDD|Step \d|p3-\d\d|회차|스냅숏/.test(text.split('\n').slice(1).join('\n'))]).toEqual([rel, false]);
        expect([rel, text.split('\n').filter((line) => banned.test(line))]).toEqual([rel, []]);
        expect([rel, text.split('\n').slice(1).filter((line) => /^\s*\/\//.test(line) && /—|(서|고|라|면|는데|지만|니까|으니|므로|어|아),/.test(line))]).toEqual([rel, []]);
      }
    }
  });
});
