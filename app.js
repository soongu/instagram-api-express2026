// ~/instagram-api/app.js
import express from 'express';
import cors from 'cors';
import postsRouter from './routes/posts.js';
import authRouter from './routes/auth.js';
import { HttpError } from './errors.js';
import cookieParser from 'cookie-parser';

const app = express();

const allowedOrigins = process.env.CORS_ORIGIN.split(',').map((one) => one.trim());

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get('/', (req, res) => {
  res.send('인스타그램 서버가 살아 있어요');
});

app.use('/api/posts', postsRouter);
app.use('/api/auth', authRouter);

app.use((req, res) => {
  res.status(404).json({ message: '그런 주소는 없어요' });
});

app.use((err, req, res, next) => {
  if (err instanceof HttpError) {
    const body = { message: err.message };
    if (err.details) body.details = err.details;
    res.status(err.status).json(body);
    return;
  }

  if (err.status) {
    res.status(err.status).json({ message: '보낸 내용을 읽을 수 없어요' });
    return;
  }

  console.error(err);
  res.status(500).json({ message: '서버에서 문제가 생겼어요' });
});

const PORT = process.env.PORT ?? 3000;

app.listen(PORT, () => {
  console.log(`서버가 ${PORT}번 포트에서 기다리고 있어요.`);
});
