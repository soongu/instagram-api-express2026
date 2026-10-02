// ~/instagram-api/lab/practice1.js
import { bookstore } from './bookstore.js';

// 책 하나에 사진이 여럿이니, 사진은 책의 칸이 아니라 딸린 표의 줄이다.
await bookstore.bookImage.createMany({
  data: [
    { bookId: 1, imageUrl: '/covers/clean-code-front.jpg', imgOrder: 1 },
    { bookId: 1, imageUrl: '/covers/clean-code-back.jpg', imgOrder: 2 },
    { bookId: 2, imageUrl: '/covers/refactoring-front.jpg', imgOrder: 1 },
  ],
});

const books = await bookstore.book.findMany({
  include: { images: { orderBy: { imgOrder: 'asc' } } },
  orderBy: { id: 'asc' },
});

for (const book of books) {
  const urls = book.images.map((image) => image.imageUrl).join(', ');
  console.log(`${book.id}번 ${book.title} — 사진 ${book.images.length}장${urls ? `: ${urls}` : ''}`);
}

await bookstore.$disconnect();
