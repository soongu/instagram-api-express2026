// ~/instagram-api/middlewares/params.js
import { NotFoundError } from '../errors.js';

export function parseId(req, res, next) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    next(new NotFoundError('POST_NOT_FOUND'));
    return;
  }

  req.postId = id;
  next();
}

export function parseUserId(req, res, next) {
  const userId = Number(req.params.userId);

  if (!Number.isInteger(userId)) {
    next(new NotFoundError('USER_NOT_FOUND'));
    return;
  }

  req.userId = userId;
  next();
}

export function parseCommentId(req, res, next) {
  const commentId = Number(req.params.commentId);

  if (!Number.isInteger(commentId)) {
    next(new NotFoundError('COMMENT_NOT_FOUND'));
    return;
  }

  req.commentId = commentId;
  next();
}
