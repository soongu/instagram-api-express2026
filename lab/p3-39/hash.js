// ~/instagram-api/lab/p3-39/hash.js
import { createHash } from 'node:crypto';

// 글자를 SHA-256 해시로 바꾼다 — 결과는 16진수 64글자다.
const sha256 = (text) => createHash('sha256').update(text).digest('hex');

console.log(sha256('jaehoon1234'));
console.log(sha256('jaehoon1234'));
console.log(sha256('jaehoon1235'));
console.log(sha256('비밀번호가 아무리 길어도 해시의 길이는 같아요'));
