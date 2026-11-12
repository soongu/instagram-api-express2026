// ~/instagram-api/lab/p3-43/practice1.js
import express from 'express';

const app = express();

// 실습용 — 로그인은 이미 했다고 치고, 요청을 보낸 사람은 늘 1번 회원이다.
const members = [{ id: 1, username: 'jaehoon', name: '김재훈', bio: '', role: 'USER' }];
const me = () => members[0];

app.use(express.json());

app.get('/me', (req, res) => {
  res.json(me());
});

// 내 정보 고치기 — 보낸 본문을 그대로 덮어쓴다.
app.patch('/me', (req, res) => {
  Object.assign(me(), req.body);
  res.json(me());
});

app.listen(4001, () => {
  console.log('4001번 포트에서 내 정보 서버가 돌아가요');
});
