// ~/instagram-api/services/followService.js
import { prisma } from '../db.js';
import { BadRequestError, NotFoundError } from '../errors.js';
import { encodeCursor, decodeCursor } from '../utils/cursor.js';

// 사용자 이름으로 사람의 번호를 찾는다 - 없으면 404 다.
async function findUserId(username) {
  const user = await prisma.user.findUnique({ where: { username }, select: { id: true } });

  if (!user) throw new NotFoundError('USER_NOT_FOUND');

  return user.id;
}

// 팔로우받을 사람을 찾는다 - 나 자신이면 400 이다.
async function findFollowing(username, followerId) {
  const followingId = await findUserId(username);

  if (followingId === followerId) throw new BadRequestError('CANNOT_FOLLOW_SELF');

  return followingId;
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

// 목록 한 줄에 실을 사람 정보.
const personFields = { id: true, username: true, name: true, profileImage: true };

// 목록은 «팔로우한 시각이 늦은 순, 같으면 행 번호가 큰 순» 이다 - 게시물 목록과 같은 차례라 조건도 같다.
// 커서 다음 행은 시각이 더 이르거나, 시각이 같고 번호가 더 작은 행이다.
function afterCursor({ createdAt, id }) {
  return {
    createdAt: { lte: createdAt },
    OR: [{ createdAt: { lt: createdAt } }, { id: { lt: id } }],
  };
}

// 그 사람을 팔로우하는 사람들 - 가장 최근에 팔로우한 사람이 먼저다. 한 번에 limit 명씩 나눠 준다.
export async function getFollowers(username, { limit = 20, cursor }) {
  const followingId = await findUserId(username);

  const rows = await prisma.follow.findMany({
    where: {
      followingId,
      // 커서는 사람이 아니라 «follows 의 행» 을 가리킨다 - 차례를 정하는 값이 그 행의 시각과 번호라서.
      ...(cursor ? afterCursor(decodeCursor(cursor)) : {}),
    },
    select: { id: true, createdAt: true, follower: { select: personFields } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
  });

  const hasNext = rows.length > limit;
  const page = rows.slice(0, limit);

  return {
    items: page.map((row) => row.follower),
    hasNext,
    nextCursor: hasNext ? encodeCursor(page[page.length - 1]) : null,
  };
}
