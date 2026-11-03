// ~/instagram-api/lab/homework1.js
import express from 'express';

const stories = [
  { id: 1, username: 'jaehoon', isViewed: false },
  { id: 2, username: 'minji', isViewed: true },
  { id: 3, username: 'seungwoo', isViewed: false },
  { id: 4, username: 'yuna', isViewed: true },
];

const app = express();

app.get('/api/stories', (req, res) => {
  res.json(stories);
});

app.get('/api/stories/:id', (req, res) => {
  const id = Number(req.params.id);
  const story = stories.find((one) => one.id === id);

  if (!story) {
    res.status(404).json({ message: '그런 스토리는 없어요' });
    return;
  }

  res.json(story);
});

app.use((req, res) => {
  res.status(404).json({ message: '그런 주소는 없어요' });
});

app.listen(4000, () => {
  console.log('과제 서버가 4000번 포트에서 기다리고 있어요.');
});
