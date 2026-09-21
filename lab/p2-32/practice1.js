// ~/instagram-api/lab/practice1.js
import express from 'express';
import bookRoutes from './bookRoutes.js';
import { HttpError } from '../errors.js';

const app = express();

app.use(express.json());

app.use('/api/books', bookRoutes);

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

app.listen(4000, () => {
  console.log('서점 서버가 4000번 포트에서 기다리고 있어요.');
});
