// ~/instagram-api/lab/p3-64/homework2.js
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

// 내가 들어 있는 문의방을 찾는다 - 없는 방과 남의 방은 똑같이 undefined 다.
function findMyInquiry(id, myId) {
  return inquiries.find(
    (inquiry) => inquiry.id === id && (inquiry.buyerId === myId || sellerIdOf(inquiry) === myId),
  );
}

// 결과를 기다리는 화면에만 돌려준다.
function reply(ack, body) {
  if (typeof ack === 'function') ack(body);
}

io.on('connection', (socket) => {
  const { userId } = socket.data;
  socket.join(`user:${userId}`);

  // 문의 메시지 - 내 문의방이고 내용이 있을 때만 저장하고, 결과를 ack 로 돌려준다.
  socket.on('inquiry:send', (payload, ack) => {
    const inquiry = findMyInquiry(payload?.inquiryId, userId);

    if (!inquiry) {
      reply(ack, { error: { message: '그런 문의방은 없어요' } });
      return;
    }

    const content = typeof payload.content === 'string' ? payload.content.trim() : '';

    if (content.length < 1 || content.length > 500) {
      reply(ack, { error: { message: '문의는 1~500자로 보내 주세요' } });
      return;
    }

    const message = {
      id: messages.length + 1,
      inquiryId: inquiry.id,
      senderId: userId,
      content,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    messages.push(message);

    io.to(`user:${inquiry.buyerId}`).to(`user:${sellerIdOf(inquiry)}`).emit('inquiry:message', message);
    reply(ack, { data: message });
  });

  // 읽음 - 상대가 보낸 안 읽은 메시지를 읽음으로 바꾸고, 바뀐 수를 ack 로 돌려준다.
  // 하나라도 바뀌었으면 상대에게 «읽었다» 를 알린다. 바뀐 것이 없으면 알리지 않는다.
  socket.on('inquiry:read', (payload, ack) => {
    const inquiry = findMyInquiry(payload?.inquiryId, userId);

    if (!inquiry) {
      reply(ack, { error: { message: '그런 문의방은 없어요' } });
      return;
    }

    const unread = messages.filter(
      (message) => message.inquiryId === inquiry.id && message.senderId !== userId && !message.isRead,
    );
    for (const message of unread) message.isRead = true;

    if (unread.length > 0) {
      const otherId = inquiry.buyerId === userId ? sellerIdOf(inquiry) : inquiry.buyerId;
      io.to(`user:${otherId}`).emit('inquiry:read', { inquiryId: inquiry.id, readerId: userId });
    }

    reply(ack, { data: { readCount: unread.length } });
  });
});
