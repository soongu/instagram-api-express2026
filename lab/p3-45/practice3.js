// ~/instagram-api/lab/p3-45/practice3.js
const SITE = 'http://localhost:3001';

// 로그인한 뒤 돌아갈 주소로 써도 되는 값인가 — 우리 화면 안의 주소일 때만 true.
function isSafe(next) {
  if (typeof next !== 'string' || !URL.canParse(next, SITE)) return false;

  return new URL(next, SITE).origin === SITE;
}

const values = ['/jaehoon', '/jaehoon/saved?tab=1', 'https://evil.example/login', '//evil.example/login', '/\\evil.example/login', 'javascript:alert(1)'];

for (const next of values) {
  // 브라우저가 이 값을 Location 으로 받으면 실제로 가게 되는 주소
  const goes = URL.canParse(next, SITE) ? new URL(next, SITE).href : '(주소가 아니에요)';

  console.log(`${isSafe(next) ? '통과' : '거절'}  ${next}  →  ${goes}`);
}
