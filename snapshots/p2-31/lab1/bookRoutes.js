// ~/instagram-api/lab/bookRoutes.js
import express from 'express';
import { bookstore } from './bookstore.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const books = await bookstore.book.findMany({
    where: { author: req.query.author },
    orderBy: { price: 'desc' },
    take: Number(req.query.limit) || undefined,
  });

  res.json(books);
});

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    res.status(404).json({ message: '그런 책은 없어요' });
    return;
  }

  const book = await bookstore.book.findUnique({ where: { id } });

  if (!book) {
    res.status(404).json({ message: '그런 책은 없어요' });
    return;
  }

  res.json(book);
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    res.status(404).json({ message: '그런 책은 없어요' });
    return;
  }

  const deleted = await bookstore.book.delete({ where: { id } });

  res.json(deleted);
});

export default router;
