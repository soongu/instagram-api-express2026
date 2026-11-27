// ~/instagram-api/lab/p3-65/homework2.js
import express from 'express';
import cookieParser from 'cookie-parser';
import { Server } from 'socket.io';
import { users, products, inquiries, messages } from '../p3-63/inquiry-data.js';
import * as tokenService from '../../services/tokenService.js';
import { requireLogin, readToken } from '../../middlewares/auth.js';

const app = express();
app.use(express.static('lab/p3-64/public'));
app.use(cookieParser());

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

// 시각이 늦은 메시지가 앞에 오게 세운다.
function newestFirst(a, b) {
  return a.createdAt < b.createdAt ? 1 : -1;
}

// 이 방에서 그 사람이 «안 읽은 수» 를 적는 이름 - 사려는 사람이면 buyerUnread, 파는 사람이면 sellerUnread 다.
function unreadField(inquiry, userId) {
  return inquiry.buyerId === userId ? 'buyerUnread' : 'sellerUnread';
}

// 서버가 뜰 때 한 번 - 문의방마다 가장 최근 메시지와, 두 사람이 안 읽은 메시지 수를 적어 둔다.
for (const inquiry of inquiries) {
  const inRoom = messages.filter((message) => message.inquiryId === inquiry.id);
  const [last] = [...inRoom].sort(newestFirst);
  inquiry.lastMessageId = last ? last.id : null;
  inquiry.lastMessageAt = last ? last.createdAt : inquiry.createdAt;

  // 상대가 보냈는데 아직 안 읽은 메시지 - 사려는 사람이 안 읽은 것은 파는 사람이 보낸 것이다.
  const unread = inRoom.filter((message) => !message.isRead);
  inquiry.buyerUnread = unread.filter((message) => message.senderId !== inquiry.buyerId).length;
  inquiry.sellerUnread = unread.filter((message) => message.senderId === inquiry.buyerId).length;
}

// 마지막 메시지가 늦은 문의방이 앞에 오게 세운다.
function latestFirst(a, b) {
  return a.lastMessageAt < b.lastMessageAt ? 1 : -1;
}

// 내 문의방 목록 - 마지막 메시지가 늦은 방이 먼저다. 미리보기는 적어 둔 번호로 메시지 하나만 찾는다.
app.get('/api/inquiries', requireLogin, (req, res) => {
  const myId = res.locals.userId;

  const items = inquiries
    .filter((inquiry) => inquiry.buyerId === myId || sellerIdOf(inquiry) === myId)
    .sort(latestFirst)
    .map((inquiry) => {
      const otherId = inquiry.buyerId === myId ? sellerIdOf(inquiry) : inquiry.buyerId;
      const other = users.find((user) => user.id === otherId);
      const last = messages.find((message) => message.id === inquiry.lastMessageId);

      return {
        id: inquiry.id,
        productName: products.find((product) => product.id === inquiry.productId).name,
        otherUser: { id: other.id, username: other.username },
        lastMessage: last ? { content: last.content, createdAt: last.createdAt } : null,
        // 메시지를 세지 않고 적어 둔 수를 그대로 싣는다.
        unreadCount: inquiry[unreadField(inquiry, myId)],
      };
    });

  res.json({ items });
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

// 결과를 기다리는 화면에만 돌려준다.
function reply(ack, body) {
  if (typeof ack === 'function') ack(body);
}

io.on('connection', (socket) => {
  const { userId } = socket.data;
  socket.join(`user:${userId}`);

  // 문의 메시지 - 저장하면서 그 문의방의 마지막 메시지도 함께 고친다.
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
    inquiry.lastMessageId = message.id;
    inquiry.lastMessageAt = message.createdAt;
    // 받는 사람 쪽의 안 읽은 수가 하나 는다.
    const otherId = inquiry.buyerId === userId ? sellerIdOf(inquiry) : inquiry.buyerId;
    inquiry[unreadField(inquiry, otherId)] += 1;

    io.to(`user:${inquiry.buyerId}`).to(`user:${sellerIdOf(inquiry)}`).emit('inquiry:message', message);
    reply(ack, { data: message });
  });

  // 문의방 읽음 - 상대가 보낸 안 읽은 메시지를 읽음으로 바꾸고, 내 쪽의 안 읽은 수를 0 으로 적는다.
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
    inquiry[unreadField(inquiry, userId)] = 0;

    reply(ack, { data: { readCount: unread.length } });
  });
});
