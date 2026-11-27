// ~/instagram-api/lab/p3-59/homework1.js
import path from 'node:path';
import express from 'express';
import { z } from 'zod';
import { users, uploads, files } from './photo-data.js';
import { validateBody } from '../../middlewares/validate.js';
import { HttpError } from '../../errors.js';

const app = express();
app.use(express.json());

// 글쓴이 사진 바꾸기의 본문 - 올린 사진의 주소(/uploads/…)를 보낸다.
const photoSchema = z.object({
  imageUrl: z.string().startsWith('/uploads/'),
});

// 사용자 이름으로 글쓴이를 찾는다 - 없으면 404 를 보내고 null 을 돌려준다.
function findUser(req, res) {
  const user = users.find((item) => item.username === req.params.username);

  if (!user) {
    res.status(404).json({ message: '그런 사용자는 없어요' });
    return null;
  }

  return user;
}

// 글쓴이 한 사람 - 사진 주소까지.
app.get('/api/users/:username', (req, res) => {
  const user = findUser(req, res);
  if (!user) return;

  res.json({ id: user.id, username: user.username, profileImage: user.profileImage });
});

// 올린 파일이 아직 있는지 - uploads 폴더 대신 files 를 본다.
app.get('/uploads/:fileName', (req, res) => {
  if (!files.has(req.params.fileName)) {
    res.status(404).json({ message: '그런 파일은 없어요' });
    return;
  }

  res.json({ fileName: req.params.fileName });
});

// 올린 사진의 기록 전부 - 실습 서버라 기록을 그대로 보여 준다.
app.get('/api/uploads', (req, res) => {
  res.json(uploads);
});

// 글쓴이 사진 바꾸기 - 로그인이 없는 실습 서버라 누구의 사진인지는 주소의 사용자 이름으로 정한다.
app.put('/api/users/:username/photo', validateBody(photoSchema), (req, res) => {
  const user = findUser(req, res);
  if (!user) return;

  const fileName = path.basename(req.body.imageUrl);

  // 이 사람이 올렸고 아직 리뷰에도 프로필에도 쓰지 않은 사진의 기록을 찾는다.
  const upload = uploads.find(
    (item) => item.fileName === fileName && item.uploaderId === user.id && item.reviewId === null && item.profileUserId === null,
  );

  if (!upload) {
    res.status(400).json({ message: '내가 올리고 아직 아무 데도 쓰지 않은 사진만 쓸 수 있어요' });
    return;
  }

  upload.profileUserId = user.id;
  user.profileImage = req.body.imageUrl;

  res.json({ profileImage: user.profileImage });
});

// 글쓴이 사진 지우기 - 기본 사진으로 돌린다. 우리 서버에 올린 사진이면 그 기록과 파일도 치운다.
app.delete('/api/users/:username/photo', (req, res) => {
  const user = findUser(req, res);
  if (!user) return;

  // 이 사람의 프로필 사진으로 적힌 기록 - 사진이 없거나 바깥 주소면 없다.
  const index = uploads.findIndex((item) => item.profileUserId === user.id);

  if (index !== -1) {
    const [upload] = uploads.splice(index, 1);
    files.delete(upload.fileName);
  }

  user.profileImage = null;

  res.json({ profileImage: null });
});

// 이 서버의 실패는 { message } 하나로 답한다.
app.use((err, req, res, next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ message: err.message });
    return;
  }

  console.error(err);
  res.status(500).json({ message: '서버에서 문제가 생겼어요' });
});

app.listen(4001, () => {
  console.log('리뷰 서버가 4001번 포트에서 기다리고 있어요.');
});
