// ~/instagram-api/lab/p3-44/practice1.js
import express from 'express';
import cookieParser from 'cookie-parser';

const app = express();

app.use(cookieParser());

// 실습용 — 비밀번호 없이 로그인하면 쿠키 둘을 준다(값은 흉내만 낸다).
app.post('/login', (req, res) => {
  res.cookie('labAccess', 'access-1', { httpOnly: true, sameSite: 'lax' });
  res.cookie('labRefresh', 'refresh-1', { httpOnly: true, sameSite: 'lax' });
  res.json({ message: '로그인했어요' });
});

// 요청에 어떤 쿠키가 실려 왔는지 이름만 돌려준다.
// 같은 localhost 의 수업 백엔드가 준 쿠키(accessToken 등)도 함께 실려 오니, 이 실습이 준 lab 쿠키만 보여 준다.
function showCookies(req, res) {
  res.json({ cookies: Object.keys(req.cookies).filter((name) => name.startsWith('lab')) });
}

app.get('/posts', showCookies);
app.get('/authors', showCookies);
app.post('/auth/refresh', showCookies);

app.post('/auth/logout', (req, res) => {
  res.clearCookie('labAccess');
  res.clearCookie('labRefresh');
  res.json({ message: '로그아웃했어요' });
});

app.listen(4001, () => {
  console.log('4001번 포트에서 쿠키 경로 실습 서버가 돌아가요');
});
