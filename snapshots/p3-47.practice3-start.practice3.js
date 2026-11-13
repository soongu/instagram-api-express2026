// ~/instagram-api/lab/p3-47/practice3.js

// 세 제공자가 사용자 정보로 준 응답 여덟 — 이메일과 확인 여부를 담는 이름과 위치가 제공자마다 다르다.
const samples = [
  ['google', { sub: '108123456789012345678', email: 'minji.kim@gmail.com', email_verified: true, name: '김민지' }],
  ['google', { sub: '108123456789012345679', email: 'minji.kim@gmail.com', email_verified: false, name: '김민지' }],
  ['kakao', { id: 3812345678, kakao_account: { email_needs_agreement: false, is_email_valid: true, is_email_verified: true, email: 'minji.kim@kakao.com' } }],
  ['kakao', { id: 3812345679, kakao_account: { email_needs_agreement: false, is_email_valid: true, is_email_verified: false, email: 'haru@kakao.com' } }],
  ['kakao', { id: 3812345680, kakao_account: { email_needs_agreement: false, is_email_valid: false, is_email_verified: true, email: 'mi***@kakao.com' } }],
  ['kakao', { id: 3812345681, kakao_account: { email_needs_agreement: true } }],
  ['kakao', { id: 3812345682, connected_at: '2026-11-12T05:21:08Z' }],
  ['naver', { resultcode: '00', message: 'success', response: { id: 'aB3dE5fG7hI9jK1lM3nO5pQ7rS9tU1vW3xY5zA7bC9d', email: 'minji.kim@naver.com', name: '김민지' } }],
];

// 제공자의 응답에서 이메일과, 확인된 이메일인지를 꺼낸다 — { email, emailVerified }.
function readEmail(provider, info) {
  // 여기를 채워요 — google · kakao · naver
}

for (const [provider, info] of samples) {
  const result = readEmail(provider, info);

  console.log(`${provider.padEnd(8)}${(result?.email ?? '-').padEnd(22)}${result?.emailVerified ? '확인됨' : '확인 안 됨'}`);
}
