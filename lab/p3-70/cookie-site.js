// ~/instagram-api/lab/p3-70/cookie-site.js
import express from 'express';

// 서버 둘을 한 파일에서 띄운다 - 배포하면 화면(Vercel)과 서버(Render)가 서로 다른 주소에 있는 것을 흉내 낸다.
// 화면은 http://localhost:4076, API 는 http://127.0.0.1:4077 이다. 브라우저는 localhost 와 127.0.0.1 을 다른 사이트로 본다.
const SCREEN = 'http://localhost:4076';

// ── API 서버(127.0.0.1:4077) ──
const api = express();

api.use((req, res, next) => {
  console.log(`API ${req.method} ${req.originalUrl} - 실려 온 쿠키: ${req.headers.cookie ?? '없음'}`);
  // 화면 주소에서 오는 요청에 응답을 읽어도 된다고, 쿠키도 함께 보내도 된다고 알린다(CORS).
  res.set('Access-Control-Allow-Origin', SCREEN);
  res.set('Access-Control-Allow-Credentials', 'true');
  next();
});

// 로그인 - 쿠키를 굽는다. ?sameSite=none 이면 SameSite=None 에 Secure 를 함께 붙인다(None 은 Secure 가 있어야 받아 준다).
api.post('/api/login', (req, res) => {
  const none = req.query.sameSite === 'none';
  res.cookie('token', 'jaehoon', { httpOnly: true, sameSite: none ? 'none' : 'lax', secure: none });
  res.json({ message: `쿠키를 구웠어요(SameSite=${none ? 'None; Secure' : 'Lax'})` });
});

// 나는 누구 - 쿠키가 실려 왔으면 그 값을, 아니면 401.
api.get('/api/me', (req, res) => {
  const token = req.headers.cookie?.match(/(?:^|; )token=([^;]+)/)?.[1];
  if (!token) {
    res.status(401).json({ message: '쿠키가 안 왔어요' });
    return;
  }
  res.json({ username: token });
});

api.listen(4077, '127.0.0.1', () => console.log('API 서버가 http://127.0.0.1:4077 에서 기다리고 있어요'));

// ── 화면 서버(localhost:4076) ──
const screen = express();

screen.use(express.static(new URL('./public', import.meta.url).pathname));

// rewrite 흉내 - /api 로 시작하는 요청은 화면 서버가 받아서 API 서버에 그대로 넘기고, 받은 답을 그대로 돌려준다.
// 브라우저는 화면 서버하고만 주고받으니 쿠키도 화면 주소(localhost:4076)의 쿠키가 된다.
screen.use('/api', async (req, res) => {
  const answer = await fetch(`http://127.0.0.1:4077${req.originalUrl}`, {
    method: req.method,
    headers: req.headers.cookie ? { cookie: req.headers.cookie } : {},
  });
  const setCookie = answer.headers.getSetCookie();
  if (setCookie.length > 0) res.set('Set-Cookie', setCookie);
  res.status(answer.status).type('json').send(await answer.text());
});

screen.listen(4076, () => console.log('화면 서버가 http://localhost:4076 에서 기다리고 있어요'));
