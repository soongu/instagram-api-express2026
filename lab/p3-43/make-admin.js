// ~/instagram-api/lab/p3-43/make-admin.js
import * as userService from '../../services/userService.js';
import { prisma } from '../../db.js';

// 관리자가 터미널에서 첫 관리자를 정한다 — 45번 admin.hong 의 역할을 ADMIN 으로.
const user = await userService.setRole(45, 'ADMIN');

console.log('역할을 바꿨어요', user);

await prisma.$disconnect();
