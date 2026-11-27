// ~/instagram-api/lab/p3-69/homework2-server.js
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';

// 실습 화면(next-lab)의 주소 - 다른 출처라 CORS 로 허락한다.
const SCREEN = 'http://localhost:3002';

const app = express();
app.use(cors({ origin: SCREEN }));
app.use(express.json());

// 요청이 올 때마다 터미널에 한 줄 - 화면이 언제 무엇을 보냈는지 여기서도 본다.
app.use((req, res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
});

// ── 데이터 - 실습 서버라 데이터베이스 대신 메모리에 둔다. 서버를 다시 켜면 처음으로 돌아간다. ──
// 이 화면을 보는 사람은 sujin 이다. sujin 이 쓴 리뷰에 다른 사람들이 «도움이 돼요» 를 눌렀다.
const seoul = (day, hour, minute) => new Date(Date.UTC(2026, 10, day, hour - 9, minute)).toISOString();
const notices = [
  { id: 1, from: 'jaehoon', reviewId: 3, isRead: true, createdAt: seoul(20, 9, 5) },
  { id: 2, from: 'seoyeon', reviewId: 3, isRead: true, createdAt: seoul(21, 13, 40) },
  { id: 3, from: 'taeyang', reviewId: 5, isRead: false, createdAt: seoul(22, 18, 12) },
  { id: 4, from: 'minji', reviewId: 3, isRead: false, createdAt: seoul(24, 8, 30) },
  { id: 5, from: 'doyun', reviewId: 5, isRead: true, createdAt: seoul(25, 21, 3) },
  { id: 6, from: 'boram', reviewId: 3, isRead: false, createdAt: seoul(26, 11, 47) },
  { id: 7, from: 'jiwon', reviewId: 5, isRead: false, createdAt: seoul(27, 10, 20) },
];

// sujin 이 알림 패널을 마지막으로 연 시각 - 한국 시각 11월 24일 오전 9시다.
let seenAt = seoul(24, 9, 0);

// 한 번에 5개씩 준다. 커서는 다음 페이지가 시작될 번호를 접은 글자다(화면은 받은 그대로 돌려주면 된다).
const LIMIT = 5;
const encodeCursor = (id) => Buffer.from(JSON.stringify({ id })).toString('base64url');
const decodeCursor = (cursor) => JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')).id;

const toItem = (notice) => ({
  id: notice.id,
  message: `${notice.from}님이 회원님의 리뷰가 도움이 된대요`,
  reviewId: notice.reviewId,
  isRead: notice.isRead,
  createdAt: notice.createdAt,
});

// 내 알림 목록 - 가장 최근 알림이 먼저다. 느린 서버라 1초 늦게 답한다.
app.get('/api/notifications', (req, res) => {
  const before = req.query.cursor ? decodeCursor(req.query.cursor) : Infinity;
  const rows = notices.filter((notice) => notice.id < before).sort((a, b) => b.id - a.id);
  const page = rows.slice(0, LIMIT);
  const hasNext = rows.length > LIMIT;

  setTimeout(() => {
    res.json({ items: page.map(toItem), hasNext, nextCursor: hasNext ? encodeCursor(page.at(-1).id) : null });
  }, 1000);
});

// 알림 하나를 읽음으로 - 몇 번을 보내도 결과는 «읽은 상태» 하나다.
app.patch('/api/notifications/:id/read', (req, res) => {
  const notice = notices.find((item) => item.id === Number(req.params.id));

  if (!notice) {
    res.status(404).json({ message: '그런 알림은 없어요' });
    return;
  }

  notice.isRead = true;
  res.json({ id: notice.id, isRead: true });
});

// 아직 안 본 알림의 수 - sujin 이 알림 패널을 마지막으로 연 뒤에 온 알림이다. 읽음(isRead)과는 따로 센다.
app.get('/api/notifications/unseen', (req, res) => {
  const unseen = notices.filter((notice) => notice.createdAt > seenAt);

  res.json({ unseenCount: unseen.length });
});

// 알림 패널을 열었다 - 지금까지 온 알림을 모두 본 것으로 친다. 알림 하나하나의 읽음은 그대로 둔다.
app.patch('/api/notifications/seen', (req, res) => {
  seenAt = new Date().toISOString();

  res.json({ unseenCount: 0 });
});

// ── 개발용 - 다른 사람이 누르는 것을 대신한다. 화면이 아니라 notice-dev.http 로 보낸다. ──
// 누군가 sujin 의 리뷰에 «도움이 돼요» 를 새로 눌렀다 - 알림 하나를 지금 시각으로 더하고 sujin 의 연결로 보낸다.
app.post('/api/dev/notices', (req, res) => {
  const notice = {
    id: notices.reduce((max, item) => Math.max(max, item.id), 0) + 1,
    from: req.body?.from ?? 'yuna',
    reviewId: 3,
    isRead: false,
    createdAt: new Date().toISOString(),
  };
  notices.push(notice);
  io.to('user:sujin').emit('notification:new', toItem(notice));

  res.status(201).json(toItem(notice));
});

// 누군가 «도움이 돼요» 를 취소했다 - 그 알림을 지우고 sujin 의 연결로 «사라졌다» 를 보낸다.
app.delete('/api/dev/notices/:id', (req, res) => {
  const at = notices.findIndex((item) => item.id === Number(req.params.id));

  if (at === -1) {
    res.status(404).json({ message: '그런 알림은 없어요' });
    return;
  }

  const [notice] = notices.splice(at, 1);
  io.to('user:sujin').emit('notification:removed', { id: notice.id });

  res.json({ id: notice.id });
});

const server = app.listen(4075, () => {
  console.log('알림 과제 서버가 http://localhost:4075 에서 기다리고 있어요.');
});

// 같은 서버에 Socket.IO 를 붙인다 - 화면은 다른 출처라 CORS 로 허락한다.
// 실습 서버라 로그인 대신 연결 주소의 ?user= 로 누구인지 정한다.
const io = new Server(server, { cors: { origin: SCREEN } });

io.on('connection', (socket) => {
  const user = socket.handshake.query.user;
  socket.join(`user:${user}`);
  console.log(`${user} 연결이 열렸어요.`);
  socket.on('disconnect', () => console.log(`${user} 연결이 닫혔어요.`));
});
