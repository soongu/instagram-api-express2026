// ~/instagram-api/lab/practice2.js
import express from 'express';
import mongoose from 'mongoose';
import Book from './Book.js';

const app = express();

app.use(express.json());

await mongoose.connect(process.env.MONGO_URL);
console.log('데이터베이스에 연결됐어요.');

app.get('/api/books', async (req, res) => {
  const books = await Book.find();
  res.json(books);
});

app.get('/api/books/:id', async (req, res) => {
  const book = await Book.findById(req.params.id);

  if (!book) {
    res.status(404).json({ message: '그런 책은 없어요' });
    return;
  }

  res.json(book);
});

app.post('/api/books', async (req, res) => {
  const { title, author } = req.body;

  if (!title || !author) {
    res.status(400).json({ message: 'title과 author는 꼭 있어야 해요' });
    return;
  }

  const newBook = await Book.create({ ...req.body, stock: 0 });

  res.status(201).json(newBook);
});

app.patch('/api/books/:id', async (req, res) => {
  const book = await Book.findByIdAndUpdate(req.params.id, req.body, {
    returnDocument: 'after',
  });

  if (!book) {
    res.status(404).json({ message: '그런 책은 없어요' });
    return;
  }

  res.json(book);
});

app.delete('/api/books/:id', async (req, res) => {
  const deleted = await Book.findByIdAndDelete(req.params.id);

  if (!deleted) {
    res.status(404).json({ message: '그런 책은 없어요' });
    return;
  }

  res.json(deleted);
});

app.use((req, res) => {
  res.status(404).json({ message: '그런 주소는 없어요' });
});

app.use((err, req, res, next) => {
  if (err.name === 'CastError') {
    res.status(404).json({ message: '그런 책은 없어요' });
    return;
  }

  if (err.status) {
    res.status(err.status).json({ message: '보낸 내용을 읽을 수 없어요' });
    return;
  }

  console.error(err);
  res.status(500).json({ message: '서버에서 문제가 생겼어요' });
});

const PORT = process.env.BOOKS_PORT ?? 4000;

app.listen(PORT, () => {
  console.log(`서버가 ${PORT}번 포트에서 기다리고 있어요.`);
});
