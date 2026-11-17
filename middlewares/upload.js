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

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!EXTENSIONS[file.mimetype]) {
      cb(new BadRequestError('NOT_AN_IMAGE'));
      return;
    }
    cb(null, true);
  },
});

const receiveImages = upload.array('images', 10);

// multer 가 만드는 에러에는 상태 코드가 없다 — 보낸 쪽이 고칠 일이라 400 으로 바꿔 넘긴다.
// multer 의 에러 코드를 우리 에러 코드로 옮긴다.
const CODES = {
  LIMIT_FILE_SIZE: 'IMAGE_TOO_LARGE',
  LIMIT_UNEXPECTED_FILE: 'UNEXPECTED_FILE',
};

export function uploadImages(req, res, next) {
  receiveImages(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      next(new BadRequestError(CODES[err.code] ?? 'UPLOAD_FAILED'));
      return;
    }
    next(err);
  });
}
