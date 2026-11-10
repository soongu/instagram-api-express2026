// ~/instagram-api/lab/p3-39/practice3.js
import * as userService from '../../services/userService.js';
import { prisma } from '../../db.js';

// 관리자가 터미널에서 사람을 바로 가입시킨다 — 이번에는 비밀번호도 정해 준다.
const user = await userService.createUser({
  username: 'admin.hong',
  name: '관리자',
  phone: '010-7777-1234',
  password: 'admin1234!',
});

console.log('가입시켰어요', user);

await prisma.$disconnect();
