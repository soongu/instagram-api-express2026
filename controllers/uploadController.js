// ~/instagram-api/controllers/uploadController.js
import { BadRequestError } from '../errors.js';
import { sendData } from '../responses.js';

// 파일은 앞의 uploadImages 미들웨어가 이미 저장했다 — 여기서는 저장된 파일의 주소만 만들어 돌려준다.
export function create(req, res) {
  if (!req.files || req.files.length === 0) {
    throw new BadRequestError('올릴 사진을 골라 주세요');
  }

  // 서버 주소는 빼고 «/uploads/파일 이름» 만 돌려준다 — 게시물의 imageUrls 에 이대로 싣는다.
  const imageUrls = req.files.map((file) => `/uploads/${file.filename}`);

  res.status(201);
  sendData(res, { imageUrls });
}
