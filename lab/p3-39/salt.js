// ~/instagram-api/lab/p3-39/salt.js
import { createHash, randomBytes } from 'node:crypto';

const sha256 = (text) => createHash('sha256').update(text).digest('hex');

// 가입할 때마다 무작위 16바이트(솔트)를 새로 만들어 비밀번호 앞에 붙인 뒤 해시한다.
// 솔트는 해시와 함께 저장한다 — 로그인할 때 같은 솔트를 붙여 다시 계산해야 하니까.
function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');

  return { salt, hash: sha256(salt + password) };
}

console.log(hashPassword('qwer1234'));
console.log(hashPassword('qwer1234'));
