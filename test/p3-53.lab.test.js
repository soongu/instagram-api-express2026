// p3-53 「댓글 보기」 게이트 — 백엔드 실습(직접 해보기 1 · 2 · 과제 [응용])
// 내부 검증 전용 — 교안에 한 줄도 인용하지 않는다.
//
// 소재는 상품 리뷰 — 메모리 배열(lab/p3-53/shop-data.js)로 답하는 Express 실습 서버다(데이터베이스를 안 쓴다).
// 학생 쪽 포트는 4001 · 판정은 사본의 포트 두 곳(app.listen 의 수 · 기다린다는 문장)만 바꿔 3892~3895 로 띄운다.
// 커밋 — 제목 끝이 «(직접 해보기 1)» · «(직접 해보기 2)» · «(과제 [응용])» 인 feat(p3-53) 커밋. `P353_LAB_WT=1` 이면 작업트리를 읽는다.
// 나눠 주는 빈칸 판은 snapshots/p3-53/practice1-start.js · practice2-start.js(학생 파일이 아니라 경로 주석은 학생 쪽 표기 그대로 둔다 — 교안 블록과 같게).
//
// 축 ① 나눠 주는 파일 — shop-data.js 의 사람 넷 · 상품 셋 · 리뷰 열둘 · 숨긴 리뷰 · 같은 시각 둘 · 빈칸 판이 비운 채로 node --check 를 지난다
// 축 ② 직접 해보기 1 — 정답 판 · 틀린 판(숨긴 리뷰를 안 뺌 · 404 대신 [] · 이름을 안 붙임) × practice1.http
// 축 ③ 직접 해보기 2 — 정답 판 · 틀린 판(게시물 커서 조건 그대로 · 같은 시각에서 번호 비교 빠짐 · limit 그대로 · 숨긴 리뷰를 안 뺌) × practice2.http
// 축 ④ 과제 [응용] — 정답 판 · 틀린 판(방향 확인 없음 · 최신순 조건을 안 뒤집음) × homework2.http
// 축 ⑤ 학생 파일 차이 — 실습 커밋은 lab/p3-53/ 만 · 경로 주석 · 쓰지 않기로 한 낱말
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
  it('🔴 shop-data.js — 사람 넷 · 상품 셋(3번은 리뷰 0) · 리뷰 열둘(1번 상품 열 · 2번 상품 둘) · 숨긴 리뷰 둘(3 · 9) · 4번과 5번은 시각이 같다 · 번호 차례가 시각 차례다', async () => {
    const dir = studentCopy('practice1');
    const data = await import(join(dir, LAB, 'shop-data.js'));
    expect(data.users.map((u) => u.username)).toEqual(['yuna', 'minho', 'sujin', 'taeyang']);
    expect(data.products.map((p) => p.id)).toEqual([1, 2, 3]);
    expect(data.reviews).toHaveLength(12);
    expect(data.reviews.map((r) => r.id)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    expect([1, 2, 3].map((id) => data.reviews.filter((r) => r.productId === id).length)).toEqual([10, 2, 0]);
    expect(data.reviews.filter((r) => r.hidden).map((r) => r.id)).toEqual([3, 9]);
    expect(data.reviews.every((r) => /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.000Z$/.test(r.createdAt) && typeof r.hidden === 'boolean')).toBe(true);
    expect(data.reviews[3].createdAt).toBe(data.reviews[4].createdAt);
    const times = data.reviews.map((r) => r.createdAt);
    expect(times).toEqual(times.slice().sort());
    expect(new Set(times).size).toBe(11);
    expect(read(join(dir, LAB, 'shop-data.js')).split('\n')[0]).toBe('// ~/instagram-api/lab/p3-53/shop-data.js');
  });

  it('🔴 빈칸 판 둘 — 비운 채로 node --check 를 지난다 · 정답 판과 다른 줄은 빈칸이 든 줄뿐 · 직접 해보기 1 은 넷 · 2 는 셋', () => {
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
    expect(results.practice2).toHaveLength(3);
    // 직접 해보기 2 의 빈칸은 커서 다음 조건 · 하나 더 꺼내기 · nextCursor
    expect(results.practice2.map((b) => b.answer.trim())).toEqual([
      'return (review) => review.createdAt >= createdAt && (review.createdAt > createdAt || review.id > id);',
      'const rows = list.slice(0, limit + 1);',
      'nextCursor: hasNext ? encodeCursor(page[page.length - 1]) : null,',
    ]);
    // 직접 해보기 2 의 빈칸 판은 직접 해보기 1 의 정답 판을 복사해 시작한다 — 1 의 함수 둘이 글자 그대로 있다
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
const checkPractice1 = (runs) => {
  const [one, three, missing] = runs;
  if (one.status !== 200) return '1번 상품 — 상태';
  if (JSON.stringify(ids(one.body)) !== JSON.stringify([1, 2, 4, 5, 7, 8, 11, 12])) return '1번 상품 — 리뷰 여덟이 1 · 2 · 4 · 5 · 7 · 8 · 11 · 12 차례';
  if (!one.body.every((r) => typeof r.username === 'string')) return '1번 상품 — 줄마다 username';
  if (three.status !== 200 || JSON.stringify(three.body) !== '[]') return '3번 상품 — 200 []';
  if (missing.status !== 404 || JSON.stringify(missing.body) !== JSON.stringify({ message: '그런 상품은 없어요' })) return '99번 상품 — 404 «그런 상품은 없어요»';
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
    expect(out.hiddenKept.first).toBe('1번 상품 — 리뷰 여덟이 1 · 2 · 4 · 5 · 7 · 8 · 11 · 12 차례');
    expect(out.hiddenKept.one).toEqual([1, 2, 3, 4, 5, 7, 8, 9, 11, 12]);
    expect(out.emptyForMissing.first).toBe('99번 상품 — 404 «그런 상품은 없어요»');
    expect(out.emptyForMissing.missing).toEqual([200, '[]']);
    expect(out.noName.first).toBe('1번 상품 — 줄마다 username');
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
  ['1번 상품의 리뷰 — 첫 페이지', 'GET http://localhost:4001/api/products/1/reviews?limit=3'],
  ['둘째 페이지', 'GET http://localhost:4001/api/products/1/reviews?limit=3&cursor={{first.nextCursor}}'],
  ['셋째 페이지', 'GET http://localhost:4001/api/products/1/reviews?limit=3&cursor={{second.nextCursor}}'],
  ['커서가 아닌 값', 'GET http://localhost:4001/api/products/1/reviews?limit=3&cursor=abc'],
];
/** 직접 해보기 2 의 «확인». */
const checkPractice2 = (runs) => {
  const [first, second, third, bad] = runs;
  if (first.status !== 200 || JSON.stringify(ids(first.body)) !== '[1,2,4]' || first.body.hasNext !== true) return '첫 페이지 — 1 · 2 · 4 · hasNext true';
  if (second.status !== 200 || JSON.stringify(ids(second.body)) !== '[5,7,8]' || second.body.hasNext !== true) return '둘째 페이지 — 5 · 7 · 8 · hasNext true';
  if (third.status !== 200 || JSON.stringify(ids(third.body)) !== '[11,12]' || third.body.hasNext !== false || third.body.nextCursor !== null) return '셋째 페이지 — 11 · 12 · hasNext false · nextCursor null';
  if (bad.status !== 400 || JSON.stringify(bad.body) !== JSON.stringify({ message: '커서 값이 올바르지 않아요' })) return '커서가 아닌 값 — 400 «커서 값이 올바르지 않아요»';
  return null;
};
const P2_AFTER = 'return (review) => review.createdAt >= createdAt && (review.createdAt > createdAt || review.id > id);';

describe('축 ③ 직접 해보기 2 — 오래된 순 커서', () => {
  it('🔴 정답 판 — practice2.http 넷 · 1 · 2 · 4 → 5 · 7 · 8(같은 시각 4 · 5 가 경계에 걸린다) → 11 · 12 끝 · 커서가 아닌 값 400 · 커서는 { createdAt, id } base64url', async () => {
    const httpText = fileAt('practice2', `${LAB}/practice2.http`);
    expect(blocksOf(httpText)).toEqual(P2_HTTP);
    const runs = await sendHttp('practice2', 'practice2', fileAt('practice2', `${LAB}/practice2.js`), httpText);
    expect(checkPractice2(runs)).toBe(null);
    expect(JSON.parse(Buffer.from(runs[0].body.nextCursor, 'base64url').toString())).toEqual({ createdAt: '2026-11-03T21:40:00.000Z', id: 4 });
    expect(Object.keys(runs[0].body)).toEqual(['items', 'hasNext', 'nextCursor']);
    // 기본 5 · 50 이 넘으면 400
    const more = await withLab('practice2', 'practice2', fileAt('practice2', `${LAB}/practice2.js`), async ({ base }) => ({
      plain: await (await fetch(`${base}/api/products/1/reviews`)).json(),
      tooMany: await fetch(`${base}/api/products/1/reviews?limit=51`).then(async (r) => [r.status, await r.json()]),
      missing: await fetch(`${base}/api/products/99/reviews`).then(async (r) => [r.status, await r.json()]),
      empty: await (await fetch(`${base}/api/products/3/reviews`)).json(),
    }));
    expect([ids(more.plain), more.plain.hasNext]).toEqual([[1, 2, 4, 5, 7], true]);
    expect(more.tooMany).toEqual([400, { message: '보낸 내용이 규칙에 안 맞아요' }]);
    expect(more.missing).toEqual([404, { message: '그런 상품은 없어요' }]);
    expect(more.empty).toEqual({ items: [], hasNext: false, nextCursor: null });
    seen.practice2 = { http: httpText, runs: runs.map((r) => ({ title: r.title, status: r.status, url: r.url, body: r.rawBody })) };
  }, 60_000);

  it('🔴 틀린 판마다 확인 절차가 처음 어긋나는 곳이 다르다 — 게시물 조건 그대로(둘째 페이지가 1 · 2) · 번호 비교 빠짐(5 가 빠진다) · limit 그대로(첫 페이지부터 끝) · 숨긴 리뷰를 안 뺌(첫 페이지에 3)', async () => {
    const answer = fileAt('practice2', `${LAB}/practice2.js`);
    const httpText = fileAt('practice2', `${LAB}/practice2.http`);
    const wrongs = {
      postDirection: variant(answer, P2_AFTER, 'return (review) => review.createdAt <= createdAt && (review.createdAt < createdAt || review.id < id);'),
      timeOnly: variant(answer, P2_AFTER, 'return (review) => review.createdAt > createdAt;'),
      takeLimit: variant(answer, 'list.slice(0, limit + 1)', 'list.slice(0, limit)'),
      hiddenKept: variant(answer, 'review.productId === productId && !review.hidden', 'review.productId === productId'),
    };
    const out = {};
    for (const [name, source] of Object.entries(wrongs)) {
      const runs = await sendHttp('practice2', 'practice2', source, httpText, PORTS.wrong);
      out[name] = { first: checkPractice2(runs), pages: runs.slice(0, 3).map((r) => (r.status === 200 ? [ids(r.body), r.body.hasNext] : [r.status, r.rawBody])), thirdUrl: runs[2].url };
    }
    expect(out.postDirection.first).toBe('둘째 페이지 — 5 · 7 · 8 · hasNext true');
    expect(out.postDirection.pages[1]).toEqual([[1, 2], false]);
    expect(out.timeOnly.first).toBe('둘째 페이지 — 5 · 7 · 8 · hasNext true');
    expect(out.timeOnly.pages[1]).toEqual([[7, 8, 11], true]);
    expect(out.takeLimit.first).toBe('첫 페이지 — 1 · 2 · 4 · hasNext true');
    expect(out.takeLimit.pages[0]).toEqual([[1, 2, 4], false]);
    expect(out.hiddenKept.first).toBe('첫 페이지 — 1 · 2 · 4 · hasNext true');
    expect(out.hiddenKept.pages[0]).toEqual([[1, 2, 3], true]);
    seen.practice2Wrong = out;
  }, 90_000);
});

// ── 축 ④ 과제 [응용] ──────────────────────────────────────────────────────────
const H2_HTTP = [
  ['오래된 순 — 첫 페이지', 'GET http://localhost:4001/api/products/1/reviews?limit=3'],
  ['최신순 — 첫 페이지', 'GET http://localhost:4001/api/products/1/reviews?order=newest&limit=3'],
  ['최신순 — 둘째 페이지', 'GET http://localhost:4001/api/products/1/reviews?order=newest&limit=3&cursor={{newest.nextCursor}}'],
  ['오래된 순 — 둘째 페이지', 'GET http://localhost:4001/api/products/1/reviews?limit=3&cursor={{oldest.nextCursor}}'],
  ['최신순에 오래된 순의 커서를 보내면', 'GET http://localhost:4001/api/products/1/reviews?order=newest&limit=3&cursor={{oldest.nextCursor}}'],
  ['정렬 값이 틀리면', 'GET http://localhost:4001/api/products/1/reviews?order=popular'],
];
/** 과제 [응용] 의 «확인». */
const checkHomework2 = (runs) => {
  const page = (r) => (r.status === 200 ? JSON.stringify(ids(r.body)) : `status ${r.status}`);
  const [oldest, newest, newest2, oldest2, mixed, wrongOrder] = runs;
  if (page(oldest) !== '[1,2,4]') return '오래된 순 첫 페이지 — 1 · 2 · 4';
  if (page(newest) !== '[12,11,8]') return '최신순 첫 페이지 — 12 · 11 · 8';
  if (page(newest2) !== '[7,5,4]') return '최신순 둘째 페이지 — 7 · 5 · 4';
  if (page(oldest2) !== '[5,7,8]') return '오래된 순 둘째 페이지 — 5 · 7 · 8';
  if (mixed.status !== 400 || JSON.stringify(mixed.body) !== JSON.stringify({ message: '커서와 정렬이 맞지 않아요' })) return '다른 방향의 커서 — 400 «커서와 정렬이 맞지 않아요»';
  if (wrongOrder.status !== 400) return '정렬 값이 틀리면 — 400';
  return null;
};

describe('축 ④ 과제 [응용] — 두 방향 모두 커서로 · 다른 방향의 커서는 400', () => {
  it('🔴 정답 판 — homework2.http 여섯 · 오래된 순 1 · 2 · 4 → 5 · 7 · 8 · 최신순 12 · 11 · 8 → 7 · 5 · 4 · 섞으면 400 · 정렬 값이 틀리면 400 VALIDATION', async () => {
    const httpText = fileAt('homework2', `${LAB}/homework2.http`);
    expect(blocksOf(httpText)).toEqual(H2_HTTP);
    const source = fileAt('homework2', `${LAB}/homework2.js`);
    const runs = await sendHttp('homework2', 'homework2', source, httpText);
    expect(checkHomework2(runs)).toBe(null);
    expect(runs[5].body).toEqual({ message: '보낸 내용이 규칙에 안 맞아요' });
    // 직접 해보기 2 와 같은 주소 · 같은 응답 꼴 — order 가 없으면 직접 해보기 2 와 한 글자도 같다(커서 글자만 다르다 — 방향이 들었다)
    const same = await withLab('homework2', 'homework2', source, async ({ base }) => (await fetch(`${base}/api/products/1/reviews?limit=3`)).json());
    expect(JSON.parse(Buffer.from(same.nextCursor, 'base64url').toString())).toEqual({ createdAt: '2026-11-03T21:40:00.000Z', id: 4, order: 'oldest' });
    seen.homework2 = { http: httpText, runs: runs.map((r) => ({ title: r.title, status: r.status, body: r.rawBody })) };
  }, 60_000);

  it('🔴 틀린 판 — 방향을 확인하지 않으면 섞은 요청이 200 · 최신순 조건을 안 뒤집으면 최신순 둘째 페이지가 첫 페이지 앞쪽', async () => {
    const answer = fileAt('homework2', `${LAB}/homework2.js`);
    const httpText = fileAt('homework2', `${LAB}/homework2.http`);
    const wrongs = {
      noOrderCheck: variant(answer, '    if (after.order !== order) {\n', '    if (false) {\n'),
      notFlipped: variant(answer, "  if (order === 'newest') {\n    return (review) => review.createdAt <= createdAt && (review.createdAt < createdAt || review.id < id);\n  }\n", ''),
    };
    const out = {};
    for (const [name, source] of Object.entries(wrongs)) {
      const runs = await sendHttp('homework2', 'homework2', source, httpText, PORTS.wrong);
      out[name] = { first: checkHomework2(runs), statuses: runs.map((r) => r.status), pages: runs.map((r) => (r.status === 200 ? ids(r.body) : r.rawBody)) };
    }
    expect(out.noOrderCheck.first).toBe('다른 방향의 커서 — 400 «커서와 정렬이 맞지 않아요»');
    expect(out.noOrderCheck.statuses[4]).toBe(200);
    expect(out.notFlipped.first).toBe('최신순 둘째 페이지 — 7 · 5 · 4');
    seen.homework2Wrong = out;
  }, 60_000);
});

// ── 축 ⑤ 학생 파일 차이 ─────────────────────────────────────────────────────────
describe('축 ⑤ 실습 커밋 — lab/p3-53/ 만 · 경로 주석 · 쓰지 않기로 한 낱말', () => {
  it('🔴 Step 5 판에서 실습 셋 — 직접 해보기 1 은 shop-data.js · practice1.js · practice1.http · 2 는 practice2.js · practice2.http · 과제는 homework2.js · homework2.http', () => {
    const step5 = execFileSync('git', ['log', '-n', '400', '--format=%H %s', LINE], { cwd: P('.'), encoding: 'utf8' }).split('\n').find((l) => / feat\(p3-53\): /.test(l) && l.endsWith('(Step 5)')).split(' ')[0];
    const names = (from, to) => execFileSync('git', ['diff', '--name-only', from, to], { cwd: P('.'), encoding: 'utf8' }).trim().split('\n').filter((n) => !n.startsWith('test/') && !n.startsWith('snapshots/'));
    const [c1, c2, h2] = ['practice1', 'practice2', 'homework2'].map((w) => commitOf(COMMITS[w]));
    expect(names(step5, c1)).toEqual([`${LAB}/practice1.http`, `${LAB}/practice1.js`, `${LAB}/shop-data.js`]);
    expect(names(c1, c2)).toEqual([`${LAB}/practice2.http`, `${LAB}/practice2.js`]);
    expect(names(c2, h2)).toEqual([`${LAB}/homework2.http`, `${LAB}/homework2.js`]);
    const banned = /자리|박다|박아|박힌|결[이을로의]|갈래|몸통|판[이을으]|겹|까닭|걸리|걸린|돌리|돌려(?!주|준|줄)|가르|갈리|재다|재서|벗기|되살|짝/;
    for (const rel of ['shop-data.js', 'practice1.js', 'practice2.js', 'homework2.js']) {
      const text = execFileSync('git', ['show', `${h2}:${LAB}/${rel}`], { cwd: P('.'), encoding: 'utf8' });
      expect([rel, text.split('\n')[0]]).toEqual([rel, `// ~/instagram-api/${LAB}/${rel}`]);
      expect([rel, text.split('\n').filter((line) => banned.test(line))]).toEqual([rel, []]);
      expect([rel, /게이트|판정|TDD|Step \d|회차|스냅숏/.test(text)]).toEqual([rel, false]);
    }
    for (const name of ['practice1', 'practice2']) {
      const start = read(P(`snapshots/p3-53/${name}-start.js`));
      expect(start.split('\n').filter((line) => banned.test(line))).toEqual([]);
    }
  });
});
