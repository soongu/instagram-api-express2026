// ~/instagram-api/lab/practice2.js
import { bookstore } from './bookstore.js';

// 책과 표지 사진을 `create` 한 번으로 만든다.
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

// 없는 태그 번호를 적어 일부러 막아본다. 책과 표지가 먼저 들어간 다음 태그에서 막힌다.
try {
  await bookstore.book.create({
    data: {
      title: '안 만들어질 책',
      price: 10000,
      authorId: 1,
      images: { create: [{ imageUrl: '/covers/nope.jpg', imgOrder: 1 }] },
      tags: { create: [{ tagId: 999 }] },
    },
  });
} catch (error) {
  console.log(`막혔어요: ${error.code}`);
}

const leftBooks = await bookstore.book.count({ where: { title: '안 만들어질 책' } });
const leftCovers = await bookstore.bookImage.count({ where: { imageUrl: '/covers/nope.jpg' } });

console.log(`남은 책 ${leftBooks}권, 남은 표지 ${leftCovers}장`);

await bookstore.$disconnect();
