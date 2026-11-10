// ~/instagram-api/lab/p3-39/homework2.js
import { createHash } from 'node:crypto';
import bcrypt from 'bcrypt';
import { leaked as plain } from './leaked.js';
import { leaked as salted } from './leaked-salted.js';
import { leaked as hashed } from './leaked-bcrypt.js';
import { candidates } from './words.js';

const sha256 = (text) => createHash('sha256').update(text).digest('hex');
const words = [...candidates()];

// 시간(ms)을 읽기 좋은 단위로 바꾼다.
const readable = (ms) => (ms < 1000 ? `${Math.round(ms)}ms` : ms < 3600000 ? `${(ms / 1000).toFixed(1)}초` : `${(ms / 3600000).toFixed(1)}시간`);

// 솔트가 없으면 낱말마다 한 번만 해시해서 모두와 비교할 수 있다 — 사람 수가 늘어도 시간은 그대로다.
let started = performance.now();
const plainHashes = new Set(plain.map((user) => user.hash));
for (const word of words) plainHashes.has(sha256(word));
const plainMs = performance.now() - started;

// 솔트가 있으면 사람마다 사전 전체를 다시 해시해야 한다.
started = performance.now();
for (const word of words) sha256(salted[0].salt + word);
const saltedMs = performance.now() - started;

// bcrypt 는 20개만 해 보고 사전 전체로 늘려 짐작한다.
started = performance.now();
for (const word of words.slice(0, 20)) await bcrypt.compare(word, hashed[0].hash);
const bcryptMs = ((performance.now() - started) / 20) * words.length;

console.log(`솔트 없는 SHA-256 — 한 사람 ${readable(plainMs)} · 다섯 사람 ${readable(plainMs)}`);
console.log(`솔트 + SHA-256 — 한 사람 ${readable(saltedMs)} · 다섯 사람 ${readable(saltedMs * salted.length)}`);
console.log(`bcrypt cost 12 — 한 사람 ${readable(bcryptMs)} · 다섯 사람 ${readable(bcryptMs * hashed.length)}`);
