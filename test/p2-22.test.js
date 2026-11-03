// 내부 검증 전용 — 교안에 한 줄도 인용하지 않는다.
import { describe, it, expect, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import express from 'express';
import { boot } from './helpers/boot.js';

let server = null;
afterEach(async () => {
  if (server) { await server.stop(); server = null; }
});

describe('Step 3 — 첫 라우트 하나', () => {
  it('`node app.js` 를 치면 기다리고 있다고 한 줄 찍는다', async () => {
    server = await boot('snapshots/p2-22.final.app.js');
    expect(server.log.trim()).toBe('서버가 3000번 포트에서 기다리고 있어요.');
  });

  it('/ 로 물으면 글자 한 줄을 돌려준다', async () => {
    server = await boot('snapshots/p2-22.final.app.js');
    const res = await fetch(`${server.base}/`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('인스타그램 서버가 살아 있어요');
  });
});

describe('Step 4 — JSON 으로 답한다', () => {
  it('/api/posts 가 게시물 배열을 JSON 으로 돌려준다', async () => {
    server = await boot('snapshots/p2-22.final.app.js');
    const res = await fetch(`${server.base}/api/posts`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(3);
  });

  it('교안이 주장하는 «같은 모양» 이 참인가 — `p2-21` 시점 db.json 과 대조', async () => {
    // 🚨 워킹 트리의 db.json 을 읽지 않는다. `code/instagram-react` 체크아웃은
    //    지금 `code/p2-15` 에 세워져 있어서 **여섯 회차 뒤처진 판**이다.
    //    학생이 `p2-22` 에 들고 오는 것은 `code/p2-21` 판이므로 그 리비전을 박는다.
    const raw = execFileSync(
      'git', ['-C', '../instagram-react', 'show', 'code/p2-21:mock/db.json'],
      { encoding: 'utf-8' });
    const theirs = JSON.parse(raw).posts.slice(0, 3);
    server = await boot('snapshots/p2-22.final.app.js');
    const ours = await (await fetch(`${server.base}/api/posts`)).json();
    expect(ours).toEqual(theirs);
  });
});

describe('Step 5 — 주소에 값을 싣는다', () => {
  it('/api/posts/2 는 2번 게시물 «하나» 를 돌려준다', async () => {
    server = await boot('snapshots/p2-22.final.app.js');
    const res = await fetch(`${server.base}/api/posts/2`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(false);
    expect(body.id).toBe(2);
    expect(body.username).toBe('minji');
  });

  it('req.params 는 «문자열» 로 들어온다 — 그래서 === 로 못 찾는다', async () => {
    // 🚨 이 축이 있어야 교안의 Number() 한 줄이 장식이 아니게 된다.
    //    `p1-22`(느슨한 비교)에서 배운 그 함정이 여기서 다시 나온다.
    server = await boot('snapshots/p2-22.final.app.js');
    const res = await fetch(`${server.base}/api/posts/2`);
    expect((await res.json()).id).toBe(2);
  });
});

describe('Step 7 — 응답 코드를 «우리가» 정한다', () => {
  it('없는 게시물은 404 와 메시지', async () => {
    server = await boot('snapshots/p2-22.final.app.js');
    const res = await fetch(`${server.base}/api/posts/999`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: '그런 게시물은 없어요' });
  });

  it('없는 주소도 404 — 별표 줄이 아니라 app.use 가 받는다', async () => {
    server = await boot('snapshots/p2-22.final.app.js');
    const res = await fetch(`${server.base}/api/comments`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: '그런 주소는 없어요' });
  });

  it('`p2-21` 이 넘긴 그 대조 — 있는 주소는 200, 없는 주소는 404', async () => {
    server = await boot('snapshots/p2-22.final.app.js');
    const codes = [];
    for (const path of ['/api/posts', '/api/posts/1', '/api/posts/999', '/없는주소']) {
      codes.push((await fetch(`${server.base}${path}`)).status);
    }
    expect(codes).toEqual([200, 200, 404, 404]);
  });
});

describe('Step 6 — httpYac 으로 보내는 요청', () => {
  it('교안이 시키는 대로 만든 .http 파일이 실제로 돈다', async () => {
    // 🚨 이 테스트가 보는 것은 «파일이 파싱되고 세 요청이 나가는가» 이지
    //    학생 화면의 «응답 창 생김새» 가 아니다. CLI 출력과 VS Code 확장의
    //    응답 창은 형식이 다르므로, **CLI 출력을 교안에 옮겨 적지 않는다.**
    server = await boot('snapshots/p2-22.final.app.js');
    // 🚨 `requests/posts.http` 는 회차마다 자라는 파일이라 워킹 트리를 안 읽는다.
    //    그리고 **`code/p2-22` 판도 못 쓴다** — 그 판에는 요청이 셋뿐인데
    //    교안 Step 6 은 「맨 아래에 하나 더 붙이고 넷을 다 보내볼게요」로
    //    «넷» 을 만들게 한다(2026-09-05 `p2-23` 착수 시 발견). 코드베이스가 학생
    //    파일보다 한 요청 뒤처져 있었고, 이 축은 그 셋을 「맞다」고 잠그고 있었다.
    //    대조 기준은 «교안이 시키는 결과물» 이므로 스냅숏으로 박는다.
    const out = execFileSync(
      'node_modules/.bin/httpyac',
      ['send', 'snapshots/p2-22.posts.http', '--all', '--output', 'short'],
      { encoding: 'utf-8' });
    expect(out).toContain('4 requests processed (4 succeeded)');
    expect(out.match(/=> 200/g)).toHaveLength(2);
    expect(out.match(/=> 404/g)).toHaveLength(2);
  }, 30000);
});

describe('Step 5 시점 — 우리가 404를 붙이기 «전»', () => {
  // 🚨 이 축이 Step 6 의 서술을 통째로 떠받친다. 초고는 «없는 게시물이면
  //    res.json(undefined) 라서 Express 가 404 를 붙인다» 고 적었는데
  //    **거짓이었다** — 재보니 200 에 빈 본문이다. 안 재고 썼으면 학생 화면과
  //    교안이 정면으로 어긋났다.
  it('없는 게시물은 404가 아니라 «200에 빈 본문»', async () => {
    server = await boot('snapshots/p2-22.step5.app.js');
    const res = await fetch(`${server.base}/api/posts/999`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('');
  });

  it('없는 주소는 Express 가 404 를 주는데 «본문이 HTML»', async () => {
    server = await boot('snapshots/p2-22.step5.app.js');
    const res = await fetch(`${server.base}/api/comments`);
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toMatch(/text\/html/);
    expect(await res.text()).toContain('<!DOCTYPE html>');
  });

  it('있는 것 둘은 멀쩡하다 — 대조군', async () => {
    server = await boot('snapshots/p2-22.step5.app.js');
    const codes = [];
    for (const p of ['/api/posts', '/api/posts/2']) {
      codes.push((await fetch(`${server.base}${p}`)).status);
    }
    expect(codes).toEqual([200, 200]);
  });
});

describe('실습·과제 — 학생이 만드는 것', () => {
  const at = (path) => fetch(`${server.base}${path}`);

  it('실습1 — /me 가 글자를 돌려준다', async () => {
    server = await boot('lab/p2-22/practice1.js', { port: 4000 });
    const res = await at('/me');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('홍순구입니다');
  });

  it('실습2 — username 은 글자라 Number 로 감쌀 이유가 없다', async () => {
    server = await boot('lab/p2-22/practice2.js', { port: 4000 });
    expect(await (await at('/api/profiles')).json()).toHaveLength(3);
    expect((await (await at('/api/profiles/minji')).json()).name).toBe('이민지');
  });

  it('실습2 — 줄 순서를 뒤집어도 둘 다 걸린다 (마디 수가 다르므로)', async () => {
    // 교안 토글이 주장하는 것을 실제로 잰다.
    server = await boot('lab/p2-22/practice2.js', { port: 4000 });
    const list = await (await at('/api/profiles')).json();
    const one = await (await at('/api/profiles/jaehoon')).json();
    expect(Array.isArray(list)).toBe(true);
    expect(Array.isArray(one)).toBe(false);
  });

  it('실습3 — 없는 책과 없는 주소가 서로 다른 문구로 404', async () => {
    server = await boot('lab/p2-22/practice3.js', { port: 4000 });
    const codes = [];
    for (const p of ['/api/books', '/api/books/2', '/api/books/99', '/api/authors']) {
      codes.push((await at(p)).status);
    }
    expect(codes).toEqual([200, 200, 404, 404]);
    expect(await (await at('/api/books/99')).json()).toEqual({ message: '그런 책은 없어요' });
    expect(await (await at('/api/authors')).json()).toEqual({ message: '그런 주소는 없어요' });
  });

  it('과제1 — 스토리 넷 · 200 200 404 404', async () => {
    server = await boot('lab/p2-22/homework1.js', { port: 4000 });
    expect(await (await at('/api/stories')).json()).toHaveLength(4);
    const codes = [];
    for (const p of ['/api/stories', '/api/stories/2', '/api/stories/99', '/api/authors']) {
      codes.push((await at(p)).status);
    }
    expect(codes).toEqual([200, 200, 404, 404]);
  });

  it('과제2 — 순서를 «바꾸기 전» 에는 latest 가 :id 에 먹힌다', async () => {
    // 🚨 교안이 4번 단계에서 학생에게 보라고 시키는 그 화면이다.
    //    안 재고 쓰면 「무엇이 돌아왔는지」를 저자가 짐작으로 적게 된다.
    server = await boot('snapshots/p2-22.hw2.wrong-order.js', { port: 4000 });
    const res = await at('/api/books/latest');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: '그런 책은 없어요' });
  });

  it('과제2 — 순서를 바꾸면 latest 가 마지막 책을 준다', async () => {
    server = await boot('lab/p2-22/homework2.js', { port: 4000 });
    expect(await (await at('/api/books/latest')).json()).toEqual({ id: 3, title: '모모' });
    expect(await (await at('/api/books/2')).json()).toEqual({ id: 2, title: '데미안' });
  });

  it('실습3 요청 파일이 실제로 돈다', async () => {
    server = await boot('lab/p2-22/practice3.js', { port: 4000 });
    const out = execFileSync(
      'node_modules/.bin/httpyac',
      // 🚨 `requests/books.http` 도 회차마다 자라는 파일이다 — `p2-23` 실습 3 이
      //    요청 넷을 더 붙인다. 그 회차 시점 스냅숏으로 얼려 떼어낸다.
      ['send', 'snapshots/p2-22.books.http', '--all', '--output', 'short'],
      { encoding: 'utf-8' });
    expect(out).toContain('4 requests processed (4 succeeded)');
    expect(out.match(/=> 200/g)).toHaveLength(2);
    expect(out.match(/=> 404/g)).toHaveLength(2);
  }, 30000);
});

describe('토글이 주장하는 «순서를 바꾸면» 판', () => {
  it('app.use 를 맨 위로 올리면 네 요청이 전부 그런 주소는 없어요', async () => {
    // 🚨 `onscreen-check` 가 「재야 할 문장」으로 나열한 자리다. 산문으로만 적혀
    //    있던 주장이라 어느 게이트도 안 봤다.
    server = await boot('snapshots/p2-22.practice3.use-on-top.js', { port: 4000 });
    const seen = [];
    for (const p of ['/api/books', '/api/books/2', '/api/books/99', '/api/authors']) {
      const res = await fetch(`${server.base}${p}`);
      seen.push([res.status, (await res.json()).message]);
    }
    expect(seen).toEqual([
      [404, '그런 주소는 없어요'],
      [404, '그런 주소는 없어요'],
      [404, '그런 주소는 없어요'],
      [404, '그런 주소는 없어요'],
    ]);
  });
});

describe('교안 인용이 코드베이스와 byte 동일한가', () => {
  // 🚨 `p2-23` 이 이 파일에서 이어 시작한다. 교안 완성본이 코드베이스와 한 글자라도
  //    다르면 다음 회차가 «재현 불가» 가 되는데, 그건 게이트가 원리적으로 안 본다
  //    (replay 는 «돌아가는가» 만 보지 «같은가» 를 안 본다).
  // 🚨 `new URL(rel, import.meta.url)` 은 «이 파일» 기준이라 `../` 하나가
  //    `instagram-api/` 다. 한 단 얕게 적었더니 ENOENT 로 죽었는데, 그건
  //    통과가 아니라 «검사를 안 한 것» 이다.
  const LEC = '../../../part2/4-node-backend/p2-22-express-start-lecture.md';

  const blocksOf = (path, head) => {
    const md = readFileSync(new URL(path, import.meta.url), 'utf-8');
    const re = new RegExp('```javascript\\n(' + head.replace(/[/.]/g, '\\$&') + '\\n[\\s\\S]*?)```', 'g');
    return [...md.matchAll(re)].map((m) => m[1]);
  };

  // 🚨 **워킹 트리의 `app.js` 를 안 읽는다** (2026-09-05 `p2-23` 착수 시 고침).
  //    이 파일은 회차마다 자라는 척추라, live 로 대조하면 `p2-23` 이 줄을 더한
  //    순간 이 축이 «회귀» 로 뜬다 — 그러면 사람이 멀쩡한 `p2-22` 교안을 고친다.
  //    대조 기준은 그 회차의 브랜치가 가리키는 «그 시점 판» 이다.
  it('완성본 app.js 가 코드베이스와 같다 (`code/p2-22` 시점)', () => {
    const quoted = blocksOf(LEC, '// ~/instagram-api/app.js');
    const real = execFileSync('git', ['show', 'code/p2-22:app.js'], { encoding: 'utf-8' });
    expect(quoted.at(-1)).toBe(real);
  });

  it('data/posts.js 인용이 코드베이스와 같다', () => {
    const quoted = blocksOf(LEC, '// ~/instagram-api/data/posts.js');
    const real = readFileSync(new URL('../snapshots/p2-22.data-posts.js', import.meta.url), 'utf-8');
    expect(quoted).toHaveLength(1);
    expect(quoted[0]).toBe(real);
  });
});

describe('`return` 을 빠뜨리면 정말 «터지는가»', () => {
  // 🚨 초고는 「한 요청에 응답을 두 번 보내려다 터져요」라고 적었는데 거짓이었다.
  //    조용히 지나간다. 터지는 것은 «아래 줄이 진짜 값을 담을 때» 뿐이다.
  //    이 축이 없으면 산문이 다시 뒤집혀도 아무도 못 본다.
  const bootInline = (after) => new Promise((done) => {
    const rows = [];
    const app = express();
    app.get('/x/:id', (req, res) => {
      const post = [{ id: 1 }].find((o) => o.id === Number(req.params.id));
      if (!post) { res.status(404).json({ message: '없어요' }); }
      after(res, post);
    });
    const s = app.listen(0, async () => {
      let caught = null;
      const onErr = (e) => { caught = e.code; };
      process.once('uncaughtException', onErr);
      const r = await fetch(`http://localhost:${s.address().port}/x/999`).catch(() => null);
      await new Promise((d) => setTimeout(d, 200));
      process.off('uncaughtException', onErr);
      rows.push(r ? r.status : 0, caught);
      s.close(() => done(rows));
    });
  });

  it('`res.json(post)` 는 post 가 undefined 라 조용히 넘어간다', async () => {
    const [status, caught] = await bootInline((res, post) => res.json(post));
    expect(status).toBe(404);
    expect(caught).toBe(null);
  });

  it('아래 줄이 «진짜 값» 을 담으면 터미널에 ERR_HTTP_HEADERS_SENT 가 찍힌다', async () => {
    server = await boot('snapshots/p2-22.no-return.js');
    const first = await fetch(`${server.base}/api/posts/999`);
    // stderr 가 파이프로 건너오는 데 시간이 든다. 부하가 있으면 800ms 로는 모자란다.
    await new Promise((d) => setTimeout(d, 1500));
    expect(first.status).toBe(404);                       // 클라이언트는 멀쩡한 답을 받고
    expect(server.tail()).toContain('ERR_HTTP_HEADERS_SENT');  // 터미널에만 찍힌다
    // 그리고 서버는 «안 죽는다» — 교안이 「터진다」라고 쓰면 이 줄이 반증한다.
    const after = await fetch(`${server.base}/api/posts/1`);
    expect(after.status).toBe(200);
  }, 15000);
});

describe('답안이 주장하는 NaN 의 성질', () => {
  it('NaN 은 자기 자신과도 같지 않아 find 가 못 찾는다', () => {
    // 🚨 초고는 「NaN 과 같은 id 가 어디에도 없으니」라고 적었는데, 그건
    //    「우리 배열에 마침 없어서」로 읽힌다. 진짜 이유는 NaN === NaN 이 거짓인 것이다.
    expect(Number('latest')).toBeNaN();
    expect(NaN === NaN).toBe(false);
    const books = [{ id: NaN, title: '일부러 NaN' }, { id: 1, title: '어린 왕자' }];
    expect(books.find((o) => o.id === Number('latest'))).toBeUndefined();
  });
});
