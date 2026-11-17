// ~/instagram-api/app.js
import express from 'express';
import cors from 'cors';
import postsRouter from './routes/posts.js';
import authRouter from './routes/auth.js';
import likesRouter from './routes/likes.js';
import uploadsRouter from './routes/uploads.js';
import { HttpError } from './errors.js';
import cookieParser from 'cookie-parser';
import { logger } from './middlewares/logger.js';
import { privateNoCache } from './middlewares/cache.js';
import { openapi } from './docs/openapi.js';
import swaggerUi from 'swagger-ui-express';
import { apiVersion } from './middlewares/version.js';

const app = express();

const allowedOrigins = process.env.CORS_ORIGIN.split(',').map((one) =>
  one.trim(),
);


app.use(logger);
app.use(cors({
  origin: allowedOrigins,
  // credentials: true,
}));
app.use(express.json());

// 올린 사진 파일을 주소로 내보낸다 — /uploads/파일 이름 은 uploads 폴더의 그 파일이다.
// 파일 이름이 UUID 라 같은 주소의 내용이 바뀌지 않는다 — 1년 동안 서버에 확인하지 않고 쓰게 한다.
app.use('/uploads', express.static('uploads', { maxAge: '1y', immutable: true }));


app.use(cookieParser());


app.get('/', (req, res) => {
  res.send('인스타그램 서버가 살아 있어요');
});

// API 라우터 넷을 라우터 하나로 모은다 — 같은 API 를 두 주소에 붙이려고.
const api = express.Router();
api.use('/posts', postsRouter);
api.use('/posts/:id/likes', likesRouter);
api.use('/auth', authRouter);
api.use('/uploads', uploadsRouter);

// API 응답은 받아 둬도 되지만, 쓸 때마다 서버에 확인하게 한다.
app.use('/api', privateNoCache);
// 새 주소 — 버전 2 라고 적어 두고 같은 API 로 보낸다.
app.use('/api/v2', apiVersion(2), api);
// 옛 주소 — 이미 나간 화면들이 쓰는 주소라 그대로 둔다.
app.use('/api', api);

app.get('/api/openapi.json', (req, res) => {
  res.json(openapi);
});

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi));

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
