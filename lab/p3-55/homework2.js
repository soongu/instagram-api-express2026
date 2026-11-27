// ~/instagram-api/lab/p3-55/homework2.js
import express from 'express';
import { users, products, reviews } from './shop-data.js';

const app = express();

// 오래된 것부터 보여 준다. 시각이 같으면 번호가 작은 것이 먼저다.
function byOldest(a, b) {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  return a.id - b.id;
}

// 리뷰 하나를 목록에 쓸 필드만 골라 보낸다. 달린 답변의 수도 함께 센다.
function toItem(review) {
  const author = users.find((user) => user.id === review.authorId);

  return {
    id: review.id,
    authorId: review.authorId,
    content: review.content,
    createdAt: review.createdAt,
    username: author.username,
    // 답변은 parentId 에 이 리뷰의 번호가 들어 있는 글이다. 답변을 싣지 않고 개수만 보낸다.
    replyCount: reviews.filter((one) => one.parentId === review.id).length,
  };
}

app.get('/api/products/:id/reviews', (req, res) => {
  const productId = Number(req.params.id);

  // 상품이 없으면 404 다. 아직 리뷰가 없는 상품(빈 목록)과 구별한다.
  const product = products.find((item) => item.id === productId);
  if (!product) {
    res.status(404).json({ message: '그런 상품은 없어요' });
    return;
  }

  // 그 상품의 리뷰만 오래된 것부터 보낸다. 숨긴 리뷰와 답변은 뺀다.
  const items = reviews
    .filter((review) => review.productId === productId && review.parentId === null && !review.hidden)
    .sort(byOldest)
    .map(toItem);

  res.json(items);
});

app.listen(4001, () => {
  console.log('리뷰 서버가 4001번 포트에서 기다리고 있어요.');
});
