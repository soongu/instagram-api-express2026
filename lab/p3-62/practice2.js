// ~/instagram-api/lab/p3-62/practice2.js
import express from 'express';
import { Server } from 'socket.io';

const app = express();
app.use(express.static('lab/p3-62/public'));

const server = app.listen(4005, () => {
  console.log('경매 서버가 http://localhost:4005 에서 기다리고 있어요.');
});

const io = new Server(server);

const items = {
  1: { name: '필름 카메라', price: 10000, bidder: null },
  2: { name: '턴테이블', price: 30000, bidder: null },
};

io.on('connection', (socket) => {
  const { item: id, name } = socket.handshake.query;
  const item = items[id];
  if (!item) {
    socket.disconnect();
    return;
  }

  // 같은 물건을 보는 사람끼리 한 방에 모은다.
  const room = `item:${id}`;
  socket.join(room);
  socket.emit('price', item);

  socket.on('bid', (price) => {
    if (price <= item.price) {
      socket.emit('rejected', item.price);
      return;
    }

    item.price = price;
    item.bidder = name;
    io.to(room).emit('price', item);
  });
});
