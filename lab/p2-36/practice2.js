// ~/instagram-api/lab/practice2.js
import { bookstore } from './bookstore.js';

// 책과 표지 사진을 «한 번의 부탁» 으로 만든다.
const book = await bookstore.book.create({
  data: {
    title: '실용주의 프로그래머',
    price: 25000,
    stock: 6,
    authorId: 1,
    images: {
      create: [
        { imageUrl: '/covers/pragmatic-front.jpg', imgOrder: 1 },
        { imageUrl: '/covers/pragmatic-back.jpg', imgOrder: 2 },
      ],
    },
  },
  include: { images: { orderBy: { imgOrder: 'asc' } } },
});

console.log(`${book.title} — 사진 ${book.images.length}장`);

for (const image of book.images) {
  console.log(`    ${image.imgOrder}. ${image.imageUrl}`);
}

// 없는 지은이 번호를 적어 일부러 막아본다. 사진은 멀쩡한데도 책이 안 만들어진다.
try {
  await bookstore.book.create({
    data: {
      title: '안 만들어질 책',
      price: 10000,
      authorId: 999,
      images: { create: [{ imageUrl: '/covers/nope.jpg', imgOrder: 1 }] },
    },
  });
} catch (error) {
  console.log(`막혔어요: ${error.code}`);
}

const left = await bookstore.book.findFirst({ where: { title: '안 만들어질 책' } });

console.log(left ? '책이 남았어요' : '책도 사진도 안 남았어요');

await bookstore.$disconnect();
