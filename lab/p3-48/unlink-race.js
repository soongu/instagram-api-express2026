// ~/instagram-api/lab/p3-48/unlink-race.js
import { prisma } from '../../db.js';
import * as authService from '../../services/authService.js';

const SERVER = 'http://localhost:3000';

// 시험용 사람 — 비밀번호 없이 소셜 계정 둘(구글 · 카카오)만 있다.
// 제공자 쪽 값은 지어낸 글자라 실제 계정과 겹치지 않고, 사용자 이름에는 지금 시각을 붙여 겹치지 않게 한다.
const tag = Date.now();
const user = await prisma.user.create({
  data: {
    username: `race.${tag}`,
    socialAccounts: {
      create: [
        { provider: 'google', providerUserId: `race-google-${tag}` },
        { provider: 'kakao', providerUserId: `race-kakao-${tag}` },
      ],
    },
  },
  select: { id: true, role: true },
});

try {
  // 그 사람의 로그인 기록과 Access 토큰 — 로그인할 때와 같은 함수로 만든다.
  const { accessToken } = await authService.startSession(user);
  const unlink = (provider) => fetch(`${SERVER}/api/v2/auth/social-accounts/${provider}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  // 끊기 요청 둘을 함께 보낸다 — 앞 요청의 답을 기다리지 않는다.
  const [google, kakao] = await Promise.all([unlink('google'), unlink('kakao')]);
  const left = await prisma.socialAccount.count({ where: { userId: user.id } });

  console.log(`google 끊기: ${google.status}`);
  console.log(`kakao 끊기: ${kakao.status}`);
  console.log(`남은 소셜 계정: ${left}개`);
} catch (error) {
  // 수업 서버가 떠 있지 않으면 fetch 가 연결하지 못하고 에러를 던진다.
  if (error.cause?.code !== 'ECONNREFUSED') throw error;
  console.log(`수업 서버(${SERVER})에 연결하지 못했어요. 다른 창에서 npm run dev 로 서버를 먼저 띄워 주세요.`);
} finally {
  // 시험용 사람을 지운다 — 그 사람의 소셜 계정과 로그인 기록도 함께 지워진다.
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.$disconnect();
}
