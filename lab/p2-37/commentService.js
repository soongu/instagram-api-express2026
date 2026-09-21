// ~/instagram-api/lab/commentService.js
import { prisma } from '../db.js';
import { BadRequestError, NotFoundError } from '../errors.js';

// 댓글에는 프로필 사진이 안 쓰이니 이름만 얹는다.
function withAuthor({ author, ...comment }) {
  return { ...comment, username: author.username };
}

// 쓸 칸만 골라 받는다. 글쓴이에게서 필요한 것도 이름 하나뿐이다.
const commentFields = {
  id: true,
  postId: true,
  authorId: true,
  content: true,
  likeCount: true,
  createdAt: true,
  updatedAt: true,
  parentId: true,
  author: { select: { username: true } },
};

// 원댓글에 딸린 답글도 같은 모양으로 펴서 안에 담는다.
function withReplies({ replies, ...comment }) {
  return { ...withAuthor(comment), replies: replies.map(withAuthor) };
}

export async function getComments({ postId, limit = 5, cursor }) {
  // 게시물 목록과 같은 모양으로 준다 — 한 장 더 받아 보고 다음이 있는지 알아낸다.
  const comments = await prisma.comment.findMany({
    // 답글은 원댓글 안에 담아 보내므로 목록에는 원댓글만 싣는다.
    where: { postId, parentId: null },
    select: {
      ...commentFields,
      replies: { select: commentFields, orderBy: { id: 'asc' } },
    },
    orderBy: { id: 'asc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasNext = comments.length > limit;

  return { items: comments.slice(0, limit).map(withReplies), hasNext };
}

// 답글이 많은 원댓글은 통째로 보내면 응답이 길어진다.
// 게시물·댓글 목록과 같은 모양으로, 원댓글 하나에 딸린 답글만 장으로 나눠 준다.
export async function getReplies({ parentId, limit = 3, cursor }) {
  const parent = await prisma.comment.findUnique({ where: { id: parentId } });

  if (!parent) throw new NotFoundError('그런 댓글은 없어요');
  if (parent.parentId) throw new BadRequestError('답글의 답글은 물을 수 없어요');

  const replies = await prisma.comment.findMany({
    where: { parentId },
    select: commentFields,
    orderBy: { id: 'asc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasNext = replies.length > limit;

  return { items: replies.slice(0, limit).map(withAuthor), hasNext };
}

export async function getComment(id) {
  const comment = await prisma.comment.findUnique({
    where: { id },
    select: {
      ...commentFields,
      replies: { select: commentFields, orderBy: { id: 'asc' } },
    },
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
    // 댓글을 넣는 일과 게시물의 숫자를 올리는 일은 함께 끝나야 한다.
    // 답글은 원댓글에 딸린 것이라 이 숫자에 안 센다 — 지금 적혀 있는 값이 원댓글 수다.
    const comment = await prisma.$transaction(async (tx) => {
      const created = await tx.comment.create({
        data: { ...data, parentId },
        select: commentFields,
      });

      if (!parentId) {
        await tx.post.update({
          where: { id: created.postId },
          data: { commentCount: { increment: 1 } },
        });
      }

      return created;
    });

    return withAuthor(comment);
  } catch (error) {
    if (error.code === 'P2003') throw new BadRequestError('그런 사용자는 없어요');
    throw error;
  }
}

export async function removeComment(id) {
  try {
    // 지우는 일과 숫자를 내리는 일도 한 묶음이다.
    // 원댓글을 지우면 딸린 답글도 함께 사라지는데, 답글은 애초에 안 셌으니 1만 내리면 된다.
    const comment = await prisma.$transaction(async (tx) => {
      const deleted = await tx.comment.delete({ where: { id }, select: commentFields });

      if (!deleted.parentId) {
        await tx.post.update({
          where: { id: deleted.postId },
          data: { commentCount: { decrement: 1 } },
        });
      }

      return deleted;
    });

    return withAuthor(comment);
  } catch (error) {
    if (error.code === 'P2025') throw new NotFoundError('그런 댓글은 없어요');
    throw error;
  }
}
