// ~/instagram-api/lab/p3-54/practice2.js
import express from 'express';
import cookieParser from 'cookie-parser';
import { users, products, reviews } from './shop-data.js';
import { requireLogin } from '../../middlewares/auth.js';

const app = express();

// 상태 코드를 든 에러를 만든다. 아래 에러 미들웨어가 이 상태 코드로 답한다.
function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

// 리뷰 하나를 응답에 쓸 필드만 골라 보낸다. 글쓴이는 번호와 함께 이름도 붙인다.
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

// 상품의 리뷰 수는 따로 적어 둔 값이라서 숨기지 않은 리뷰가 늘고 준 만큼 우리가 맞춰 준다. 바뀐 숫자를 돌려준다.
function changeReviewCount(product, amount) {
  product.reviewCount += amount;
  return product.reviewCount;
}

// 리뷰를 지운다. 리뷰를 쓴 사람만 지울 수 있다. 상품을 파는 사람도 남이 쓴 리뷰는 못 지운다.
function removeReview(productId, reviewId, userId) {
  // 주소의 상품에 달린 리뷰만 찾는다. 번호만으로 찾으면 다른 상품의 리뷰도 찾아진다.
  const review = reviews.find((one) => one.id === reviewId && one.productId === productId);
  if (!review) throw fail(404, '그런 리뷰는 없어요');

  if (review.authorId !== userId) throw fail(403, '내가 쓴 리뷰만 지울 수 있어요');

  const product = products.find((item) => item.id === productId);
  reviews.splice(reviews.indexOf(review), 1);

  // 숨긴 리뷰는 리뷰 수에 세지 않았으니 지워도 숫자는 그대로다.
  const reviewCount = changeReviewCount(product, review.hidden ? 0 : -1);

  return { review: toItem(review), reviewCount };
}

app.use(cookieParser());

// 여기부터는 로그인한 사람만 지나간다. 로그인은 수업 백엔드에서 하고 이 서버는 같은 쿠키에 든 토큰을 확인한다.
app.use(requireLogin);

app.delete('/api/products/:id/reviews/:reviewId', (req, res) => {
  const result = removeReview(Number(req.params.id), Number(req.params.reviewId), res.locals.userId);

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
