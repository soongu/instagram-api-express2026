// ~/instagram-api/lab/p3-70/practice1.js
import express from 'express';

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
});

// ── 데이터 - 실습 서버라 데이터베이스 대신 메모리에 둔다. 비밀번호도 실습이라 글자 그대로 둔다(수업 서버는 해시로 둔다). ──
// 동네 책장 회원 넷 - 가입할 때 이메일이나 휴대폰 번호 가운데 하나를 적었다. 휴대폰 번호는 숫자만 저장했다.
const members = [
  { username: 'sujin', email: 'sujin@example.com', phone: null, password: 'sujin1234' },
  { username: 'minho', email: null, phone: '01023456789', password: 'minho1234' },
  { username: 'yuna', email: 'yuna@example.com', phone: null, password: 'yuna1234' },
  { username: 'taeyang', email: null, phone: '01098765432', password: 'taeyang1234' },
];

const PHONE = /^010-?\d{4}-?\d{4}$/;

// 로그인 칸에 적은 값으로 회원을 찾는다 - 값의 모양을 보고 어느 칸에서 찾을지 고른다.
function findMember(loginId) {
  if (loginId.includes(____)) return members.find((member) => member.email === loginId);
  if (PHONE.test(loginId)) return members.find((member) => member.phone === ____);
  return members.find((member) => member.username === ____);
}

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const member = findMember(username);

  if (!member || member.password !== password) {
    res.status(401).json({ message: '계정이나 비밀번호가 맞지 않아요' });
    return;
  }

  res.json({ username: member.username });
});

app.listen(4078, () => console.log('동네 책장 서버가 http://localhost:4078 에서 기다리고 있어요'));
