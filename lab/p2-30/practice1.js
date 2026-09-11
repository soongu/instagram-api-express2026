// ~/instagram-api/lab/practice1.js
import { bookstore } from './bookstore.js';

const books = await bookstore.book.findMany({ orderBy: { id: 'asc' } });

console.log(`책 ${books.length}권을 읽었어요.`);
console.log(books[0]);

await bookstore.$disconnect();
