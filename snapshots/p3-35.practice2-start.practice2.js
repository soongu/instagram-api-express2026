// ~/instagram-api/lab/p3-35/practice2.js
import express from 'express';
import { setTimeout as sleep } from 'node:timers/promises';
import { logger } from '../../middlewares/logger.js';

const app = express();

app.use(logger);
app.use(express.json());

// updatedAt — 글을 마지막으로 고친 시각(밀리초). 고칠 때마다 바뀐다.
const articles = [
  { id: 1, title: '첫 글', body: '안녕하세요, 처음 써 보는 글이에요.', updatedAt: 1762650000000 },
  { id: 2, title: '둘째 글', body: '오늘은 캐시를 배웠어요.', updatedAt: 1762653600000 },
];

// 글 하나를 응답 모양으로 만든다 — 0.3초 걸리는 일이라고 흉내 낸다.
async function render(article) {
  await sleep(300);
  console.log(`${article.id}번 글을 만들었어요`);
  return { id: article.id, title: article.title, body: article.body };
}

app.get('/api/articles/:id', async (req, res) => {
  const article = articles.find((one) => one.id === Number(req.params.id));
  if (!article) {
    res.status(404).json({ message: '그런 글은 없어요' });
    return;
  }

  res.json(await render(article));
});

app.patch('/api/articles/:id', (req, res) => {
  const article = articles.find((one) => one.id === Number(req.params.id));
  if (!article) {
    res.status(404).json({ message: '그런 글은 없어요' });
    return;
  }

  article.body = req.body.body;
  article.updatedAt = Date.now();
  res.json({ id: article.id, title: article.title, body: article.body });
});

app.listen(4002, () => {
  console.log('실습 서버가 4002번 포트에서 기다리고 있어요.');
});
