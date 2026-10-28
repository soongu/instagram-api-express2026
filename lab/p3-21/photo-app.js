// ~/instagram-api/lab/photo-app.js
import express from 'express';

const AUTH_SERVER = 'http://127.0.0.1:4001';
const CLIENT_ID = 'photo-app';
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

app.get('/callback', (req, res) => {
  if (req.query.error) {
    res.status(400).json({ message: `허락을 받지 못했어요 (${req.query.error})` });
    return;
  }
  res.json({ code: req.query.code });
});

app.listen(4002, () => {
  console.log('우리 서비스가 4002번 포트에서 기다리고 있어요.');
});
