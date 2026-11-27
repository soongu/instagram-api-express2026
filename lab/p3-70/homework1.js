// ~/instagram-api/lab/p3-70/homework1.js
import express from 'express';

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
});

// ── 데이터 - 과제 서버라 메모리에 둔다. 서버를 다시 켜면 처음으로 돌아간다. 비밀번호도 실습이라 글자 그대로 둔다. ──
const members = [
  { username: 'sujin', email: 'sujin@example.com', phone: null, password: 'sujin1234' },
  { username: 'minho', email: null, phone: '01023456789', password: 'minho1234' },
];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^010-?\d{4}-?\d{4}$/;
const digitsOnly = (phone) => phone.replaceAll('-', '');

// 로그인 칸에 적은 값으로 회원을 찾는다 - 직접 해보기 1 에서 채운 그 함수다.
// 앞뒤 공백은 떼고 찾는다. 이메일은 가입할 때 소문자로 저장했으니 찾을 때도 소문자로 바꾼다.
function findMember(loginId) {
  const value = loginId.trim();
  if (value.includes('@')) return members.find((member) => member.email === value.toLowerCase());
  if (PHONE.test(value)) return members.find((member) => member.phone === digitsOnly(value));
  return members.find((member) => member.username === value);
}

app.post('/api/signup', (req, res) => {
  const { emailOrPhone, username, password } = req.body;

  if (!EMAIL.test(emailOrPhone) && !PHONE.test(emailOrPhone)) {
    res.status(400).json({ message: '이메일 주소나 휴대폰 번호를 적어 주세요' });
    return;
  }
  if (!/^[a-zA-Z0-9._]+$/.test(username)) {
    res.status(400).json({ message: '사용자 이름은 영문, 숫자, 밑줄(_), 마침표(.)만 쓸 수 있어요' });
    return;
  }
  // 휴대폰 번호 모양의 사용자 이름은 로그인 칸이 휴대폰 번호로 찾아서, 그 이름으로는 로그인할 수 없다.
  if (PHONE.test(username)) {
    res.status(400).json({ message: '휴대폰 번호 모양은 사용자 이름으로 쓸 수 없어요' });
    return;
  }
  if (members.some((member) => member.username === username)) {
    res.status(409).json({ message: '이미 쓰고 있는 사용자 이름이에요' });
    return;
  }

  const contact = PHONE.test(emailOrPhone) ? { email: null, phone: digitsOnly(emailOrPhone) } : { email: emailOrPhone.toLowerCase(), phone: null };
  members.push({ username, ...contact, password });
  res.status(201).json({ username });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const member = findMember(username);

  if (!member || member.password !== password) {
    res.status(401).json({ message: '계정이나 비밀번호가 맞지 않아요' });
    return;
  }

  res.json({ username: member.username });
});

app.listen(4080, () => console.log('동네 책장 과제 서버가 http://localhost:4080 에서 기다리고 있어요'));
