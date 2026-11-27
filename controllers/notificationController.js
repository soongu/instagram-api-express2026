// ~/instagram-api/controllers/notificationController.js
import * as notificationService from '../services/notificationService.js';
import { sendData } from '../responses.js';

// 내 알림 목록 - 누구의 알림인지는 로그인 정보로 정한다.
export async function list(req, res) {
  const page = await notificationService.getNotifications(res.locals.userId, res.locals.query);

  sendData(res, page);
}
