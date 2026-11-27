// ~/instagram-api/services/notificationService.js
import { prisma } from '../db.js';
import { encodeCursor, decodeCursor } from '../utils/cursor.js';
import { NotFoundError } from '../errors.js';

// 알림 하나를 남긴다 - 좋아요·댓글·팔로우를 넣는 그 트랜잭션 안에서 부르는 함수라 넘겨받은 tx 로 쓴다.
// 내 게시물에 내가 누른 좋아요처럼 받는 사람이 곧 보낸 사람이면 남기지 않는다.
// 알림을 남긴 행(좋아요 · 댓글 · 팔로우 가운데 하나)의 번호도 함께 적는다 - 그 행이 지워지면 데이터베이스가 알림도 지운다.
export async function notify(tx, { type, receiverId, senderId, postId, postLikeId, commentId, followId }) {
  if (receiverId === senderId) return;

  await tx.notification.create({ data: { type, receiverId, senderId, postId, postLikeId, commentId, followId } });
}

// 같은 알림을 여러 사람에게 한 번에 남긴다 - 댓글 하나에 여러 사람을 멘션했을 때 쓴다.
// 보낸 사람 자신은 이번에도 뺀다.
export async function notifyMany(tx, { type, receiverIds, senderId, postId, commentId }) {
  // 받는 사람의 번호 차례로 남긴다 - 몇 번을 돌려도 같은 차례로 행이 들어간다.
  const data = [...receiverIds]
    .sort((a, b) => a - b)
    .filter((receiverId) => receiverId !== senderId)
    .map((receiverId) => ({ type, receiverId, senderId, postId, commentId }));

  await tx.notification.createMany({ data });
}

// 알림 한 줄의 문장 - 저장하지 않고 응답할 때 종류와 보낸 사람의 이름으로 만든다.
const MESSAGE_OF = {
  LIKE: (username) => `${username}님이 회원님의 게시물을 좋아해요`,
  COMMENT: (username) => `${username}님이 회원님의 게시물에 댓글을 남겼어요`,
  FOLLOW: (username) => `${username}님이 회원님을 팔로우하기 시작했어요`,
  MENTION: (username) => `${username}님이 댓글에서 회원님을 언급했어요`,
};

// 목록 한 줄에 실을 필드 - 보낸 사람과, 게시물이 있으면 그 게시물의 첫 사진을 함께 받는다.
const notificationFields = {
  id: true,
  type: true,
  isRead: true,
  createdAt: true,
  postId: true,
  sender: { select: { id: true, username: true, profileImage: true } },
  post: { select: { images: { select: { imageUrl: true }, orderBy: { imgOrder: 'asc' }, take: 1 } } },
};

// 받은 행을 응답 모양으로 바꾼다 - 게시물의 첫 사진은 thumbnailUrl 로, 문장은 message 로.
function toNotification({ post, ...notification }) {
  return {
    ...notification,
    thumbnailUrl: post?.images[0]?.imageUrl ?? null,
    message: MESSAGE_OF[notification.type](notification.sender.username),
  };
}

// 목록은 «남긴 시각이 늦은 순, 같으면 번호가 큰 순» 이다 - 게시물 목록과 같은 차례라 조건도 같다.
function afterCursor({ createdAt, id }) {
  return {
    createdAt: { lte: createdAt },
    OR: [{ createdAt: { lt: createdAt } }, { id: { lt: id } }],
  };
}

// 내 알림 목록 - 가장 최근 알림이 먼저다. 한 번에 limit 개씩 나눠 준다.
export async function getNotifications(myId, { limit = 20, cursor }) {
  const rows = await prisma.notification.findMany({
    where: { receiverId: myId, ...(cursor ? afterCursor(decodeCursor(cursor)) : {}) },
    select: notificationFields,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
  });

  const hasNext = rows.length > limit;
  const page = rows.slice(0, limit);

  return {
    items: page.map(toNotification),
    hasNext,
    nextCursor: hasNext ? encodeCursor(page[page.length - 1]) : null,
  };
}

// 알림 하나를 읽음으로 - 몇 번을 불러도 결과는 «읽은 상태» 하나다.
// 내가 받은 알림만 찾는다. 없는 알림과 남의 알림은 같은 404 로 답한다 - 남의 알림이 있는지 알려 주지 않는다.
export async function markAsRead(notificationId, myId) {
  const { count } = await prisma.notification.updateMany({
    where: { id: notificationId, receiverId: myId },
    data: { isRead: true },
  });

  if (count === 0) throw new NotFoundError('NOTIFICATION_NOT_FOUND');

  return { id: notificationId, isRead: true };
}
