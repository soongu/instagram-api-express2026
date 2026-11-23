// ~/instagram-api/services/commentService.js
import { prisma } from '../db.js';
import { ForbiddenError, NotFoundError } from '../errors.js';
import { encodeCursor, decodeCursor } from '../utils/cursor.js';

// 댓글 목록에 쓸 필드만 골라서 받는다 — 글쓴이는 번호와 함께 이름과 프로필 사진도 받는다.
const commentFields = {
  id: true,
  authorId: true,
  content: true,
  likeCount: true,
  createdAt: true,
  author: { select: { username: true, profileImage: true } },
};

// author 안에 든 이름과 사진을 꺼내 댓글의 필드로 둔다 — 게시물 응답처럼 username · profileImage 로 보낸다.
function flatten({ author, ...comment }) {
  return {
    ...comment,
    username: author.username,
    profileImage: author.profileImage,
  };
}

// 댓글은 «시각이 이른 순, 같으면 번호가 작은 순» 이다. 게시물 목록과 정렬 방향이 반대라서 비교도 반대로 뒤집는다.
// 커서 다음 행은 시각이 더 늦거나, 시각이 같고 번호가 더 큰 행이다.
function afterCursor({ createdAt, id }) {
  return {
    createdAt: { gte: createdAt },
    OR: [{ createdAt: { gt: createdAt } }, { id: { gt: id } }],
  };
}

// 댓글은 오래된 것부터 보여 준다 — 시각이 같으면 번호가 작은 것이 먼저다.
export async function getComments(postId, { limit = 20, cursor }) {
  // 게시물이 없으면 404 — 아직 댓글이 없는 게시물(빈 목록)과 구별한다.
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
  if (!post) throw new NotFoundError('POST_NOT_FOUND');

  // 답글은 빼고 원댓글만 받는다 — 답글은 parentId 에 원댓글 번호가 들어 있다.
  // 하나 더 달라고 한다 — 더 있는지 없는지를 «세지 않고» 알아내는 방법이다.
  const comments = await prisma.comment.findMany({
    where: {
      postId,
      parentId: null,
      // 커서가 오면 «그 댓글 다음» 부터다. 커서의 값만 쓰므로 그 댓글이 지워졌어도 이어진다.
      ...(cursor ? afterCursor(decodeCursor(cursor)) : {}),
    },
    select: commentFields,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: limit + 1,
  });

  const hasNext = comments.length > limit;
  const page = comments.slice(0, limit);

  return {
    items: page.map(flatten),
    hasNext,
    // 다음 페이지가 있을 때만 커서를 만든다 — 마지막 페이지의 null 은 «여기가 끝» 이라는 뜻이다.
    nextCursor: hasNext ? encodeCursor(page[page.length - 1]) : null,
  };
}

// 댓글을 단다. 이 주소로 다는 댓글은 모두 원댓글이다.
export async function createComment(postId, userId, content) {
  // 게시물이 없으면 404 로 답한다. 목록과 같은 확인이다.
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
  if (!post) throw new NotFoundError('POST_NOT_FOUND');

  // 댓글을 넣는 일과 게시물의 댓글 수를 올리는 일은 함께 끝나야 한다.
  // 이 주소로 다는 댓글은 모두 원댓글이라 숫자를 늘 1 올린다.
  return prisma.$transaction(async (tx) => {
    const comment = await tx.comment.create({
      data: { postId, authorId: userId, content },
      select: commentFields,
    });

    const commentCount = await changeCommentCount(tx, postId, 1);

    // 화면이 카드의 «댓글 N개» 를 다시 받지 않고 고칠 수 있게 바뀐 숫자도 함께 보낸다.
    return { comment: flatten(comment), commentCount };
  });
}

// 게시물의 댓글 수는 따로 적어둔 컬럼이라서 원댓글이 늘고 준 만큼 우리가 맞춰준다.
// SQL 로 직접 고쳐서 updated_at 은 그대로 둔다. 댓글이 달린 것은 게시물을 고친 게 아니다.
// 트랜잭션 안에서 부르는 함수라 prisma 가 아니라 넘겨받은 tx 로 쓴다.
async function changeCommentCount(tx, postId, amount) {
  await tx.$executeRaw`
    UPDATE posts SET comment_count = comment_count + ${amount} WHERE id = ${postId}`;

  const post = await tx.post.findUnique({ where: { id: postId }, select: { commentCount: true } });
  if (!post) throw new NotFoundError('POST_NOT_FOUND');

  return post.commentCount;
}

// 댓글을 지운다. 댓글을 쓴 사람이나 그 댓글이 달린 게시물을 쓴 사람만 지울 수 있다.
export async function removeComment(postId, commentId, userId) {
  // 누가 지울 수 있는지 보려면 댓글을 쓴 사람과 게시물을 쓴 사람이 필요해서 댓글을 찾을 때 함께 받는다.
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { authorId: true, parentId: true, post: { select: { authorId: true } } },
  });
  if (!comment) throw new NotFoundError('COMMENT_NOT_FOUND');

  if (comment.authorId !== userId && comment.post.authorId !== userId) {
    throw new ForbiddenError('CANNOT_REMOVE_COMMENT');
  }

  // 지우는 일과 숫자를 내리는 일도 한 묶음이다.
  return prisma.$transaction(async (tx) => {
    const deleted = await tx.comment.delete({ where: { id: commentId }, select: commentFields });

    // 답글은 세지 않는 숫자라서 답글을 지울 때는 0 만큼 고친다. 숫자는 그대로 두고 지금 값만 읽는다.
    const commentCount = await changeCommentCount(tx, postId, comment.parentId === null ? -1 : 0);

    return { comment: flatten(deleted), commentCount };
  });
}
