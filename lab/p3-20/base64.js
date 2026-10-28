// ~/instagram-api/lab/base64.js
const header = '{"alg":"HS256","typ":"JWT"}';

// 글자를 바이트로 바꾼 다음 Base64URL 글자로 적는다.
const encoded = Buffer.from(header).toString('base64url');
console.log(encoded);

// 거꾸로 — Base64URL 글자를 바이트로 되돌린 다음 다시 글자로 읽는다.
console.log(Buffer.from(encoded, 'base64url').toString());

// 같은 글자를 Base64 와 Base64URL 로 적어 비교한다.
console.log(Buffer.from('{"sub":"2"}').toString('base64'));
console.log(Buffer.from('{"sub":"2"}').toString('base64url'));
console.log(Buffer.from('<<?>>').toString('base64'));
console.log(Buffer.from('<<?>>').toString('base64url'));
