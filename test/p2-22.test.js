// 내부 검증 전용 — 교안에 한 줄도 인용하지 않는다.
import { describe, it, expect, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { boot } from './helpers/boot.js';

let server = null;
afterEach(async () => {
  if (server) { await server.stop(); server = null; }
});

describe('Step 3 — 첫 라우트 하나', () => {
  it('`node app.js` 를 치면 기다리고 있다고 한 줄 찍는다', async () => {
    server = await boot('app.js');
    expect(server.log.trim()).toBe('서버가 3000번 포트에서 기다리고 있어요.');
  });

  it('/ 로 물으면 글자 한 줄을 돌려준다', async () => {
    server = await boot('app.js');
    const res = await fetch(`${server.base}/`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('인스타그램 서버가 살아 있어요');
  });
});

describe('Step 4 — JSON 으로 답한다', () => {
  it('/api/posts 가 게시물 배열을 JSON 으로 돌려준다', async () => {
    server = await boot('app.js');
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
    server = await boot('app.js');
    const ours = await (await fetch(`${server.base}/api/posts`)).json();
    expect(ours).toEqual(theirs);
  });
});

describe('Step 5 — 주소에 값을 싣는다', () => {
  it('/api/posts/2 는 2번 게시물 «하나» 를 돌려준다', async () => {
    server = await boot('app.js');
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
    server = await boot('app.js');
    const res = await fetch(`${server.base}/api/posts/2`);
    expect((await res.json()).id).toBe(2);
  });
});

describe('Step 7 — 응답 코드를 «우리가» 정한다', () => {
  it('없는 게시물은 404 와 메시지', async () => {
    server = await boot('app.js');
    const res = await fetch(`${server.base}/api/posts/999`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: '그런 게시물은 없어요' });
  });

  it('없는 주소도 404 — 별표 줄이 아니라 app.use 가 받는다', async () => {
    server = await boot('app.js');
    const res = await fetch(`${server.base}/api/comments`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: '그런 주소는 없어요' });
  });

  it('`p2-21` 이 넘긴 그 대조 — 있는 주소는 200, 없는 주소는 404', async () => {
    server = await boot('app.js');
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
    server = await boot('app.js');
    const out = execFileSync(
      'node_modules/.bin/httpyac',
      ['send', 'requests/posts.http', '--all', '--output', 'short'],
      { encoding: 'utf-8' });
    expect(out).toContain('3 requests processed (3 succeeded)');
    expect(out.match(/=> 200/g)).toHaveLength(2);
    expect(out.match(/=> 404/g)).toHaveLength(1);
  }, 30000);
});
