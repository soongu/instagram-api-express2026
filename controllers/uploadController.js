// ~/instagram-api/controllers/uploadController.js
import * as uploadService from '../services/uploadService.js';
import { BadRequestError } from '../errors.js';
import { sendData } from '../responses.js';

// 파일은 앞의 uploadImages 미들웨어가 이미 저장했다 — 여기서는 누가 올렸는지 적고, 저장된 파일의 주소를 돌려준다.
export async function create(req, res) {
  if (!req.files || req.files.length === 0) {
    throw new BadRequestError('NO_IMAGES');
  }

  const fileNames = req.files.map((file) => file.filename);
  await uploadService.recordUploads(res.locals.userId, fileNames);

  // 서버 주소는 빼고 «/uploads/파일 이름» 만 돌려준다 — 게시물의 imageUrls 에 이대로 싣는다.
  const imageUrls = fileNames.map((fileName) => `/uploads/${fileName}`);

  res.status(201);
  sendData(res, { imageUrls });
}
