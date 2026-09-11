// ~/instagram-api/lab/commentService.js
import { prisma } from '../db.js';
import { NotFoundError } from '../errors.js';

export function getComments({ postId }) {
  return prisma.comment.findMany({
    where: { postId },
    orderBy: { id: 'asc' },
  });
}

export async function getComment(id) {
  const comment = await prisma.comment.findUnique({ where: { id } });

  if (!comment) throw new NotFoundError('그런 댓글은 없어요');

  return comment;
}

export function createComment(data) {
  return prisma.comment.create({ data });
}

export async function removeComment(id) {
  try {
    return await prisma.comment.delete({ where: { id } });
  } catch (error) {
    if (error.code === 'P2025') throw new NotFoundError('그런 댓글은 없어요');
    throw error;
  }
}
