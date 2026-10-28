// ~/instagram-api/lab/practice2.js
import { createHash } from 'node:crypto';

// PKCE 표준 문서(RFC 7636) 부록 B에 실린 예시 code_verifier
const codeVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';

const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
console.log(codeChallenge);
console.log(codeChallenge === 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');

// 마지막 한 글자만 바꾼 code_verifier
const changed = codeVerifier.slice(0, -1) + 'Y';
console.log(createHash('sha256').update(changed).digest('base64url'));
