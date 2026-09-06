// 내부 검증 전용 — 교안에 한 줄도 인용하지 않는다.
//
// 🚨 이 파일은 «실물 MongoDB» 를 필요로 한다. 학생은 Atlas 를 쓰지만 게이트는 계정이
//    없으므로 로컬 mongod 에 붙는다(`LOCAL_MONGO_URL`). 갈리는 것은 **연결 문자열
//    한 줄뿐**이고, 스키마·모델·질의는 전부 같은 코드가 같은 서버를 왕복한다.
//    그 「한 줄만 다르다」를 아래 첫 describe 가 스스로 잠근다.
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import mongoose from 'mongoose';
import {
  boot, withLocalMongo, dropLocal, onlyMongoLineDiffers, LOCAL_MONGO_URL,
} from './helpers/boot.js';

const READY = '서버가 3000번 포트에서';
const JSON_HEADERS = { 'Content-Type': 'application/json' };

let server = null;
let APP = null;
let SEED = null;

beforeAll(() => {
  APP = withLocalMongo('app.js');
  SEED = withLocalMongo('seed.js');
});

afterAll(async () => {
  dropLocal(APP);
  dropLocal(SEED);
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
});

afterEach(async () => {
  if (server) { await server.stop(); server = null; }
});

/** 학생이 치는 그 명령 그대로 — `node seed.js` */
function runSeed() {
  return execFileSync(process.execPath, [SEED], { encoding: 'utf-8' });
}

async function bootApp() {
  runSeed();
  server = await boot(APP, { ready: READY });
  return server;
}

describe('게이트가 스스로를 검산한다 — 사본은 «MONGO_URL 한 줄» 만 다르다', () => {
  it('`app.js` 는 그 한 줄 말고 한 글자도 안 다르다', () => {
    const diff = onlyMongoLineDiffers('app.js');
    expect(diff).toHaveLength(1);
    expect(diff[0][1]).toContain('const MONGO_URL = ');
    expect(diff[0][2]).toBe(`const MONGO_URL = '${LOCAL_MONGO_URL}';`);
  });

  it('`seed.js` 도 마찬가지다', () => {
    const diff = onlyMongoLineDiffers('seed.js');
    expect(diff).toHaveLength(1);
    expect(diff[0][1]).toContain('const MONGO_URL = ');
  });

  it('교안이 학생에게 주는 주소는 `mongodb+srv://` 형식이다', () => {
    const src = readFileSync(new URL('../app.js', import.meta.url), 'utf-8');
    expect(src).toContain("const MONGO_URL = 'mongodb+srv://");
  });
});

describe('앞 회차를 얼려 떼어냈다 — 그 판이 정말 그 회차 것인가', () => {
  // 🚨 `app.js`·`requests/posts.http` 는 회차를 넘나들며 «자라는» 파일이라, 앞 회차
  //    테스트가 워킹 트리를 보면 오늘 갈아 끼운 것이 앞 회차 «회귀» 로 뜬다.
  //    실제로 이 회차 착수 때 `p2-22`·`p2-23` 에서 29건이 그렇게 죽었다.
  //    그래서 그 시점 브랜치에서 떠 왔는데, «정말 떠 온 것이 맞는지» 는 여기서 잠근다.
  const fromBranch = (ref, path) =>
    execFileSync('git', ['show', `${ref}:${path}`], { encoding: 'utf-8' });
  const snap = (name) => readFileSync(new URL(`../snapshots/${name}`, import.meta.url), 'utf-8');

  it.each(['p2-22', 'p2-23'])('%s 완성본은 그 브랜치와 «불러오는 줄 하나만» 다르다', (round) => {
    const theirs = fromBranch(`code/${round}`, 'app.js');
    expect(snap(`${round}.final.app.js`))
      .toBe(theirs.replace("'./data/posts.js'", "'../data/posts.js'"));
  });

  it('`p2-23` 의 `posts.http` 얼린 판은 그 브랜치와 byte 동일하다', () => {
    expect(snap('p2-23.posts.http')).toBe(fromBranch('code/p2-23', 'requests/posts.http'));
  });
});

describe('Step 3 — 연결이 안 될 때 «무엇이» 뜨나', () => {
  const tryConnect = async (url, opts = {}) => {
    try {
      await mongoose.connect(url, { serverSelectionTimeoutMS: 3000, ...opts });
      await mongoose.disconnect();
      return null;
    } catch (err) {
      return err;
    }
  };

  it('주소가 `mongo://` 로 시작하면 — 형식부터 틀렸다고 «즉시» 말한다', async () => {
    const t0 = Date.now();
    const err = await tryConnect('mongo://127.0.0.1:27017/instagram');
    expect(err.name).toBe('MongoParseError');
    expect(err.message).toContain('Invalid scheme');
    expect(Date.now() - t0).toBeLessThan(1000);   // 기다리지 않는다
  });

  it('🔴 비밀번호에 `@` 가 든 채로 붙여넣으면 — 주소 자체가 안 읽힌다', async () => {
    const err = await tryConnect('mongodb://user:p@ss@127.0.0.1:27017/instagram');
    expect(err.name).toBe('MongoParseError');
    expect(err.message).toContain('Invalid connection string');
  });

  it('🔴 아무도 안 듣는 곳이면 — 이름이 `MongooseServerSelectionError` 다', async () => {
    const err = await tryConnect('mongodb://127.0.0.1:27099/instagram');
    expect(err.name).toBe('MongooseServerSelectionError');
    expect(err.message).toContain('ECONNREFUSED');
  });

  it('🔴 그리고 그것은 «기본으로 30초» 를 기다린 뒤에야 뜬다', async () => {
    const t0 = Date.now();
    const err = await tryConnect('mongodb://127.0.0.1:27099/instagram',
      { serverSelectionTimeoutMS: undefined });
    const waited = Date.now() - t0;
    expect(err.name).toBe('MongooseServerSelectionError');
    expect(waited).toBeGreaterThan(29000);
    expect(waited).toBeLessThan(35000);
  }, 45000);

  it('🔴 주소 끝에 이름을 안 붙이면 `test` 라는 데로 들어간다', async () => {
    await mongoose.connect('mongodb://127.0.0.1:27017/?retryWrites=true&w=majority');
    expect(mongoose.connection.name).toBe('test');
    await mongoose.disconnect();

    await mongoose.connect(LOCAL_MONGO_URL);
    expect(mongoose.connection.name).toBe('instagram_gate');
    await mongoose.disconnect();
  });
});

describe('Step 4 — 스키마가 «아는 칸» 과 «모르는 칸»', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) await mongoose.connect(LOCAL_MONGO_URL);
  });

  it('모델 이름을 `Post` 로 지으면 컬렉션은 `posts` 가 된다', async () => {
    const { default: Post } = await import('../models/Post.js');
    expect(Post.collection.name).toBe('posts');
  });

  it('🔴 스키마가 «모르는» 칸은 조용히 버려진다 — 배열의 `id` 가 사라진다', async () => {
    const { default: Post } = await import('../models/Post.js');
    await Post.deleteMany({});
    const made = await Post.create({
      username: 'yuna', postImage: 'x', id: 999, 몰래: '넣기',
    });
    const back = made.toObject();
    expect('id' in back).toBe(false);
    expect('몰래' in back).toBe(false);
    await Post.deleteMany({});
  });

  it('🚨 그런데 스키마가 «아는» 칸은 보낸 대로 들어간다 — 기본값은 안 보냈을 때만 쓴다', async () => {
    const { default: Post } = await import('../models/Post.js');
    await Post.deleteMany({});
    const 안보냄 = await Post.create({ username: 'a', postImage: 'x' });
    expect(안보냄.likeCount).toBe(0);                       // 기본값이 일한다
    const 보냄 = await Post.create({ username: 'b', postImage: 'y', likeCount: 999 });
    expect(보냄.likeCount).toBe(999);                       // 기본값이 안 이긴다
    await Post.deleteMany({});
  });

  it('`required` 를 어기면 `ValidationError` 다', async () => {
    const { default: Post } = await import('../models/Post.js');
    await expect(Post.create({ content: '사진 없음' })).rejects.toThrow(/validation failed/i);
  });
});

describe('Step 5 — 시드', () => {
  it('`node seed.js` 가 셋을 넣었다고 말한다', () => {
    const out = runSeed();
    expect(out).toContain('게시물 3개를 넣었어요.');
  });

  it('🔴 두 번 돌려도 셋이다 — 비우고 다시 넣기 때문에 쌓이지 않는다', async () => {
    runSeed();
    runSeed();
    if (mongoose.connection.readyState === 0) await mongoose.connect(LOCAL_MONGO_URL);
    const { default: Post } = await import('../models/Post.js');
    expect(await Post.countDocuments()).toBe(3);
    await mongoose.disconnect();
  });

  it('배열에 있던 `id` 는 안 들어가고 `_id` 가 대신 생긴다', async () => {
    runSeed();
    await mongoose.connect(LOCAL_MONGO_URL);
    const { default: Post } = await import('../models/Post.js');
    const [one] = await Post.find();
    const back = one.toObject();
    expect('id' in back).toBe(false);
    expect(back._id).toBeTruthy();
    expect(one.likeCount).toBe(1240);            // 배열이 갖고 있던 값은 그대로 온다
    await mongoose.disconnect();
  });
});

describe('Step 6 — 읽기 둘을 DB 로', () => {
  it('목록이 셋이고, 칸 이름이 `id` 가 아니라 `_id` 다 (`__v` 도 딸려 온다)', async () => {
    await bootApp();
    const list = await (await fetch(`${server.base}/api/posts`)).json();
    expect(list).toHaveLength(3);
    expect(list[0].id).toBeUndefined();
    expect(typeof list[0]._id).toBe('string');
    expect(list[0].__v).toBe(0);
    expect(list.map((one) => one.username)).toEqual(['jaehoon', 'minji', 'seungwoo']);
  });

  it('그 `_id` 로 하나를 부르면 온다', async () => {
    await bootApp();
    const list = await (await fetch(`${server.base}/api/posts`)).json();
    const res = await fetch(`${server.base}/api/posts/${list[1]._id}`);
    expect(res.status).toBe(200);
    expect((await res.json()).username).toBe('minji');
  });

  it('형식은 맞는데 없는 것이면 404 — 우리 문구가 그대로 온다', async () => {
    await bootApp();
    const res = await fetch(`${server.base}/api/posts/507f1f77bcf86cd799439011`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: '그런 게시물은 없어요' });
  });

  it('🔴 옛 주소 `/api/posts/2` 는 404 가 아니라 «500 + HTML» 이다', async () => {
    await bootApp();
    const res = await fetch(`${server.base}/api/posts/2`);
    expect(res.status).toBe(500);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(await res.text()).toContain('CastError');
    await new Promise((r) => setTimeout(r, 300));
    expect(server.tail()).toContain('Cast to ObjectId failed');
  });

  it('`/` 는 지난 시간 그대로다 — DB 와 상관없는 줄은 안 건드렸다', async () => {
    await bootApp();
    const res = await fetch(`${server.base}/`);
    expect(await res.text()).toBe('인스타그램 서버가 살아 있어요');
  });
});

describe('Step 7 — 쓰기 셋을 DB 로', () => {
  it('올린 게시물이 «목록에 보인다» — 배열이 아니라 DB 에 들어갔으니까', async () => {
    await bootApp();
    const made = await fetch(`${server.base}/api/posts`, {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ username: 'yuna', postImage: 'https://x/1', content: '첫 글' }),
    });
    expect(made.status).toBe(201);
    const body = await made.json();
    expect(body._id).toBeTruthy();

    const list = await (await fetch(`${server.base}/api/posts`)).json();
    expect(list).toHaveLength(4);
    expect(list.map((one) => one.username)).toContain('yuna');
  });

  it('🚨 하트 수를 실어 보내도 서버가 0 으로 덮어쓴다 — 지난 시간 규칙이 그대로 산다', async () => {
    await bootApp();
    const res = await fetch(`${server.base}/api/posts`, {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ username: 'yuna', postImage: 'https://x/1', likeCount: 999 }),
    });
    expect((await res.json()).likeCount).toBe(0);
  });

  it('꼭 있어야 할 칸이 빠지면 400 이다 (스키마가 아니라 우리 줄이 낸다)', async () => {
    await bootApp();
    const res = await fetch(`${server.base}/api/posts`, {
      method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ content: '사진 없음' }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ message: 'username과 postImage는 꼭 있어야 해요' });
  });

  it('🔴 PATCH 가 «고친 뒤» 값을 돌려준다 — `returnDocument: after` 가 하는 일', async () => {
    await bootApp();
    const list = await (await fetch(`${server.base}/api/posts`)).json();
    const target = list.find((one) => one.username === 'jaehoon');
    expect(target.likeCount).toBe(1240);

    const res = await fetch(`${server.base}/api/posts/${target._id}`, {
      method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ likeCount: 1241 }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).likeCount).toBe(1241);
  });

  it('DELETE 가 지운 것을 돌려주고, 목록이 하나 줄어든다', async () => {
    await bootApp();
    const list = await (await fetch(`${server.base}/api/posts`)).json();
    const target = list.find((one) => one.username === 'seungwoo');

    const res = await fetch(`${server.base}/api/posts/${target._id}`, { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect((await res.json()).username).toBe('seungwoo');

    const after = await (await fetch(`${server.base}/api/posts`)).json();
    expect(after).toHaveLength(2);
  });

  it('없는 게시물을 고치거나 지우면 404 다', async () => {
    await bootApp();
    const gone = '507f1f77bcf86cd799439011';
    const patched = await fetch(`${server.base}/api/posts/${gone}`, {
      method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ likeCount: 1 }),
    });
    expect(patched.status).toBe(404);
    const deleted = await fetch(`${server.base}/api/posts/${gone}`, { method: 'DELETE' });
    expect(deleted.status).toBe(404);
  });

  it('🔴 서버를 껐다 다시 띄워도 올린 것이 남아 있다 — 오늘의 알맹이', async () => {
    await bootApp();
    await fetch(`${server.base}/api/posts`, {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ username: 'yuna', postImage: 'https://x/1' }),
    });
    await server.stop();
    server = null;

    // 시드를 «다시 돌리지 않고» 그냥 다시 띄운다
    server = await boot(APP, { ready: READY });
    const list = await (await fetch(`${server.base}/api/posts`)).json();
    expect(list).toHaveLength(4);
    expect(list.map((one) => one.username)).toContain('yuna');
  });
});
