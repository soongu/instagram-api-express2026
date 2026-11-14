// ~/instagram-api/lab/p3-38/homework1.js
import express from 'express';
import swaggerUi from 'swagger-ui-express';

const app = express();

// 옛 주소를 언제부터 쓰지 말라고 했는지와, 언제부터 받지 않을지.
const DEPRECATED_AT = new Date('2026-12-01T00:00:00Z');
const SUNSET_AT = new Date('2027-03-01T00:00:00Z');

const MESSAGES = {
  TITLE_REQUIRED: '제목을 적어 주세요',
  INVALID_BODY: '보낸 내용을 읽을 수 없어요',
  ROUTE_NOT_FOUND: '그런 주소는 없어요',
  INTERNAL_ERROR: '서버에서 문제가 생겼어요',
};

class HttpError extends Error {
  constructor(status, code) {
    super(MESSAGES[code]);
    this.status = status;
    this.code = code;
  }
}

// 새 주소(/api/v2)로 온 요청이면 값을 data 에 담고, 옛 주소면 값만 보낸다.
function sendData(res, data) {
  if (res.locals.apiVersion === 2) {
    res.json({ data });
    return;
  }
  res.json(data);
}

// 새 주소면 { error: { code, message, path, timestamp } }, 옛 주소면 { message }.
function sendError(req, res, error) {
  res.status(error.status);
  if (res.locals.apiVersion === 2) {
    const path = req.originalUrl.split('?')[0];
    const timestamp = new Date().toISOString();
    res.json({ error: { code: error.code, message: error.message, path, timestamp } });
    return;
  }
  res.json({ message: error.message });
}

const notices = [
  { id: 1, title: '서버 점검 안내' },
  { id: 2, title: '새 기능 소개' },
];

// 목록을 한 번 만들면 기억해 두었다가, 다음 요청에는 컨트롤러까지 가지 않고 바로 돌려준다.
let cachedList = null;

function listCache(req, res, next) {
  if (cachedList) {
    sendData(res, cachedList);
    return;
  }
  next();
}

function list(req, res) {
  cachedList = [...notices];
  sendData(res, cachedList);
}

function create(req, res) {
  if (!req.body.title) throw new HttpError(400, 'TITLE_REQUIRED');

  const notice = { id: notices.length + 1, title: req.body.title };
  notices.push(notice);
  cachedList = null;
  res.status(201);
  sendData(res, notice);
}

// 여기부터 문서 — 공지 하나의 모양은 한 번만 적고, 두 버전이 그것을 다르게 담는다.
const json = (schema) => ({ 'application/json': { schema } });
const notice = { $ref: '#/components/schemas/Notice' };
const data = (schema) => ({ type: 'object', required: ['data'], properties: { data: schema } });

// 그 응답이 보낼 수 있는 에러 코드만 적는다 — MESSAGES 에 없는 코드를 적으면 서버가 뜨지 않는다.
function errorOf(...codes) {
  for (const code of codes) {
    if (!Object.hasOwn(MESSAGES, code)) {
      throw new Error(`MESSAGES에 없는 에러 코드예요: ${code}`);
    }
  }

  return {
    type: 'object',
    required: ['error'],
    properties: {
      error: {
        type: 'object',
        required: ['code', 'message', 'path', 'timestamp'],
        properties: {
          code: { type: 'string', enum: codes },
          message: { type: 'string' },
          path: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
    },
  };
}

const OLD = `옛 주소예요. ${SUNSET_AT.toISOString().slice(0, 10)}에 끝나요. /api/v2/notices 주소로 옮기세요.`;
const titleBody = { required: true, content: json({ type: 'object', properties: { title: { type: 'string' } } }) };

const openapi = {
  openapi: '3.2.0',
  info: { title: '공지 API', version: '2.0.0' },
  paths: {
    '/api/v2/notices': {
      get: {
        summary: '공지 목록',
        responses: { 200: { description: '공지 배열', content: json(data({ type: 'array', items: notice })) } },
      },
      post: {
        summary: '공지 올리기',
        requestBody: titleBody,
        responses: {
          201: { description: '만든 공지', content: json(data(notice)) },
          400: { description: '제목이 없거나 본문을 읽을 수 없음', content: json(errorOf('TITLE_REQUIRED', 'INVALID_BODY')) },
        },
      },
    },
    '/api/notices': {
      get: {
        summary: '공지 목록 (옛 주소)',
        description: OLD,
        deprecated: true,
        responses: { 200: { description: '공지 배열', content: json({ type: 'array', items: notice }) } },
      },
      post: {
        summary: '공지 올리기 (옛 주소)',
        description: OLD,
        deprecated: true,
        requestBody: titleBody,
        responses: {
          201: { description: '만든 공지', content: json(notice) },
          400: { description: '제목이 없거나 본문을 읽을 수 없음', content: json({ type: 'object', properties: { message: { type: 'string' } } }) },
        },
      },
    },
  },
  components: {
    schemas: {
      Notice: { type: 'object', required: ['id', 'title'], properties: { id: { type: 'integer' }, title: { type: 'string' } } },
      ErrorCode: { type: 'string', description: '이 서버가 보낼 수 있는 에러 코드 전부', enum: Object.keys(MESSAGES) },
    },
  },
};

// 문서는 버전과 상관없는 주소라 버전을 적는 줄보다 먼저 답한다.
app.get('/api/openapi.json', (req, res) => {
  res.json(openapi);
});
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi));

// 새 주소로 온 요청이라는 것을 본문을 읽기 전에 적어 둔다.
app.use('/api/v2', (req, res, next) => {
  res.locals.apiVersion = 2;
  next();
});
// 옛 주소로 온 요청에는 끝나는 날을 알린다 — 본문을 못 읽은 실패에도 붙게 본문을 읽기 전에.
app.use('/api', (req, res, next) => {
  if (res.locals.apiVersion !== 2) {
    res.set('Deprecation', `@${DEPRECATED_AT.getTime() / 1000}`);
    res.set('Sunset', SUNSET_AT.toUTCString());
  }
  next();
});
app.use(express.json());

const api = express.Router();
api.get('/notices', listCache, list);
api.post('/notices', create);

app.use('/api/v2', api);
app.use('/api', api);

app.use((req, res, next) => {
  next(new HttpError(404, 'ROUTE_NOT_FOUND'));
});

app.use((err, req, res, next) => {
  if (err instanceof HttpError) {
    sendError(req, res, err);
    return;
  }
  if (err.status) {
    sendError(req, res, new HttpError(err.status, 'INVALID_BODY'));
    return;
  }
  console.error(err);
  sendError(req, res, new HttpError(500, 'INTERNAL_ERROR'));
});

app.listen(4011, () => {
  console.log('과제 서버가 4011번 포트에서 기다리고 있어요.');
});
