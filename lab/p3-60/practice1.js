// ~/instagram-api/lab/p3-60/practice1.js
import express from 'express';
import cookieParser from 'cookie-parser';
import { users, subscriptions } from './subscribe-data.js';
import { requireLogin } from '../../middlewares/auth.js';

const app = express();
app.use(cookieParser());

// 여기부터는 로그인한 사람만 지나간다. 로그인은 수업 백엔드에서 하고 이 서버는 같은 쿠키에 든 토큰을 확인한다.
app.use(requireLogin);

// 사용자 이름으로 글쓴이를 찾는다 - 없으면 404 를 보내고 null 을 돌려준다.
function findUser(req, res) {
  const user = users.find((item) => item.username === req.params.username);

  if (!user) {
    res.status(404).json({ message: '그런 사용자는 없어요' });
    return null;
  }

  return user;
}

// 구독할 글쓴이를 찾는다 - 나 자신이면 400 을 보내고 null 을 돌려준다.
function findAuthor(req, res) {
  const author = findUser(req, res);
  if (!author) return null;

  if (author.id === res.locals.userId) {
    res.status(400).json({ message: '나 자신은 구독할 수 없어요' });
    return null;
  }

  return author;
}

// 글쓴이 한 사람 - 구독자 수까지.
app.get('/api/users/:username', (req, res) => {
  const user = findUser(req, res);
  if (!user) return;

  res.json({ id: user.id, username: user.username, subscriberCount: user.subscriberCount });
});

// 구독 - 몇 번을 보내도 결과는 «구독한 상태» 하나다.
app.put('/api/users/:username/subscribers/me', (req, res) => {
  const author = findAuthor(req, res);
  if (!author) return;

  const subscriberId = res.locals.userId;
  const subscribed = subscriptions.some((item) => item.subscriberId === subscriberId && item.authorId === author.id);

  // 아직 구독하지 않았을 때만 줄을 넣고 숫자를 올린다.
  if (!subscribed) {
    subscriptions.push({ subscriberId, authorId: author.id });
    author.subscriberCount += 1;
  }

  res.json({ subscribed: true, subscriberCount: author.subscriberCount });
});

// 구독 취소 - 몇 번을 보내도 결과는 «구독하지 않은 상태» 하나다.
app.delete('/api/users/:username/subscribers/me', (req, res) => {
  const author = findAuthor(req, res);
  if (!author) return;

  const subscriberId = res.locals.userId;
  const index = subscriptions.findIndex((item) => item.subscriberId === subscriberId && item.authorId === author.id);

  // 구독하고 있을 때만 줄을 빼고 숫자를 내린다.
  if (index !== -1) {
    subscriptions.splice(index, 1);
    author.subscriberCount -= 1;
  }

  res.json({ subscribed: false, subscriberCount: author.subscriberCount });
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

app.listen(4001, () => {
  console.log('리뷰 서버가 4001번 포트에서 기다리고 있어요.');
});
