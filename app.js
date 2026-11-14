// ~/instagram-api/app.js
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import postsRouter from './routes/posts.js';
import likesRouter from './routes/likes.js';
import authRouter from './routes/auth.js';
import uploadsRouter from './routes/uploads.js';
import { HttpError, NotFoundError } from './errors.js';
import { sendError } from './responses.js';
import { logger } from './middlewares/logger.js';
import { privateNoCache } from './middlewares/cache.js';
import { apiVersion } from './middlewares/version.js';
import swaggerUi from 'swagger-ui-express';
import { openapi } from './docs/openapi.js';

const app = express();

const allowedOrigins = process.env.CORS_ORIGIN.split(',').map((one) => one.trim());

app.use(logger);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: allowedOrigins }));
// 새 주소로 온 요청이라는 것을 본문을 읽기 전에 적어 둔다 — 본문을 못 읽은 실패도 새 형식으로 답하려고.
app.use('/api/v2', apiVersion(2));
app.use(express.json());
app.use(cookieParser());

// 올린 사진 파일을 주소로 내보낸다 — /uploads/파일 이름 은 uploads 폴더의 그 파일이다.
// 파일 이름이 UUID 라 같은 주소의 내용이 바뀌지 않는다 — 1년 동안 서버에 확인하지 않고 쓰게 한다.
app.use('/uploads', express.static('uploads', { maxAge: '1y', immutable: true }));

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
// 새 주소 — 버전은 위에서 적어 두었다.
app.use('/api/v2', api);
// 옛 주소 — 이미 나간 화면들이 쓰는 주소라 그대로 둔다.
app.use('/api', api);

// API 문서 — 사람은 /api/docs 화면으로, 프로그램은 /api/openapi.json 으로 읽는다.
app.get('/api/openapi.json', (req, res) => {
  res.json(openapi);
});
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi));

// 어느 라우트도 답하지 않은 요청 — 에러 미들웨어에 넘겨 다른 실패와 같은 형식으로 답한다.
app.use((req, res, next) => {
  next(new NotFoundError('ROUTE_NOT_FOUND'));
});

app.use((err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof HttpError) {
    sendError(req, res, err);
    return;
  }

  // express.json() 이 본문을 읽지 못했다 — 상태 코드(400 · 413 …)는 그 에러에 들어 있다.
  if (err.status) {
    sendError(req, res, new HttpError(err.status, 'INVALID_BODY'));
    return;
  }

  console.error(err);
  sendError(req, res, new HttpError(500, 'INTERNAL_ERROR'));
});

const PORT = process.env.PORT ?? 3000;

app.listen(PORT, () => {
  console.log(`서버가 ${PORT}번 포트에서 기다리고 있어요.`);
});
