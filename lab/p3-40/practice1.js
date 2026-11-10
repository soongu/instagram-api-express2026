// ~/instagram-api/lab/p3-40/practice1.js
import express from 'express';
import bcrypt from 'bcrypt';

const app = express();
const COST = 12;

// 회원 — 서버가 뜰 때 비밀번호를 해시로 바꿔 넣어 둔다. 메모리에만 두니 서버를 다시 켜면 처음으로 돌아간다.
const members = [
  { email: 'bomi@example.com', passwordHash: await bcrypt.hash('club2026!', COST) },
];

app.use(express.json());

// 로그인 — 바꾼 비밀번호로 확인해 볼 때 쓴다.
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const member = members.find((m) => m.email === email);

  if (!member || !(await bcrypt.compare(password, member.passwordHash))) {
    return res.status(401).json({ message: '이메일이나 비밀번호가 맞지 않아요' });
  }

  res.json({ email });
});

// 비밀번호 바꾸기 — 지금 비밀번호가 맞을 때만 새 비밀번호로 바꾼다.
app.patch('/members/:email/password', async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const member = members.find((m) => m.email === req.params.email);

  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({ message: '새 비밀번호는 8자 이상이어야 해요' });
  }
  if (!member || !(await bcrypt.compare(currentPassword, member.passwordHash))) {
    return res.status(401).json({ message: '지금 비밀번호가 맞지 않아요' });
  }

  member.passwordHash = await bcrypt.hash(newPassword, COST);

  res.json({ message: '비밀번호를 바꿨어요' });
});

app.listen(4001, () => {
  console.log('4001번 포트에서 동아리 서버가 돌아가요');
});
