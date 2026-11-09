// ~/instagram-api/lab/p3-37/notices.js
import express from 'express';

const app = express();

app.use(express.json());

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const notices = [
  { id: 1, title: '서버 점검 안내' },
  { id: 2, title: '새 기능 소개' },
];

// 목록을 한 번 만들면 기억해 두었다가, 다음 요청에는 컨트롤러까지 가지 않고 바로 돌려준다.
let cachedList = null;

function listCache(req, res, next) {
  if (cachedList) {
    res.json(cachedList);
    return;
  }
  next();
}

function list(req, res) {
  cachedList = [...notices];
  res.json(cachedList);
}

function create(req, res) {
  if (!req.body.title) throw new HttpError(400, '제목을 적어 주세요');

  const notice = { id: notices.length + 1, title: req.body.title };
  notices.push(notice);
  cachedList = null;
  res.status(201).json(notice);
}

const api = express.Router();
api.get('/notices', listCache, list);
api.post('/notices', create);

app.use('/api', api);

app.use((req, res) => {
  res.status(404).json({ message: '그런 주소는 없어요' });
});

app.use((err, req, res, next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ message: err.message });
    return;
  }
  if (err.status) {
    res.status(err.status).json({ message: '보낸 내용을 읽을 수 없어요' });
    return;
  }
  console.error(err);
  res.status(500).json({ message: '서버에서 문제가 생겼어요' });
});

app.listen(4001, () => {
  console.log('공지 서버가 4001번 포트에서 기다리고 있어요.');
});
