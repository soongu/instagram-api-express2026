// ~/instagram-api/lab/p3-39/cost-salted.js
import { createHash } from 'node:crypto';
import { users } from './users-salted.js';
import { samplePasswords } from './words.js';

const sha256 = (text) => createHash('sha256').update(text).digest('hex');

// 솔트가 사람마다 다르니, 같은 예시 10만 개라도 사람마다 그 솔트를 붙여 따로 해시해야 한다.
const started = performance.now();
let count = 0;

for (const user of users) {
  for (const password of samplePasswords()) {
    sha256(user.salt + password);
    count += 1;
  }
}

console.log(`${users.length}명의 솔트를 붙여 ${count}번 해시하는 데 ${Math.round(performance.now() - started)}ms 걸렸어요.`);
