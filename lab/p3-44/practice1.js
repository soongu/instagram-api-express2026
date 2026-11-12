// ~/instagram-api/lab/p3-44/practice1.js
import express from 'express';
import cookieParser from 'cookie-parser';

const app = express();

app.use(cookieParser());

// 실습용 — 비밀번호 없이 로그인하면 쿠키 둘을 준다(값은 흉내만 낸다).
app.post('/login', (req, res) => {
  res.cookie('labAccess', 'access-1', { httpOnly: true, sameSite: 'lax' });
  // Refresh 쿠키는 /auth 로 시작하는 주소에만 실려 가게 path 를 좁힌다.
  res.cookie('labRefresh', 'refresh-1', { httpOnly: true, sameSite: 'lax', path: '/auth' });
  res.json({ message: '로그인했어요' });
});

// 요청에 실려 온 쿠키 가운데 이 실습이 준 lab 쿠키의 이름만 고른다.
// 같은 localhost 의 수업 백엔드가 준 쿠키(accessToken 등)도 함께 실려 오니, lab 으로 시작하는 것만 본다.
function labCookies(req) {
  return Object.keys(req.cookies).filter((name) => name.startsWith('lab'));
}

// 요청에 어떤 쿠키가 실려 왔는지 이름만 돌려준다.
function showCookies(req, res) {
  res.json({ cookies: labCookies(req) });
}

app.get('/posts', showCookies);
app.get('/authors', showCookies);
app.post('/auth/refresh', showCookies);

// 로그아웃 — 쿠키 둘을 지우라고 알리고, 이 요청에 실려 온 쿠키도 함께 돌려준다.
app.post('/auth/logout', (req, res) => {
  res.clearCookie('labAccess');
  // 쿠키는 이름과 path 가 같아야 같은 쿠키다 — 만들 때 준 path 를 지울 때도 적는다.
  res.clearCookie('labRefresh', { path: '/auth' });
  res.json({ message: '로그아웃했어요', cookies: labCookies(req) });
});

app.listen(4001, () => {
  console.log('4001번 포트에서 쿠키 경로 실습 서버가 돌아가요');
});
