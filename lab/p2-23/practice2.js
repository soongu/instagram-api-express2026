// ~/instagram-api/lab/practice2.js
import express from 'express';

const profiles = [
  { username: 'jaehoon', name: '김재훈', bio: '한강 러너', followerCount: 1240 },
  { username: 'minji', name: '이민지', bio: '카페 투어 중', followerCount: 8500 },
  { username: 'seungwoo', name: '박승우', bio: '주말엔 농구', followerCount: 320 },
];

const app = express();

app.use(express.json());

app.patch('/api/profiles/:username', (req, res) => {
  const username = req.params.username;
  const index = profiles.findIndex((one) => one.username === username);

  if (index === -1) {
    res.status(404).json({ message: '그런 프로필은 없어요' });
    return;
  }

  profiles[index] = { ...profiles[index], ...req.body, username };

  res.json(profiles[index]);
});

app.use((req, res) => {
  res.status(404).json({ message: '그런 주소는 없어요' });
});

app.listen(4000, () => {
  console.log('실습 서버가 4000번 포트에서 기다리고 있어요.');
});
