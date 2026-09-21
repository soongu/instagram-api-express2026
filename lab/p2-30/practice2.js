// ~/instagram-api/lab/practice2.js
import express from 'express';
import { bookstore } from './bookstore.js';

const app = express();

app.use(express.json());

app.get('/api/books', async (req, res) => {
  const books = await bookstore.book.findMany({
    where: { author: req.query.author },
    orderBy: { price: 'desc' },
    take: Number(req.query.limit) || undefined,
  });

  res.json(books);
});

app.listen(4000, () => {
  console.log('서점 서버가 4000번 포트에서 기다리고 있어요.');
});
