// ~/instagram-api/lab/p3-30/homework1.js
import express from 'express';

const app = express();

app.use(express.json());

const notices = [
  { id: 1, title: '서버 점검 안내' },
  { id: 2, title: '새 기능 소개' },
];

const comments = [
  { id: 1, noticeId: 1, text: '몇 시에 끝나나요?' },
  { id: 2, noticeId: 1, text: '확인했어요' },
  { id: 3, noticeId: 2, text: '기대돼요' },
];
let nextId = 4;

// 주소의 :id 로 공지를 찾아 req.notice 에 담는다
function findNotice(req, res, next) {
  const notice = notices.find((one) => one.id === Number(req.params.id));

  if (!notice) {
    res.status(404).json({ message: '그런 공지는 없어요' });
    return;
  }

  req.notice = notice;
  next();
}

// 공지 하나에 달린 댓글
const commentRouter = express.Router({ mergeParams: true });

commentRouter.use(findNotice);

commentRouter.get('/', (req, res) => {
  res.json(comments.filter((comment) => comment.noticeId === req.notice.id));
});

commentRouter.post('/', (req, res) => {
  const comment = { id: nextId, noticeId: req.notice.id, text: req.body.text };
  nextId += 1;
  comments.push(comment);
  res.status(201).json(comment);
});

// 주소의 :commentId 로 그 공지에 달린 댓글을 찾아 req.comment 에 담는다
function findComment(req, res, next, value) {
  const comment = comments.find((one) => one.id === Number(value) && one.noticeId === req.notice.id);

  if (!comment) {
    res.status(404).json({ message: '그런 댓글은 없어요' });
    return;
  }

  req.comment = comment;
  next();
}

commentRouter.param('commentId', findComment);

commentRouter.delete('/:commentId', (req, res) => {
  comments.splice(comments.indexOf(req.comment), 1);
  res.json(req.comment);
});

app.use('/api/notices/:id/comments', commentRouter);

app.use((req, res) => {
  res.status(404).json({ message: '그런 주소는 없어요' });
});

app.listen(4011, () => {
  console.log('실습 서버가 4011번 포트에서 기다리고 있어요.');
});
