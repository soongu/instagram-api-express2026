// ~/instagram-api/controllers/conversationController.js
import * as conversationService from '../services/conversationService.js';
import { sendData } from '../responses.js';

// 대화방을 연다 - 새로 만들었으면 201 과 그 방의 주소, 이미 있던 방이면 200 이다.
export async function create(req, res) {
  const { created, conversation } = await conversationService.openConversation(req.body.username, res.locals.userId);

  if (created) res.status(201).location(`${req.baseUrl}/${conversation.id}`);

  sendData(res, conversation);
}

// 내 대화방 목록 - 누구의 목록인지는 로그인 정보로 정한다.
export async function list(req, res) {
  const page = await conversationService.getConversations(res.locals.userId, res.locals.query);

  sendData(res, page);
}

// 안 읽은 메시지가 있는 내 대화방 수
export async function unread(req, res) {
  const result = await conversationService.countUnreadConversations(res.locals.userId);

  sendData(res, result);
}

// 대화방 하나 - 그 방에 참여한 사람만 받는다.
export async function get(req, res) {
  const conversation = await conversationService.getConversation(req.conversationId, res.locals.userId);

  sendData(res, conversation);
}

// 그 대화방의 메시지 이력 - 그 방에 참여한 사람만 받는다.
export async function messages(req, res) {
  const page = await conversationService.getMessages(req.conversationId, res.locals.userId, res.locals.query);

  sendData(res, page);
}

// 그 대화방에서 상대가 보낸 메시지를 읽음으로 - 화면은 대화방을 열 때 한 번 부른다.
export async function read(req, res) {
  const result = await conversationService.markAsRead(req.conversationId, res.locals.userId);

  sendData(res, result);
}

// 대화방을 내 쪽에서만 지운다 - 돌려줄 것이 없어 204 다.
export async function remove(req, res) {
  await conversationService.clearConversation(req.conversationId, res.locals.userId);

  res.status(204).end();
}
