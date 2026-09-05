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
