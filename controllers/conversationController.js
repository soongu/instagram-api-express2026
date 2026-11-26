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
