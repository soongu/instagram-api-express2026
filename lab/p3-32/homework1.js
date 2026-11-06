// ~/instagram-api/lab/p3-32/homework1.js
import express from 'express';
import { allowOnly } from '../../middlewares/methods.js';
import { HttpError, NotFoundError } from '../../errors.js';

const app = express();

app.use(express.json());

const posts = [
  { id: 1, content: '퇴근길 한강 노을' },
  { id: 2, content: '제주 바다' },
  { id: 3, content: '새로 산 책' },
];

// 저장 하나 = 「어느 게시물을 누가 저장했나」 한 쌍
const saves = [];

function findPost(postId) {
  const post = posts.find((one) => one.id === Number(postId));

  if (!post) {
    throw new NotFoundError('그런 게시물은 없어요');
  }

  return post;
}

// 내가 저장한 게시물 목록 — 목록은 그 사람의 것이라 사람 주소 아래에 둔다.
app.get('/api/users/:userId/saves', (req, res) => {
  const userId = Number(req.params.userId);
  const postIds = saves.filter((save) => save.userId === userId).map((save) => save.postId);

  res.json(posts.filter((post) => postIds.includes(post.id)));
});

// 「1번 게시물을 2번 사람이 저장한 것」 하나를 주소로 가리킨다 — 좋아요 주소와 같은 규칙
app.put('/api/posts/:postId/saves/:userId', (req, res) => {
  const post = findPost(req.params.postId);
  const userId = Number(req.params.userId);

  // 이미 저장했으면 그대로 200, 없던 저장을 새로 만들었으면 201 — PUT 으로 새로 만들었으면 201 이다.
  if (saves.some((save) => save.postId === post.id && save.userId === userId)) {
    res.json({ saved: true });
    return;
  }

  saves.push({ postId: post.id, userId });
  res.status(201).json({ saved: true });
});

app.delete('/api/posts/:postId/saves/:userId', (req, res) => {
  const post = findPost(req.params.postId);
  const userId = Number(req.params.userId);
  const index = saves.findIndex((save) => save.postId === post.id && save.userId === userId);

  if (index !== -1) {
    saves.splice(index, 1);
  }

  res.json({ saved: false });
});

app.all('/api/users/:userId/saves', allowOnly('GET'));
app.all('/api/posts/:postId/saves/:userId', allowOnly('PUT', 'DELETE'));

app.use((err, req, res, next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ message: err.message });
    return;
  }

  console.error(err);
  res.status(500).json({ message: '서버에서 문제가 생겼어요' });
});

app.listen(4011, () => {
  console.log('저장 서버가 4011번 포트에서 기다리고 있어요.');
});
