// ~/instagram-api/lab/p3-30/homework2/routes/notices.js
import express from 'express';
import { notices } from '../data/notices.js';

const router = express.Router();

// 숨기지 않은 공지 목록
router.get('/notices', (req, res) => {
  res.json(notices.filter((notice) => !notice.hidden));
});

export default router;
