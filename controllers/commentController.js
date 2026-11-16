// ~/instagram-api/controllers/commentController.js
import * as commentService from '../services/commentService.js';
import { sendData } from '../responses.js';

export async function list(req, res) {
  const { limit, cursor } = res.locals.query;
  const page = await commentService.getComments(req.postId, { limit, cursor });

  sendData(res, page);
}
