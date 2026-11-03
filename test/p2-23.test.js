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
  //    (`./data/posts.js` → `./p2-22.data-posts.js`). 그 한 줄 말고는 한 글자도
  //    다르면 안 된다 — 오프닝이 「어제 만든 그 서버」라고 말하기 때문이다.
  it('스냅숏이 `code/p2-22` 의 `app.js` 와 «불러오는 줄 하나만» 다르다', () => {
    const theirs = execFileSync('git', ['show', 'code/p2-22:app.js'], { encoding: 'utf-8' });
    const mine = readFileSync(new URL('../snapshots/p2-23.opening.app.js', import.meta.url), 'utf-8');
    expect(mine).toBe(theirs.replace("'./data/posts.js'", "'./p2-22.data-posts.js'"));
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
    server = await boot('snapshots/p2-23.final.app.js');
    const res = await fetch(`${server.base}/api/posts`, {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ username: 'yuna', postImage: 'https://picsum.photos/seed/post4/600/600' }),
    });
    expect(res.status).toBe(201);
  });

  it('🚨 헤더를 빼면 `express.json()` 이 있어도 `req.body` 가 `undefined` 라 구조 분해가 터진다', async () => {
    server = await boot('snapshots/p2-23.final.app.js');
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
    server = await boot('snapshots/p2-23.final.app.js');
    const res = await fetch(`${server.base}/api/posts`, { method: 'POST', headers: JSON_HEADERS });
    expect(res.status).toBe(400);
  });
});

describe('Step 3 — `POST` 는 201 이고, 넷은 서버가 정한다', () => {
  it('보낸 다섯 칸에 서버가 넷을 얹어 201 로 돌려준다', async () => {
    server = await boot('snapshots/p2-23.final.app.js');
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
    server = await boot('snapshots/p2-23.final.app.js');
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
    server = await boot('snapshots/p2-23.final.app.js');
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
    server = await boot('snapshots/p2-23.final.app.js');
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
    server = await boot('snapshots/p2-23.final.app.js');
    const res = await fetch(`${server.base}/api/posts`, {
      method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ username: 'yuna' }),
    });
    expect(res.status).toBe(400);
  });

  it('빈 글자도 「없는 것」으로 본다 — `!""` 가 참이라서', async () => {
    server = await boot('snapshots/p2-23.final.app.js');
    const res = await fetch(`${server.base}/api/posts`, {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ username: '', postImage: 'x' }),
    });
    expect(res.status).toBe(400);
  });

  it('🚨 깨진 JSON 은 우리가 안 붙여도 Express 가 400 을 낸다 — 본문은 HTML 이다', async () => {
    server = await boot('snapshots/p2-23.final.app.js');
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
    server = await boot('snapshots/p2-23.final.app.js');
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
    server = await boot('snapshots/p2-23.final.app.js');
    await fetch(`${server.base}/api/posts/2`, {
      method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ likeCount: 88 }),
    });
    const list = await (await fetch(`${server.base}/api/posts`)).json();
    expect(list[1].likeCount).toBe(88);
  });

  it('🚨 `id` 는 못 바꾼다 — 맨 뒤에 다시 얹어서', async () => {
    server = await boot('snapshots/p2-23.final.app.js');
    const res = await fetch(`${server.base}/api/posts/2`, {
      method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ id: 999, likeCount: 1 }),
    });
    expect((await res.json()).id).toBe(2);
  });

  it('없는 게시물을 고치라고 하면 404 다', async () => {
    server = await boot('snapshots/p2-23.final.app.js');
    const res = await fetch(`${server.base}/api/posts/999`, {
      method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ likeCount: 1 }),
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: '그런 게시물은 없어요' });
  });
});

describe('Step 6 — `DELETE` 는 지운 것을 돌려준다', () => {
  it('지우면 200 에 지운 게시물이 실려 온다', async () => {
    server = await boot('snapshots/p2-23.final.app.js');
    const res = await fetch(`${server.base}/api/posts/3`, { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect((await res.json()).username).toBe('seungwoo');
  });

  it('목록에서 빠지고 하나만 골라도 404 다', async () => {
    server = await boot('snapshots/p2-23.final.app.js');
    await fetch(`${server.base}/api/posts/3`, { method: 'DELETE' });
    const list = await (await fetch(`${server.base}/api/posts`)).json();
    expect(list).toHaveLength(2);
    expect(list.map((one) => one.id)).toEqual([1, 2]);

    const one = await fetch(`${server.base}/api/posts/3`);
    expect(one.status).toBe(404);
  });

  it('🚨 두 번째로 지우라고 하면 404 다 — 남은 목록은 첫 번째와 같다', async () => {
    server = await boot('snapshots/p2-23.final.app.js');
    await fetch(`${server.base}/api/posts/3`, { method: 'DELETE' });
    const again = await fetch(`${server.base}/api/posts/3`, { method: 'DELETE' });
    expect(again.status).toBe(404);
    const list = await (await fetch(`${server.base}/api/posts`)).json();
    expect(list).toHaveLength(2);
  });

  it('가운데 것을 지워도 앞뒤가 안 흐트러진다', async () => {
    server = await boot('snapshots/p2-23.final.app.js');
    await fetch(`${server.base}/api/posts/2`, { method: 'DELETE' });
    const list = await (await fetch(`${server.base}/api/posts`)).json();
    expect(list.map((one) => one.id)).toEqual([1, 3]);
  });
});

describe('Step 7 — `.http` 파일 여덟 요청이 실제로 돈다', () => {
  // 🚨 이 축이 보는 것은 «파일이 파싱되고 여덟 요청이 나가는가» 이지 학생 화면의
  //    응답 창 생김새가 아니다. CLI 출력을 교안에 옮겨 적지 않는다.
  it('교안이 시키는 대로 이어 붙인 posts.http 가 200·404·201·400 을 낸다', async () => {
    server = await boot('snapshots/p2-23.final.app.js');
    const out = execFileSync(
      'node_modules/.bin/httpyac',
      // 🚨 `requests/posts.http` 도 회차마다 자라는 파일이다 — `p2-24` 가 번호를
      //    `_id` 로 갈아 끼우면서 이 회차의 요청 여덟이 통째로 달라진다.
      ['send', 'snapshots/p2-23.posts.http', '--all', '--output', 'short'],
      { encoding: 'utf-8' });
    expect(out).toContain('8 requests processed (8 succeeded)');
    expect(out.match(/=> 200/g)).toHaveLength(4);
    expect(out.match(/=> 404/g)).toHaveLength(2);
    expect(out.match(/=> 201/g)).toHaveLength(1);
    expect(out.match(/=> 400/g)).toHaveLength(1);
  }, 40000);
});

describe('실습 1 — 댓글을 올리는 주소', () => {
  it('목록은 셋이고, 올리면 201 에 `id` 4 가 붙어 넷이 된다', async () => {
    server = await boot('lab/p2-23/practice1.js', { port: 4000 });
    expect(server.log.trim()).toBe('실습 서버가 4000번 포트에서 기다리고 있어요.');

    const before = await (await fetch(`${server.base}/api/comments`)).json();
    expect(before).toHaveLength(3);

    const res = await fetch(`${server.base}/api/comments`, {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ postId: 1, username: 'yuna', text: '저도 가보고 싶어요' }),
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      postId: 1, username: 'yuna', text: '저도 가보고 싶어요', id: 4,
    });

    const after = await (await fetch(`${server.base}/api/comments`)).json();
    expect(after).toHaveLength(4);
    expect(after[3].id).toBe(4);
  });

  it('`comments.http` 요청 셋이 실제로 돈다', async () => {
    server = await boot('lab/p2-23/practice1.js', { port: 4000 });
    const out = execFileSync(
      'node_modules/.bin/httpyac',
      // 🚨 `requests/comments.http` 도 자라는 파일이다 — `p2-24` 가 번호를 `_id` 로
      //    갈아 끼우면서 이 회차의 요청이 통째로 달라진다.
      ['send', 'snapshots/p2-23.comments.http', '--all', '--output', 'short'],
      { encoding: 'utf-8' });
    expect(out).toContain('3 requests processed (3 succeeded)');
    expect(out.match(/=> 200/g)).toHaveLength(2);
    expect(out.match(/=> 201/g)).toHaveLength(1);
  }, 40000);

  it('🚨 서버를 다시 띄우면 올린 댓글이 사라진다 — 해설이 주장하는 그대로', async () => {
    server = await boot('lab/p2-23/practice1.js', { port: 4000 });
    await fetch(`${server.base}/api/comments`, {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ postId: 1, username: 'yuna', text: '사라질 댓글' }),
    });
    expect(await (await fetch(`${server.base}/api/comments`)).json()).toHaveLength(4);
    await server.stop();

    server = await boot('lab/p2-23/practice1.js', { port: 4000 });
    expect(await (await fetch(`${server.base}/api/comments`)).json()).toHaveLength(3);
  });
});

describe('실습 2 — 프로필 소개글 고치기', () => {
  it('보낸 칸만 바뀌고 나머지 셋은 그대로다', async () => {
    server = await boot('lab/p2-23/practice2.js', { port: 4000 });
    const res = await fetch(`${server.base}/api/profiles/minji`, {
      method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ bio: '오늘도 카페' }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      username: 'minji', name: '이민지', bio: '오늘도 카페', followerCount: 8500,
    });
  });

  it('🚨 `username` 은 못 바꾼다 — 스프레드 맨 뒤에 다시 얹어서', async () => {
    server = await boot('lab/p2-23/practice2.js', { port: 4000 });
    const res = await fetch(`${server.base}/api/profiles/minji`, {
      method: 'PATCH', headers: JSON_HEADERS,
      body: JSON.stringify({ username: 'haecker', bio: '바뀌었을까요' }),
    });
    const body = await res.json();
    expect(body.username).toBe('minji');
    expect(body.bio).toBe('바뀌었을까요');
  });

  it('없는 사람은 404 다', async () => {
    server = await boot('lab/p2-23/practice2.js', { port: 4000 });
    const res = await fetch(`${server.base}/api/profiles/haecker`, {
      method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ bio: '안녕' }),
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: '그런 프로필은 없어요' });
  });

  it('`profiles.http` 요청 셋이 200·404·200 을 낸다', async () => {
    server = await boot('lab/p2-23/practice2.js', { port: 4000 });
    const out = execFileSync(
      'node_modules/.bin/httpyac',
      ['send', 'requests/profiles.http', '--all', '--output', 'short'],
      { encoding: 'utf-8' });
    expect(out).toContain('3 requests processed (3 succeeded)');
    expect(out.match(/=> 200/g)).toHaveLength(2);
    expect(out.match(/=> 404/g)).toHaveLength(1);
  }, 40000);
});

describe('실습 3 — 책을 올리고 지우는 서점', () => {
  it('201·400·200·200 이 나오고 목록이 셋 → 넷 → 셋이 된다', async () => {
    server = await boot('lab/p2-23/practice3.js', { port: 4000 });

    const made = await fetch(`${server.base}/api/books`, {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ title: '죽은 시인의 사회', author: 'N.H. 클라인바움', stock: 999 }),
    });
    expect(made.status).toBe(201);
    const body = await made.json();
    expect(body.id).toBe(4);
    expect(body.stock).toBe(0);          // 🚨 보낸 999 를 서버가 덮어쓴다

    const bad = await fetch(`${server.base}/api/books`, {
      method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ author: '이름만' }),
    });
    expect(bad.status).toBe(400);

    const patched = await fetch(`${server.base}/api/books/2`, {
      method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ stock: 9 }),
    });
    expect((await patched.json()).stock).toBe(9);

    const gone = await fetch(`${server.base}/api/books/3`, { method: 'DELETE' });
    expect(gone.status).toBe(200);

    const list = await (await fetch(`${server.base}/api/books`)).json();
    expect(list.map((one) => one.id)).toEqual([1, 2, 4]);   // 해설이 주장하는 그대로
  });

  it('`books.http` 여덟 요청이 실제로 돈다', async () => {
    server = await boot('lab/p2-23/practice3.js', { port: 4000 });
    const out = execFileSync(
      'node_modules/.bin/httpyac',
      // 🚨 `requests/books.http` 도 자라는 파일이다 — `p2-24` 가 번호를 `_id` 로
      //    갈아 끼우면서 이 회차의 요청이 통째로 달라진다.
      ['send', 'snapshots/p2-23.books.http', '--all', '--output', 'short'],
      { encoding: 'utf-8' });
    expect(out).toContain('8 requests processed (8 succeeded)');
    expect(out.match(/=> 201/g)).toHaveLength(1);
    expect(out.match(/=> 400/g)).toHaveLength(1);
  }, 40000);
});

describe('과제 1 — 스토리를 올리고 지우는 주소', () => {
  it('🚨 `isViewed` 를 실어 보내도 서버가 `false` 로 덮어쓴다', async () => {
    server = await boot('lab/p2-23/homework1.js', { port: 4000 });
    const res = await fetch(`${server.base}/api/stories`, {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ username: 'yuna', isViewed: true }),
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ username: 'yuna', id: 4, isViewed: false });
  });

  it('`stories.http` 다섯이 200·201·400·200·200 을 낸다', async () => {
    server = await boot('lab/p2-23/homework1.js', { port: 4000 });
    const out = execFileSync(
      'node_modules/.bin/httpyac',
      ['send', 'requests/stories.http', '--all', '--output', 'short'],
      { encoding: 'utf-8' });
    expect(out).toContain('5 requests processed (5 succeeded)');
    expect(out.match(/=> 200/g)).toHaveLength(3);
    expect(out.match(/=> 201/g)).toHaveLength(1);
    expect(out.match(/=> 400/g)).toHaveLength(1);
  }, 40000);
});

describe('과제 2 — 좋아요를 누가 세야 하나', () => {
  it('🔴 PATCH 로 1241 을 «두 번» 보내면 결과가 1241 이다 — 한 번이 사라진다', async () => {
    server = await boot('lab/p2-23/homework2.js', { port: 4000 });
    for (let i = 0; i < 2; i += 1) {
      await fetch(`${server.base}/api/posts/1`, {
        method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ likeCount: 1241 }),
      });
    }
    const list = await (await fetch(`${server.base}/api/posts`)).json();
    expect(list[0].likeCount).toBe(1241);
  });

  it('✅ `POST /likes` 로 두 번 보내면 1242 다 — 서버가 세니까', async () => {
    server = await boot('lab/p2-23/homework2.js', { port: 4000 });
    for (let i = 0; i < 2; i += 1) {
      await fetch(`${server.base}/api/posts/1/likes`, { method: 'POST' });
    }
    const list = await (await fetch(`${server.base}/api/posts`)).json();
    expect(list[0].likeCount).toBe(1242);
  });

  it('없는 게시물에 하트를 누르면 404 다', async () => {
    server = await boot('lab/p2-23/homework2.js', { port: 4000 });
    const res = await fetch(`${server.base}/api/posts/999/likes`, { method: 'POST' });
    expect(res.status).toBe(404);
  });
});

describe('교안·답안 인용이 코드베이스와 byte 동일한가', () => {
  // 🚨 `p2-24` 가 이 파일에서 이어 시작한다. 완성본이 한 글자라도 다르면 다음
  //    회차가 «재현 불가» 가 되는데, 그건 게이트가 원리적으로 안 본다
  //    (replay 는 «돌아가는가» 만 보지 «같은가» 를 안 본다).
  const LEC = '../../../part2/4-node-backend/p2-23-crud-api-lecture.md';
  const ANS = '../../../part2/4-node-backend/p2-23-crud-api-answers.md';

  const blocksOf = (path, head) => {
    const md = readFileSync(new URL(path, import.meta.url), 'utf-8');
    const re = new RegExp('```javascript\\n(' + head.replace(/[/.]/g, '\\$&') + '\\n[\\s\\S]*?)```', 'g');
    return [...md.matchAll(re)].map((m) => m[1]);
  };
  const real = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf-8');

  it('완성본 app.js 가 코드베이스와 같다', () => {
    // 🚨 `app.js` 는 회차를 넘나들며 «자라는» 파일이라 live 로 보면 안 된다
    //    (2026-09-06 `p2-24` 가 Mongoose 로 갈아 끼우자 이 검사가 통째로 죽었다).
    //    이 회차의 완성본은 «`code/p2-23` 브랜치의 그것» 이다.
    const quoted = blocksOf(LEC, '// ~/instagram-api/app.js');
    const theirs = execFileSync('git', ['show', 'code/p2-23:app.js'], { encoding: 'utf-8' });
    expect(quoted.at(-1)).toBe(theirs);
  });

  it('답안의 `homework1.js` 완성본이 코드베이스와 같다', () => {
    const quoted = blocksOf(ANS, '// ~/instagram-api/lab/homework1.js');
    expect(quoted[0]).toBe(real('lab/p2-23/homework1.js'));
  });

  it('답안의 `homework2.js` 발췌 둘이 코드베이스 안에 그대로 있다', () => {
    // 🚨 발췌는 파일 전체가 아니라 «떼어 온 조각» 이라 byte 동일 대신 «포함» 으로 본다.
    //    조각 안의 줄이 하나라도 다르면 학생이 붙여넣은 것이 안 돈다.
    const real = readFileSync(new URL('../lab/p2-23/homework2.js', import.meta.url), 'utf-8');
    const quoted = blocksOf(ANS, '// ~/instagram-api/lab/homework2.js');
    expect(quoted).toHaveLength(3);
    for (const block of quoted) {
      const body = block.split('\n').slice(1).join('\n').trim();
      expect(real).toContain(body);
    }
  });

  it('교안이 인용한 Step 1 시점 `app.get` 이 `code/p2-22` 판과 같다', () => {
    const quoted = blocksOf(LEC, '// ~/instagram-api/app.js')[0];
    const theirs = execFileSync('git', ['show', 'code/p2-22:app.js'], { encoding: 'utf-8' });
    expect(theirs).toContain(quoted.split('\n').slice(1).join('\n').trim());
  });
});
