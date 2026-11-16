// ~/instagram-api/services/commentService.js
import { prisma } from '../db.js';
import { NotFoundError } from '../errors.js';

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

// 댓글은 오래된 것부터 보여 준다 — 시각이 같으면 번호가 작은 것이 먼저다.
export async function getComments(postId) {
  // 게시물이 없으면 404 — 아직 댓글이 없는 게시물(빈 목록)과 구별한다.
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
  if (!post) throw new NotFoundError('POST_NOT_FOUND');

  // 답글은 빼고 원댓글만 받는다 — 답글은 parentId 에 원댓글 번호가 들어 있다.
  const comments = await prisma.comment.findMany({
    where: { postId, parentId: null },
    select: commentFields,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });

  return comments.map(flatten);
}
