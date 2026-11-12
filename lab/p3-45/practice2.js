// ~/instagram-api/lab/p3-45/practice2.js

// 우리 서비스의 사람 — 1번 jaehoon 은 이메일과 비밀번호로 가입해 둔 사람이다.
const users = [{ id: 1, username: 'jaehoon', email: 'jaehoon@example.com' }];
// 소셜 계정 — «어느 제공자의 누구» 가 우리 사람 몇 번인지.
const socialAccounts = [];

// 로그인 버튼을 누르고 돌아온 사람들 — 제공자가 확인해 준 차례대로.
const arrivals = [
  { provider: 'google', id: '100', email: 'minji@gmail.com', emailVerified: true },
  { provider: 'google', id: '100', email: 'minji.lee@gmail.com', emailVerified: true },
  { provider: 'kakao', id: '100', email: undefined, emailVerified: false },
  { provider: 'google', id: '200', email: 'minji@naver.com', emailVerified: false },
  { provider: 'google', id: '300', email: 'jaehoon@example.com', emailVerified: true },
];

// 쓰이지 않는 사용자 이름을 고른다 — 그대로 쓸 수 있으면 그대로, 아니면 뒤에 2, 3, … 을 붙인다.
function freeUsername(base) {
  let username = base;

  for (let n = 2; users.some((user) => user.username === username); n += 1) {
    username = `${base}${n}`;
  }

  return username;
}

// 소셜 계정으로 우리 사람을 찾고, 처음 온 사람이면 만든다.
function findOrCreate({ provider, id, email, emailVerified }) {
  // 찾는 기준은 «어느 제공자의 누구» 뿐이다 — 이메일로 찾지 않는다.
  const account = socialAccounts.find((item) => item.provider === provider && item.providerUserId === id);

  if (account) {
    return { user: users.find((user) => user.id === account.userId), created: false };
  }

  // 이메일은 제공자가 확인했다고 한 것만 넣는다.
  const verifiedEmail = emailVerified ? email : undefined;

  if (verifiedEmail && users.some((user) => user.email === verifiedEmail)) {
    throw new Error('이미 가입한 이메일이에요');
  }

  const user = {
    id: users.length + 1,
    username: freeUsername(email ? email.split('@')[0] : provider),
    email: verifiedEmail,
  };

  users.push(user);
  socialAccounts.push({ provider, providerUserId: id, userId: user.id });

  return { user, created: true };
}

for (const profile of arrivals) {
  try {
    const { user, created } = findOrCreate(profile);

    console.log(`${profile.provider} ${profile.id} → ${user.id}번 ${user.username} (${created ? '새로 만듦' : '다시 옴'}) 이메일 ${user.email ?? '없음'}`);
  } catch (error) {
    console.log(`${profile.provider} ${profile.id} → ${error.message}`);
  }
}

console.log(`사람 ${users.length}명 · 소셜 계정 ${socialAccounts.length}개`);
