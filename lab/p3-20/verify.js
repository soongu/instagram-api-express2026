// ~/instagram-api/lab/p3-20/verify.js
import jwt from 'jsonwebtoken';

const SECRET = '66LkcdVrWD0gdEdpk9omky54Og71Mazxo2fLq0emll8';

const token = jwt.sign({ sub: '2' }, SECRET);

// 서명이 맞으면 페이로드를 객체로 돌려준다.
console.log(jwt.verify(token, SECRET));

// 페이로드만 sub 가 '1' 인 것으로 바꾼 가짜 토큰 — 헤더와 서명은 진짜 토큰 것 그대로
const [header, payload, signature] = token.split('.');
const fakePayload = Buffer.from('{"sub":"1"}').toString('base64url');
const fakeToken = `${header}.${fakePayload}.${signature}`;

// 서명을 확인하지 않고 페이로드만 꺼내면
console.log(jwt.decode(fakeToken));

// 서명을 확인하면
try {
  jwt.verify(fakeToken, SECRET);
} catch (error) {
  console.log(error.message);
}

// 진짜 토큰이라도 다른 비밀키로 확인하면
try {
  jwt.verify(token, 'another-secret');
} catch (error) {
  console.log(error.message);
}
