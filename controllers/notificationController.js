// ~/instagram-api/controllers/notificationController.js
import * as notificationService from '../services/notificationService.js';
import { sendData } from '../responses.js';

// 내 알림 목록 - 누구의 알림인지는 로그인 정보로 정한다.
export async function list(req, res) {
  const page = await notificationService.getNotifications(res.locals.userId, res.locals.query);

  sendData(res, page);
}

// 아직 안 본 알림의 수 - 화면은 사이드바 «알림» 의 빨간 점을 그릴 때 부른다.
export async function unseen(req, res) {
  const result = await notificationService.countUnseen(res.locals.userId);

  sendData(res, result);
}

// 알림 패널을 열었다 - 화면은 패널을 열 때 부른다.
export async function seen(req, res) {
  const result = await notificationService.markSeen(res.locals.userId);

  sendData(res, result);
}

// 알림 하나를 읽음으로 - 화면은 알림 패널에서 그 알림을 누를 때 부른다.
export async function read(req, res) {
  const result = await notificationService.markAsRead(req.notificationId, res.locals.userId);

  sendData(res, result);
}
