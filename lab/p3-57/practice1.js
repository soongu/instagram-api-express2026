// ~/instagram-api/lab/p3-57/practice1.js
import express from 'express';
import { z } from 'zod';
import { users, reviews, tags, reviewTags } from './shop-data.js';
import { encodeCursor, decodeCursor } from '../../utils/cursor.js';
import { validateQuery } from '../../middlewares/validate.js';
import { HttpError } from '../../errors.js';

const app = express();

// 태그 리뷰 목록의 쿼리 문자열.
const tagReviewsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
  cursor: z.string().min(1).optional(),
});

// 리뷰 목록에 쓸 필드만 골라 보낸다 - 글쓴이는 번호와 함께 이름도 붙인다.
function toItem(review) {
  const author = users.find((user) => user.id === review.authorId);

  return {
    id: review.id,
    content: review.content,
    createdAt: review.createdAt,
    username: author.username,
  };
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

// 태그 하나가 달린 리뷰를 최신순으로 나눠 준다.
app.get('/api/tags/:name/reviews', validateQuery(tagReviewsQuerySchema), (req, res) => {
  const { limit = 3, cursor } = res.locals.query;
  // 태그 이름은 저장한 모양으로 맞춘다 - 앞의 # 을 떼고 소문자로.
  const name = req.params.name.replace(/^#/, '').toLowerCase();

  // 그런 이름의 태그가 없으면 404 - 태그는 있는데 달린 리뷰가 없으면(빈 목록) 구별한다.
  const tag = tags.find((item) => item.name === name);
  if (!tag) {
    res.status(404).json({ message: '그런 태그는 없어요' });
    return;
  }

  // 이 태그와 잇는 줄이 있는 리뷰만, 최신 것부터.
  let list = reviews
    .filter((review) => reviewTags.some((link) => link.reviewId === review.id && link.tagId === tag.id))
    .sort(byNewest);

  // 커서가 오면 «그 리뷰 다음» 부터다.
  if (cursor) {
    list = list.filter(afterCursor(decodeCursor(cursor)));
  }

  // 하나 더 꺼낸다 - 더 있는지 없는지를 «세지 않고» 알아내는 방법이다.
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
