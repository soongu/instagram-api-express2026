// ~/instagram-api/lab/p3-19/practice1.js
import express from 'express';
import cookieParser from 'cookie-parser';

const app = express();

app.use(cookieParser());

app.get('/', (req, res) => {
  // 처음 오면 visits 쿠키가 없다 — 그때는 0번 왔던 것으로 친다.
  const before = Number(req.cookies.visits) || 0;
  const visits = before + 1;

  res.cookie('visits', String(visits));
  res.send(`${visits}번째 방문이에요`);
});

app.listen(4001, () => {
  console.log('실습 서버가 4001번 포트에서 기다리고 있어요.');
});
