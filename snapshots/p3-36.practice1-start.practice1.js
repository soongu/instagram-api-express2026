// ~/instagram-api/lab/p3-36/practice1.js
import express from 'express';

const app = express();

app.use(express.json());

// 서비스 — 해시태그를 다룬다
const tags = [];

function addTag(name) {
  if (tags.includes(name)) {
    return { name, created: false };
  }

  tags.push(name);
  return { name, created: true };
}

function listTags() {
  return tags;
}

// 예전 앱에서 옮겨 온 해시태그 — 서버가 뜰 때 서비스를 바로 불러 넣는다.
for (const name of ['#Seoul', 'busan ', 'JEJU']) {
  addTag(name);
}

// 라우트
app.get('/api/tags', (req, res) => {
  res.json(listTags());
});

app.post('/api/tags', (req, res) => {
  // 해시태그 이름은 앞뒤 공백과 맨 앞의 # 을 빼고 소문자로 맞춘다 — #Seoul 과 seoul 은 같은 해시태그다.
  const name = req.body.name.trim().replace(/^#/, '').toLowerCase();
  const result = addTag(name);

  res.status(result.created ? 201 : 200).json(result);
});

app.listen(4001, () => {
  console.log('해시태그 서버가 4001번 포트에서 기다리고 있어요.');
});
