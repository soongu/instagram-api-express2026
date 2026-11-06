// ~/instagram-api/lab/p3-33/homework1.js
import express from 'express';
import { z } from 'zod';
import { prisma } from '../../db.js';
import { validateQuery } from '../../middlewares/validate.js';
import { HttpError } from '../../errors.js';

const app = express();

const pageSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  size: z.coerce.number().int().min(1).max(50).optional(),
});

app.get('/api/admin/posts', validateQuery(pageSchema), async (req, res) => {
  const { page = 1, size = 20 } = res.locals.query;
  const [items, totalCount] = await Promise.all([
    prisma.post.findMany({
      select: { id: true, content: true, createdAt: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * size,
      take: size,
    }),
    prisma.post.count(),
  ]);

  res.json({ items, page, size, totalCount, totalPages: Math.ceil(totalCount / size) });
});

app.use((err, req, res, next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ message: err.message });
    return;
  }

  console.error(err);
  res.status(500).json({ message: '서버에서 문제가 생겼어요' });
});

app.listen(4011, () => {
  console.log('관리자 목록 서버가 4011번 포트에서 기다리고 있어요.');
});
