// ~/instagram-api/lab/commentRoutes.js
import express from 'express';
import * as commentService from './commentService.js';
import { validateBody } from '../middlewares/validate.js';
import { commentCreateSchema } from './commentSchema.js';
import { NotFoundError } from '../errors.js';

const router = express.Router();

function parseId(req, res, next) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    next(new NotFoundError('그런 댓글은 없어요'));
    return;
  }

  req.commentId = id;
  next();
}

router.get('/', async (req, res) => {
  const comments = await commentService.getComments({
    postId: Number(req.query.postId) || undefined,
  });

  res.json(comments);
});

router.get('/:id', parseId, async (req, res) => {
  const comment = await commentService.getComment(req.commentId);

  res.json(comment);
});

router.post('/', validateBody(commentCreateSchema), async (req, res) => {
  const created = await commentService.createComment(req.body);

  res.status(201).json(created);
});

router.delete('/:id', parseId, async (req, res) => {
  const deleted = await commentService.removeComment(req.commentId);

  res.json(deleted);
});

export default router;
