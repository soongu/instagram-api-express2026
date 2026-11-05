// ~/instagram-api/lab/p3-31/practice2.js
import { randomUUID } from 'node:crypto';
import express from 'express';
import multer from 'multer';
import { BadRequestError } from '../../errors.js';

const app = express();

const EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
};

const storage = multer.diskStorage({
  destination: 'lab/p3-31/avatars/',
  filename: (req, file, cb) => {
    cb(null, randomUUID() + EXTENSIONS[file.mimetype]);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!EXTENSIONS[file.mimetype]) {
      cb(new BadRequestError('프로필 사진은 JPG나 PNG만 올릴 수 있어요'));
      return;
    }
    cb(null, true);
  },
});

const receiveAvatar = upload.single('avatar');

const messages = {
  LIMIT_FILE_SIZE: '프로필 사진은 1MB까지 올릴 수 있어요',
  LIMIT_UNEXPECTED_FILE: '프로필 사진은 avatar 이름으로 한 장만 보낼 수 있어요',
};

function uploadAvatar(req, res, next) {
  receiveAvatar(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      next(new BadRequestError(messages[err.code] ?? '프로필 사진을 받지 못했어요'));
      return;
    }
    next(err);
  });
}

app.use('/avatars', express.static('lab/p3-31/avatars'));

app.post('/api/avatar', uploadAvatar, (req, res) => {
  if (!req.file) {
    res.status(400).json({ message: '프로필 사진을 골라 주세요' });
    return;
  }

  res.status(201).json({ url: `/avatars/${req.file.filename}` });
});

app.use((err, req, res, next) => {
  if (err.status) {
    res.status(err.status).json({ message: err.message });
    return;
  }

  console.error(err);
  res.status(500).json({ message: '서버에서 문제가 생겼어요' });
});

app.listen(4002, () => {
  console.log('프로필 사진 서버가 4002번 포트에서 기다리고 있어요.');
});
