// ~/instagram-api/controllers/conversationController.js
import * as conversationService from '../services/conversationService.js';
import { sendData } from '../responses.js';

// 대화방을 연다 - 새로 만들었으면 201 과 그 방의 주소, 이미 있던 방이면 200 이다.
export async function create(req, res) {
  const { created, conversation } = await conversationService.openConversation(req.body.username, res.locals.userId);

  if (created) res.status(201).location(`${req.baseUrl}/${conversation.id}`);

  sendData(res, conversation);
}
