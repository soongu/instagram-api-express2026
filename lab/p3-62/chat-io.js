// ~/instagram-api/lab/p3-62/chat-io.js
import express from 'express';
import { Server } from 'socket.io';

const app = express();
app.use(express.static('lab/p3-62/public'));

const server = app.listen(4003, () => {
  console.log('채팅 서버가 http://localhost:4003 에서 기다리고 있어요.');
});

const io = new Server(server);

io.on('connection', (socket) => {
  const name = socket.handshake.query.name;
  console.log(`${name} 연결이 열렸어요. 지금 연결은 ${io.engine.clientsCount}개예요.`);

  // 사람마다 자기 이름의 방에 넣어 둔다. 한 사람에게만 보낼 때 그 방으로 보낸다.
  socket.join(name);

  // 이벤트 이름이 곧 종류다. 값은 객체 그대로 오간다.
  socket.on('chat', (text) => {
    io.emit('chat', { name, text });
  });

  socket.on('typing', () => {
    socket.broadcast.emit('typing', { name });
  });

  socket.on('whisper', ({ to, text }) => {
    io.to(to).to(name).emit('chat', { name, text: `(귓속말) ${text}` });
  });

  socket.on('disconnect', () => {
    console.log(`${name} 연결이 닫혔어요. 지금 연결은 ${io.engine.clientsCount}개예요.`);
  });
});
