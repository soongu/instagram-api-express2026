// ~/instagram-api/lab/commentService.js
import { prisma } from '../db.js';

export function getComments({ postId }) {
  return prisma.comment.findMany({
    where: { postId },
    orderBy: { id: 'asc' },
  });
}

export function getComment(id) {
  return prisma.comment.findUnique({ where: { id } });
}

export async function removeComment(id) {
  try {
    return await prisma.comment.delete({ where: { id } });
  } catch (error) {
    if (error.code === 'P2025') return null;
    throw error;
  }
}
