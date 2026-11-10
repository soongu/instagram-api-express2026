// ~/instagram-api/lab/p3-40/homework1-timing.js
// 동아리 서버의 로그인 실패 두 가지를 다섯 번씩 보내고, 응답이 오기까지 걸린 시간의 평균을 나란히 찍는다.
const LOGIN = 'http://localhost:4011/login';
const TIMES = 5;

async function averageMs(body) {
  let total = 0;

  for (let i = 0; i < TIMES; i += 1) {
    const started = performance.now();
    const res = await fetch(LOGIN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    await res.text();
    total += performance.now() - started;
  }

  return Math.round(total / TIMES);
}

console.log('가입하지 않은 이메일', await averageMs({ email: 'nobody@example.com', password: 'wrong-password' }), 'ms');
console.log('틀린 비밀번호       ', await averageMs({ email: 'bomi@example.com', password: 'wrong-password' }), 'ms');
