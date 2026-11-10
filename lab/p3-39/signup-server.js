// ~/instagram-api/lab/p3-39/signup-server.js
import express from 'express';
import bcrypt from 'bcrypt';

const app = express();
const COST = 12;

app.use(express.json());

// 아무 일도 안 하고 바로 답한다 — 서버가 다른 요청을 받을 수 있는지 보는 용도.
app.get('/ping', (req, res) => {
  res.json({ ok: true });
});

// hashSync 는 해시가 끝날 때까지 이 줄에서 멈춘다.
app.post('/signup-sync', (req, res) => {
  const hash = bcrypt.hashSync(req.body.password, COST);

  res.json({ hash });
});

// hash 는 계산을 다른 스레드에 맡기고, 끝나면 이어서 응답한다.
app.post('/signup', async (req, res) => {
  const hash = await bcrypt.hash(req.body.password, COST);

  res.json({ hash });
});

app.listen(4003, () => {
  console.log('4003번 포트에서 가입 실습 서버가 돌아가요');
});
