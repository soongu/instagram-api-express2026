// ~/instagram-api/lab/commentService.js
import { prisma } from '../db.js';
import { BadRequestError, NotFoundError } from '../errors.js';

// 댓글에는 프로필 사진이 안 쓰이니 이름만 얹는다.
function withAuthor({ author, ...comment }) {
  return { ...comment, username: author.username };
}

// 원댓글에 딸린 답글도 같은 모양으로 펴서 안에 담는다.
function withReplies({ replies, ...comment }) {
  return { ...withAuthor(comment), replies: replies.map(withAuthor) };
}

export async function getComments({ postId }) {
  const comments = await prisma.comment.findMany({
    // 답글은 원댓글 안에 담아 보내므로 목록에는 원댓글만 싣는다.
    where: { postId, parentId: null },
    include: { author: true, replies: { include: { author: true }, orderBy: { id: 'asc' } } },
    orderBy: { id: 'asc' },
  });

  return comments.map(withReplies);
}

export async function getComment(id) {
  const comment = await prisma.comment.findUnique({
    where: { id },
    include: { author: true, replies: { include: { author: true }, orderBy: { id: 'asc' } } },
  });

  if (!comment) throw new NotFoundError('그런 댓글은 없어요');

  return withReplies(comment);
}

export async function createComment({ parentId, ...data }) {
  // 답글이 어느 게시물 것인지는 원댓글이 이미 안다 — 요청에서 받지 않고 물려받는다.
  if (parentId) {
    const parent = await prisma.comment.findUnique({ where: { id: parentId } });

    if (!parent) throw new BadRequestError('그런 댓글은 없어요');

    data.postId = parent.postId;
  }

  try {
    const comment = await prisma.comment.create({
      data: { ...data, parentId },
      include: { author: true },
    });

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
