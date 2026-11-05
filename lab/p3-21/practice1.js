// ~/instagram-api/lab/p3-21/practice1.js
import express from 'express';

const AUTH_SERVER = 'http://127.0.0.1:4001';
const CLIENT_ID = 'story-app';
const REDIRECT_URI = 'http://localhost:4003/callback';

const app = express();

app.get('/', (req, res) => {
  res.send('<a href="/login">스토리에 쓸 사진 고르기</a>');
});

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

app.listen(4003, () => {
  console.log('스토리 앱이 4003번 포트에서 기다리고 있어요.');
});
