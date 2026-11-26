// ~/instagram-api/lab/p3-62/practice1.js
import express from 'express';
import { WebSocketServer } from 'ws';

const app = express();
app.use(express.static('lab/p3-62/public'));

const server = app.listen(4004, () => {
  console.log('경매 서버가 http://localhost:4004 에서 기다리고 있어요.');
});

const wss = new WebSocketServer({ server });

// 필름 카메라 한 대의 지금 최고가와 그 값을 부른 사람
let price = 10000;
let bidder = null;

wss.on('connection', (socket) => {
  // 붙자마자 지금 가격을 이 연결에만 알려 준다.
  socket.send(JSON.stringify({ type: 'price', price, bidder }));

  socket.on('message', (data) => {
    let message;
    try {
      message = JSON.parse(data.toString());
    } catch {
      return;
    }
    if (message.type !== 'bid') {
      return;
    }

    // 지금 가격보다 높지 않으면 보낸 사람에게만 거절을 알린다.
    if (message.price <= price) {
      socket.send(JSON.stringify({ type: 'rejected', price }));
      return;
    }

    price = message.price;
    bidder = message.name;
    for (const client of wss.clients) {
      client.send(JSON.stringify({ type: 'price', price, bidder }));
    }
  });
});
