// 내부 검증 전용 — 교안에 한 줄도 인용하지 않는다.
import { describe, it, expect, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { boot } from './helpers/boot.js';

let server = null;
afterEach(async () => {
  if (server) { await server.stop(); server = null; }
});

const JSON_HEADERS = { 'Content-Type': 'application/json' };

describe('오프닝 — `p2-22` 완성본은 GET 말고는 전부 「그런 주소는 없어요」', () => {
  // 🚨 스냅숏이 `snapshots/` 아래 있어서 «불러오는 줄 한 곳만» 다르다
  //    (`./data/posts.js` → `../data/posts.js`). 그 한 줄 말고는 한 글자도
  //    다르면 안 된다 — 오프닝이 「어제 만든 그 서버」라고 말하기 때문이다.
  it('스냅숏이 `code/p2-22` 의 `app.js` 와 «불러오는 줄 하나만» 다르다', () => {
    const theirs = execFileSync('git', ['show', 'code/p2-22:app.js'], { encoding: 'utf-8' });
    const mine = readFileSync(new URL('../snapshots/p2-23.opening.app.js', import.meta.url), 'utf-8');
    expect(mine).toBe(theirs.replace("'./data/posts.js'", "'../data/posts.js'"));
  });

  it('같은 주소인데 방식만 바꾸면 404 가 온다', async () => {
    server = await boot('snapshots/p2-23.opening.app.js');

    const get = await fetch(`${server.base}/api/posts`);
    expect(get.status).toBe(200);

    const post = await fetch(`${server.base}/api/posts`, {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ username: 'yuna' }),
    });
    expect(post.status).toBe(404);
    expect(await post.json()).toEqual({ message: '그런 주소는 없어요' });

    const patch = await fetch(`${server.base}/api/posts/1`, {
      method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ likeCount: 1 }),
    });
    expect(patch.status).toBe(404);
    expect(await patch.json()).toEqual({ message: '그런 주소는 없어요' });

    const del = await fetch(`${server.base}/api/posts/1`, { method: 'DELETE' });
    expect(del.status).toBe(404);
    expect(await del.json()).toEqual({ message: '그런 주소는 없어요' });
  });
});

describe('Step 1 — `app.post` 를 놓으면 걸리는데, 몸통은 `undefined` 다', () => {
  it('POST 가 이제 우리 함수에 걸린다', async () => {
    server = await boot('snapshots/p2-23.step1.app.js');
    const res = await fetch(`${server.base}/api/posts`, {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ username: 'yuna', content: '첫 글' }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: '받긴 받았어요' });
  });

  it('`express.json()` 이 없으면 `req.body` 가 «undefined» 로 찍힌다 (Express 5 — `{}` 가 아니다)', async () => {
    server = await boot('snapshots/p2-23.step1.app.js');
    await fetch(`${server.base}/api/posts`, {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ username: 'yuna', content: '첫 글' }),
    });
    await new Promise((r) => setTimeout(r, 300));
    expect(server.tail()).toContain('몸통에 들어 있는 것: undefined');
  });

  it('GET 은 그대로 돈다 — 방식이 갈리는 것이지 주소가 없어진 게 아니다', async () => {
    server = await boot('snapshots/p2-23.step1.app.js');
    const res = await fetch(`${server.base}/api/posts`);
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveLength(3);
  });
});

describe('Step 2 — `express.json()` 과 `Content-Type` 은 한 짝', () => {
  it('헤더를 붙여 보내면 몸통이 객체로 들어온다', async () => {
    server = await boot('app.js');
    const res = await fetch(`${server.base}/api/posts`, {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ username: 'yuna', postImage: 'https://picsum.photos/seed/post4/600/600' }),
    });
    expect(res.status).toBe(201);
  });

  it('🚨 헤더를 빼면 `express.json()` 이 있어도 `req.body` 가 `undefined` 라 구조 분해가 터진다', async () => {
    server = await boot('app.js');
    const res = await fetch(`${server.base}/api/posts`, {
      method: 'POST',
      body: JSON.stringify({ username: 'yuna', postImage: 'x' }),
    });
    expect(res.status).toBe(500);
    await new Promise((r) => setTimeout(r, 300));
    expect(server.tail()).toContain(
      "TypeError: Cannot destructure property 'username' of 'req.body' as it is undefined.");
  });

  it('헤더는 맞는데 몸통이 비면 `{}` 다 — `undefined` 와 갈린다', async () => {
    server = await boot('app.js');
    const res = await fetch(`${server.base}/api/posts`, { method: 'POST', headers: JSON_HEADERS });
    expect(res.status).toBe(400);
  });
});

describe('Step 3 — `POST` 는 201 이고, 넷은 서버가 정한다', () => {
  it('보낸 다섯 칸에 서버가 넷을 얹어 201 로 돌려준다', async () => {
    server = await boot('app.js');
    const sent = {
      username: 'yuna',
      profileImage: 'https://picsum.photos/seed/yuna/40/40',
      postImage: 'https://picsum.photos/seed/post4/600/600',
      postAlt: '창밖으로 본 저녁 하늘 사진',
      content: '오늘의 한 장 📷',
    };
    const res = await fetch(`${server.base}/api/posts`, {
      method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(sent),
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      ...sent, id: 4, likeCount: 0, commentCount: 0, minutesAgo: 0,
    });
  });

  it('🚨 클라이언트가 `id`·`likeCount` 를 보내도 서버 값이 이긴다 (스프레드는 뒤엣것이 이긴다)', async () => {
    server = await boot('app.js');
    const res = await fetch(`${server.base}/api/posts`, {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({
        id: 999, username: 'yuna', postImage: 'https://picsum.photos/seed/post4/600/600',
        likeCount: 9999, commentCount: 77, minutesAgo: 500,
      }),
    });
    const body = await res.json();
    expect(body.id).toBe(4);
    expect(body.likeCount).toBe(0);
    expect(body.commentCount).toBe(0);
    expect(body.minutesAgo).toBe(0);
  });

  it('올린 것이 목록에 들어가고 `id` 는 하나씩 는다', async () => {
    server = await boot('app.js');
    const body = { username: 'yuna', postImage: 'https://picsum.photos/seed/post4/600/600' };
    const first = await (await fetch(`${server.base}/api/posts`, {
      method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) })).json();
    const second = await (await fetch(`${server.base}/api/posts`, {
      method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) })).json();
    expect([first.id, second.id]).toEqual([4, 5]);

    const list = await (await fetch(`${server.base}/api/posts`)).json();
    expect(list).toHaveLength(5);
    expect(list[4].id).toBe(5);

    const one = await fetch(`${server.base}/api/posts/4`);
    expect(one.status).toBe(200);
  });
});

describe('Step 4 — 400 은 「보낸 쪽이 잘못했다」', () => {
  it('`username` 이 없으면 400 이고 목록도 안 는다', async () => {
    server = await boot('app.js');
    const res = await fetch(`${server.base}/api/posts`, {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ postImage: 'https://picsum.photos/seed/post4/600/600' }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ message: 'username과 postImage는 꼭 있어야 해요' });

    const list = await (await fetch(`${server.base}/api/posts`)).json();
    expect(list).toHaveLength(3);
  });

  it('`postImage` 가 없어도 400 이다', async () => {
    server = await boot('app.js');
    const res = await fetch(`${server.base}/api/posts`, {
      method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ username: 'yuna' }),
    });
    expect(res.status).toBe(400);
  });

  it('빈 글자도 「없는 것」으로 본다 — `!""` 가 참이라서', async () => {
    server = await boot('app.js');
    const res = await fetch(`${server.base}/api/posts`, {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ username: '', postImage: 'x' }),
    });
    expect(res.status).toBe(400);
  });

  it('🚨 깨진 JSON 은 우리가 안 붙여도 Express 가 400 을 낸다 — 본문은 HTML 이다', async () => {
    server = await boot('app.js');
    const res = await fetch(`${server.base}/api/posts`, {
      method: 'POST', headers: JSON_HEADERS, body: '{"username":',
    });
    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toMatch(/text\/html/);
  });

  it('Step 3 시점 판은 빈 몸통도 만들어 준다 — 그래서 검사가 필요했다', async () => {
    server = await boot('snapshots/p2-23.step3.app.js');
    const res = await fetch(`${server.base}/api/posts`, {
      method: 'POST', headers: JSON_HEADERS, body: '{}',
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: 4, likeCount: 0, commentCount: 0, minutesAgo: 0 });
  });
});

describe('Step 5 — `PATCH` 는 한 칸만 받고 전체를 돌려준다', () => {
  it('보낸 것은 한 칸인데 돌아온 것은 아홉 칸이다', async () => {
    server = await boot('app.js');
    const res = await fetch(`${server.base}/api/posts/2`, {
      method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ likeCount: 88 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body)).toHaveLength(9);
    expect(body.likeCount).toBe(88);
    expect(body.username).toBe('minji');
    expect(body.content).toBe('퇴근길에 발견한 카페 ☕');
  });

  it('고친 것이 목록에도 남는다', async () => {
    server = await boot('app.js');
    await fetch(`${server.base}/api/posts/2`, {
      method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ likeCount: 88 }),
    });
    const list = await (await fetch(`${server.base}/api/posts`)).json();
    expect(list[1].likeCount).toBe(88);
  });

  it('🚨 `id` 는 못 바꾼다 — 맨 뒤에 다시 얹어서', async () => {
    server = await boot('app.js');
    const res = await fetch(`${server.base}/api/posts/2`, {
      method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ id: 999, likeCount: 1 }),
    });
    expect((await res.json()).id).toBe(2);
  });

  it('없는 게시물을 고치라고 하면 404 다', async () => {
    server = await boot('app.js');
    const res = await fetch(`${server.base}/api/posts/999`, {
      method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ likeCount: 1 }),
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: '그런 게시물은 없어요' });
  });
});

describe('Step 6 — `DELETE` 는 지운 것을 돌려준다', () => {
  it('지우면 200 에 지운 게시물이 실려 온다', async () => {
    server = await boot('app.js');
    const res = await fetch(`${server.base}/api/posts/3`, { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect((await res.json()).username).toBe('seungwoo');
  });

  it('목록에서 빠지고 하나만 골라도 404 다', async () => {
    server = await boot('app.js');
    await fetch(`${server.base}/api/posts/3`, { method: 'DELETE' });
    const list = await (await fetch(`${server.base}/api/posts`)).json();
    expect(list).toHaveLength(2);
    expect(list.map((one) => one.id)).toEqual([1, 2]);

    const one = await fetch(`${server.base}/api/posts/3`);
    expect(one.status).toBe(404);
  });

  it('🚨 두 번째로 지우라고 하면 404 다 — 남은 목록은 첫 번째와 같다', async () => {
    server = await boot('app.js');
    await fetch(`${server.base}/api/posts/3`, { method: 'DELETE' });
    const again = await fetch(`${server.base}/api/posts/3`, { method: 'DELETE' });
    expect(again.status).toBe(404);
    const list = await (await fetch(`${server.base}/api/posts`)).json();
    expect(list).toHaveLength(2);
  });

  it('가운데 것을 지워도 앞뒤가 안 흐트러진다', async () => {
    server = await boot('app.js');
    await fetch(`${server.base}/api/posts/2`, { method: 'DELETE' });
    const list = await (await fetch(`${server.base}/api/posts`)).json();
    expect(list.map((one) => one.id)).toEqual([1, 3]);
  });
});

describe('Step 7 — `.http` 파일 여덟 요청이 실제로 돈다', () => {
  // 🚨 이 축이 보는 것은 «파일이 파싱되고 여덟 요청이 나가는가» 이지 학생 화면의
  //    응답 창 생김새가 아니다. CLI 출력을 교안에 옮겨 적지 않는다.
  it('교안이 시키는 대로 이어 붙인 posts.http 가 200·404·201·400 을 낸다', async () => {
    server = await boot('app.js');
    const out = execFileSync(
      'node_modules/.bin/httpyac',
      ['send', 'requests/posts.http', '--all', '--output', 'short'],
      { encoding: 'utf-8' });
    expect(out).toContain('8 requests processed (8 succeeded)');
    expect(out.match(/=> 200/g)).toHaveLength(4);
    expect(out.match(/=> 404/g)).toHaveLength(2);
    expect(out.match(/=> 201/g)).toHaveLength(1);
    expect(out.match(/=> 400/g)).toHaveLength(1);
  }, 40000);
});
