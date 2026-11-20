// ~/instagram-api/services/userService.js
import { prisma } from '../db.js';
import { ConflictError } from '../errors.js';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';

// 비밀번호를 해시할 때의 cost — 하나 올리면 해시 한 번에 걸리는 시간이 두 배가 된다.
const PASSWORD_COST = 12;

// 비교할 해시가 없을 때 대신 비교할 가짜 해시 — 서버가 뜰 때 한 번만 만든다.
// 원래 글자는 아무도 모르는 무작위 값이라, 이 해시와 맞는 비밀번호는 없다고 봐도 된다.
const DUMMY_HASH = await bcrypt.hash(randomUUID(), PASSWORD_COST);

// 응답에 실어 보낼 컬럼만 고른다.
const userFields = { id: true, username: true, profileImage: true, role: true };

// UNIQUE 제약 이름 — 어느 컬럼이 이미 쓰이고 있는지에 따라 에러 코드가 다르다.
const TAKEN_BY_INDEX = {
  users_username_key: 'USERNAME_TAKEN',
  users_email_key: 'EMAIL_TAKEN',
  users_phone_key: 'PHONE_TAKEN',
};

// 휴대폰 번호는 하이픈을 빼고 숫자만 다룬다 — 010-1234-5678 과 01012345678 은 같은 번호다.
const digitsOnly = (phone) => phone.replaceAll('-', '');


export function findUserById(id) {
  return prisma.user.findUnique({ where: { id }, select: userFields });
}

// 로그인 — 사용자 이름과 비밀번호가 맞으면 그 사람을, 아니면 null 을 돌려준다.
// 해시는 이 함수 안에서만 꺼내 쓰고, 돌려줄 때는 응답에 실을 컬럼만 남긴다.
export async function checkPassword(username, password) {
  const user = await prisma.user.findUnique({
    where: { username },
    select: { ...userFields, passwordHash: true },
  });

  const matched = await bcrypt.compare(
    password,
    user?.passwordHash ?? DUMMY_HASH,
  );

  // 가짜 해시와 비교했으면 결과와 상관없이 실패다.
  if (!user || user.passwordHash === null || !matched) return null;

  const { passwordHash, ...found } = user;

  // 지금보다 낮은 cost 로 만든 해시면, 맞는 비밀번호를 받은 김에 지금 cost 로 다시 만들어 둔다.
  if (bcrypt.getRounds(passwordHash) < PASSWORD_COST) {
    await setPassword(username, password);
  }

  return found;
}

export async function createUser({ password, ...data }) {
  // 누가 부르든(가입 API · 관리자 스크립트) 저장하기 전에 번호를 같은 모양으로 맞춘다.
  const user =
    data.phone === undefined
      ? data
      : { ...data, phone: digitsOnly(data.phone) };
  // 비밀번호도 누가 부르든 받은 글자 그대로 넣지 않는다 — bcrypt 해시로 바꿔 넣는다.
  // 비밀번호 없이 부르면 해시도 없다(password_hash 는 NULL).
  const passwordHash =
    password === undefined
      ? undefined
      : await bcrypt.hash(password, PASSWORD_COST);

  try {
    return await prisma.user.create({
      data: { ...user, passwordHash },
      select: userFields,
    });
  } catch (error) {
    // 사용자 이름·이메일·휴대폰 번호 가운데 하나라도 이미 있으면 UNIQUE 제약이 막는다.
    // 데이터베이스가 알려 준 제약 이름으로 어느 컬럼이 겹쳤는지 구분한다.
    if (error.code === 'P2002') {
      const code =
        TAKEN_BY_INDEX[error.meta.driverAdapterError.cause.constraint.index];
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

// 이미 있는 사람의 비밀번호를 새로 정한다 — 관리자 스크립트가 부른다.
export async function setPassword(username, password) {
  const passwordHash = await bcrypt.hash(password, PASSWORD_COST);

  try {
    return await prisma.user.update({ where: { username }, data: { passwordHash }, select: userFields });
  } catch (error) {
    // 그 사용자 이름의 사람이 없으면 바꿀 행이 없다.
    if (error.code === 'P2025') throw new NotFoundError('USER_NOT_FOUND');
    throw error;
  }
}

// 사람의 역할을 바꾼다 — 관리자 스크립트가 부른다.
export async function setRole(id, role) {
  try {
    return await prisma.user.update({ where: { id }, data: { role }, select: userFields });
  } catch (error) {
    // 그 번호의 사람이 없으면 바꿀 행이 없다.
    if (error.code === 'P2025') throw new NotFoundError('USER_NOT_FOUND');
    throw error;
  }
}