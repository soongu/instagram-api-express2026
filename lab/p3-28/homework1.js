// ~/instagram-api/lab/homework1.js
import express from 'express';
import { logger } from '../middlewares/logger.js';

const app = express();

app.use(logger);

const notices = [
  { id: 1, title: '서버 점검 안내' },
  { id: 2, title: '새 기능 소개' },
  { id: 3, title: '이용 약관 변경' },
];

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

app.get('/api/notices', (req, res) => {
  res.json(notices);
});

app.delete('/api/notices/:id', adminOnly, (req, res) => {
  const index = notices.findIndex((one) => one.id === Number(req.params.id));

  if (index === -1) {
    res.status(404).json({ message: '그런 공지는 없어요' });
    return;
  }

  const deleted = notices[index];
  notices.splice(index, 1);
  res.json(deleted);
});

app.listen(4011, () => {
  console.log('실습 서버가 4011번 포트에서 기다리고 있어요.');
});
