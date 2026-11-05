// ~/instagram-api/lab/p3-30/homework2/routes/admin.js
import express from 'express';
import { notices } from '../data/notices.js';
import { adminOnly } from '../middlewares/adminOnly.js';

const router = express.Router();

// 새 공지 번호는 공지를 올리는 이 파일만 쓴다
let nextId = 4;

router.use(adminOnly);

router.post('/notices', (req, res) => {
  const notice = { id: nextId, title: req.body.title, hidden: false };
  nextId += 1;
  notices.push(notice);
  res.status(201).json(notice);
});

router.delete('/notices/:id', (req, res) => {
  const index = notices.findIndex((notice) => notice.id === Number(req.params.id));

  if (index === -1) {
    res.status(404).json({ message: '그런 공지는 없어요' });
    return;
  }

  const [deleted] = notices.splice(index, 1);
  res.json(deleted);
});

router.patch('/notices/:id/hide', (req, res) => {
  const notice = notices.find((one) => one.id === Number(req.params.id));

  if (!notice) {
    res.status(404).json({ message: '그런 공지는 없어요' });
    return;
  }

  notice.hidden = true;
  res.json(notice);
});

export default router;
