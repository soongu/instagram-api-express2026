// ~/instagram-api/services/userService.js
import { prisma } from '../db.js';
import { ConflictError } from '../errors.js';

// 응답에 실어 보낼 컬럼만 고른다.
const userFields = { id: true, username: true, profileImage: true };

// UNIQUE 제약 이름 — 어느 컬럼이 이미 쓰이고 있는지에 따라 에러 코드가 다르다.
const TAKEN_BY_INDEX = {
  users_username_key: 'USERNAME_TAKEN',
  users_email_key: 'EMAIL_TAKEN',
  users_phone_key: 'PHONE_TAKEN',
};

// 휴대폰 번호는 하이픈을 빼고 숫자만 다룬다 — 010-1234-5678 과 01012345678 은 같은 번호다.
const digitsOnly = (phone) => phone.replaceAll('-', '');

export function findUserByUsername(username) {
  return prisma.user.findUnique({ where: { username }, select: userFields });
}

export function findUserById(id) {
  return prisma.user.findUnique({ where: { id }, select: userFields });
}

export async function createUser(data) {
  // 누가 부르든(가입 API · 관리자 스크립트) 저장하기 전에 번호를 같은 모양으로 맞춘다.
  const user = data.phone === undefined ? data : { ...data, phone: digitsOnly(data.phone) };

  try {
    return await prisma.user.create({ data: user, select: userFields });
  } catch (error) {
    // 사용자 이름·이메일·휴대폰 번호 가운데 하나라도 이미 있으면 UNIQUE 제약이 막는다.
    // 데이터베이스가 알려 준 제약 이름으로 어느 컬럼이 겹쳤는지 구분한다.
    if (error.code === 'P2002') {
      const code = TAKEN_BY_INDEX[error.meta.driverAdapterError.cause.constraint.index];
      if (code) throw new ConflictError(code);
    }
    throw error;
  }
}

// type 은 email·phone·username 가운데 하나다 — 셋 다 UNIQUE 라 findUnique 로 찾을 수 있다.
export async function isTaken(type, value) {
  const user = await prisma.user.findUnique({
    where: { [type]: type === 'phone' ? digitsOnly(value) : value },
    select: { id: true },
  });

  return user !== null;
}
