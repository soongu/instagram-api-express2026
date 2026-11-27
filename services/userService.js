// ~/instagram-api/services/userService.js
import { randomInt, randomUUID } from 'node:crypto';
import path from 'node:path';
import bcrypt from 'bcrypt';
import { prisma } from '../db.js';
import { BadRequestError, ConflictError, NotFoundError } from '../errors.js';
import { PHONE } from '../schemas/authSchema.js';
import * as uploadService from './uploadService.js';

// 응답에 실어 보낼 컬럼만 고른다.
const userFields = { id: true, username: true, profileImage: true, role: true };

// UNIQUE 제약 이름 — 어느 컬럼이 이미 쓰이고 있는지에 따라 에러 코드가 다르다.
const TAKEN_BY_INDEX = {
  users_username_key: 'USERNAME_TAKEN',
  users_email_key: 'EMAIL_TAKEN',
  users_phone_key: 'PHONE_TAKEN',
};

// 소셜 계정을 이을 때의 UNIQUE 제약 이름 — 어느 제약에 막혔는지에 따라 에러 코드가 다르다.
const LINK_TAKEN_BY_INDEX = {
  social_accounts_provider_provider_user_id_key: 'SOCIAL_ACCOUNT_TAKEN',
  social_accounts_user_id_provider_key: 'PROVIDER_ALREADY_LINKED',
};

// 휴대폰 번호는 하이픈을 빼고 숫자만 다룬다 — 010-1234-5678 과 01012345678 은 같은 번호다.
const digitsOnly = (phone) => phone.replaceAll('-', '');

// 사용자 이름에 쓸 수 있는 글자가 아닌 것 — 영문·숫자·밑줄·점만 남긴다.
const NOT_ALLOWED = /[^A-Za-z0-9_.]/g;

// 비밀번호를 해시할 때의 cost — 하나 올리면 해시 한 번에 걸리는 시간이 두 배가 된다.
const PASSWORD_COST = 12;

// 비교할 해시가 없을 때 대신 비교할 가짜 해시 — 서버가 뜰 때 한 번만 만든다.
// 원래 글자는 아무도 모르는 무작위 값이라, 이 해시와 맞는 비밀번호는 없다고 봐도 된다.
const DUMMY_HASH = await bcrypt.hash(randomUUID(), PASSWORD_COST);

export function findUserById(id) {
  return prisma.user.findUnique({ where: { id }, select: userFields });
}

// 사용자 이름으로 사람의 번호를 찾는다 - 없으면 404 다.
export async function findUserIdByUsername(username) {
  const user = await prisma.user.findUnique({ where: { username }, select: { id: true } });

  if (!user) throw new NotFoundError('USER_NOT_FOUND');

  return user.id;
}

// 프로필 헤더에 실을 것 - 팔로워 수는 컬럼에 적혀 있고, 게시물 수와 팔로잉 수는 요청마다 센다.
// 보는 사람이 이 사람을 팔로우하는 행도 센다 - 하나면 팔로우하고 있는 것이다.
function profileFieldsFor(viewerId) {
  return {
    id: true,
    username: true,
    name: true,
    profileImage: true,
    followerCount: true,
    _count: {
      select: {
        posts: true,
        following: true,
        followers: { where: { followerId: viewerId } },
      },
    },
  };
}

// 사용자 이름으로 프로필 헤더를 돌려준다. 그런 사람이 없으면 404 다.
// 팔로우하고 있는지는 보는 사람(viewerId)에 따라 다르다.
export async function getProfile(username, viewerId) {
  const user = await prisma.user.findUnique({ where: { username }, select: profileFieldsFor(viewerId) });

  if (!user) throw new NotFoundError('USER_NOT_FOUND');

  const { _count, followerCount, ...profile } = user;
  return {
    ...profile,
    postCount: _count.posts,
    followerCount,
    followingCount: _count.following,
    isFollowing: _count.followers > 0,
  };
}

// 사람 찾기에 실을 것.
const memberFields = { id: true, username: true, name: true, profileImage: true };

// 사용자 이름에 검색어가 든 사람을 사용자 이름 차례로 20명까지 돌려준다 - 대소문자는 가리지 않는다.
// 검색어가 비어 있으면 아무도 돌려주지 않는다.
export function searchMembers(keyword) {
  if (!keyword) return [];

  return prisma.user.findMany({
    where: { username: { contains: keyword, mode: 'insensitive' } },
    select: memberFields,
    orderBy: { username: 'asc' },
    take: 20,
  });
}

// 로그인 칸에 적은 값으로 찾을 조건 - 값의 모양을 보고 어느 컬럼에서 찾을지 고른다.
// @ 가 있으면 이메일, 휴대폰 번호 모양이면 휴대폰 번호(가입할 때처럼 숫자만), 나머지는 사용자 이름이다.
// 셋 다 UNIQUE 컬럼이라 어느 쪽이든 findUnique 로 한 사람만 나온다.
function loginWhere(loginId) {
  if (loginId.includes('@')) return { email: loginId };
  if (PHONE.test(loginId)) return { phone: digitsOnly(loginId) };
  return { username: loginId };
}

// 로그인 - 로그인 칸의 값(사용자 이름 · 이메일 · 휴대폰 번호)과 비밀번호가 맞으면 그 사람을, 아니면 null 을 돌려준다.
// 해시는 이 함수 안에서만 꺼내 쓰고, 돌려줄 때는 응답에 실을 컬럼만 남긴다.
export async function checkPassword(loginId, password) {
  const user = await prisma.user.findUnique({
    where: loginWhere(loginId),
    select: { ...userFields, passwordHash: true },
  });

  // 사람이 없거나 비밀번호가 없어도(password_hash 가 NULL) 가짜 해시와 비교한다.
  // 실패의 이유와 상관없이 compare 를 한 번씩 거쳐서, 응답이 오기까지 걸리는 시간이 같아진다.
  const matched = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  // 가짜 해시와 비교했으면 결과와 상관없이 실패다.
  if (!user || user.passwordHash === null || !matched) return null;

  const { passwordHash, ...found } = user;

  // 지금보다 낮은 cost 로 만든 해시면, 맞는 비밀번호를 받은 김에 지금 cost 로 다시 만들어 둔다.
  // 이메일로 로그인했어도 다시 만들 사람은 찾은 사람이다 - 로그인 칸의 값이 아니라 그 사람의 사용자 이름으로 부른다.
  if (bcrypt.getRounds(passwordHash) < PASSWORD_COST) {
    await setPassword(user.username, password);
  }

  return found;
}

export async function createUser({ password, ...data }) {
  // 누가 부르든(가입 API · 관리자 스크립트) 저장하기 전에 번호를 같은 모양으로 맞춘다.
  const user = data.phone === undefined ? data : { ...data, phone: digitsOnly(data.phone) };
  // 비밀번호도 누가 부르든 받은 글자 그대로 넣지 않는다 — bcrypt 해시로 바꿔 넣는다.
  // 비밀번호 없이 부르면 해시도 없다(password_hash 는 NULL).
  const passwordHash = password === undefined ? undefined : await bcrypt.hash(password, PASSWORD_COST);

  try {
    return await prisma.user.create({ data: { ...user, passwordHash }, select: userFields });
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

// 이미 있는 사람의 비밀번호를 새로 정한다 — 관리자 스크립트가 부르고, cost 를 올린 뒤에는 로그인도 부른다.
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

// 지금 데이터베이스에 적힌 역할이 관리자인가 — 토큰의 역할은 만든 순간의 값이라, 관리자 권한을 쓸 때는 이것으로 다시 본다.
export async function isAdmin(id) {
  const user = await prisma.user.findUnique({ where: { id }, select: { role: true } });

  return user?.role === 'ADMIN';
}

// 사람 목록 — 관리자 주소가 부른다. 번호 차례로.
export function getUsers() {
  return prisma.user.findMany({ select: userFields, orderBy: { id: 'asc' } });
}

// 사람의 역할을 바꾼다 — 관리자 스크립트와 관리자 주소가 부른다.
export async function setRole(id, role) {
  try {
    return await prisma.user.update({ where: { id }, data: { role }, select: userFields });
  } catch (error) {
    // 그 번호의 사람이 없으면 바꿀 행이 없다.
    if (error.code === 'P2025') throw new NotFoundError('USER_NOT_FOUND');
    throw error;
  }
}

// 소셜 계정(어느 제공자의 누구)에 이어진 우리 사람을 찾는다 — 없으면 null.
export async function findUserBySocialAccount(provider, providerUserId) {
  const account = await prisma.socialAccount.findUnique({
    where: { provider_providerUserId: { provider, providerUserId } },
    select: { user: { select: userFields } },
  });

  return account?.user ?? null;
}

// 이 사람에게 그 제공자의 소셜 계정이 이어져 있는가 — 한 사람에게 제공자마다 하나라 (사람, 제공자)로 찾는다.
export async function hasSocialAccount(userId, provider) {
  const account = await prisma.socialAccount.findUnique({
    where: { userId_provider: { userId, provider } },
    select: { id: true },
  });

  return account !== null;
}

// 사람에게 소셜 계정을 잇는다 — 사람은 그대로 두고 social_accounts 에 한 행을 넣는다.
export async function addSocialAccount(userId, { provider, id }) {
  try {
    await prisma.socialAccount.create({ data: { userId, provider, providerUserId: id } });
  } catch (error) {
    // 확인한 뒤 넣기 전에 다른 요청이 먼저 넣었으면 UNIQUE 제약이 막는다 — 제약 이름으로 어느 쪽인지 구분한다.
    if (error.code === 'P2002') {
      const code = LINK_TAKEN_BY_INDEX[error.meta.driverAdapterError.cause.constraint.index];
      if (code) throw new ConflictError(code);
    }
    throw error;
  }
}

// 소셜 로그인으로 처음 온 사람을 만든다 — 사람과 소셜 계정을 함께 넣는다(둘 다 들어가거나 둘 다 안 들어간다).
// 비밀번호는 없고(password_hash 는 NULL), 이메일은 제공자가 확인했다고 한 것만 넣는다.
export async function createSocialUser({ provider, id, email, emailVerified, name }) {
  // 사용자 이름은 이메일 앞부분에서 쓸 수 있는 글자만 남겨 정한다 — 남는 글자가 없으면 제공자 이름을 쓴다.
  const base = (email ?? '').split('@')[0].replace(NOT_ALLOWED, '').slice(0, 26) || provider;
  const data = {
    name: name?.slice(0, 50),
    email: emailVerified ? email : undefined,
    socialAccounts: { create: { provider, providerUserId: id } },
  };

  // 이름이 이미 쓰이고 있으면 뒤에 무작위 숫자 넷을 붙여 다시 넣어 본다 — 다섯 번까지.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const username = attempt === 0 ? base : `${base}${randomInt(1000, 10000)}`;

    try {
      return await createUser({ ...data, username });
    } catch (error) {
      if (error.code !== 'USERNAME_TAKEN') throw error;
    }
  }

  throw new ConflictError('USERNAME_TAKEN');
}

// 이 사람의 로그인 방법 — 비밀번호가 있는지와, 이어진 소셜 계정(이은 차례로). 그 사람이 없으면 null.
// 해시는 이 함수 안에서만 보고, 돌려줄 때는 «있는지» 만 남긴다.
export async function getLoginMethods(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      passwordHash: true,
      socialAccounts: { select: { provider: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
    },
  });

  if (!user) return null;

  return { hasPassword: user.passwordHash !== null, socialAccounts: user.socialAccounts };
}

// 소셜 계정 연결을 끊는다 — 이 사람의 그 제공자 행만 지운다. 지울 행이 없으면 404.
// 비밀번호도 없고 이어진 소셜 계정이 그것 하나뿐이면 끊지 않는다 — 끊는 순간 이 사람은 들어올 방법이 없다.
export async function unlinkSocialAccount(userId, provider) {
  await prisma.$transaction(async (tx) => {
    // 같은 사람의 끊기 요청이 동시에 와도 한 번에 하나씩 세고 지우게, 그 사람 행을 먼저 잠근다 — 다른 요청은 이 트랜잭션이 끝날 때까지 기다린다.
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;

    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true, socialAccounts: { select: { provider: true } } },
    });
    const providers = user?.socialAccounts.map((account) => account.provider) ?? [];

    if (!providers.includes(provider)) throw new NotFoundError('SOCIAL_ACCOUNT_NOT_FOUND');
    if (user.passwordHash === null && providers.length === 1) throw new ConflictError('LAST_LOGIN_METHOD');

    await tx.socialAccount.deleteMany({ where: { userId, provider } });
  });
}

// 프로필 사진 주소를 바꾼다.
// 앞 사진의 기록을 지우는 일, 새 사진의 기록에 «이 사람의 프로필 사진» 이라고 적는 일,
// 주소를 바꾸는 일을 한 트랜잭션으로 묶는다.
export async function updateProfileImage(userId, imageUrl) {
  const fileName = path.basename(imageUrl);

  const [profile, previous] = await prisma.$transaction(async (tx) => {
    // 앞 프로필 사진의 기록을 먼저 지운다 - 한 사람의 프로필 사진 기록은 하나뿐이라 남아 있으면 새 사진을 못 적는다.
    const previous = await tx.upload.findUnique({ where: { profileUserId: userId }, select: { fileName: true } });
    if (previous) await tx.upload.delete({ where: { profileUserId: userId } });

    // 내가 올렸고 아직 게시물에도 프로필에도 쓰지 않은 사진의 기록에만 적는다.
    // 적은 기록이 하나가 아니면 남의 사진이거나 이미 쓴 사진이거나 없는 사진이다.
    const { count } = await tx.upload.updateMany({
      where: { fileName, uploaderId: userId, postId: null, profileUserId: null },
      data: { profileUserId: userId },
    });
    if (count !== 1) throw new BadRequestError('IMAGE_NOT_AVAILABLE');

    const profile = await tx.user.update({
      where: { id: userId },
      data: { profileImage: imageUrl },
      select: { profileImage: true },
    });
    return [profile, previous];
  });

  // 앞 사진 파일은 트랜잭션이 끝난 뒤에 지운다 - 바꾸기가 실패해 없던 일이 되면 앞 사진이 그대로 남아야 한다.
  if (previous) await uploadService.removeFiles([previous.fileName]);

  return profile;
}
