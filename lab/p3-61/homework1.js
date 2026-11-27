// ~/instagram-api/lab/p3-61/homework1.js
import express from 'express';
import cookieParser from 'cookie-parser';
import { users, subscriptions } from './subscriber-data.js';
import { requireLogin } from '../../middlewares/auth.js';
import { encodeCursor, decodeCursor } from '../../utils/cursor.js';

const app = express();
app.use(cookieParser());

// 여기부터는 로그인한 사람만 지나간다. 로그인은 수업 백엔드에서 하고 이 서버는 같은 쿠키에 든 토큰을 확인한다.
app.use(requireLogin);

// 구독 줄을 «구독한 시각이 늦은 순, 같으면 줄 번호가 큰 순» 으로 세운다.
function newestFirst(a, b) {
  if (a.createdAt !== b.createdAt) {
    return a.createdAt < b.createdAt ? 1 : -1;
  }

  return b.id - a.id;
}

// 커서가 가리키는 줄의 «다음» 인가 - 시각이 더 이르거나, 시각이 같고 번호가 더 작으면 다음이다.
function isAfter(item, cursor) {
  return item.createdAt < cursor.createdAt || (item.createdAt === cursor.createdAt && item.id < cursor.id);
}

// 그 사람이 구독한 글쓴이 목록 - 가장 최근에 구독한 글쓴이가 먼저다. 한 번에 limit 명씩(없으면 5명) 나눠 준다.
app.get('/api/users/:username/subscriptions', (req, res) => {
  const user = users.find((item) => item.username === req.params.username);

  if (!user) {
    res.status(404).json({ message: '그런 사용자는 없어요' });
    return;
  }

  const limit = Number(req.query.limit ?? 5);
  const cursor = req.query.cursor ? decodeCursor(req.query.cursor) : null;

  // 구독자 목록과 반대 방향이다 - 그 사람이 구독한(subscriberId) 줄에서 글쓴이(authorId)를 꺼낸다.
  const rows = subscriptions
    .filter((item) => item.subscriberId === user.id)
    .sort(newestFirst)
    .filter((item) => cursor === null || isAfter(item, cursor));

  const page = rows.slice(0, limit);
  const hasNext = rows.length > limit;

  const items = page.map((item) => {
    const author = users.find((one) => one.id === item.authorId);
    // 로그인한 사람이 이 글쓴이를 구독하고 있나.
    const isSubscribed = subscriptions.some(
      (row) => row.subscriberId === res.locals.userId && row.authorId === author.id,
    );

    return { id: author.id, username: author.username, isSubscribed };
  });

  res.json({ items, hasNext, nextCursor: hasNext ? encodeCursor(page[page.length - 1]) : null });
});

// 이 서버의 실패는 { message } 하나로 답한다. 로그인 확인과 커서 풀기가 넘긴 에러는 상태 코드를 들고 있다.
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
