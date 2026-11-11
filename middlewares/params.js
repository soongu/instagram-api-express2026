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
