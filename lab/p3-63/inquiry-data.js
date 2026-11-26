// ~/instagram-api/lab/p3-63/inquiry-data.js
// 상품 문의 실습 서버가 쓰는 데이터다. 실습 서버라서 데이터베이스 대신 메모리에 둔다.
// 서버를 다시 켜면 읽음과 지우기가 처음대로 돌아온다.

// 로그인은 수업 백엔드가 맡는다. 2번은 수업 데이터베이스에서 2번인 jaehoon 이다.
export const users = [
  { id: 1, username: 'yuna' },
  { id: 2, username: 'jaehoon' },
  { id: 3, username: 'sujin' },
  { id: 4, username: 'taeyang' },
  { id: 5, username: 'jisoo' },
];

// sellerId 는 그 상품을 파는 사람이다. jaehoon 은 2번 텀블러를 판다.
export const products = [
  { id: 1, name: '무선 이어폰', sellerId: 5 },
  { id: 2, name: '텀블러', sellerId: 2 },
  { id: 3, name: '노트북 거치대', sellerId: 4 },
];

// 문의방 - 상품 하나를 두고 사려는 사람(buyerId)과 파는 사람이 이야기하는 방이다.
// 파는 사람은 상품의 sellerId 로 찾는다. 3번 방은 sujin 과 taeyang 의 방이라 jaehoon 의 방이 아니다.
// buyerClearedAt · sellerClearedAt 은 그 사람이 방을 지운 시각이다. 지운 적이 없으면 null 이다.
export const inquiries = [
  { id: 1, productId: 2, buyerId: 1, createdAt: '2026-11-20T10:00:00.000Z', buyerClearedAt: null, sellerClearedAt: null },
  { id: 2, productId: 1, buyerId: 2, createdAt: '2026-11-22T10:00:00.000Z', buyerClearedAt: null, sellerClearedAt: null },
  { id: 3, productId: 3, buyerId: 3, createdAt: '2026-11-23T10:00:00.000Z', buyerClearedAt: null, sellerClearedAt: null },
  { id: 4, productId: 2, buyerId: 4, createdAt: '2026-11-24T10:00:00.000Z', buyerClearedAt: null, sellerClearedAt: null },
];

// 문의 메시지 아홉 줄 - 4번 방에는 아직 메시지가 없다.
// isRead 는 받는 사람이 읽었는지다. jaehoon 은 1번 방에서 yuna 의 첫 메시지만 읽었고, yuna 는 jaehoon 의 마지막 답을 아직 안 읽었다.
export const messages = [
  { id: 1, inquiryId: 1, senderId: 1, content: '텀블러 용량이 몇 ml예요?', isRead: true, createdAt: '2026-11-20T10:05:00.000Z' },
  { id: 2, inquiryId: 1, senderId: 2, content: '500ml예요', isRead: true, createdAt: '2026-11-20T11:00:00.000Z' },
  { id: 3, inquiryId: 1, senderId: 1, content: '식기세척기에 넣어도 되나요?', isRead: false, createdAt: '2026-11-21T09:00:00.000Z' },
  { id: 4, inquiryId: 2, senderId: 2, content: '노이즈 캔슬링 되나요?', isRead: true, createdAt: '2026-11-22T10:05:00.000Z' },
  { id: 5, inquiryId: 3, senderId: 3, content: '높이 조절이 되나요?', isRead: true, createdAt: '2026-11-23T10:05:00.000Z' },
  { id: 6, inquiryId: 2, senderId: 5, content: '네, 돼요!', isRead: false, createdAt: '2026-11-22T12:00:00.000Z' },
  { id: 7, inquiryId: 2, senderId: 5, content: '주문하시면 바로 보내 드려요', isRead: false, createdAt: '2026-11-22T12:01:00.000Z' },
  { id: 8, inquiryId: 3, senderId: 4, content: '네, 6단계로 조절돼요', isRead: false, createdAt: '2026-11-23T11:00:00.000Z' },
  { id: 9, inquiryId: 1, senderId: 2, content: '네, 넣어도 돼요', isRead: false, createdAt: '2026-11-21T10:00:00.000Z' },
];
