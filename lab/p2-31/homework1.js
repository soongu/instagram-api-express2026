// ~/instagram-api/lab/homework1.js
import express from 'express';
import commentRoutes from './commentRoutes.js';

const app = express();

app.use(express.json());

app.use('/api/comments', commentRoutes);

app.use((req, res) => {
  res.status(404).json({ message: '그런 주소는 없어요' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: '서버에서 문제가 생겼어요' });
});

app.listen(4001, () => {
  console.log('댓글 서버가 4001번 포트에서 기다리고 있어요.');
});
