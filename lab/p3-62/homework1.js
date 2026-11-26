// ~/instagram-api/lab/p3-62/homework1.js
import express from 'express';
import { Server } from 'socket.io';

const app = express();
app.use(express.json());
app.use(express.static('lab/p3-62/public'));

const item = { name: '빈티지 자전거', price: 50000, bidder: null };

app.get('/item', (req, res) => {
  res.json(item);
});

app.post('/bids', (req, res) => {
  const { name, price } = req.body;
  if (price <= item.price) {
    return res.status(400).json({ message: `지금 가격(${item.price.toLocaleString()}원)보다 높게 불러 주세요.` });
  }

  item.price = price;
  item.bidder = name;
  res.status(201).json(item);

  // 받아들인 입찰은 연결로 모두에게 알린다.
  io.emit('price', item);
});

const server = app.listen(4006, () => {
  console.log('경매 서버가 http://localhost:4006 에서 기다리고 있어요.');
});

const io = new Server(server);
