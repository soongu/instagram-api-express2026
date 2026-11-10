// ~/instagram-api/lab/p3-39/crack.js
import { createHash } from 'node:crypto';
import { leaked } from './leaked.js';
import { candidates } from './words.js';

const sha256 = (text) => createHash('sha256').update(text).digest('hex');

// 사전의 낱말을 하나씩 해시해서, 샌 해시와 같은 것이 있는지 본다.
const started = performance.now();
let tried = 0;

for (const word of candidates()) {
  tried += 1;
  const hash = sha256(word);

  for (const user of leaked) {
    if (user.hash === hash) console.log(`${user.username}의 비밀번호는 ${word}`);
  }
}

console.log(`${tried}개를 해 보는 데 ${Math.round(performance.now() - started)}ms 걸렸어요.`);
