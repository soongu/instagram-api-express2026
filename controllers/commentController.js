// ~/instagram-api/controllers/commentController.js
import * as commentService from '../services/commentService.js';
import { sendData } from '../responses.js';

export async function list(req, res) {
  const comments = await commentService.getComments(req.postId);

  sendData(res, comments);
}
