// ~/instagram-api/lab/p3-53/shop-data.js
// 리뷰 실습 서버가 쓰는 데이터 — 실습 서버라 데이터베이스 대신 메모리에 둔다.

export const users = [
  { id: 1, username: 'yuna' },
  { id: 2, username: 'minho' },
  { id: 3, username: 'sujin' },
  { id: 4, username: 'taeyang' },
  // jisoo 는 아직 리뷰를 쓰지 않았다.
  { id: 5, username: 'jisoo' },
];

// 3번 상품에는 아직 리뷰가 없다.
export const products = [
  { id: 1, name: '무선 이어폰' },
  { id: 2, name: '텀블러' },
  { id: 3, name: '노트북 거치대' },
];

// 리뷰는 올라온 차례대로 번호를 매겼다.
// hidden 이 true 인 리뷰는 관리자가 숨긴 것이다 — 3번은 광고라서, 9번은 4번과 같은 글이 한 번 더 올라와서 숨겼다.
// 4번과 5번, 7번과 8번은 같은 시각에 올라왔다 — 시각이 같으면 번호로 차례를 정한다.
// 시각은 모두 같은 꼴의 ISO 문자열이라, 문자열끼리 비교해도 시각의 차례와 같다.
export const reviews = [
  { id: 1, productId: 1, authorId: 1, content: '음질이 생각보다 좋아요', createdAt: '2026-11-02T09:00:00.000Z', hidden: false },
  { id: 2, productId: 1, authorId: 2, content: '배송이 하루 만에 왔어요', createdAt: '2026-11-02T11:20:00.000Z', hidden: false },
  { id: 3, productId: 1, authorId: 3, content: '여기보다 싼 곳을 알려 드려요', createdAt: '2026-11-03T08:15:00.000Z', hidden: true },
  { id: 4, productId: 1, authorId: 4, content: '귀에 꼭 맞아서 운동할 때 좋아요', createdAt: '2026-11-03T21:40:00.000Z', hidden: false },
  { id: 5, productId: 1, authorId: 1, content: '케이스 색이 사진보다 밝아요', createdAt: '2026-11-03T21:40:00.000Z', hidden: false },
  { id: 6, productId: 2, authorId: 2, content: '얼음이 오후까지 안 녹아요', createdAt: '2026-11-04T10:00:00.000Z', hidden: false },
  { id: 7, productId: 1, authorId: 3, content: '노이즈 캔슬링이 잘 돼요', createdAt: '2026-11-05T13:05:00.000Z', hidden: false },
  { id: 8, productId: 1, authorId: 2, content: '한 번 충전하면 일주일 써요', createdAt: '2026-11-05T13:05:00.000Z', hidden: false },
  { id: 9, productId: 1, authorId: 4, content: '귀에 꼭 맞아서 운동할 때 좋아요', createdAt: '2026-11-07T07:50:00.000Z', hidden: true },
  { id: 10, productId: 2, authorId: 1, content: '뚜껑이 조금 뻑뻑해요', createdAt: '2026-11-08T15:10:00.000Z', hidden: false },
  { id: 11, productId: 1, authorId: 3, content: '통화할 때 목소리가 또렷해요', createdAt: '2026-11-09T20:00:00.000Z', hidden: false },
  { id: 12, productId: 1, authorId: 1, content: '두 번째로 사요', createdAt: '2026-11-10T12:45:00.000Z', hidden: false },
];
