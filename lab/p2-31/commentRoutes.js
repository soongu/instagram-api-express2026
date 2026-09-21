// ~/instagram-api/lab/commentRoutes.js
import express from 'express';
import * as commentService from './commentService.js';

const router = express.Router();

function parseId(req, res, next) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    res.status(404).json({ message: '그런 댓글은 없어요' });
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

  if (!comment) {
    res.status(404).json({ message: '그런 댓글은 없어요' });
    return;
  }

  res.json(comment);
});

router.delete('/:id', parseId, async (req, res) => {
  const deleted = await commentService.removeComment(req.commentId);

  if (!deleted) {
    res.status(404).json({ message: '그런 댓글은 없어요' });
    return;
  }

  res.json(deleted);
});

export default router;
