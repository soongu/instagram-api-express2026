// ~/instagram-api/lab/p3-69/helpful-data.js
// «도움이 돼요» 실습 서버가 쓰는 데이터다. 실습 서버라서 데이터베이스 대신 메모리에 둔다.

// 로그인은 수업 백엔드가 맡는다. 로그인한 사람의 번호(res.locals.userId)로 이 목록에서 사람을 찾으므로
// 2번은 수업 데이터베이스의 jaehoon, 43번은 seoyeon, 44번은 doyun 이다. sujin 은 이 쇼핑몰에만 있는 사람이다.
export const users = [
  { id: 2, username: 'jaehoon' },
  { id: 7, username: 'sujin' },
  { id: 43, username: 'seoyeon' },
  { id: 44, username: 'doyun' },
];

// 리뷰 - authorId 는 리뷰를 쓴 사람의 번호다.
export const reviews = [
  { id: 1, authorId: 2, content: '배송이 하루 만에 왔어요' },
  { id: 2, authorId: 43, content: '색이 사진과 똑같아요' },
  { id: 3, authorId: 7, content: '한 치수 크게 나와요' },
];

// «도움이 돼요» - 한 줄이 «누가(userId) 어느 리뷰에(reviewId)» 누른 것이다. 같은 짝은 한 줄만 있다.
// jaehoon 과 seoyeon 은 sujin 의 리뷰에, doyun 은 jaehoon 의 리뷰에 이미 눌렀다.
// sujin 은 자기 리뷰에 눌렀다 - 내 리뷰라 알림은 없다(4번 줄에는 알림이 없다).
export const helpfuls = [
  { id: 1, reviewId: 3, userId: 2 },
  { id: 2, reviewId: 3, userId: 43 },
  { id: 3, reviewId: 1, userId: 44 },
  { id: 4, reviewId: 3, userId: 7 },
];

// 알림 - 한 줄이 «누가(senderId) 누구에게(receiverId)» 남긴 알림이다.
// helpfulId 는 이 알림을 남긴 «도움이 돼요» 줄의 번호다.
export const notifications = [
  { id: 1, receiverId: 7, senderId: 2, reviewId: 3, helpfulId: 1 },
  { id: 2, receiverId: 7, senderId: 43, reviewId: 3, helpfulId: 2 },
  { id: 3, receiverId: 2, senderId: 44, reviewId: 1, helpfulId: 3 },
];
