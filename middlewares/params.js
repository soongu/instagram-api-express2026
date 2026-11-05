// ~/instagram-api/middlewares/params.js
import { NotFoundError } from '../errors.js';

export function parseId(req, res, next) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    next(new NotFoundError('그런 게시물은 없어요'));
    return;
  }

  req.postId = id;
  next();
}

export function parseUserId(req, res, next) {
  const userId = Number(req.params.userId);

  if (!Number.isInteger(userId)) {
    next(new NotFoundError('그런 사용자는 없어요'));
    return;
  }

  req.userId = userId;
  next();
}
