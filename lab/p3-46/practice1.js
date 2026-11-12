// ~/instagram-api/lab/p3-46/practice1.js

// 카카오가 사용자 정보로 준 응답 넷 — 사람마다 동의한 항목이 달라서 응답의 모양이 다르다.
const samples = [
  // 닉네임 제공에 동의한 사람
  {
    id: 3812345678,
    connected_at: '2026-11-12T05:21:08Z',
    kakao_account: { profile_nickname_needs_agreement: false, profile: { nickname: '민지', is_default_nickname: false } },
  },
  // 닉네임 제공에 동의하지 않은 사람
  {
    id: 3812345679,
    connected_at: '2026-11-12T05:23:41Z',
    kakao_account: { profile_nickname_needs_agreement: true },
  },
  // kakao_account 가 아예 오지 않은 응답
  {
    id: 3812345680,
    connected_at: '2026-11-12T05:30:02Z',
  },
  // 회원번호가 더 큰 사람
  {
    id: 4123456789,
    connected_at: '2026-11-12T06:02:15Z',
    kakao_account: { profile_nickname_needs_agreement: false, profile: { nickname: '서준', is_default_nickname: false } },
  },
];

// 카카오의 응답을 우리 모양({ provider, id, email, emailVerified, name })으로 읽는다.
function readKakao(info) {
  return {
    provider: 'kakao',
    // 회원번호는 숫자로 온다 — 글자로 바꿔 둔다.
    id: String(info.id),
    email: undefined,
    emailVerified: false,
    // 닉네임은 kakao_account 안의 profile 안에 있다 — 둘 다 없을 수 있다.
    name: info.kakao_account?.profile?.nickname,
  };
}

for (const sample of samples) {
  console.log(JSON.stringify(readKakao(sample)));
}
