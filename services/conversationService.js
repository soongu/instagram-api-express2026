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
        // 내가 a 자리에 있는 방과 b 자리에 있는 방
        { OR: [{ participantAId: myId }, { participantBId: myId }] },
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
    select: { id: true, participantAId: true, participantBId: true },
  });

  if (!conversation) throw new NotFoundError('CONVERSATION_NOT_FOUND');

  if (conversation.participantAId !== myId && conversation.participantBId !== myId) {
    console.warn(`${conversationId}번 대화방은 ${myId}번 사용자의 방이 아니라서 404 로 답했어요.`);
    throw new NotFoundError('CONVERSATION_NOT_FOUND');
  }

  return conversation;
}

// 이력 한 줄 - 목록의 마지막 메시지와 같은 값에 «받는 사람이 읽었나» 를 더한다.
const historyFields = { ...messageFields, isRead: true };

// 대화방의 메시지 - 가장 최근 메시지가 먼저다. 화면은 위로 올릴 때마다 그 앞을 limit 개씩 더 받는다.
export async function getMessages(conversationId, myId, { limit = 20, cursor }) {
  await findMyConversation(conversationId, myId);

  const rows = await prisma.directMessage.findMany({
    where: {
      conversationId,
      ...(cursor ? afterCursor(decodeCursor(cursor)) : {}),
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
