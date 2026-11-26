// ~/instagram-api/realtime.js
import { Server } from 'socket.io';

// API 를 내주는 그 HTTP 서버에 Socket.IO 를 붙인다 - 화면은 같은 주소, 같은 포트로 연결을 연다.
export function startRealtime(server) {
  const io = new Server(server);

  io.on('connection', (socket) => {
    console.log(`연결이 열렸어요. 지금 연결은 ${io.engine.clientsCount}개예요.`);

    socket.on('disconnect', () => {
      console.log('연결이 닫혔어요.');
    });
  });
}
