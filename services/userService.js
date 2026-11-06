// ~/instagram-api/services/userService.js
import { prisma } from '../db.js';

// 응답에 실어 보낼 컬럼만 고른다.
const userFields = { id: true, username: true, profileImage: true };

export function findUserByUsername(username) {
  return prisma.user.findUnique({ where: { username }, select: userFields });
}
