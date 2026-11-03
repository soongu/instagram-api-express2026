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

export async function removeBook(id) {
  try {
    return await bookstore.book.delete({ where: { id } });
  } catch (error) {
    if (error.code === 'P2025') return null;
    throw error;
  }
}
