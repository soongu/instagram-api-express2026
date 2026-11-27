// ~/instagram-api/lab/p3-58/practice1.js
import express from 'express';
import { z } from 'zod';
import { users, reviews } from '../p3-57/shop-data.js';
import { encodeCursor, decodeCursor } from '../../utils/cursor.js';
import { validateQuery } from '../../middlewares/validate.js';
import { HttpError } from '../../errors.js';

const app = express();

// 글쓴이 리뷰 목록의 쿼리 문자열.
const userReviewsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
  cursor: z.string().min(1).optional(),
});

// 리뷰로 세는 글 - 답변(parentId 가 있는 글)과 숨긴 리뷰는 빼고 그 사람이 쓴 리뷰만.
function isReviewBy(userId) {
  return (review) => review.authorId === userId && review.parentId === null && !review.hidden;
}

// 최신 것부터 - 시각이 같으면 번호가 큰 것이 먼저다.
function byNewest(a, b) {
  if (a.createdAt !== b.createdAt) return a.createdAt > b.createdAt ? -1 : 1;
  return b.id - a.id;
}

// 최신순이라, 커서 다음 리뷰는 시각이 더 이르거나, 시각이 같고 번호가 더 작은 리뷰다.
function afterCursor({ createdAt, id }) {
  return (review) => review.createdAt <= createdAt && (review.createdAt < createdAt || review.id < id);
}

// 사용자 이름으로 글쓴이를 찾는다 - 없으면 404 를 보내고 null 을 돌려준다.
function findUser(req, res) {
  const user = users.find((item) => item.username === req.params.username);

  if (!user) {
    res.status(404).json({ message: '그런 사용자는 없어요' });
    return null;
  }

  return user;
}

// 글쓴이 한 사람 - 리뷰 수는 따로 적어 두지 않아서 요청마다 센다.
app.get('/api/users/:username', (req, res) => {
  const user = findUser(req, res);
  if (!user) return;

  res.json({ id: user.id, username: user.username, reviewCount: reviews.filter(isReviewBy(user.id)).length });
});

// 글쓴이 한 사람의 리뷰를 최신순으로 나눠 준다.
app.get('/api/users/:username/reviews', validateQuery(userReviewsQuerySchema), (req, res) => {
  const { limit = 3, cursor } = res.locals.query;
  const user = findUser(req, res);
  if (!user) return;

  let list = reviews.filter(isReviewBy(user.id)).sort(byNewest);

  // 커서가 오면 «그 리뷰 다음» 부터다.
  if (cursor) {
    list = list.filter(afterCursor(decodeCursor(cursor)));
  }

  // 하나 더 꺼낸다 - 더 있는지 없는지를 «세지 않고» 알아내는 방법이다.
  const rows = list.slice(0, limit + 1);
  const hasNext = rows.length > limit;
  const page = rows.slice(0, limit);

  res.json({
    items: page.map(({ id, content, createdAt }) => ({ id, content, createdAt })),
    hasNext,
    nextCursor: hasNext ? encodeCursor(page[page.length - 1]) : null,
  });
});

// 이 서버의 실패는 { message } 하나로 답한다.
app.use((err, req, res, next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ message: err.message });
    return;
  }

  console.error(err);
  res.status(500).json({ message: '서버에서 문제가 생겼어요' });
});

app.listen(4001, () => {
  console.log('리뷰 서버가 4001번 포트에서 기다리고 있어요.');
});
