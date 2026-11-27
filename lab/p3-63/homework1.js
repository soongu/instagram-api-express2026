// ~/instagram-api/lab/p3-63/homework1.js
import express from 'express';
import cookieParser from 'cookie-parser';
import { users, products, inquiries, messages } from './inquiry-data.js';
import { requireLogin } from '../../middlewares/auth.js';

const app = express();
app.use(cookieParser());

// 여기부터는 로그인한 사람만 지나간다. 로그인은 수업 백엔드에서 하고 이 서버는 같은 쿠키에 든 토큰을 확인한다.
app.use(requireLogin);

// 문의방의 파는 사람 - 문의방에는 상품 번호만 있어서 상품에서 찾는다.
function sellerIdOf(inquiry) {
  return products.find((product) => product.id === inquiry.productId).sellerId;
}

// 시각이 늦은 것이 앞에 오게 세운다.
function newestFirst(a, b) {
  return a.createdAt < b.createdAt ? 1 : -1;
}

// 내 문의방 목록 - 늦게 연 방이 먼저다. 줄마다 상품 이름, 상대, 마지막 메시지를 싣는다.
app.get('/api/inquiries', (req, res) => {
  const myId = res.locals.userId;

  const items = inquiries
    // 내가 사려는 사람이거나 파는 사람인 방
    .filter((inquiry) => inquiry.buyerId === myId || sellerIdOf(inquiry) === myId)
    .sort(newestFirst)
    .map((inquiry) => {
      // 내가 사려는 사람이면 상대는 파는 사람이고, 내가 파는 사람이면 상대는 사려는 사람이다.
      const otherId = inquiry.buyerId === myId ? sellerIdOf(inquiry) : inquiry.buyerId;
      const other = users.find((user) => user.id === otherId);
      // 이 방의 메시지 가운데 가장 늦게 보낸 것 - 메시지가 없으면 undefined 다.
      const [last] = messages.filter((message) => message.inquiryId === inquiry.id).sort(newestFirst);

      return {
        id: inquiry.id,
        productName: products.find((product) => product.id === inquiry.productId).name,
        otherUser: { id: other.id, username: other.username },
        lastMessage: last ? { content: last.content, createdAt: last.createdAt } : null,
      };
    });

  res.json({ items });
});

// 내가 들어 있는 문의방을 찾는다 - 없는 방과 남의 방은 똑같이 undefined 다.
function findMyInquiry(id, myId) {
  return inquiries.find(
    (inquiry) => inquiry.id === id && (inquiry.buyerId === myId || sellerIdOf(inquiry) === myId),
  );
}

// 문의방의 메시지 - 가장 늦게 보낸 메시지가 먼저다.
app.get('/api/inquiries/:id/messages', (req, res) => {
  const inquiry = findMyInquiry(Number(req.params.id), res.locals.userId);

  if (!inquiry) {
    res.status(404).json({ message: '그런 문의방은 없어요' });
    return;
  }

  const items = messages
    .filter((message) => message.inquiryId === inquiry.id)
    .sort(newestFirst)
    .map(({ id, senderId, content, isRead, createdAt }) => ({ id, senderId, content, isRead, createdAt }));

  res.json({ items });
});

// 상대가 보낸, 아직 안 읽은 메시지를 모두 읽음으로 바꾼다 - 바뀐 수를 돌려준다.
app.patch('/api/inquiries/:id/messages/read', (req, res) => {
  const myId = res.locals.userId;
  const inquiry = findMyInquiry(Number(req.params.id), myId);

  if (!inquiry) {
    res.status(404).json({ message: '그런 문의방은 없어요' });
    return;
  }

  const unread = messages.filter(
    (message) => message.inquiryId === inquiry.id && message.senderId !== myId && !message.isRead,
  );

  for (const message of unread) message.isRead = true;

  res.json({ readCount: unread.length });
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
  console.log('문의 서버가 4001번 포트에서 기다리고 있어요.');
});
