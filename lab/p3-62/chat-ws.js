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

  // 메시지는 JSON 글자로 주고받고, type 으로 종류를 가른다.
  socket.on('message', (data) => {
    let message;
    try {
      message = JSON.parse(data.toString());
    } catch {
      return; // JSON 이 아니면 버린다
    }

    for (const client of wss.clients) {
      // «입력 중» 은 보낸 사람에게는 돌려보내지 않는다.
      if (message.type === 'typing' && client === socket) {
        continue;
      }
      client.send(JSON.stringify(message));
    }
  });

  socket.on('close', () => {
    console.log(`연결이 하나 닫혔어요. 지금 연결은 ${wss.clients.size}개예요.`);
  });
});
