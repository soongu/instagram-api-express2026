// ~/instagram-api/lab/p3-39/practice2.js
import bcrypt from 'bcrypt';

// 해시 한 번이 이 시간(ms)을 넘지 않는 가장 큰 cost 를 고른다.
const LIMIT_MS = 250;
let chosen = 10;

for (let cost = 10; cost <= 15; cost += 1) {
  const started = performance.now();
  await bcrypt.hash('qwer1234', cost);
  const ms = Math.round(performance.now() - started);

  console.log(`cost ${cost}: ${ms}ms`);
  if (ms > LIMIT_MS) break;
  chosen = cost;
}

console.log(`이 컴퓨터에서 고를 cost: ${chosen}`);
