// ~/instagram-api/lab/p3-36/add-user.js
import * as userService from '../../services/userService.js';
import { prisma } from '../../db.js';

// 관리자가 터미널에서 사람을 바로 가입시킨다 — HTTP 요청 없이 서비스를 부른다.
const user = await userService.createUser({
  username: 'jiho',
  name: '김지호',
  phone: '010-5555-1234',
});

console.log('가입시켰어요', user);

await prisma.$disconnect();
