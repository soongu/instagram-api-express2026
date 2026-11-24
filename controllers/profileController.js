// ~/instagram-api/controllers/profileController.js
import * as userService from '../services/userService.js';
import * as postService from '../services/postService.js';
import { sendData } from '../responses.js';

export async function show(req, res) {
  const profile = await userService.getProfile(req.params.username);

  sendData(res, profile);
}

export async function posts(req, res) {
  const { limit, cursor } = res.locals.query;
  const page = await postService.getUserPosts(req.params.username, { limit, cursor });

  sendData(res, page);
}
