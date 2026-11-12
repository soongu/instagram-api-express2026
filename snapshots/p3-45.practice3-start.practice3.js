// ~/instagram-api/lab/p3-45/practice3.js
const SITE = 'http://localhost:3001';

// 로그인한 뒤 돌아갈 주소로 써도 되는 값인가 — 우리 화면 안의 주소일 때만 true.
function isSafe(next) {
  return typeof next === 'string' && next.startsWith('/');
}

const values = [
  '/jaehoon',
  '/jaehoon/saved?tab=1',
  'https://evil.example/login',
  '//evil.example/login',
  '/\\evil.example/login',
  'javascript:alert(1)',
  'https://localhost:3001/jaehoon',
  undefined, // 주소에 ?next= 가 없을 때 req.query.next 의 값
];

for (const next of values) {
  // 브라우저가 이 값을 Location 으로 받으면 실제로 가게 되는 주소
  const goes = URL.canParse(next, SITE) ? new URL(next, SITE).href : '(주소가 아니에요)';

  console.log(`${isSafe(next) ? '통과' : '거절'}  ${next}  →  ${goes}`);
}
