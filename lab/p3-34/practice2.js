// ~/instagram-api/lab/p3-34/practice2.js
import express from 'express';

const app = express();

const members = [
  { id: 1, username: 'jaehoon', familyName: '김', givenName: '재훈' },
  { id: 2, username: 'minji', familyName: '이', givenName: '민지' },
  { id: 3, username: 'dahye', familyName: '박', givenName: '다혜' },
];

function findMember(req, res, next) {
  const member = members.find((one) => one.id === Number(req.params.id));

  if (!member) {
    res.status(404).json({ message: '그런 회원은 없어요' });
    return;
  }

  res.locals.member = member;
  next();
}

const v1 = express.Router();
const v2 = express.Router();

// v1 으로 온 요청에는 모두 알린다 — 버전 없는 옛 주소로 온 요청도 이 라우터를 지난다.
v1.use((req, res, next) => {
  res.set('Deprecation', '@1796083200');
  res.set('Sunset', 'Mon, 01 Mar 2027 00:00:00 GMT');
  next();
});

// v1 — 이름은 글자 하나다.
v1.get('/members/:id', findMember, (req, res) => {
  const { id, username, familyName, givenName } = res.locals.member;
  res.json({ id, username, name: `${familyName}${givenName}` });
});

// v2 — 이름이 성과 이름으로 나뉜 객체다. 같은 name 필드의 모양이 바뀌어 v1 과 함께 둘 수 없다.
v2.get('/members/:id', findMember, (req, res) => {
  const { id, username, familyName, givenName } = res.locals.member;
  res.json({ id, username, name: { family: familyName, given: givenName } });
});

app.use('/api/v1', v1);
app.use('/api/v2', v2);
app.use('/api', v1);

app.listen(4002, () => {
  console.log('실습 서버가 4002번 포트에서 기다리고 있어요.');
});
