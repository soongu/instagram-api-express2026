// ~/instagram-api/lab/p3-54/practice1.js
import express from 'express';
import cookieParser from 'cookie-parser';
import { z } from 'zod';
import { users, products, reviews } from './shop-data.js';
import { requireLogin } from '../../middlewares/auth.js';
import { validateBody } from '../../middlewares/validate.js';

const app = express();

// 리뷰 달기의 본문은 글 하나만 받는다. 앞뒤 공백을 떼고 검사하므로 공백만 보낸 글은 400 이다.
const reviewCreateSchema = z.object({
  content: z.string().trim().min(1),
});

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

// 리뷰를 단다. 리뷰를 넣는 일과 상품의 리뷰 수를 올리는 일은 함께 한다.
function createReview(productId, userId, content) {
  const product = products.find((item) => item.id === productId);
  if (!product) throw fail(404, '그런 상품은 없어요');

  const review = {
    id: Math.max(...reviews.map((one) => one.id)) + 1,
    productId,
    authorId: userId,
    content,
    createdAt: new Date().toISOString(),
    hidden: false,
  };
  reviews.push(review);

  const reviewCount = ____;

  // 화면이 상품의 리뷰 수를 다시 받지 않고 고칠 수 있게 바뀐 숫자도 함께 보낸다.
  return ____;
}

app.use(express.json());
app.use(cookieParser());

// 여기부터는 로그인한 사람만 지나간다. 로그인은 수업 백엔드에서 하고 이 서버는 같은 쿠키에 든 토큰을 확인한다.
app.use(requireLogin);

app.post('/api/products/:id/reviews', validateBody(reviewCreateSchema), (req, res) => {
  // 글쓴이는 본문이 아니라 로그인 정보로 정한다.
  const result = createReview(Number(req.params.id), ____, req.body.content);

  res.status(____).json(result);
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
