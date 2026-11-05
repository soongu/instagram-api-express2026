// ~/instagram-api/middlewares/upload.js
import multer from 'multer';

// 받은 파일을 uploads 폴더에 저장한다.
export const upload = multer({ dest: 'uploads/' });
