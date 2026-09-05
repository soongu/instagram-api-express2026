// ~/instagram-api/lab/practice1.js
import express from 'express';

const comments = [
  { id: 1, postId: 1, username: 'minji', text: '노을 진짜 예쁘네요' },
  { id: 2, postId: 1, username: 'seungwoo', text: '저도 어제 갔었어요' },
  { id: 3, postId: 2, username: 'jaehoon', text: '이 카페 어디예요?' },
];

let nextId = 4;

const app = express();

app.use(express.json());

app.get('/api/comments', (req, res) => {
  res.json(comments);
});

app.post('/api/comments', (req, res) => {
  const newComment = {
    ...req.body,
    id: nextId,
  };

  nextId = nextId + 1;
  comments.push(newComment);

  res.status(201).json(newComment);
});

app.use((req, res) => {
  res.status(404).json({ message: '그런 주소는 없어요' });
});

app.listen(4000, () => {
  console.log('실습 서버가 4000번 포트에서 기다리고 있어요.');
});
