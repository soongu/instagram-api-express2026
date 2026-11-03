// ~/instagram-api/lab/practice1.js
import { bookstore } from './bookstore.js';

// 저장하는 모양과 내보내는 모양은 다르다 — 저자를 한 겹 펴서 돌려준다.
function flat({ author, ...book }) {
  return { id: book.id, title: book.title, author: author.name, price: book.price };
}

const books = await bookstore.book.findMany({
  include: { author: true },
  orderBy: { id: 'asc' },
});

for (const book of books) {
  console.log(flat(book));
}

await bookstore.$disconnect();
