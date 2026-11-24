// ~/instagram-api/controllers/memberController.js
import * as userService from '../services/userService.js';
import { sendData } from '../responses.js';

export async function search(req, res) {
  const members = await userService.searchMembers(res.locals.query.keyword);

  sendData(res, members);
}
