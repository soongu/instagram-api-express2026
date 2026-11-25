// ~/instagram-api/services/followService.js
import { prisma } from '../db.js';
import { BadRequestError, NotFoundError } from '../errors.js';

// 팔로우받을 사람을 사용자 이름으로 찾는다 - 없으면 404, 나 자신이면 400 이다.
async function findFollowing(username, followerId) {
  const user = await prisma.user.findUnique({ where: { username }, select: { id: true } });

  if (!user) throw new NotFoundError('USER_NOT_FOUND');
  if (user.id === followerId) throw new BadRequestError('CANNOT_FOLLOW_SELF');

  return user.id;
}

// 팔로워 수 컬럼을 amount 만큼 고치고 고친 값을 돌려준다.
// 트랜잭션 안에서 부르는 함수라 prisma 가 아니라 넘겨받은 tx 로 쓴다.
async function changeFollowerCount(tx, followingId, amount) {
  const user = await tx.user.update({
    where: { id: followingId },
    data: { followerCount: { increment: amount } },
    select: { followerCount: true },
  });

  return user.followerCount;
}

// 몇 번을 불러도 결과는 «팔로우한 상태» 하나다.
// 이미 팔로우하고 있으면 행이 안 들어가고(count 0), 숫자도 오르지 않는다.
export async function follow(username, followerId) {
  const followingId = await findFollowing(username, followerId);

  // 행을 넣는 일과 숫자를 고치는 일은 «함께» 끝나야 한다.
  const followerCount = await prisma.$transaction(async (tx) => {
    const { count } = await tx.follow.createMany({
      data: [{ followerId, followingId }],
      skipDuplicates: true,
    });

    return changeFollowerCount(tx, followingId, count);
  });

  return { following: true, followerCount };
}

// 몇 번을 불러도 결과는 «팔로우하지 않은 상태» 하나다.
// 팔로우하고 있지 않았으면 지울 행이 없고(count 0), 숫자도 내려가지 않는다.
export async function unfollow(username, followerId) {
  const followingId = await findFollowing(username, followerId);

  const followerCount = await prisma.$transaction(async (tx) => {
    const { count } = await tx.follow.deleteMany({ where: { followerId, followingId } });

    return changeFollowerCount(tx, followingId, -count);
  });

  return { following: false, followerCount };
}
