// 내부 검증 전용 — 실습3 토글의 «app.use 를 맨 위로 옮긴» 판이다.
// 교안이 「네 요청이 전부 그런 주소는 없어요로 나와요」라고 주장하는 그 상태.
import express from 'express';

const books = [
  { id: 1, title: '어린 왕자' },
  { id: 2, title: '데미안' },
  { id: 3, title: '모모' },
];

const app = express();

app.use((req, res) => {
  res.status(404).json({ message: '그런 주소는 없어요' });
});

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

app.listen(4000, () => {
  console.log('실습 서버가 4000번 포트에서 기다리고 있어요.');
});
