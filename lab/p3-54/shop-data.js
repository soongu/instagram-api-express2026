// ~/instagram-api/lab/p3-54/shop-data.js
// 리뷰 실습 서버가 쓰는 데이터다. 실습 서버라서 데이터베이스 대신 메모리에 둔다.

// 로그인은 수업 백엔드가 맡는다. 로그인한 사람의 번호(res.locals.userId)로 이 목록에서 사람을 찾으므로
// 2번은 수업 데이터베이스에서 2번인 jaehoon 이다. 나머지는 이 쇼핑몰에만 있는 사람이다.
export const users = [
  { id: 1, username: 'yuna' },
  { id: 2, username: 'jaehoon' },
  { id: 3, username: 'sujin' },
  { id: 4, username: 'taeyang' },
  { id: 5, username: 'jisoo' },
];

// sellerId 는 그 상품을 파는 사람이다. jaehoon 은 2번 텀블러를 판다.
// reviewCount 는 숨기지 않은 리뷰의 수다. 상품 목록에 리뷰 수를 보여 줄 때마다 세지 않으려고 따로 적어 둔다.
export const products = [
  { id: 1, name: '무선 이어폰', sellerId: 5, reviewCount: 8 },
  { id: 2, name: '텀블러', sellerId: 2, reviewCount: 2 },
  { id: 3, name: '노트북 거치대', sellerId: 4, reviewCount: 0 },
];

// hidden 이 true 인 리뷰는 숨긴 것이다. 3번은 광고라서 숨겼고 9번은 8번과 같은 글이 한 번 더 올라와서 숨겼다.
// 숨긴 리뷰는 reviewCount 에 세지 않는다. 1번 상품의 리뷰는 열 개지만 reviewCount 는 8 이다.
export const reviews = [
  { id: 1, productId: 1, authorId: 1, content: '음질이 생각보다 좋아요', createdAt: '2026-11-02T09:00:00.000Z', hidden: false },
  { id: 2, productId: 1, authorId: 2, content: '배송이 하루 만에 왔어요', createdAt: '2026-11-02T11:20:00.000Z', hidden: false },
  { id: 3, productId: 1, authorId: 3, content: '여기보다 싼 곳을 알려 드려요', createdAt: '2026-11-03T08:15:00.000Z', hidden: true },
  { id: 5, productId: 1, authorId: 1, content: '케이스 색이 사진보다 밝아요', createdAt: '2026-11-03T21:40:00.000Z', hidden: false },
  { id: 4, productId: 1, authorId: 4, content: '귀에 꼭 맞아서 운동할 때 좋아요', createdAt: '2026-11-03T21:40:00.000Z', hidden: false },
  { id: 6, productId: 2, authorId: 3, content: '얼음이 오후까지 안 녹아요', createdAt: '2026-11-04T10:00:00.000Z', hidden: false },
  { id: 7, productId: 1, authorId: 3, content: '노이즈 캔슬링이 잘 돼요', createdAt: '2026-11-05T13:05:00.000Z', hidden: false },
  { id: 8, productId: 1, authorId: 2, content: '한 번 충전하면 일주일 써요', createdAt: '2026-11-05T13:05:00.000Z', hidden: false },
  { id: 9, productId: 1, authorId: 2, content: '한 번 충전하면 일주일 써요', createdAt: '2026-11-05T13:06:00.000Z', hidden: true },
  { id: 10, productId: 2, authorId: 1, content: '뚜껑이 조금 뻑뻑해요', createdAt: '2026-11-10T12:45:00.000Z', hidden: false },
  { id: 11, productId: 1, authorId: 3, content: '통화할 때 목소리가 또렷해요', createdAt: '2026-11-09T20:00:00.000Z', hidden: false },
  { id: 12, productId: 1, authorId: 1, content: '두 번째로 사요', createdAt: '2026-11-10T12:45:00.000Z', hidden: false },
];
