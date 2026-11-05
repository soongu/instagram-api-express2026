// ~/instagram-api/lab/p3-28/practice2.js
import express from 'express';
import { z } from 'zod';
import { logger } from '../../middlewares/logger.js';
import { validateQuery } from '../../middlewares/validate.js';
import { HttpError } from '../../errors.js';

const app = express();

app.use(logger);

const members = [
  { id: 1, username: 'jaehoon' },
  { id: 2, username: 'minji' },
  { id: 3, username: 'dahye' },
  { id: 4, username: 'minseo' },
];

const searchSchema = z.object({
  keyword: z.string().trim().min(1),
});

app.get('/api/members', validateQuery(searchSchema), (req, res) => {
  const { keyword } = res.locals.query;

  res.json(members.filter((one) => one.username.includes(keyword)));
});

app.use((err, req, res, next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ message: err.message });
    return;
  }

  console.error(err);
  res.status(500).json({ message: '서버에서 문제가 생겼어요' });
});

app.listen(4002, () => {
  console.log('실습 서버가 4002번 포트에서 기다리고 있어요.');
});
