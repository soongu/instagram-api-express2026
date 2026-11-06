// ~/instagram-api/lab/p3-32/practice2.js
import express from 'express';
import { allowOnly } from '../../middlewares/methods.js';
import { HttpError } from '../../errors.js';

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
    res.status(404).json({ message: '그런 공지는 없어요' });
    return;
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
    res.status(404).json({ message: '그런 공지는 없어요' });
    return;
  }

  notices.splice(index, 1);
  res.json({ message: '지웠어요' });
});

// 위 라우트가 받지 않은 HTTP 메서드에 405 로 답한다.
app.all('/api/notices', allowOnly('GET', 'POST'));
app.all('/api/notices/:id', allowOnly('GET', 'DELETE'));

// allowOnly 가 넘긴 에러를 상태 코드와 문장으로 돌려준다.
app.use((err, req, res, next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ message: err.message });
    return;
  }

  console.error(err);
  res.status(500).json({ message: '서버에서 문제가 생겼어요' });
});

app.listen(4002, () => {
  console.log('공지 서버가 4002번 포트에서 기다리고 있어요.');
});
