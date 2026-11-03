// ~/instagram-api/lab/homework2.js
import express from 'express';

const posts = [
  { id: 1, username: 'jaehoon', likeCount: 1240 },
  { id: 2, username: 'minji', likeCount: 87 },
];

const app = express();

app.use(express.json());

app.get('/api/posts', (req, res) => {
  res.json(posts);
});

app.patch('/api/posts/:id', (req, res) => {
  const id = Number(req.params.id);
  const index = posts.findIndex((one) => one.id === id);

  if (index === -1) {
    res.status(404).json({ message: '그런 게시물은 없어요' });
    return;
  }

  posts[index] = { ...posts[index], ...req.body, id };

  res.json(posts[index]);
});

app.post('/api/posts/:id/likes', (req, res) => {
  const id = Number(req.params.id);
  const index = posts.findIndex((one) => one.id === id);

  if (index === -1) {
    res.status(404).json({ message: '그런 게시물은 없어요' });
    return;
  }

  posts[index].likeCount = posts[index].likeCount + 1;

  res.json(posts[index]);
});

app.use((req, res) => {
  res.status(404).json({ message: '그런 주소는 없어요' });
});

app.listen(4000, () => {
  console.log('과제 서버가 4000번 포트에서 기다리고 있어요.');
});
