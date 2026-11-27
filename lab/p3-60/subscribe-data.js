// ~/instagram-api/lab/p3-60/subscribe-data.js
// 글쓴이 구독 실습 서버가 쓰는 데이터다. 실습 서버라서 데이터베이스 대신 메모리에 둔다.

// 로그인은 수업 백엔드가 맡는다. 로그인한 사람의 번호(res.locals.userId)로 이 목록에서 사람을 찾으므로
// 2번은 수업 데이터베이스에서 2번인 jaehoon 이다. 나머지는 이 쇼핑몰에만 있는 사람이다.
// subscriberCount 는 그 사람을 구독하는 사람의 수다. 글쓴이를 보여 줄 때마다 세지 않으려고 따로 적어 둔다.
export const users = [
  { id: 1, username: 'yuna', subscriberCount: 2 },
  { id: 2, username: 'jaehoon', subscriberCount: 1 },
  { id: 3, username: 'sujin', subscriberCount: 1 },
  { id: 4, username: 'taeyang', subscriberCount: 1 },
  { id: 5, username: 'jisoo', subscriberCount: 0 },
];

// 구독 - 한 줄이 «누가(subscriberId) 누구를(authorId)» 구독한다는 뜻이다. 같은 짝은 한 줄만 있다.
// jaehoon 은 yuna 와 sujin 을 구독한다. taeyang 은 jisoo 가 구독한다.
export const subscriptions = [
  { subscriberId: 2, authorId: 1 },
  { subscriberId: 3, authorId: 1 },
  { subscriberId: 1, authorId: 2 },
  { subscriberId: 2, authorId: 3 },
  { subscriberId: 5, authorId: 4 },
];
