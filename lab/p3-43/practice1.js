// ~/instagram-api/lab/p3-43/practice1.js
import express from 'express';
import { z } from 'zod';

const app = express();

// 실습용 — 로그인은 이미 했다고 치고, 요청을 보낸 사람은 늘 1번 회원이다.
const members = [{ id: 1, username: 'jaehoon', name: '김재훈', bio: '', role: 'USER' }];
const me = () => members[0];

// 내 정보에서 고칠 수 있는 필드만 적는다 — 여기에 없는 필드(role 등)는 보내도 버려진다.
const profileSchema = z.object({
  name: z.string().min(1).max(30),
  bio: z.string().max(150).optional(),
});

app.use(express.json());

app.get('/me', (req, res) => {
  res.json(me());
});

// 내 정보 고치기 — 검사를 통과한 필드만 덮어쓴다.
app.patch('/me', (req, res) => {
  const result = profileSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({ message: '보낸 내용이 규칙에 안 맞아요' });
  }

  Object.assign(me(), result.data);
  res.json(me());
});

app.listen(4001, () => {
  console.log('4001번 포트에서 내 정보 서버가 돌아가요');
});
