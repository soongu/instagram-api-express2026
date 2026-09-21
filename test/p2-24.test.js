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
  boot, withLocalMongo, dropLocal, onlyMongoLineDiffers, labPathRewrites, LOCAL_MONGO_URL,
} from './helpers/boot.js';

const READY = '서버가 3000번 포트에서';
const JSON_HEADERS = { 'Content-Type': 'application/json' };

let server = null;
let APP = null;
let SEED = null;

beforeAll(() => {
  // 🚨 `p2-25` 가 `app.js`·`seed.js` 를 다시 고친다 — 특히 `MONGO_URL` 을 파일 밖으로
  //    빼서 «바꿔 칠 줄 자체가 사라진다». 그래서 이 회차 축을 그 시점 스냅숏으로 얼렸다.
  //    `p2-22`·`p2-23` 이 이미 같은 이유로 얼려 있고, 이 회차만 워킹 트리를 보고 있었다.
  APP = withLocalMongo('snapshots/p2-24.final.app.js');
  SEED = withLocalMongo('snapshots/p2-24.final.seed.js');
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
    const diff = onlyMongoLineDiffers('snapshots/p2-24.final.app.js');
    expect(diff).toHaveLength(1);
    expect(diff[0][1]).toContain('const MONGO_URL = ');
    expect(diff[0][2]).toBe(`const MONGO_URL = '${LOCAL_MONGO_URL}';`);
  });

  it('`seed.js` 도 마찬가지다', () => {
    const diff = onlyMongoLineDiffers('snapshots/p2-24.final.seed.js');
    expect(diff).toHaveLength(1);
    expect(diff[0][1]).toContain('const MONGO_URL = ');
  });

  it('lab 파일은 «불러오는 줄» 만 한 단 더 깊어진다 — 그 밖엔 안 달라진다', () => {
    // 학생 쪽은 `~/instagram-api/lab/` 하나인데 코드베이스는 `lab/p2-24/` 로 한 겹 깊다.
    // 교안 인용의 정전은 학생 표기이므로 파일을 그대로 두고 띄울 때만 고친다.
    expect(labPathRewrites('lab/p2-24/practice2.js')).toHaveLength(0);   // 같은 폴더만 부른다
    // 🚨 `data/posts.js` 는 «한 단 더 깊어지는» 것에 더해 «얼린 판» 으로 간다
    //    (2026-09-11 `p2-30` 착수 시). 그 회차가 시드를 Prisma 로 옮기며 그 파일을
    //    세 개짜리 배열에서 데이터베이스에 든 다섯으로 다시 쓰기 때문이다.
    const hw3 = labPathRewrites('lab/p2-24/homework3.js');
    expect(hw3).toHaveLength(2);
    for (const [, before, after] of hw3) {
      expect(before).toMatch(/from '\.\.\/(models|data)\//);
      expect(after).toBe(
        before.includes("/data/posts.js")
          ? before.replace("from '../data/posts.js'", "from '../../snapshots/p2-22.data-posts.js'")
          : before.replace("from '../", "from '../../"));
    }
  });

  it('교안이 학생에게 주는 주소는 `mongodb+srv://` 형식이다', () => {
    // 🚨 워킹 트리가 아니라 얼린 판을 본다 — `p2-25` 가 이 줄을 통째로 `.env` 로
    //    빼내므로, 워킹 트리를 보면 «이 회차 교안이 틀렸다» 고 말하게 된다.
    const src = readFileSync(
      new URL('../snapshots/p2-24.final.app.js', import.meta.url), 'utf-8');
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
      .toBe(theirs.replace("'./data/posts.js'", "'./p2-22.data-posts.js'"));
  });

  // 🚨 이 회차 «자신» 도 얼렸다 (2026-09-07 `p2-25` 착수). `app.js` 는 계속 자라는
  //    파일이라 다음 회차가 고치는 순간 이 파일 전체가 거짓 회귀로 뒤집힌다.
  it('`p2-24` 완성본은 그 브랜치와 «불러오는 줄» 말고 안 다르다', () => {
    expect(snap('p2-24.final.app.js'))
      .toBe(fromBranch('code/p2-24', 'app.js').replace("'./models/Post.js'", "'../models/Post.js'"));
    expect(snap('p2-24.final.seed.js')).toBe(
      fromBranch('code/p2-24', 'seed.js')
        .replace("'./models/Post.js'", "'../models/Post.js'")
        .replace("'./data/posts.js'", "'./p2-22.data-posts.js'"));
  });

  it.each(['p2-23', 'p2-24'])('%s 의 `posts.http` 얼린 판은 그 브랜치와 byte 동일하다', (round) => {
    expect(snap(`${round}.posts.http`)).toBe(fromBranch(`code/${round}`, 'requests/posts.http'));
  });

  // 🚨 `data/posts.js` 도 얼렸다 (2026-09-11 `p2-30` 착수 시). `p2-22`~`p2-29` 내내
  //    byte 동일했던 파일인데 `p2-30` 이 시드를 Prisma 로 옮기며 «세 개짜리 배열» 을
  //    데이터베이스에 든 다섯으로 다시 쓴다. 앞 회차 스냅숏 열 장이 이 파일을
  //    불러오므로, 안 얼리면 `p2-22`·`p2-23` 의 「목록이 셋이다」가 통째로 거짓이 된다.
  it('`data/posts.js` 얼린 판은 그 브랜치와 byte 동일하다', () => {
    expect(snap('p2-22.data-posts.js')).toBe(fromBranch('code/p2-22', 'data/posts.js'));
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

describe('Step 8 — `.http` 여덟이 새 번호로 돈다', () => {
  it('요청 여덟이 200·200·404·404·201·400·200·200 을 낸다', async () => {
    await bootApp();
    const out = execFileSync(
      'node_modules/.bin/httpyac',
      ['send', 'snapshots/p2-24.posts.http', '--all', '--output', 'short'],
      { encoding: 'utf-8' });
    expect(out).toContain('8 requests processed (8 succeeded)');
    expect(out.match(/=> 200/g)).toHaveLength(4);
    expect(out.match(/=> 404/g)).toHaveLength(2);
    expect(out.match(/=> 201/g)).toHaveLength(1);
    expect(out.match(/=> 400/g)).toHaveLength(1);
  }, 60000);

  it('🔴 두 번 돌려도 게시물이 셋으로 돌아온다 — 만든 것을 자기가 치운다', async () => {
    await bootApp();
    const send = () => execFileSync(
      'node_modules/.bin/httpyac',
      ['send', 'snapshots/p2-24.posts.http', '--all', '--output', 'short'],
      { encoding: 'utf-8' });
    send();
    send();
    const list = await (await fetch(`${server.base}/api/posts`)).json();
    expect(list).toHaveLength(3);
  }, 90000);

  it('🚨 `p2-23` 의 옛 요청 파일을 그대로 보내면 넷이 500 이다', async () => {
    await bootApp();
    // 스냅숏은 `p2-23` 시점 그대로 — `/api/posts/2` 처럼 번호를 박아둔 넷이 들어 있다
    const out = execFileSync(
      'node_modules/.bin/httpyac',
      ['send', 'snapshots/p2-23.posts.http', '--all', '--output', 'short'],
      { encoding: 'utf-8' });
    expect(out.match(/=> 500/g)).toHaveLength(4);
  }, 60000);
});

describe('실습 1 — 실패하는 주소를 일부러 만들어보기', () => {
  const runWith = (url) => {
    const local = withLocalMongo('lab/p2-24/practice1.js', url);
    try {
      return execFileSync(process.execPath, [local], { encoding: 'utf-8' });
    } finally { dropLocal(local); }
  };

  it('제대로 된 주소면 연결되고 걸린 시간을 찍는다', () => {
    expect(runWith(LOCAL_MONGO_URL)).toMatch(/연결됐어요\. \d+ms 걸렸어요\./);
  });

  it('🔴 주소 글자가 틀린 셋은 «거의 0ms» 에 이름이 뜬다', () => {
    for (const [url, name] of [
      ['mongo://127.0.0.1:27017/instagram', 'MongoParseError'],
      ['mongodb://user:p@ss@127.0.0.1:27017/instagram', 'MongoParseError'],
    ]) {
      const out = runWith(url);
      expect(out).toContain(`이름: ${name}`);
      const ms = Number(out.match(/(\d+)ms 만에 실패했어요/)[1]);
      expect(ms).toBeLessThan(500);
    }
  });

  it('🔴 실제로 다녀와야 아는 것만 3초를 꽉 채운다 — 해설이 주장하는 그대로', () => {
    const out = runWith('mongodb://127.0.0.1:27099/instagram');
    expect(out).toContain('이름: MongooseServerSelectionError');
    const ms = Number(out.match(/(\d+)ms 만에 실패했어요/)[1]);
    expect(ms).toBeGreaterThan(2900);
    expect(ms).toBeLessThan(5000);
  }, 20000);
});

describe('실습 2 — 스토리를 데이터베이스로', () => {
  it('컬렉션 이름이 `stories` 다 — `storys` 가 아니다', async () => {
    if (mongoose.connection.readyState === 0) await mongoose.connect(LOCAL_MONGO_URL);
    const { default: Story } = await import('../lab/p2-24/Story.js');
    expect(Story.collection.name).toBe('stories');
    await mongoose.disconnect();
  });

  it('🔴 `isViewed` 를 한 번도 안 적었는데 `false` 로 들어간다 — 기본값이 일한다', async () => {
    const local = withLocalMongo('lab/p2-24/practice2.js');
    const out = execFileSync(process.execPath, [local], { encoding: 'utf-8' });
    dropLocal(local);
    expect(out).toContain('스토리 3개를 넣었어요.');

    await mongoose.connect(LOCAL_MONGO_URL);
    const { default: Story } = await import('../lab/p2-24/Story.js');
    const all = await Story.find();
    expect(all).toHaveLength(3);
    expect(all.every((one) => one.isViewed === false)).toBe(true);
    await mongoose.disconnect();
  });
});

describe('실습 3 — 서점을 데이터베이스로', () => {
  let books = null;
  const bootBooks = async () => {
    const seed = withLocalMongo('lab/p2-24/practice4.js');
    execFileSync(process.execPath, [seed], { encoding: 'utf-8' });
    dropLocal(seed);
    books = withLocalMongo('lab/p2-24/practice3.js');
    server = await boot(books, { port: 4000, ready: '서버가 4000번 포트에서' });
  };
  afterEach(() => { if (books) { dropLocal(books); books = null; } });

  it('🚨 `stock` 을 999 로 실어 보내도 0 으로 시작한다', async () => {
    await bootBooks();
    const res = await fetch(`${server.base}/api/books`, {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ title: '코드 그 자체', author: '박서준', stock: 999 }),
    });
    expect(res.status).toBe(201);
    expect((await res.json()).stock).toBe(0);
  });

  it('스키마에 없는 칸은 보내도 사라진다', async () => {
    await bootBooks();
    const res = await fetch(`${server.base}/api/books`, {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ title: 'a', author: 'b', id: 5, 몰래: '넣기' }),
    });
    const body = await res.json();
    expect(body.id).toBeUndefined();
    expect(body['몰래']).toBeUndefined();
  });

  it('`books.http` 다섯이 200·201·400·200·200 을 낸다', async () => {
    // 🚨 처음엔 `GET /api/books/:id` 를 부르는 요청을 넣었다가 잡혔다 — 실습
    //    요구사항이 「줄 넷」(목록·올리기·고치기·지우기)이라 그 라우트가 없다.
    //    catch-all 도 없어서 Express 기본 404 가 왔고, httpYac 은 «응답이 왔으니»
    //    succeeded 로 세어서 개수만 보면 통과처럼 보였다.
    await bootBooks();
    const out = execFileSync(
      'node_modules/.bin/httpyac',
      ['send', 'requests/books.http', '--all', '--output', 'short'],
      { encoding: 'utf-8' });
    expect(out).toContain('5 requests processed (5 succeeded)');
    expect(out.match(/=> 200/g)).toHaveLength(3);
    expect(out.match(/=> 201/g)).toHaveLength(1);
    expect(out.match(/=> 400/g)).toHaveLength(1);
    expect(out.match(/=> 404/g)).toBeNull();
  }, 60000);
});

describe('과제 1 — 댓글을 데이터베이스로', () => {
  let hw = null;
  const bootComments = async () => {
    const seed = withLocalMongo('lab/p2-24/homework2.js');
    execFileSync(process.execPath, [seed], { encoding: 'utf-8' });
    dropLocal(seed);
    hw = withLocalMongo('lab/p2-24/homework1.js');
    server = await boot(hw, { port: 4000, ready: '서버가 4000번 포트에서' });
  };
  afterEach(() => { if (hw) { dropLocal(hw); hw = null; } });

  it('컬렉션 이름이 `comments` 다', async () => {
    if (mongoose.connection.readyState === 0) await mongoose.connect(LOCAL_MONGO_URL);
    const { default: Comment } = await import('../lab/p2-24/Comment.js');
    expect(Comment.collection.name).toBe('comments');
    await mongoose.disconnect();
  });

  it('`likeCount` 를 500 으로 보내도 0 이다', async () => {
    await bootComments();
    const res = await fetch(`${server.base}/api/comments`, {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ postId: 1, username: 'yuna', content: '좋아요', likeCount: 500 }),
    });
    expect(res.status).toBe(201);
    expect((await res.json()).likeCount).toBe(0);
  });

  it('`comments.http` 다섯이 200·201·400·200·200 을 낸다', async () => {
    await bootComments();
    const out = execFileSync(
      'node_modules/.bin/httpyac',
      ['send', 'requests/comments.http', '--all', '--output', 'short'],
      { encoding: 'utf-8' });
    expect(out).toContain('5 requests processed (5 succeeded)');
    expect(out.match(/=> 200/g)).toHaveLength(3);
    expect(out.match(/=> 201/g)).toHaveLength(1);
    expect(out.match(/=> 400/g)).toHaveLength(1);
  }, 60000);

  it('🚨 그 파일의 올리기 요청이 `likeCount: 500` 을 실어 보낸다 — 요구사항 5를 확인하는 자리다', async () => {
    // 🚨 처음엔 아무것도 안 실어 보내서, 결과가 0 이어도 「기본값이 일한 것」인지
    //    「우리가 덮어쓴 것」인지 못 갈랐다. 재정독자가 잡았다.
    const http = readFileSync(new URL('../requests/comments.http', import.meta.url), 'utf-8');
    expect(http).toContain('"likeCount": 500');

    await bootComments();
    execFileSync('node_modules/.bin/httpyac',
      ['send', 'requests/comments.http', '--all', '--output', 'short'], { encoding: 'utf-8' });
    const list = await (await fetch(`${server.base}/api/comments`)).json();
    expect(list.every((one) => one.likeCount !== 500)).toBe(true);
  }, 60000);
});

describe('과제 2 — 시드를 안전하게', () => {
  const run = (args = []) => {
    const local = withLocalMongo('lab/p2-24/homework3.js');
    try {
      return execFileSync(process.execPath, [local, ...args], { encoding: 'utf-8' });
    } finally { dropLocal(local); }
  };

  it('비어 있으면 넣고, 이미 있으면 아무것도 안 한다', async () => {
    await mongoose.connect(LOCAL_MONGO_URL);
    const { default: Post } = await import('../models/Post.js');
    await Post.deleteMany({});
    await mongoose.disconnect();

    expect(run()).toContain('게시물 3개를 넣었어요.');
    const second = run();
    expect(second).toContain('이미 게시물 3개가 들어 있어서 아무것도 안 했어요.');
    expect(second).toContain('--force');
  });

  it('🔴 `--force` 를 붙이면 그때는 비우고 다시 넣는다', () => {
    expect(run(['--force'])).toContain('게시물 3개를 넣었어요.');
  });
});

describe('교안·답안 인용이 코드베이스와 byte 동일한가', () => {
  // 🚨 `p2-25` 가 이 파일들에서 이어 시작한다. 한 글자라도 다르면 다음 회차가
  //    «재현 불가» 가 되는데, 그건 다른 게이트가 원리적으로 안 본다.
  const LEC = '../../../part2/4-node-backend/p2-24-mongodb-mongoose-lecture.md';
  const ANS = '../../../part2/4-node-backend/p2-24-mongodb-mongoose-answers.md';

  const blocksOf = (path, head, fence = 'javascript') => {
    const md = readFileSync(new URL(path, import.meta.url), 'utf-8');
    const re = new RegExp('```' + fence + '\\n(' + head.replace(/[/.]/g, '\\$&') +
                          '\\n[\\s\\S]*?)```', 'g');
    return [...md.matchAll(re)].map((m) => m[1]);
  };
  // 🚨 워킹 트리가 아니라 «그 회차 브랜치» 를 본다. `p2-25` 가 `app.js` 를 고치면
  //    워킹 트리 대조는 이 회차 교안이 틀렸다고 말하게 되는데, 그건 거짓이다.
  const real = (rel) =>
    execFileSync('git', ['show', `code/p2-24:${rel}`], { encoding: 'utf-8' });

  it('🔴 교안의 `app.js` 완성본이 코드베이스와 byte 동일하다', () => {
    // 🚨 이 검사는 뒤늦게 생겼다 — 초고에 «완성본 전체» 블록이 아예 없었고
    //    (`p2-22`·`p2-23` 은 둘 다 뒀다), 독립 정독자가 「내가 제대로 한 게
    //    맞나 맞춰볼 데가 없다」로 잡았다. `p2-25` 가 여기서 이어 시작한다.
    const quoted = blocksOf(LEC, '// ~/instagram-api/app.js');
    expect(quoted.at(-1)).toBe(real('app.js'));
  });

  it('교안의 `seed.js` 완성본이 코드베이스와 같다', () => {
    expect(blocksOf(LEC, '// ~/instagram-api/seed.js').at(-1)).toBe(real('seed.js'));
  });

  it('교안이 인용한 `models/Post.js` 두 조각이 코드베이스 안에 그대로 있다', () => {
    // 🚨 조각 발췌라 byte 동일 대신 «포함» 으로 본다 — 붙여넣은 것이 안 돌면 안 되니까.
    const quoted = blocksOf(LEC, '// ~/instagram-api/models/Post.js');
    expect(quoted).toHaveLength(2);
    for (const block of quoted) {
      const body = block.split('\n').slice(1).join('\n').trim();
      expect(real('models/Post.js')).toContain(body);
    }
  });

  it('교안이 인용한 `app.js` 조각은 «셋 중 하나» 에 그대로 있다', () => {
    // 🚨 통짜로 «현재 app.js» 에 대면 안 된다. 교안이 인용하는 것은 셋이다 —
    //    ① 지난 시간 판(대조용) ② Step 3 «시점» 판(모델이 아직 없다) ③ 완성본.
    //    처음 판은 ①·②를 「불일치」로 잡았는데, 그건 교안이 아니라 검사가 틀린 것이다.
    const quoted = blocksOf(LEC, '// ~/instagram-api/app.js');
    expect(quoted.length).toBeGreaterThanOrEqual(5);
    const sources = {
      완성본: real('app.js'),
      // 스냅숏은 `snapshots/` 아래 있어 «불러오는 줄 하나만» 학생 표기와 다르다
      'Step 3 시점': real('snapshots/p2-24.step3.app.js')
        .replace("'../data/posts.js'", "'./data/posts.js'"),
      '지난 시간 판': execFileSync('git', ['show', 'code/p2-23:app.js'], { encoding: 'utf-8' }),
    };
    const missing = [];
    for (const block of quoted) {
      const body = block.split('\n').slice(1).join('\n').trim();
      if (!Object.values(sources).some((src) => src.includes(body))) {
        missing.push(body.split('\n')[0]);
      }
    }
    expect(missing).toEqual([]);
  });

  it('🔴 Step 3 «시점» 판이 실제로 뜬다 — 교안이 「두 줄이 찍혀요」라고 말하니까', async () => {
    const local = withLocalMongo('snapshots/p2-24.step3.app.js');
    server = await boot(local, { ready: READY });
    expect(server.log).toContain('데이터베이스에 연결됐어요.');
    expect(server.log).toContain('서버가 3000번 포트에서 기다리고 있어요.');
    // 이 시점엔 아직 배열을 쓴다 — 갈아 끼우는 것은 Step 6 부터다
    const list = await (await fetch(`${server.base}/api/posts`)).json();
    expect(list).toHaveLength(3);
    expect(list[0].id).toBe(1);
    await server.stop(); server = null;
    dropLocal(local);
  });

  it('답안의 완성본 넷이 코드베이스와 같다', () => {
    const pairs = [
      ['// ~/instagram-api/lab/Comment.js', 'lab/p2-24/Comment.js'],
      ['// ~/instagram-api/lab/homework1.js', 'lab/p2-24/homework1.js'],
      ['// ~/instagram-api/lab/homework2.js', 'lab/p2-24/homework2.js'],
      ['// ~/instagram-api/lab/homework3.js', 'lab/p2-24/homework3.js'],
    ];
    for (const [head, path] of pairs) {
      expect(blocksOf(ANS, head).at(-1), head).toBe(real(path));
    }
  });

  it('교안의 `posts.http` 전문과 답안의 `comments.http` 가 실물과 같다', () => {
    const lecHttp = blocksOf(LEC, '### 게시물 목록', '');
    expect(lecHttp.at(-1)).toBe(real('requests/posts.http'));
    const ansHttp = blocksOf(ANS, '### 댓글 목록', '');
    expect(ansHttp.at(-1)).toBe(real('requests/comments.http'));
  });
});
