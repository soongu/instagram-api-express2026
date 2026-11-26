// ~/instagram-api/lab/p3-61/subscriber-data.js
// 구독자 목록 실습 서버가 쓰는 데이터다. 실습 서버라서 데이터베이스 대신 메모리에 둔다.

// 로그인은 수업 백엔드가 맡는다. 2번은 수업 데이터베이스에서 2번인 jaehoon 이다.
export const users = [
  { id: 1, username: 'yuna' },
  { id: 2, username: 'jaehoon' },
  { id: 3, username: 'sujin' },
  { id: 4, username: 'taeyang' },
  { id: 5, username: 'jisoo' },
  { id: 6, username: 'minho' },
  { id: 7, username: 'dabin' },
  { id: 8, username: 'eunji' },
  { id: 9, username: 'hyunwoo' },
  { id: 10, username: 'seola' },
  { id: 11, username: 'junho' },
  { id: 12, username: 'nari' },
  { id: 13, username: 'woojin' },
  { id: 14, username: 'bomi' },
];

// 구독 - 한 줄이 «누가(subscriberId) 누구를(authorId) 언제(createdAt)» 구독했는지다.
// 줄 번호(id)는 줄을 넣은 차례라, 구독한 시각의 차례와 같지 않다.
export const subscriptions = [
  { id: 1, subscriberId: 3, authorId: 1, createdAt: '2026-11-20T09:00:00.000Z' },
  { id: 2, subscriberId: 2, authorId: 1, createdAt: '2026-11-24T09:00:00.000Z' },
  { id: 3, subscriberId: 6, authorId: 1, createdAt: '2026-11-22T09:00:00.000Z' },
  { id: 4, subscriberId: 7, authorId: 1, createdAt: '2026-11-23T09:00:00.000Z' },
  { id: 5, subscriberId: 8, authorId: 1, createdAt: '2026-11-21T09:00:00.000Z' },
  { id: 6, subscriberId: 9, authorId: 1, createdAt: '2026-11-23T09:00:00.000Z' },
  { id: 7, subscriberId: 10, authorId: 1, createdAt: '2026-11-19T09:00:00.000Z' },
  { id: 8, subscriberId: 11, authorId: 1, createdAt: '2026-11-25T09:00:00.000Z' },
  { id: 9, subscriberId: 12, authorId: 1, createdAt: '2026-11-18T09:00:00.000Z' },
  { id: 10, subscriberId: 13, authorId: 1, createdAt: '2026-11-22T09:00:00.000Z' },
  { id: 11, subscriberId: 14, authorId: 1, createdAt: '2026-11-17T09:00:00.000Z' },
  { id: 12, subscriberId: 2, authorId: 3, createdAt: '2026-11-10T09:00:00.000Z' },
  { id: 13, subscriberId: 2, authorId: 9, createdAt: '2026-11-12T09:00:00.000Z' },
  { id: 14, subscriberId: 2, authorId: 8, createdAt: '2026-11-15T09:00:00.000Z' },
  { id: 15, subscriberId: 3, authorId: 4, createdAt: '2026-11-14T09:00:00.000Z' },
  { id: 16, subscriberId: 3, authorId: 6, createdAt: '2026-11-16T09:00:00.000Z' },
  { id: 17, subscriberId: 3, authorId: 2, createdAt: '2026-11-13T09:00:00.000Z' },
  { id: 18, subscriberId: 3, authorId: 8, createdAt: '2026-11-16T09:00:00.000Z' },
  { id: 19, subscriberId: 3, authorId: 9, createdAt: '2026-11-11T09:00:00.000Z' },
  { id: 20, subscriberId: 3, authorId: 5, createdAt: '2026-11-09T09:00:00.000Z' },
];
