// ~/instagram-api/lab/p3-64/practice1.js
import express from 'express';
import cookieParser from 'cookie-parser';
import { Server } from 'socket.io';
import { products, inquiries, messages } from '../p3-63/inquiry-data.js';
import * as tokenService from '../../services/tokenService.js';
import { readToken } from '../../middlewares/auth.js';

const app = express();
app.use(express.static('lab/p3-64/public'));

const server = app.listen(4001, () => {
  console.log('문의 서버가 4001번 포트에서 기다리고 있어요.');
});

const io = new Server(server);
io.engine.use(cookieParser());

// 로그인은 수업 백엔드에서 한다. 이 서버는 같은 쿠키에 든 토큰으로 누가 연결했는지 정한다.
io.use((socket, next) => {
  try {
    const payload = tokenService.verifyAccessToken(readToken(socket.request));
    socket.data.userId = Number(payload.sub);
    next();
  } catch {
    next(new Error('로그인이 필요해요'));
  }
});

// 문의방의 파는 사람 - 문의방에는 상품 번호만 있어서 상품에서 찾는다.
function sellerIdOf(inquiry) {
  return products.find((product) => product.id === inquiry.productId).sellerId;
}

io.on('connection', (socket) => {
  const { userId } = socket.data;
  socket.join(`user:${userId}`);

  // 문의 메시지 - 그 문의방의 사려는 사람과 파는 사람에게만 알린다.
  socket.on('inquiry:send', ({ inquiryId, content }) => {
    const inquiry = inquiries.find((one) => one.id === inquiryId);
    const message = {
      id: messages.length + 1,
      inquiryId,
      senderId: userId,
      content,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    messages.push(message);

    io.to(`user:${inquiry.buyerId}`).to(`user:${sellerIdOf(inquiry)}`).emit('inquiry:message', message);
  });
});
