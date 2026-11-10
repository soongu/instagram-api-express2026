// ~/instagram-api/lab/p3-39/practice1.js
import { createHash, randomBytes } from 'node:crypto';

const sha256 = (text) => createHash('sha256').update(text).digest('hex');

// 가입할 때 — 솔트를 새로 만들어 비밀번호 앞에 붙인 뒤 해시한다.
function hashPassword(password) {
  const salt = ____;

  return { salt, hash: ____ };
}

// 로그인할 때 — 입력한 비밀번호가 저장해 둔 비밀번호와 같은지 알려 준다.
function checkPassword(password, saved) {
  const hash = ____;

  return ____;
}

const saved = hashPassword('qwer1234');

console.log(checkPassword('qwer1234', saved));
console.log(checkPassword('qwer1235', saved));
// 같은 비밀번호를 두 번 해시하면 솔트가 달라서 해시도 달라야 한다.
console.log(hashPassword('qwer1234').hash !== hashPassword('qwer1234').hash);
