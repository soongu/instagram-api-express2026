// ~/instagram-api/lab/p3-34/practice3.js
import express from 'express';
import { z } from 'zod';

const app = express();

app.use(express.json());

const notices = [
  { id: 1, title: '서버 점검 안내', pinned: true },
  { id: 2, title: '새 기능 소개', pinned: false },
];
let nextId = 3;

const noticeListQuerySchema = z.object({
  pinned: z.enum(['true', 'false']).optional().describe('true 면 고정 공지만, false 면 고정 안 한 공지만'),
});

const noticeCreateSchema = z.object({
  title: z.string().min(1).max(50).describe('공지 제목'),
  pinned: z.boolean().optional().describe('맨 위에 고정할지 — 없으면 false'),
});

app.get('/api/notices', (req, res) => {
  const result = noticeListQuerySchema.safeParse(req.query);

  if (!result.success) {
    res.status(400).json({ message: '보낸 내용이 규칙에 안 맞아요' });
    return;
  }

  const { pinned } = result.data;
  res.json(pinned === undefined ? notices : notices.filter((notice) => String(notice.pinned) === pinned));
});

app.post('/api/notices', (req, res) => {
  const result = noticeCreateSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({ message: '보낸 내용이 규칙에 안 맞아요' });
    return;
  }

  const notice = { id: nextId, pinned: false, ...result.data };
  nextId += 1;
  notices.push(notice);
  res.status(201).json(notice);
});

app.listen(4003, () => {
  console.log('실습 서버가 4003번 포트에서 기다리고 있어요.');
});
