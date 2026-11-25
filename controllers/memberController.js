// ~/instagram-api/controllers/memberController.js
import * as userService from '../services/userService.js';
import { sendData } from '../responses.js';

export async function search(req, res) {
  const members = await userService.searchMembers(res.locals.query.keyword);

  sendData(res, members);
}

// 로그인한 사람의 프로필 사진을 바꾼다 - 누구의 사진인지는 주소가 아니라 로그인 정보로 정한다.
export async function updateProfileImage(req, res) {
  const profile = await userService.updateProfileImage(res.locals.userId, req.body.imageUrl);

  sendData(res, profile);
}
