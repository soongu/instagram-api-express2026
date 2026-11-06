// ~/instagram-api/lab/p3-33/homework2.js
import express from 'express';
import { z } from 'zod';
import { prisma } from '../../db.js';
import { validateQuery } from '../../middlewares/validate.js';
import { BadRequestError, HttpError } from '../../errors.js';

const app = express();

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
  cursor: z.string().optional(),
});
const cursorSchema = z.object({
  likeCount: z.number().int(),
  id: z.number().int(),
});

function encodeCursor({ likeCount, id }) {
  return Buffer.from(JSON.stringify({ likeCount, id })).toString('base64url');
}

function decodeCursor(cursor) {
  try {
    return cursorSchema.parse(JSON.parse(Buffer.from(cursor, 'base64url').toString()));
  } catch {
    throw new BadRequestError('커서 값이 올바르지 않아요');
  }
}

function afterCursor({ likeCount, id }) {
  return {
    likeCount: { lte: likeCount },
    OR: [{ likeCount: { lt: likeCount } }, { id: { lt: id } }],
  };
}

app.get('/api/popular-posts', validateQuery(querySchema), async (req, res) => {
  const { limit = 20, cursor } = res.locals.query;
  const posts = await prisma.post.findMany({
    where: cursor ? afterCursor(decodeCursor(cursor)) : {},
    select: { id: true, content: true, likeCount: true },
    orderBy: [{ likeCount: 'desc' }, { id: 'desc' }],
    take: limit + 1,
  });

  const hasNext = posts.length > limit;
  const page = posts.slice(0, limit);

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

app.listen(4012, () => {
  console.log('인기 게시물 서버가 4012번 포트에서 기다리고 있어요.');
});
