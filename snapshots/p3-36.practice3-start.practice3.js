// ~/instagram-api/lab/p3-36/practice3.js
import express from 'express';

const app = express();

const tags = ['seoul', 'busan', 'jeju', 'test'];

// 서비스 — 해시태그를 지운다
function removeTag(name, res) {
  const index = tags.indexOf(name);

  if (index === -1) {
    res.status(404).json({ message: '그런 해시태그는 없어요' });
    return;
  }

  tags.splice(index, 1);
  res.json({ removed: name });
}

// 시험용으로 넣었던 해시태그 — 서버가 뜰 때 서비스를 바로 불러 지운다.
removeTag('test');

app.get('/api/tags', (req, res) => {
  res.json(tags);
});

app.delete('/api/tags/:name', (req, res) => {
  removeTag(req.params.name, res);
});

app.listen(4003, () => {
  console.log('해시태그 서버가 4003번 포트에서 기다리고 있어요.');
});
