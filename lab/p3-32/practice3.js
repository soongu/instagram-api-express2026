// ~/instagram-api/lab/p3-32/practice3.js
import express from 'express';

const app = express();

app.use(express.json());

const notices = [
  { id: 1, title: '서버 점검 안내' },
  { id: 2, title: '새 기능 소개' },
];
let nextId = 3;

app.get('/api/notices/:id', (req, res) => {
  const notice = notices.find((one) => one.id === Number(req.params.id));

  if (!notice) {
    res.status(404).json({ message: '그런 공지는 없어요' });
    return;
  }

  res.json(notice);
});

app.post('/api/notices', (req, res) => {
  const title = (req.body.title ?? '').trim();

  if (title === '') {
    res.status(400).json({ message: '제목을 적어 주세요' });
    return;
  }

  if (notices.some((one) => one.title === title)) {
    res.status(409).json({ message: '같은 제목의 공지가 이미 있어요' });
    return;
  }

  const notice = { id: nextId, title };
  nextId += 1;
  notices.push(notice);

  res.status(201).location(`/api/notices/${notice.id}`).json(notice);
});

app.delete('/api/notices/:id', (req, res) => {
  const index = notices.findIndex((one) => one.id === Number(req.params.id));

  if (index === -1) {
    res.status(404).json({ message: '그런 공지는 없어요' });
    return;
  }

  notices.splice(index, 1);
  res.status(204).end();
});

app.listen(4003, () => {
  console.log('공지 서버가 4003번 포트에서 기다리고 있어요.');
});
