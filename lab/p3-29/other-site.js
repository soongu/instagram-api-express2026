// ~/instagram-api/lab/p3-29/other-site.js
import express from 'express';

const app = express();

// 다른 사이트라고 생각한다 — 우리 공지를 <iframe> 안에 띄운다
app.get('/', (req, res) => {
  res.send(`
    <h1>다른 사이트</h1>
    <iframe src="http://localhost:4006/api/notices/1" width="500" height="200"></iframe>
  `);
});

app.listen(4008, () => {
  console.log('다른 사이트가 4008번 포트에서 기다리고 있어요.');
});
