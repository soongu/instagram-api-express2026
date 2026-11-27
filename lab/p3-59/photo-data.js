// ~/instagram-api/lab/p3-59/photo-data.js
// 글쓴이 사진 실습 서버가 쓰는 데이터다. 실습 서버라서 데이터베이스와 uploads 폴더 대신 메모리에 둔다.

// 리뷰를 쓴 사람이다. profileImage 가 null 이면 사진이 없다. sujin 의 사진은 바깥 주소라 올린 기록이 없다.
export const users = [
  { id: 1, username: 'yuna', profileImage: null },
  { id: 2, username: 'jaehoon', profileImage: null },
  { id: 3, username: 'sujin', profileImage: 'https://picsum.photos/seed/sujin/150/150' },
  { id: 4, username: 'taeyang', profileImage: null },
  { id: 5, username: 'jisoo', profileImage: null },
];

// 올린 사진의 기록이다. 수업 서버의 uploads 테이블과 같은 모양이다.
// reviewId 는 그 사진을 붙인 리뷰 · profileUserId 는 그 사진을 프로필 사진으로 쓰는 사람이다. 둘 다 null 이면 아직 아무 데도 안 쓴 사진이다.
export const uploads = [
  { id: 1, fileName: 'cat.jpg', uploaderId: 1, reviewId: null, profileUserId: null },
  { id: 2, fileName: 'cake.jpg', uploaderId: 1, reviewId: 5, profileUserId: null },
  { id: 3, fileName: 'dog.jpg', uploaderId: 2, reviewId: null, profileUserId: null },
  { id: 4, fileName: 'sea.jpg', uploaderId: 1, reviewId: null, profileUserId: null },
];

// uploads 폴더에 있는 파일 이름이다.
export const files = new Set(['cat.jpg', 'cake.jpg', 'dog.jpg', 'sea.jpg']);
