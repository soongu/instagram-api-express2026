// 내부 검증 전용 — 실습 2 해설의 «주소 순서를 바꿔보세요» 판이다.
// `/api/profiles/:username` 을 위에, `/api/profiles` 를 아래에 둔다.
import express from 'express';

const profiles = [
  { username: 'jaehoon', name: '김재훈', followerCount: 1240 },
  { username: 'minji', name: '이민지', followerCount: 8500 },
  { username: 'seungwoo', name: '박승우', followerCount: 320 },
];

const app = express();

app.get('/api/profiles/:username', (req, res) => {
  const profile = profiles.find((one) => one.username === req.params.username);

  res.json(profile);
});

app.get('/api/profiles', (req, res) => {
  res.json(profiles);
});

app.listen(4000, () => {
  console.log('실습 서버가 4000번 포트에서 기다리고 있어요.');
});
