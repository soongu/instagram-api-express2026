// ~/instagram-api/lab/p3-69/homework1.js
import express from 'express';

const app = express();
app.use(express.json());

// 요청이 올 때마다 터미널에 한 줄 - 무엇을 보냈는지 여기서도 본다.
app.use((req, res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
});

// ── 데이터 - 과제 서버라 데이터베이스 대신 메모리에 둔다. 서버를 다시 켜면 처음으로 돌아간다. ──
// 이 서버의 알림을 받는 사람은 sujin 이다. sujin 이 쓴 리뷰에 다른 사람들이 «도움이 돼요» 를 눌렀다.
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

// 한 번에 5개씩 준다. 커서는 다음 페이지가 시작될 번호를 접은 글자다.
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

// 내 알림 목록 - 가장 최근 알림이 먼저다.
app.get('/api/notifications', (req, res) => {
  const before = req.query.cursor ? decodeCursor(req.query.cursor) : Infinity;
  const rows = notices.filter((notice) => notice.id < before).sort((a, b) => b.id - a.id);
  const page = rows.slice(0, LIMIT);
  const hasNext = rows.length > LIMIT;

  res.json({ items: page.map(toItem), hasNext, nextCursor: hasNext ? encodeCursor(page.at(-1).id) : null });
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

// 개발용 - 누군가 sujin 의 리뷰에 «도움이 돼요» 를 새로 누른 것처럼 알림 하나를 지금 시각으로 더한다.
app.post('/api/dev/notices', (req, res) => {
  const notice = {
    id: notices.reduce((max, item) => Math.max(max, item.id), 0) + 1,
    from: req.body?.from ?? 'yuna',
    reviewId: 3,
    isRead: false,
    createdAt: new Date().toISOString(),
  };
  notices.push(notice);

  res.status(201).json(toItem(notice));
});

app.listen(4074, () => {
  console.log('알림 과제 서버가 http://localhost:4074 에서 기다리고 있어요.');
});
