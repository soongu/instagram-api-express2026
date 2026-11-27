// ~/instagram-api/lab/p3-55/practice1.js
import express from 'express';
import { z } from 'zod';
import { users, reviews } from './shop-data.js';
import { encodeCursor, decodeCursor } from '../../utils/cursor.js';
import { validateQuery } from '../../middlewares/validate.js';

const app = express();

// 답변 목록 주소의 쿼리 문자열이다. 리뷰 목록과 같은 규칙이다.
const replyListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
  cursor: z.string().min(1).optional(),
});

// 상태 코드를 든 에러를 만든다. 아래 에러 미들웨어가 이 상태 코드로 답한다.
function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

// 답변 하나를 응답에 쓸 필드만 골라 보낸다. 글쓴이는 번호와 함께 이름도 붙인다.
function toItem(review) {
  const author = users.find((user) => user.id === review.authorId);

  return {
    id: review.id,
    authorId: review.authorId,
    content: review.content,
    createdAt: review.createdAt,
    username: author.username,
  };
}

// 오래된 것부터 보여 준다. 시각이 같으면 번호가 작은 것이 먼저다.
function byOldest(a, b) {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  return a.id - b.id;
}

// 커서 다음 답변은 시각이 더 늦거나 시각이 같고 번호가 더 큰 답변이다.
function afterCursor({ createdAt, id }) {
  return (review) => review.createdAt >= createdAt && (review.createdAt > createdAt || review.id > id);
}

// 리뷰 하나에 달린 답변을 오래된 것부터 받는다. 한 페이지는 따로 정하지 않으면 3개다.
function getReplies(productId, reviewId, { limit = 3, cursor }) {
  // 주소의 상품에 달린 리뷰인지 먼저 확인한다. 없는 리뷰와 답변이 없는 리뷰(빈 목록)를 구별한다.
  const review = reviews.find((one) => one.id === reviewId && one.productId === productId);
  if (!review) throw fail(404, '그런 리뷰는 없어요');

  // 답변은 리뷰에만 달린다. 답변 번호로 물으면 400 으로 알린다.
  if (review.parentId !== null) throw fail(400, '답변에는 답변이 없어요');

  // 답변은 parentId 에 리뷰 번호가 들어 있는 글이다.
  let list = reviews.filter((one) => one.parentId === reviewId).sort(byOldest);

  // 커서가 오면 «그 답변 다음» 부터다.
  if (cursor) list = list.filter(afterCursor(decodeCursor(cursor)));

  // 하나 더 꺼내서 다음 페이지가 있는지 알아낸다.
  const rows = list.slice(0, limit + 1);
  const hasNext = rows.length > limit;
  const page = rows.slice(0, limit);

  return {
    items: page.map(toItem),
    hasNext,
    nextCursor: hasNext ? encodeCursor(page[page.length - 1]) : null,
  };
}

app.get('/api/products/:id/reviews/:reviewId/replies', validateQuery(replyListQuerySchema), (req, res) => {
  const page = getReplies(Number(req.params.id), Number(req.params.reviewId), res.locals.query);

  res.json(page);
});

// 이 서버의 실패는 { message } 하나로 답한다.
app.use((err, req, res, next) => {
  if (err.status) {
    res.status(err.status).json({ message: err.message });
    return;
  }

  console.error(err);
  res.status(500).json({ message: '서버에서 문제가 생겼어요' });
});

app.listen(4001, () => {
  console.log('리뷰 서버가 4001번 포트에서 기다리고 있어요.');
});
