// ~/instagram-api/lab/homework2.js
import express from 'express';
import cors from 'cors';
import commentRoutes from './commentRoutes.js';
import { HttpError } from '../errors.js';

const app = express();

// 허락할 출처를 코드가 아니라 환경변수에서 읽어 와요.
// 쉼표로 이어 적은 한 줄을 나눠 배열로 만들면, 출처가 몇 개든 값만 바꿔 넣으면 돼요.
const allowedOrigins = process.env.CORS_ORIGIN.split(',').map((one) => one.trim());

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.use('/api/comments', commentRoutes);

app.use((req, res) => {
  res.status(404).json({ message: '그런 주소는 없어요' });
});

app.use((err, req, res, next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ message: err.message });
    return;
  }

  console.error(err);
  res.status(500).json({ message: '서버에서 문제가 생겼어요' });
});

app.listen(4001, () => {
  console.log('댓글 서버가 4001번 포트에서 기다리고 있어요.');
});
