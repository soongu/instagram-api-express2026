// ~/instagram-api/lab/p3-69/practice1.js
import http from 'node:http';
import express from 'express';
import cookieParser from 'cookie-parser';
import { Server } from 'socket.io';
import { users, reviews, helpfuls, notifications } from './helpful-data.js';
import { requireLogin, readToken } from '../../middlewares/auth.js';
import * as tokenService from '../../services/tokenService.js';

const app = express();
app.use(cookieParser());

// 받은 알림을 보여 주는 확인용 화면(watch.html) - ~/instagram-api 폴더에서 켜니 그 폴더 기준의 경로다.
// 화면 파일은 로그인하지 않아도 받는다. 로그인은 화면이 연결을 열 때 확인한다.
app.use(express.static('lab/p3-69/public'));

// 여기부터는 로그인한 사람만 지나간다. 로그인은 수업 백엔드에서 하고 이 서버는 같은 쿠키에 든 토큰을 확인한다.
app.use(requireLogin);

// API 를 내주는 HTTP 서버에 Socket.IO 를 붙인다 - 수업 백엔드의 realtime.js 와 같은 꼴이다.
const server = http.createServer(app);
const io = new Server(server);
io.engine.use(cookieParser());

// 연결이 열리기 전에 로그인한 사람을 정한다.
io.use((socket, next) => {
  try {
    const payload = tokenService.verifyAccessToken(readToken(socket.request));
    socket.data.userId = Number(payload.sub);
    next();
  } catch {
    next(new Error('로그인이 필요해요'));
  }
});

// 사람마다 방 하나 - 그 사람이 연 연결이 모두 이 방에 든다.
io.on('connection', (socket) => {
  socket.join(`user:${socket.data.userId}`);
});

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

// 알림 한 줄 - 목록으로 줄 때도, 연결로 보낼 때도 이 모양이다.
function toItem(item) {
  return {
    id: item.id,
    from: users.find((user) => user.id === item.senderId).username,
    reviewId: item.reviewId,
  };
}

// «도움이 돼요» - 몇 번을 보내도 결과는 «누른 상태» 하나다.
app.put('/api/reviews/:id/helpful/me', (req, res) => {
  const review = findReview(req, res);
  if (!review) return;

  const userId = res.locals.userId;
  const marked = helpfuls.some((item) => item.reviewId === review.id && item.userId === userId);

  // 아직 누르지 않았을 때만 줄을 넣고, 그때만 리뷰를 쓴 사람에게 알림을 남긴다.
  if (!marked) {
    const helpful = { id: nextId(helpfuls), reviewId: review.id, userId };
    helpfuls.push(helpful);

    // 내 리뷰에 내가 누른 것은 알리지 않는다.
    if (review.authorId !== userId) {
      const notification = {
        id: nextId(notifications),
        receiverId: review.authorId,
        senderId: userId,
        reviewId: review.id,
        helpfulId: helpful.id,
      };
      notifications.push(notification);

      // 남긴 뒤에 리뷰를 쓴 사람의 연결로 보낸다.
      io.to(`user:${review.authorId}`).emit('notification:new', toItem(notification));
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
    const at = notifications.findIndex((item) => item.helpfulId === helpful.id);

    if (at !== -1) {
      const [removed] = notifications.splice(at, 1);

      // 뺀 뒤에 그 알림을 받았던 사람에게 «사라졌다» 를 보낸다.
      io.to(`user:${removed.receiverId}`).emit('notification:removed', { id: removed.id });
    }
  }

  res.json({ helpful: false, helpfulCount: countOf(review) });
});

// 내 알림 - 가장 최근 알림이 먼저다.
app.get('/api/notifications', (req, res) => {
  const mine = notifications.filter((item) => item.receiverId === res.locals.userId).reverse();

  res.json(mine.map(toItem));
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

server.listen(4072, () => {
  console.log('리뷰 서버가 4072번 포트에서 기다리고 있어요.');
});
