// ~/instagram-api/lab/practice1.js
import { bookstore } from './bookstore.js';

// 한 권을 판다 — 재고를 줄이고, 0이 되면 품절로 표시한다.
// 재고를 보고 판단한 다음 고치는 것이라, 셋을 한 묶음으로 둔다.
async function sell(bookId) {
  return bookstore.$transaction(async (tx) => {
    const book = await tx.book.findUnique({ where: { id: bookId } });

    if (!book) throw new Error('그런 책은 없어요');
    if (book.stock === 0) throw new Error(`품절이에요 — ${book.title}`);

    const sold = await tx.book.update({
      where: { id: bookId },
      data: { stock: { decrement: 1 } },
    });

    if (sold.stock === 0) {
      return tx.book.update({ where: { id: bookId }, data: { isSoldOut: true } });
    }

    return sold;
  });
}

// 리팩터링은 재고가 2권이라, 세 번째에는 팔 것이 없다.
for (let count = 1; count <= 3; count += 1) {
  try {
    const book = await sell(2);

    console.log(`${book.title} 한 권 팔았어요 — 남은 재고 ${book.stock}, 품절 ${book.isSoldOut}`);
  } catch (error) {
    console.log(`막혔어요: ${error.message}`);
  }
}

await bookstore.$disconnect();
