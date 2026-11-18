// ~/instagram-api/lab/p3-39/load.js
import { setTimeout as sleep } from 'node:timers/promises';

const BASE = 'http://localhost:4003';

// 요청 하나를 보내고 응답이 올 때까지 걸린 시간(ms)을 돌려준다.
async function timed(path, init) {
  const started = performance.now();
  await fetch(`${BASE}${path}`, init);

  return Math.round(performance.now() - started);
}

const signup = (path) =>
  timed(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'qwer1234' }),
  });

// 가입 요청을 보내고 0.05초 뒤에 /ping 을 보낸다 — /ping 은 얼마나 기다릴까?
for (const path of ['/signup-sync', '/signup']) {
  const pending = signup(path);
  await sleep(50);
  const ping = await timed('/ping');

  console.log(`${path} ${await pending}ms · 그사이에 보낸 /ping ${ping}ms`);
}

// 가입 요청 다섯 개를 한꺼번에 보낸다.
const times = await Promise.all([1, 2, 3, 4, 5].map(() => signup('/signup')));
console.log(`/signup 다섯 개를 한꺼번에: ${times.join('ms · ')}ms`);
