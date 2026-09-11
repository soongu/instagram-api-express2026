// ~/instagram-api/lab/practice3.js
import { bookstore } from './bookstore.js';

// 책도 태그도 여럿을 갖는다. 그래서 가운데 표가 「어느 책에 어느 태그」 한 쌍을 받는다.
await bookstore.tag.createMany({
  data: [{ name: '실무' }, { name: '고전' }, { name: '설계' }],
});

const tagId = async (name) => (await bookstore.tag.findUnique({ where: { name } })).id;

await bookstore.bookTag.createMany({
  data: [
    { bookId: 1, tagId: await tagId('실무') },
    { bookId: 1, tagId: await tagId('고전') },
    { bookId: 2, tagId: await tagId('설계') },
    { bookId: 8, tagId: await tagId('설계') },
  ],
});

const books = await bookstore.book.findMany({
  include: { tags: { include: { tag: true } } },
  orderBy: { id: 'asc' },
});

for (const book of books) {
  const names = book.tags.map((link) => link.tag.name).join(', ');
  console.log(`${book.id}번 ${book.title} — ${names || '태그 없음'}`);
}

// 같은 쌍을 한 번 더 넣으면 데이터베이스가 막는다.
try {
  await bookstore.bookTag.create({ data: { bookId: 1, tagId: await tagId('실무') } });
  console.log('두 번 들어갔어요');
} catch (error) {
  console.log('막혔어요:', error.code);
}

await bookstore.$disconnect();
