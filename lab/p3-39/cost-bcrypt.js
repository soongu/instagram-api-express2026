// ~/instagram-api/lab/p3-39/cost-bcrypt.js
import bcrypt from 'bcrypt';
import { samplePasswords } from './words.js';

// bcrypt 로 10만 번은 너무 오래 걸린다 — 앞의 20개만 해시해 보고, 걸린 시간으로 10만 개를 짐작한다.
const COUNT = 20;
const started = performance.now();
let count = 0;

for (const password of samplePasswords()) {
  if (count === COUNT) break;
  await bcrypt.hash(password, 12);
  count += 1;
}

const each = (performance.now() - started) / COUNT;
const hours = (each * 100000) / 1000 / 60 / 60;

console.log(`bcrypt(cost 12)로 ${COUNT}번 해시해 보니 한 번에 ${Math.round(each)}ms 걸렸어요.`);
console.log(`같은 방식으로 10만 번 해시하려면 ${hours.toFixed(1)}시간쯤 걸려요.`);
