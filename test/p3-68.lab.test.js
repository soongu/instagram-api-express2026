// p3-68 「알림 남기기와 알림 패널」 게이트 - 실습(직접 해보기 1)
// 내부 검증 전용 - 교안에 한 줄도 인용하지 않는다.
//
// 리뷰 서버의 «도움이 돼요» 가 알림을 남기고, 취소하면 그 알림도 사라진다 - `lab/p3-68/`(helpful-data.js · practice1.js · practice1.http).
// 빈칸 판은 `snapshots/p3-68/practice1.blank.js`(교안 직접 해보기 1 의 뼈대) - 빈칸 네 곳을 정답으로 채우면 practice1.js 와 같다.
// 로그인은 수업 백엔드가 맡는다(p3-55 직접 해보기 2 와 같다) - 수업 백엔드를 판정 DB 로 띄우고 같은 쿠키로 실습 서버에 간다.
// .http 는 httpYac CLI 로 «통째로» 위에서부터 보낸다 - 학생이 VS Code 에서 차례로 누르는 것과 같은 순서다.
// 🔑 틀린 판 - 정답 판과 «처음 달라지는 요청» 의 제목을 잠근다. 그 요청이 그 틀린 답을 가려내는 확인 번호다.
// 🔑 포트 - 수업 백엔드 3986 · 실습 서버 3987. DB - `p368_lab` 하나만 만들고 지운다(PostgreSQL 은 `P368_PG_PORT` 기본 5580 - 판정용 컨테이너 p368-db).
// 🔑 판정 DB 는 «p3-67 을 마친 학생 DB» `test/fixtures/p3-67-end.sql` + 이 선의 마이그레이션(로그인만 쓴다).
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
const LAB = 'lab/p3-68';
const STUDENT_PORT = 4068;
const API_PORT = 3986;
const LAB_PORT = 3987;
const PG_PORT = Number(process.env.P368_PG_PORT ?? 5580);
const ADMIN = { host: 'localhost', port: PG_PORT, database: 'postgres', user: 'postgres', password: 'postgres' };
const DB = 'p368_lab';
const SECRET = 'q2Xh0v9bGm4RkT7sYp1wLc8nZf3uJd6eHa5iVo0rQyE';
const ENV = {
  CORS_ORIGIN: 'http://localhost:3001', JWT_SECRET: SECRET, DATABASE_URL: `postgresql://postgres:postgres@localhost:${PG_PORT}/${DB}`,
  GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret', SITE_URL: `http://localhost:${API_PORT}`,
  KAKAO_CLIENT_ID: 'test-kakao', KAKAO_CLIENT_SECRET: 'test-kakao-secret', NAVER_CLIENT_ID: 'test-naver', NAVER_CLIENT_SECRET: 'test-naver-secret',
};
const FIXTURE = P('test/fixtures/p3-67-end.sql');
const hasRef = (ref) => {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', ref], { cwd: P('.'), stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
};
// 🔑 판의 선 - 북마크 code/p3-68 이 있으면 그것, 없으면 HEAD. `P368_LINE` 으로 바꾼다. `P368_LAB_WT=1` 이면 작업트리.
const LINE = process.env.P368_LINE ?? (hasRef('refs/heads/code/p3-68') ? 'code/p3-68' : 'HEAD');
const dirs = [];
const seen = {};

/** 학생 폴더 모양의 사본 - 선의 끝 판을 풀고 node_modules 를 잇는다. `edit` 는 실습 파일 글자를 바꾼다. */
const studentCopy = (which, edit) => {
  const dir = mkdtempSync(join(tmpdir(), 'p368-lab-'));
  dirs.push(dir);
  if (process.env.P368_LAB_WT) {
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
/** 학생 쪽 포트 4068 을 판정 포트로 - 바꾸는 곳은 app.listen 의 수와 기다린다는 문장 둘뿐이어야 한다. */
const onPort = (dir, which, port) => {
  const file = join(dir, LAB, `${which}.js`);
  const source = read(file);
  expect(source.split(String(STUDENT_PORT)).length - 1).toBe(2);
  expect(source).toMatch(new RegExp(`^app\\.listen\\(${STUDENT_PORT}, \\(\\) => \\{\\n  console\\.log\\('리뷰 서버가 ${STUDENT_PORT}번 포트에서 기다리고 있어요\\.'\\);\\n\\}\\);\\n$`, 'm'));
  writeFileSync(file, source.replaceAll(String(STUDENT_PORT), String(port)));
};
/** httpYac CLI 로 .http 한 파일을 통째로 - 수업 백엔드 주소(3000)와 실습 서버 주소(4068)를 판정 포트로. */
const httpyac = async (source) => {
  const dir = mkdtempSync(join(tmpdir(), 'p368-labhttp-'));
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

/** 수업 백엔드 - 선의 끝 판 학생 파일 그대로(로그인만 쓴다). 판정 DB 는 p3-67 을 마친 학생 DB + 이 회차 마이그레이션. */
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
  if (process.env.P368_LAB_SEEN) writeFileSync(process.env.P368_LAB_SEEN, JSON.stringify(seen, null, 2));
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

describe('직접 해보기 1 - «도움이 돼요» 알림', () => {
  it('practice1.http 차례대로 - 한 번 더 눌러도 1 · 내 리뷰는 알림 없음 · jaehoon 에게 seoyeon 의 알림 하나 · 취소하면 사라진다', async () => {
    const { runs } = await runLab('practice1');
    seen.practice1 = runs;
    expect(view(runs)).toEqual([
      ['seoyeon으로 로그인 - 수업 백엔드', 200, expect.anything()],
      ['jaehoon의 리뷰 1에 «도움이 돼요»', 200, { helpful: true, helpfulCount: 1 }],
      ['한 번 더', 200, { helpful: true, helpfulCount: 1 }],
      ['내 리뷰 2에 «도움이 돼요»', 200, { helpful: true, helpfulCount: 1 }],
      ['seoyeon의 알림', 200, []],
      ['jaehoon으로 로그인 - 수업 백엔드', 200, expect.anything()],
      ['jaehoon의 알림', 200, [{ id: 3, from: 'seoyeon', reviewId: 1 }]],
      ['sujin의 리뷰 3에 누른 «도움이 돼요» 취소', 200, { helpful: false, helpfulCount: 1 }],
      ['seoyeon으로 다시 로그인', 200, expect.anything()],
      ['jaehoon의 리뷰 1에 누른 «도움이 돼요» 취소', 200, { helpful: false, helpfulCount: 0 }],
      ['jaehoon으로 다시 로그인', 200, expect.anything()],
      ['jaehoon의 알림 - 취소한 뒤', 200, []],
    ]);
  }, 60_000);

  it('로그인하지 않으면 401 · 데이터의 알림은 모두 «도움이 돼요» 줄 하나씩을 가리킨다', async () => {
    const dir = studentCopy('practice1');
    const data = await import(join(dir, LAB, 'helpful-data.js'));
    for (const n of data.notifications) {
      const helpful = data.helpfuls.find((h) => h.id === n.helpfulId);
      const review = data.reviews.find((r) => r.id === n.reviewId);
      expect([n.id, helpful.reviewId, helpful.userId, review.authorId]).toEqual([n.id, n.reviewId, n.senderId, n.receiverId]);
    }
    onPort(dir, 'practice1', LAB_PORT);
    const lab = await boot(join(dir, LAB, 'practice1.js'), { port: LAB_PORT, cwd: dir, env: ENV, ready: `${LAB_PORT}번 포트에서` });
    try {
      const res = await fetch(`http://localhost:${LAB_PORT}/api/reviews/1/helpful/me`, { method: 'PUT' });
      expect([res.status, await res.json()]).toEqual([401, { message: '로그인이 필요해요' }]);
    } finally {
      await Promise.race([lab.stop(), sleep(500)]);
    }
  }, 30_000);

  it('빈칸 판 - 파싱되고(node --check), 빈칸 네 곳을 정답으로 채우면 practice1.js 와 같다', () => {
    const blank = read(P('snapshots/p3-68/practice1.blank.js'));
    expect(blank.split('____').length - 1).toBe(4);
    execFileSync(process.execPath, ['--check', P('snapshots/p3-68/practice1.blank.js')]);
    let filled = blank;
    for (const answer of ['!marked', 'review.authorId !== userId', 'helpful.id', 'item.helpfulId === helpful.id']) filled = filled.replace('____', answer);
    const dir = studentCopy('practice1');
    expect(filled).toBe(read(join(dir, LAB, 'practice1.js')));
  });

  // 틀린 답 - 학생이 실제로 낼 법한 것. 그 답을 가려내는 «처음 달라지는 요청» 을 잠근다.
  const PRACTICE_WRONG = {
    '이미 눌렀는지 안 본다': swap('  if (!marked) {', '  if (true) {'),
    '내 리뷰도 알린다': swap('    if (review.authorId !== userId) {', '    if (true) {'),
    '알림에 리뷰 번호를 적는다': swap('        helpfulId: helpful.id,', '        helpfulId: review.id,'),
    '취소해도 알림을 안 지운다': swap('    const at = notifications.findIndex((item) => item.helpfulId === helpful.id);\n    if (at !== -1) notifications.splice(at, 1);\n', ''),
    '보낸 사람으로 찾아 지운다': swap('(item) => item.helpfulId === helpful.id', '(item) => item.senderId === userId'),
  };

  it('틀린 답 다섯 - 각자 처음 달라지는 확인 번호가 있다', async () => {
    const right = (await runLab('practice1')).runs;
    const diffs = {};
    for (const [name, edit] of Object.entries(PRACTICE_WRONG)) diffs[name] = firstDiff(right, (await runLab('practice1', edit)).runs);
    seen.practice1Wrong = diffs;
    expect(Object.fromEntries(Object.entries(diffs).map(([k, d]) => [k, d && [d.no, d.title, d.wrong.status, d.wrong.body]]))).toEqual({
      '이미 눌렀는지 안 본다': [3, '한 번 더', 200, { helpful: true, helpfulCount: 2 }],
      '내 리뷰도 알린다': [5, 'seoyeon의 알림', 200, [{ id: 4, from: 'seoyeon', reviewId: 2 }]],
      '알림에 리뷰 번호를 적는다': [12, 'jaehoon의 알림 - 취소한 뒤', 200, [{ id: 3, from: 'seoyeon', reviewId: 1 }]],
      '취소해도 알림을 안 지운다': [12, 'jaehoon의 알림 - 취소한 뒤', 200, [{ id: 3, from: 'seoyeon', reviewId: 1 }]],
      '보낸 사람으로 찾아 지운다': [12, 'jaehoon의 알림 - 취소한 뒤', 200, [{ id: 3, from: 'seoyeon', reviewId: 1 }]],
    });
  }, 120_000);
});
