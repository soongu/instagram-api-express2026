// ~/instagram-api/lab/p3-39/leaked.js
// 비밀번호를 SHA-256 해시로만 바꿔 저장한 서비스에서 users 테이블이 밖으로 샜다고 해 보자.
// 공격자 손에 들어간 것은 사용자 이름과 해시뿐이다.
export const leaked = [
  { username: 'jaehoon', hash: '016027115ca5fef97a54a6495253e97ad34285eca1da2f64110133633f5a2e52' },
  { username: 'minji', hash: '79d340e9a181e7b6ab68e7fa7ee77b0e81a7755304fc579e12e99b8182ace383' },
  { username: 'dahye', hash: '4d4f26369171994f3a46776ee2d88494fb9955800a5bb6261c016c4bb9f30b56' },
  { username: 'seungwoo', hash: '4d4f26369171994f3a46776ee2d88494fb9955800a5bb6261c016c4bb9f30b56' },
  { username: 'nayeon', hash: '367c82350c9dd1f04a2c1fc049dcc60310575b82220694bf8034f5072dfc88ab' },
];
