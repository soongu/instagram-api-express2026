// p3-56 「해시태그 저장」 게이트 — 백엔드 실습(직접 해보기 1 · 2 · 과제 [응용])
// 내부 검증 전용 — 교안에 한 줄도 인용하지 않는다.
//
// 소재는 상품 리뷰(p3-55 실습 이어서) — 메모리 배열(lab/p3-56/shop-data.js)로 답하는 Express 실습 서버다(데이터베이스를 안 쓴다).
// 리뷰 글의 #태그 · 태그 목록(tags · reviewCount) · 리뷰와 태그를 잇는 표(reviewTags) — 수업의 hashtags · post_hashtags 를 다른 규칙(5개 · 10자)으로 다시 해 본다.
// 직접 해보기 1 은 서버가 아니라 터미널에서 도는 스크립트(extractTags 와 여덟 문장)라 서버를 안 띄운다.
// 직접 해보기 2(고치기 PATCH)와 과제 [응용](달기 · 지우기 · 인기 태그)은 p3-55 처럼 수업 백엔드의 requireLogin 을 불러 쓴다.
// 판정은 수업 백엔드를 3962 에, 실습 서버를 3963 에 띄운다 — 실습 사본은 포트 두 곳(app.listen 의 수 · 기다린다는 문장)만 바꾼다.
// 판정 DB 는 `p356_lab_api` 하나(`test/fixtures/p3-55-end.sql` — 로그인에 jaehoon 의 비밀번호만 있으면 된다).
// 커밋 — 제목 끝이 «(직접 해보기 1)» · «(직접 해보기 1 고침)» · «(직접 해보기 2)» · «(과제 [응용])» 인 feat(p3-56) 커밋. «(Step N)» 은 붙이지 않는다(회차 판정이 Step 커밋을 그 표식으로 찾는다).
// 🔑 짓는 동안 `P356_LAB_WT=1` 을 주면 실습 파일을 커밋 대신 작업트리(lab/p3-56)에서 읽는다.
// 빈칸 판(직접 해보기 1)은 정답 판의 네 줄을 ____ 로 비운 것이다 — 이 판정이 같은 규칙으로 만들어 본다.
//
// 축 ① 나눠 주는 데이터 — shop-data.js(p3-55 판에서 글에 #태그만 더했다 · 태그 일곱 · reviewCount = 연결 줄 수 · 답변과 숨긴 리뷰는 태그 없음)
// 축 ② 직접 해보기 1 — 정답 판 출력 · 빈칸 판 node --check · 틀린 판(g 빠짐 · # 안 뗌 · 소문자 빠짐 · Set 빠짐 · null 처리 빠짐 · 넓은 정규식 · 길이 >= · 길이 검사 빠짐 · 개수)이 처음 달라지는 문장
// 축 ③ 직접 해보기 2 — 정답 판 · 틀린 판(숫자 안 내림 · 연결 안 지움 · 소문자 빠짐 · 새 태그 숫자 · 전부 다시 · 쓴 사람 확인 · 길이 · 개수 · 답변 고치기) × practice2.http · 로그인 없이 401
// 축 ③-2 직접 해보기 2 나눠 주는 판 — 정답 판에서 syncTags 와 editReview 의 몸통만 한 줄 «  // 여기를 채워요» 로 비운 판(파일로 커밋하지 않고 이 판정이 만들어 본다) · node --check · 고치기 전 태그 목록은 정답 판과 같다 · 2번 리뷰 고치기는 몸통이 비어 정답이 아니다 · 차이는 두 몸통뿐
// 축 ④ 과제 [응용] — 정답 판 · 틀린 판(숫자 안 올림 · 안 내림 · 동점 · 오름차순 · 다섯 · 쓴 사람 확인 · Set) × homework2.http · 로그인 없이 401
// 축 ⑤ 학생 파일 차이 — 실습 커밋은 lab/p3-56/ 만 · 경로 주석 · 쓰지 않기로 한 낱말
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, mkdtempSync, rmSync, symlinkSync, writeFileSync, openSync, closeSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import pg from 'pg';
import { boot } from './helpers/boot.js';

const ROOT = new URL('../', import.meta.url);
const P = (rel) => new URL(rel, ROOT).pathname;
const read = (path) => readFileSync(path, 'utf8');
const LAB = 'lab/p3-56';
const STUDENT_PORT = 4001;
const API_PORT = 3962;
const LAB_PORT = 3963;
const PG_PORT = Number(process.env.P356_PG_PORT ?? 5432);
const ADMIN = { host: 'localhost', port: PG_PORT, database: 'postgres', user: 'postgres', password: 'postgres' };
const DB = 'p356_lab_api';
const SECRET = 'q2Xh0v9bGm4RkT7sYp1wLc8nZf3uJd6eHa5iVo0rQyE';
const ENV = {
  CORS_ORIGIN: 'http://localhost:3001', JWT_SECRET: SECRET, DATABASE_URL: `postgresql://postgres:postgres@localhost:${PG_PORT}/${DB}`,
  GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret', SITE_URL: `http://localhost:${API_PORT}`,
  KAKAO_CLIENT_ID: 'test-kakao', KAKAO_CLIENT_SECRET: 'test-kakao-secret', NAVER_CLIENT_ID: 'test-naver', NAVER_CLIENT_SECRET: 'test-naver-secret',
};
const FIXTURE = P('test/fixtures/p3-55-end.sql');
const WT = process.env.P356_LAB_WT === '1';
const hasRef = (ref) => {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', ref], { cwd: P('.'), stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
};
const LINE = process.env.P356_LINE ?? (hasRef('refs/heads/code/p3-56') ? 'code/p3-56' : 'HEAD');
/** 제목 끝 표식으로 커밋 하나 — 같은 표식이 여럿이면 가장 뒤 커밋. */
const commitOf = (mark) => {
  const log = execFileSync('git', ['log', '-n', '400', '--format=%H %s', LINE], { cwd: P('.'), encoding: 'utf8' });
  const hit = log.split('\n').find((l) => / feat\(p3-56\): /.test(l) && l.endsWith(`(${mark})`));
  if (!hit) throw new Error(`(${mark}) 커밋이 없다`);
  return hit.split(' ')[0];
};
// practice1 은 «고침» 커밋(정확히 10자인 예문을 더한 것)이 끝 판이다. 첫 커밋은 FIRST1 로 따로 본다.
const FIRST1 = '직접 해보기 1';
const COMMITS = { practice1: '직접 해보기 1 고침', practice2: '직접 해보기 2', homework2: '과제 [응용]' };
const showAt = (ref, rel) => execFileSync('git', ['show', `${ref}:${rel}`], { cwd: P('.'), encoding: 'utf8' });
/** 실습 파일 하나의 글 — 짓는 동안은 작업트리 · 아니면 그 실습 커밋. */
const labText = (which, file) => (WT ? read(P(`${LAB}/${file}`)) : showAt(commitOf(COMMITS[which]), `${LAB}/${file}`));
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
  const dir = mkdtempSync(join(tmpdir(), 'p356-lab-'));
  dirs.push(dir);
  const tar = execFileSync('git', ['archive', '--format=tar', WT ? LINE : commitOf(COMMITS[which])], { cwd: P('.'), maxBuffer: 1 << 28 });
  execFileSync('tar', ['-x', '-C', dir], { input: tar });
  if (WT) cpSync(P(LAB), join(dir, LAB), { recursive: true });
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
  const dir = mkdtempSync(join(tmpdir(), 'p356-labhttp-'));
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
    try { return JSON.parse(text); } catch { return text === '' ? null : text; }
  };
  return JSON.parse(read(join(dir, 'out.json'))).requests.map((r) => ({ title: r.title, status: r.response?.statusCode ?? null, body: parse(r.response?.body) ?? null }));
};

/** 수업 백엔드 — 로그인만 쓴다. */
let api;
beforeAll(async () => {
  await dropDb();
  await admin((client) => client.query(`CREATE DATABASE ${DB}`));
  const client = new pg.Client({ ...ADMIN, database: DB });
  await client.connect();
  await client.query(read(FIXTURE).split('\n').filter((line) => !line.startsWith('\\')).join('\n'));
  await client.end();
  const dir = studentCopy('homework2');
  api = await boot(join(dir, 'app.js'), { port: API_PORT, cwd: dir, env: { ...ENV, PORT: String(API_PORT) }, ready: `${API_PORT}번 포트에서` });
}, 120_000);

afterAll(async () => {
  if (api) await Promise.race([api.stop(), sleep(500)]);
  await dropDb();
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  if (process.env.P356_LAB_SEEN) writeFileSync(process.env.P356_LAB_SEEN, JSON.stringify(seen, null, 2));
});

/** 실습 서버 하나를 띄워 그 실습의 .http 를 위에서부터 보낸다. */
const runLab = async (which, edit) => {
  const dir = studentCopy(which, edit);
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
  // 새로 만든 리뷰(19번부터)의 시각만 지운다. 나눠 준 데이터의 시각은 그대로 비교한다.
  if (body?.review?.id > 18) body.review.createdAt = '<createdAt>';
  return { ...r, body };
});
/** 정답 판과 처음 달라지는 요청 — 제목 · 정답 · 틀린 판. */
const firstDiff = (right, wrong) => {
  const [a, b] = [scrub(right), scrub(wrong)];
  const at = a.findIndex((r, i) => JSON.stringify(r) !== JSON.stringify(b[i]));
  return at === -1 ? null : { at, title: a[at].title, right: { status: a[at].status, body: a[at].body }, wrong: { status: b[at].status, body: b[at].body } };
};
const brief = (diffs) => Object.fromEntries(Object.entries(diffs).map(([k, d]) => [k, d === null ? null : [d.title, d.wrong.status]]));
const tag = (id, name, reviewCount) => ({ id, name, reviewCount });

// ── 축 ① 나눠 주는 데이터 ───────────────────────────────────────────────────────────
describe('축 ① 나눠 주는 데이터', () => {
  it('🔴 shop-data.js — 리뷰와 답변은 p3-55 판에서 글에 #태그만 더했다 · 태그 일곱 · 이름은 소문자 하나씩 · reviewCount = 그 태그의 연결 줄 수 · 글의 #태그 = 그 리뷰의 연결 · 답변과 숨긴 리뷰는 태그 없음', async () => {
    const dir = studentCopy('practice1');
    const data = await import(join(dir, LAB, 'shop-data.js'));
    const before = await import(join(dir, 'lab/p3-55/shop-data.js'));
    expect(data.users).toEqual(before.users);
    expect(data.products).toEqual(before.products);
    const strip = (r) => ({ ...r, content: r.content.replace(/ #\S+/g, '') });
    expect(data.reviews.map(strip)).toEqual(before.reviews);

    const names = data.tags.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual(names.map((n) => n.toLowerCase()));
    expect(data.tags.map((t) => t.id)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    const pairs = data.reviewTags.map((l) => `${l.reviewId}-${l.tagId}`);
    expect(new Set(pairs).size).toBe(pairs.length);
    for (const tagRow of data.tags) {
      expect([tagRow.name, tagRow.reviewCount]).toEqual([tagRow.name, data.reviewTags.filter((l) => l.tagId === tagRow.id).length]);
    }
    for (const review of data.reviews) {
      const written = (review.content.match(/#[0-9A-Za-z가-힣_]+/g) ?? []).map((t) => t.slice(1).toLowerCase());
      const linked = data.reviewTags.filter((l) => l.reviewId === review.id).map((l) => data.tags.find((t) => t.id === l.tagId).name);
      expect([review.id, linked]).toEqual([review.id, written]);
      if (review.parentId !== null || review.hidden) expect([review.id, written]).toEqual([review.id, []]);
    }
    expect(data.tags.map((t) => [t.name, t.reviewCount])).toEqual([['음질', 3], ['가성비', 4], ['배송', 1], ['운동', 1], ['보냉', 1], ['통화', 1], ['재구매', 1]]);
    seen.shopData = labText('practice1', 'shop-data.js');
  }, 30_000);
});

// ── 축 ② 직접 해보기 1 ─────────────────────────────────────────────────────────────
const SAMPLES = [
  '음질이 생각보다 좋아요 #음질 #가성비',
  '#가성비 최고예요 또 사고 싶어요 #가성비',
  '케이스는 #Black 이 예뻐요 #BLACK',
  '운동할 때 좋아요, #운동, #러닝!',
  '태그가 없는 리뷰예요',
  '딱 열 글자인 #가나다라마바사아자차 태그',
  '이름이 너무 긴 #가나다라마바사아자차카 태그',
  '#하나 #둘 #셋 #넷 #다섯 #여섯 다 쓰면',
];
const P1_OUTPUT = [
  SAMPLES[0], "  태그 [ '음질', '가성비' ]",
  SAMPLES[1], "  태그 [ '가성비' ]",
  SAMPLES[2], "  태그 [ 'black' ]",
  SAMPLES[3], "  태그 [ '운동', '러닝' ]",
  SAMPLES[4], '  태그 []',
  SAMPLES[5], "  태그 [ '가나다라마바사아자차' ]",
  SAMPLES[6], '  안 돼요: 태그는 10자까지 쓸 수 있어요',
  SAMPLES[7], '  안 돼요: 태그는 리뷰 하나에 5개까지 쓸 수 있어요',
];
/** 정답 판의 네 줄을 비운 빈칸 판 — 비우는 곳: 정규식 · 태그 이름 만들기 · Set · 길이 검사. */
const P1_BLANKS = [
  ['const TAG = /#[0-9A-Za-z가-힣_]+/g;', 'const TAG = ____;'],
  ['const lowered = found.map((tag) => tag.slice(1).toLowerCase());', 'const lowered = found.map((tag) => ____);'],
  ['const names = [...new Set(lowered)];', 'const names = [...new ____(lowered)];'],
  ["if (names.some((name) => name.length > MAX_LENGTH)) throw", "if (names.some((name) => ____)) throw"],
];
const blankOut = (text) => P1_BLANKS.reduce((out, [a, b]) => swap(a, b)(out), text);
/** 학생이 `node lab/p3-56/practice1.js` 를 친 것처럼 — 출력 줄과 끝난 상태. */
const runPractice1 = (edit) => {
  const dir = studentCopy('practice1', edit);
  const res = spawnSync(process.execPath, [join(dir, LAB, 'practice1.js')], { cwd: dir, encoding: 'utf8' });
  return { lines: res.stdout.split('\n').slice(0, -1), status: res.status, stderr: res.stderr };
};
/** 정답과 처음 달라지는 문장 — 샘플 번호 · 문장 · 정답 줄 · 틀린 줄. */
const firstSample = (right, wrong) => {
  const at = right.findIndex((line, i) => line !== wrong[i]);
  if (at === -1) return null;
  const n = Math.floor(at / 2);
  return { sample: n + 1, content: SAMPLES[n], right: right[n * 2 + 1], wrong: wrong[n * 2 + 1] ?? null };
};
const P1_WRONG = {
  noGlobal: swap('/#[0-9A-Za-z가-힣_]+/g', '/#[0-9A-Za-z가-힣_]+/'),
  noSlice: swap('tag.slice(1).toLowerCase()', 'tag.toLowerCase()'),
  noLower: swap('tag.slice(1).toLowerCase()', 'tag.slice(1)'),
  noSet: swap('[...new Set(lowered)]', 'lowered'),
  noNullGuard: swap(' ?? []', ''),
  wideRegex: swap('/#[0-9A-Za-z가-힣_]+/g', '/#\\S+/g'),
  lengthGte: swap('name.length > MAX_LENGTH', 'name.length >= MAX_LENGTH'),
  noLengthCheck: swap("  if (names.some((name) => name.length > MAX_LENGTH)) throw new Error('태그는 10자까지 쓸 수 있어요');\n", ''),
  noCountCheck: swap("  if (names.length > MAX_COUNT) throw new Error('태그는 리뷰 하나에 5개까지 쓸 수 있어요');\n", ''),
};
describe('축 ② 직접 해보기 1 — 해시태그 뽑기', () => {
  it('🔴 정답 판 — 여덟 문장의 출력 줄(중복은 한 번 · 대문자는 소문자 · 쉼표와 느낌표는 태그가 아님 · 태그 없음은 [] · 딱 10자는 통과 · 11자 · 6개는 에러 문장)', () => {
    const out = runPractice1();
    expect(out.status).toBe(0);
    expect(out.lines).toEqual(P1_OUTPUT);
    seen.practice1 = { output: out.lines.join('\n') };
  });

  it('🔴 빈칸 판 — 네 줄이 ____ 하나씩 · 비운 채로 node --check 를 지난다 · 그대로 돌리면 ReferenceError', () => {
    const answer = labText('practice1', 'practice1.js');
    const blank = blankOut(answer);
    const a = answer.split('\n');
    const b = blank.split('\n');
    const differ = a.map((line, i) => [line, b[i]]).filter(([x, y]) => x !== y);
    expect(differ.length).toBe(4);
    expect(differ.every(([, y]) => y.split('____').length === 2)).toBe(true);
    expect(b[0]).toBe(`// ~/instagram-api/${LAB}/practice1.js`);
    const dir = studentCopy('practice1', blankOut);
    execFileSync(process.execPath, ['--check', join(dir, LAB, 'practice1.js')]);
    const res = spawnSync(process.execPath, [join(dir, LAB, 'practice1.js')], { cwd: dir, encoding: 'utf8' });
    expect(res.status).not.toBe(0);
    expect(res.stderr).toMatch(/ReferenceError: ____ is not defined/);
    seen.practice1Blanks = differ;
  });

  it('🔴 틀린 판마다 처음 달라지는 문장 — g 빠짐 · # 안 뗌은 첫 문장 · 소문자 빠짐은 «Black» · Set 빠짐은 «#가성비 두 번» · null 처리 빠짐은 «태그 없음»(TypeError 문장이 찍힌다) · 넓은 정규식은 «쉼표»(첫 문장도) · 길이를 >= 로 하면 «딱 열 글자»(여섯째) · 길이 검사 빠짐은 «열한 글자»(일곱째) · 개수 검사 빠짐은 여덟째', () => {
    const right = runPractice1().lines;
    const diffs = {};
    for (const [name, edit] of Object.entries(P1_WRONG)) {
      const out = runPractice1(edit);
      diffs[name] = firstSample(right, out.lines);
    }
    seen.practice1Wrong = diffs;
    expect(Object.fromEntries(Object.entries(diffs).map(([k, d]) => [k, d.sample]))).toEqual({
      noGlobal: 1, noSlice: 1, noLower: 3, noSet: 2, noNullGuard: 5, wideRegex: 4, lengthGte: 6, noLengthCheck: 7, noCountCheck: 8,
    });
    expect(diffs.noGlobal.wrong).toBe("  태그 [ '음질' ]");
    expect(diffs.noSlice.wrong).toBe("  태그 [ '#음질', '#가성비' ]");
    expect(diffs.noLower.wrong).toBe("  태그 [ 'Black', 'BLACK' ]");
    expect(diffs.noSet.wrong).toBe("  태그 [ '가성비', '가성비' ]");
    expect(diffs.noNullGuard.wrong).toBe("  안 돼요: Cannot read properties of null (reading 'map')");
    expect(diffs.wideRegex.wrong).toBe("  태그 [ '운동,', '러닝!' ]");
    expect(diffs.lengthGte.wrong).toBe('  안 돼요: 태그는 10자까지 쓸 수 있어요');
    expect(diffs.noLengthCheck.wrong).toBe("  태그 [ '가나다라마바사아자차카' ]");
    expect(diffs.noCountCheck.wrong).toBe("  태그 [ '하나', '둘', '셋', '넷', '다섯', '여섯' ]");
  }, 60_000);
});

// ── 축 ③ 직접 해보기 2 ─────────────────────────────────────────────────────────────
const ALL_BEFORE = [tag(1, '음질', 3), tag(2, '가성비', 4), tag(3, '배송', 1), tag(4, '운동', 1), tag(5, '보냉', 1), tag(6, '통화', 1), tag(7, '재구매', 1)];
const ALL_AFTER = [tag(1, '음질', 3), tag(2, '가성비', 4), tag(3, '배송', 0), tag(4, '운동', 1), tag(5, '보냉', 1), tag(6, '통화', 1), tag(7, '재구매', 1), tag(8, 'fast', 1)];
const P2_TITLES = [
  'jaehoon으로 로그인 — 수업 백엔드', '태그 목록 — 고치기 전', '2번 리뷰 고치기 — 태그 하나를 빼고 하나를 더하기', '태그 목록 — 고친 뒤', '태그를 여섯 개 쓰면',
  '태그가 열한 글자면', '태그 목록 — 400 뒤에도 그대로', '남이 쓴 1번 리뷰 고치기', '없는 리뷰 고치기', '내가 쓴 18번 답변 고치기',
];
const P2_WRONG = {
  noDecrement: swap('    reviewTags.splice(at, 1);\n    tag.reviewCount -= 1;\n', '    reviewTags.splice(at, 1);\n'),
  noUnlink: swap('    reviewTags.splice(at, 1);\n    tag.reviewCount -= 1;\n', '    tag.reviewCount -= 1;\n'),
  noLowercase: swap('tag.slice(1).toLowerCase()', 'tag.slice(1)'),
  noNewCount: swap('    tag.reviewCount += 1;\n', ''),
  allAgain: swap('  removeTags(reviewId, before.filter((name) => !names.includes(name)));\n  addTags(reviewId, names.filter((name) => !before.includes(name)));\n', '  removeTags(reviewId, before);\n  addTags(reviewId, names);\n'),
  noAuthor: swap("  if (review.authorId !== userId) throw fail(403, '내가 쓴 리뷰만 고칠 수 있어요');\n", ''),
  noLengthCheck: swap("  if (names.some((name) => name.length > MAX_LENGTH)) throw fail(400, '태그는 10자까지 쓸 수 있어요');\n", ''),
  noCountCheck: swap("  if (names.length > MAX_COUNT) throw fail(400, '태그는 리뷰 하나에 5개까지 쓸 수 있어요');\n", ''),
  repliesEditable: swap(' && one.parentId === null);', ');'),
};
describe('축 ③ 직접 해보기 2 — 리뷰 고치기와 태그 맞추기', () => {
  let right;
  it('🔴 정답 판 — 태그 일곱 → 2번 리뷰 고치기 200(가성비 그대로 · 배송 −1 → 0 · fast 새로 1 · 연결 차례 [가성비, fast]) → 태그 여덟 → 6개 400 · 11자 400 · 그 뒤에도 그대로 → 남의 리뷰 403 · 없는 리뷰 404 · 답변 404', async () => {
    right = (await runLab('practice2')).runs;
    expect(right.map((r) => [r.title, r.status])).toEqual(P2_TITLES.map((t, i) => [t, [200, 200, 200, 200, 400, 400, 200, 403, 404, 404][i]]));
    expect(right[1].body).toEqual(ALL_BEFORE);
    expect(right[2].body).toEqual({ review: { id: 2, authorId: 2, content: '배송이 하루 만에 왔어요 #Fast #가성비', createdAt: '2026-11-02T11:20:00.000Z', username: 'jaehoon', tags: ['가성비', 'fast'] } });
    expect(right[3].body).toEqual(ALL_AFTER);
    expect([right[4].body, right[5].body]).toEqual([{ message: '태그는 리뷰 하나에 5개까지 쓸 수 있어요' }, { message: '태그는 10자까지 쓸 수 있어요' }]);
    expect(right[6].body).toEqual(ALL_AFTER);
    expect([right[7].body, right[8].body, right[9].body]).toEqual([{ message: '내가 쓴 리뷰만 고칠 수 있어요' }, { message: '그런 리뷰는 없어요' }, { message: '그런 리뷰는 없어요' }]);
    seen.practice2 = { http: read(P(`${LAB}/practice2.http`)), runs: right };
  }, 40_000);

  it('🔴 틀린 판마다 처음 달라지는 곳 — 숫자 안 내림은 «태그 목록 — 고친 뒤»(배송 1) · 연결 안 지움은 «2번 리뷰 고치기»(tags 에 배송이 남는다) · 소문자 빠짐은 같은 요청(Fast) · 새 태그 숫자는 «고친 뒤»(fast 0) · 전부 다시는 «고치기»(차례 [fast, 가성비]) · 쓴 사람 확인 빠짐은 «남이 쓴 1번»(200) · 길이 · 개수는 그 요청(200) · 답변 고치기는 마지막(200)', async () => {
    const diffs = {};
    for (const [name, edit] of Object.entries(P2_WRONG)) diffs[name] = firstDiff(right, (await runLab('practice2', edit)).runs);
    seen.practice2Wrong = diffs;
    expect(brief(diffs)).toEqual({
      noDecrement: ['태그 목록 — 고친 뒤', 200],
      noUnlink: ['2번 리뷰 고치기 — 태그 하나를 빼고 하나를 더하기', 200],
      noLowercase: ['2번 리뷰 고치기 — 태그 하나를 빼고 하나를 더하기', 200],
      noNewCount: ['태그 목록 — 고친 뒤', 200],
      allAgain: ['2번 리뷰 고치기 — 태그 하나를 빼고 하나를 더하기', 200],
      noAuthor: ['남이 쓴 1번 리뷰 고치기', 200],
      noLengthCheck: ['태그가 열한 글자면', 200],
      noCountCheck: ['태그를 여섯 개 쓰면', 200],
      repliesEditable: ['내가 쓴 18번 답변 고치기', 200],
    });
    expect(diffs.noDecrement.wrong.body.find((t) => t.name === '배송').reviewCount).toBe(1);
    expect(diffs.noUnlink.wrong.body.review.tags).toEqual(['배송', '가성비', 'fast']);
    expect(diffs.noLowercase.wrong.body.review.tags).toEqual(['가성비', 'Fast']);
    expect(diffs.noNewCount.wrong.body.find((t) => t.name === 'fast').reviewCount).toBe(0);
    expect(diffs.allAgain.wrong.body.review.tags).toEqual(['fast', '가성비']);
  }, 240_000);

  it('🔴 로그인 없이 보내면 401 «로그인이 필요해요» · 태그 목록은 로그인 없이도 200', async () => {
    const dir = studentCopy('practice2');
    onPort(dir, 'practice2', LAB_PORT);
    const lab = await boot(join(dir, LAB, 'practice2.js'), { port: LAB_PORT, cwd: dir, env: ENV, ready: `${LAB_PORT}번 포트에서` });
    try {
      const res = await fetch(`http://localhost:${LAB_PORT}/api/reviews/2`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{"content":"x #y"}' });
      expect([res.status, await res.json()]).toEqual([401, { message: '로그인이 필요해요' }]);
      expect((await fetch(`http://localhost:${LAB_PORT}/api/tags`)).status).toBe(200);
    } finally {
      await Promise.race([lab.stop(), sleep(500)]);
    }
  }, 30_000);
});

// ── 축 ③-2 직접 해보기 2 나눠 주는 판 ─────────────────────────────────────────────────
/** 정답 판에서 두 함수(syncTags · editReview)의 몸통을 «  // 여기를 채워요» 한 줄로 비운다 — 선언 줄 · 바로 위 주석 · 닫는 } 는 그대로. */
const EMPTY_FUNCTIONS = ['syncTags(reviewId, names)', 'editReview(reviewId, userId, content)'];
const emptyBodies = (text) => EMPTY_FUNCTIONS.reduce((out, signature) => {
  const head = `function ${signature} {\n`;
  const from = out.indexOf(head);
  if (from === -1 || out.indexOf(head, from + 1) !== -1) throw new Error(`함수가 없거나 여럿이다: ${signature}`);
  const to = out.indexOf('\n}\n', from);
  return `${out.slice(0, from + head.length)}  // 여기를 채워요${out.slice(to)}`;
}, text);
describe('축 ③-2 직접 해보기 2 — 나눠 주는 판(두 함수의 몸통만 비움)', () => {
  it('🔴 node --check 를 지난다 · 정답 판과의 차이는 두 몸통뿐(선언 줄 · 위 주석 · 닫는 } 는 같다) · 빈칸 줄은 정확히 둘', () => {
    const answer = labText('practice2', 'practice2.js');
    const start = emptyBodies(answer);
    const dir = studentCopy('practice2', emptyBodies);
    execFileSync(process.execPath, ['--check', join(dir, LAB, 'practice2.js')]);
    expect(start.split('\n')[0]).toBe(`// ~/instagram-api/${LAB}/practice2.js`);
    expect(start.split('// 여기를 채워요').length).toBe(3);
    const a = answer.split('\n');
    const b = start.split('\n');
    // 정답 판에서 두 함수의 몸통(선언 줄 다음부터 닫는 } 앞까지)만 빼면 나눠 주는 판에서 빈칸 줄 둘을 뺀 것과 글자까지 같다.
    const outside = a.filter((line, i) => !EMPTY_FUNCTIONS.some((signature) => {
      const at = a.indexOf(`function ${signature} {`);
      return i > at && i < a.indexOf('}', at);
    }));
    expect(b.filter((line) => line !== '  // 여기를 채워요')).toEqual(outside);
    expect(b.length).toBeLessThan(a.length);
    for (const signature of EMPTY_FUNCTIONS) {
      const at = b.indexOf(`function ${signature} {`);
      expect([signature, b.slice(at - 1, at + 3)]).toEqual([signature, [a[a.indexOf(`function ${signature} {`) - 1], `function ${signature} {`, '  // 여기를 채워요', '}']]);
    }
    seen.practice2Start = start;
  });

  it('🔴 그 판으로 서버가 뜬다 · «태그 목록 — 고치기 전» 은 정답 판과 같은 200 · 일곱 태그 · «2번 리뷰 고치기» 는 몸통이 비어 editReview 가 undefined 를 돌려줘서 정답(tags 가 든 review)이 아니다', async () => {
    const right = (await runLab('practice2')).runs;
    const blank = (await runLab('practice2', emptyBodies)).runs;
    expect(blank.map((r) => [r.title, r.status]).slice(0, 2)).toEqual([[P2_TITLES[0], 200], [P2_TITLES[1], 200]]);
    expect(blank[1].body).toEqual(right[1].body);
    expect(blank[1].body).toEqual(ALL_BEFORE);
    const diff = firstDiff(right, blank);
    seen.practice2StartDiff = diff;
    expect(diff.title).toBe(P2_TITLES[2]);
    expect(diff.wrong).toEqual({ status: 200, body: {} });
    expect(diff.right.status).toBe(200);
    expect(diff.right.body.review.tags).toEqual(['가성비', 'fast']);
    // 몸통이 비면 아무것도 바뀌지 않는다 — 고친 뒤에도 태그 목록은 처음과 같다.
    expect(blank[3].body).toEqual(ALL_BEFORE);
  }, 60_000);
});

// ── 축 ④ 과제 [응용] ─────────────────────────────────────────────────────────────
const HW_TITLES = [
  'jaehoon으로 로그인 — 수업 백엔드', '인기 태그 — 처음', '3번 상품에 태그를 단 리뷰 달기', '인기 태그 — 리뷰를 단 뒤', '내가 쓴 2번 리뷰 지우기', '인기 태그 — 지운 뒤',
  '남이 쓴 1번 리뷰 지우기', '없는 리뷰 지우기', '태그를 여섯 개 쓴 리뷰 달기', '없는 상품에 리뷰 달기',
];
const HW_WRONG = {
  noIncrement: swap('    tag.reviewCount += 1;\n', ''),
  noDecrement: swap('    tag.reviewCount -= 1;\n', ''),
  noRemoveOnDelete: swap('  removeTags(review.id, tagNamesOf(review.id));\n', ''),
  tieBiggerFirst: swap('  return a.id - b.id;\n', '  return b.id - a.id;\n'),
  ascending: swap('return b.reviewCount - a.reviewCount;', 'return a.reviewCount - b.reviewCount;'),
  topFive: swap('.slice(0, 3)', '.slice(0, 5)'),
  noAuthor: swap("  if (review.authorId !== userId) throw fail(403, '내가 쓴 리뷰만 지울 수 있어요');\n", ''),
  noSet: swap('[...new Set(found.map((tag) => tag.slice(1).toLowerCase()))]', 'found.map((tag) => tag.slice(1).toLowerCase())'),
};
describe('축 ④ 과제 [응용] — 달기 · 지우기 · 인기 태그', () => {
  let right;
  it('🔴 정답 판 — 인기 [가성비 4 · 음질 3 · 배송 1(동점은 번호가 작은 태그)] → 달기 201(태그 셋 · 가성비 두 번 써도 한 번) → [가성비 5 · 음질 3 · 운동 2] → 지우기 204 → [가성비 4 · 음질 3 · 운동 2] → 남의 리뷰 403 · 없는 리뷰 404 · 6개 400 · 없는 상품 404', async () => {
    right = (await runLab('homework2')).runs;
    expect(right.map((r) => [r.title, r.status])).toEqual(HW_TITLES.map((t, i) => [t, [200, 200, 201, 200, 204, 200, 403, 404, 400, 404][i]]));
    expect(right[1].body).toEqual([tag(2, '가성비', 4), tag(1, '음질', 3), tag(3, '배송', 1)]);
    expect(right[2].body).toEqual({ review: { id: 19, authorId: 2, content: '높이를 바꿀 수 있어서 목이 편해요 #가성비 #운동 #거치대 이 가격이면 정말 #가성비', createdAt: expect.stringMatching(/^\d{4}-\d\d-\d\dT/), username: 'jaehoon', tags: ['가성비', '운동', '거치대'] } });
    expect(right[3].body).toEqual([tag(2, '가성비', 5), tag(1, '음질', 3), tag(4, '운동', 2)]);
    expect(right[4].body).toBeNull();
    expect(right[5].body).toEqual([tag(2, '가성비', 4), tag(1, '음질', 3), tag(4, '운동', 2)]);
    expect([right[6].body, right[7].body, right[8].body, right[9].body]).toEqual([
      { message: '내가 쓴 리뷰만 지울 수 있어요' }, { message: '그런 리뷰는 없어요' }, { message: '태그는 리뷰 하나에 5개까지 쓸 수 있어요' }, { message: '그런 상품은 없어요' },
    ]);
    seen.homework2 = { http: read(P(`${LAB}/homework2.http`)), runs: right, answer: labText('homework2', 'homework2.js') };
  }, 40_000);

  it('🔴 틀린 판마다 처음 달라지는 곳 — 올릴 때 숫자 빠짐은 «인기 태그 — 리뷰를 단 뒤» · 내릴 때 빠짐(숫자 · 연결 지우기 둘 다)은 «인기 태그 — 지운 뒤» · 동점 · 오름차순 · 다섯은 «처음» · 쓴 사람 확인 빠짐은 «남이 쓴 1번»(204) · Set 빠짐은 «태그를 단 리뷰 달기»(가성비 두 번)', async () => {
    const diffs = {};
    for (const [name, edit] of Object.entries(HW_WRONG)) diffs[name] = firstDiff(right, (await runLab('homework2', edit)).runs);
    seen.homework2Wrong = diffs;
    expect(brief(diffs)).toEqual({
      noIncrement: ['인기 태그 — 리뷰를 단 뒤', 200],
      noDecrement: ['인기 태그 — 지운 뒤', 200],
      noRemoveOnDelete: ['인기 태그 — 지운 뒤', 200],
      tieBiggerFirst: ['인기 태그 — 처음', 200],
      ascending: ['인기 태그 — 처음', 200],
      topFive: ['인기 태그 — 처음', 200],
      noAuthor: ['남이 쓴 1번 리뷰 지우기', 204],
      noSet: ['3번 상품에 태그를 단 리뷰 달기', 201],
    });
    expect(diffs.noIncrement.wrong.body.map((t) => t.reviewCount)).toEqual([4, 3, 1]);
    expect(diffs.noDecrement.wrong.body.map((t) => t.reviewCount)).toEqual([5, 3, 2]);
    expect(diffs.tieBiggerFirst.wrong.body.map((t) => t.name)).toEqual(['가성비', '음질', '재구매']);
    expect(diffs.ascending.wrong.body.map((t) => t.name)).toEqual(['배송', '운동', '보냉']);
    expect(diffs.topFive.wrong.body.length).toBe(5);
    expect(diffs.noSet.wrong.body.review.tags).toEqual(['가성비', '운동', '거치대', '가성비']);
  }, 240_000);

  it('🔴 로그인 없이 보내면 401 · 인기 태그는 로그인 없이도 200', async () => {
    const dir = studentCopy('homework2');
    onPort(dir, 'homework2', LAB_PORT);
    const lab = await boot(join(dir, LAB, 'homework2.js'), { port: LAB_PORT, cwd: dir, env: ENV, ready: `${LAB_PORT}번 포트에서` });
    try {
      const base = `http://localhost:${LAB_PORT}`;
      const post = await fetch(`${base}/api/products/3/reviews`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"content":"x"}' });
      const del = await fetch(`${base}/api/reviews/2`, { method: 'DELETE' });
      expect([post.status, await post.json(), del.status, await del.json()]).toEqual([401, { message: '로그인이 필요해요' }, 401, { message: '로그인이 필요해요' }]);
      expect((await fetch(`${base}/api/tags/popular`)).status).toBe(200);
    } finally {
      await Promise.race([lab.stop(), sleep(500)]);
    }
  }, 30_000);
});

// ── 축 ⑤ 학생 파일 차이 ─────────────────────────────────────────────────────────────
describe('축 ⑤ 학생 파일 차이', () => {
  it('🔴 실습 커밋은 lab/p3-56/ 만 · 첫 줄 경로 주석 · 내부 어휘 · 쓰지 않기로 한 낱말 · 주석의 줄표와 연결어미 뒤 쉼표가 없다', () => {
    const banned = /자리|박다|박아|박힌|결[이을로의]|갈래|몸통|판[이을으]|겹|까닭|걸리|걸린|돌리|돌려(?!주|준|줄)|가르|갈리|재다|재서|벗기|되살|짝/;
    const files = {
      practice1: ['lab/p3-56/practice1.js', 'lab/p3-56/shop-data.js'],
      practice2: ['lab/p3-56/practice2.http', 'lab/p3-56/practice2.js'],
      homework2: ['lab/p3-56/homework2.http', 'lab/p3-56/homework2.js'],
    };
    for (const [which, list] of Object.entries(files)) {
      const at = WT ? null : commitOf(COMMITS[which]);
      const changed = (ref) => execFileSync('git', ['diff', '--name-only', `${ref}^`, ref], { cwd: P('.'), encoding: 'utf8' }).trim().split('\n');
      if (!WT && which === 'practice1') {
        expect(changed(commitOf(FIRST1))).toEqual(list);
        expect(changed(at)).toEqual(['lab/p3-56/practice1.js']);
      } else if (!WT) {
        expect(changed(at)).toEqual(list);
      }
      for (const rel of list) {
        const text = WT ? read(P(rel)) : showAt(at, rel);
        if (rel.endsWith('.http')) {
          expect([rel, /게이트|판정|TDD|Step \d|p3-\d\d|회차|스냅숏/.test(text)]).toEqual([rel, false]);
          continue;
        }
        expect([rel, text.split('\n')[0]]).toEqual([rel, `// ~/instagram-api/${rel}`]);
        expect([rel, /게이트|판정|TDD|Step \d|p3-\d\d|회차|스냅숏/.test(text.split('\n').slice(1).join('\n'))]).toEqual([rel, false]);
        expect([rel, text.split('\n').filter((line) => banned.test(line))]).toEqual([rel, []]);
        expect([rel, text.split('\n').slice(1).filter((line) => /^\s*\/\//.test(line) && /—|(서|고|라|면|는데|지만|니까|으니|므로|어|아),/.test(line))]).toEqual([rel, []]);
        expect([rel, text.endsWith('\n')]).toEqual([rel, true]);
      }
    }
  });
});
