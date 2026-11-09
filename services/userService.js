// ~/instagram-api/services/userService.js
import { prisma } from '../db.js';
import { ConflictError } from '../errors.js';

// 응답에 실어 보낼 컬럼만 고른다.
const userFields = { id: true, username: true, profileImage: true };


export async function createUser(data) {
  try {
    return await prisma.user.create({ data, select: userFields });
  } catch (error) {
    // 사용자 이름·이메일·휴대폰 번호 가운데 하나라도 이미 있으면 UNIQUE 제약이 막는다.
    if (error.code === 'P2002')
      throw new ConflictError('이미 쓰고 있는 사용자 이름이나 연락처예요');
    throw error;
  }
}
export function findUserByUsername(username) {
  return prisma.user.findUnique({ where: { username }, select: userFields });
}

export function findUserById(id) {
  return prisma.user.findUnique({ where: { id }, select: userFields });
}

// type 은 email·phone·username 가운데 하나다 — 셋 다 UNIQUE 라 findUnique 로 찾을 수 있다.
export async function isTaken(type, value) {
  const user = await prisma.user.findUnique(
    { where: { [type]: value }, select: { id: true } }
  );

  return user !== null;
}