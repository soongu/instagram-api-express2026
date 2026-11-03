// ~/instagram-api/lab/practice3.js
import express from 'express';
import mongoose from 'mongoose';
import Book from './Book.js';

const MONGO_URL = 'mongodb+srv://<사용자이름>:<비밀번호>@cluster0.xxxxx.mongodb.net/instagram';

const app = express();

app.use(express.json());

await mongoose.connect(MONGO_URL);
console.log('데이터베이스에 연결됐어요.');

app.get('/api/books', async (req, res) => {
  const books = await Book.find();
  res.json(books);
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

app.listen(4000, () => {
  console.log('서버가 4000번 포트에서 기다리고 있어요.');
});
