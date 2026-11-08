// ~/instagram-api/lab/p3-34/practice1.js
import express from 'express';

const app = express();

const members = [
  { id: 1, username: 'jaehoon', name: '김재훈' },
  { id: 2, username: 'minji', name: '이민지' },
  { id: 3, username: 'dahye', name: '박다혜' },
  { id: 4, username: 'minsu', name: '최민수' },
];

// 옛 화면은 검색어를 q 로 보낸다. keyword 로 바꿔 담아 두면 라우트는 keyword 만 보면 된다.
// req.query 는 읽을 때마다 주소에서 새로 만드는 값이라, 바꾼 값은 res.locals 에 담는다.
function legacyQuery(req, res, next) {
  res.locals.keyword = req.query.keyword ?? req.query.q;
  next();
}

app.get('/api/members/search', legacyQuery, (req, res) => {
  const { keyword } = res.locals;

  if (!keyword) {
    res.status(400).json({ message: '검색어를 보내 주세요' });
    return;
  }

  res.json(members.filter((member) => member.username.includes(keyword) || member.name.includes(keyword)));
});

app.listen(4001, () => {
  console.log('실습 서버가 4001번 포트에서 기다리고 있어요.');
});
