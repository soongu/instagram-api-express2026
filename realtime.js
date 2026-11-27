// ~/instagram-api/realtime.js
import { Server } from 'socket.io';
import cookieParser from 'cookie-parser';
import { z } from 'zod';
import * as tokenService from './services/tokenService.js';
import * as conversationService from './services/conversationService.js';
import { readToken } from './middlewares/auth.js';
import { messageSendSchema, typingSchema } from './schemas/conversationSchema.js';
import { BadRequestError, HttpError, MESSAGES } from './errors.js';

// 이벤트로 받은 값을 검사한다 - HTTP 요청 본문을 검사하던 validateBody 와 같은 일이다.
function parse(schema, value) {
  const result = schema.safeParse(value);

  if (!result.success) throw new BadRequestError('VALIDATION_FAILED', z.treeifyError(result.error));

  return result.data;
}

// 실패를 보낼 때의 모양 - HTTP 응답 봉투의 error 와 같다. 상태 코드는 연결에는 없어서 싣지 않는다.
function errorBody(error) {
  if (error instanceof HttpError) {
    return { code: error.code, message: error.message, details: error.details };
  }

  // 우리가 던진 에러가 아니면 터미널에 남기고, 화면에는 자세한 내용을 보내지 않는다.
  console.error(error);
  return { code: 'INTERNAL_ERROR', message: MESSAGES.INTERNAL_ERROR };
}

// 화면이 결과를 기다리면(emit 의 마지막 인자로 함수를 넘겼으면) 그 함수로 돌려준다.
function reply(ack, body) {
  if (typeof ack === 'function') ack(body);
}

// 붙인 Socket.IO 서버 - 연결 밖(REST 요청을 처리하는 곳)에서도 이벤트를 보내려고 모듈에 둔다.
let io = null;

// 개발용 - 사람 번호마다 «이 시각까지는 연결을 받지 않는다». dropConnections 가 적는다.
const blockedUntil = new Map();

// 개발용 - 그 사람의 연결을 모두 끊고 seconds 초 동안 다시 붙지 못하게 한다. 끊은 연결 수를 돌려준다.
// 연결의 전송(socket.conn)만 닫는다 - 화면은 네트워크가 끊긴 것으로 보고 스스로 다시 연결을 시도한다.
// socket.disconnect() 는 «서버가 끊었다» 로 알려서 화면이 다시 연결하지 않는다.
export function dropConnections(userId, seconds) {
  if (io === null) return 0;

  blockedUntil.set(userId, Date.now() + seconds * 1000);

  const ids = io.sockets.adapter.rooms.get(`user:${userId}`) ?? new Set();
  const sockets = [...ids].map((id) => io.sockets.sockets.get(id)).filter(Boolean);
  sockets.forEach((socket) => socket.conn.close());

  return sockets.length;
}

// 막아 둔 사람이 보낸 연결 요청인가 - 쿠키의 토큰으로 누구인지 본다. 토큰이 없거나 틀리면 막지 않는다(로그인 확인은 io.use 가 한다).
function isBlocked(req) {
  try {
    const userId = Number(tokenService.verifyAccessToken(readToken(req)).sub);
    return (blockedUntil.get(userId) ?? 0) > Date.now();
  } catch {
    return false;
  }
}

// 그 사람들의 연결에 이벤트를 보낸다 - 한 사람이 탭을 여럿 열었으면 그 탭 모두에 간다.
// REST 요청을 처리하다가 연결로 알려야 할 때 쓴다. 서버를 띄우기 전(io 가 없을 때)에는 아무것도 안 한다.
export function emitToUsers(userIds, event, payload) {
  if (io === null) return;

  io.to(userIds.map((id) => `user:${id}`)).emit(event, payload);
}

// API 를 내주는 그 HTTP 서버에 Socket.IO 를 붙인다 - 화면은 같은 주소, 같은 포트로 연결을 연다.
export function startRealtime(server) {
  io = new Server(server);

  // 연결을 여는 HTTP 요청에도 쿠키가 실려 온다. Express 앱에서처럼 그 쿠키를 읽어 둔다.
  io.engine.use(cookieParser());

  // 막아 둔 사람의 연결 요청은 HTTP 403 으로 돌려보낸다 - 화면은 네트워크 실패로 보고 간격을 늘려 가며 다시 시도한다.
  // io.use 에서 거절하면 화면이 «서버가 거절했다» 로 보고 다시 시도하지 않아서, 그 앞 단계에서 막는다.
  io.engine.use((req, res, next) => {
    if (isBlocked(req)) {
      res.writeHead(403);
      res.end();
      return;
    }
    next();
  });

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
    // 결과는 보낸 연결에만 ack 로 돌려준다 - 성공은 { data }, 실패는 { error }.
    socket.on('dm:send', async (payload, ack) => {
      // 이벤트 함수에서 난 에러는 Express 의 에러 미들웨어로 가지 않는다. 여기서 잡지 않으면 서버가 꺼진다.
      try {
        const { conversationId, content } = parse(messageSendSchema, payload);
        const { message, participantAId, participantBId } = await conversationService.sendMessage(conversationId, userId, content);
        io.to(`user:${participantAId}`).to(`user:${participantBId}`).emit('dm:message', message);
        reply(ack, { data: message });
      } catch (error) {
        reply(ack, { error: errorBody(error) });
      }
    });

    // 입력 중 - 저장하지 않고 상대에게만 알린다. 나는 내가 치고 있다는 것을 이미 안다.
    socket.on('dm:typing', async (payload) => {
      try {
        const { conversationId, typing } = parse(typingSchema, payload);
        const otherId = await conversationService.otherParticipantId(conversationId, userId);
        io.to(`user:${otherId}`).emit('dm:typing', { conversationId, senderId: userId, typing });
      } catch (error) {
        // 입력 중 표시는 놓쳐도 다음 글자에서 다시 온다. 결과를 돌려주지 않고 로그만 남긴다.
        console.warn(`${userId}번 사용자의 입력 중 표시를 보내지 못했어요 - ${error.message}`);
      }
    });

    socket.on('disconnect', () => {
      console.log(`${userId}번 사용자의 연결이 닫혔어요.`);
    });
  });
}
