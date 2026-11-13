// ~/instagram-api/lab/p3-30/board.js
import express from 'express';
import { logger } from '../../middlewares/logger.js';

const app = express();

app.use(logger);
app.use(express.json());

const notices = [
  { id: 1, title: '서버 점검 안내', hidden: false },
  { id: 2, title: '새 기능 소개', hidden: false },
  { id: 3, title: '이용 약관 변경', hidden: false },
];
let nextId = 4;

// 실습용 — 요청 헤더에 적힌 역할을 그대로 믿는다. 진짜 서버는 로그인한 사람의 정보로 역할을 확인한다.
function readRole(req, res, next) {
  res.locals.role = req.get('X-Role');
  next();
}

function requireAdmin(req, res, next) {
  if (res.locals.role !== 'admin') {
    res.status(403).json({ message: '관리자만 할 수 있어요' });
    return;
  }

  next();
}

const adminOnly = [readRole, requireAdmin];

// 누구나 — 숨기지 않은 공지 목록
app.get('/api/notices', (req, res) => {
  res.json(notices.filter((notice) => !notice.hidden));
});


// 관리자만 쓰는 라우트는 이 라우터에 모은다
const adminRouter = express.Router();

// 이 라우터에 들어온 요청은 모두 adminOnly 부터 지나간다
adminRouter.use(adminOnly);


// 관리자만 — 공지 올리기
adminRouter.post('/notices', (req, res) => {
  const notice = { id: nextId, title: req.body.title, hidden: false };
  nextId += 1;
  notices.push(notice);
  res.status(201).json(notice);
});

// 관리자만 — 공지 지우기
adminRouter.delete('/notices/:id', (req, res) => {
  const index = notices.findIndex(
    (notice) => notice.id === Number(req.params.id),
  );

  if (index === -1) {
    res.status(404).json({ message: '그런 공지는 없어요' });
    return;
  }

  const [deleted] = notices.splice(index, 1);
  res.json(deleted);
});

// 관리자만 — 공지 숨기기
adminRouter.patch('/notices/:id/hide', (req, res) => {
  const notice = notices.find((one) => one.id === Number(req.params.id));

  if (!notice) {
    res.status(404).json({ message: '그런 공지는 없어요' });
    return;
  }

  notice.hidden = true;
  res.json(notice);
});

app.use('/api/admin', adminRouter);


app.use((req, res) => {
  res.status(404).json({ message: '그런 주소는 없어요' });
});

app.listen(4008, () => {
  console.log('실습 서버가 4008번 포트에서 기다리고 있어요.');
});
