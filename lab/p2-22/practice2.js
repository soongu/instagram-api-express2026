// ~/instagram-api/lab/practice2.js
import express from 'express';

const profiles = [
  { username: 'jaehoon', name: '김재훈', followerCount: 1240 },
  { username: 'minji', name: '이민지', followerCount: 8500 },
  { username: 'seungwoo', name: '박승우', followerCount: 320 },
];

const app = express();

app.get('/api/profiles', (req, res) => {
  res.json(profiles);
});

app.get('/api/profiles/:username', (req, res) => {
  const profile = profiles.find((one) => one.username === req.params.username);

  res.json(profile);
});

app.listen(4000, () => {
  console.log('실습 서버가 4000번 포트에서 기다리고 있어요.');
});
