// ~/instagram-api/lab/p3-31/homework2.js
import { randomUUID } from 'node:crypto';
import { readdir, stat, rm } from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import multer from 'multer';

const app = express();
app.use(express.json());

const UPLOAD_DIR = 'lab/p3-31/hw2-uploads';
const posts = [];
let nextId = 1;

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    cb(null, `${randomUUID()}.jpg`);
  },
});
const upload = multer({ storage });

app.use('/uploads', express.static(UPLOAD_DIR));

app.post('/api/uploads', upload.array('images'), (req, res) => {
  res.status(201).json({ imageUrls: req.files.map((file) => `/uploads/${file.filename}`) });
});

app.post('/api/posts', (req, res) => {
  const post = { id: nextId, imageUrls: req.body.imageUrls };
  nextId += 1;
  posts.push(post);

  res.status(201).json(post);
});

// 여기에 DELETE /api/uploads/orphans 를 더한다.

app.listen(4012, () => {
  console.log('청소 서버가 4012번 포트에서 기다리고 있어요.');
});
