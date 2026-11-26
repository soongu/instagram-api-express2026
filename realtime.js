// ~/instagram-api/realtime.js
import { Server } from 'socket.io';
import cookieParser from 'cookie-parser';
import * as tokenService from './services/tokenService.js';
import * as conversationService from './services/conversationService.js';
import { readToken } from './middlewares/auth.js';
import { MESSAGES } from './errors.js';

// API 를 내주는 그 HTTP 서버에 Socket.IO 를 붙인다 - 화면은 같은 주소, 같은 포트로 연결을 연다.
export function startRealtime(server) {
  const io = new Server(server);

  // 연결을 여는 HTTP 요청에도 쿠키가 실려 온다. Express 앱에서처럼 그 쿠키를 읽어 둔다.
  io.engine.use(cookieParser());

  // 연결이 열리기 전에 한 번 - HTTP 요청에서 requireLogin 이 하던 확인을 여기서 한다.
  io.use((socket, next) => {
    try {
      const payload = tokenService.verifyAccessToken(readToken(socket.request));
      // 이 연결로 오는 모든 이벤트는 이 사람이 보낸 것이다. 화면이 보내는 값으로 정하지 않는다.
      socket.data.userId = Number(payload.sub);
      next();
    } catch (error) {
      const code = error.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'LOGIN_REQUIRED';
      const refused = new Error(MESSAGES[code]);
      refused.data = { code };
      next(refused);
    }
  });

  io.on('connection', (socket) => {
    const { userId } = socket.data;
    console.log(`${userId}번 사용자의 연결이 열렸어요. 지금 연결은 ${io.engine.clientsCount}개예요.`);

    // 메시지 보내기 - 저장한 메시지를 알린다.
    socket.on('dm:send', async ({ conversationId, content }) => {
      const message = await conversationService.sendMessage(conversationId, userId, content);
      io.emit('dm:message', message);
    });

    socket.on('disconnect', () => {
      console.log(`${userId}번 사용자의 연결이 닫혔어요.`);
    });
  });
}
