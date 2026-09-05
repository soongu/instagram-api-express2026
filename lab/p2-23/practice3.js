// ~/instagram-api/lab/practice3.js
import express from 'express';

const books = [
  { id: 1, title: '어린 왕자', author: '생텍쥐페리', stock: 3 },
  { id: 2, title: '데미안', author: '헤르만 헤세', stock: 5 },
  { id: 3, title: '모모', author: '미하엘 엔데', stock: 2 },
];

let nextId = 4;

const app = express();

app.use(express.json());

app.get('/api/books', (req, res) => {
  res.json(books);
});

app.post('/api/books', (req, res) => {
  const { title, author } = req.body;

  if (!title || !author) {
    res.status(400).json({ message: 'title과 author는 꼭 있어야 해요' });
    return;
  }

  const newBook = {
    ...req.body,
    id: nextId,
    stock: 0,
  };

  nextId = nextId + 1;
  books.push(newBook);

  res.status(201).json(newBook);
});

app.patch('/api/books/:id', (req, res) => {
  const id = Number(req.params.id);
  const index = books.findIndex((one) => one.id === id);

  if (index === -1) {
    res.status(404).json({ message: '그런 책은 없어요' });
    return;
  }

  books[index] = { ...books[index], ...req.body, id };

  res.json(books[index]);
});

app.delete('/api/books/:id', (req, res) => {
  const id = Number(req.params.id);
  const index = books.findIndex((one) => one.id === id);

  if (index === -1) {
    res.status(404).json({ message: '그런 책은 없어요' });
    return;
  }

  const deleted = books[index];
  books.splice(index, 1);

  res.json(deleted);
});

app.use((req, res) => {
  res.status(404).json({ message: '그런 주소는 없어요' });
});

app.listen(4000, () => {
  console.log('실습 서버가 4000번 포트에서 기다리고 있어요.');
});
