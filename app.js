// ~/instagram-api/app.js
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import passport from 'passport';
import postsRouter from './routes/posts.js';
import likesRouter from './routes/likes.js';
import commentsRouter from './routes/comments.js';
import authRouter from './routes/auth.js';
import uploadsRouter from './routes/uploads.js';
import adminRouter from './routes/admin.js';
import hashtagsRouter from './routes/hashtags.js';
import { HttpError, NotFoundError } from './errors.js';
import { sendError } from './responses.js';
import { logger } from './middlewares/logger.js';
import { privateNoCache } from './middlewares/cache.js';
import { apiVersion } from './middlewares/version.js';
import { oldApiNotice } from './middlewares/deprecation.js';
import { requireLogin } from './middlewares/auth.js';
import { googleStrategy } from './strategies/google.js';
import { kakaoStrategy } from './strategies/kakao.js';
import { naverStrategy } from './strategies/naver.js';
import * as uploadService from './services/uploadService.js';
import swaggerUi from 'swagger-ui-express';
import { openapi } from './docs/openapi.js';

// 어떤 방법으로 로그인을 확인할지 등록한다 — 라우트에서 이 이름('google' · 'kakao' · 'naver')으로 꺼내 쓴다.
passport.use('google', googleStrategy);
passport.use('kakao', kakaoStrategy);
passport.use('naver', naverStrategy);

const app = express();

const allowedOrigins = process.env.CORS_ORIGIN.split(',').map((one) => one.trim());

app.use(logger);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: allowedOrigins }));

// API 응답은 받아 둬도 되지만, 쓸 때마다 서버에 확인하게 한다.
app.use('/api', privateNoCache);

// API 문서 — 사람은 /api/docs 화면으로, 프로그램은 /api/openapi.json 으로 읽는다.
// 버전과 상관없는 주소라 버전을 적는 줄보다 먼저 답한다.
app.get('/api/openapi.json', (req, res) => {
  res.json(openapi);
});
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi));

// 새 주소로 온 요청이라는 것을 본문을 읽기 전에 적어 둔다 — 본문을 못 읽은 실패도 새 형식으로 답하려고.
app.use('/api/v2', apiVersion(2));
// 옛 주소로 온 요청에는 언제까지 받을지 알린다 — 본문을 못 읽은 실패에도 붙게 이것도 본문을 읽기 전에.
app.use('/api', oldApiNotice);
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
// 로그인하러 오는 주소 — 로그인 확인보다 «위» 에 둔다.
api.use('/auth', authRouter);
// 여기부터는 로그인한 사람만 지나간다.
api.use(requireLogin);
api.use('/posts', postsRouter);
api.use('/posts/:id/likes', likesRouter);
api.use('/posts/:id/comments', commentsRouter);
api.use('/hashtags', hashtagsRouter);
api.use('/uploads', uploadsRouter);
api.use('/admin', adminRouter);

// 새 주소 — 버전은 위에서 적어 두었다.
app.use('/api/v2', api);
// 옛 주소 — 이미 나간 화면들이 쓰는 주소라 그대로 둔다.
app.use('/api', api);

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

// 아무 게시물에도 쓰이지 않은 사진을 치운다 — 서버가 뜰 때 한 번, 그 뒤로는 10분마다.
const CLEANUP_INTERVAL = 10 * 60 * 1000;

async function cleanUpUploads() {
  try {
    const removed = await uploadService.removeUnusedUploads();
    if (removed.length > 0) {
      console.log(`아무 게시물에도 쓰이지 않은 사진 ${removed.length}장을 지웠어요.`);
    }
  } catch (error) {
    // 치우다가 실패해도(데이터베이스가 잠깐 꺼지는 등) 서버는 꺼지지 않는다 — 다음 차례에 다시 해 본다.
    console.error(error);
  }
}

cleanUpUploads();
setInterval(cleanUpUploads, CLEANUP_INTERVAL);

const PORT = process.env.PORT ?? 3000;

app.listen(PORT, () => {
  console.log(`서버가 ${PORT}번 포트에서 기다리고 있어요.`);
});
