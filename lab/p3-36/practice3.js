// ~/instagram-api/lab/p3-36/practice3.js
import express from 'express';
import { HttpError, NotFoundError } from '../../errors.js';

const app = express();

const tags = ['seoul', 'busan', 'jeju', 'test'];

// 서비스 — 해시태그를 지운다. 없으면 에러를 던지고, 지웠으면 지운 이름을 돌려준다.
function removeTag(name) {
  const index = tags.indexOf(name);

  if (index === -1) {
    throw new NotFoundError('그런 해시태그는 없어요');
  }

  tags.splice(index, 1);
  return name;
}

// 시험용으로 넣었던 해시태그 — 서버가 뜰 때 서비스를 바로 불러 지운다.
removeTag('test');

app.get('/api/tags', (req, res) => {
  res.json(tags);
});

app.delete('/api/tags/:name', (req, res) => {
  const removed = removeTag(req.params.name);

  res.json({ removed });
});

app.use((err, req, res, next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ message: err.message });
    return;
  }

  console.error(err);
  res.status(500).json({ message: '서버에서 문제가 생겼어요' });
});

app.listen(4003, () => {
  console.log('해시태그 서버가 4003번 포트에서 기다리고 있어요.');
});
