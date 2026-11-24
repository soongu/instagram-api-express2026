// ~/instagram-api/controllers/hashtagController.js
import * as postService from '../services/postService.js';
import { sendData } from '../responses.js';

export async function posts(req, res) {
  const { limit, cursor } = res.locals.query;
  const page = await postService.getHashtagPosts(req.params.name, { limit, cursor });

  sendData(res, page);
}
