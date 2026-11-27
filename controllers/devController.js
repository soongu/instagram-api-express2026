// ~/instagram-api/controllers/devController.js
import * as userService from '../services/userService.js';
import { dropConnections } from '../realtime.js';
import { sendData } from '../responses.js';

// 개발용 - 그 사람의 실시간 연결을 끊고 잠깐 다시 붙지 못하게 한다(«연결이 끊긴 사이» 를 만들어 보려고).
export async function dropUserConnections(req, res) {
  const userId = await userService.findUserIdByUsername(req.params.username);
  const { seconds = 10 } = res.locals.query;

  const closedCount = dropConnections(userId, seconds);

  sendData(res, { closedCount, blockedSeconds: seconds });
}
