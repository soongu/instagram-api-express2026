// ~/instagram-api/lab/p3-37/which-key.js
import { prisma } from '../../db.js';

// 가입이 409 로 끝날 때 Prisma 가 받는 데이터베이스 에러를 그대로 찍어 본다.
async function tryCreate(data) {
  try {
    await prisma.user.create({ data });
  } catch (error) {
    console.log(error.code, error.meta.driverAdapterError.cause);
  }
}

// 이미 있는 사용자 이름
await tryCreate({ username: 'jaehoon', name: '김재훈' });
// 이미 있는 휴대폰 번호 — 위 envelope.http 에서 가입시킨 번호
await tryCreate({ username: 'taeyang3', name: '한태양', phone: '01042427777' });

await prisma.$disconnect();
