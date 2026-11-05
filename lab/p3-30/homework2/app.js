// ~/instagram-api/lab/p3-30/homework2/app.js
import express from 'express';
import { logger } from '../../../middlewares/logger.js';
import noticeRouter from './routes/notices.js';
import adminRouter from './routes/admin.js';

const app = express();

app.use(logger);
app.use(express.json());

app.use('/api', noticeRouter);
app.use('/api/admin', adminRouter);

app.use((req, res) => {
  res.status(404).json({ message: '그런 주소는 없어요' });
});

app.listen(4012, () => {
  console.log('실습 서버가 4012번 포트에서 기다리고 있어요.');
});
