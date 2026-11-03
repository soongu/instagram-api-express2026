// ~/instagram-api/lab/practice1.js
import express from 'express';

const app = express();

app.get('/me', (req, res) => {
  res.send('홍순구입니다');
});

app.listen(4000, () => {
  console.log('실습 서버가 4000번 포트에서 기다리고 있어요.');
});
