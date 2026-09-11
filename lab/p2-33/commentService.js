// ~/instagram-api/lab/commentService.js
import { prisma } from '../db.js';
import { BadRequestError, NotFoundError } from '../errors.js';

// 댓글에는 프로필 사진이 안 쓰이니 이름만 얹는다.
function withAuthor({ author, ...comment }) {
  return { ...comment, username: author.username };
}

export async function getComments({ postId }) {
  const comments = await prisma.comment.findMany({
    where: { postId },
    include: { author: true },
    orderBy: { id: 'asc' },
  });

  return comments.map(withAuthor);
}

export async function getComment(id) {
  const comment = await prisma.comment.findUnique({
    where: { id },
    include: { author: true },
  });

  if (!comment) throw new NotFoundError('그런 댓글은 없어요');

  return withAuthor(comment);
}

export async function createComment(data) {
  try {
    const comment = await prisma.comment.create({ data, include: { author: true } });

    return withAuthor(comment);
  } catch (error) {
    if (error.code === 'P2003') throw new BadRequestError('그런 사용자는 없어요');
    throw error;
  }
}

export async function removeComment(id) {
  try {
    const comment = await prisma.comment.delete({ where: { id }, include: { author: true } });

    return withAuthor(comment);
  } catch (error) {
    if (error.code === 'P2025') throw new NotFoundError('그런 댓글은 없어요');
    throw error;
  }
}
