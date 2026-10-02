// 내부 검증 전용 — 교안에 한 줄도 인용하지 않는다.
//
// 🚨 이 회차부터 «연결 문자열이 파일 안에 없다». `p2-24` 까지는 `withLocalMongo` 가
//    `const MONGO_URL = '...'` 한 줄을 바꿔 친 사본을 띄웠는데, 이 회차가 그 줄을
//    `.env` 로 빼내므로 바꿔 칠 자리가 사라진다. 그래서 **파일은 한 글자도 안 건드리고**
//    학생이 `--env-file` 로 넣어주는 그 자리에 게이트가 자기 값을 넣는다(`boot({ env })`).
//    「교안 인용과 byte 동일」이 오히려 더 튼튼해졌다 — 사본이 아예 없다.
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, writeFileSync, unlinkSync } from 'node:fs';
import mongoose from 'mongoose';
import { boot, withLocalMongo, dropLocal, LOCAL_MONGO_URL } from './helpers/boot.js';

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const ENV = { MONGO_URL: LOCAL_MONGO_URL };
const readyAt = (port) => `서버가 ${port}번 포트에서`;

let server = null;
let SEED24 = null;
// 🚨 `p2-24` 판은 아직 «파일 안» 에 연결 주소를 들고 있어서, 이 회차 방식(환경으로
//    넣기)이 안 먹는다. 그 판만 예전 수법 그대로 사본을 띄운다.
let APP24 = null;
// Step 2 시점도 아직 «파일 안» 에 주소를 들고 있다 — 그 줄은 Step 4 가 뺀다.
let STEP2 = null;

// 🚨 **`app.js`·`seed.js` 를 이 회차 판으로 얼린다** (2026-09-11 `p2-30` 착수 시).
//    이 회차까지는 `app.js` 가 워킹 트리에 «그대로» 서 있어서 live 로 봐도 맞았는데,
//    `p2-30` 이 그 파일을 Prisma 로 통째로 다시 쓴다. 그러면 이 회차 축 13곳이
//    한꺼번에 빨개지는데 **그건 이 회차 교안이 틀렸다는 뜻이 아니다** — `p2-24` 가
//    같은 이유로 이미 `fromBranch('code/p2-24', …)` 를 쓰고 있다.
//    스냅숏은 `snapshots/` 아래 있어 «불러오는 줄만» 학생 표기와 다르다(`../`).
const FINAL = 'snapshots/p2-25.final.app.js';
const FINAL_SEED = 'snapshots/p2-25.final.seed.js';

beforeAll(() => {
  SEED24 = withLocalMongo('snapshots/p2-24.final.seed.js');
  APP24 = withLocalMongo('snapshots/p2-24.final.app.js');
  STEP2 = withLocalMongo('snapshots/p2-25.step2.app.js');
});

afterAll(async () => {
  dropLocal(SEED24);
  dropLocal(APP24);
  dropLocal(STEP2);
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
});

afterEach(async () => {
  if (server) { await server.stop(); server = null; }
});

/** 학생이 치는 그 명령 그대로 — 다만 게시물 셋을 미리 넣어둔다. */
function seed() {
  execFileSync(process.execPath, [SEED24], { encoding: 'utf-8' });
}

async function bootApp(file, { port = 3000, env = ENV } = {}) {
  seed();
  server = await boot(file, { port, env, ready: readyAt(port) });
  return server;
}

/** `<pre>` 안의 진짜 텍스트 — Express 기본 화면은 HTML 이라 풀어야 센다. */
function preLines(html) {
  const m = /<pre>([\s\S]*?)<\/pre>/.exec(html);
  if (!m) return null;
  return m[1]
    .replace(/<br>/g, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .split('\n');
}

// ── 오프닝·Step 1 — `p2-24` 가 남긴 그 화면을 «세어본다» ──────────────────────
describe('오프닝 — 잘못된 번호 하나가 무엇을 내보내나', () => {
  it('500 이고, 우리가 만든 적 없는 HTML 이다', async () => {
    await bootApp(APP24);

    const res = await fetch(`${server.base}/api/posts/2`);
    expect(res.status).toBe(500);
    expect(res.headers.get('content-type')).toMatch(/text\/html/);
  });

  it('본문이 11줄인데 그중 10줄이 스택이고, 내 컴퓨터 경로가 9번 실린다', async () => {
    await bootApp(APP24);

    const lines = preLines(await (await fetch(`${server.base}/api/posts/2`)).text());
    expect(lines).not.toBeNull();
    expect(lines).toHaveLength(11);
    expect(lines[0]).toMatch(/^CastError: Cast to ObjectId failed/);
    expect(lines.slice(1).every((l) => l.trim().startsWith('at '))).toBe(true);

    // 🚨 교안 오프닝이 이 수를 그대로 적는다. mongoose 가 올라가 스택 깊이가
    //    바뀌면 여기서 먼저 깨져야 한다 — 교안이 조용히 거짓이 되는 것보다 낫다.
    const abs = lines.filter((l) => l.includes(process.cwd())).length;
    expect(abs).toBe(9);
  });

  it('정상 게시물 하나보다 훨씬 크다 — 에러가 데이터보다 많이 나간다', async () => {
    await bootApp(APP24);

    const err = (await (await fetch(`${server.base}/api/posts/2`)).text()).length;
    const list = await (await fetch(`${server.base}/api/posts`)).json();
    const one = JSON.stringify(list[0]).length;
    expect(err).toBeGreaterThan(one * 4);
  });

  it('🔴 깨진 몸통은 «이미» 400 이다 — 코드는 맞고 형식만 틀렸다', async () => {
    // 🚨 초고는 이것을 *"지난 시간에는 400 으로 왔어요"* 로 적었는데 **거짓이었다** —
    //    `p2-23` 은 400 을 «우리가 쓴 검사» 로만 가르쳤고, 깨진 몸통을 학생이 보낸 적이
    //    없다. 그래서 Step 1 이 «지금 직접» 재게 하는 것으로 바꿨고, 그 전제를 여기서 잠근다.
    await bootApp(APP24);

    const res = await fetch(`${server.base}/api/posts`, {
      method: 'POST', headers: JSON_HEADERS, body: '{\n  "username": "yuna"',
    });
    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toMatch(/text\/html/);
    expect(await res.text()).toContain('SyntaxError');
  });

  it('그런데 서버는 안 죽었다 — 다음 요청은 멀쩡히 답한다', async () => {
    await bootApp(APP24);

    await fetch(`${server.base}/api/posts/2`);
    const after = await fetch(`${server.base}/api/posts`);
    expect(after.status).toBe(200);
    expect(await after.json()).toHaveLength(3);
  });

  it('🚨 스택이 새는 것은 «개발 중일 때만» 이다 — 배포본을 흉내 내면 한 줄뿐', async () => {
    // Render 는 Node 서비스에 NODE_ENV=production 을 스스로 넣는다(공식 문서).
    // 그러니 배포하면 이 유출은 «저절로» 가려진다 — 우리가 시킨 것이 아니라서
    // 문제인 것이지, 배포본이 이 스택을 흘린다고 말하면 그건 거짓이다.
    await bootApp(APP24, { env: { NODE_ENV: 'production' } });

    const body = await (await fetch(`${server.base}/api/posts/2`)).text();
    expect(body).not.toContain('CastError');
    expect(body).not.toContain(process.cwd());
    expect(preLines(body)).toEqual(['Internal Server Error']);
  });
});

// ── Step 2 — 에러를 받아내는 자리 ───────────────────────────────────────────
describe('Step 2 — 인자 넷짜리 미들웨어가 그 에러를 받는다', () => {
  it('HTML 이 JSON 으로 바뀐다 (코드는 아직 500)', async () => {
    await bootApp(STEP2);

    const res = await fetch(`${server.base}/api/posts/2`);
    expect(res.status).toBe(500);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
    expect(await res.json()).toEqual({ message: '서버에서 문제가 생겼어요' });
  });

  it('스택은 이제 응답에 안 실린다 — 터미널에만 남는다', async () => {
    await bootApp(STEP2);

    const body = await (await fetch(`${server.base}/api/posts/2`)).text();
    expect(body).not.toContain('node_modules');
    expect(body).not.toContain(process.cwd());
    expect(server.tail()).toContain('CastError');
  });

  it('바로 위 404 미들웨어는 인자가 둘이라 에러가 그냥 지나간다', async () => {
    await bootApp(STEP2);

    const res = await fetch(`${server.base}/api/comments`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: '그런 주소는 없어요' });
  });

  it('🚨 그런데 지난 시간에 400 이던 것이 500 으로 바뀌었다', async () => {
    // `p2-23` 이 「깨진 JSON 은 우리가 안 붙여도 Express 가 400 을 낸다」를 가르쳤다.
    // 통째로 500 을 내는 핸들러가 그 400 을 덮는다 — Step 3 이 갚는 빚이다.
    await bootApp(STEP2);

    const res = await fetch(`${server.base}/api/posts`, {
      method: 'POST', headers: JSON_HEADERS, body: '{"username"',
    });
    expect(res.status).toBe(500);
  });
});

// ── Step 3 — 에러마다 다른 답 ───────────────────────────────────────────────
describe('Step 3 — 갈라서 답한다', () => {
  it('형식이 틀린 번호는 404 다 — 잘못 보낸 쪽 문제니까', async () => {
    await bootApp(FINAL);

    const res = await fetch(`${server.base}/api/posts/2`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: '그런 게시물은 없어요' });
  });

  it('형식은 맞는데 없는 번호도 404 로 «같은 답» 이다', async () => {
    await bootApp(FINAL);

    const res = await fetch(`${server.base}/api/posts/507f1f77bcf86cd799439011`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: '그런 게시물은 없어요' });
  });

  it('고치기·지우기도 형식이 틀린 번호에 404 를 낸다', async () => {
    await bootApp(FINAL);

    const patch = await fetch(`${server.base}/api/posts/2`, {
      method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ likeCount: 1 }),
    });
    expect(patch.status).toBe(404);

    const del = await fetch(`${server.base}/api/posts/2`, { method: 'DELETE' });
    expect(del.status).toBe(404);
  });

  it('🔴 깨진 JSON 은 400 으로 돌아왔다', async () => {
    await bootApp(FINAL);

    const res = await fetch(`${server.base}/api/posts`, {
      method: 'POST', headers: JSON_HEADERS, body: '{"username"',
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ message: '보낸 내용을 읽을 수 없어요' });
  });

  it('멀쩡한 요청 여덟은 지난 시간과 같은 코드를 낸다 — 겉이 안 변했다', async () => {
    await bootApp(FINAL);

    const list = await fetch(`${server.base}/api/posts`);
    expect(list.status).toBe(200);
    const posts = await list.json();

    expect((await fetch(`${server.base}/api/posts/${posts[0]._id}`)).status).toBe(200);
    expect((await fetch(`${server.base}/api/posts/507f1f77bcf86cd799439011`)).status).toBe(404);
    expect((await fetch(`${server.base}/api/comments`)).status).toBe(404);

    const created = await fetch(`${server.base}/api/posts`, {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ username: 'yuna', postImage: 'https://example.com/a.jpg' }),
    });
    expect(created.status).toBe(201);
    const { _id } = await created.json();

    expect((await fetch(`${server.base}/api/posts`, {
      method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ username: 'yuna' }),
    })).status).toBe(400);

    expect((await fetch(`${server.base}/api/posts/${_id}`, {
      method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ likeCount: 7 }),
    })).status).toBe(200);

    expect((await fetch(`${server.base}/api/posts/${_id}`, { method: 'DELETE' })).status).toBe(200);
  });

  it('우리 핸들러가 붙은 뒤로는 배포본이든 개발 중이든 «같은 답» 이다', async () => {
    await bootApp(FINAL, { env: { ...ENV, NODE_ENV: 'production' } });

    const res = await fetch(`${server.base}/api/posts/2`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: '그런 게시물은 없어요' });
  });
});

// ── Step 4 — 연결 문자열을 코드 밖으로 ──────────────────────────────────────
describe('Step 4 — 비밀번호가 코드에 없다', () => {
  const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf-8');

  it('`app.js`·`seed.js` 어디에도 연결 주소가 글자로 안 남아 있다', () => {
    for (const f of [FINAL, FINAL_SEED]) {
      expect(src(f)).not.toContain('mongodb+srv://');
      expect(src(f)).not.toContain('mongodb://');
      expect(src(f)).toContain('process.env.MONGO_URL');
    }
  });

  it('두 곳에 있던 그 줄이 «한 곳» 으로 모였다', () => {
    const both = src(FINAL) + src(FINAL_SEED);
    expect(both.match(/const MONGO_URL = /g)).toBeNull();
  });

  it('`.env` 는 저장소에 안 올라가고 `.env.example` 은 올라간다', () => {
    const ignore = src('.gitignore');
    expect(ignore).toContain('.env');
    expect(ignore).toContain('!.env.example');
    expect(existsSync(new URL('../.env.example', import.meta.url))).toBe(true);

    const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf-8' }).split('\n');
    expect(tracked).toContain('.env.example');
    expect(tracked).not.toContain('.env');
  });

  it('`.env.example` 은 이름만 알려주고 값은 안 알려준다', () => {
    const ex = src('snapshots/p2-25.env.example');
    expect(ex).toContain('MONGO_URL=');
    expect(ex).not.toContain('mongodb+srv://cluster');
    expect(ex).not.toMatch(/MONGO_URL=mongodb\+srv:\/\/[a-z]/i);
  });

  it('🔴 `#` 이 든 값은 따옴표로 감싸야 한다 — 안 그러면 «조용히» 잘린다', () => {
    // 🚨 초고는 *"따옴표는 안 붙이는 게 보통"* 이라고 안내했는데, Atlas 비밀번호에
    //    `#` 이 든 학생은 그 조언대로 하면 값이 잘려 인증 실패로 헤맨다.
    //    `got "undefined"` 도 안 뜨는 자리라 원인을 짚기가 특히 어렵다.
    const f = '/tmp/p2-25-hash-probe.env';
    writeFileSync(f, `BARE=p@ss#w0rd\nDQ="p@ss#w0rd"\nSQ='p@ss#w0rd'\n`);
    const read = (k) => execFileSync(process.execPath,
      [`--env-file=${f}`, '-p', `process.env.${k}`], { encoding: 'utf-8' }).trim();
    expect(read('BARE')).toBe('p@ss');        // # 뒤가 주석으로 잘린다
    expect(read('DQ')).toBe('p@ss#w0rd');     // 따옴표가 지켜준다
    expect(read('SQ')).toBe('p@ss#w0rd');
    unlinkSync(f);
  });

  it('🚨 값이 아예 없으면 «뜨지도 못한다» — 로컬에서 `npm start` 를 친 경우', async () => {
    // 학생이 가장 자주 밟는 자리다. 그런데 Mongoose 가 내는 말에는 `MONGO_URL`
    // 이라는 이름이 «안 나온다» — 교안이 이 화면을 그대로 보여줘야 하는 이유다.
    seed();
    const err = await boot(FINAL, { env: { MONGO_URL: undefined }, ready: readyAt(3000) })
      .then(() => null, (e) => e);
    expect(err).not.toBeNull();
    expect(err.message).toContain('MongooseError');
    expect(err.message).toContain('got "undefined"');
    expect(err.message).not.toContain('MONGO_URL');
  });
});

// ── Step 7 — 붙을 데가 없으면 «떠 있지도 않다» ──────────────────────────────
describe('Step 7 — Atlas 를 열어도 다시 띄워야 하는 이유', () => {
  it('🔴 연결에 실패하면 `app.listen` 까지 못 가고 프로세스가 끝난다', () => {
    // 교안이 *"지금 Render 에는 떠 있는 서버가 아예 없어요"* 라고 말한다.
    // 최상위 await 이라 연결 실패가 곧 기동 실패다 — 그래서 Atlas 를 고친 «뒤»
    // 다시 띄워야 하고, 그 한 줄이 없으면 학생이 계속 에러 페이지를 본다.
    let out = '', code = 0;
    try {
      out = execFileSync(process.execPath, [FINAL], {
        encoding: 'utf-8', stdio: 'pipe',
        env: { ...process.env, MONGO_URL: 'mongodb://127.0.0.1:27099/nope', PORT: '3351' },
      });
    } catch (e) { code = e.status; out = `${e.stdout}${e.stderr}`; }
    expect(code).toBe(1);
    expect(out).not.toContain('기다리고 있어요');
    expect(out).toContain('ServerSelectionError');
  }, 60000);
});

// ── Step 5 — 포트도 환경이 정한다 ───────────────────────────────────────────
describe('Step 5 — 올릴 수 있는 모양', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));

  it('환경이 포트를 주면 그 포트에서 답한다', async () => {
    await bootApp(FINAL, { port: 4321, env: { ...ENV, PORT: '4321' } });

    expect(server.log).toContain('서버가 4321번 포트에서');
    expect((await fetch(`${server.base}/api/posts`)).status).toBe(200);
  });

  it('안 주면 3000 그대로다 — 내 컴퓨터에서 하던 것이 안 바뀐다', async () => {
    await bootApp(FINAL);
    expect(server.log).toContain('서버가 3000번 포트에서');
  });

  it('`dev` 는 `.env` 를 읽고 `start` 는 안 읽는다', () => {
    expect(pkg.scripts.dev).toContain('--env-file=.env');
    expect(pkg.scripts.dev).toContain('--watch');
    // 🚨 배포한 곳은 `.env` 파일이 없다. `start` 에 그 플래그를 두면
    //    `node: .env: not found` 로 «뜨지도 못한다»(실측).
    expect(pkg.scripts.start).not.toContain('--env-file');
    expect(pkg.scripts.seed).toContain('--env-file=.env');
  });

  it('`--env-file` 이 없으면 정말 못 뜬다 — 그래서 `start` 에 안 둔다', () => {
    let failed = '';
    try {
      execFileSync(process.execPath, ['--env-file=.env.does-not-exist', '-e', '0'],
        { encoding: 'utf-8', stdio: 'pipe' });
    } catch (e) { failed = `${e.stderr}${e.stdout}`; }
    expect(failed).toMatch(/not found/);
  });

  it('`node_modules` 는 저장소에 안 올라간다', () => {
    expect(readFileSync(new URL('../.gitignore', import.meta.url), 'utf-8'))
      .toContain('node_modules');
  });
});

// ── Step 8 — CORS ───────────────────────────────────────────────────────────
describe('Step 8 — 브라우저가 응답을 버리지 않게', () => {
  it('다른 곳에서 온 요청에도 «읽어도 된다» 는 표시가 붙는다', async () => {
    await bootApp(FINAL);

    const res = await fetch(`${server.base}/api/posts`, {
      headers: { Origin: 'https://example.vercel.app' },
    });
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('그 표시가 없던 때는 응답이 «오긴» 왔다 — 막은 것은 브라우저다', async () => {
    // 🚨 교안이 「요청은 서버까지 간다」고 말한다. 서버가 Origin 을 받아 200 을
    //    돌려준다는 것이 그 근거다 — 브라우저만 그 응답을 안 읽는다.
    await bootApp(APP24);

    const res = await fetch(`${server.base}/api/posts`, {
      headers: { Origin: 'https://example.vercel.app' },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });
});

// ── 실습·과제 ───────────────────────────────────────────────────────────────
describe('실습 — 서점에도 같은 자리를 만든다', () => {
  const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf-8');

  it('`Book.js`·`Comment.js` 는 지난 시간 것 그대로다 — 학생 `lab/` 엔 한 벌뿐이다', () => {
    // 코드베이스만 회차별로 나눠 두므로, 갈라진 두 벌이 어긋나면 여기서 잡는다.
    expect(src('lab/p2-25/Book.js')).toBe(src('lab/p2-24/Book.js'));
    expect(src('lab/p2-25/Comment.js')).toBe(src('lab/p2-24/Comment.js'));
  });

  it('🔴 실습 파일이 지난 시간 서점 코드의 라우트를 안 떨어뜨렸다', () => {
    // 🚨 교안이 「`practice3.js` 를 복사해서 시작」이라 시키므로 학생 파일에는
    //    PATCH·DELETE 가 있다. 초고의 저장소 판이 그 둘을 빠뜨려서, 교안이 말하는
    //    *"`PATCH /api/books/2` 로 확인해도 똑같이 404"* 장면이 저장소에서는
    //    «다른 이유로»(에러가 아니라 404 미들웨어) 404 가 되고 있었다.
    const before = src('lab/p2-24/practice3.js')
      .match(/^app\.(get|post|patch|delete)\('([^']+)'/gm) ?? [];
    for (const name of ['practice1.js', 'practice2.js', 'practice3.js']) {
      const after = src(`lab/p2-25/${name}`)
        .match(/^app\.(get|post|patch|delete)\('([^']+)'/gm) ?? [];
      for (const route of before) expect(after, `${name} :: ${route}`).toContain(route);
    }
  });

  it('실습 1 — 서점도 잘못된 번호에 404, 깨진 몸통에 400 을 낸다', async () => {
    const local = withLocalMongo('lab/p2-25/practice1.js');
    try {
      server = await boot(local, { port: 4000, ready: readyAt(4000) });

      expect((await fetch(`${server.base}/api/books/2`)).status).toBe(404);
      expect(await (await fetch(`${server.base}/api/books/2`)).json())
        .toEqual({ message: '그런 책은 없어요' });

      const broken = await fetch(`${server.base}/api/books`, {
        method: 'POST', headers: JSON_HEADERS, body: '{"title"',
      });
      expect(broken.status).toBe(400);
      expect((await fetch(`${server.base}/api/nope`)).status).toBe(404);
    } finally { dropLocal(local); }
  });

  it('실습 2 — 서점의 주소도 포트도 환경이 정한다', async () => {
    expect(src('lab/p2-25/practice2.js')).not.toContain('mongodb+srv://');
    server = await boot('lab/p2-25/practice2.js', {
      port: 4100, ready: readyAt(4100),
      env: { ...ENV, BOOKS_PORT: '4100' },
    });
    expect(server.log).toContain('서버가 4100번 포트에서');
    expect((await fetch(`${server.base}/api/books`)).status).toBe(200);
  });

  it('실습 2 — `BOOKS_PORT` 를 안 주면 4000 그대로다', async () => {
    server = await boot('lab/p2-25/practice2.js', { port: 4000, ready: readyAt(4000), env: ENV });
    expect(server.log).toContain('서버가 4000번 포트에서');
  });

  it('실습 3 — 그 서점이 브라우저에게 «읽어도 된다» 고 말한다', async () => {
    server = await boot('lab/p2-25/practice3.js', { port: 4000, ready: readyAt(4000), env: ENV });

    const res = await fetch(`${server.base}/api/books`, {
      headers: { Origin: 'http://localhost:5173' },
    });
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('실습 3 은 실습 2 에 «두 줄» 을 더한 것이다 (파일 이름 주석 빼고)', () => {
    const before = src('lab/p2-25/practice2.js').replace('lab/practice2.js', 'lab/practice3.js');
    const after = src('lab/p2-25/practice3.js');
    const stripped = after
      .replace("import cors from 'cors';\n", '')
      .replace('app.use(cors());\n', '');
    expect(stripped).toBe(before);
  });
});

describe('과제 — 댓글 API 와 «못 잡는 에러»', () => {
  it('[기초] 댓글도 오늘 배운 셋을 다 갖췄다', async () => {
    server = await boot('lab/p2-25/homework1.js', {
      port: 4000, ready: readyAt(4000), env: { ...ENV, COMMENTS_PORT: '4000' },
    });

    expect((await fetch(`${server.base}/api/comments/2`)).status).toBe(404);

    const made = await fetch(`${server.base}/api/comments`, {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ postId: 1, username: 'yuna', content: '좋아요', likeCount: 500 }),
    });
    expect(made.status).toBe(201);
    const { _id, likeCount } = await made.json();
    expect(likeCount).toBe(0);          // 보내는 쪽이 못 정한다

    const broken = await fetch(`${server.base}/api/comments`, {
      method: 'POST', headers: JSON_HEADERS, body: '{"postId"',
    });
    expect(broken.status).toBe(400);

    const res = await fetch(`${server.base}/api/comments`, {
      headers: { Origin: 'http://localhost:5173' },
    });
    expect(res.headers.get('access-control-allow-origin')).toBe('*');

    expect((await fetch(`${server.base}/api/comments/${_id}`, { method: 'DELETE' })).status)
      .toBe(200);
  });

  it('[응용] 🔴 셋 중 둘은 핸들러가 받고, 타이머 안의 하나는 «서버를 죽인다»', async () => {
    server = await boot('lab/p2-25/homework2.js', { port: 4000, ready: readyAt(4000) });

    expect((await fetch(`${server.base}/boom/sync`)).status).toBe(500);
    expect((await fetch(`${server.base}/boom/async`)).status).toBe(500);
    expect(server.tail()).toContain('[핸들러가 받았어요] 그 자리에서 바로 던졌어요');
    expect(server.tail()).toContain('[핸들러가 받았어요] 기다린 뒤에 던졌어요');

    // 타이머 안에서 던진 것은 응답도 못 받고 프로세스가 끝난다
    await fetch(`${server.base}/boom/later`).catch(() => null);
    await new Promise((r) => setTimeout(r, 800));
    await expect(fetch(`${server.base}/api/anything`)).rejects.toThrow();
    expect(server.tail()).not.toContain('[핸들러가 받았어요] 타이머 안에서 던졌어요');

    server = null;   // 이미 죽었다 — afterEach 가 또 죽이지 않게
  });
});

// ── 답안이 «산문으로만» 주장하는 것들 ────────────────────────────────────────
describe('답안의 주장을 실행으로 잠근다', () => {
  it('`express.json()` 이 내는 코드는 400 만이 아니다 — 413·415 도 있다', async () => {
    // 답안 「흔한 실수」가 *"400 만 콕 집어두면 그 둘이 500 으로 나간다"* 고 말한다.
    // 🚨 첫 판은 415 의 방아쇠를 「형식이 다를 때」로 적었다가 실측에 반증됐다 —
    //    Content-Type 이 JSON 이 아니면 `express.json()` 은 «그냥 건너뛰고» 200 이다.
    //    415 는 «글자 인코딩» 이 못 읽는 것일 때만 난다.
    server = await boot('snapshots/p2-25.probe.limits.js', { port: 3410, ready: 'probe' });

    const big = `{"a":"${'x'.repeat(300)}"}`;
    expect((await fetch(`${server.base}/x`, {
      method: 'POST', headers: JSON_HEADERS, body: big,
    })).status).toBe(413);

    expect((await fetch(`${server.base}/x`, {
      method: 'POST', headers: { 'Content-Type': 'application/json; charset=shift_jis' },
      body: '{"a":1}',
    })).status).toBe(415);

    // 반례 — Content-Type 이 아예 다르면 «에러가 아니라» 그냥 지나간다
    expect((await fetch(`${server.base}/x`, {
      method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'hello',
    })).status).toBe(200);
  });

  it('🔴 `cors()` 를 `express.json()` «아래» 두면 에러 응답에 CORS 표시가 안 붙는다', async () => {
    // 답안이 *"몸통을 읽다가 실패하는 요청에도 CORS 표시는 붙는다"* 로 순서를 권한다.
    server = await boot('snapshots/p2-25.probe.corsorder.js', { port: 3411, ready: 'probe' });

    const withOrigin = (path) => fetch(`${server.base}${path}`, {
      method: 'POST',
      headers: { ...JSON_HEADERS, Origin: 'http://localhost:5173' },
      body: '{"a"',
    });

    expect((await withOrigin('/above')).headers.get('access-control-allow-origin')).toBe('*');
    expect((await withOrigin('/below')).headers.get('access-control-allow-origin')).toBeNull();
  });
});

// ── 학생이 실제로 치는 그 명령 ──────────────────────────────────────────────
describe('`.http` 열이 새 답으로 돈다', () => {
  // 🚨 «그 시점 스냅숏» 을 보낸다 (2026-09-11 `p2-30` 착수 시). `requests/posts.http` 는
  //    회차마다 자라는 파일이고, `p2-30` 이 번호를 `_id` 에서 `id` 로 되돌리며 요청 둘을
  //    더한다(`?username=` · `?limit=`). live 파일을 보내면 「열 요청」이 열둘이 되어
  //    이 회차 교안이 틀렸다고 말하게 되는데, 그건 거짓이다.
  const HTTP = 'snapshots/p2-25.posts.http';

  it('4×200 · 1×201 · 2×400 · 3×404 — 오늘 늘어난 둘이 400·404 다', async () => {
    await bootApp(FINAL);
    const out = execFileSync(
      'node_modules/.bin/httpyac',
      ['send', HTTP, '--all', '--output', 'short'],
      { encoding: 'utf-8' });
    expect(out).toContain('10 requests processed (10 succeeded)');
    expect(out.match(/=> 200/g)).toHaveLength(4);
    expect(out.match(/=> 201/g)).toHaveLength(1);
    expect(out.match(/=> 400/g)).toHaveLength(2);   // 칸 빠뜨림 + 깨진 몸통(오늘 신규)
    expect(out.match(/=> 404/g)).toHaveLength(3);   // 없는 게시물 + 없는 주소 + 아무 글자나(오늘 신규)
  }, 60000);

  it('두 번 돌려도 게시물이 셋으로 돌아온다 — 만든 것을 자기가 치운다', async () => {
    await bootApp(FINAL);
    const send = () => execFileSync(
      'node_modules/.bin/httpyac',
      ['send', HTTP, '--all', '--output', 'short'],
      { encoding: 'utf-8' });
    send(); send();
    expect(await (await fetch(`${server.base}/api/posts`)).json()).toHaveLength(3);
  }, 90000);
});

// ── 교안·답안 인용이 코드베이스와 같은가 ────────────────────────────────────
describe('인용이 코드베이스와 byte 동일한가', () => {
  // 🚨 `p2-26` 이 여기서 이어 시작한다. 한 글자라도 다르면 다음 회차가 «재현 불가» 가
  //    되는데, 그건 다른 게이트가 원리적으로 안 본다.
  const LEC = '../../../part2/4-node-backend/p2-25-deploy-lecture.md';
  const ANS = '../../../part2/4-node-backend/p2-25-deploy-answers.md';

  const blocksOf = (path, head, fence = 'javascript') => {
    const md = readFileSync(new URL(path, import.meta.url), 'utf-8');
    const re = new RegExp('```' + fence + '\\n(' + head.replace(/[/.]/g, '\\$&') +
                          '\\n[\\s\\S]*?)```', 'g');
    return [...md.matchAll(re)].map((m) => m[1]);
  };
  // 🚨 **워킹 트리가 아니라 «그 회차 브랜치» 를 본다** (2026-09-11 `p2-30` 착수 시).
  //    `p2-30` 이 `app.js`·`seed.js` 를 Prisma 로 다시 쓰면 워킹 트리 대조는 이 회차
  //    교안이 틀렸다고 말하게 되는데, 그건 거짓이다. `p2-24` 가 쓰는 그 방법이다.
  //    위쪽 «띄우는» 자리와 달리 여기는 학생 표기 그대로여야 해서(`./models/…`)
  //    경로를 고친 스냅숏이 아니라 브랜치 원본을 읽는다.
  const FROZEN = new Set(['app.js', 'seed.js']);
  const real = (rel) =>
    FROZEN.has(rel)
      ? execFileSync('git', ['show', `code/p2-25:${rel}`], { encoding: 'utf-8' })
      : readFileSync(new URL(`../${rel}`, import.meta.url), 'utf-8');

  it('🔴 교안의 `app.js` 완성본이 코드베이스와 byte 동일하다', () => {
    const quoted = blocksOf(LEC, '// ~/instagram-api/app.js');
    expect(quoted.at(-1)).toBe(real('app.js'));
  });

  it('교안이 인용한 `app.js` 조각들이 코드베이스 안에 그대로 있다', () => {
    // 조각 발췌라 byte 동일 대신 «포함» 으로 본다 — 붙여넣은 것이 안 돌면 안 되니까.
    // 🚨 Step 2 가 인용하는 「통째로 500」 판은 «중간 상태» 라 완성본에 없다.
    //    그 조각은 그 시점 스냅숏에 있어야 맞다 — 둘 중 어디든 있으면 통과다.
    const wholes = [real('app.js'), real('snapshots/p2-25.step2.app.js')];
    const quoted = blocksOf(LEC, '// ~/instagram-api/app.js');
    expect(quoted.length).toBeGreaterThan(1);
    // 🚨 발췌는 «떨어진 자리 둘» 을 빈 줄로 이어 보여주기도 한다 (Step 8 의 `cors` —
    //    불러오는 줄은 맨 위, 놓는 줄은 한참 아래다). 그래서 블록 통째가 아니라
    //    **빈 줄로 끊은 덩어리마다** 있는지 본다. 덩어리 «안» 의 줄 순서는 그대로 잠긴다.
    for (const q of quoted.slice(0, -1)) {
      const body = q.split('\n').slice(1).join('\n').trim();
      for (const chunk of body.split(/\n\s*\n/).map((c) => c.trim()).filter(Boolean)) {
        expect(wholes.some((w) => w.includes(chunk)), chunk.slice(0, 60)).toBe(true);
      }
    }
  });

  it('교안이 인용한 `seed.js` 조각도 코드베이스 안에 있다', () => {
    for (const q of blocksOf(LEC, '// ~/instagram-api/seed.js')) {
      expect(real('seed.js')).toContain(q.split('\n').slice(1).join('\n').trim());
    }
  });

  it('답안의 lab 파일 인용이 전부 코드베이스 안에 있다', () => {
    const map = {
      '// ~/instagram-api/lab/homework1.js': 'lab/p2-25/homework1.js',
      '// ~/instagram-api/lab/homework2.js': 'lab/p2-25/homework2.js',
    };
    for (const [head, path] of Object.entries(map)) {
      const quoted = blocksOf(ANS, head);
      expect(quoted.length, head).toBeGreaterThan(0);
      for (const q of quoted) {
        expect(real(path), `${head} :: ${q.slice(0, 60)}`)
          .toContain(q.split('\n').slice(1).join('\n').trim());
      }
    }
  });

  it('🔴 교안이 말하는 「라우트 여섯」이 실제 수와 같다', () => {
    // 🚨 초고는 「라우트 다섯」이라고 적었다 — `/` 를 빼고 센 것인데 그 줄도
    //    라우트다. `p2-23` 이 같은 자리에서 같은 실수를 했었다(다섯↔여섯).
    const routes = real('app.js').match(/^app\.(?:get|post|patch|delete)\(/gm) ?? [];
    expect(routes).toHaveLength(6);
    expect(readFileSync(new URL(LEC, import.meta.url), 'utf-8')).toContain('라우트 여섯');
  });

  it('교안이 인용한 `package.json` 스크립트가 코드베이스와 같다', () => {
    const md = readFileSync(new URL(LEC, import.meta.url), 'utf-8');
    const block = /```json\n([\s\S]*?)```/.exec(md)[1].trim();
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));
    const quoted = JSON.parse(`{${block.replace(/,\s*$/, '')}}`);
    // 🚨 교안은 «학생이 오늘 넣는 세 줄» 만 보여준다. `test` 는 학생 쪽에서
    //    `npm init` 이 넣어준 기본값이고 코드베이스 쪽은 vitest 라 서로 다르다 —
    //    그 줄까지 인용하면 학생 파일에 내부 검증 도구가 새어 든다(초고가 그랬다).
    // 🚨 교안 블록은 «객체째» 보여주므로 `test` 줄이 빠지면 학생이 그대로 복사할 때
    //    그 줄을 지우게 된다(재정독이 잡은 자리). 학생 쪽 `test` 는 `npm init` 기본값이라
    //    코드베이스(vitest)와 다르고, 그래서 그 줄만 «값이 아니라 존재» 로 잠근다.
    expect(Object.keys(quoted.scripts)).toEqual(['start', 'dev', 'seed', 'test']);
    expect(quoted.scripts.test).toBe('echo "Error: no test specified" && exit 1');
    for (const k of ['start', 'dev', 'seed']) expect(pkg.scripts[k]).toBe(quoted.scripts[k]);
  });

  it('교안이 인용한 `.http` 두 조각이 요청 파일 안에 그대로 있다', () => {
    // 🚨 «그 시점 스냅숏» 을 본다 (2026-09-11 `p2-30` 착수 시). `p2-30` 이 번호를
    //    `_id` 에서 `id` 로 되돌리면서 이 파일을 고치는데, 그중 하나가 바로
    //    「번호 자리에 아무 글자나」다 — 그 요청의 `2` 는 몽고한테는 아무 글자나였지만
    //    PostgreSQL 에선 «진짜 번호» 라 이름과 내용이 어긋나게 된다. 이 회차 교안이
    //    인용한 것은 그때의 그 줄이므로 live 파일로 재면 거짓으로 빨개진다.
    const http = real('snapshots/p2-25.posts.http');
    for (const q of blocksOf(LEC, '### (번호 자리에 아무 글자나|깨진 몸통 보내기)', 'http')) {
      expect(http).toContain(q.trim());
    }
  });

  // 🚨 `.env.example` 은 회차를 따라 «자란다» — p2-29 가 DATABASE_URL 을 더한다.
  //    live 파일로 재면 이 축이 뒷 회차 부채를 가리거나(값이 늘어도 모름) 거짓으로
  //    빨개진다(늘어난 줄 때문에). 그래서 «그 시점 스냅숏» 으로 얼려 떼어낸다 —
  //    p2-22 가 posts.http 에 쓴 그 방법이다.
  it('`.env.example` 인용이 그 시점 코드베이스와 같다', () => {
    const md = readFileSync(new URL(LEC, import.meta.url), 'utf-8');
    const m = /```\n(# ~\/instagram-api\/\.env\.example\n[\s\S]*?)```/.exec(md);
    expect(m).not.toBeNull();
    expect(real('snapshots/p2-25.env.example')).toBe(m[1]);
  });

  // 그리고 «지금» 파일이 그 스냅숏에서 어떻게 자랐는지도 함께 잠근다 — 얼린 축이
  // 조용히 낡지 않게, 자란 줄이 무엇인지까지 못박아 둔다.
  // 🚨 이 축은 한때 «이름만 더해진다» 를 전제했는데, `p2-38` 에서 그 전제가 깨졌다.
  //    그 회차가 이 파일을 «배포 화면에 넣을 이름 목록» 으로 쓰기 때문이다 —
  //    MongoDB 는 `p2-26` 에서 떠났는데 이름만 남아 있어서, 그대로 두면 학생이
  //    배포 설정에 죽은 이름을 넣는다. 그래서 더해지기만 하는 것이 아니라 «갈린다».
  //    머리 두 줄은 그대로이고, 그 아래 이름이 무엇인지를 여기서 못박는다.
  it('지금 `.env.example` 은 그 시점에서 «어떻게» 갈렸는지까지 잠긴다', () => {
    const then = real('snapshots/p2-25.env.example').trimEnd().split('\n');
    const now = real('.env.example').trimEnd().split('\n');
    expect(now.slice(0, 2)).toEqual(then.slice(0, 2));
    expect(now.slice(2)).toEqual(['DATABASE_URL=', 'CORS_ORIGIN=']);
  });
});
