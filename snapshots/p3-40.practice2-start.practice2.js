// ~/instagram-api/lab/p3-40/practice2.js
import express from 'express';
import { setTimeout as sleep } from 'node:timers/promises';

const app = express();

const members = [{ email: 'bomi@example.com' }];

// 비밀번호를 다시 정하는 메일을 보낸다 — 진짜 메일 대신 메일 서비스에 다녀오는 시간만큼 기다린다.
async function sendResetMail(email) {
  await sleep(300);
  console.log(`${email} 주소로 비밀번호를 다시 정하는 메일을 보냈어요`);
}

app.use(express.json());

app.post('/password-reset', async (req, res) => {
  const member = members.find((m) => m.email === req.body.email);

  if (!member) {
    return res.status(404).json({ message: '그 이메일로 가입한 사람은 없어요' });
  }

  await sendResetMail(member.email);
  res.json({ message: '비밀번호를 다시 정하는 메일을 보냈어요' });
});

app.listen(4002, () => {
  console.log('4002번 포트에서 비밀번호 찾기 서버가 돌아가요');
});
