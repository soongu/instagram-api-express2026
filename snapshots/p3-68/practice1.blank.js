// ~/instagram-api/lab/p3-68/practice1.js
import express from 'express';
import cookieParser from 'cookie-parser';
import { users, reviews, helpfuls, notifications } from './helpful-data.js';
import { requireLogin } from '../../middlewares/auth.js';

const app = express();
app.use(cookieParser());

// 여기부터는 로그인한 사람만 지나간다. 로그인은 수업 백엔드에서 하고 이 서버는 같은 쿠키에 든 토큰을 확인한다.
app.use(requireLogin);

// 목록의 가장 큰 번호보다 하나 큰 번호 - 데이터베이스의 자동 번호 대신이다.
function nextId(rows) {
  return rows.reduce((max, row) => Math.max(max, row.id), 0) + 1;
}

// 주소의 번호로 리뷰를 찾는다 - 없으면 404 를 보내고 null 을 돌려준다.
function findReview(req, res) {
  const review = reviews.find((item) => item.id === Number(req.params.id));

  if (!review) {
    res.status(404).json({ message: '그런 리뷰는 없어요' });
    return null;
  }

  return review;
}

// 그 리뷰에 «도움이 돼요» 를 누른 사람의 수
function countOf(review) {
  return helpfuls.filter((item) => item.reviewId === review.id).length;
}

// «도움이 돼요» - 몇 번을 보내도 결과는 «누른 상태» 하나다.
app.put('/api/reviews/:id/helpful/me', (req, res) => {
  const review = findReview(req, res);
  if (!review) return;

  const userId = res.locals.userId;
  const marked = helpfuls.some((item) => item.reviewId === review.id && item.userId === userId);

  // 아직 누르지 않았을 때만 줄을 넣고, 그때만 리뷰를 쓴 사람에게 알림을 남긴다.
  if (____) {
    const helpful = { id: nextId(helpfuls), reviewId: review.id, userId };
    helpfuls.push(helpful);

    // 내 리뷰에 내가 누른 것은 알리지 않는다.
    if (____) {
      notifications.push({
        id: nextId(notifications),
        receiverId: review.authorId,
        senderId: userId,
        reviewId: review.id,
        helpfulId: ____,
      });
    }
  }

  res.json({ helpful: true, helpfulCount: countOf(review) });
});

// «도움이 돼요» 취소 - 몇 번을 보내도 결과는 «누르지 않은 상태» 하나다.
app.delete('/api/reviews/:id/helpful/me', (req, res) => {
  const review = findReview(req, res);
  if (!review) return;

  const userId = res.locals.userId;
  const index = helpfuls.findIndex((item) => item.reviewId === review.id && item.userId === userId);

  // 누르고 있었을 때만 줄을 뺀다. 그 줄이 남긴 알림도 함께 뺀다.
  if (index !== -1) {
    const [helpful] = helpfuls.splice(index, 1);
    const at = notifications.findIndex((item) => ____);
    if (at !== -1) notifications.splice(at, 1);
  }

  res.json({ helpful: false, helpfulCount: countOf(review) });
});

// 내 알림 - 가장 최근 알림이 먼저다.
app.get('/api/notifications', (req, res) => {
  const mine = notifications.filter((item) => item.receiverId === res.locals.userId).reverse();

  res.json(mine.map((item) => ({
    id: item.id,
    from: users.find((user) => user.id === item.senderId).username,
    reviewId: item.reviewId,
  })));
});

// 이 서버의 실패는 { message } 하나로 답한다. 로그인 확인이 넘긴 에러는 상태 코드를 들고 있다.
app.use((err, req, res, next) => {
  if (err.status) {
    res.status(err.status).json({ message: err.message });
    return;
  }

  console.error(err);
  res.status(500).json({ message: '서버에서 문제가 생겼어요' });
});

app.listen(4068, () => {
  console.log('리뷰 서버가 4068번 포트에서 기다리고 있어요.');
});
