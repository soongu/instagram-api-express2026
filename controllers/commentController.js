// ~/instagram-api/controllers/commentController.js
import * as commentService from '../services/commentService.js';
import { sendData } from '../responses.js';

export async function list(req, res) {
  const { limit, cursor } = res.locals.query;
  const page = await commentService.getComments(req.postId, { limit, cursor });

  sendData(res, page);
}

export async function create(req, res) {
  // 글쓴이는 게시물 만들기처럼 본문이 아니라 로그인 정보로 정한다.
  const comment = await commentService.createComment(req.postId, res.locals.userId, req.body.content);

  // 댓글 하나를 받는 주소가 없어서 Location 헤더는 싣지 않는다.
  res.status(201);
  sendData(res, comment);
}

export async function remove(req, res) {
  const result = await commentService.removeComment(req.postId, req.commentId, res.locals.userId);

  sendData(res, result);
}
