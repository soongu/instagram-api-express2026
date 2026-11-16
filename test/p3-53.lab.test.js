// p3-53 「댓글 보기」 게이트 — 백엔드 실습(직접 해보기 1 · 2 · 과제 [응용])
// 내부 검증 전용 — 교안에 한 줄도 인용하지 않는다.
//
// 소재는 상품 리뷰 — 메모리 배열(lab/p3-53/shop-data.js)로 답하는 Express 실습 서버다(데이터베이스를 안 쓴다).
// 학생 쪽 포트는 4001 · 판정은 사본의 포트 두 곳(app.listen 의 수 · 기다린다는 문장)만 바꿔 3892~3895 로 띄운다.
// 커밋 — 제목 끝이 «(직접 해보기 1)» · «(직접 해보기 2)» · «(과제 [응용])» 인 feat(p3-53) 커밋 · 같은 표식이 여럿이면 가장 뒤 커밋이 그 판.
//        `P353_LAB_WT=1` 이면 작업트리를 읽는다.
// 나눠 주는 빈칸 판은 snapshots/p3-53/practice1-start.js · practice2-start.js(경로 주석은 학생 쪽 표기 그대로 — 교안 블록과 같게).
// 과제 [응용] 의 다른 정답 판(?authorId= 필터)은 snapshots/p3-53/homework2-filter.js · .http.
//
// 축 ① 나눠 주는 파일 — shop-data.js 의 사람 다섯(리뷰 없는 사람 하나) · 상품 셋 · 리뷰 열둘 · 숨긴 리뷰 · 같은 시각 두 쌍 · 빈칸 판이 비운 채로 node --check 를 지난다
// 축 ② 직접 해보기 1 — 정답 판 · 틀린 판(숨긴 리뷰를 안 뺌 · 404 대신 [] · 이름을 안 붙임 · 빈칸 그대로) × practice1.http
// 축 ③ 직접 해보기 2 — 리뷰 목록에 두 방향 · 정답 판 · 틀린 판(방향 확인 없음 · 최신순 조건을 안 뒤집음 · 최신순에서 번호 비교 빠짐 · 커서에 방향을 안 붙임 · 정렬을 안 뒤집음) × practice2.http
// 축 ④ 과제 [응용] — 한 사람이 쓴 리뷰 · 정답 판 둘(사람 아래 주소 · ?authorId= 필터) · 틀린 판 다섯 × homework2.http
// 축 ⑤ 학생 파일 차이 — 실습 커밋은 lab/p3-53/ 만 · 경로 주석 · 쓰지 않기로 한 낱말
// 축 ⑥ 교안 대조 — `P353_LECTURE=<원고>` 를 줄 때만 · 실습 블록 넷 · 확인 목록(과제 [응용] 은 정답 판 둘 다) · «처음 달라지는 곳» 표 · `P353_LAB_LECTURE_REPORT=<파일>`
import { describe, it, expect, afterAll } from 'vitest';
import { readFileSync, mkdtempSync, rmSync, symlinkSync, writeFileSync, openSync, closeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { boot } from './helpers/boot.js';

const ROOT = new URL('../', import.meta.url);
const P = (rel) => new URL(rel, ROOT).pathname;
const read = (path) => readFileSync(path, 'utf8');
const LAB = 'lab/p3-53';
const STUDENT_PORT = 4001;
const PORTS = { practice1: 3892, practice2: 3893, homework2: 3894, wrong: 3895 };
const hasRef = (ref) => {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', ref], { cwd: P('.'), stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
};
const LINE = process.env.P353_LINE ?? (hasRef('refs/heads/code/p3-53') ? 'code/p3-53' : 'HEAD');
const WT = process.env.P353_LAB_WT === '1';
/** 제목 끝 표식으로 커밋 하나 — 같은 표식이 여럿이면 가장 뒤 커밋. */
const commitOf = (mark) => {
  const log = execFileSync('git', ['log', '-n', '400', '--format=%H %s', LINE], { cwd: P('.'), encoding: 'utf8' });
  const hit = log.split('\n').find((l) => / feat\(p3-53\): /.test(l) && l.endsWith(`(${mark})`));
  if (!hit) throw new Error(`(${mark}) 커밋이 없다`);
  return hit.split(' ')[0];
};
const COMMITS = { practice1: '직접 해보기 1', practice2: '직접 해보기 2', homework2: '과제 [응용]' };
const dirs = [];
afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  if (process.env.P353_LAB_SEEN) writeFileSync(process.env.P353_LAB_SEEN, JSON.stringify(seen, null, 2));
});
const seen = {};
/** 그 실습의 커밋(또는 작업트리)에서 파일 하나. */
const fileAt = (which, rel) => (WT ? read(P(rel)) : execFileSync('git', ['show', `${commitOf(COMMITS[which])}:${rel}`], { cwd: P('.'), encoding: 'utf8' }));
/** 학생 폴더 모양의 사본 — 그 실습 커밋을 풀고 node_modules 를 잇는다. */
const studentCopy = (which) => {
  const dir = mkdtempSync(join(tmpdir(), 'p353-lab-'));
  dirs.push(dir);
  if (WT) {
    const tar = execFileSync('git', ['archive', '--format=tar', 'HEAD'], { cwd: P('.'), maxBuffer: 1 << 28 });
    execFileSync('tar', ['-x', '-C', dir], { input: tar });
    for (const rel of ['shop-data.js', 'practice1.js', 'practice2.js', 'homework2.js']) {
      try { writeFileSync(join(dir, LAB, rel), read(P(`${LAB}/${rel}`))); } catch { /* 아직 없다 */ }
    }
  } else {
    const tar = execFileSync('git', ['archive', '--format=tar', commitOf(COMMITS[which])], { cwd: P('.'), maxBuffer: 1 << 28 });
    execFileSync('tar', ['-x', '-C', dir], { input: tar });
  }
  symlinkSync(P('node_modules'), join(dir, 'node_modules'));
  return dir;
};
/** 학생 쪽 포트 4001 을 판정 포트로 — 바꾸는 곳은 app.listen 의 수와 기다린다는 문장 둘뿐이어야 한다. */
const onPort = (source, port) => {
  expect(source.split(String(STUDENT_PORT)).length - 1).toBe(2);
  expect(source).toMatch(new RegExp(`^app\\.listen\\(${STUDENT_PORT}, \\(\\) => \\{\\n  console\\.log\\('리뷰 서버가 ${STUDENT_PORT}번 포트에서 기다리고 있어요\\.'\\);\\n\\}\\);\\n$`, 'm'));
  return source.replaceAll(String(STUDENT_PORT), String(port));
};
/** 실습 파일 하나(내용 `source`)를 학생 폴더 사본에서 `node lab/p3-53/<name>.js` 로 띄운다. */
const withLab = async (which, name, source, fn, port = PORTS[which]) => {
  const dir = studentCopy(which);
  writeFileSync(join(dir, LAB, `${name}.js`), onPort(source, port));
  const srv = await boot(join(LAB, `${name}.js`), { port, cwd: dir, ready: `${port}번 포트에서` });
  try {
    return await fn({ ...srv, base: `http://localhost:${port}` });
  } finally {
    await Promise.race([srv.stop(), sleep(500)]);
  }
};
/** httpYac CLI 로 `.http` 한 파일을 통째로 — 학생 쪽 주소를 판정 포트로. */
const httpyac = async (source, port) => {
  const dir = mkdtempSync(join(tmpdir(), 'p353-labhttp-'));
  dirs.push(dir);
  writeFileSync(join(dir, 'send.http'), source.replaceAll(`http://localhost:${STUDENT_PORT}`, `http://localhost:${port}`));
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
  return JSON.parse(read(join(dir, 'out.json'))).requests.map((r) => ({
    title: r.title, status: r.response?.statusCode, url: r.response?.request?.url, rawBody: r.response?.body, body: parse(r.response?.body),
  }));
};
/** .http 를 그 판의 서버로 보낸 결과. */
const sendHttp = (which, name, source, httpText, port) => withLab(which, name, source, () => httpyac(httpText, port ?? PORTS[which]), port);
/** 정답 줄 하나를 바꾼 판 — 바꿀 줄이 정확히 하나여야 한다. */
const variant = (source, from, to) => {
  if (source.split(from).length !== 2) throw new Error(`바꿀 글자가 없거나 여럿이다: ${from}`);
  return source.replace(from, to);
};
const ids = (body) => (Array.isArray(body) ? body : body.items).map((r) => r.id);
/** 빈칸 판(start)과 정답 판(answer) — 줄 수가 같고, 다른 줄은 빈칸(____)이 든 줄뿐이며 그 줄의 나머지 글자는 정답 줄과 같다. */
const blanksOf = (start, answer) => {
  const [a, b] = [start.split('\n'), answer.split('\n')];
  expect(a.length).toBe(b.length);
  const out = [];
  a.forEach((line, i) => {
    if (line === b[i]) return;
    expect(line).toContain('____');
    const [head, ...rest] = line.split('____');
    expect(b[i].startsWith(head)).toBe(true);
    expect(b[i].endsWith(rest.at(-1))).toBe(true);
    out.push({ line: i + 1, start: line, answer: b[i] });
  });
  return out;
};

// ── 축 ① 나눠 주는 파일 ─────────────────────────────────────────────────────────
describe('축 ① 나눠 주는 파일 — shop-data.js · 빈칸 판', () => {
  it('🔴 shop-data.js — 사람 다섯(5번 jisoo 는 리뷰가 없다) · 상품 셋(3번은 리뷰 0) · 리뷰 열둘(1번 상품 열 · 2번 상품 둘) · 숨긴 리뷰 둘(3 · 9) · 같은 시각 두 쌍(4 · 5 와 7 · 8) · 번호 차례가 시각 차례다', async () => {
    const dir = studentCopy('practice1');
    const data = await import(join(dir, LAB, 'shop-data.js'));
    expect(data.users.map((u) => u.username)).toEqual(['yuna', 'minho', 'sujin', 'taeyang', 'jisoo']);
    expect(data.reviews.filter((r) => r.authorId === 5)).toEqual([]);
    expect(data.products.map((p) => [p.id, p.name])).toEqual([[1, '무선 이어폰'], [2, '텀블러'], [3, '노트북 거치대']]);
    expect(data.reviews).toHaveLength(12);
    expect(data.reviews.map((r) => r.id)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    expect([1, 2, 3].map((id) => data.reviews.filter((r) => r.productId === id).length)).toEqual([10, 2, 0]);
    expect(data.reviews.filter((r) => r.hidden).map((r) => r.id)).toEqual([3, 9]);
    expect(data.reviews.every((r) => /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.000Z$/.test(r.createdAt) && typeof r.hidden === 'boolean')).toBe(true);
    expect([data.reviews[3].createdAt === data.reviews[4].createdAt, data.reviews[6].createdAt === data.reviews[7].createdAt]).toEqual([true, true]);
    const times = data.reviews.map((r) => r.createdAt);
    expect(times).toEqual(times.slice().sort());
    expect(new Set(times).size).toBe(10);
    expect(read(join(dir, LAB, 'shop-data.js')).split('\n')[0]).toBe('// ~/instagram-api/lab/p3-53/shop-data.js');
  });

  it('🔴 빈칸 판 둘 — 비운 채로 node --check 를 지난다 · 정답 판과 다른 줄은 빈칸이 든 줄뿐 · 직접 해보기 1 은 넷 · 2 도 넷(최신순 정렬 · 최신순 커서 다음 · 방향을 붙인 커서 · 방향 확인)', () => {
    const results = {};
    for (const name of ['practice1', 'practice2']) {
      const start = read(P(`snapshots/p3-53/${name}-start.js`));
      const dir = mkdtempSync(join(tmpdir(), 'p353-check-'));
      dirs.push(dir);
      writeFileSync(join(dir, `${name}.js`), start);
      execFileSync(process.execPath, ['--check', join(dir, `${name}.js`)], { encoding: 'utf8' });
      results[name] = blanksOf(start, fileAt(name, `${LAB}/${name}.js`));
    }
    expect(results.practice1).toHaveLength(4);
    expect(results.practice2.map((b) => b.answer.trim())).toEqual([
      'return byOldest(b, a);',
      'return (review) => review.createdAt <= createdAt && (review.createdAt < createdAt || review.id < id);',
      'return `${order}.${encodeCursor(review)}`;',
      'if (cursorOrder !== order) {',
    ]);
    // 직접 해보기 2 의 빈칸 판도 직접 해보기 1 의 함수 둘을 글자 그대로 쓴다
    const one = fileAt('practice1', `${LAB}/practice1.js`);
    const two = read(P('snapshots/p3-53/practice2-start.js'));
    for (const fn of ['function toItem(', 'function byOldest(']) {
      const at = one.indexOf(fn);
      const body = one.slice(one.lastIndexOf('\n\n', at) + 2, one.indexOf('\n}\n', at) + 3);
      expect(two).toContain(body);
    }
    seen.blanks = results;
  });
});

// ── 축 ② 직접 해보기 1 ─────────────────────────────────────────────────────────
const P1_HTTP = [
  ['1번 상품의 리뷰', 'GET http://localhost:4001/api/products/1/reviews'],
  ['리뷰가 없는 상품', 'GET http://localhost:4001/api/products/3/reviews'],
  ['없는 상품', 'GET http://localhost:4001/api/products/99/reviews'],
];
const blocksOf = (text) => text.split(/^### /m).slice(1).map((block) => [block.split('\n')[0], block.split('\n').find((line) => /^(GET|POST|PUT|PATCH|DELETE) /.test(line))]);
/** 직접 해보기 1 의 «확인» — 교안이 적을 문장 그대로의 순서. 처음 어긋난 곳을 돌려준다(다 맞으면 null). */
// 교안의 «확인» 번호와 같은 번호(① ~ ④)를 앞에 붙인다 — 교안의 «처음 달라지는 곳» 표와 맞대려고.
const checkPractice1 = (runs) => {
  const [one, three, missing] = runs;
  if (one.status !== 200 || JSON.stringify(ids(one.body)) !== JSON.stringify([1, 2, 4, 5, 7, 8, 11, 12])) return '① 1번 상품 — 200 · 리뷰 여덟이 1 · 2 · 4 · 5 · 7 · 8 · 11 · 12 차례';
  if (!one.body.every((r) => typeof r.username === 'string') || one.body[0].username !== 'yuna') return '② 줄마다 username · 첫 리뷰는 yuna';
  if (three.status !== 200 || JSON.stringify(three.body) !== '[]') return '③ 3번 상품 — 200 []';
  if (missing.status !== 404 || JSON.stringify(missing.body) !== JSON.stringify({ message: '그런 상품은 없어요' })) return '④ 99번 상품 — 404 «그런 상품은 없어요»';
  return null;
};

describe('축 ② 직접 해보기 1 — 숨긴 리뷰 빼기 · 글쓴이 이름 · 없는 상품 404 · 오래된 순', () => {
  it('🔴 정답 판 — practice1.http 셋 · 1번 상품 여덟(숨긴 3 · 9 없음 · 4 → 5 같은 시각은 번호 차례) · 3번 [] · 99번 404 · 줄의 필드는 id · authorId · content · createdAt · username', async () => {
    const httpText = fileAt('practice1', `${LAB}/practice1.http`);
    expect(blocksOf(httpText)).toEqual(P1_HTTP);
    const runs = await sendHttp('practice1', 'practice1', fileAt('practice1', `${LAB}/practice1.js`), httpText);
    expect(checkPractice1(runs)).toBe(null);
    expect(Object.keys(runs[0].body[0])).toEqual(['id', 'authorId', 'content', 'createdAt', 'username']);
    expect(runs[0].body.map((r) => r.username)).toEqual(['yuna', 'minho', 'taeyang', 'yuna', 'sujin', 'minho', 'sujin', 'yuna']);
    seen.practice1 = { http: httpText, runs: runs.map((r) => ({ title: r.title, status: r.status, body: r.rawBody })) };
  }, 30_000);

  it('🔴 틀린 판마다 확인 절차가 처음 어긋나는 곳이 다르다 — 숨긴 리뷰를 안 뺌 · 404 대신 [] · 이름을 안 붙임 · 빈칸 그대로', async () => {
    const answer = fileAt('practice1', `${LAB}/practice1.js`);
    const httpText = fileAt('practice1', `${LAB}/practice1.http`);
    const wrongs = {
      hiddenKept: variant(answer, 'review.productId === productId && !review.hidden', 'review.productId === productId'),
      emptyForMissing: variant(answer, '  if (!product) {\n', '  if (false) {\n'),
      noName: variant(answer, '    username: author.username,\n', ''),
    };
    const out = {};
    for (const [name, source] of Object.entries(wrongs)) {
      const runs = await sendHttp('practice1', 'practice1', source, httpText, PORTS.wrong);
      out[name] = { first: checkPractice1(runs), one: ids(runs[0].body), missing: [runs[2].status, runs[2].rawBody] };
    }
    expect(out.hiddenKept.first).toBe('① 1번 상품 — 200 · 리뷰 여덟이 1 · 2 · 4 · 5 · 7 · 8 · 11 · 12 차례');
    expect(out.hiddenKept.one).toEqual([1, 2, 3, 4, 5, 7, 8, 9, 11, 12]);
    expect(out.emptyForMissing.first).toBe('④ 99번 상품 — 404 «그런 상품은 없어요»');
    expect(out.emptyForMissing.missing).toEqual([200, '[]']);
    expect(out.noName.first).toBe('② 줄마다 username · 첫 리뷰는 yuna');
    // 빈칸을 비운 채로 띄우면 서버는 뜨고 요청은 500(____ 이 정의되지 않았다)
    const start = read(P('snapshots/p3-53/practice1-start.js'));
    const blank = await withLab('practice1', 'practice1', start, async ({ base, tail }) => {
      const res = await fetch(`${base}/api/products/1/reviews`);
      await sleep(200);
      return { status: res.status, log: tail() };
    }, PORTS.wrong);
    expect(blank.status).toBe(500);
    expect(blank.log).toContain('ReferenceError: ____ is not defined');
    seen.practice1Wrong = out;
  }, 60_000);
});

// ── 축 ③ 직접 해보기 2 ─────────────────────────────────────────────────────────
const P2_HTTP = [
  ['오래된 순 — 첫 페이지', 'GET http://localhost:4001/api/products/1/reviews?limit=3'],
  ['최신순 — 첫 페이지', 'GET http://localhost:4001/api/products/1/reviews?order=newest&limit=3'],
  ['최신순 — 둘째 페이지', 'GET http://localhost:4001/api/products/1/reviews?order=newest&limit=3&cursor={{newest.nextCursor}}'],
  ['오래된 순 — 둘째 페이지', 'GET http://localhost:4001/api/products/1/reviews?limit=3&cursor={{oldest.nextCursor}}'],
  ['최신순에 오래된 순의 커서를 보내면', 'GET http://localhost:4001/api/products/1/reviews?order=newest&limit=3&cursor={{oldest.nextCursor}}'],
  ['정렬 값이 틀리면', 'GET http://localhost:4001/api/products/1/reviews?order=popular'],
];
/** 직접 해보기 2 의 «확인» — 교안이 적을 문장 그대로의 차례. 처음 어긋난 곳을 돌려준다(다 맞으면 null). */
const checkPractice2 = (runs) => {
  const page = (r) => (r.status === 200 ? JSON.stringify(ids(r.body)) : `status ${r.status}`);
  const [oldest, newest, newest2, oldest2, mixed, wrongOrder] = runs;
  if (page(oldest) !== '[1,2,4]' || oldest.body.hasNext !== true || !String(oldest.body.nextCursor).startsWith('oldest.')) return '① 오래된 순 첫 페이지 — 1 · 2 · 4 · hasNext true · nextCursor 가 oldest. 로 시작';
  if (page(newest) !== '[12,11,8]' || newest.body.hasNext !== true) return '② 최신순 첫 페이지 — 12 · 11 · 8 · hasNext true';
  if (page(newest2) !== '[7,5,4]') return '③ 최신순 둘째 페이지 — 7 · 5 · 4';
  if (page(oldest2) !== '[5,7,8]') return '④ 오래된 순 둘째 페이지 — 5 · 7 · 8';
  if (mixed.status !== 400 || JSON.stringify(mixed.body) !== JSON.stringify({ message: '커서와 정렬이 맞지 않아요' })) return '⑤ 다른 방향의 커서 — 400 «커서와 정렬이 맞지 않아요»';
  if (wrongOrder.status !== 400) return '⑥ 정렬 값이 틀리면 — 400';
  return null;
};

describe('축 ③ 직접 해보기 2 — 리뷰 목록에 두 방향(오래된 순 · 최신순) · 수업의 utils/cursor.js 를 함께 쓴다', () => {
  it('🔴 정답 판 — practice2.http 여섯 · 오래된 순 1 · 2 · 4 → 5 · 7 · 8(같은 시각 4 · 5 가 경계) · 최신순 12 · 11 · 8 → 7 · 5 · 4(같은 시각 8 · 7 이 경계) · 섞으면 400 · 정렬 값이 틀리면 400 · 커서는 «방향.공용 커서»', async () => {
    const httpText = fileAt('practice2', `${LAB}/practice2.http`);
    expect(blocksOf(httpText)).toEqual(P2_HTTP);
    const source = fileAt('practice2', `${LAB}/practice2.js`);
    expect(source).toContain("import { encodeCursor, decodeCursor } from '../../utils/cursor.js';");
    expect(source).not.toMatch(/function (encodeCursor|decodeCursor)\(/);
    const runs = await sendHttp('practice2', 'practice2', source, httpText);
    expect(checkPractice2(runs)).toBe(null);
    expect(runs[5].body).toEqual({ message: '보낸 내용이 규칙에 안 맞아요' });
    // 커서 — 방향 · '.' · 공용 커서(base64url — '.' 이 없다)
    const [order, rest, ...more] = runs[1].body.nextCursor.split('.');
    expect([order, more]).toEqual(['newest', []]);
    expect(JSON.parse(Buffer.from(rest, 'base64url').toString())).toEqual({ createdAt: '2026-11-05T13:05:00.000Z', id: 8 });
    expect(runs[0].body.nextCursor.startsWith('oldest.')).toBe(true);
    expect(runs[2].body.hasNext).toBe(true);
    // 셋째 페이지 · 기본 5 · 잘못된 커서 · 방향을 모르는 커서 · 방향이 없는 공용 커서(수업 API 의 커서) · 없는 상품 · 리뷰 없는 상품
    const more2 = await withLab('practice2', 'practice2', source, async ({ base }) => {
      const get = async (path) => { const r = await fetch(`${base}${path}`); return [r.status, await r.json()]; };
      const third = await get(`/api/products/1/reviews?order=newest&limit=3&cursor=${runs[2].body.nextCursor}`);
      const plainCursor = runs[0].body.nextCursor.split('.')[1];
      return {
        third,
        plain: await get('/api/products/1/reviews'),
        newestPlain: await get('/api/products/1/reviews?order=newest'),
        bad: await get('/api/products/1/reviews?cursor=abc'),
        unknownOrder: await get(`/api/products/1/reviews?cursor=popular.${plainCursor}`),
        noOrder: await get(`/api/products/1/reviews?cursor=${plainCursor}`),
        missing: await get('/api/products/99/reviews'),
        empty: await get('/api/products/3/reviews'),
      };
    });
    expect([more2.third[0], ids(more2.third[1]), more2.third[1].hasNext, more2.third[1].nextCursor]).toEqual([200, [2, 1], false, null]);
    expect([ids(more2.plain[1]), more2.plain[1].hasNext]).toEqual([[1, 2, 4, 5, 7], true]);
    expect([ids(more2.newestPlain[1]), more2.newestPlain[1].hasNext]).toEqual([[12, 11, 8, 7, 5], true]);
    expect(more2.bad).toEqual([400, { message: '커서 값이 올바르지 않아요' }]);
    expect(more2.unknownOrder).toEqual([400, { message: '커서와 정렬이 맞지 않아요' }]);
    expect(more2.noOrder).toEqual([400, { message: '커서 값이 올바르지 않아요' }]);
    expect(more2.missing).toEqual([404, { message: '그런 상품은 없어요' }]);
    expect(more2.empty[1]).toEqual({ items: [], hasNext: false, nextCursor: null });
    seen.practice2 = { http: httpText, runs: runs.map((r) => ({ title: r.title, status: r.status, url: r.url, body: r.rawBody })), more: more2 };
  }, 60_000);

  it('🔴 틀린 판마다 확인 절차가 처음 어긋나는 곳이 다르다 — 방향 확인 없음 · 최신순 조건을 안 뒤집음 · 최신순에서 번호 비교 빠짐 · 커서에 방향을 안 붙임 · 최신순 정렬을 안 뒤집음', async () => {
    const answer = fileAt('practice2', `${LAB}/practice2.js`);
    const httpText = fileAt('practice2', `${LAB}/practice2.http`);
    const NEWEST_AFTER = 'return (review) => review.createdAt <= createdAt && (review.createdAt < createdAt || review.id < id);';
    const wrongs = {
      noOrderCheck: variant(answer, '    if (cursorOrder !== order) {\n', '    if (false) {\n'),
      notFlipped: variant(answer, NEWEST_AFTER, 'return (review) => review.createdAt >= createdAt && (review.createdAt > createdAt || review.id > id);'),
      newestTimeOnly: variant(answer, NEWEST_AFTER, 'return (review) => review.createdAt < createdAt;'),
      noPrefix: variant(answer, 'return `${order}.${encodeCursor(review)}`;', 'return encodeCursor(review);'),
      sortNotFlipped: variant(answer, '  return byOldest(b, a);\n', '  return byOldest(a, b);\n'),
    };
    const out = {};
    for (const [name, source] of Object.entries(wrongs)) {
      const runs = await sendHttp('practice2', 'practice2', source, httpText, PORTS.wrong);
      out[name] = { first: checkPractice2(runs), statuses: runs.map((r) => r.status), pages: runs.map((r) => (r.status === 200 ? ids(r.body) : r.rawBody)) };
    }
    expect(out.noOrderCheck.first).toBe('⑤ 다른 방향의 커서 — 400 «커서와 정렬이 맞지 않아요»');
    expect(out.noOrderCheck.statuses[4]).toBe(200);
    expect(out.notFlipped.first).toBe('③ 최신순 둘째 페이지 — 7 · 5 · 4');
    expect(out.newestTimeOnly.first).toBe('③ 최신순 둘째 페이지 — 7 · 5 · 4');
    expect(out.newestTimeOnly.pages[2]).toEqual([5, 4, 2]);
    // 확인 1 이 «nextCursor 가 oldest. 로 시작» 을 보므로 방향을 안 붙인 판은 확인 1 에서 먼저 어긋난다(확인 3 은 400)
    expect(out.noPrefix.first).toBe('① 오래된 순 첫 페이지 — 1 · 2 · 4 · hasNext true · nextCursor 가 oldest. 로 시작');
    expect(out.noPrefix.pages[2]).toBe(JSON.stringify({ message: '커서 값이 올바르지 않아요' }));
    expect(out.sortNotFlipped.first).toBe('② 최신순 첫 페이지 — 12 · 11 · 8 · hasNext true');
    seen.practice2Wrong = out;
  }, 90_000);
});

// ── 축 ④ 과제 [응용] ──────────────────────────────────────────────────────────
const H2_HTTP = [
  ['yuna가 쓴 리뷰 — 첫 페이지', 'GET http://localhost:4001/api/users/1/reviews?limit=2'],
  ['둘째 페이지', 'GET http://localhost:4001/api/users/1/reviews?limit=2&cursor={{first.nextCursor}}'],
  ['숨긴 리뷰가 있는 사람', 'GET http://localhost:4001/api/users/3/reviews'],
  ['리뷰를 쓰지 않은 사람', 'GET http://localhost:4001/api/users/5/reviews'],
  ['없는 사람', 'GET http://localhost:4001/api/users/99/reviews'],
];
/** 과제 [응용] 의 «확인» — 주소와 상관없이 다섯 요청의 응답 차례로 본다(사람 아래 주소든 ?authorId= 필터든). */
const checkHomework2 = (runs) => {
  const page = (r) => (r.status === 200 ? JSON.stringify(ids(r.body)) : `status ${r.status}`);
  const [first, second, hidden, none, missing] = runs;
  if (page(first) !== '[12,10]' || first.body.hasNext !== true) return '① yuna 첫 페이지 — 12 · 10 · hasNext true';
  if (JSON.stringify(first.body.items.map((r) => r.productName)) !== JSON.stringify(['무선 이어폰', '텀블러'])) return '① 리뷰마다 상품 이름 — 무선 이어폰 · 텀블러';
  if (page(second) !== '[5,1]' || second.body.hasNext !== false || second.body.nextCursor !== null) return '② 둘째 페이지 — 5 · 1 · hasNext false · nextCursor null';
  if (page(hidden) !== '[11,7]') return '③ sujin — 11 · 7(숨긴 3 없음)';
  if (none.status !== 200 || JSON.stringify(none.body) !== JSON.stringify({ items: [], hasNext: false, nextCursor: null })) return '④ 리뷰를 쓰지 않은 사람 — 빈 목록';
  if (missing.status !== 404 || JSON.stringify(missing.body) !== JSON.stringify({ message: '그런 사람은 없어요' })) return '⑤ 없는 사람 — 404 «그런 사람은 없어요»';
  return null;
};

describe('축 ④ 과제 [응용] — 한 사람이 쓴 리뷰 모아 보기(최신순 커서 · 상품 이름 · 숨긴 리뷰 빼기)', () => {
  it('🔴 정답 판 — homework2.http 다섯 · yuna 12 · 10 → 5 · 1 · sujin 11 · 7 · jisoo 빈 목록 · 없는 사람 404 · 줄의 필드는 id · productId · productName · content · createdAt', async () => {
    const httpText = fileAt('homework2', `${LAB}/homework2.http`);
    expect(blocksOf(httpText)).toEqual(H2_HTTP);
    const source = fileAt('homework2', `${LAB}/homework2.js`);
    expect(source).toContain("import { encodeCursor, decodeCursor } from '../../utils/cursor.js';");
    const runs = await sendHttp('homework2', 'homework2', source, httpText);
    expect(checkHomework2(runs)).toBe(null);
    expect(Object.keys(runs[0].body.items[0])).toEqual(['id', 'productId', 'productName', 'content', 'createdAt']);
    // 커서는 공용 커서 그대로 — 최신순 한 방향뿐이라 방향을 담지 않는다
    expect(JSON.parse(Buffer.from(runs[0].body.nextCursor, 'base64url').toString())).toEqual({ createdAt: '2026-11-08T15:10:00.000Z', id: 10 });
    const more = await withLab('homework2', 'homework2', source, async ({ base }) => {
      const get = async (path) => { const r = await fetch(`${base}${path}`); return [r.status, await r.json()]; };
      return { all: await get('/api/users/1/reviews'), taeyang: await get('/api/users/4/reviews'), bad: await get('/api/users/1/reviews?cursor=abc'), notNumber: await get('/api/users/abc/reviews') };
    });
    expect([ids(more.all[1]), more.all[1].hasNext]).toEqual([[12, 10, 5, 1], false]);
    expect(ids(more.taeyang[1])).toEqual([4]);
    expect(more.bad).toEqual([400, { message: '커서 값이 올바르지 않아요' }]);
    expect(more.notNumber).toEqual([404, { message: '그런 사람은 없어요' }]);
    seen.homework2 = { http: httpText, runs: runs.map((r) => ({ title: r.title, status: r.status, body: r.rawBody })), more };
  }, 60_000);

  it('🔴 다른 정답 판 — 주소를 상품을 가로지르는 필터(GET /api/reviews?authorId=)로 지어도 같은 확인 절차를 지난다', async () => {
    const source = read(P('snapshots/p3-53/homework2-filter.js'));
    const httpText = read(P('snapshots/p3-53/homework2-filter.http'));
    expect(blocksOf(httpText).map(([title]) => title)).toEqual(H2_HTTP.map(([title]) => title));
    const runs = await sendHttp('homework2', 'homework2', source, httpText);
    expect(checkHomework2(runs)).toBe(null);
    const noAuthor = await withLab('homework2', 'homework2', source, async ({ base }) => {
      const r = await fetch(`${base}/api/reviews`);
      return [r.status, await r.json()];
    });
    expect(noAuthor).toEqual([400, { message: '보낸 내용이 규칙에 안 맞아요' }]);
    seen.homework2Filter = { http: httpText, runs: runs.map((r) => ({ title: r.title, status: r.status, body: r.rawBody })), noAuthor };
  }, 60_000);

  it('🔴 틀린 판마다 확인 절차가 처음 어긋나는 곳이 다르다 — 오래된 순으로 둠 · 커서 다음을 오래된 순 조건으로 · 상품 이름 없음 · 숨긴 리뷰를 안 뺌 · 없는 사람에 빈 목록', async () => {
    const answer = fileAt('homework2', `${LAB}/homework2.js`);
    const httpText = fileAt('homework2', `${LAB}/homework2.http`);
    const wrongs = {
      oldestSort: variant(answer, '.sort(byNewest)', '.sort((a, b) => byNewest(b, a))'),
      oldestCondition: variant(answer, 'return (review) => review.createdAt <= createdAt && (review.createdAt < createdAt || review.id < id);', 'return (review) => review.createdAt >= createdAt && (review.createdAt > createdAt || review.id > id);'),
      noProductName: variant(answer, '    productName: product.name,\n', ''),
      hiddenKept: variant(answer, 'review.authorId === userId && !review.hidden', 'review.authorId === userId'),
      emptyForMissing: variant(answer, '  if (!user) {\n', '  if (false) {\n'),
    };
    const out = {};
    for (const [name, source] of Object.entries(wrongs)) {
      const runs = await sendHttp('homework2', 'homework2', source, httpText, PORTS.wrong);
      out[name] = { first: checkHomework2(runs), statuses: runs.map((r) => r.status), pages: runs.map((r) => (r.status === 200 ? ids(r.body) : r.rawBody)) };
    }
    expect(out.oldestSort.first).toBe('① yuna 첫 페이지 — 12 · 10 · hasNext true');
    expect(out.oldestSort.pages[0]).toEqual([1, 5]);
    expect(out.oldestCondition.first).toBe('② 둘째 페이지 — 5 · 1 · hasNext false · nextCursor null');
    expect(out.oldestCondition.pages[1]).toEqual([12]);
    expect(out.noProductName.first).toBe('① 리뷰마다 상품 이름 — 무선 이어폰 · 텀블러');
    expect(out.hiddenKept.first).toBe('③ sujin — 11 · 7(숨긴 3 없음)');
    expect(out.hiddenKept.pages[2]).toEqual([11, 7, 3]);
    expect(out.emptyForMissing.first).toBe('⑤ 없는 사람 — 404 «그런 사람은 없어요»');
    expect(out.emptyForMissing.pages[4]).toEqual([]);
    seen.homework2Wrong = out;
  }, 90_000);
});

// ── 축 ⑤ 학생 파일 차이 ─────────────────────────────────────────────────────────
describe('축 ⑤ 실습 커밋 — lab/p3-53/ 만 · 차례 · 경로 주석 · 쓰지 않기로 한 낱말', () => {
  it('🔴 실습 커밋(제목 끝 표식이 같으면 가장 뒤)은 lab/p3-53/ 만 고친다 · 1 → 2 → 과제 차례 · 끝의 lab/p3-53/ 은 파일 여덟', () => {
    const step5 = execFileSync('git', ['log', '-n', '400', '--format=%H %s', LINE], { cwd: P('.'), encoding: 'utf8' }).split('\n').find((l) => / feat\(p3-53\): /.test(l) && l.endsWith('(Step 5)')).split(' ')[0];
    const own = (c) => execFileSync('git', ['diff', '--name-only', `${c}^`, c], { cwd: P('.'), encoding: 'utf8' }).trim().split('\n');
    const [c1, c2, h2] = ['practice1', 'practice2', 'homework2'].map((w) => commitOf(COMMITS[w]));
    for (const c of [c1, c2, h2]) expect(own(c).every((n) => n.startsWith(`${LAB}/`))).toBe(true);
    const order = execFileSync('git', ['log', '--format=%H', `${step5}..${LINE}`], { cwd: P('.'), encoding: 'utf8' }).trim().split('\n').reverse();
    expect([order.indexOf(c1) < order.indexOf(c2), order.indexOf(c2) < order.indexOf(h2)]).toEqual([true, true]);
    const files = execFileSync('git', ['ls-tree', '--name-only', `${h2}:${LAB}`], { cwd: P('.'), encoding: 'utf8' }).trim().split('\n');
    expect(files).toEqual(['homework2.http', 'homework2.js', 'many-comments.sql', 'practice1.http', 'practice1.js', 'practice2.http', 'practice2.js', 'shop-data.js']);
    const banned = /자리|박다|박아|박힌|결[이을로의]|갈래|몸통|판[이을으]|겹|까닭|걸리|걸린|돌리|돌려(?!주|준|줄)|가르|갈리|재다|재서|벗기|되살|짝/;
    for (const rel of ['shop-data.js', 'practice1.js', 'practice2.js', 'homework2.js']) {
      const text = execFileSync('git', ['show', `${h2}:${LAB}/${rel}`], { cwd: P('.'), encoding: 'utf8' });
      expect([rel, text.split('\n')[0]]).toEqual([rel, `// ~/instagram-api/${LAB}/${rel}`]);
      expect([rel, text.split('\n').filter((line) => banned.test(line))]).toEqual([rel, []]);
      expect([rel, /게이트|판정|TDD|Step \d|회차|스냅숏/.test(text)]).toEqual([rel, false]);
    }
    for (const rel of ['practice1-start.js', 'practice2-start.js', 'homework2-filter.js']) {
      const text = read(P(`snapshots/p3-53/${rel}`));
      expect([rel, text.split('\n').filter((line) => banned.test(line))]).toEqual([rel, []]);
    }
    expect(read(P('snapshots/p3-53/homework2-filter.js')).split('\n')[0]).toBe(`// ~/instagram-api/${LAB}/homework2.js`);
  });
});

// ── 축 ⑥ 교안 대조(실습) ─────────────────────────────────────────────────────────
// 원고는 읽기만 한다. 경로는 `P353_LECTURE` 로만 받는다(원고가 계속 바뀌는 중) — 없으면 건너뛰고 크게 찍는다.
const LECTURE_MD = process.env.P353_LECTURE ?? null;
if (!LECTURE_MD) console.log('\n🚨🚨🚨 실습 축 ⑥ 교안 대조 — 건너뜀 (P353_LECTURE 가 없다) 🚨🚨🚨\n');
const describeLecture = LECTURE_MD ? describe : describe.skip;
const lectureLines = () => read(LECTURE_MD).split('\n');
const fencesOf = (file) => {
  const out = [];
  let cur = null;
  let details = false;
  read(file).split('\n').forEach((line, i) => {
    if (cur) {
      if (line.startsWith('```')) { out.push(cur); cur = null; } else cur.body.push(line);
      return;
    }
    if (line.startsWith('```')) { cur = { lang: line.slice(3).trim(), body: [], line: i + 1, details }; return; }
    if (line.startsWith('<details>')) details = true;
    if (line.startsWith('</details>')) details = false;
  });
  return out;
};
const isElision = (line) => ['// ...', '...'].includes(line.trim());
const howIn = (body, file) => {
  const text = body.join('\n');
  if (text + '\n' === file || text === file) return 'full';
  if (!body.some(isElision)) return null;
  let at = 0;
  const lines = file.split('\n');
  for (const line of body.filter((one) => one.trim() !== '' && !isElision(one))) {
    const found = lines.indexOf(line, at);
    if (found === -1) return null;
    at = found + 1;
  }
  return 'excerpt';
};
/** 실습 절 하나 — 머리 줄부터 다음 «### » 머리 앞까지. */
const sectionOf = (heading) => {
  const lines = lectureLines();
  const start = lines.findIndex((line) => line.startsWith('### ') && line.includes(heading));
  if (start === -1) throw new Error(`교안에 «${heading}» 절이 없다`);
  const end = lines.findIndex((line, i) => i > start && /^#{2,3} /.test(line) && !line.includes('💡'));
  return { start: start + 1, lines: lines.slice(start, end === -1 ? undefined : end) };
};
/** 절의 «확인» 목록 — 번호 붙은 줄들. */
const checksOf = (section) => {
  const at = section.lines.indexOf('**확인**');
  const out = [];
  for (const line of section.lines.slice(at + 1)) {
    if (/^\d+\. /.test(line)) out.push(line);
    else if (out.length > 0) break;
  }
  return out;
};
/** 절의 «이렇게 쓰면 | 처음 달라지는 곳» 표 — 머리와 구분 줄을 뺀 행들. */
const tableOf = (section) => {
  // 절 안의 마크다운 표 가운데 머리가 «이렇게 쓰면 | 처음 달라지는 곳» 인 것 하나 — 절에는 «나눠 드리는 파일» 같은 다른 표도 있다
  const at = section.lines.findIndex((line) => /^\|\s*이렇게 쓰면\s*\|\s*처음 달라지는 곳\s*\|$/.test(line.trim()));
  if (at === -1) return [];
  const rows = [];
  for (const line of section.lines.slice(at + 1)) {
    if (!line.startsWith('|')) break;
    if (/^\|[\s:|-]+\|$/.test(line.trim())) continue;
    rows.push(line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim()));
  }
  return rows;
};
const seqOf = (text) => [...text.matchAll(/(\d+(?: · \d+)+)번/g)].map(([, s]) => s.split(' · ').map(Number));
const statusOf = (text) => [...text.matchAll(/(?<!\d)(200|400|404|500)(?!\d)/g)].map(([, s]) => Number(s));
const messageOf = (text) => /`message`가 «([^»]+)»/.exec(text)?.[1] ?? null;
/** 확인 한 줄을 응답 하나와 맞댄다 — 적힌 값(번호 차례 · 상태 · message · hasNext · nextCursor · 개수 · 첫 이름)만 본다. 어긋난 것을 돌려준다. */
const facetLog = new Map();
const itemProblems = (item, res, extra = {}) => {
  const out = [];
  const facets = [];
  facetLog.set(item, facets);

  const body = res.body;
  const list = res.status === 200 ? (Array.isArray(body) ? body : body.items) : null;
  const seqs = seqOf(item);
  if (seqs.length > 0 && JSON.stringify(seqs[0]) !== JSON.stringify(list ? list.map((r) => r.id) : null)) out.push(['번호 차례', seqs[0], list && list.map((r) => r.id)]);
  const statuses = statusOf(item);
  if (statuses.length > 0 && statuses[0] !== res.status) out.push(['상태', statuses[0], res.status]);
  const message = messageOf(item);
  if (message !== null && body?.message !== message) out.push(['message', message, body?.message]);
  if (item.includes('`hasNext`가 `true`') && body?.hasNext !== true) out.push(['hasNext true', true, body?.hasNext]);
  if (item.includes('`hasNext`가 `false`') && body?.hasNext !== false) out.push(['hasNext false', false, body?.hasNext]);
  if (item.includes('`nextCursor`가 `null`') && body?.nextCursor !== null) out.push(['nextCursor null', null, body?.nextCursor]);
  const prefix = /`nextCursor`가 `([a-z]+\.)`로 시작/.exec(item)?.[1];
  if (prefix && !String(body?.nextCursor).startsWith(prefix)) out.push(['nextCursor 앞', prefix, body?.nextCursor]);
  const count = /리뷰 (\d+)개/.exec(item)?.[1];
  if (count && Number(count) !== list?.length) out.push(['개수', Number(count), list?.length]);
  const firstName = /첫 리뷰는 `"(\w+)"`/.exec(item)?.[1];
  if (firstName && list?.[0]?.username !== firstName) out.push(['첫 이름', firstName, list?.[0]?.username]);
  if (item.includes('본문이 `[]`') && JSON.stringify(body) !== '[]') out.push(['본문 []', '[]', JSON.stringify(body)]);
  const json = /`(\{ "items": .*?\})`/.exec(item)?.[1];
  if (json && JSON.stringify(JSON.parse(json)) !== JSON.stringify(body)) out.push(['본문', json, JSON.stringify(body)]);
  if (seqs.length > 0) facets.push('번호 차례');
  if (statuses.length > 0) facets.push('상태');
  if (message !== null) facets.push('message');
  for (const [mark, name] of [['`hasNext`가 `true`', 'hasNext'], ['`hasNext`가 `false`', 'hasNext'], ['`nextCursor`가 `null`', 'nextCursor'], ['본문이 `[]`', '본문']]) if (item.includes(mark)) facets.push(name);
  if (prefix) facets.push('nextCursor 앞');
  if (count) facets.push('개수');
  if (firstName) facets.push('첫 이름');
  if (json) facets.push('본문');
  if (extra.names) {
    const names = [...item.matchAll(/«([^»]+)»/g)].map(([, n]) => n).filter((n) => extra.names.includes(n) || !/[ —]/.test(n));
    const got = list?.map((r) => r.productName);
    if (names.length > 0 && JSON.stringify(names) !== JSON.stringify(got)) out.push(['상품 이름', names, got]);
    if (names.length > 0) facets.push('상품 이름');
  }
  return out;
};
/** 확인 줄마다 적어도 하나는 맞대 봤는가 — 맞댄 것이 없으면 «통과» 가 거짓이다. */
const unchecked = (items) => items.filter((item) => (facetLog.get(item) ?? []).length === 0);
/** 표 한 행을 그 틀린 판의 실측과 맞댄다 — 첫 «확인 N» 이 처음 달라지는 확인이고, 칸 안의 «확인 N» 마다 그 뒤 글(번호 차례 · 개수 · 셋째 · 상태 · message · 커서 앞 · ReferenceError)을 그 확인의 응답과 맞댄다. */
const rowProblems = (cell, wrong, firstOf, requestOf = (n) => n - 1) => {
  const out = [];
  const marks = [...cell.matchAll(/확인 (\d+)/g)];
  if (Number(marks[0]?.[1]) !== firstOf) out.push(['처음 달라지는 확인', Number(marks[0]?.[1]), firstOf]);
  marks.forEach((mark, k) => {
    const segment = cell.slice(mark.index, marks[k + 1]?.index ?? cell.length);
    const n = Number(mark[1]);
    const res = wrong.runs[requestOf(n)];
    if (!res) { out.push([`확인 ${n}`, '응답 없음', null]); return; }
    const list = res.status === 200 ? (Array.isArray(res.body) ? res.body : res.body.items) : null;
    const seqs = seqOf(segment);
    if (seqs.length > 0 && JSON.stringify(seqs.at(-1)) !== JSON.stringify(list?.map((r) => r.id) ?? null)) out.push([`확인 ${n} 번호 차례`, seqs.at(-1), list?.map((r) => r.id)]);
    const count = /(\d+)개\)/.exec(segment)?.[1];
    if (count && Number(count) !== list?.length) out.push([`확인 ${n} 개수`, Number(count), list?.length]);
    const third = /셋째가 (\d+)번/.exec(segment)?.[1];
    if (third && Number(third) !== list?.[2]?.id) out.push([`확인 ${n} 셋째`, Number(third), list?.[2]?.id]);
    const statuses = statusOf(segment);
    if (statuses.length > 0 && statuses[0] !== res.status) out.push([`확인 ${n} 상태`, statuses[0], res.status]);
    if (segment.includes('`[]`') && JSON.stringify(res.body) !== '[]') out.push([`확인 ${n} 본문 []`, '[]', res.rawBody]);
    const message = /«([^»]+)»/.exec(segment)?.[1];
    if (message && res.status !== 200 && res.body?.message !== message) out.push([`확인 ${n} message`, message, res.body?.message]);
    const starts = /`([A-Za-z]+\.?)`로 시작/.exec(segment)?.[1];
    if (starts && !String(res.body?.nextCursor).startsWith(starts)) out.push([`확인 ${n} 커서 앞`, starts, res.body?.nextCursor]);
    if (segment.includes('ReferenceError: ____ is not defined') && !wrong.log?.includes('ReferenceError: ____ is not defined')) out.push(['터미널', 'ReferenceError: ____ is not defined', '(없음)']);
  });
  return out;
};
const circled = (label) => '①②③④⑤⑥'.indexOf(label?.[0]) + 1;
const labProblems = [];
afterAll(() => {
  if (process.env.P353_LAB_LECTURE_REPORT) writeFileSync(process.env.P353_LAB_LECTURE_REPORT, JSON.stringify(labProblems, null, 2));
});

describeLecture(LECTURE_MD ? '축 ⑥ 교안 대조 — 실습 블록 · 확인 목록 · «처음 달라지는 곳» 표' : '🚨 건너뜀(P353_LECTURE 없음) — 실습 축 ⑥ 교안 대조', () => {
  it('🔴 실습 블록 넷 — 직접 해보기 1 빈칸 판 전문 · 해설 발췌 · 직접 해보기 2 빈칸 판 발췌 · 해설 발췌', () => {
    const blocks = fencesOf(LECTURE_MD).filter((fence) => fence.lang === 'javascript' && (fence.body[0] ?? '').startsWith(`// ~/instagram-api/${LAB}/`));
    const found = blocks.map((fence) => {
      const name = fence.body[0].slice(`// ~/instagram-api/${LAB}/`.length).replace('.js', '');
      const source = fence.details ? fileAt(name, `${LAB}/${name}.js`) : read(P(`snapshots/p3-53/${name}-start.js`));
      const how = howIn(fence.body, source);
      if (!how) labProblems.push({ where: `${fence.line}번 줄 ${name} ${fence.details ? '해설' : '빈칸 판'}`, problem: '판 파일과 안 맞는다' });
      return [name, fence.details ? 'solution' : 'start', how];
    });
    expect(found).toEqual([['practice1', 'start', 'full'], ['practice1', 'solution', 'excerpt'], ['practice2', 'start', 'excerpt'], ['practice2', 'solution', 'excerpt']]);
  });

  it('🔴 직접 해보기 1 — 확인 넷이 정답 판 응답과 글자대로 · 표 세 행이 틀린 판의 처음 달라지는 곳과 같다', async () => {
    const section = sectionOf('직접 해보기 — 상품 리뷰 목록');
    const items = checksOf(section);
    expect(items).toHaveLength(4);
    const httpText = fileAt('practice1', `${LAB}/practice1.http`);
    const answer = fileAt('practice1', `${LAB}/practice1.js`);
    const runs = await sendHttp('practice1', 'practice1', answer, httpText);
    const map = [0, 0, 1, 2];
    const problems = items.flatMap((item, i) => itemProblems(item, runs[map[i]]).map((p) => ({ where: `직접 해보기 1 확인 ${i + 1}`, item, problem: p })));
    expect(unchecked(items)).toEqual([]);
    const wrongs = {
      hiddenKept: { match: '`!review.hidden`', source: variant(answer, 'review.productId === productId && !review.hidden', 'review.productId === productId') },
      emptyForMissing: { match: '`if`를 통째로', source: variant(answer, '  if (!product) {\n', '  if (false) {\n') },
      blank: { match: '빈칸을 하나라도', source: read(P('snapshots/p3-53/practice1-start.js')) },
    };
    for (const [name, w] of Object.entries(wrongs)) {
      w.runs = await withLab('practice1', 'practice1', w.source, async ({ tail }) => {
        const out = await httpyac(httpText, PORTS.practice1);
        await sleep(200);
        w.log = tail();
        return out;
      });
      w.first = circled(checkPractice1(w.runs));
    }
    expect(tableOf(section)).toHaveLength(3);
    for (const row of tableOf(section)) {
      const key = Object.keys(wrongs).find((k) => row[0].includes(wrongs[k].match));
      if (!key) { problems.push({ where: '직접 해보기 1 표', row, problem: '어느 틀린 판인지 모르는 행' }); continue; }
      problems.push(...rowProblems(row[1], wrongs[key], wrongs[key].first, (n) => map[n - 1]).map((p) => ({ where: `직접 해보기 1 표 «${row[0]}»`, cell: row[1], problem: p })));
    }
    labProblems.push(...problems);
    expect(problems).toEqual([]);
  }, 90_000);

  it('🔴 직접 해보기 2 — 확인 여섯이 정답 판 응답과 글자대로 · 표 다섯 행이 틀린 판의 처음 달라지는 곳과 같다', async () => {
    const section = sectionOf('직접 해보기 — 리뷰 목록에 두 방향');
    const items = checksOf(section);
    expect(items).toHaveLength(6);
    const httpText = fileAt('practice2', `${LAB}/practice2.http`);
    const answer = fileAt('practice2', `${LAB}/practice2.js`);
    const runs = await sendHttp('practice2', 'practice2', answer, httpText);
    const problems = items.flatMap((item, i) => itemProblems(item, runs[i]).map((p) => ({ where: `직접 해보기 2 확인 ${i + 1}`, item, problem: p })));
    expect(unchecked(items)).toEqual([]);
    const NEWEST_AFTER = 'return (review) => review.createdAt <= createdAt && (review.createdAt < createdAt || review.id < id);';
    const wrongs = {
      noOrderCheck: { match: '방향을 확인하는 `if`', source: variant(answer, '    if (cursorOrder !== order) {\n', '    if (false) {\n') },
      notFlipped: { match: '오래된 순 조건 그대로', source: variant(answer, NEWEST_AFTER, 'return (review) => review.createdAt >= createdAt && (review.createdAt > createdAt || review.id > id);') },
      newestTimeOnly: { match: '번호 비교를 빼요', source: variant(answer, NEWEST_AFTER, 'return (review) => review.createdAt < createdAt;') },
      noPrefix: { match: '방향을 안 붙여요', source: variant(answer, 'return `${order}.${encodeCursor(review)}`;', 'return encodeCursor(review);') },
      sortNotFlipped: { match: '`byNewest`가', source: variant(answer, '  return byOldest(b, a);\n', '  return byOldest(a, b);\n') },
    };
    for (const w of Object.values(wrongs)) {
      w.runs = await sendHttp('practice2', 'practice2', w.source, httpText, PORTS.wrong);
      w.first = circled(checkPractice2(w.runs));
    }
    expect(tableOf(section)).toHaveLength(5);
    for (const row of tableOf(section)) {
      const key = Object.keys(wrongs).find((k) => row[0].includes(wrongs[k].match));
      if (!key) { problems.push({ where: '직접 해보기 2 표', row, problem: '어느 틀린 판인지 모르는 행' }); continue; }
      problems.push(...rowProblems(row[1], wrongs[key], wrongs[key].first).map((p) => ({ where: `직접 해보기 2 표 «${row[0]}»`, cell: row[1], problem: p })));
    }
    labProblems.push(...problems);
    expect(problems).toEqual([]);
  }, 120_000);

  it('🔴 과제 [응용] — 확인 다섯이 정답 판(사람 아래 주소)과 다른 정답 판(?authorId=) 둘 다에서 글자대로', async () => {
    const section = sectionOf('[응용] 한 사람이 쓴 리뷰 모아 보기');
    const items = checksOf(section);
    expect(items).toHaveLength(5);
    const answers = {
      '/api/users/:id/reviews': [fileAt('homework2', `${LAB}/homework2.js`), fileAt('homework2', `${LAB}/homework2.http`)],
      '/api/reviews?authorId=': [read(P('snapshots/p3-53/homework2-filter.js')), read(P('snapshots/p3-53/homework2-filter.http'))],
    };
    const problems = [];
    for (const [label, [source, httpText]] of Object.entries(answers)) {
      const runs = await sendHttp('homework2', 'homework2', source, httpText);
      items.forEach((item, i) => problems.push(...itemProblems(item, runs[i], { names: ['무선 이어폰', '텀블러'] }).map((p) => ({ where: `과제 [응용] 확인 ${i + 1} (${label})`, item, problem: p }))));
    }
    expect(unchecked(items)).toEqual([]);
    labProblems.push(...problems);
    expect(problems).toEqual([]);
  }, 60_000);
});
