// ~/instagram-api/lab/p3-54/homework2.js
import express from 'express';
import cookieParser from 'cookie-parser';
import { z } from 'zod';
import { users, products, reviews } from './shop-data.js';
import { requireLogin } from '../../middlewares/auth.js';
import { validateBody } from '../../middlewares/validate.js';

const app = express();

// 숨기기의 본문은 숨길지(true) 다시 보일지(false) 하나만 받는다.
const reviewHiddenSchema = z.object({
  hidden: z.boolean(),
});

// 상태 코드를 든 에러를 만든다. 아래 에러 미들웨어가 이 상태 코드로 답한다.
function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

// 리뷰 하나를 응답에 쓸 필드만 골라 보낸다. 숨겼는지도 함께 보낸다.
function toItem(review) {
  const author = users.find((user) => user.id === review.authorId);

  return {
    id: review.id,
    authorId: review.authorId,
    content: review.content,
    createdAt: review.createdAt,
    username: author.username,
    hidden: review.hidden,
  };
}

// 상품의 리뷰 수는 따로 적어 둔 값이라서 숨기지 않은 리뷰가 늘고 준 만큼 우리가 맞춰 준다. 바뀐 숫자를 돌려준다.
function changeReviewCount(product, amount) {
  product.reviewCount += amount;
  return product.reviewCount;
}

// 리뷰를 숨기거나 다시 보인다. 그 상품을 파는 사람만 할 수 있다.
function setReviewHidden(productId, reviewId, userId, hidden) {
  const review = reviews.find((one) => one.id === reviewId && one.productId === productId);
  if (!review) throw fail(404, '그런 리뷰는 없어요');

  const product = products.find((item) => item.id === productId);
  if (product.sellerId !== userId) throw fail(403, '내가 파는 상품의 리뷰만 숨기거나 다시 보일 수 있어요');

  // 이미 그 상태면 숫자를 그대로 둔다. 같은 요청을 몇 번 보내도 결과가 같다.
  let amount = 0;
  if (review.hidden !== hidden) amount = hidden ? -1 : 1;
  review.hidden = hidden;

  const reviewCount = changeReviewCount(product, amount);

  return { review: toItem(review), reviewCount };
}

app.use(express.json());
app.use(cookieParser());

// 여기부터는 로그인한 사람만 지나간다. 로그인은 수업 백엔드에서 하고 이 서버는 같은 쿠키에 든 토큰을 확인한다.
app.use(requireLogin);

app.patch('/api/products/:id/reviews/:reviewId', validateBody(reviewHiddenSchema), (req, res) => {
  const result = setReviewHidden(Number(req.params.id), Number(req.params.reviewId), res.locals.userId, req.body.hidden);

  res.json(result);
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
