// ~/instagram-api/lab/p3-39/crack-salted.js
import { createHash } from 'node:crypto';
import { leaked } from './leaked-salted.js';
import { candidates } from './words.js';

const sha256 = (text) => createHash('sha256').update(text).digest('hex');

// 솔트가 사람마다 다르니, 한 번 계산한 해시를 모두와 비교할 수 없다 — 사람마다 사전을 처음부터 다시 해 본다.
const started = performance.now();
let tried = 0;

for (const user of leaked) {
  for (const word of candidates()) {
    tried += 1;

    if (sha256(user.salt + word) === user.hash) console.log(`${user.username}의 비밀번호는 ${word}`);
  }
}

console.log(`${tried}개를 해 보는 데 ${Math.round(performance.now() - started)}ms 걸렸어요.`);
