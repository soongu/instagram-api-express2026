// ~/instagram-api/lab/p3-32/homework2.js
import express from 'express';
import { STATUS_CODES } from 'node:http';
import { allowOnly } from '../../middlewares/methods.js';
import { HttpError, NotFoundError } from '../../errors.js';

const app = express();

app.use(express.json());

const notices = [
  { id: 1, title: '서버 점검 안내', pinned: true },
  { id: 2, title: '새 기능 소개', pinned: false },
  { id: 3, title: '이용 약관 변경', pinned: true },
];
let nextId = 4;

app.get('/api/notices', (req, res) => {
  if (req.query.pinned === 'true') {
    res.json(notices.filter((notice) => notice.pinned));
    return;
  }

  res.json(notices);
});

app.get('/api/notices/:id', (req, res) => {
  const notice = notices.find((one) => one.id === Number(req.params.id));

  if (!notice) {
    throw new NotFoundError('그런 공지는 없어요');
  }

  res.json(notice);
});

app.post('/api/notices', (req, res) => {
  const notice = { id: nextId, title: req.body.title, pinned: false };
  nextId += 1;
  notices.push(notice);

  res.status(201).json(notice);
});

app.delete('/api/notices/:id', (req, res) => {
  const index = notices.findIndex((one) => one.id === Number(req.params.id));

  if (index === -1) {
    throw new NotFoundError('그런 공지는 없어요');
  }

  notices.splice(index, 1);
  res.json({ message: '지웠어요' });
});

app.all('/api/notices', allowOnly('GET', 'POST'));
app.all('/api/notices/:id', allowOnly('GET', 'DELETE'));

// 맞는 라우트가 하나도 없으면 에러로 넘겨, 에러 미들웨어 한곳에서 같은 꼴로 답한다.
app.use((req, res, next) => {
  next(new NotFoundError('그런 주소는 없어요'));
});

// 모든 실패를 RFC 9457 의 «문제 상세» 꼴로 돌려준다.
app.use((err, req, res, next) => {
  const status = err.status ?? 500;
  let detail = '서버에서 문제가 생겼어요';

  if (err instanceof HttpError) {
    detail = err.message;
  } else if (status === 500) {
    console.error(err);
  } else {
    detail = '보낸 내용을 읽을 수 없어요';
  }

  res.status(status).type('application/problem+json').json({
    type: 'about:blank',
    title: STATUS_CODES[status],
    status,
    detail,
    instance: req.originalUrl,
  });
});

app.listen(4012, () => {
  console.log('공지 서버가 4012번 포트에서 기다리고 있어요.');
});
