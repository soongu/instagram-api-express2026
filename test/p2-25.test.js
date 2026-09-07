// 내부 검증 전용 — 교안에 한 줄도 인용하지 않는다.
//
// 🚨 이 회차부터 «연결 문자열이 파일 안에 없다». `p2-24` 까지는 `withLocalMongo` 가
//    `const MONGO_URL = '...'` 한 줄을 바꿔 친 사본을 띄웠는데, 이 회차가 그 줄을
//    `.env` 로 빼내므로 바꿔 칠 자리가 사라진다. 그래서 **파일은 한 글자도 안 건드리고**
//    학생이 `--env-file` 로 넣어주는 그 자리에 게이트가 자기 값을 넣는다(`boot({ env })`).
//    「교안 인용과 byte 동일」이 오히려 더 튼튼해졌다 — 사본이 아예 없다.
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
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
    await bootApp('app.js');

    const res = await fetch(`${server.base}/api/posts/2`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: '그런 게시물은 없어요' });
  });

  it('형식은 맞는데 없는 번호도 404 로 «같은 답» 이다', async () => {
    await bootApp('app.js');

    const res = await fetch(`${server.base}/api/posts/507f1f77bcf86cd799439011`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: '그런 게시물은 없어요' });
  });

  it('고치기·지우기도 형식이 틀린 번호에 404 를 낸다', async () => {
    await bootApp('app.js');

    const patch = await fetch(`${server.base}/api/posts/2`, {
      method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ likeCount: 1 }),
    });
    expect(patch.status).toBe(404);

    const del = await fetch(`${server.base}/api/posts/2`, { method: 'DELETE' });
    expect(del.status).toBe(404);
  });

  it('🔴 깨진 JSON 은 400 으로 돌아왔다', async () => {
    await bootApp('app.js');

    const res = await fetch(`${server.base}/api/posts`, {
      method: 'POST', headers: JSON_HEADERS, body: '{"username"',
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ message: '보낸 내용을 읽을 수 없어요' });
  });

  it('멀쩡한 요청 여덟은 지난 시간과 같은 코드를 낸다 — 겉이 안 변했다', async () => {
    await bootApp('app.js');

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
    await bootApp('app.js', { env: { ...ENV, NODE_ENV: 'production' } });

    const res = await fetch(`${server.base}/api/posts/2`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: '그런 게시물은 없어요' });
  });
});

// ── Step 4 — 연결 문자열을 코드 밖으로 ──────────────────────────────────────
describe('Step 4 — 비밀번호가 코드에 없다', () => {
  const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf-8');

  it('`app.js`·`seed.js` 어디에도 연결 주소가 글자로 안 남아 있다', () => {
    for (const f of ['app.js', 'seed.js']) {
      expect(src(f)).not.toContain('mongodb+srv://');
      expect(src(f)).not.toContain('mongodb://');
      expect(src(f)).toContain('process.env.MONGO_URL');
    }
  });

  it('두 곳에 있던 그 줄이 «한 곳» 으로 모였다', () => {
    const both = src('app.js') + src('seed.js');
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
    const ex = src('.env.example');
    expect(ex).toContain('MONGO_URL=');
    expect(ex).not.toContain('mongodb+srv://cluster');
    expect(ex).not.toMatch(/MONGO_URL=mongodb\+srv:\/\/[a-z]/i);
  });

  it('🚨 값이 아예 없으면 «뜨지도 못한다» — 로컬에서 `npm start` 를 친 경우', async () => {
    // 학생이 가장 자주 밟는 자리다. 그런데 Mongoose 가 내는 말에는 `MONGO_URL`
    // 이라는 이름이 «안 나온다» — 교안이 이 화면을 그대로 보여줘야 하는 이유다.
    seed();
    const err = await boot('app.js', { env: { MONGO_URL: undefined }, ready: readyAt(3000) })
      .then(() => null, (e) => e);
    expect(err).not.toBeNull();
    expect(err.message).toContain('MongooseError');
    expect(err.message).toContain('got "undefined"');
    expect(err.message).not.toContain('MONGO_URL');
  });
});

// ── Step 5 — 포트도 환경이 정한다 ───────────────────────────────────────────
describe('Step 5 — 올릴 수 있는 모양', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));

  it('환경이 포트를 주면 그 포트에서 답한다', async () => {
    await bootApp('app.js', { port: 4321, env: { ...ENV, PORT: '4321' } });

    expect(server.log).toContain('서버가 4321번 포트에서');
    expect((await fetch(`${server.base}/api/posts`)).status).toBe(200);
  });

  it('안 주면 3000 그대로다 — 내 컴퓨터에서 하던 것이 안 바뀐다', async () => {
    await bootApp('app.js');
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
    await bootApp('app.js');

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
