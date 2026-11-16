// ~/instagram-api/lab/p3-53/homework2.js
import express from 'express';
import { z } from 'zod';
import { users, products, reviews } from './shop-data.js';
import { validateQuery } from '../../middlewares/validate.js';
import { BadRequestError, HttpError } from '../../errors.js';

const app = express();

// 리뷰 목록 주소의 쿼리 문자열 — order 가 없으면 오래된 순이다.
const reviewListQuerySchema = z.object({
  order: z.enum(['oldest', 'newest']).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  cursor: z.string().min(1).optional(),
});

// 커서에 정렬 방향도 담는다 — 다른 방향의 커서가 오면 알아볼 수 있게.
const cursorSchema = z.object({
  createdAt: z.iso.datetime(),
  id: z.int32(),
  order: z.enum(['oldest', 'newest']),
});

function encodeCursor({ createdAt, id }, order) {
  return Buffer.from(JSON.stringify({ createdAt, id, order })).toString('base64url');
}

function decodeCursor(cursor) {
  try {
    return cursorSchema.parse(JSON.parse(Buffer.from(cursor, 'base64url').toString()));
  } catch {
    throw new BadRequestError('INVALID_CURSOR');
  }
}

// 리뷰 목록에 쓸 필드만 골라 보낸다 — 글쓴이는 번호와 함께 이름도 붙인다.
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

// 오래된 것부터 — 시각이 같으면 번호가 작은 것이 먼저다.
function byOldest(a, b) {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  return a.id - b.id;
}

// 최신 것부터 — 오래된 순을 그대로 뒤집는다.
function byNewest(a, b) {
  return byOldest(b, a);
}

// 커서 다음 리뷰 — 오래된 순이면 시각이 더 늦거나 시각이 같고 번호가 더 큰 리뷰이고, 최신순이면 비교가 모두 반대다.
function afterCursor({ createdAt, id, order }) {
  if (order === 'newest') {
    return (review) => review.createdAt <= createdAt && (review.createdAt < createdAt || review.id < id);
  }
  return (review) => review.createdAt >= createdAt && (review.createdAt > createdAt || review.id > id);
}

app.get('/api/products/:id/reviews', validateQuery(reviewListQuerySchema), (req, res) => {
  const { order = 'oldest', limit = 5, cursor } = res.locals.query;
  const productId = Number(req.params.id);

  // 상품이 없으면 404 — 아직 리뷰가 없는 상품(빈 목록)과 구별한다.
  const product = products.find((item) => item.id === productId);
  if (!product) {
    res.status(404).json({ message: '그런 상품은 없어요' });
    return;
  }

  // 숨긴 리뷰는 빼고 그 상품의 리뷰만, 고른 방향으로.
  let list = reviews
    .filter((review) => review.productId === productId && !review.hidden)
    .sort(order === 'newest' ? byNewest : byOldest);

  // 커서가 오면 «그 리뷰 다음» 부터다. 다른 방향의 커서면 어디서 이어야 할지 모르니 400 으로 알린다.
  if (cursor) {
    const after = decodeCursor(cursor);
    if (after.order !== order) {
      res.status(400).json({ message: '커서와 정렬이 맞지 않아요' });
      return;
    }
    list = list.filter(afterCursor(after));
  }

  // 하나 더 꺼낸다 — 더 있는지 없는지를 «세지 않고» 알아내는 방법이다.
  const rows = list.slice(0, limit + 1);
  const hasNext = rows.length > limit;
  const page = rows.slice(0, limit);

  res.json({
    items: page.map(toItem),
    hasNext,
    nextCursor: hasNext ? encodeCursor(page[page.length - 1], order) : null,
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
