// ~/instagram-api/lab/p3-39/practice3.js
import * as authService from '../../services/authService.js';
import { prisma } from '../../db.js';

// 관리자가 터미널에서 사람을 바로 가입시킨다 — 가입 API 와 같은 함수를 불러서 비밀번호도 해시로 들어가게 한다.
const user = await authService.signup({
  emailOrPhone: '010-7777-1234',
  name: '관리자',
  username: 'admin.hong',
  password: 'admin1234!',
});

console.log('가입시켰어요', user);

await prisma.$disconnect();
