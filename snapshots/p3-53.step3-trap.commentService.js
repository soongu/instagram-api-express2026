import { prisma } from '../db.js';
import { NotFoundError } from '../errors.js';
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

// 목록은 «시각이 늦은 순, 같으면 번호가 큰 순» 이다. 그러니 커서 다음 행은
// 시각이 더 이르거나, 시각이 같고 번호가 더 작은 행이다.
// `lte` 가 인덱스에서 시작 위치를 찾고, OR 는 시각이 같은 행에서 커서 앞의 행을 걸러 낸다.
function afterCursor({ createdAt, id }) {
  return {
    createdAt: { lte: createdAt },
    OR: [{ createdAt: { lt: createdAt } }, { id: { lt: id } }],
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
