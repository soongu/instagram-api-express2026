// ~/instagram-api/services/likeService.js
import { prisma } from '../db.js';
import { NotFoundError } from '../errors.js';

// 몇 번을 불러도 결과는 「눌린 상태」 하나다.
// 이미 눌렀으면 행이 안 들어가고(count 0), 숫자도 그만큼만 올라간다.
export async function likePost(postId, userId) {
  try {
    const { count } = await prisma.postLike.createMany({
      data: [{ postId, userId }],
      skipDuplicates: true,
    });

    // 화면이 읽는 숫자는 따로 적어둔 컬럼이라, 행이 늘어난 만큼 우리가 맞춰준다.
    const post = await prisma.post.update({
      where: { id: postId },
      data: { likeCount: { increment: count } },
    });

    return { liked: true, likeCount: post.likeCount };
  } catch (error) {
    if (error.code === 'P2003') throw new NotFoundError('그런 게시물이나 사용자는 없어요');
    if (error.code === 'P2025') throw new NotFoundError('그런 게시물은 없어요');
    throw error;
  }
}

// 몇 번을 불러도 결과는 「안 눌린 상태」 하나다.
export async function unlikePost(postId, userId) {
  try {
    const { count } = await prisma.postLike.deleteMany({
      where: { postId, userId },
    });

    const post = await prisma.post.update({
      where: { id: postId },
      data: { likeCount: { decrement: count } },
    });

    return { liked: false, likeCount: post.likeCount };
  } catch (error) {
    if (error.code === 'P2025') throw new NotFoundError('그런 게시물은 없어요');
    throw error;
  }
}

// 누가 눌렀는지는 post_likes 를 훑어 사람 쪽 이름만 꺼내면 된다.
export async function getLikers(postId) {
  const likes = await prisma.postLike.findMany({
    where: { postId },
    include: { user: true },
    orderBy: { id: 'asc' },
  });

  return likes.map((like) => like.user.username);
}
