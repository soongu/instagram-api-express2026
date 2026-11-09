// ~/instagram-api/app.js
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import postsRouter from './routes/posts.js';
import likesRouter from './routes/likes.js';
import authRouter from './routes/auth.js';
import uploadsRouter from './routes/uploads.js';
import { HttpError } from './errors.js';
import { logger } from './middlewares/logger.js';
import swaggerUi from 'swagger-ui-express';
import { openapi } from './docs/openapi.js';

const app = express();

const allowedOrigins = process.env.CORS_ORIGIN.split(',').map((one) => one.trim());

app.use(logger);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());
app.use(cookieParser());

// 올린 사진 파일을 주소로 내보낸다 — /uploads/파일 이름 은 uploads 폴더의 그 파일이다.
app.use('/uploads', express.static('uploads'));

app.get('/', (req, res) => {
  res.send('인스타그램 서버가 살아 있어요');
});

// 실험 — 게시물 응답을 60초 동안 서버에 확인하지 않고 쓰게 해 본다(Step 3 에서 바꾼다).
app.use('/api/posts', (req, res, next) => {
  res.set('Cache-Control', 'max-age=60');
  next();
});

app.use('/api/posts', postsRouter);
app.use('/api/posts/:id/likes', likesRouter);
app.use('/api/auth', authRouter);
app.use('/api/uploads', uploadsRouter);

// API 문서 — 사람은 /api/docs 화면으로, 프로그램은 /api/openapi.json 으로 읽는다.
app.get('/api/openapi.json', (req, res) => {
  res.json(openapi);
});
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi));

app.use((req, res) => {
  res.status(404).json({ message: '그런 주소는 없어요' });
});

app.use((err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

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
