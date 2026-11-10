// ~/instagram-api/lab/p3-39/crack-bcrypt.js
import bcrypt from 'bcrypt';
import { leaked } from './leaked-bcrypt.js';
import { candidates } from './words.js';

// 사전 10만 개를 다 해 보면 너무 오래 걸린다 — 첫 사람에게 앞의 20개만 해 보고, 걸린 시간으로 전체를 짐작한다.
const TRY = 20;
const [user] = leaked;
const started = performance.now();
let tried = 0;

for (const word of candidates()) {
  if (tried === TRY) break;
  tried += 1;

  if (await bcrypt.compare(word, user.hash)) console.log(`${user.username}의 비밀번호는 ${word}`);
}

const each = (performance.now() - started) / TRY;
const hours = (each * 100000) / 1000 / 60 / 60;

console.log(`${TRY}개를 해 보니 한 번에 ${Math.round(each)}ms 걸렸어요.`);
console.log(`사전 10만 개를 ${user.username} 한 사람에게 다 해 보려면 ${hours.toFixed(1)}시간쯤 걸려요.`);
