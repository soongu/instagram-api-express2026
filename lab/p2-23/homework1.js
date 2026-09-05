// ~/instagram-api/lab/homework1.js
import express from 'express';

const stories = [
  { id: 1, username: 'jaehoon', isViewed: false },
  { id: 2, username: 'minji', isViewed: true },
  { id: 3, username: 'seungwoo', isViewed: false },
];

let nextId = 4;

const app = express();

app.use(express.json());

app.get('/api/stories', (req, res) => {
  res.json(stories);
});

app.post('/api/stories', (req, res) => {
  const { username } = req.body;

  if (!username) {
    res.status(400).json({ message: 'username은 꼭 있어야 해요' });
    return;
  }

  const newStory = {
    ...req.body,
    id: nextId,
    isViewed: false,
  };

  nextId = nextId + 1;
  stories.push(newStory);

  res.status(201).json(newStory);
});

app.delete('/api/stories/:id', (req, res) => {
  const id = Number(req.params.id);
  const index = stories.findIndex((one) => one.id === id);

  if (index === -1) {
    res.status(404).json({ message: '그런 스토리는 없어요' });
    return;
  }

  const deleted = stories[index];
  stories.splice(index, 1);

  res.json(deleted);
});

app.use((req, res) => {
  res.status(404).json({ message: '그런 주소는 없어요' });
});

app.listen(4000, () => {
  console.log('과제 서버가 4000번 포트에서 기다리고 있어요.');
});
