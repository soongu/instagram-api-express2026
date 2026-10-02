// ~/instagram-api/data/comments.js
export const comments = [
  {
    postId: 1,
    username: 'minji',
    content: '저도 가봤어요',
    likeCount: 7,
    minutesAgo: 8,
    // 이 댓글에 달린 답글 — 같은 comments 표에 들어가고 parent_id 가 이 댓글을 가리킨다.
    replies: [
      { username: 'jaehoon', content: '다음엔 같이 가요', likeCount: 1, minutesAgo: 3 },
      { username: 'dahye', content: '저도 껴주세요', likeCount: 0, minutesAgo: 2 },
    ],
  },
  { postId: 1, username: 'seungwoo', content: '사진 잘 나왔네요', likeCount: 2, minutesAgo: 5 },
  { postId: 1, username: 'nayeon', content: '다음에 같이 가요', likeCount: 0, minutesAgo: 1 },
  {
    postId: 2,
    username: 'jaehoon',
    content: '크루아상 색이 좋네요',
    likeCount: 12,
    minutesAgo: 40,
    replies: [{ username: 'minji', content: '이번엔 잘 구워졌어요', likeCount: 4, minutesAgo: 35 }],
  },
  { postId: 2, username: 'minji', content: '레시피 공유해주세요', likeCount: 5, minutesAgo: 32 },
  { postId: 2, username: 'dahye', content: '저도 구워볼래요', likeCount: 3, minutesAgo: 20 },
  { postId: 2, username: 'nayeon', content: '냄새가 여기까지', likeCount: 21, minutesAgo: 11 },
  { postId: 3, username: 'seungwoo', content: '다음엔 저도 낄게요', likeCount: 12, minutesAgo: 150 },
  { postId: 3, username: 'dahye', content: '코트 어디예요?', likeCount: 30, minutesAgo: 90 },
];
