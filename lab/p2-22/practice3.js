// ~/instagram-api/lab/practice3.js
import express from 'express';

const books = [
  { id: 1, title: '어린 왕자' },
  { id: 2, title: '데미안' },
  { id: 3, title: '모모' },
];

const app = express();

app.get('/api/books', (req, res) => {
  res.json(books);
});

app.get('/api/books/:id', (req, res) => {
  const id = Number(req.params.id);
  const book = books.find((one) => one.id === id);

  if (!book) {
    res.status(404).json({ message: '그런 책은 없어요' });
    return;
  }

  res.json(book);
});

app.use((req, res) => {
  res.status(404).json({ message: '그런 주소는 없어요' });
});

app.listen(4000, () => {
  console.log('실습 서버가 4000번 포트에서 기다리고 있어요.');
});
