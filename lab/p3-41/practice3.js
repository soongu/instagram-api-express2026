// ~/instagram-api/lab/p3-41/practice3.js
import express from 'express';
import cookieParser from 'cookie-parser';
import { requireLogin } from '../../middlewares/auth.js';

const app = express();

// 게시물과 댓글은 메모리에만 둔다 — 서버를 다시 켜면 처음 모습으로 돌아간다.
// 사람 번호는 수업 DB 의 번호다(2 jaehoon · 3 minji · 4 nayeon).
const posts = [
  { id: 1, authorId: 2 },
  { id: 2, authorId: 3 },
];
const comments = [
  { id: 1, postId: 1, authorId: 3, content: '사진 예뻐요' },
  { id: 2, postId: 2, authorId: 2, content: '저도 가 보고 싶어요' },
  { id: 3, postId: 2, authorId: 4, content: '여기 어디예요?' },
];

// 상태 코드를 든 에러를 만든다 — 아래 에러 미들웨어가 이 상태 코드로 답한다.
function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

// 댓글을 지울 수 있는 사람 — 댓글을 쓴 사람, 그리고 그 댓글이 달린 게시물을 쓴 사람.
function removeComment(id, userId) {
  const comment = comments.find((one) => one.id === id);

  if (!comment) throw fail(404, '그런 댓글은 없어요');

  const post = posts.find((one) => one.id === comment.postId);

  if (comment.authorId !== userId && post.authorId !== userId) {
    throw fail(403, '내 댓글이나 내 게시물에 달린 댓글만 지울 수 있어요');
  }

  comments.splice(comments.indexOf(comment), 1);
  return comment;
}

app.use(cookieParser());

// 댓글 목록은 누구나 본다 — 로그인 확인보다 «위» 에 둔다.
app.get('/comments', (req, res) => {
  res.json(comments);
});

// 여기부터는 로그인한 사람만 지나간다.
app.use(requireLogin);

app.delete('/comments/:id', (req, res) => {
  const deleted = removeComment(Number(req.params.id), res.locals.userId);

  res.json(deleted);
});

app.use((err, req, res, next) => {
  res.status(err.status ?? 500).json({ message: err.message });
});

app.listen(4003, () => {
  console.log('4003번 포트에서 댓글 서버가 돌아가요');
});
