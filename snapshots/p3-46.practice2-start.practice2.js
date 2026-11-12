// ~/instagram-api/lab/p3-46/practice2.js

// 제공자 셋이 사용자 정보로 준 응답과, 우리가 모르는 제공자 하나.
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
];

// 제공자마다 응답을 읽는 함수 — 같은 뜻의 값이 다른 이름, 다른 위치에 있다.
const READERS = {
  // 여기를 채워요 — google · kakao · naver
};

// 제공자의 응답을 우리 모양({ provider, id, email, emailVerified, name })으로 바꾼다.
// 모르는 제공자면 «모르는 제공자예요: 이름» 이라는 에러를 던진다.
function toProfile(provider, info) {
  // 여기를 채워요.
}

for (const [provider, info] of samples) {
  try {
    console.log(JSON.stringify(toProfile(provider, info)));
  } catch (error) {
    console.log(error.message);
  }
}
