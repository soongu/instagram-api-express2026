// ~/instagram-api/lab/p3-20/token.js
import jwt from 'jsonwebtoken';

// 실습용 비밀키 — 실제 서버에서는 코드에 적지 않고 환경 변수에 둔다.
const SECRET = 'my-lab-secret';

const token = jwt.sign({ sub: '2' }, SECRET);
console.log(token);

const [header, payload, signature] = token.split('.');
console.log(Buffer.from(header, 'base64url').toString());
console.log(Buffer.from(payload, 'base64url').toString());
console.log(signature);
