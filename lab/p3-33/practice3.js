// ~/instagram-api/lab/p3-33/practice3.js
import express from 'express';
import { z } from 'zod';
import { prisma } from '../../db.js';
import { validateQuery } from '../../middlewares/validate.js';
import { BadRequestError, HttpError } from '../../errors.js';

const app = express();

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).optional(),
  cursor: z.string().optional(),
});
const cursorSchema = z.object({
  createdAt: z.coerce.date(),
  id: z.number().int(),
});

function encodeCursor({ createdAt, id }) {
  return Buffer.from(JSON.stringify({ createdAt, id })).toString('base64url');
}

function decodeCursor(cursor) {
  try {
    return cursorSchema.parse(JSON.parse(Buffer.from(cursor, 'base64url').toString()));
  } catch {
    throw new BadRequestError('커서 값이 올바르지 않아요');
  }
}

// 댓글은 오래된 순이다 — 게시물 목록과 정렬 방향이 반대라서 비교도 반대로 뒤집는다.
function afterCursor({ createdAt, id }) {
  return {
    createdAt: { gte: createdAt },
    OR: [{ createdAt: { gt: createdAt } }, { id: { gt: id } }],
  };
}

app.get('/api/posts/:id/comments', validateQuery(querySchema), async (req, res) => {
  const { limit = 10, cursor } = res.locals.query;
  const comments = await prisma.comment.findMany({
    where: {
      postId: Number(req.params.id),
      parentId: null,
      ...(cursor ? afterCursor(decodeCursor(cursor)) : {}),
    },
    select: { id: true, content: true, createdAt: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: limit + 1,
  });

  const hasNext = comments.length > limit;
  const page = comments.slice(0, limit);

  res.json({
    items: page,
    hasNext,
    nextCursor: hasNext ? encodeCursor(page[page.length - 1]) : null,
  });
});

app.use((err, req, res, next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ message: err.message });
    return;
  }

  console.error(err);
  res.status(500).json({ message: '서버에서 문제가 생겼어요' });
});

app.listen(4003, () => {
  console.log('댓글 서버가 4003번 포트에서 기다리고 있어요.');
});
