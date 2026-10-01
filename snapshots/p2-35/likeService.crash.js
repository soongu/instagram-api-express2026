// ~/instagram-api/services/likeService.js
import { prisma } from '../db.js';
import { NotFoundError } from '../errors.js';

// 몇 번을 불러도 결과는 「눌린 상태」 하나다.
// 이미 눌렀으면 행이 안 들어가고(count 0), 숫자도 오르지 않는다.
export async function likePost(postId, userId) {
  try {
    const { count } = await prisma.postLike.createMany({
      data: [{ postId, userId }],
      skipDuplicates: true,
    });

    // 여기서 서버가 죽었다고 쳐요 — 잠깐 넣었다 뺄 한 줄이에요.
    throw new Error('서버가 갑자기 멈췄어요');

    return await changeLikeCount(postId, count, true);
  } catch (error) {
    if (error.code === 'P2003') throw new NotFoundError('그런 게시물이나 사용자는 없어요');
    throw error;
  }
}

// 몇 번을 불러도 결과는 「안 눌린 상태」 하나다.
export async function unlikePost(postId, userId) {
  const { count } = await prisma.postLike.deleteMany({
    where: { postId, userId },
  });

  return changeLikeCount(postId, -count, false);
}

// 화면이 읽는 숫자는 따로 적어둔 컬럼이라, 행이 늘고 준 만큼 우리가 맞춰준다.
// SQL 로 직접 고쳐서 updated_at 은 그대로 둔다 — 좋아요를 누른 것은 게시물을 고친 게 아니다.
async function changeLikeCount(postId, amount, liked) {
  await prisma.$executeRaw`
    UPDATE posts SET like_count = like_count + ${amount} WHERE id = ${postId}`;

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw new NotFoundError('그런 게시물은 없어요');

  return { liked, likeCount: post.likeCount };
}

// 누가 눌렀는지는 post_likes 에서 그 게시물의 행을 찾아 사용자 이름만 꺼내면 된다.
export async function getLikers(postId) {
  const likes = await prisma.postLike.findMany({
    where: { postId },
    include: { user: true },
    orderBy: { id: 'asc' },
  });

  return likes.map((like) => like.user.username);
}
