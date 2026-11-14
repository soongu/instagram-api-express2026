// ~/instagram-api/lab/p3-37/notices.js
import express from 'express';

const app = express();

// 새 주소로 온 요청이라는 것을 본문을 읽기 전에 적어 둔다.
app.use('/api/v2', (req, res, next) => {
  res.locals.apiVersion = 2;
  next();
});
app.use(express.json());

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

app.listen(4001, () => {
  console.log('공지 서버가 4001번 포트에서 기다리고 있어요.');
});
