// ~/instagram-api/lab/p3-68/homework1.js
import express from 'express';
import cors from 'cors';

// 실습 화면(next-lab)의 주소 - 다른 출처라 CORS 로 허락한다.
const SCREEN = 'http://localhost:3002';

const app = express();
app.use(cors({ origin: SCREEN }));

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

// 알림을 모두 읽음으로 - 안 읽은 알림만 바꾸고, 바꾼 수를 돌려준다. 이미 다 읽었으면 0 이다.
app.patch('/api/notifications/read', (req, res) => {
  const unread = notices.filter((notice) => !notice.isRead);
  unread.forEach((notice) => {
    notice.isRead = true;
  });

  res.json({ readCount: unread.length });
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

app.listen(4070, () => {
  console.log('알림 과제 서버가 http://localhost:4070 에서 기다리고 있어요.');
});
