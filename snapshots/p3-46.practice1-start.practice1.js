// ~/instagram-api/lab/p3-46/practice1.js

// 사용자 이름에 쓸 수 없는 글자 — 영문, 숫자, 밑줄(_), 마침표(.)가 아닌 글자다.
const NOT_ALLOWED = /[^A-Za-z0-9_.]/g;

// 이미 쓰고 있는 사용자 이름
const taken = new Set(['jaehoon', 'kakao']);

// 소셜 로그인으로 처음 온 사람들 — 제공자의 응답을 우리 모양으로 바꾼 값이다. id 는 글자다.
const visitors = [
  { provider: 'kakao', id: '3812345678', name: 'minsu_dev' },
  { provider: 'kakao', id: '3812345679', name: '민수' },
  { provider: 'kakao', id: '3812345680', name: 'Min Su!' },
  // 닉네임 제공에 동의하지 않은 사람
  { provider: 'kakao', id: '3812345681', name: undefined },
  { provider: 'naver', id: 'aB3dE5fG7hI9', name: 'js' },
  { provider: 'kakao', id: '3812345683', name: 'minsu_dev' },
  // 닉네임이 긴 사람
  { provider: 'naver', id: 'cD4eF6gH8iJ0', name: 'the_quick_brown_fox_jumps_over' },
];

// 처음 온 사람의 사용자 이름을 정한다 — 닉네임을 쓸 수 있으면 닉네임으로, 아니면 제공자 이름으로.
function pickUsername(profile, taken) {
  // 여기를 채워요.
}

for (const profile of visitors) {
  const username = pickUsername(profile, taken);

  taken.add(username);
  console.log(`${username}  ← ${profile.name}`);
}
