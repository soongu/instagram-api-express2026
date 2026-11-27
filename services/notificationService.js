// ~/instagram-api/services/notificationService.js
import { prisma } from '../db.js';
import { encodeCursor, decodeCursor } from '../utils/cursor.js';
import { NotFoundError } from '../errors.js';
import { emitToUsers } from '../realtime.js';

// 알림 하나를 남긴다 - 좋아요·댓글·팔로우를 넣는 그 트랜잭션 안에서 부르는 함수라 넘겨받은 tx 로 쓴다.
// 내 게시물에 내가 누른 좋아요처럼 받는 사람이 곧 보낸 사람이면 남기지 않는다.
// 알림을 남긴 행(좋아요 · 댓글 · 팔로우 가운데 하나)의 번호도 함께 적는다 - 그 행이 지워지면 데이터베이스가 알림도 지운다.
// 보내지는 않고 남긴 알림의 번호만 돌려준다 - 트랜잭션이 끝난(커밋된) 뒤에 pushNew 로 보낸다.
export async function notify(tx, { type, receiverId, senderId, postId, postLikeId, commentId, followId }) {
  if (receiverId === senderId) return [];

  const { id } = await tx.notification.create({
    data: { type, receiverId, senderId, postId, postLikeId, commentId, followId },
    select: { id: true },
  });
  return [id];
}

// 같은 알림을 여러 사람에게 한 번에 남긴다 - 댓글 하나에 여러 사람을 멘션했을 때 쓴다.
// 보낸 사람 자신은 이번에도 뺀다.
export async function notifyMany(tx, { type, receiverIds, senderId, postId, commentId }) {
  // 받는 사람의 번호 차례로 남긴다 - 몇 번을 돌려도 같은 차례로 행이 들어간다.
  const data = [...receiverIds]
    .sort((a, b) => a - b)
    .filter((receiverId) => receiverId !== senderId)
    .map((receiverId) => ({ type, receiverId, senderId, postId, commentId }));

  // createManyAndReturn 은 넣은 행들을 돌려준다 - notify 처럼 번호만 돌려준다.
  const notifications = await tx.notification.createManyAndReturn({ data, select: { id: true } });
  return notifications.map((notification) => notification.id);
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

// 트랜잭션이 끝난 뒤에 부른다 - 남긴 알림을 데이터베이스에서 다시 읽어 받는 사람의 연결에 보낸다.
// 커밋된 알림만 읽히니 되돌려진 알림은 보낼 일이 없다.
export async function pushNew(ids) {
  if (ids.length === 0) return;

  // 좋아요·댓글은 이미 저장됐다. 알림을 못 보냈다고 그 요청을 실패로 돌려주지 않는다.
  try {
    const notifications = await prisma.notification.findMany({
      where: { id: { in: ids } },
      select: { receiverId: true, ...notificationFields },
    });
    notifications.forEach(({ receiverId, ...notification }) => {
      emitToUsers([receiverId], 'notification:new', toNotification(notification));
    });
  } catch (error) {
    console.warn(`알림을 보내지 못했어요 - ${error.message}`);
  }
}

// 좋아요·팔로우·댓글을 지우기 «전에» 부른다 - 그 행이 남긴 알림은 행과 함께 지워져서(Cascade) 지운 뒤에는 찾을 수 없다.
export function findCaused(tx, where) {
  return tx.notification.findMany({ where, select: { id: true, receiverId: true } });
}

// 트랜잭션이 끝난 뒤에 부른다 - 사라진 알림의 번호를 받는 사람의 연결에 보낸다.
export function pushRemoved(notifications) {
  notifications.forEach(({ id, receiverId }) => {
    emitToUsers([receiverId], 'notification:removed', { id });
  });
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

// 아직 안 본 알림의 수 - 알림 패널을 마지막으로 연 뒤에 온 알림이다. 한 번도 안 열었으면 받은 알림 전부다.
// 읽음(isRead)과는 따로 센다. 패널을 열어 봤어도 누르지 않은 알림은 여전히 안 읽은 알림이다.
export async function countUnseen(myId) {
  const { notificationsSeenAt } = await prisma.user.findUnique({
    where: { id: myId },
    select: { notificationsSeenAt: true },
  });

  const unseenCount = await prisma.notification.count({
    where: { receiverId: myId, ...(notificationsSeenAt ? { createdAt: { gt: notificationsSeenAt } } : {}) },
  });

  return { unseenCount };
}

// 알림 패널을 열었다 - 지금까지 온 알림을 모두 «본» 것으로 친다. 알림 하나하나의 읽음은 바꾸지 않는다.
export async function markSeen(myId) {
  await prisma.user.update({ where: { id: myId }, data: { notificationsSeenAt: new Date() } });

  return { unseenCount: 0 };
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
