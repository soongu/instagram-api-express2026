// ~/instagram-api/controllers/profileController.js
import * as userService from '../services/userService.js';
import { sendData } from '../responses.js';

export async function show(req, res) {
  const profile = await userService.getProfile(req.params.username);

  sendData(res, profile);
}
