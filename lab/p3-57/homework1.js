// ~/instagram-api/lab/p3-57/homework1.js
import express from 'express';
import { z } from 'zod';
import { prisma } from '../../db.js';
import { validateQuery } from '../../middlewares/validate.js';
import { HttpError } from '../../errors.js';

const app = express();

// 추천 주소의 쿼리 문자열 - 접두사는 없어도 되고, 개수는 1~10(없으면 5).
const suggestionsQuerySchema = z.object({
  prefix: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(10).optional(),
});

// 글을 쓸 때 보여 줄 해시태그 - 붙은 게시물이 많은 것부터. 수가 같으면 이름 차례.
// 붙은 게시물이 하나도 없는 태그는 추천하지 않는다.
app.get('/api/hashtags/suggestions', validateQuery(suggestionsQuerySchema), async (req, res) => {
  const { prefix = '', limit = 5 } = res.locals.query;
  // 접두사도 저장한 이름처럼 맞춘다 - 앞의 # 을 떼고 소문자로.
  const start = prefix.replace(/^#/, '').toLowerCase();

  const hashtags = await prisma.hashtag.findMany({
    where: { name: { startsWith: start }, postCount: { gt: 0 } },
    select: { name: true, postCount: true },
    orderBy: [{ postCount: 'desc' }, { name: 'asc' }],
    take: limit,
  });

  res.json(hashtags);
});

// 이 서버의 실패는 { message } 하나로 답한다.
app.use((err, req, res, next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ message: err.message });
    return;
  }

  console.error(err);
  res.status(500).json({ message: '서버에서 문제가 생겼어요' });
});

app.listen(4001, () => {
  console.log('해시태그 추천 서버가 4001번 포트에서 기다리고 있어요.');
});
