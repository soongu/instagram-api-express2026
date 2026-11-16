// ~/instagram-api/lab/p3-33/homework2.js
import express from 'express';
import { z } from 'zod';
import { prisma } from '../../db.js';
import { validateQuery } from '../../middlewares/validate.js';
import { BadRequestError, HttpError } from '../../errors.js';

const app = express();

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
  cursor: z.string().min(1).optional(),
});
const cursorSchema = z.object({
  likeCount: z.int32(),
  id: z.int32(),
});

function encodeCursor({ likeCount, id }) {
  return Buffer.from(JSON.stringify({ likeCount, id })).toString('base64url');
}

function decodeCursor(cursor) {
  let value;

  // try 는 보낸 값 때문에 실패하는 줄만 감싼다 — 커서가 JSON 이 아니면 JSON.parse 가 던진다.
  // 더 넓게 감싸면 우리 코드의 실수(빠뜨린 import 같은 것)까지 400 으로 바뀌어 숨는다.
  try {
    value = JSON.parse(Buffer.from(cursor, 'base64url').toString());
  } catch {
    throw new BadRequestError('커서 값이 올바르지 않아요');
  }

  // 푼 값의 모양은 safeParse 로 검사한다 — 맞지 않아도 던지지 않고 결과로 알려 준다.
  const result = cursorSchema.safeParse(value);

  if (!result.success) throw new BadRequestError('커서 값이 올바르지 않아요');

  return result.data;
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
