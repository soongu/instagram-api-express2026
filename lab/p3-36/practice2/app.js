// ~/instagram-api/lab/p3-36/practice2/app.js
import express from 'express';
import tagsRouter from './routes/tags.js';
import { addTag } from './services/tagService.js';

const app = express();

app.use(express.json());

// 예전 앱에서 옮겨 온 해시태그 — 서버가 뜰 때 서비스를 바로 불러 넣는다.
for (const name of ['#Seoul', 'busan ', 'JEJU']) {
  addTag(name);
}

app.use('/api/tags', tagsRouter);

app.listen(4002, () => {
  console.log('해시태그 서버가 4002번 포트에서 기다리고 있어요.');
});
