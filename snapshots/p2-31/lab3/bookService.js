// ~/instagram-api/lab/bookService.js
import { bookstore } from './bookstore.js';

export function getBooks({ author, limit }) {
  return bookstore.book.findMany({
    where: { author },
    orderBy: { price: 'desc' },
    take: limit,
  });
}

export function getBook(id) {
  return bookstore.book.findUnique({ where: { id } });
}

export function removeBook(id) {
  return bookstore.book.delete({ where: { id } });
}
