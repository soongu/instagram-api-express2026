// p3-61 「팔로워·팔로잉 목록」 게이트 - 실습(직접 해보기 1 · 과제 [기초])
// 내부 검증 전용 - 교안에 한 줄도 인용하지 않는다.
//
// 리뷰 서버의 «구독자 목록» - `lab/p3-61/`(subscriber-data.js · practice1.js · homework1.js · .http 둘).
// 로그인은 수업 백엔드가 맡는다(p3-55 직접 해보기 2 와 같다) - 수업 백엔드를 판정 DB 로 띄우고 같은 쿠키로 실습 서버에 간다.
// .http 는 httpYac CLI 로 «통째로» 위에서부터 보낸다 - 학생이 VS Code 에서 차례로 누르는 것과 같은 순서다.
// 🔑 틀린 판 - 정답 판과 «처음 달라지는 요청» 의 제목을 잠근다. 그 요청이 그 틀린 답을 가려내는 확인 번호다.
// 🔑 포트 - 수업 백엔드 3981 · 실습 서버 3982. DB - `p361_lab` 하나만 만들고 지운다(PostgreSQL 은 `P361_PG_PORT` 기본 5551).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, symlinkSync, openSync, closeSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import pg from 'pg';
import { boot } from './helpers/boot.js';

const ROOT = new URL('../', import.meta.url);
const P = (rel) => new URL(rel, ROOT).pathname;
const read = (path) => readFileSync(path, 'utf8');
const LAB = 'lab/p3-61';
const STUDENT_PORT = 4001;
const API_PORT = 3981;
const LAB_PORT = 3982;
const PG_PORT = Number(process.env.P361_PG_PORT ?? 5551);
const ADMIN = { host: 'localhost', port: PG_PORT, database: 'postgres', user: 'postgres', password: 'postgres' };
const DB = 'p361_lab';
const SECRET = 'q2Xh0v9bGm4RkT7sYp1wLc8nZf3uJd6eHa5iVo0rQyE';
const ENV = {
  CORS_ORIGIN: 'http://localhost:3001', JWT_SECRET: SECRET, DATABASE_URL: `postgresql://postgres:postgres@localhost:${PG_PORT}/${DB}`,
  GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret', SITE_URL: `http://localhost:${API_PORT}`,
  KAKAO_CLIENT_ID: 'test-kakao', KAKAO_CLIENT_SECRET: 'test-kakao-secret', NAVER_CLIENT_ID: 'test-naver', NAVER_CLIENT_SECRET: 'test-naver-secret',
};
const FIXTURE = P('test/fixtures/p3-60-end.sql');
const hasRef = (ref) => {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', ref], { cwd: P('.'), stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
};
// 🔑 판의 선 - 북마크 code/p3-61 이 있으면 그것, 없으면 HEAD. `P361_LINE` 으로 바꾼다. `P361_LAB_WT=1` 이면 작업트리.
const LINE = process.env.P361_LINE ?? (hasRef('refs/heads/code/p3-61') ? 'code/p3-61' : 'HEAD');
const dirs = [];
const seen = {};

/** 학생 폴더 모양의 사본 - 선의 끝 판을 풀고 node_modules 를 잇는다. `edit` 는 실습 파일 글자를 바꾼다. */
const studentCopy = (which, edit) => {
  const dir = mkdtempSync(join(tmpdir(), 'p361-lab-'));
  dirs.push(dir);
  if (process.env.P361_LAB_WT) {
    execFileSync('cp', ['-R', ...['app.js', 'db.js', 'errors.js', 'responses.js', 'routes', 'controllers', 'services', 'middlewares', 'schemas', 'strategies', 'docs', 'utils', 'package.json', 'prisma', 'prisma.config.js', 'lab'].map(P), dir]);
  } else {
    const tar = execFileSync('git', ['archive', '--format=tar', LINE], { cwd: P('.'), maxBuffer: 1 << 28 });
    execFileSync('tar', ['-x', '-C', dir], { input: tar });
  }
  symlinkSync(P('node_modules'), join(dir, 'node_modules'));
  if (edit) {
    const file = join(dir, LAB, `${which}.js`);
    writeFileSync(file, edit(read(file)));
  }
  return dir;
};
/** 글자 하나를 바꾼다 - 바꿀 글자가 꼭 한 번 있어야 한다. */
const swap = (a, b) => (text) => {
  if (text.split(a).length !== 2) throw new Error(`바꿀 글자가 없거나 여럿이다: ${a}`);
  return text.replace(a, b);
};
/** 학생 쪽 포트 4001 을 판정 포트로 - 바꾸는 곳은 app.listen 의 수와 기다린다는 문장 둘뿐이어야 한다. */
const onPort = (dir, which, port) => {
  const file = join(dir, LAB, `${which}.js`);
  const source = read(file);
  expect(source.split(String(STUDENT_PORT)).length - 1).toBe(2);
  expect(source).toMatch(new RegExp(`^app\\.listen\\(${STUDENT_PORT}, \\(\\) => \\{\\n  console\\.log\\('리뷰 서버가 ${STUDENT_PORT}번 포트에서 기다리고 있어요\\.'\\);\\n\\}\\);\\n$`, 'm'));
  writeFileSync(file, source.replaceAll(String(STUDENT_PORT), String(port)));
};
/** httpYac CLI 로 .http 한 파일을 통째로 - 수업 백엔드 주소(3000)와 실습 서버 주소(4001)를 판정 포트로. */
const httpyac = async (source) => {
  const dir = mkdtempSync(join(tmpdir(), 'p361-labhttp-'));
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

/** 수업 백엔드 - 선의 끝 판 학생 파일 그대로(로그인만 쓴다). 판정 DB 는 p3-60 을 마친 학생 DB + 이 회차 마이그레이션. */
let api;
beforeAll(async () => {
  await dropDb();
  await admin((client) => client.query(`CREATE DATABASE ${DB}`));
  const client = new pg.Client({ ...ADMIN, database: DB });
  await client.connect();
  await client.query(read(FIXTURE).split('\n').filter((line) => !line.startsWith('\\')).join('\n'));
  await client.end();
  const dir = studentCopy('practice1');
  execFileSync(P('node_modules/.bin/prisma'), ['generate'], { cwd: dir, env: { ...process.env, DATABASE_URL: ENV.DATABASE_URL }, stdio: 'pipe' });
  execFileSync(P('node_modules/.bin/prisma'), ['migrate', 'deploy'], { cwd: dir, env: { ...process.env, DATABASE_URL: ENV.DATABASE_URL }, stdio: 'pipe' });
  api = await boot(join(dir, 'app.js'), { port: API_PORT, cwd: dir, env: { ...ENV, PORT: String(API_PORT) }, ready: `${API_PORT}번 포트에서` });
}, 120_000);

afterAll(async () => {
  if (api) await Promise.race([api.stop(), sleep(500)]);
  await dropDb();
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  if (process.env.P361_LAB_SEEN) writeFileSync(process.env.P361_LAB_SEEN, JSON.stringify(seen, null, 2));
});

/** 실습 서버 하나를 띄워 그 실습의 .http 를 위에서부터 보낸다. 메모리 데이터라 띄울 때마다 처음 상태다. */
const runLab = async (which, edit, httpEdit = (src) => src) => {
  const dir = studentCopy(which, edit);
  onPort(dir, which, LAB_PORT);
  const lab = await boot(join(dir, LAB, `${which}.js`), { port: LAB_PORT, cwd: dir, env: ENV, ready: `${LAB_PORT}번 포트에서` });
  try {
    const runs = await httpyac(httpEdit(read(join(dir, LAB, `${which}.http`))));
    await sleep(100);
    return { runs, log: lab.tail() };
  } finally {
    await Promise.race([lab.stop(), sleep(500)]);
  }
};
/** 커서 글자는 학생이 눈으로 가르지 않는다 - 있는지 없는지만 남긴다. */
const hideCursor = (runs) => runs.map((r) => (r.body && typeof r.body === 'object' && 'nextCursor' in r.body
  ? { ...r, body: { ...r.body, nextCursor: r.body.nextCursor === null ? null : '(커서)' } } : r));
/** 정답 판과 처음 달라지는 요청 - 번호(1부터) · 제목 · 정답 · 틀린 판. */
const firstDiff = (rightRuns, wrongRuns) => {
  const [right, wrong] = [hideCursor(rightRuns), hideCursor(wrongRuns)];
  const at = right.findIndex((r, i) => JSON.stringify(r) !== JSON.stringify(wrong[i]));
  return at === -1 ? null : { no: at + 1, title: right[at].title, right: { status: right[at].status, body: right[at].body }, wrong: { status: wrong[at].status, body: wrong[at].body } };
};
const view = (runs) => runs.map((r) => [r.title, r.status, r.body]);
const ids = (r) => r.body.map((item) => item.id);


const row = (id, username, isSubscribed) => ({ id, username, isSubscribed });
// 교안 확인 7(직접 해보기 1) · 확인 6(과제 [기초]) - 맨 위 로그인 요청을 seoyeon 으로 바꿔 보낸다. seoyeon(43)은 리뷰 서버 데이터에 없는 사람이다.
const asSeoyeon = swap('"username": "jaehoon",\n  "password": "jaehoon1234"', '"username": "seoyeon",\n  "password": "instagram1234"');
const subscribed = (runs, title) => runs.find((r) => r.title === title).body.items.map((i) => `${i.username}${i.isSubscribed ? '*' : ''}`);

describe('축 ⑥ 직접 해보기 1 - 글쓴이의 구독자 목록', () => {
  it('practice1.http 차례대로 - 다섯 · 다섯 · 하나 · 한 번에 열하나 · 빈 목록 · 404 · 잘못된 커서 400', async () => {
    const { runs } = await runLab('practice1');
    seen.practice1 = runs;
    expect(view(runs).map(([t, s, b]) => [t, s, t.startsWith('yuna') ? { ...b, nextCursor: typeof b.nextCursor } : b])).toEqual([
      ['jaehoon으로 로그인 - 수업 백엔드', 200, expect.anything()],
      ['yuna의 구독자 - 첫 페이지', 200, { items: [row(11, 'junho', false), row(2, 'jaehoon', false), row(9, 'hyunwoo', true), row(7, 'dabin', false), row(13, 'woojin', false)], hasNext: true, nextCursor: 'string' }],
      ['yuna의 구독자 - 둘째 페이지', 200, { items: [row(6, 'minho', false), row(8, 'eunji', true), row(3, 'sujin', true), row(10, 'seola', false), row(12, 'nari', false)], hasNext: true, nextCursor: 'string' }],
      ['yuna의 구독자 - 셋째 페이지', 200, { items: [row(14, 'bomi', false)], hasNext: false, nextCursor: 'object' }],
      ['yuna의 구독자 - 한 번에 20명', 200, expect.objectContaining({ hasNext: false, nextCursor: 'object' })],
      ['구독자가 없는 dabin', 200, { items: [], hasNext: false, nextCursor: null }],
      ['없는 사람', 404, { message: '그런 사용자는 없어요' }],
      ['잘못된 커서', 400, { message: '커서 값이 올바르지 않아요' }],
    ]);
    expect(runs[4].body.items.map((i) => i.username)).toEqual(['junho', 'jaehoon', 'hyunwoo', 'dabin', 'woojin', 'minho', 'eunji', 'sujin', 'seola', 'nari', 'bomi']);
  }, 60_000);

  it('로그인하지 않으면 401 · 첫 페이지 끝(woojin)과 둘째 페이지 처음(minho)은 구독한 시각이 같다', async () => {
    const dir = studentCopy('practice1');
    const data = await import(join(dir, LAB, 'subscriber-data.js'));
    const at = (sub) => data.subscriptions.find((s) => s.authorId === 1 && s.subscriberId === sub).createdAt;
    expect(at(13)).toBe(at(6));
    onPort(dir, 'practice1', LAB_PORT);
    const lab = await boot(join(dir, LAB, 'practice1.js'), { port: LAB_PORT, cwd: dir, env: ENV, ready: `${LAB_PORT}번 포트에서` });
    try {
      const res = await fetch(`http://localhost:${LAB_PORT}/api/users/yuna/subscribers`);
      expect([res.status, await res.json()]).toEqual([401, { message: '로그인이 필요해요' }]);
    } finally {
      await Promise.race([lab.stop(), sleep(500)]);
    }
  }, 30_000);

  const PRACTICE_WRONG = {
    // 빈칸에 true - 교안 해설 표 «isAfter 의 빈칸에 true 를 써요»(확인 2 의 첫 줄이 woojin).
    '시각이 같을 때 번호로 가르지 않는다(isAfter)': swap('(item.createdAt === cursor.createdAt && item.id < cursor.id)', '(item.createdAt === cursor.createdAt && true)'),
    '정렬에서 번호를 안 본다(newestFirst)': swap('  return b.id - a.id;', '  return 0;'),
    '다음 커서를 페이지 첫 줄로': swap('encodeCursor(page[page.length - 1])', 'encodeCursor(page[0])'),
    '빈칸에 subscriber.id': swap('(row) => row.subscriberId === res.locals.userId && row.authorId === subscriber.id', '(row) => row.subscriberId === subscriber.id && row.authorId === subscriber.id'),
    '빈칸에 author.id': swap('(row) => row.subscriberId === res.locals.userId && row.authorId === subscriber.id', '(row) => row.subscriberId === author.id && row.authorId === subscriber.id'),
    'hasNext 를 limit 과 같을 때도 true': swap('const hasNext = rows.length > limit;', 'const hasNext = rows.length >= limit;'),
  };

  it('틀린 답 여섯 - 각자 처음 달라지는 확인 번호가 있다', async () => {
    const right = (await runLab('practice1')).runs;
    const diffs = {};
    for (const [name, edit] of Object.entries(PRACTICE_WRONG)) diffs[name] = firstDiff(right, (await runLab('practice1', edit)).runs);
    seen.practice1Wrong = diffs;
    expect(Object.fromEntries(Object.entries(diffs).map(([k, d]) => [k, d && [d.no, d.title]]))).toEqual({
      '시각이 같을 때 번호로 가르지 않는다(isAfter)': [3, 'yuna의 구독자 - 둘째 페이지'],
      '정렬에서 번호를 안 본다(newestFirst)': [2, 'yuna의 구독자 - 첫 페이지'],
      '다음 커서를 페이지 첫 줄로': [3, 'yuna의 구독자 - 둘째 페이지'],
      '빈칸에 subscriber.id': [2, 'yuna의 구독자 - 첫 페이지'],
      '빈칸에 author.id': [2, 'yuna의 구독자 - 첫 페이지'],
      'hasNext 를 limit 과 같을 때도 true': null,
    });
    // 교안 해설 표 - 빈칸에 true 면 확인 2 의 첫 줄이 커서의 woojin 이다(같은 시각의 줄을 다시 받는다).
    expect(diffs['시각이 같을 때 번호로 가르지 않는다(isAfter)'].wrong.body.items[0].username).toBe('woojin');
  }, 180_000);

  it('확인 7 - seoyeon 으로 보면 모두 false · 빈칸에 번호 2 를 쓴 답은 확인 1~6 을 지나고 확인 7 에서 hyunwoo 가 true', async () => {
    const literal2 = swap('(row) => row.subscriberId === res.locals.userId && row.authorId === subscriber.id', '(row) => row.subscriberId === 2 && row.authorId === subscriber.id');
    const right = (await runLab('practice1', undefined, asSeoyeon)).runs;
    expect(right[0]).toMatchObject({ title: 'jaehoon으로 로그인 - 수업 백엔드', status: 200 });
    expect(subscribed(right, 'yuna의 구독자 - 첫 페이지')).toEqual(['junho', 'jaehoon', 'hyunwoo', 'dabin', 'woojin']);
    expect(firstDiff((await runLab('practice1')).runs, (await runLab('practice1', literal2)).runs)).toBeNull();
    expect(subscribed((await runLab('practice1', literal2, asSeoyeon)).runs, 'yuna의 구독자 - 첫 페이지')).toEqual(['junho', 'jaehoon', 'hyunwoo*', 'dabin', 'woojin']);
  }, 120_000);
});

describe('축 ⑦ 과제 [기초] - 그 사람이 구독한 글쓴이 목록', () => {
  it('homework1.http 차례대로 - sujin 다섯 · 둘 · 내가 구독한 넷(모두 true) · yuna 빈 목록 · 404 · 400', async () => {
    const { runs } = await runLab('homework1');
    seen.homework1 = runs;
    const cut = (b) => (b && 'nextCursor' in b ? { ...b, nextCursor: typeof b.nextCursor } : b);
    expect(view(runs).map(([t, s, b]) => [t, s, cut(b)])).toEqual([
      ['jaehoon으로 로그인 - 수업 백엔드', 200, expect.anything()],
      ['sujin이 구독한 글쓴이 - 첫 페이지', 200, { items: [row(1, 'yuna', true), row(8, 'eunji', true), row(6, 'minho', false), row(4, 'taeyang', false), row(2, 'jaehoon', false)], hasNext: true, nextCursor: 'string' }],
      ['sujin이 구독한 글쓴이 - 둘째 페이지', 200, { items: [row(9, 'hyunwoo', true), row(5, 'jisoo', false)], hasNext: false, nextCursor: 'object' }],
      ['내가 구독한 글쓴이', 200, { items: [row(1, 'yuna', true), row(8, 'eunji', true), row(9, 'hyunwoo', true), row(3, 'sujin', true)], hasNext: false, nextCursor: 'object' }],
      ['아무도 구독하지 않은 yuna', 200, { items: [], hasNext: false, nextCursor: 'object' }],
      ['없는 사람', 404, { message: '그런 사용자는 없어요' }],
      ['잘못된 커서', 400, { message: '커서 값이 올바르지 않아요' }],
    ]);
  }, 60_000);

  const HOMEWORK_WRONG = {
    '방향을 그대로 두었다(구독자 목록이 나온다)': swap('.filter((item) => item.subscriberId === user.id)', '.filter((item) => item.authorId === user.id)'),
    '꺼낸 사람을 구독자로': swap('users.find((one) => one.id === item.authorId)', 'users.find((one) => one.id === item.subscriberId)'),
    '정렬에서 번호를 안 본다': swap('  return b.id - a.id;', '  return 0;'),
    '줄마다 sujin 기준으로 셌다': swap('(row) => row.subscriberId === res.locals.userId && row.authorId === author.id', '(row) => row.subscriberId === user.id && row.authorId === author.id'),
  };

  it('틀린 답 넷 - 각자 처음 달라지는 확인 번호가 있다', async () => {
    const right = (await runLab('homework1')).runs;
    const diffs = {};
    for (const [name, edit] of Object.entries(HOMEWORK_WRONG)) diffs[name] = firstDiff(right, (await runLab('homework1', edit)).runs);
    seen.homework1Wrong = diffs;
    expect(Object.fromEntries(Object.entries(diffs).map(([k, d]) => [k, d && [d.no, d.title]]))).toEqual({
      '방향을 그대로 두었다(구독자 목록이 나온다)': [2, 'sujin이 구독한 글쓴이 - 첫 페이지'],
      '꺼낸 사람을 구독자로': [2, 'sujin이 구독한 글쓴이 - 첫 페이지'],
      '정렬에서 번호를 안 본다': [2, 'sujin이 구독한 글쓴이 - 첫 페이지'],
      '줄마다 sujin 기준으로 셌다': [2, 'sujin이 구독한 글쓴이 - 첫 페이지'],
    });
  }, 120_000);

  it('확인 6 - seoyeon 으로 보면 모두 false · 번호 2 를 쓴 답은 확인 1~5 를 지나고 확인 6 에서 yuna·eunji 가 true', async () => {
    const literal2 = swap('(row) => row.subscriberId === res.locals.userId && row.authorId === author.id', '(row) => row.subscriberId === 2 && row.authorId === author.id');
    const right = (await runLab('homework1', undefined, asSeoyeon)).runs;
    expect(subscribed(right, 'sujin이 구독한 글쓴이 - 첫 페이지')).toEqual(['yuna', 'eunji', 'minho', 'taeyang', 'jaehoon']);
    expect(firstDiff((await runLab('homework1')).runs, (await runLab('homework1', literal2)).runs)).toBeNull();
    expect(subscribed((await runLab('homework1', literal2, asSeoyeon)).runs, 'sujin이 구독한 글쓴이 - 첫 페이지')).toEqual(['yuna*', 'eunji*', 'minho', 'taeyang', 'jaehoon']);
  }, 120_000);
});
