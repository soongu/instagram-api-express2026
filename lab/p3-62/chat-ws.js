// ~/instagram-api/lab/p3-62/chat-ws.js
import express from 'express';
import { WebSocketServer } from 'ws';

const app = express();
app.use(express.static('lab/p3-62/public'));

const server = app.listen(4002, () => {
  console.log('채팅 서버가 http://localhost:4002 에서 기다리고 있어요.');
});

// 같은 서버(같은 포트)로 들어오는 WebSocket 연결을 받는다.
const wss = new WebSocketServer({ server });

wss.on('connection', (socket) => {
  console.log(`연결이 하나 열렸어요. 지금 연결은 ${wss.clients.size}개예요.`);

  socket.on('close', () => {
    console.log(`연결이 하나 닫혔어요. 지금 연결은 ${wss.clients.size}개예요.`);
  });
});
