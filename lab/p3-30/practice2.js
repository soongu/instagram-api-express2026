// ~/instagram-api/lab/p3-30/practice2.js
import express from 'express';

const app = express();

app.use(express.json());

const notices = [
  { id: 1, title: '서버 점검 안내' },
  { id: 2, title: '새 기능 소개' },
  { id: 3, title: '이용 약관 변경' },
];

// findNotice 가 몇 번 불렸는지 센다
let found = 0;

// 주소의 :id 값으로 공지를 찾아 req.notice 에 담는다
function findNotice(req, res, next, id) {
  found += 1;
  const notice = notices.find((one) => one.id === Number(id));

  if (!notice) {
    res.status(404).json({ message: '그런 공지는 없어요' });
    return;
  }

  req.notice = notice;
  next();
}

const router = express.Router();

router.param('id', findNotice);

router.get('/', (req, res) => {
  res.json(notices);
});

router.get('/:id', (req, res, next) => {
  next();
});

router.get('/:id', (req, res) => {
  res.json(req.notice);
});

router.patch('/:id', (req, res) => {
  req.notice.title = req.body.title;
  res.json(req.notice);
});

app.use('/api/notices', router);

// 확인용 — findNotice 가 지금까지 불린 횟수
app.get('/api/found', (req, res) => {
  res.json({ found });
});

app.use((req, res) => {
  res.status(404).json({ message: '그런 주소는 없어요' });
});

app.listen(4002, () => {
  console.log('실습 서버가 4002번 포트에서 기다리고 있어요.');
});
