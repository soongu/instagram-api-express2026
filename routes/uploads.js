// ~/instagram-api/routes/uploads.js
import express from 'express';
import { uploadImages } from '../middlewares/upload.js';
import { allowOnly } from '../middlewares/methods.js';
import { BadRequestError } from '../errors.js';

const router = express.Router();

router.post('/', uploadImages, (req, res) => {
  if (!req.files || req.files.length === 0) {
    throw new BadRequestError('올릴 사진을 골라 주세요');
  }

  // 서버 주소는 빼고 «/uploads/파일 이름» 만 돌려준다 — 게시물의 imageUrls 에 이대로 싣는다.
  const imageUrls = req.files.map((file) => `/uploads/${file.filename}`);

  res.status(201).json({ imageUrls });
});

router.all('/', allowOnly('POST'));

export default router;
