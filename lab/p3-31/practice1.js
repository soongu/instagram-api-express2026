// ~/instagram-api/lab/p3-31/practice1.js
import express from 'express';
import multer from 'multer';

const app = express();

// 받은 첨부 파일은 lab/p3-31/files 폴더에 저장한다.
const upload = multer({ dest: 'lab/p3-31/files/' });

// 저장한 첨부 파일을 /files/파일 이름 주소로 내보낸다.
app.use('/files', express.static('lab/p3-31/files'));

app.post('/api/files', upload.single('file'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ message: '올릴 파일을 골라 주세요' });
    return;
  }

  res.status(201).json({
    url: `/files/${req.file.filename}`,
    originalname: req.file.originalname,
    size: req.file.size,
  });
});

app.listen(4001, () => {
  console.log('첨부 파일 서버가 4001번 포트에서 기다리고 있어요.');
});
