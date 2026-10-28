// ~/instagram-api/lab/homework2.js
import { createHmac } from 'node:crypto';
import jwt from 'jsonwebtoken';

const SECRET = 'my-lab-secret';

// jsonwebtoken 없이 서명이 맞는지 확인한다 — 헤더.페이로드 로 서명을 다시 계산해 비교한다.
function checkSignature(token, secret) {
  const [header, payload, signature] = token.split('.');
  const expected = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return expected === signature;
}

const token = jwt.sign({ sub: '2' }, SECRET);

// 페이로드만 바꾼 가짜 토큰과, 다른 비밀키로 만든 토큰
const parts = token.split('.');
const fakeToken = `${parts[0]}.${Buffer.from('{"sub":"1"}').toString('base64url')}.${parts[2]}`;
const otherToken = jwt.sign({ sub: '2' }, 'another-secret');

console.log(checkSignature(token, SECRET));
console.log(checkSignature(fakeToken, SECRET));
console.log(checkSignature(otherToken, SECRET));
