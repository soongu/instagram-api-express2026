// ~/instagram-api/controllers/likeController.js
import { sendData } from '../responses.js';
import * as likeService from '../services/likeService.js';

export async function list(req, res) {
  const usernames = await likeService.getLikers(req.postId);

  sendData(res, usernames);
}

export async function like(req, res) {
  const status = await likeService.likePost(req.postId, req.userId);

  sendData(res, status);
}

export async function unlike(req, res) {
  const status = await likeService.unlikePost(req.postId, req.userId);

  sendData(res, status);
}
