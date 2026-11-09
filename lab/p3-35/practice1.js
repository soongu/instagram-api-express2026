// ~/instagram-api/lab/p3-35/practice1.js
import express from 'express';
import cookieParser from 'cookie-parser';

const app = express();

app.use(cookieParser());

// 프로필 사진 — 파일 이름이 사용자 이름이라, 사진을 바꾸면 같은 이름의 파일을 덮어쓴다.
// 기본값(public, max-age=0) 그대로 둔다 — 쓸 때마다 서버에 물어본다.
app.use('/avatars', express.static('lab/p3-35/avatars'));
// 게시물 사진 — 파일 이름이 UUID 라, 사진이 바뀌면 이름도 바뀐다.
app.use('/photos', express.static('lab/p3-35/photos', { maxAge: '1y', immutable: true }));

// 누가 보든 같은 공지 — 쓰기 전에 늘 확인한다.
app.get('/api/notices', (req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.json([{ id: 1, title: '서버 점검 안내' }]);
});

// 보는 사람마다 다른 내 정보 — 그 사람의 브라우저에만 두고, 쓰기 전에 늘 확인한다.
app.get('/api/me', (req, res) => {
  res.set('Cache-Control', 'private, no-cache');
  res.json({ username: req.cookies.user ?? null });
});

app.listen(4001, () => {
  console.log('실습 서버가 4001번 포트에서 기다리고 있어요.');
});
