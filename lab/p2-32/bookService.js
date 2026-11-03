// ~/instagram-api/lab/bookService.js
import { bookstore } from './bookstore.js';
import { NotFoundError } from '../errors.js';

export function getBooks({ author, limit }) {
  return bookstore.book.findMany({
    where: { author },
    orderBy: { price: 'desc' },
    take: limit,
  });
}

export async function getBook(id) {
  const book = await bookstore.book.findUnique({ where: { id } });

  if (!book) throw new NotFoundError('그런 책은 없어요');

  return book;
}

export async function removeBook(id) {
  try {
    return await bookstore.book.delete({ where: { id } });
  } catch (error) {
    if (error.code === 'P2025') throw new NotFoundError('그런 책은 없어요');
    throw error;
  }
}
