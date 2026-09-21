// ~/instagram-api/lab/bookRoutes.js
import express from 'express';
import * as bookService from './bookService.js';

const router = express.Router();

function parseId(req, res, next) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    res.status(404).json({ message: '그런 책은 없어요' });
    return;
  }

  req.bookId = id;
  next();
}

router.get('/', async (req, res) => {
  const books = await bookService.getBooks({
    author: req.query.author,
    limit: Number(req.query.limit) || undefined,
  });

  res.json(books);
});

router.get('/:id', parseId, async (req, res) => {
  const book = await bookService.getBook(req.bookId);

  if (!book) {
    res.status(404).json({ message: '그런 책은 없어요' });
    return;
  }

  res.json(book);
});

router.delete('/:id', parseId, async (req, res) => {
  const deleted = await bookService.removeBook(req.bookId);

  if (!deleted) {
    res.status(404).json({ message: '그런 책은 없어요' });
    return;
  }

  res.json(deleted);
});

export default router;
