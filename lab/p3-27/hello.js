// ~/instagram-api/lab/p3-27/hello.js
import express from 'express';

const app = express();

function checkName(req, res, next) {
  if (!req.query.name) {
    res.status(400).json({ message: '이름을 보내 주세요' });
    return;
  }

  next();
}

app.get('/api/hello', checkName, (req, res) => {
  res.json({ message: `안녕하세요,${req.query.name}님` });
});

app.listen(4004, () => {
  console.log('실습 서버가 4004번 포트에서 기다리고 있어요.');
});
