// ~/instagram-api/lab/p3-42/check-tokens.js
// 수업 서버가 어떤 토큰을 받고 어떤 토큰을 막는지 확인한다 — 서버를 띄운 채 다른 터미널에서 실행한다.
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET;
const URL = 'http://localhost:3000/api/v2/auth/me';

// 우리 서버가 만드는 것과 같은 진짜 토큰 — jaehoon(2번), 1분짜리
const real = jwt.sign({}, SECRET, { subject: '2', expiresIn: 60 });
const [header, payload, signature] = real.split('.');
const encode = (value) =>
  Buffer.from(JSON.stringify(value)).toString('base64url');
const changed = {
  ...JSON.parse(Buffer.from(payload, 'base64url').toString()),
  sub: '1',
};

const tokens = {
  '진짜 토큰': real,
  '페이로드만 바꾼 토큰': `${header}.${encode(changed)}.${signature}`,
  '다른 비밀키로 만든 토큰': jwt.sign({}, 'another-secret', {
    subject: '2',
    expiresIn: 60,
  }),
  '알고리즘을 none으로 바꾼 토큰': `${encode({ alg: 'none', typ: 'JWT' })}.${payload}.`,
  'HS512로 만든 토큰': jwt.sign({}, SECRET, {
    subject: '2',
    expiresIn: 60,
    algorithm: 'HS512',
  }),
  '기한이 지난 토큰': jwt.sign({}, SECRET, { subject: '2', expiresIn: -60 }),
};

for (const [name, token] of Object.entries(tokens)) {
  const response = await fetch(URL, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log(`${response.status} ${name}`);
}
