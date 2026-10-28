// ~/instagram-api/lab/practice2.js
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3IiwidXNlcm5hbWUiOiJoYW5hIiwiZW1haWwiOiJoYW5hQGV4YW1wbGUuY29tIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzkzMTQ1NjAwLCJleHAiOjE3OTMxNDY1MDB9.7PPaKRyf__0aYK_jI4_Hnrl2BAFzFfGr1fW6Gi2xtiE';

const [header, payload] = token.split('.');
console.log(Buffer.from(header, 'base64url').toString());

const payloadText = Buffer.from(payload, 'base64url').toString();
console.log(payloadText);

// exp 는 1970년 1월 1일부터 센 «초» 라서, 1000 을 곱해 밀리초로 바꾼 다음 날짜로 만든다.
const { exp } = JSON.parse(payloadText);
console.log(new Date(exp * 1000));
