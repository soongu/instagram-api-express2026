// ~/instagram-api/lab/practice3.js
import express from 'express';
import { logger } from '../middlewares/logger.js';

const app = express();

app.use(logger);
app.use(____);

const notices = [{ id: 1, title: '서버 점검 안내' }];

app.get('/', (req, res) => {
  res.send(`
    <form method="post" action="/api/notices">
      <input name="title" placeholder="공지 제목">
      <button>올리기</button>
    </form>
  `);
});

app.get('/api/notices', (req, res) => {
  res.json(notices);
});

app.post('/api/notices', (req, res) => {
  const title = req.body.____.trim();

  if (title === '') {
    res.status(400).json({ message: '제목을 적어 주세요' });
    return;
  }

  notices.push({ id: notices.length + 1, title });
  res.redirect(____, '/api/notices');
});

app.listen(4003, () => {
  console.log('실습 서버가 4003번 포트에서 기다리고 있어요.');
});
