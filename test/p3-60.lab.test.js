// p3-60 「팔로우」 게이트 - 실습(직접 해보기 1 · 과제 [기초])
// 내부 검증 전용 - 교안에 한 줄도 인용하지 않는다.
//
// 리뷰 서버의 «글쓴이 구독» - `lab/p3-60/`(subscribe-data.js · practice1.js · homework1.js · .http 둘).
// 로그인은 수업 백엔드가 맡는다(p3-55 직접 해보기 2 와 같다) - 수업 백엔드를 판정 DB 로 띄우고 같은 쿠키로 실습 서버에 간다.
// .http 는 httpYac CLI 로 «통째로» 위에서부터 보낸다 - 학생이 VS Code 에서 차례로 누르는 것과 같은 순서다.
// 🔑 틀린 판 - 정답 판과 «처음 달라지는 요청» 의 제목을 잠근다. 그 요청이 그 틀린 답을 가려내는 확인 번호다.
// 🔑 포트 - 수업 백엔드 3991 · 실습 서버 3992. DB - `p360_lab` 하나만 만들고 지운다(PostgreSQL 은 `P360_PG_PORT` 기본 5551).
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
const LAB = 'lab/p3-60';
const STUDENT_PORT = 4001;
const API_PORT = 3991;
const LAB_PORT = 3992;
const PG_PORT = Number(process.env.P360_PG_PORT ?? 5551);
const ADMIN = { host: 'localhost', port: PG_PORT, database: 'postgres', user: 'postgres', password: 'postgres' };
const DB = 'p360_lab';
const SECRET = 'q2Xh0v9bGm4RkT7sYp1wLc8nZf3uJd6eHa5iVo0rQyE';
const ENV = {
  CORS_ORIGIN: 'http://localhost:3001', JWT_SECRET: SECRET, DATABASE_URL: `postgresql://postgres:postgres@localhost:${PG_PORT}/${DB}`,
  GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret', SITE_URL: `http://localhost:${API_PORT}`,
  KAKAO_CLIENT_ID: 'test-kakao', KAKAO_CLIENT_SECRET: 'test-kakao-secret', NAVER_CLIENT_ID: 'test-naver', NAVER_CLIENT_SECRET: 'test-naver-secret',
};
const FIXTURE = P('test/fixtures/p3-59-end.sql');
const hasRef = (ref) => {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', ref], { cwd: P('.'), stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
};
// 🔑 판의 선 - 북마크 code/p3-60 이 있으면 그것, 없으면 HEAD. `P360_LINE` 으로 바꾼다. `P360_LAB_WT=1` 이면 작업트리.
const LINE = process.env.P360_LINE ?? (hasRef('refs/heads/code/p3-60') ? 'code/p3-60' : 'HEAD');
const dirs = [];
const seen = {};

/** 학생 폴더 모양의 사본 - 선의 끝 판을 풀고 node_modules 를 잇는다. `edit` 는 실습 파일 글자를 바꾼다. */
const studentCopy = (which, edit) => {
  const dir = mkdtempSync(join(tmpdir(), 'p360-lab-'));
  dirs.push(dir);
  if (process.env.P360_LAB_WT) {
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
  const dir = mkdtempSync(join(tmpdir(), 'p360-labhttp-'));
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

/** 수업 백엔드 - 선의 끝 판 학생 파일 그대로(로그인만 쓴다). 판정 DB 는 p3-59 를 마친 학생 DB + 이 회차 마이그레이션. */
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
  if (process.env.P360_LAB_SEEN) writeFileSync(process.env.P360_LAB_SEEN, JSON.stringify(seen, null, 2));
});

/** 실습 서버 하나를 띄워 그 실습의 .http 를 위에서부터 보낸다. 메모리 데이터라 띄울 때마다 처음 상태다. */
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
/** 정답 판과 처음 달라지는 요청 - 번호(1부터) · 제목 · 정답 · 틀린 판. */
const firstDiff = (right, wrong) => {
  const at = right.findIndex((r, i) => JSON.stringify(r) !== JSON.stringify(wrong[i]));
  return at === -1 ? null : { no: at + 1, title: right[at].title, right: { status: right[at].status, body: right[at].body }, wrong: { status: wrong[at].status, body: wrong[at].body } };
};
const view = (runs) => runs.map((r) => [r.title, r.status, r.body]);
const ids = (r) => r.body.map((item) => item.id);

describe('축 ⑥ 직접 해보기 1 - 글쓴이 구독', () => {
  it('practice1.http 차례대로 - jisoo 0 · 구독 1 · 한 번 더 1 · 취소 0 · 한 번 더 0 · 안 한 taeyang 취소는 1 그대로 · 나 자신 400 · 없는 사람 404 · taeyang 1 · 처음부터 구독하던 yuna 취소 1(배열 0번 줄)', async () => {
    const { runs } = await runLab('practice1');
    seen.practice1 = runs;
    expect(view(runs)).toEqual([
      ['jaehoon으로 로그인 - 수업 백엔드', 200, expect.anything()],
      ['jisoo - 아직 아무도 구독하지 않았다', 200, { id: 5, username: 'jisoo', subscriberCount: 0 }],
      ['jisoo 구독', 200, { subscribed: true, subscriberCount: 1 }],
      ['한 번 더 구독', 200, { subscribed: true, subscriberCount: 1 }],
      ['jisoo 구독 취소', 200, { subscribed: false, subscriberCount: 0 }],
      ['한 번 더 취소', 200, { subscribed: false, subscriberCount: 0 }],
      ['구독하지 않은 taeyang 구독 취소', 200, { subscribed: false, subscriberCount: 1 }],
      ['나 자신을 구독', 400, { message: '나 자신은 구독할 수 없어요' }],
      ['없는 사람을 구독', 404, { message: '그런 사용자는 없어요' }],
      ['taeyang - 구독자 수', 200, { id: 4, username: 'taeyang', subscriberCount: 1 }],
      ['처음부터 구독하던 yuna 구독 취소', 200, { subscribed: false, subscriberCount: 1 }],
    ]);
  }, 60_000);

  it('로그인하지 않으면 401 · 데이터의 숫자는 구독 줄 수와 같다', async () => {
    const dir = studentCopy('practice1');
    const data = await import(join(dir, LAB, 'subscribe-data.js'));
    for (const user of data.users) {
      expect([user.username, user.subscriberCount]).toEqual([user.username, data.subscriptions.filter((s) => s.authorId === user.id).length]);
    }
    onPort(dir, 'practice1', LAB_PORT);
    const lab = await boot(join(dir, LAB, 'practice1.js'), { port: LAB_PORT, cwd: dir, env: ENV, ready: `${LAB_PORT}번 포트에서` });
    try {
      const res = await fetch(`http://localhost:${LAB_PORT}/api/users/jisoo/subscribers/me`, { method: 'PUT' });
      expect([res.status, await res.json()]).toEqual([401, { message: '로그인이 필요해요' }]);
    } finally {
      await Promise.race([lab.stop(), sleep(500)]);
    }
  }, 30_000);

  // 틀린 답 - 학생이 실제로 낼 법한 것. 그 답을 가려내는 «처음 달라지는 요청» 을 잠근다.
  const PRACTICE_WRONG = {
    '무조건 +1(이미 구독했는지 안 본다)': swap('  if (!subscribed) {\n    subscriptions.push', '  {\n    subscriptions.push'),
    '남의 구독까지 지운다(누가 구독했는지 안 본다)': swap('subscriptions.findIndex((item) => item.subscriberId === subscriberId && item.authorId === author.id)', 'subscriptions.findIndex((item) => item.authorId === author.id)'),
    '무조건 -1(구독하고 있었는지 안 본다)': swap('    subscriptions.splice(index, 1);\n    author.subscriberCount -= 1;\n  }', '    subscriptions.splice(index, 1);\n  }\n  author.subscriberCount -= 1;'),
    '나 자신을 막지 않는다': swap('  if (author.id === res.locals.userId) {', '  if (false) {'),
    '0번 줄을 못 지운다(index > 0)': swap('  if (index !== -1) {', '  if (index > 0) {'),
    '누구를 구독했는지 안 본다': swap('subscriptions.some((item) => item.subscriberId === subscriberId && item.authorId === author.id)', 'subscriptions.some((item) => item.subscriberId === subscriberId)'),
  };

  it('틀린 답 여섯 - 각자 처음 달라지는 확인 번호가 있다', async () => {
    const right = (await runLab('practice1')).runs;
    const diffs = {};
    for (const [name, edit] of Object.entries(PRACTICE_WRONG)) diffs[name] = firstDiff(right, (await runLab('practice1', edit)).runs);
    seen.practice1Wrong = diffs;
    expect(Object.fromEntries(Object.entries(diffs).map(([k, d]) => [k, d && [d.no, d.title, d.wrong.status, d.wrong.body]]))).toEqual({
      '무조건 +1(이미 구독했는지 안 본다)': [4, '한 번 더 구독', 200, { subscribed: true, subscriberCount: 2 }],
      '남의 구독까지 지운다(누가 구독했는지 안 본다)': [7, '구독하지 않은 taeyang 구독 취소', 200, { subscribed: false, subscriberCount: 0 }],
      '무조건 -1(구독하고 있었는지 안 본다)': [6, '한 번 더 취소', 200, { subscribed: false, subscriberCount: -1 }],
      '나 자신을 막지 않는다': [8, '나 자신을 구독', 200, { subscribed: true, subscriberCount: 2 }],
      '0번 줄을 못 지운다(index > 0)': [11, '처음부터 구독하던 yuna 구독 취소', 200, { subscribed: false, subscriberCount: 2 }],
      '누구를 구독했는지 안 본다': [3, 'jisoo 구독', 200, { subscribed: true, subscriberCount: 0 }],
    });
  }, 120_000);
});

describe('축 ⑦ 과제 [기초] - 구독한 글쓴이의 리뷰만', () => {
  it('homework1.http 차례대로 - 처음 일곱(12 · 10 · 11 · 7 · 6 · 5 · 1) · taeyang 을 더하면 4 가 5 뒤에 · 셋을 빼면 빈 배열 · 답변만 있는 jisoo 는 빈 배열', async () => {
    const { runs } = await runLab('homework1');
    seen.homework1 = runs;
    expect(runs.map((r) => [r.title, r.status])).toEqual([
      ['jaehoon으로 로그인 - 수업 백엔드', 200],
      ['구독한 글쓴이의 리뷰 - yuna와 sujin', 200],
      ['taeyang 구독', 200],
      ['taeyang의 리뷰도 들어온다', 200],
      ['sujin 구독 취소', 200],
      ['yuna 구독 취소', 200],
      ['taeyang 구독 취소', 200],
      ['구독한 사람이 없다', 200],
      ['jisoo 구독 - 리뷰에 단 답변만 있는 사람', 200],
      ['답변은 리뷰가 아니다', 200],
    ]);
    expect(ids(runs[1])).toEqual([12, 10, 11, 7, 6, 5, 1]);
    expect(runs[1].body[0]).toEqual({ id: 12, username: 'yuna', content: '두 번째로 사요 #재구매 #가성비', createdAt: '2026-11-10T12:45:00.000Z' });
    expect(runs[1].body.map((r) => r.username)).toEqual(['yuna', 'yuna', 'sujin', 'sujin', 'sujin', 'yuna', 'yuna']);
    expect(ids(runs[3])).toEqual([12, 10, 11, 7, 6, 5, 4, 1]);
    expect(runs[2].body).toEqual({ subscribed: true, subscriberCount: 2 });
    expect(runs[7].body).toEqual([]);
    expect(runs[8].body).toEqual({ subscribed: true, subscriberCount: 1 });
    expect(runs[9].body).toEqual([]);
  }, 60_000);

  const SUBSCRIBED = '    .filter((item) => item.subscriberId === res.locals.userId)\n';
  const HOMEWORK_WRONG = {
    '남의 구독까지(누가 구독했는지 안 본다)': swap(SUBSCRIBED, ''),
    '구독 안 한 사람 리뷰 섞임(글쓴이를 안 본다)': swap('authorIds.includes(review.authorId) && ', ''),
    '차례 틀림(시각이 같을 때 번호를 안 본다)': swap('  return b.id - a.id;\n', '  return 0;\n'),
    '답변이 섞임(parentId 를 안 본다)': swap(' && review.parentId === null', ''),
    '숨긴 리뷰가 섞임(hidden 을 안 본다)': swap(' && !review.hidden', ''),
  };

  it('틀린 답 다섯 - 각자 처음 달라지는 확인 번호가 있다', async () => {
    const right = (await runLab('homework1')).runs;
    const diffs = {};
    for (const [name, edit] of Object.entries(HOMEWORK_WRONG)) diffs[name] = firstDiff(right, (await runLab('homework1', edit)).runs);
    seen.homework1Wrong = diffs;
    const brief = (d) => d && [d.no, d.title, Array.isArray(d.wrong.body) ? d.wrong.body.map((r) => r.id) : d.wrong.body];
    expect(Object.fromEntries(Object.entries(diffs).map(([k, d]) => [k, brief(d)]))).toEqual({
      '남의 구독까지(누가 구독했는지 안 본다)': [2, '구독한 글쓴이의 리뷰 - yuna와 sujin', [12, 10, 11, 8, 7, 6, 5, 4, 2, 1]],
      '구독 안 한 사람 리뷰 섞임(글쓴이를 안 본다)': [2, '구독한 글쓴이의 리뷰 - yuna와 sujin', [12, 10, 11, 8, 7, 6, 5, 4, 2, 1]],
      '차례 틀림(시각이 같을 때 번호를 안 본다)': [2, '구독한 글쓴이의 리뷰 - yuna와 sujin', [10, 12, 11, 7, 6, 5, 1]],
      '답변이 섞임(parentId 를 안 본다)': [10, '답변은 리뷰가 아니다', [17, 16, 15, 14, 13]],
      '숨긴 리뷰가 섞임(hidden 을 안 본다)': [2, '구독한 글쓴이의 리뷰 - yuna와 sujin', [12, 10, 11, 7, 6, 5, 3, 1]],
    });
  }, 120_000);

  it('과제는 직접 해보기 1 의 서버에 주소 하나와 차례 함수를 더한 것이다 - 경로 주석 · import 한 줄 · 더한 덩어리 말고는 같다', () => {
    const dir = studentCopy('homework1');
    const practice = read(join(dir, LAB, 'practice1.js')).split('\n');
    const homework = read(join(dir, LAB, 'homework1.js')).split('\n');
    expect(homework[0]).toBe('// ~/instagram-api/lab/p3-60/homework1.js');
    const extra = homework.slice(1).filter((line) => !practice.includes(line) && line !== '');
    expect(extra[0]).toBe("import { reviews } from '../p3-57/shop-data.js';");
    expect(extra).toContain("app.get('/api/reviews/subscribed', (req, res) => {");
    expect(extra).toContain('function byNewest(a, b) {');
    expect(practice.slice(1).filter((line) => !homework.includes(line))).toEqual([]);
    expect(readdirSync(join(dir, LAB)).sort()).toEqual(['follows.sql', 'homework1.http', 'homework1.js', 'practice1.http', 'practice1.js', 'subscribe-data.js']);
  });
});
