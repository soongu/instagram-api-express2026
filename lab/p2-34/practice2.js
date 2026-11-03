// ~/instagram-api/lab/practice2.js
import { bookstore } from './bookstore.js';

// 답글도 리뷰다. 같은 표에 들어가고 parent_id 로 원글을 가리킨다.
const first = await bookstore.review.findFirst({ orderBy: { id: 'asc' } });

await bookstore.review.create({
  data: {
    bookTitle: first.bookTitle,
    bookId: first.bookId,
    reviewer: '서점 주인',
    score: 5,
    comment: '리뷰 감사합니다',
    parentId: first.id,
  },
});

const roots = await bookstore.review.findMany({
  where: { parentId: null },
  include: { replies: true },
  orderBy: { id: 'asc' },
});

console.log(`리뷰 표의 줄은 모두 ${await bookstore.review.count()}개고, 원글은 ${roots.length}개예요.`);

for (const review of roots) {
  console.log(`${review.id}번 ${review.reviewer} — 답글 ${review.replies.length}개`);
}

await bookstore.$disconnect();
