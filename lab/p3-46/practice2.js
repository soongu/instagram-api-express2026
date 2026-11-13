// ~/instagram-api/lab/p3-46/practice2.js

// 제공자 셋이 사용자 정보로 준 응답과, 우리가 붙이지 않은 제공자의 이름 둘.
const samples = [
  ['google', { sub: '108123456789012345678', email: 'minji.kim@gmail.com', email_verified: true, name: '김민지' }],
  [
    'kakao',
    {
      id: 3812345678,
      connected_at: '2026-11-12T05:21:08Z',
      kakao_account: { profile_nickname_needs_agreement: false, profile: { nickname: '민지', is_default_nickname: false } },
    },
  ],
  [
    'naver',
    {
      resultcode: '00',
      message: 'success',
      response: { id: 'aB3dE5fG7hI9jK1lM3nO5pQ7rS9tU1vW3xY5zA7bC9d', email: 'minji.kim@naver.com', name: '김민지' },
    },
  ],
  ['github', { id: 583231, login: 'octocat', name: 'The Octocat' }],
  // 객체가 원래 가진 이름 — 이 이름의 제공자도 우리는 붙이지 않았다.
  ['constructor', {}],
];

// 제공자마다 응답을 읽는 함수 — 같은 뜻의 값이 다른 이름, 다른 위치에 있다.
const READERS = {
  google: (info) => ({ id: info.sub, email: info.email, emailVerified: info.email_verified === true, name: info.name }),
  // 카카오는 회원번호가 숫자고, 닉네임만 받기로 해서 이메일이 없다.
  kakao: (info) => ({ id: String(info.id), email: undefined, emailVerified: false, name: info.kakao_account?.profile?.nickname }),
  // 네이버는 값이 response 안에 있고, 이메일을 확인했는지 알려 주지 않는다.
  naver: (info) => ({ id: info.response.id, email: info.response.email, emailVerified: false, name: info.response.name }),
};

// 제공자의 응답을 우리가 정한 이름({ provider, id, email, emailVerified, name })으로 맞춘다.
function toProfile(provider, info) {
  if (!Object.hasOwn(READERS, provider)) throw new Error(`모르는 제공자예요: ${provider}`);

  return { provider, ...READERS[provider](info) };
}

for (const [provider, info] of samples) {
  try {
    console.log(JSON.stringify(toProfile(provider, info)));
  } catch (error) {
    console.log(error.message);
  }
}
