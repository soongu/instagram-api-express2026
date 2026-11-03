// ~/instagram-api/lab/practice3.js
import { bookstore } from './bookstore.js';

// ① 리뷰를 통째로 받아 와서 센다.
const heavy = await bookstore.book.findMany({
  include: { reviews: true },
  orderBy: { id: 'asc' },
});

console.log(`통째로 받기 — ${Buffer.byteLength(JSON.stringify(heavy))}바이트`);

// ② 개수만 세어 달라고 한다. 리뷰 줄은 한 개도 안 실려 온다.
const light = await bookstore.book.findMany({
  select: { id: true, title: true, _count: { select: { reviews: true } } },
  orderBy: { id: 'asc' },
});

console.log(`개수만 받기 — ${Buffer.byteLength(JSON.stringify(light))}바이트`);

for (const book of light) {
  console.log(`${book.id}번 ${book.title} — 리뷰 ${book._count.reviews}개`);
}

await bookstore.$disconnect();
