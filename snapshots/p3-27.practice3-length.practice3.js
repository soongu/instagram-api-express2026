// ~/instagram-api/lab/p3-27/practice3.js
import express from 'express';

const app = express();

app.use(express.json());

app.post('/api/echo', (req, res) => {
  res.json(req.body);
});

// 에러 미들웨어가 불릴 때마다 터미널에 한 줄 남기려고 감싼다
function withLog(handler) {
  return (...args) => {
    console.log('에러 미들웨어에 들어왔어요');
    handler(...args);
  };
}

const wrapped = withLog((err, req, res, next) => {
  res.status(err.status ?? 500).json({ message: '보낸 내용을 읽을 수 없어요' });
});

console.log(wrapped.length);
app.use(wrapped);

app.listen(4003, () => {
  console.log('실습 서버가 4003번 포트에서 기다리고 있어요.');
});
