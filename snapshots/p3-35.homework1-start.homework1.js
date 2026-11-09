// ~/instagram-api/lab/p3-35/homework1.js
import express from 'express';
import { setTimeout as sleep } from 'node:timers/promises';
import { logger } from '../../middlewares/logger.js';

const app = express();

app.use(logger);

const profiles = [
  { username: 'jaehoon', name: '김재훈', followerCount: 120 },
  { username: 'minji', name: '이민지', followerCount: 85 },
];

// 프로필을 응답 모양으로 만든다 — 0.3초 걸리는 일이라고 흉내 낸다.
async function render(profile) {
  await sleep(300);
  console.log(`${profile.username} 프로필을 만들었어요`);
  return { username: profile.username, name: profile.name, followerCount: profile.followerCount };
}

app.get('/api/profiles/:username', async (req, res) => {
  const profile = profiles.find((one) => one.username === req.params.username);
  if (!profile) {
    res.status(404).json({ message: '그런 사람은 없어요' });
    return;
  }

  res.json(await render(profile));
});

app.post('/api/profiles/:username/follow', (req, res) => {
  const profile = profiles.find((one) => one.username === req.params.username);
  if (!profile) {
    res.status(404).json({ message: '그런 사람은 없어요' });
    return;
  }

  profile.followerCount += 1;
  res.json({ followerCount: profile.followerCount });
});

app.listen(4011, () => {
  console.log('과제 서버가 4011번 포트에서 기다리고 있어요.');
});
