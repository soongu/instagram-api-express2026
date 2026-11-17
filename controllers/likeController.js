// ~/instagram-api/controllers/likeController.js
import * as likeService from '../services/likeService.js';

export async function list(req, res) {
  const usernames = await likeService.getLikers(req.postId);

  res.json(usernames);
}

export async function like(req, res) {
  const status = await likeService.likePost(req.postId, req.userId);

  res.json(status);
}

export async function unlike(req, res) {
  const status = await likeService.unlikePost(req.postId, req.userId);

  res.json(status);
}
