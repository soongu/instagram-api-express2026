// ~/instagram-api/lab/p3-39/homework2.js
import { createHash } from 'node:crypto';
import bcrypt from 'bcrypt';
import { users as salted } from './users-salted.js';
import { samplePasswords } from './words.js';

const sha256 = (text) => createHash('sha256').update(text).digest('hex');
const passwords = [...samplePasswords()];

// 시간(ms)을 읽기 좋은 단위로 바꾼다.
const readable = (ms) => (ms < 1000 ? `${Math.round(ms)}ms` : ms < 3600000 ? `${(ms / 1000).toFixed(1)}초` : `${(ms / 3600000).toFixed(1)}시간`);

// 솔트가 없으면 같은 비밀번호의 해시는 누구에게나 같다 — 한 번 계산한 10만 개를 다섯 사람 모두에게 쓸 수 있다.
let started = performance.now();
for (const password of passwords) sha256(password);
const plainMs = performance.now() - started;

// 솔트가 있으면 사람마다 그 솔트를 붙여 10만 번을 다시 계산해야 한다.
started = performance.now();
for (const password of passwords) sha256(salted[0].salt + password);
const saltedMs = performance.now() - started;

// bcrypt 는 20번만 해시해 보고 10만 번으로 늘려 짐작한다. 솔트가 해시 안에 들어 있어 이것도 사람마다 따로다.
started = performance.now();
for (const password of passwords.slice(0, 20)) await bcrypt.hash(password, 12);
const bcryptMs = ((performance.now() - started) / 20) * passwords.length;

console.log(`솔트 없는 SHA-256 — 한 사람 ${readable(plainMs)} · 다섯 사람 ${readable(plainMs)}`);
console.log(`솔트 + SHA-256 — 한 사람 ${readable(saltedMs)} · 다섯 사람 ${readable(saltedMs * salted.length)}`);
console.log(`bcrypt cost 12 — 한 사람 ${readable(bcryptMs)} · 다섯 사람 ${readable(bcryptMs * salted.length)}`);
