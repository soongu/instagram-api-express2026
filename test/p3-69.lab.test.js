// p3-69 「실시간 알림」 게이트 - 실습(직접 해보기 1 · 과제 [기초])
// 내부 검증 전용 - 교안에 한 줄도 인용하지 않는다.
//
// 직접 해보기 1 - 리뷰 서버(`lab/p3-69/practice1.js` · 4072)가 «도움이 돼요» 로 남긴 알림을 리뷰를 쓴 사람의 연결로 보내고,
//   취소로 뺀 알림은 «사라졌다» 로 보낸다. 학생은 `watch.html` 을 jaehoon 으로 열어 두고 `practice1.http` 를 seoyeon 으로 보낸다.
//   판정은 jaehoon 의 연결(socket.io-client · 수업 백엔드에서 받은 쿠키)을 열어 두고 .http 를 «한 요청씩» 보내며 그 사이에 받은 이벤트를 센다.
//   빈칸 판은 `snapshots/p3-69/practice1.blank.js`(빈칸 넷) - 정답으로 채우면 practice1.js 와 같다.
// 과제 [기초] - 알림 과제 서버(`lab/p3-69/homework1.js` · 4074)에 «아직 안 본 알림» 두 주소를 더한다.
//   강의 자료 판은 `snapshots/p3-69/homework1.start.js`. .http 는 httpYac CLI 로 «통째로» 보낸다(p3-68 과 같다).
// 🔑 틀린 판 - 정답 판과 «처음 달라지는 요청» 의 제목을 잠근다. 그 요청이 그 틀린 답을 가려내는 확인 번호다.
// 🔑 포트 - 수업 백엔드 4896 · 실습 서버 4897 · 과제 서버 4898. DB - `p369_lab` 하나만 만들고 지운다(PostgreSQL 은 `P369_PG_PORT` 기본 5580 - 판정용 컨테이너 p368-db).
// 🔑 판정 DB 는 «p3-68 을 마친 학생 DB» `test/fixtures/p3-68-end.sql` + 이 선의 마이그레이션(로그인만 쓴다).
// 🔑 판의 선 - 북마크 code/p3-69 가 있으면 그것, 없으면 HEAD. `P369_LINE` 으로 바꾼다. `P369_LAB_WT=1` 이면 작업트리.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, symlinkSync, openSync, closeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import pg from 'pg';
import { io as connectIo } from 'socket.io-client';
import { boot } from './helpers/boot.js';

const ROOT = new URL('../', import.meta.url);
const P = (rel) => new URL(rel, ROOT).pathname;
const read = (path) => readFileSync(path, 'utf8');
const LAB = 'lab/p3-69';
const STUDENT_PORT = 4072;
const API_PORT = 4896;
const LAB_PORT = 4897;
const PG_PORT = Number(process.env.P369_PG_PORT ?? 5580);
const ADMIN = { host: 'localhost', port: PG_PORT, database: 'postgres', user: 'postgres', password: 'postgres' };
const DB = 'p369_lab';
const SECRET = 'q2Xh0v9bGm4RkT7sYp1wLc8nZf3uJd6eHa5iVo0rQyE';
const ENV = {
  CORS_ORIGIN: 'http://localhost:3001', JWT_SECRET: SECRET, DATABASE_URL: `postgresql://postgres:postgres@localhost:${PG_PORT}/${DB}`,
  GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret', SITE_URL: `http://localhost:${API_PORT}`,
  KAKAO_CLIENT_ID: 'test-kakao', KAKAO_CLIENT_SECRET: 'test-kakao-secret', NAVER_CLIENT_ID: 'test-naver', NAVER_CLIENT_SECRET: 'test-naver-secret',
};
const FIXTURE = P('test/fixtures/p3-68-end.sql');
const hasRef = (ref) => {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', ref], { cwd: P('.'), stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
};
const LINE = process.env.P369_LINE ?? (hasRef('refs/heads/code/p3-69') ? 'code/p3-69' : 'HEAD');
const dirs = [];
const seen = {};

/** 학생 폴더 모양의 사본 - 선의 끝 판을 풀고 node_modules 를 잇는다. `edit` 는 실습 파일 글자를 바꾼다. */
const studentCopy = (which, edit) => {
  const dir = mkdtempSync(join(tmpdir(), 'p369-lab-'));
  dirs.push(dir);
  if (process.env.P369_LAB_WT) {
    execFileSync('cp', ['-R', ...['app.js', 'db.js', 'errors.js', 'responses.js', 'routes', 'controllers', 'services', 'middlewares', 'schemas', 'strategies', 'docs', 'utils', 'realtime.js', 'public', 'package.json', 'prisma', 'prisma.config.js', 'lab', 'snapshots'].map(P), dir]);
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
/** 학생 쪽 포트 4072 를 판정 포트로 - 바꾸는 곳은 server.listen 의 수와 기다린다는 문장 둘뿐이어야 한다. */
const onPort = (dir, port) => {
  const file = join(dir, LAB, 'practice1.js');
  const source = read(file);
  expect(source.split(String(STUDENT_PORT)).length - 1).toBe(2);
  expect(source).toMatch(new RegExp(`^server\\.listen\\(${STUDENT_PORT}, \\(\\) => \\{\\n  console\\.log\\('리뷰 서버가 ${STUDENT_PORT}번 포트에서 기다리고 있어요\\.'\\);\\n\\}\\);\\n$`, 'm'));
  writeFileSync(file, source.replaceAll(String(STUDENT_PORT), String(port)));
};
/** 주소의 포트를 판정 포트로 - 수업 백엔드(3000) · 실습 서버(4072). */
const toTest = (text) => text.replaceAll('http://localhost:3000', `http://localhost:${API_PORT}`).replaceAll(`http://localhost:${STUDENT_PORT}`, `http://localhost:${LAB_PORT}`);

/** .http 를 요청 하나씩 - 제목 · HTTP 메서드 · 주소 · 헤더 · 본문. */
const parseHttp = (source) => source.split(/^### /m).filter((b) => b.trim()).map((block) => {
  const lines = block.split('\n');
  const title = lines[0].trim();
  const [method, url] = lines[1].split(' ');
  const headers = {};
  let i = 2;
  for (; i < lines.length && lines[i].trim() !== ''; i += 1) {
    const at = lines[i].indexOf(':');
    headers[lines[i].slice(0, at).trim()] = lines[i].slice(at + 1).trim();
  }
  const body = lines.slice(i + 1).join('\n').trim();
  return { title, method, url, headers, body: body === '' ? undefined : body };
});
/** 쿠키 상자 하나 - 브라우저처럼 호스트(localhost)만 보고 포트는 가르지 않는다. */
const jar = () => {
  const cookies = new Map();
  return {
    header: () => [...cookies].map(([k, v]) => `${k}=${v}`).join('; '),
    take: (res) => {
      for (const c of res.headers.getSetCookie()) {
        const [pair] = c.split(';');
        const at = pair.indexOf('=');
        const [k, v] = [pair.slice(0, at), pair.slice(at + 1)];
        if (v === '' || /Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(c)) cookies.delete(k); else cookies.set(k, v);
      }
    },
  };
};
const send = async (box, { method, url, headers = {}, body }) => {
  const res = await fetch(url, { method, headers: { ...headers, ...(box.header() ? { Cookie: box.header() } : {}) }, body });
  box.take(res);
  const text = await res.text();
  let json = text;
  try { json = JSON.parse(text); } catch { /* 글자 */ }
  return { status: res.status, body: json };
};

/** httpYac CLI 로 .http 한 파일을 통째로 - 과제 [기초] 는 이것으로 보낸다(학생이 위에서부터 차례로 누르는 것과 같다). */
const httpyac = async (source) => {
  const dir = mkdtempSync(join(tmpdir(), 'p369-labhttp-'));
  dirs.push(dir);
  writeFileSync(join(dir, 'send.http'), source);
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

/** 수업 백엔드 - 선의 끝 판 학생 파일 그대로(로그인만 쓴다). */
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
  if (process.env.P369_LAB_SEEN) writeFileSync(process.env.P369_LAB_SEEN, JSON.stringify(seen, null, 2));
});

/** 수업 백엔드에 로그인한 쿠키 상자. */
const loginBox = async (username, password) => {
  const box = jar();
  const r = await send(box, { method: 'POST', url: `http://localhost:${API_PORT}/api/v2/auth/login`, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
  if (r.status !== 200) throw new Error(`${username} 로그인 ${r.status}`);
  return box;
};
/** 실습 서버에 연결 하나 - 받은 이벤트를 [이름, 내용] 으로 모은다. */
const watcher = async (box) => {
  const events = [];
  const socket = connectIo(`http://localhost:${LAB_PORT}`, { extraHeaders: box ? { cookie: box.header() } : {}, transports: ['websocket'], reconnection: false });
  socket.onAny((event, payload) => events.push([event, payload]));
  const result = await new Promise((resolve) => {
    socket.on('connect', () => resolve({ ok: true }));
    socket.on('connect_error', (error) => resolve({ ok: false, message: error.message }));
  });
  return { ...result, events, close: () => socket.close() };
};

/**
 * 직접 해보기 1 한 판 - 실습 서버를 띄우고 jaehoon 의 연결을 열어 둔 채 practice1.http 를 한 요청씩 보낸다.
 * 요청마다 [제목, 상태 코드, 본문, 그 요청 뒤 jaehoon 이 새로 받은 이벤트] 를 돌려준다.
 */
const runPractice1 = async (edit) => {
  const dir = studentCopy('practice1', edit);
  onPort(dir, LAB_PORT);
  const lab = await boot(join(dir, LAB, 'practice1.js'), { port: LAB_PORT, cwd: dir, env: ENV, ready: `${LAB_PORT}번 포트에서` });
  const jaehoon = await watcher(await loginBox('jaehoon', 'jaehoon1234'));
  try {
    if (!jaehoon.ok) throw new Error(`jaehoon 연결 실패 ${jaehoon.message}`);
    const box = jar();
    const runs = [];
    for (const request of parseHttp(toTest(read(join(dir, LAB, 'practice1.http'))))) {
      const mark = jaehoon.events.length;
      const r = await send(box, request);
      await sleep(300);
      runs.push({ title: request.title, status: r.status, body: request.title.includes('로그인') ? '…' : r.body, events: jaehoon.events.slice(mark) });
    }
    return { runs, log: lab.tail() };
  } finally {
    jaehoon.close();
    await Promise.race([lab.stop(), sleep(500)]);
  }
};
/** 정답 판과 처음 달라지는 요청 - 번호(1부터) · 제목 · 정답 · 틀린 판. */
const firstDiff = (right, wrong) => {
  const at = right.findIndex((r, i) => JSON.stringify(r) !== JSON.stringify(wrong[i]));
  return at === -1 ? null : { no: at + 1, title: right[at].title, right: right[at], wrong: wrong[at] };
};

describe('직접 해보기 1 - 남긴 알림과 사라진 알림을 연결로 보낸다', () => {
  it('practice1.http 차례대로 - 누르면 jaehoon 에게 새 알림 4 · 한 번 더와 내 리뷰는 아무것도 안 온다 · 취소하면 사라진 알림 4 · 한 번 더 취소는 아무것도 안 온다', async () => {
    const { runs } = await runPractice1();
    seen.practice1 = runs;
    expect(runs.map((r) => [r.title, r.status, r.body, r.events])).toEqual([
      ['seoyeon으로 로그인 - 수업 백엔드', 200, '…', []],
      ['jaehoon의 리뷰 1에 «도움이 돼요»', 200, { helpful: true, helpfulCount: 2 }, [['notification:new', { id: 4, from: 'seoyeon', reviewId: 1 }]]],
      ['한 번 더', 200, { helpful: true, helpfulCount: 2 }, []],
      ['내 리뷰 2에 «도움이 돼요»', 200, { helpful: true, helpfulCount: 1 }, []],
      ['jaehoon의 리뷰 1에 누른 «도움이 돼요» 취소', 200, { helpful: false, helpfulCount: 1 }, [['notification:removed', { id: 4 }]]],
      ['한 번 더 취소', 200, { helpful: false, helpfulCount: 1 }, []],
    ]);
  }, 60_000);

  it('확인용 화면은 로그인 없이 받는다 · 로그인 없이 연 연결은 «로그인이 필요해요» 로 거절 · API 는 401', async () => {
    const dir = studentCopy('practice1');
    // 데이터 - 4번 «도움이 돼요» 는 sujin 이 자기 리뷰에 누른 것이라 알림이 없다(알림 번호와 «도움이 돼요» 번호가 갈리게).
    const data = await import(join(dir, LAB, 'helpful-data.js'));
    expect(data.helpfuls.map((h) => h.id)).toEqual([1, 2, 3, 4]);
    expect(data.notifications.map((n) => n.helpfulId)).toEqual([1, 2, 3]);
    onPort(dir, LAB_PORT);
    const lab = await boot(join(dir, LAB, 'practice1.js'), { port: LAB_PORT, cwd: dir, env: ENV, ready: `${LAB_PORT}번 포트에서` });
    try {
      const page = await fetch(`http://localhost:${LAB_PORT}/watch.html`);
      const script = await fetch(`http://localhost:${LAB_PORT}/watch.js`);
      const client = await fetch(`http://localhost:${LAB_PORT}/socket.io/socket.io.js`);
      expect([page.status, script.status, client.status]).toEqual([200, 200, 200]);
      const anon = await watcher(null);
      anon.close();
      expect([anon.ok, anon.message]).toEqual([false, '로그인이 필요해요']);
      const res = await fetch(`http://localhost:${LAB_PORT}/api/reviews/1/helpful/me`, { method: 'PUT' });
      expect([res.status, await res.json()]).toEqual([401, { message: '로그인이 필요해요' }]);
    } finally {
      await Promise.race([lab.stop(), sleep(500)]);
    }
  }, 30_000);

  it('빈칸 판 - 파싱되고(node --check), 빈칸 네 곳을 정답으로 채우면 practice1.js 와 같다 · 빈칸 그대로 켜면 누를 때 서버가 500', async () => {
    const blank = read(P('snapshots/p3-69/practice1.blank.js'));
    expect(blank.split('____').length - 1).toBe(4);
    execFileSync(process.execPath, ['--check', P('snapshots/p3-69/practice1.blank.js')]);
    let filled = blank;
    for (const answer of ['`user:${review.authorId}`', 'toItem(notification)', "'notification:removed'", 'removed.id']) filled = filled.replace('____', answer);
    expect(filled).toBe(read(P(`${LAB}/practice1.js`)));
    const { runs } = await runPractice1(() => blank);
    seen.practice1Blank = runs;
    expect(runs[1].status).toBe(500);
  }, 60_000);

  // 틀린 답 - 빈칸에 학생이 실제로 넣을 법한 것. 그 답을 가려내는 «처음 달라지는 요청» 을 잠근다.
  const PUT_LINE = "io.to(`user:${review.authorId}`).emit('notification:new', toItem(notification));";
  const DEL_LINE = "io.to(`user:${removed.receiverId}`).emit('notification:removed', { id: removed.id });";
  const PRACTICE_WRONG = {
    '누른 사람의 방으로 보낸다': swap(PUT_LINE, "io.to(`user:${userId}`).emit('notification:new', toItem(notification));"),
    '방 이름을 따옴표로만 쓴다': swap(PUT_LINE, "io.to('user:review.authorId').emit('notification:new', toItem(notification));"),
    '저장한 줄을 그대로 보낸다': swap(PUT_LINE, "io.to(`user:${review.authorId}`).emit('notification:new', notification);"),
    '사라진 알림을 새 알림 이름으로': swap(DEL_LINE, "io.to(`user:${removed.receiverId}`).emit('notification:new', { id: removed.id });"),
    '사라진 알림에 «도움이 돼요» 번호': swap(DEL_LINE, "io.to(`user:${removed.receiverId}`).emit('notification:removed', { id: helpful.id });"),
    '사라진 알림에 리뷰 번호': swap(DEL_LINE, "io.to(`user:${removed.receiverId}`).emit('notification:removed', { id: review.id });"),
  };

  it('틀린 답 여섯 - 각자 처음 달라지는 확인 번호가 있다', async () => {
    const right = (await runPractice1()).runs;
    const diffs = {};
    for (const [name, edit] of Object.entries(PRACTICE_WRONG)) diffs[name] = firstDiff(right, (await runPractice1(edit)).runs);
    seen.practice1Wrong = diffs;
    expect(Object.fromEntries(Object.entries(diffs).map(([k, d]) => [k, d && [d.no, d.title, d.wrong.events]]))).toEqual({
      '누른 사람의 방으로 보낸다': [2, 'jaehoon의 리뷰 1에 «도움이 돼요»', []],
      '방 이름을 따옴표로만 쓴다': [2, 'jaehoon의 리뷰 1에 «도움이 돼요»', []],
      '저장한 줄을 그대로 보낸다': [2, 'jaehoon의 리뷰 1에 «도움이 돼요»', [['notification:new', { id: 4, receiverId: 2, senderId: 43, reviewId: 1, helpfulId: 5 }]]],
      '사라진 알림을 새 알림 이름으로': [5, 'jaehoon의 리뷰 1에 누른 «도움이 돼요» 취소', [['notification:new', { id: 4 }]]],
      '사라진 알림에 «도움이 돼요» 번호': [5, 'jaehoon의 리뷰 1에 누른 «도움이 돼요» 취소', [['notification:removed', { id: 5 }]]],
      '사라진 알림에 리뷰 번호': [5, 'jaehoon의 리뷰 1에 누른 «도움이 돼요» 취소', [['notification:removed', { id: 1 }]]],
    });
  }, 180_000);
});

// ── 과제 [기초] - 아직 안 본 알림(백엔드) ─────────────────────────────
// 처음 상태 - 안 읽은 알림(isRead false)은 3 · 4 · 6 · 7 의 넷 · sujin 이 패널을 마지막으로 연 11월 24일 오전 9시 뒤에 온 알림은 5 · 6 · 7 의 셋.
//   그래서 «안 읽음을 세는 답» 이 첫 확인에서 갈린다.
const HW_PORT = 4074;
const HW_TEST_PORT = 4898;

/** 과제 서버 하나 - 정답 판(또는 강의 자료 판)에 edit 을 걸어 판정 포트로 띄우고 homework1.http 를 위에서부터 보낸다. */
const runHomework1 = async ({ start = false, edit } = {}) => {
  const dir = studentCopy('homework1');
  const file = join(dir, LAB, 'homework1.js');
  let source = start ? read(P('snapshots/p3-69/homework1.start.js')) : read(file);
  if (edit) source = edit(source);
  expect(source.split(String(HW_PORT)).length - 1).toBe(2);
  writeFileSync(file, source.replaceAll(String(HW_PORT), String(HW_TEST_PORT)));
  const server = await boot(file, { port: HW_TEST_PORT, cwd: dir, env: ENV, ready: `localhost:${HW_TEST_PORT}` });
  try {
    const http = read(join(dir, LAB, 'homework1.http')).replaceAll(`http://localhost:${HW_PORT}`, `http://localhost:${HW_TEST_PORT}`);
    const runs = await httpyac(http);
    await sleep(100);
    return { runs, log: server.tail() };
  } finally {
    await Promise.race([server.stop(), sleep(500)]);
  }
};
/** 응답을 비교할 모양으로 - 목록은 [번호, 읽음] · 새 알림은 번호와 보낸 사람만(시각은 판정 때마다 다르다). */
const shape = (r) => {
  if (Array.isArray(r.body?.items)) return r.body.items.map((item) => [item.id, item.isRead]);
  if (r.body && typeof r.body === 'object' && 'createdAt' in r.body) return { id: r.body.id, message: r.body.message, isRead: r.body.isRead };
  return r.body;
};

describe('과제 [기초] - 아직 안 본 알림', () => {
  it('강의 자료 판과 정답 판 - 정답은 라우트 둘만 더했다 · 강의 자료 판은 직접 해보기 2 서버에서 실시간과 1초 지연을 뺀 것과 같은 데이터', () => {
    const start = read(P('snapshots/p3-69/homework1.start.js'));
    const answer = read(P(`${LAB}/homework1.js`));
    const added = answer.split('\n').filter((line) => !start.split('\n').includes(line));
    expect(added.filter((l) => l.startsWith('app.'))).toEqual(["app.get('/api/notifications/unseen', (req, res) => {", "app.patch('/api/notifications/seen', (req, res) => {"]);
    const dataOf = (text) => text.slice(text.indexOf('const notices = ['), text.indexOf('];', text.indexOf('const notices = [')));
    expect(dataOf(start)).toBe(dataOf(read(P(`${LAB}/notice-server.js`))));
    expect(start).toContain('let seenAt = seoul(24, 9, 0);');
    // [응용] 서버의 두 라우트는 [기초] 정답과 같은 줄이다.
    const routes = (text) => text.slice(text.indexOf('// 아직 안 본 알림의 수'), text.indexOf("  res.json({ unseenCount: 0 });\n});") + 30);
    expect(routes(read(P(`${LAB}/homework2-server.js`)))).toBe(routes(answer));
  });

  it('homework1.http 차례대로 - 안 본 3 · 열면 0 · 다시 0 · 새 알림 8 · 그 뒤 1 · 목록의 읽음은 그대로', async () => {
    const { runs, log } = await runHomework1();
    seen.homework1 = runs;
    expect(runs.map((r) => [r.title, r.status, shape(r)])).toEqual([
      ['아직 안 본 알림 수', 200, { unseenCount: 3 }],
      ['알림 패널을 열었다', 200, { unseenCount: 0 }],
      ['다시 센 수', 200, { unseenCount: 0 }],
      ['누군가 «도움이 돼요» 를 눌렀다 - 개발용', 201, { id: 8, message: 'yuna님이 회원님의 리뷰가 도움이 된대요', isRead: false }],
      ['새 알림이 온 뒤의 수', 200, { unseenCount: 1 }],
      ['내 알림 목록 - 읽음은 그대로', 200, [[8, false], [7, false], [6, false], [5, true], [4, false]]],
    ]);
    expect(log).toContain('PATCH /api/notifications/seen');
  }, 60_000);

  const UNSEEN_FILTER = '  const unseen = notices.filter((notice) => notice.createdAt > seenAt);';
  const HOMEWORK1_WRONG = {
    '라우트가 없다(강의 자료 그대로)': { start: true },
    '안 읽은 알림을 센다': { edit: swap(UNSEEN_FILTER, '  const unseen = notices.filter((notice) => !notice.isRead);') },
    '시각 비교가 거꾸로': { edit: swap(UNSEEN_FILTER, '  const unseen = notices.filter((notice) => notice.createdAt < seenAt);') },
    '열었을 때 본 시각을 안 바꾼다': { edit: swap('  seenAt = new Date().toISOString();\n', '') },
    '열었을 때 읽음까지 바꾼다': { edit: swap('  seenAt = new Date().toISOString();\n', '  seenAt = new Date().toISOString();\n  notices.forEach((notice) => {\n    notice.isRead = true;\n  });\n') },
    // 본 시각을 Date 로 적으면 글자(ISO)와 비교가 늘 거짓이라 새 알림도 안 센다.
    '본 시각을 Date 로 적는다': { edit: swap('  seenAt = new Date().toISOString();\n', '  seenAt = new Date();\n') },
  };

  it('틀린 답 여섯 - 각자 처음 달라지는 확인 번호가 있다', async () => {
    const right = (await runHomework1()).runs.map((r) => ({ title: r.title, status: r.status, body: shape(r) }));
    const diffs = {};
    for (const [name, opts] of Object.entries(HOMEWORK1_WRONG)) {
      const wrong = (await runHomework1(opts)).runs.map((r) => ({ title: r.title, status: r.status, body: shape(r) }));
      diffs[name] = firstDiff(right, wrong);
    }
    seen.homework1Wrong = diffs;
    expect(Object.fromEntries(Object.entries(diffs).map(([k, d]) => [k, d && [d.no, d.title, d.wrong.status, d.wrong.body]]))).toEqual({
      '라우트가 없다(강의 자료 그대로)': [1, '아직 안 본 알림 수', 404, expect.anything()],
      '안 읽은 알림을 센다': [1, '아직 안 본 알림 수', 200, { unseenCount: 4 }],
      '시각 비교가 거꾸로': [1, '아직 안 본 알림 수', 200, { unseenCount: 4 }],
      '열었을 때 본 시각을 안 바꾼다': [3, '다시 센 수', 200, { unseenCount: 3 }],
      '열었을 때 읽음까지 바꾼다': [6, '내 알림 목록 - 읽음은 그대로', 200, [[8, false], [7, true], [6, true], [5, true], [4, true]]],
      '본 시각을 Date 로 적는다': [5, '새 알림이 온 뒤의 수', 200, { unseenCount: 0 }],
    });
  }, 180_000);
});
