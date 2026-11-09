// ~/instagram-api/lab/p3-35/homework1.js
import express from 'express';
import { setTimeout as sleep } from 'node:timers/promises';
import { logger } from '../../middlewares/logger.js';

const app = express();

app.use(logger);

// version — 프로필이 바뀔 때마다 1씩 올리는 번호
const profiles = [
  { username: 'jaehoon', name: '김재훈', followerCount: 120, version: 1 },
  { username: 'minji', name: '이민지', followerCount: 85, version: 1 },
];

// 프로필을 응답 모양으로 만든다 — 0.3초 걸리는 일이라고 흉내 낸다.
async function render(profile) {
  await sleep(300);
  console.log(`${profile.username} 프로필을 만들었어요`);
  return { username: profile.username, name: profile.name, followerCount: profile.followerCount };
}

// 프로필은 누가 보든 같다 — 공유 캐시에 둬도 되지만, 쓸 때마다 서버에 확인하게 한다.
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'public, no-cache');
  next();
});

app.get('/api/profiles/:username', async (req, res) => {
  const profile = profiles.find((one) => one.username === req.params.username);
  if (!profile) {
    res.status(404).json({ message: '그런 사람은 없어요' });
    return;
  }

  res.set('ETag', `"${profile.username}-${profile.version}"`);
  if (req.fresh) {
    res.status(304).end();
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
  profile.version += 1;
  res.json({ followerCount: profile.followerCount });
});

app.listen(4011, () => {
  console.log('과제 서버가 4011번 포트에서 기다리고 있어요.');
});
