// 배열 꼴 — 서로의 결과가 필요 없는 작업 여럿을 한 묶음으로 보낸다.
// 둘 중 하나만 반영되면 두 사진이 같은 차례가 되니, 둘을 함께 묶는다.
import { prisma } from '../../db.js';

await prisma.$transaction([
  prisma.postImage.update({ where: { id: 1 }, data: { imgOrder: 2 } }),
  prisma.postImage.update({ where: { id: 2 }, data: { imgOrder: 1 } }),
]);

const images = await prisma.postImage.findMany({ where: { postId: 1 }, orderBy: { imgOrder: 'asc' } });

console.log(images.map((image) => `${image.imgOrder}. ${image.id}번 사진`).join('\n'));

await prisma.$disconnect();
