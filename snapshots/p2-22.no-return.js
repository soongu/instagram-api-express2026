// 내부 검증 전용 — `return` 을 빠뜨린 판이다.
// 아래 줄이 «진짜 값» 을 담아서, 교안 ⚠️ 박스가 말하는 그 에러를 실제로 낸다.
import express from 'express';
import { posts } from './p2-22.data-posts.js';

const app = express();

app.get('/api/posts/:id', (req, res) => {
  const id = Number(req.params.id);
  const post = posts.find((one) => one.id === id);

  if (!post) {
    res.status(404).json({ message: '그런 게시물은 없어요' });
    // return 이 없다
  }

  res.json({ ok: true });
});

app.listen(3000, () => {
  console.log('서버가 3000번 포트에서 기다리고 있어요.');
});
