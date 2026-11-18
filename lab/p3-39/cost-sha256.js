// ~/instagram-api/lab/p3-39/cost-sha256.js
import { createHash } from 'node:crypto';
import { samplePasswords } from './words.js';

const sha256 = (text) => createHash('sha256').update(text).digest('hex');

// 예시 비밀번호 10만 개를 SHA-256 으로 한 번씩 해시하는 데 걸리는 시간.
const started = performance.now();
let count = 0;

for (const password of samplePasswords()) {
  sha256(password);
  count += 1;
}

console.log(
  `SHA-256으로${count}번 해시하는 데${Math.round(performance.now() - started)}ms 걸렸어요.`,
);
