// ~/instagram-api/realtime.js
import { Server } from 'socket.io';
import cookieParser from 'cookie-parser';
import { z } from 'zod';
import * as tokenService from './services/tokenService.js';
import * as conversationService from './services/conversationService.js';
import { readToken } from './middlewares/auth.js';
import { messageSendSchema } from './schemas/conversationSchema.js';
import { BadRequestError, MESSAGES } from './errors.js';

// 이벤트로 받은 값을 검사한다 - HTTP 요청 본문을 검사하던 validateBody 와 같은 일이다.
function parse(schema, value) {
  const result = schema.safeParse(value);

  if (!result.success) throw new BadRequestError('VALIDATION_FAILED', z.treeifyError(result.error));

  return result.data;
}

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

    // 사람마다 방 하나 - 같은 사람이 탭을 여럿 열면 그 연결들이 모두 이 방에 든다.
    socket.join(`user:${userId}`);

    // 메시지 보내기 - 저장한 메시지를 그 대화방의 두 사람에게만 알린다.
    socket.on('dm:send', async (payload) => {
      // 이벤트 함수에서 난 에러는 Express 의 에러 미들웨어로 가지 않는다. 여기서 잡지 않으면 서버가 꺼진다.
      try {
        const { conversationId, content } = parse(messageSendSchema, payload);
        const { message, participantAId, participantBId } = await conversationService.sendMessage(conversationId, userId, content);
        io.to(`user:${participantAId}`).to(`user:${participantBId}`).emit('dm:message', message);
      } catch (error) {
        console.error(`${userId}번 사용자의 메시지를 보내지 못했어요 - ${error.message}`);
      }
    });

    socket.on('disconnect', () => {
      console.log(`${userId}번 사용자의 연결이 닫혔어요.`);
    });
  });
}
