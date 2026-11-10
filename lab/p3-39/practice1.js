// ~/instagram-api/lab/p3-39/practice1.js
import { createHash, randomBytes } from 'node:crypto';

const sha256 = (text) => createHash('sha256').update(text).digest('hex');

// 가입할 때 — 솔트를 새로 만들어 비밀번호 앞에 붙인 뒤 해시한다.
function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');

  return { salt, hash: sha256(salt + password) };
}

// 로그인할 때 — 입력한 비밀번호가 저장해 둔 비밀번호와 같은지 알려 준다.
function checkPassword(password, saved) {
  const hash = sha256(saved.salt + password);

  return hash === saved.hash;
}

const saved = hashPassword('qwer1234');

console.log(checkPassword('qwer1234', saved));
console.log(checkPassword('qwer1235', saved));
console.log(checkPassword('qwer1234', hashPassword('qwer1234')));
