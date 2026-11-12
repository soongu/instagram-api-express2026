// ~/instagram-api/lab/p3-44/set-role.js
import * as userService from '../../services/userService.js';
import { prisma } from '../../db.js';

// 관리자가 터미널에서 jaehoon(2번)의 역할을 바꾼다 — 명령 뒤에 붙인 값(ADMIN 또는 USER)으로.
// 파일을 실행하면 process.argv 의 [1] 에는 이 파일의 경로가 들어 있어서, 붙인 값은 [2] 에 있다.
const user = await userService.setRole(2, process.argv[2]);

console.log('역할을 바꿨어요', user);

await prisma.$disconnect();
