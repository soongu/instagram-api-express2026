// ~/instagram-api/lab/p3-48/practice3.js
import { prisma } from '../../db.js';

// 시험용 관리자 둘 — 사용자 이름이 이 글자로 시작하는 사람만 다룬다(수업 DB 의 다른 사람과 그 역할은 건드리지 않는다).
const PREFIX = `boss.${Date.now()}.`;

// 관리자를 내린다 — 시험용 관리자가 한 명만 남았으면 내리지 않는다.
// 세고 내리는 일을 트랜잭션으로 묶고, 맨 앞에서 시험용 관리자 행들을 잠근다 —
// 다른 요청은 이 트랜잭션이 끝날 때까지 기다렸다가, 바뀐 뒤의 행으로 센다.
async function demote(id) {
  return prisma.$transaction(async (tx) => {
    const admins = await tx.$queryRaw`SELECT id FROM users WHERE role = 'ADMIN' AND username LIKE ${`${PREFIX}%`} FOR UPDATE`;

    if (admins.length <= 1) return '마지막 관리자라 내리지 않았어요';

    await tx.user.update({ where: { id }, data: { role: 'USER' } });
    return '내렸어요';
  });
}

const bosses = await Promise.all(['1', '2'].map((name) => prisma.user.create({
  data: { username: `${PREFIX}${name}`, role: 'ADMIN' },
  select: { id: true },
})));

try {
  // 두 관리자를 함께 내린다 — 앞의 결과를 기다리지 않는다.
  const results = await Promise.all(bosses.map((boss) => demote(boss.id)));
  const left = await prisma.user.count({ where: { role: 'ADMIN', username: { startsWith: PREFIX } } });

  results.forEach((result, index) => console.log(`관리자 ${index + 1} 내리기: ${result}`));
  console.log(`남은 시험용 관리자: ${left}명`);
} finally {
  // 시험용 사람 둘을 지운다 — 다른 사람의 역할은 처음부터 건드리지 않았다.
  await prisma.user.deleteMany({ where: { username: { startsWith: PREFIX } } });
  await prisma.$disconnect();
}
