// ~/instagram-api/lab/p3-53/homework2.js
import express from 'express';
import { z } from 'zod';
import { users, products, reviews } from './shop-data.js';
import { encodeCursor, decodeCursor } from '../../utils/cursor.js';
import { validateQuery } from '../../middlewares/validate.js';
import { HttpError } from '../../errors.js';

const app = express();

// 리뷰 목록의 쿼리 문자열 — 누가 쓴 리뷰인지는 authorId 로 받는다(빠지면 400).
const reviewListQuerySchema = z.object({
  authorId: z.coerce.number().int(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  cursor: z.string().min(1).optional(),
});

// 한 사람의 리뷰는 여러 상품에 걸쳐 있다 — 리뷰마다 상품 이름을 붙여 보낸다.
function toItem(review) {
  const product = products.find((item) => item.id === review.productId);

  return {
    id: review.id,
    productId: review.productId,
    productName: product.name,
    content: review.content,
    createdAt: review.createdAt,
  };
}

// 최신 것부터 — 시각이 같으면 번호가 큰 것이 먼저다.
function byNewest(a, b) {
  if (a.createdAt !== b.createdAt) return a.createdAt > b.createdAt ? -1 : 1;
  return b.id - a.id;
}

// 최신순이라, 커서 다음 리뷰는 시각이 더 이르거나, 시각이 같고 번호가 더 작은 리뷰다 — 게시물 목록과 같은 방향이다.
function afterCursor({ createdAt, id }) {
  return (review) => review.createdAt <= createdAt && (review.createdAt < createdAt || review.id < id);
}

// 리뷰 목록을 글쓴이로 거른다 — 상품을 가로지르는 목록이라 거르는 조건을 쿼리 문자열에 둔다.
app.get('/api/reviews', validateQuery(reviewListQuerySchema), (req, res) => {
  const { authorId: userId, limit = 5, cursor } = res.locals.query;

  // 사람이 없으면 404 — 아직 리뷰를 쓰지 않은 사람(빈 목록)과 구별한다.
  const user = users.find((item) => item.id === userId);
  if (!user) {
    res.status(404).json({ message: '그런 사람은 없어요' });
    return;
  }

  // 숨긴 리뷰는 빼고 그 사람의 리뷰만, 최신 것부터.
  let list = reviews
    .filter((review) => review.authorId === userId && !review.hidden)
    .sort(byNewest);

  // 커서가 오면 «그 리뷰 다음» 부터다. 한 방향뿐이라 공용 커서를 그대로 쓴다.
  if (cursor) {
    list = list.filter(afterCursor(decodeCursor(cursor)));
  }

  // 하나 더 꺼낸다 — 더 있는지 없는지를 «세지 않고» 알아내는 방법이다.
  const rows = list.slice(0, limit + 1);
  const hasNext = rows.length > limit;
  const page = rows.slice(0, limit);

  res.json({
    items: page.map(toItem),
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
