// ~/instagram-api/lab/p3-56/homework2.js
import express from 'express';
import cookieParser from 'cookie-parser';
import { z } from 'zod';
import { users, products, reviews, tags, reviewTags } from './shop-data.js';
import { requireLogin } from '../../middlewares/auth.js';
import { validateBody } from '../../middlewares/validate.js';

const app = express();

// 리뷰 달기의 본문은 글 하나만 받는다.
const reviewCreateSchema = z.object({
  content: z.string().trim().min(1),
});

// # 바로 뒤에 영문, 숫자, 한글, 밑줄(_)이 이어지는 곳이 태그다. 다른 글자를 만나면 태그가 끝난다.
const TAG = /#[0-9A-Za-z가-힣_]+/g;
const MAX_LENGTH = 10;
const MAX_COUNT = 5;

// 상태 코드를 든 에러를 만든다. 아래 에러 미들웨어가 이 상태 코드로 답한다.
function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

// 리뷰 글에서 태그 이름만 뽑는다. 글에 나온 차례대로 담고 같은 이름은 한 번만 담는다.
function extractTags(content) {
  const found = content.match(TAG) ?? [];
  const names = [...new Set(found.map((tag) => tag.slice(1).toLowerCase()))];

  if (names.some((name) => name.length > MAX_LENGTH)) throw fail(400, '태그는 10자까지 쓸 수 있어요');
  if (names.length > MAX_COUNT) throw fail(400, '태그는 리뷰 하나에 5개까지 쓸 수 있어요');

  return names;
}

// 리뷰에 달린 태그 이름을 reviewTags 에 적힌 차례대로 모은다.
function tagNamesOf(reviewId) {
  return reviewTags
    .filter((link) => link.reviewId === reviewId)
    .map((link) => tags.find((tag) => tag.id === link.tagId).name);
}

// 리뷰 하나를 응답에 쓸 필드만 골라 보낸다. 글쓴이는 번호와 함께 이름도 붙이고 달린 태그도 싣는다.
function toItem(review) {
  const author = users.find((user) => user.id === review.authorId);

  return {
    id: review.id,
    authorId: review.authorId,
    content: review.content,
    createdAt: review.createdAt,
    username: author.username,
    tags: tagNamesOf(review.id),
  };
}

// 이름마다 태그가 없으면 만들고 그 태그의 reviewCount 를 1 올리고 리뷰와 잇는 줄을 넣는다.
function addTags(reviewId, names) {
  for (const name of names) {
    let tag = tags.find((one) => one.name === name);

    if (!tag) {
      tag = { id: Math.max(...tags.map((one) => one.id)) + 1, name, reviewCount: 0 };
      tags.push(tag);
    }

    tag.reviewCount += 1;
    reviewTags.push({ reviewId, tagId: tag.id });
  }
}

// 이름마다 리뷰와 잇는 줄을 지우고 그 태그의 reviewCount 를 1 내린다.
function removeTags(reviewId, names) {
  for (const name of names) {
    const tag = tags.find((one) => one.name === name);
    const at = reviewTags.findIndex((link) => link.reviewId === reviewId && link.tagId === tag.id);

    reviewTags.splice(at, 1);
    tag.reviewCount -= 1;
  }
}

// 리뷰를 단다. 상품의 reviewCount 는 이 과제에서 다루지 않고 태그의 reviewCount 만 맞춘다.
function createReview(productId, userId, content) {
  const product = products.find((item) => item.id === productId);
  if (!product) throw fail(404, '그런 상품은 없어요');

  // 태그 규칙을 어기면 여기서 400 으로 멈춘다. 아무것도 쓰기 전에 뽑아 둔다.
  const names = extractTags(content);

  const review = {
    id: Math.max(...reviews.map((one) => one.id)) + 1,
    productId,
    parentId: null,
    authorId: userId,
    content,
    createdAt: new Date().toISOString(),
    hidden: false,
  };
  reviews.push(review);
  addTags(review.id, names);

  return toItem(review);
}

// 리뷰를 지운다. 쓴 사람만 지울 수 있다. 리뷰에 달린 답변은 이 과제에서 다루지 않는다.
function removeReview(reviewId, userId) {
  const review = reviews.find((one) => one.id === reviewId && one.parentId === null);
  if (!review) throw fail(404, '그런 리뷰는 없어요');

  if (review.authorId !== userId) throw fail(403, '내가 쓴 리뷰만 지울 수 있어요');

  // 리뷰에 달린 태그를 모두 떼어 내고 태그마다 reviewCount 를 1 내린다.
  removeTags(review.id, tagNamesOf(review.id));

  reviews.splice(reviews.indexOf(review), 1);
}

// reviewCount 가 큰 태그가 먼저다. 같으면 번호가 작은 태그가 먼저다.
function byPopular(a, b) {
  if (a.reviewCount !== b.reviewCount) return b.reviewCount - a.reviewCount;
  return a.id - b.id;
}

app.use(express.json());
app.use(cookieParser());

// 인기 태그는 로그인 없이 볼 수 있다. 태그마다 리뷰를 세지 않고 reviewCount 만 비교해서 위의 셋을 보낸다.
app.get('/api/tags/popular', (req, res) => {
  res.json([...tags].sort(byPopular).slice(0, 3));
});

// 여기부터는 로그인한 사람만 지나간다. 로그인은 수업 백엔드에서 하고 이 서버는 같은 쿠키에 든 토큰을 확인한다.
app.use(requireLogin);

app.post('/api/products/:id/reviews', validateBody(reviewCreateSchema), (req, res) => {
  const review = createReview(Number(req.params.id), res.locals.userId, req.body.content);

  res.status(201).json({ review });
});

app.delete('/api/reviews/:id', (req, res) => {
  removeReview(Number(req.params.id), res.locals.userId);

  res.status(204).end();
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
