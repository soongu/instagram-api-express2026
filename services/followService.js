// ~/instagram-api/services/followService.js
import { prisma } from '../db.js';
import { BadRequestError, NotFoundError } from '../errors.js';
import { encodeCursor, decodeCursor } from '../utils/cursor.js';
import { notify, pushNew, findCaused, pushRemoved } from './notificationService.js';

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
  const { followerCount, notificationIds } = await prisma.$transaction(async (tx) => {
    const { count } = await tx.follow.createMany({
      data: [{ followerId, followingId }],
      skipDuplicates: true,
    });

    // 행이 새로 들어갔을 때만 팔로우받은 사람에게 알림을 남긴다 - 좋아요와 같다.
    let notificationIds = [];
    if (count === 1) {
      const row = await tx.follow.findUnique({
        where: { followerId_followingId: { followerId, followingId } },
        select: { id: true },
      });
      notificationIds = await notify(tx, { type: 'FOLLOW', receiverId: followingId, senderId: followerId, followId: row.id });
    }

    return { followerCount: await changeFollowerCount(tx, followingId, count), notificationIds };
  });

  await pushNew(notificationIds);
  return { following: true, followerCount };
}

// 몇 번을 불러도 결과는 «팔로우하지 않은 상태» 하나다.
// 팔로우하고 있지 않았으면 지울 행이 없고(count 0), 숫자도 내려가지 않는다.
export async function unfollow(username, followerId) {
  const followingId = await findFollowing(username, followerId);

  const { followerCount, removed } = await prisma.$transaction(async (tx) => {
    // 팔로우가 남긴 알림 - 좋아요 취소와 같이 지우기 전에 찾아 둔다.
    const removed = await findCaused(tx, { follow: { followerId, followingId } });

    const { count } = await tx.follow.deleteMany({ where: { followerId, followingId } });

    return { followerCount: await changeFollowerCount(tx, followingId, -count), removed };
  });

  pushRemoved(removed);
  return { following: false, followerCount };
}

// 목록 한 줄에 실을 사람 - 보는 사람이 이 사람을 팔로우하는 행도 센다(프로필 헤더와 같은 방법).
function personFieldsFor(viewerId) {
  return {
    id: true,
    username: true,
    name: true,
    profileImage: true,
    _count: { select: { followers: { where: { followerId: viewerId } } } },
  };
}

// 센 수를 «보는 사람이 이 사람을 팔로우하고 있나» 로 바꾼다.
function toPerson({ _count, ...person }) {
  return { ...person, isFollowing: _count.followers > 0 };
}

// 목록은 «팔로우한 시각이 늦은 순, 같으면 행 번호가 큰 순» 이다 - 게시물 목록과 같은 차례라 조건도 같다.
// 커서 다음 행은 시각이 더 이르거나, 시각이 같고 번호가 더 작은 행이다.
function afterCursor({ createdAt, id }) {
  return {
    createdAt: { lte: createdAt },
    OR: [{ createdAt: { lt: createdAt } }, { id: { lt: id } }],
  };
}

// 두 목록은 follows 를 반대 방향으로 읽는다.
// by - 그 사람의 번호가 들어 있는 컬럼 · person - 그 행에서 꺼내 보여 줄 사람
const LISTS = {
  // 팔로워 - 그 사람이 팔로우받은 행에서, 팔로우한 사람을 꺼낸다.
  followers: { by: 'followingId', person: 'follower' },
  // 팔로잉 - 그 사람이 팔로우한 행에서, 팔로우받은 사람을 꺼낸다.
  following: { by: 'followerId', person: 'following' },
};

// 그 사람의 팔로워 목록이나 팔로잉 목록 - 가장 최근에 팔로우한 행이 먼저다. 한 번에 limit 명씩 나눠 준다.
// 줄마다 «보는 사람(viewerId)이 이 사람을 팔로우하고 있나» 를 함께 싣는다.
export async function getFollowList(username, list, viewerId, { limit = 20, cursor }) {
  const userId = await findUserId(username);
  const { by, person } = LISTS[list];

  const rows = await prisma.follow.findMany({
    where: {
      [by]: userId,
      // 커서는 사람이 아니라 «follows 의 행» 을 가리킨다 - 차례를 정하는 값이 그 행의 시각과 번호라서.
      ...(cursor ? afterCursor(decodeCursor(cursor)) : {}),
    },
    select: { id: true, createdAt: true, [person]: { select: personFieldsFor(viewerId) } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
  });

  const hasNext = rows.length > limit;
  const page = rows.slice(0, limit);

  return {
    items: page.map((row) => toPerson(row[person])),
    hasNext,
    nextCursor: hasNext ? encodeCursor(page[page.length - 1]) : null,
  };
}
