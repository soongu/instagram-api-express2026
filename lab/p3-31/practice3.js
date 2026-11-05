// ~/instagram-api/lab/p3-31/practice3.js
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import multer from 'multer';
import { BadRequestError } from '../../errors.js';

const app = express();

// 지금 쓰는 프로필 사진의 주소 — 아직 없으면 null
let avatarUrl = null;

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

// 주소에서 파일 이름만 꺼내 avatars 폴더의 그 파일을 지운다.
async function removeAvatarFile(url) {
  await rm(path.join('lab/p3-31/avatars', path.basename(url)), { force: true });
}

app.get('/api/avatar', (req, res) => {
  if (!avatarUrl) {
    res.status(404).json({ message: '프로필 사진이 없어요' });
    return;
  }

  res.json({ url: avatarUrl });
});

app.put('/api/avatar', uploadAvatar, async (req, res) => {
  if (!req.file) {
    res.status(400).json({ message: '프로필 사진을 골라 주세요' });
    return;
  }

  const oldUrl = avatarUrl;
  avatarUrl = `/avatars/${req.file.filename}`;

  // 새 사진이 저장된 «뒤에» 옛 사진 파일을 지운다.
  if (oldUrl) await removeAvatarFile(oldUrl);

  res.json({ url: avatarUrl });
});

app.delete('/api/avatar', async (req, res) => {
  if (avatarUrl) await removeAvatarFile(avatarUrl);
  avatarUrl = null;

  res.json({ message: '프로필 사진을 지웠어요' });
});

app.use((err, req, res, next) => {
  if (err.status) {
    res.status(err.status).json({ message: err.message });
    return;
  }

  console.error(err);
  res.status(500).json({ message: '서버에서 문제가 생겼어요' });
});

app.listen(4003, () => {
  console.log('프로필 사진 서버가 4003번 포트에서 기다리고 있어요.');
});
