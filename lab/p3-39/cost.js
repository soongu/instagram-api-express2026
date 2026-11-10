// ~/instagram-api/lab/p3-39/cost.js
import bcrypt from 'bcrypt';

// cost 를 하나씩 올리며 해시 한 번에 걸리는 시간을 잰다.
for (const cost of [8, 10, 12, 14]) {
  const started = performance.now();
  const hash = await bcrypt.hash('qwer1234', cost);

  console.log(`cost ${cost}: ${Math.round(performance.now() - started)}ms  ${hash}`);
}
