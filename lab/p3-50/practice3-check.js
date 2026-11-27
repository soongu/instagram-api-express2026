// ~/instagram-api/lab/p3-50/practice3-check.js
// practice3.js 의 attachUpload 를 확인한다 — 확인용 게시물 둘과 사진 기록 셋을 만들었다가 끝나면 지운다.
// 사진 파일은 만들지 않는다. 게시물에 적히는지는 기록만 보면 알 수 있다.
import { randomUUID } from 'node:crypto';
import { prisma } from '../../db.js';
import { attachUpload } from './practice3.js';

const jaehoon = await prisma.user.findUnique({ where: { username: 'jaehoon' } });
const minji = await prisma.user.findUnique({ where: { username: 'minji' } });

// 지금 있는 기록들 — where 에서 파일 이름 조건이 빠지면 이 기록들까지 바뀌므로, 끝나고 원래 값으로 고쳐 두려고 적어 둔다.
const others = await prisma.upload.findMany({ select: { id: true, postId: true } });

const mine = `check-${randomUUID()}.jpg`;
const another = `check-${randomUUID()}.jpg`;
const minjis = `check-${randomUUID()}.jpg`;
await prisma.upload.createMany({
  data: [
    { fileName: mine, uploaderId: jaehoon.id },
    { fileName: another, uploaderId: jaehoon.id },
    { fileName: minjis, uploaderId: minji.id },
  ],
});
const first = await prisma.post.create({ data: { authorId: jaehoon.id, content: '확인용 게시물 1' } });
const second = await prisma.post.create({ data: { authorId: jaehoon.id, content: '확인용 게시물 2' } });

try {
  // jaehoon 이 자기 사진 하나를 두 게시물에 «같은 순간에» 적는다 — 하나만 적혀야 한다.
  const results = await Promise.all([
    attachUpload(mine, jaehoon.id, first.id),
    attachUpload(mine, jaehoon.id, second.id),
  ]);
  console.log(`같은 사진을 두 게시물에 동시에 적기: ${results.sort().reverse().join(' · ')}`);

  // jaehoon 이 minji 가 올린 사진을 자기 게시물에 적는다 — 적히면 안 된다.
  console.log(`minji가 올린 사진 적기: ${await attachUpload(minjis, jaehoon.id, first.id)}`);

  // 함께 만들어 둔 jaehoon 의 다른 사진 기록은 아무 게시물에도 안 적혀 있어야 한다.
  const untouched = await prisma.upload.findUnique({ where: { fileName: another } });
  console.log(`jaehoon의 다른 사진은 그대로: ${untouched.postId === null}`);
} finally {
  let changed = 0;
  for (const { id, postId } of others) {
    const now = await prisma.upload.findUnique({ where: { id }, select: { postId: true } });
    if (now && now.postId !== postId) {
      await prisma.upload.update({ where: { id }, data: { postId } });
      changed += 1;
    }
  }
  if (changed > 0) {
    console.log(`확인용이 아닌 기록 ${changed}개가 바뀌어서 원래 값으로 고쳐 두었어요. where 에 fileName 이 있는지 보세요.`);
  }

  // 확인용 게시물을 지우면 거기 적힌 확인용 기록도 함께 지워진다. 남은 확인용 기록도 지운다.
  await prisma.post.deleteMany({ where: { id: { in: [first.id, second.id] } } });
  await prisma.upload.deleteMany({ where: { fileName: { in: [mine, another, minjis] } } });
  await prisma.$disconnect();
}
