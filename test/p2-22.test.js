// 내부 검증 전용 — 교안에 한 줄도 인용하지 않는다.
import { describe, it, expect, afterEach } from 'vitest';
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
