// ~/instagram-api/lab/p3-40/set-password.js
import * as userService from '../../services/userService.js';
import { prisma } from '../../db.js';

// 관리자가 터미널에서 이미 있는 사람의 비밀번호를 정해 준다.
const user = await userService.setPassword('jaehoon', 'jaehoon1234');

console.log('비밀번호를 정했어요', user);

await prisma.$disconnect();
