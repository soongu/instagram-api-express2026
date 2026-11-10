// ~/instagram-api/lab/p3-39/users-salted.js
// 이번에는 사람마다 솔트를 붙여 해시해 저장한 users 테이블 — 솔트도 해시 옆에 함께 저장한다.
export const users = [
  { username: 'jaehoon', salt: '49a586e1733f7e9c20313d442b4bc6f6', hash: '071d6869ff4968d67b155315ddfc043de0b11f5480eb86e5e5c49df9a6687af9' },
  { username: 'minji', salt: 'ec7f7350afb88ad784be6bb9b2db0062', hash: '24c35b86e609eca49385be2ae2383a4a5cb293cc0cfe87db1b980eb4a1587111' },
  { username: 'dahye', salt: '1910a606c60fc0924b60ae767d3fb223', hash: '81306d9b149028a9b9f7bcb707d02ad14204cbc03600ba1155dc8277a44472f1' },
  { username: 'seungwoo', salt: 'ebb539159a33bed2c99e7babf1ff68d3', hash: '9b8007237bb6de7b9bd5d99957db86a02e032ac58a679aca5fd369c81d9cd5b7' },
  { username: 'nayeon', salt: 'fcaccd40c059dc303748eb252acbd352', hash: '55c62c80ce7bcab3eeb7fa97cda9c09ff1e979df71afccf42e798858d03644d8' },
];
