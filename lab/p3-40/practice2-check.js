// ~/instagram-api/lab/p3-40/practice2-check.js
// 가입한 이메일과 가입하지 않은 이메일로 비밀번호 찾기를 다섯 번씩 보내, 응답과 평균 시간을 나란히 찍는다.
const RESET = 'http://localhost:4002/password-reset';
const TIMES = 5;

async function check(email) {
  let total = 0;
  let last;

  for (let i = 0; i < TIMES; i += 1) {
    const started = performance.now();
    const res = await fetch(RESET, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    last = `${res.status} ${(await res.json()).message}`;
    total += performance.now() - started;
  }

  return `${last} · 평균 ${Math.round(total / TIMES)}ms`;
}

console.log('가입한 이메일       ', await check('bomi@example.com'));
console.log('가입하지 않은 이메일', await check('nobody@example.com'));
