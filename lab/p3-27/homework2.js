// ~/instagram-api/lab/p3-27/homework2.js
import express from 'express';

const app = express();

function assertErrorHandler(handler) {
  if (handler.length !== 4) {
    throw new Error(`에러 미들웨어는 매개변수가 4개여야 해요 (지금은 ${handler.length}개)`);
  }

  return handler;
}

app.use(express.json());

app.post('/api/echo', (req, res) => {
  res.json(req.body);
});

app.use(assertErrorHandler((err, req, res, next) => {
  res.status(err.status ?? 500).json({ message: '보낸 내용을 읽을 수 없어요' });
}));

app.listen(4012, () => {
  console.log('실습 서버가 4012번 포트에서 기다리고 있어요.');
});
