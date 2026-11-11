// ~/instagram-api/lab/p3-41/homework2.js
import express from 'express';
import cookieParser from 'cookie-parser';
import { z } from 'zod';
import { prisma } from '../../db.js';
import { requireLogin, readSessionId } from '../../middlewares/auth.js';
import { signupSchema } from '../../schemas/authSchema.js';
import * as userService from '../../services/userService.js';

const app = express();

// 새 비밀번호는 가입할 때와 같은 규칙으로 검사한다.
const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: signupSchema.shape.password,
});

app.use(express.json());
app.use(cookieParser());
// 이 서버의 API 는 모두 로그인한 사람만 쓴다.
app.use(requireLogin);

// 비밀번호 바꾸기 — 지금 비밀번호가 맞으면 바꾸고, 지금 이 기기만 남기고 다른 기기의 로그인을 끊는다.
app.patch('/me/password', async (req, res) => {
  const result = passwordChangeSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({ message: '보낸 내용이 규칙에 안 맞아요', details: z.treeifyError(result.error) });
  }

  const { currentPassword, newPassword } = result.data;
  const me = await userService.findUserById(res.locals.userId);
  const checked = await userService.checkPassword(me.username, currentPassword);

  if (!checked) {
    return res.status(400).json({ message: '지금 비밀번호가 맞지 않아요' });
  }

  await userService.setPassword(me.username, newPassword);

  // 이 요청을 보낸 세션은 남기고, 그 사람의 다른 세션을 모두 지운다.
  const { count } = await prisma.session.deleteMany({
    where: { userId: me.id, id: { not: readSessionId(req) } },
  });

  res.json({ message: '비밀번호를 바꿨어요', signedOut: count });
});

app.use((err, req, res, next) => {
  res.status(err.status ?? 500).json({ message: err.message });
});

app.listen(4012, () => {
  console.log('4012번 포트에서 비밀번호 바꾸기 서버가 돌아가요');
});
