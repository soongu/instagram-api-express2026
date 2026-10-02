// ~/instagram-api/services/likeService.js
import { prisma } from '../db.js';
import { BadRequestError, NotFoundError } from '../errors.js';

// 한 번 부르면 켜지고 한 번 더 부르면 꺼진다.
// 「지금 눌린 상태인가」는 post_likes 에 그 쌍이 있는지로 정해진다.
export async function toggleLike(postId, userId) {
  const existing = await prisma.postLike.findUnique({
    where: { postId_userId: { postId, userId } },
  });

  try {
    if (existing) {
      await prisma.postLike.delete({ where: { id: existing.id } });
    } else {
      await prisma.postLike.create({ data: { postId, userId } });
    }
  } catch (error) {
    if (error.code === 'P2003') throw new BadRequestError('그런 게시물이나 사용자는 없어요');
    throw error;
  }

  // 여기서 서버가 죽었다고 쳐요 — 잠깐 넣었다 뺄 한 줄이에요.
  throw new Error('서버가 갑자기 멈췄어요');

  // 화면이 읽는 숫자는 따로 적어둔 칸이라, 켜고 끌 때마다 우리가 맞춰준다.
  try {
    const post = await prisma.post.update({
      where: { id: postId },
      data: { likeCount: { increment: existing ? -1 : 1 } },
    });

    return { liked: !existing, likeCount: post.likeCount };
  } catch (error) {
    if (error.code === 'P2025') throw new NotFoundError('그런 게시물은 없어요');
    throw error;
  }
}

export async function getLikers(postId) {
  const likes = await prisma.postLike.findMany({
    where: { postId },
    include: { user: true },
    orderBy: { id: 'asc' },
  });

  return likes.map((like) => like.user.username);
}
