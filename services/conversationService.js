// ~/instagram-api/services/conversationService.js
import { prisma } from '../db.js';
import { NotFoundError } from '../errors.js';

// 사용자 이름으로 사람의 번호를 찾는다 - 없으면 404 다.
async function findUserId(username) {
  const user = await prisma.user.findUnique({ where: { username }, select: { id: true } });

  if (!user) throw new NotFoundError('USER_NOT_FOUND');

  return user.id;
}

// 대화방 한 줄에 실을 사람 정보
const personFields = { id: true, username: true, name: true, profileImage: true };

// 대화방 한 줄 - 두 자리의 사람을 함께 받는다.
const conversationFields = {
  id: true,
  createdAt: true,
  participantA: { select: personFields },
  participantB: { select: personFields },
};

// 두 자리 가운데 내가 아닌 쪽이 상대다. 응답에는 상대만 싣는다.
function toConversation({ participantA, participantB, ...conversation }, myId) {
  return { ...conversation, otherUser: participantA.id === myId ? participantB : participantA };
}

// 그 사람과의 대화방을 연다 - 없으면 만들고, 있으면 있는 방을 준다.
export async function openConversation(username, myId) {
  const otherId = await findUserId(username);
  const pair = { participantAId: myId, participantBId: otherId };

  // 이미 있으면 행이 안 들어간다(count 0) - 팔로우할 때와 같은 방법이다.
  const { count } = await prisma.conversation.createMany({ data: [pair], skipDuplicates: true });

  const conversation = await prisma.conversation.findUnique({
    where: { participantAId_participantBId: pair },
    select: conversationFields,
  });

  return { created: count > 0, conversation: toConversation(conversation, myId) };
}
