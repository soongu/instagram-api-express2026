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

// 그 사람을 팔로우하는 행이 몇 개인지 센다.
function countFollowers(followingId) {
  return prisma.follow.count({ where: { followingId } });
}

// 몇 번을 불러도 결과는 «팔로우한 상태» 하나다.
// 이미 팔로우하고 있으면 행이 안 들어간다(count 0).
export async function follow(username, followerId) {
  const followingId = await findFollowing(username, followerId);

  await prisma.follow.createMany({
    data: [{ followerId, followingId }],
    skipDuplicates: true,
  });

  return { following: true, followerCount: await countFollowers(followingId) };
}

// 몇 번을 불러도 결과는 «팔로우하지 않은 상태» 하나다.
export async function unfollow(username, followerId) {
  const followingId = await findFollowing(username, followerId);

  await prisma.follow.deleteMany({ where: { followerId, followingId } });

  return { following: false, followerCount: await countFollowers(followingId) };
}
