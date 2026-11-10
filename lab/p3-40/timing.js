// ~/instagram-api/lab/p3-40/timing.js
// 로그인이 실패하는 세 경우를 다섯 번씩 보내고, 응답이 오기까지 걸린 시간의 평균을 나란히 찍는다.
const LOGIN = 'http://localhost:3000/api/v2/auth/login';
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

console.log('없는 사용자 이름    ', await averageMs({ username: 'nobody', password: 'wrong-password' }), 'ms');
console.log('비밀번호가 없는 사람', await averageMs({ username: 'minji', password: 'wrong-password' }), 'ms');
console.log('틀린 비밀번호       ', await averageMs({ username: 'seoyeon', password: 'wrong-password' }), 'ms');
