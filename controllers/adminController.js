// ~/instagram-api/controllers/adminController.js
import * as userService from '../services/userService.js';
import { sendData } from '../responses.js';

export async function listUsers(req, res) {
  const users = await userService.getUsers();

  sendData(res, users);
}

// 역할을 바꿀 사람은 주소의 번호(req.userId)다 — 요청을 보낸 관리자(res.locals.userId)와 다르다.
export async function changeRole(req, res) {
  const user = await userService.setRole(req.userId, req.body.role);

  sendData(res, user);
}
