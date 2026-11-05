// ~/instagram-api/lab/p3-31/homework1.js
import { randomUUID } from 'node:crypto';
import express from 'express';
import multer from 'multer';
import { BadRequestError } from '../../errors.js';

const app = express();

const notices = [];
let nextId = 1;

const EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
};

const storage = multer.diskStorage({
  destination: 'lab/p3-31/notice-images/',
  filename: (req, file, cb) => {
    cb(null, randomUUID() + EXTENSIONS[file.mimetype]);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (!EXTENSIONS[file.mimetype]) {
      cb(new BadRequestError('공지 사진은 JPG나 PNG만 올릴 수 있어요'));
      return;
    }
    cb(null, true);
  },
});

app.use('/notice-images', express.static('lab/p3-31/notice-images'));

app.get('/api/notices', (req, res) => {
  res.json(notices);
});

app.post('/api/notices', upload.single('image'), (req, res) => {
  const title = (req.body.title ?? '').trim();

  if (title === '') {
    throw new BadRequestError('제목을 적어 주세요');
  }

  const notice = {
    id: nextId,
    title,
    // 폼으로 온 값은 모두 글자다 — 'false' 도 빈 글자가 아니라서 그대로 두면 참으로 읽힌다.
    pinned: req.body.pinned === 'true',
    imageUrl: req.file ? `/notice-images/${req.file.filename}` : null,
  };
  nextId += 1;
  notices.push(notice);

  res.status(201).json(notice);
});

app.use((err, req, res, next) => {
  if (err.status) {
    res.status(err.status).json({ message: err.message });
    return;
  }

  console.error(err);
  res.status(500).json({ message: '서버에서 문제가 생겼어요' });
});

app.listen(4011, () => {
  console.log('공지 서버가 4011번 포트에서 기다리고 있어요.');
});
