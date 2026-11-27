// ~/instagram-api/lab/p3-70/notice-server.js
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';

// 동네 책장 알림 서버 - 화면(public/)과 연결(Socket.IO)을 함께 내준다. 토큰의 기한은 일부러 20초로 짧게 뒀다.
const TOKEN_SECONDS = 20;

const app = express();
app.use(express.json());
app.use(express.static(fileURLToPath(new URL('./public', import.meta.url))));

app.use((req, res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
});

// 쿠키 글자에서 그 이름의 값을 꺼낸다.
const cookieOf = (header, name) => header?.match(new RegExp(`(?:^|; )${name}=([^;]+)`))?.[1];

// 실습이라 서명 없는 토큰이다 - 누구인지와 기한만 담는다(수업 서버는 서명한 JWT 를 쓴다).
const makeToken = (name) => Buffer.from(JSON.stringify({ name, exp: Date.now() + TOKEN_SECONDS * 1000 })).toString('base64url');
const readToken = (value) => JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));

// 로그인 기록 - Refresh 쿠키의 값(이름)이 여기 있어야 새 토큰을 준다.
const sessions = new Set();

// 토큰을 확인한다 - 문제가 있으면 에러 코드를, 없으면 이름을 돌려준다.
function check(cookieHeader) {
  const value = cookieOf(cookieHeader, 'token');
  if (!value) return { code: 'LOGIN_REQUIRED' };
  const { name, exp } = readToken(value);
  if (exp < Date.now()) return { code: 'TOKEN_EXPIRED' };
  return { name };
}

app.post('/api/login', (req, res) => {
  const name = req.body.name;
  sessions.add(name);
  res.cookie('token', makeToken(name), { httpOnly: true, sameSite: 'lax' });
  res.cookie('refresh', name, { httpOnly: true, sameSite: 'lax', path: '/api/reissue' });
  res.json({ name });
});

app.post('/api/reissue', (req, res) => {
  const name = cookieOf(req.headers.cookie, 'refresh');
  if (!name || !sessions.has(name)) {
    res.status(401).json({ code: 'LOGIN_REQUIRED', message: '다시 로그인해 주세요' });
    return;
  }
  res.cookie('token', makeToken(name), { httpOnly: true, sameSite: 'lax' });
  res.json({ message: '새 토큰을 받았어요' });
});

const server = http.createServer(app);
const io = new Server(server);

// 연결을 열기 전에 한 번 토큰을 본다 - 수업 서버의 io.use 와 같은 모양으로 거절한다.
io.use((socket, next) => {
  const result = check(socket.request.headers.cookie);
  if (result.code) {
    const refused = new Error(result.code === 'TOKEN_EXPIRED' ? '토큰의 기한이 지났어요' : '로그인이 필요해요');
    refused.data = { code: result.code };
    next(refused);
    return;
  }
  socket.data.name = result.name;
  next();
});

io.on('connection', (socket) => {
  console.log(`${socket.data.name}의 연결이 열렸어요`);
  socket.join('readers');
});

// ── 개발용 ──
let noticeId = 0;
// 새 알림 하나를 연결된 모든 화면에 보낸다.
app.post('/api/dev/notices', (req, res) => {
  noticeId += 1;
  const notice = { id: noticeId, text: `새 책이 들어왔어요 ${noticeId}` };
  io.to('readers').emit('notice', notice);
  res.status(201).json(notice);
});
// 지금 연결을 모두 끊는다 - 전송만 닫아서, 화면은 네트워크가 끊긴 것으로 보고 다시 붙으려고 한다.
app.post('/api/dev/drop', (req, res) => {
  const count = io.engine.clientsCount;
  for (const socket of io.sockets.sockets.values()) socket.conn.close();
  res.json({ closedCount: count });
});
// 로그인 기록을 모두 지운다 - 다른 기기에서 «모든 기기에서 로그아웃» 을 누른 것과 같다.
app.post('/api/dev/end-sessions', (req, res) => {
  sessions.clear();
  res.json({ message: '로그인 기록을 지웠어요' });
});

server.listen(4079, () => console.log('동네 책장 알림 서버가 http://localhost:4079 에서 기다리고 있어요'));
