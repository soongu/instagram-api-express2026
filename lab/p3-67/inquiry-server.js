// ~/instagram-api/lab/p3-67/inquiry-server.js
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';

// 실습 화면(next-lab)의 주소 - 다른 출처라 CORS 로 허락한다.
const SCREEN = 'http://localhost:3002';

const app = express();
app.use(cors({ origin: SCREEN }));
app.use(express.json());
// 상대(손님) 쪽 시험 화면 - http://localhost:4067 을 열면 seoyeon 들로 보낼 수 있다.
app.use(express.static('lab/p3-67/public'));

const server = app.listen(4067, () => {
  console.log('문의방 실시간 서버가 http://localhost:4067 에서 기다리고 있어요.');
});

const io = new Server(server, { cors: { origin: SCREEN } });

// ── 데이터 - 실습 서버라 데이터베이스 대신 메모리에 둔다. 서버를 다시 켜면 처음으로 돌아간다. ──
const users = [
  { id: 2, username: 'jaehoon' },
  { id: 43, username: 'seoyeon' },
  { id: 50, username: 'sujin' },
  { id: 51, username: 'taeyang' },
];
// 문의방 - 물건 하나를 두고 jaehoon(판매자)과 손님 한 사람이 나누는 대화다.
const inquiries = [
  { id: 1, item: '캠핑 의자 2개', buyerId: 43 },
  { id: 2, item: '자전거 헬멧', buyerId: 50 },
  { id: 4, item: '무선 키보드', buyerId: 51 },
];
const seoul = (day, hour, minute) => new Date(Date.UTC(2026, 10, day, hour - 9, minute)).toISOString();
const messages = [
  { id: 1, inquiryId: 1, senderId: 43, content: '안녕하세요, 캠핑 의자 아직 있나요?', createdAt: seoul(24, 20, 10), isRead: true },
  { id: 2, inquiryId: 1, senderId: 43, content: '두 개 다 사고 싶어요', createdAt: seoul(24, 20, 11), isRead: true },
  { id: 3, inquiryId: 1, senderId: 2, content: '네, 아직 있어요', createdAt: seoul(24, 20, 30), isRead: true },
  { id: 4, inquiryId: 1, senderId: 2, content: '두 개 같이 가져가시면 3만 원에 드릴게요', createdAt: seoul(24, 20, 31), isRead: true },
  { id: 5, inquiryId: 1, senderId: 43, content: '좋아요! 내일 받으러 가도 될까요?', createdAt: seoul(24, 21, 2), isRead: true },
  { id: 6, inquiryId: 1, senderId: 2, content: '오늘 저녁 7시 괜찮으세요?', createdAt: seoul(25, 9, 15), isRead: true },
  { id: 7, inquiryId: 1, senderId: 43, content: '네, 7시에 갈게요', createdAt: seoul(25, 18, 20), isRead: false },
  { id: 8, inquiryId: 1, senderId: 43, content: '역 2번 출구 앞에서 봬요', createdAt: seoul(25, 18, 21), isRead: false },
  { id: 201, inquiryId: 4, senderId: 51, content: '키보드 블루투스로 연결되나요?', createdAt: seoul(23, 14, 0), isRead: true },
  { id: 202, inquiryId: 4, senderId: 2, content: '네, 블루투스랑 선 둘 다 돼요', createdAt: seoul(23, 14, 5), isRead: true },
  { id: 203, inquiryId: 4, senderId: 51, content: '생각해 보고 다시 연락드릴게요', createdAt: seoul(23, 14, 30), isRead: false },
];
// 2번 방(sujin) - «1번째 문의» 부터 «45번째 문의» 까지. 세 개씩 번갈아 보낸다. 모두 읽었다.
for (let n = 1; n <= 45; n += 1) {
  messages.push({
    id: 100 + n, inquiryId: 2, senderId: Math.floor((n - 1) / 3) % 2 === 0 ? 50 : 2,
    content: `${n}번째 문의`, createdAt: n <= 20 ? seoul(24, 9, n * 2) : seoul(25, 9, (n - 20) * 2), isRead: true,
  });
}
let nextId = 300;

const userOf = (username) => users.find((user) => user.username === username);
// 이 방에서 그 사람의 상대
const otherOf = (inquiry, userId) => (userId === 2 ? inquiry.buyerId : 2);
const newestFirst = (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id;
const pick = ({ id, senderId, content, createdAt, isRead }) => ({ id, senderId, content, createdAt, isRead });

// 문의방 한 줄 - 상대 · 마지막 메시지 · 그 사람이 안 읽은 메시지 수
function rowOf(inquiry, userId) {
  const own = messages.filter((m) => m.inquiryId === inquiry.id).sort(newestFirst);
  return {
    id: inquiry.id,
    item: inquiry.item,
    otherUser: users.find((user) => user.id === otherOf(inquiry, userId)),
    lastMessage: own[0] ? pick(own[0]) : null,
    lastMessageAt: own[0]?.createdAt ?? null,
    unreadCount: own.filter((m) => m.senderId !== userId && !m.isRead).length,
  };
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// 이 실습 서버는 로그인이 없다 - 누구인지는 ?user= 로 받는다(없으면 jaehoon).
const viewer = (req) => userOf(req.query.user ?? 'jaehoon');
const inquiryOf = (req, res) => {
  const inquiry = inquiries.find((item) => item.id === Number(req.params.id));
  if (!inquiry) res.status(404).json({ message: '그런 문의방은 없어요' });
  return inquiry;
};

// ── REST - 화면이 처음 그릴 때와 빈틈을 채울 때 쓴다. 바로 답하지 않는 것처럼 0.5초 기다린다. ──
app.get('/api/me', (req, res) => res.json(viewer(req)));

// 내 문의방 - 마지막 메시지가 최근인 방부터
app.get('/api/inquiries', async (req, res) => {
  await wait(500);
  const me = viewer(req);
  const rows = inquiries.filter((i) => me.id === 2 || i.buyerId === me.id).map((i) => rowOf(i, me.id));
  res.json(rows.sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? '')));
});

app.get('/api/inquiries/:id', async (req, res) => {
  await wait(500);
  const inquiry = inquiryOf(req, res);
  if (inquiry) res.json(rowOf(inquiry, viewer(req).id));
});

// 그 방의 메시지 - 최근 것부터 10개씩(?cursor=앞 응답의 nextCursor) · ?after=번호 면 그 번호 뒤를 오래된 것부터 모두
app.get('/api/inquiries/:id/messages', async (req, res) => {
  await wait(500);
  const inquiry = inquiryOf(req, res);
  if (!inquiry) return;
  const own = messages.filter((m) => m.inquiryId === inquiry.id).sort(newestFirst);

  if (req.query.after !== undefined) {
    const after = Number(req.query.after);
    if (!Number.isInteger(after) || after < 0) return res.status(400).json({ message: 'after 는 0 이상의 정수예요' });
    res.json({ items: own.filter((m) => m.id > after).reverse().map(pick) });
    return;
  }

  const start = req.query.cursor ? own.findIndex((m) => m.id === Number(req.query.cursor)) + 1 : 0;
  const page = own.slice(start, start + 10);
  const hasNext = start + 10 < own.length;
  res.json({ items: page.map(pick), hasNext, nextCursor: hasNext ? String(page.at(-1).id) : null });
});

// 그 방을 읽음으로 - 상대가 보낸 안 읽은 메시지를 모두 읽음으로 바꾼다.
app.patch('/api/inquiries/:id/read', async (req, res) => {
  await wait(500);
  const inquiry = inquiryOf(req, res);
  if (!inquiry) return;
  const me = viewer(req);
  const unread = messages.filter((m) => m.inquiryId === inquiry.id && m.senderId !== me.id && !m.isRead);
  unread.forEach((m) => { m.isRead = true; });
  res.json({ readCount: unread.length });
});

// 개발용 - 그 사람의 연결을 끊고 seconds 초(없으면 10) 동안 다시 붙지 못하게 한다.
const blockedUntil = new Map();
app.post('/dev/drop', (req, res) => {
  const me = viewer(req);
  const seconds = Number(req.query.seconds ?? 10);
  blockedUntil.set(me.id, Date.now() + seconds * 1000);
  // 방의 번호 목록을 먼저 배열로 옮긴다 - 끊으면 그 연결이 방에서 빠져 목록이 줄어든다.
  const ids = [...(io.sockets.adapter.rooms.get(`user:${me.id}`) ?? [])];
  ids.forEach((id) => io.sockets.sockets.get(id)?.conn.close());
  res.json({ closedCount: ids.length, blockedSeconds: seconds });
});
// 막아 둔 사람의 연결 요청은 403 - 화면은 네트워크 실패로 보고 간격을 늘려 가며 다시 시도한다.
io.engine.use((req, res, next) => {
  const user = userOf(new URL(req.url, 'http://x').searchParams.get('user') ?? '');
  if (user && (blockedUntil.get(user.id) ?? 0) > Date.now()) {
    res.writeHead(403);
    res.end();
    return;
  }
  next();
});

// ── 실시간 - 연결할 때 ?user= 로 누구인지 정한다. 사람마다 user:번호 방 하나. ──
io.on('connection', (socket) => {
  const me = userOf(socket.handshake.query.user);
  if (!me) { socket.disconnect(); return; }
  socket.join(`user:${me.id}`);
  console.log(`${me.username} 연결이 열렸어요.`);

  // 메시지 보내기 - 저장하고 그 방의 두 사람에게 inquiry:message · 보낸 연결에는 ack 로 저장한 메시지
  socket.on('inquiry:send', ({ inquiryId, content }, ack) => {
    const inquiry = inquiries.find((item) => item.id === inquiryId);
    const text = typeof content === 'string' ? content.trim() : '';
    if (!inquiry || text === '') { ack?.({ error: { message: '보낼 수 없는 메시지예요' } }); return; }
    const message = { id: nextId++, inquiryId, senderId: me.id, content: text, createdAt: new Date().toISOString(), isRead: false };
    messages.push(message);
    const event = { inquiryId, ...pick(message) };
    io.to(`user:${me.id}`).to(`user:${otherOf(inquiry, me.id)}`).emit('inquiry:message', event);
    ack?.({ data: event });
  });

  // 입력 중 - 저장하지 않고 상대에게만
  socket.on('inquiry:typing', ({ inquiryId, typing }) => {
    const inquiry = inquiries.find((item) => item.id === inquiryId);
    if (inquiry) io.to(`user:${otherOf(inquiry, me.id)}`).emit('inquiry:typing', { inquiryId, senderId: me.id, typing: Boolean(typing) });
  });

  socket.on('disconnect', () => console.log(`${me.username} 연결이 닫혔어요.`));
});
