// ~/instagram-api/lab/photo-app.js
import express from 'express';

const AUTH_SERVER = 'http://127.0.0.1:4001';
const CLIENT_ID = 'photo-app';
const CLIENT_SECRET = 'photo-app-secret';
const REDIRECT_URI = 'http://localhost:4002/callback';

const app = express();

app.get('/', (req, res) => {
  res.send('<a href="/login">사진 불러오기</a>');
});

// 인가 서버의 동의 화면으로 보낸다 — 무엇을 허락받고 싶은지 주소에 담아서
app.get('/login', (req, res) => {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: 'photos',
  });
  res.redirect(`${AUTH_SERVER}/authorize?${params}`);
});

app.get('/callback', async (req, res) => {
  if (req.query.error) {
    res.status(400).json({ message: `허락을 받지 못했어요 (${req.query.error})` });
    return;
  }

  // 인가 코드를 토큰으로 바꾼다 — 브라우저를 거치지 않고 서버끼리 주고받는다.
  const tokenRes = await fetch(`${AUTH_SERVER}/token`, {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: req.query.code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });
  const tokens = await tokenRes.json();
  console.log(tokens); // 확인용 — 실제 서비스에서는 토큰을 로그에 남기지 않는다.

  if (!tokenRes.ok) {
    res.status(400).json(tokens);
    return;
  }

  // Access 토큰으로 사진 목록을 받는다.
  const photosRes = await fetch(`${AUTH_SERVER}/photos`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const { photos } = await photosRes.json();

  res.json({ photos });
});

app.listen(4002, () => {
  console.log('우리 서비스가 4002번 포트에서 기다리고 있어요.');
});
