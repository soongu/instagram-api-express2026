// ~/instagram-api/services/conversationService.js
import { prisma } from '../db.js';
import { BadRequestError, NotFoundError } from '../errors.js';
import { encodeCursor, decodeCursor } from '../utils/cursor.js';

// 사용자 이름으로 사람의 번호를 찾는다 - 없으면 404 다.
async function findUserId(username) {
  const user = await prisma.user.findUnique({ where: { username }, select: { id: true } });

  if (!user) throw new NotFoundError('USER_NOT_FOUND');

  return user.id;
}

// 대화방 한 줄에 실을 사람 정보
const personFields = { id: true, username: true, name: true, profileImage: true };

// 메시지 한 줄에 실을 값
const messageFields = { id: true, senderId: true, content: true, createdAt: true };

// 대화방 한 줄 - 두 자리의 사람과 가장 최근 메시지 하나를 함께 받는다.
const conversationFields = {
  id: true,
  createdAt: true,
  participantA: { select: personFields },
  participantB: { select: personFields },
  messages: { select: messageFields, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1 },
};

// 두 자리 가운데 내가 아닌 쪽이 상대다. 응답에는 상대만 싣는다.
// 메시지가 하나도 없는 방은 lastMessage 가 null 이다.
function toConversation({ participantA, participantB, messages, ...conversation }, myId) {
  return {
    ...conversation,
    otherUser: participantA.id === myId ? participantB : participantA,
    lastMessage: messages[0] ?? null,
  };
}

// 두 사람을 대화방의 두 자리에 놓는다 - 작은 번호가 언제나 a 자리다.
// 누가 먼저 열든 같은 두 사람은 같은 짝이 되어, UNIQUE 짝 하나로 방이 하나만 선다.
function pairOf(userId, otherId) {
  return userId < otherId
    ? { participantAId: userId, participantBId: otherId }
    : { participantAId: otherId, participantBId: userId };
}

// 그 사람과의 대화방을 연다 - 없으면 만들고, 있으면 있는 방을 준다.
export async function openConversation(username, myId) {
  const otherId = await findUserId(username);

  if (otherId === myId) throw new BadRequestError('CANNOT_MESSAGE_SELF');

  const pair = pairOf(myId, otherId);

  // 이미 있으면 행이 안 들어간다(count 0) - 팔로우할 때와 같은 방법이다.
  const { count } = await prisma.conversation.createMany({ data: [pair], skipDuplicates: true });

  const conversation = await prisma.conversation.findUnique({
    where: { participantAId_participantBId: pair },
    select: conversationFields,
  });

  return { created: count > 0, conversation: toConversation(conversation, myId) };
}

// 커서 다음 행은 시각이 더 이르거나, 시각이 같고 번호가 더 작은 행이다 - 게시물 목록과 같은 차례다.
function afterCursor({ createdAt, id }) {
  return {
    createdAt: { lte: createdAt },
    OR: [{ createdAt: { lt: createdAt } }, { id: { lt: id } }],
  };
}

// 내 대화방 목록 - 늦게 만든 방이 먼저다. 한 번에 limit 개씩 나눠 준다.
export async function getConversations(myId, { limit = 20, cursor }) {
  const rows = await prisma.conversation.findMany({
    where: {
      // 두 조건이 모두 OR 를 써서 한 객체에 펼치면 뒤의 OR 가 앞의 OR 를 덮는다 - AND 로 묶는다.
      AND: [
        // 내가 a 자리에 있고 지우지 않은 방과, b 자리에 있고 지우지 않은 방
        { OR: [{ participantAId: myId, aClearedAt: null }, { participantBId: myId, bClearedAt: null }] },
        cursor ? afterCursor(decodeCursor(cursor)) : {},
      ],
    },
    select: conversationFields,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
  });

  const hasNext = rows.length > limit;
  const page = rows.slice(0, limit);

  return {
    items: page.map((row) => toConversation(row, myId)),
    hasNext,
    nextCursor: hasNext ? encodeCursor(page[page.length - 1]) : null,
  };
}

// 내가 참여한 대화방을 찾는다 - 없는 방과 남의 방에 똑같이 404 로 답한다.
// 남의 방에 403 으로 답하면 «이 번호의 방은 있다» 를 알려 주게 된다. 진짜 이유는 서버 로그에만 남긴다.
async function findMyConversation(conversationId, myId) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, participantAId: true, participantBId: true, aClearedAt: true, bClearedAt: true },
  });

  if (!conversation) throw new NotFoundError('CONVERSATION_NOT_FOUND');

  if (conversation.participantAId !== myId && conversation.participantBId !== myId) {
    console.warn(`${conversationId}번 대화방은 ${myId}번 사용자의 방이 아니라서 404 로 답했어요.`);
    throw new NotFoundError('CONVERSATION_NOT_FOUND');
  }

  return conversation;
}

// 이 방에서 내 자리의 «지운 시각» - 내가 a 자리면 aClearedAt, b 자리면 bClearedAt 이다.
function myClearedAt(conversation, myId) {
  return conversation.participantAId === myId ? conversation.aClearedAt : conversation.bClearedAt;
}

// 이력 한 줄 - 목록의 마지막 메시지와 같은 값에 «받는 사람이 읽었나» 를 더한다.
const historyFields = { ...messageFields, isRead: true };

// 대화방의 메시지 - 가장 최근 메시지가 먼저다. 화면은 위로 올릴 때마다 그 앞을 limit 개씩 더 받는다.
export async function getMessages(conversationId, myId, { limit = 20, cursor }) {
  const conversation = await findMyConversation(conversationId, myId);
  const clearedAt = myClearedAt(conversation, myId);

  const rows = await prisma.directMessage.findMany({
    where: {
      // 두 조건이 모두 createdAt 을 쓰니 한 객체에 펼치지 않고 AND 로 묶는다.
      AND: [
        { conversationId },
        // 내가 지운 적이 있으면 그 뒤에 온 메시지만
        clearedAt ? { createdAt: { gt: clearedAt } } : {},
        cursor ? afterCursor(decodeCursor(cursor)) : {},
      ],
    },
    select: historyFields,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
  });

  const hasNext = rows.length > limit;
  const items = rows.slice(0, limit);

  return {
    items,
    hasNext,
    nextCursor: hasNext ? encodeCursor(items[items.length - 1]) : null,
  };
}

// 상대가 보낸 메시지 가운데 아직 안 읽은 것을 모두 읽음으로 바꾼다 - 바뀐 수를 돌려준다.
// 내가 보낸 메시지는 상대가 읽을 것이라 건드리지 않는다. 다시 불러도 바꿀 것이 없어 0 이다.
export async function markAsRead(conversationId, myId) {
  await findMyConversation(conversationId, myId);

  const { count } = await prisma.directMessage.updateMany({
    where: { conversationId, senderId: { not: myId }, isRead: false },
    data: { isRead: true },
  });

  return { readCount: count };
}

// 대화방을 «내 쪽에서만» 지운다 - 내 자리의 지운 시각을 지금으로 적는다. 상대의 기록은 그대로다.
// 두 사람이 모두 지운 메시지는 이제 아무에게도 안 보이니 그 메시지만 실제로 지운다.
export async function clearConversation(conversationId, myId) {
  const conversation = await findMyConversation(conversationId, myId);
  const field = conversation.participantAId === myId ? 'aClearedAt' : 'bClearedAt';

  const { aClearedAt, bClearedAt } = await prisma.conversation.update({
    where: { id: conversationId },
    data: { [field]: new Date() },
    select: { aClearedAt: true, bClearedAt: true },
  });

  if (aClearedAt && bClearedAt) {
    // 두 시각 가운데 이른 쪽까지가 «둘 다 지운» 메시지다.
    const both = aClearedAt < bClearedAt ? aClearedAt : bClearedAt;
    await prisma.directMessage.deleteMany({ where: { conversationId, createdAt: { lte: both } } });
  }
}

// 대화방에 메시지를 보낸다 - 보낸 사람은 연결이 열릴 때 확인한 사람이다.
// 저장한 메시지와 그 방의 두 사람 번호를 돌려준다. 두 사람에게만 알리려고.
export async function sendMessage(conversationId, myId, content) {
  // 이력을 줄 때와 같은 확인 - 없는 방과 남의 방이면 404 에러를 던진다.
  const conversation = await findMyConversation(conversationId, myId);

  // 메시지를 만들고 그 방의 «마지막 메시지» 도 고친다. 둘 중 하나만 되면 목록과 이력이 어긋나서 한 트랜잭션으로 묶는다.
  const message = await prisma.$transaction(async (tx) => {
    // 이벤트로 알릴 때 어느 방의 메시지인지 화면이 알아야 해서 대화방 번호를 함께 싣는다.
    const created = await tx.directMessage.create({
      data: { conversationId, senderId: myId, content },
      select: { conversationId: true, ...historyFields },
    });

    await tx.conversation.update({
      where: { id: conversationId },
      data: { lastMessageId: created.id, lastMessageAt: created.createdAt },
    });

    return created;
  });

  return { message, participantAId: conversation.participantAId, participantBId: conversation.participantBId };
}

// 이 대화방의 상대 번호 - 내가 참여한 방이 아니면 404 에러를 던진다.
export async function otherParticipantId(conversationId, myId) {
  const conversation = await findMyConversation(conversationId, myId);

  return conversation.participantAId === myId ? conversation.participantBId : conversation.participantAId;
}
