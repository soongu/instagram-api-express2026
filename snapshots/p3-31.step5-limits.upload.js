// ~/instagram-api/middlewares/upload.js
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import { BadRequestError } from '../errors.js';

// 받는 사진 종류와, 저장할 때 붙일 확장자
const EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const storage = multer.diskStorage({
  destination: 'uploads/',
  // 파일 이름은 서버가 짓는다 — 보낸 쪽이 붙인 이름은 쓰지 않는다.
  filename: (req, file, cb) => {
    cb(null, randomUUID() + EXTENSIONS[file.mimetype]);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!EXTENSIONS[file.mimetype]) {
      cb(new BadRequestError('사진 파일만 올릴 수 있어요'));
      return;
    }
    cb(null, true);
  },
});
