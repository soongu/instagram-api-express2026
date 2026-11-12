// ~/instagram-api/lab/p3-44/homework2.js
// 내가 로그인해 둔 기기 목록과 «이 기기 내보내기» — 수업 백엔드의 데이터베이스와 로그인 확인을 그대로 쓴다.
import express from 'express';
import cookieParser from 'cookie-parser';
import { prisma } from '../../db.js';
import { readToken, requireLogin } from '../../middlewares/auth.js';
import { verifyAccessToken } from '../../services/tokenService.js';
import { SESSION_MAX_LIFETIME } from '../../services/sessionService.js';

const app = express();

app.use(cookieParser());
app.use(requireLogin);

// 내 로그인 기록 — 최근 로그인부터. 지금 이 요청을 보낸 기록에는 current: true.
app.get('/sessions', async (req, res) => {
  const { sid } = verifyAccessToken(readToken(req));
  const sessions = await prisma.session.findMany({
    where: { userId: res.locals.userId },
    orderBy: { createdAt: 'desc' },
  });

  res.json(sessions.map((session) => ({
    id: session.id,
    createdAt: session.createdAt,
    // 끝나는 때 — 7일 동안 새 토큰을 안 받은 때와 처음 로그인한 뒤 30일 가운데 이른 쪽.
    endsAt: new Date(Math.min(session.expiresAt.getTime(), session.createdAt.getTime() + SESSION_MAX_LIFETIME)),
    current: session.id === sid,
  })));
});

// 내 로그인 기록 하나를 지운다 — 그 기기는 Access 토큰이 끝나면 새 토큰을 못 받는다.
// 번호와 함께 «내 것» 인지도 조건에 넣는다 — 남의 기록이면 없는 것과 같다(404).
app.delete('/sessions/:id', async (req, res) => {
  const { count } = await prisma.session.deleteMany({ where: { id: req.params.id, userId: res.locals.userId } });

  if (count === 0) {
    return res.status(404).json({ message: '그런 로그인 기록은 없어요' });
  }

  res.json({ message: '그 기기에서 로그아웃했어요' });
});

// requireLogin 이 넘긴 401 에러를 { message } 로 답한다.
app.use((err, req, res, next) => {
  res.status(err.status ?? 500).json({ message: err.message });
});

app.listen(4012, () => {
  console.log('4012번 포트에서 로그인 기기 서버가 돌아가요');
});
