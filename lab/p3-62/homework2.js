// ~/instagram-api/lab/p3-62/homework2.js
import express from 'express';
import { Server } from 'socket.io';

const app = express();
app.use(express.static('lab/p3-62/public'));

const server = app.listen(4007, () => {
  console.log('경매 서버가 http://localhost:4007 에서 기다리고 있어요.');
});

const io = new Server(server);

// 받아들인 입찰 기록 - 번호가 늘어나는 차례로 쌓인다.
const bids = [];
let nextId = 1;
let price = 20000;

io.on('connection', (socket) => {
  const name = socket.handshake.query.name;

  socket.on('bid', (amount) => {
    if (amount <= price) {
      socket.emit('rejected', price);
      return;
    }

    price = amount;
    const bid = { id: nextId++, name, price };
    bids.push(bid);
    io.emit('bid', bid);
  });
});
