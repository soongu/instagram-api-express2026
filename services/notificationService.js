// ~/instagram-api/services/notificationService.js

// 알림 하나를 남긴다 - 좋아요·댓글·팔로우를 넣는 그 트랜잭션 안에서 부르는 함수라 넘겨받은 tx 로 쓴다.
// 내 게시물에 내가 누른 좋아요처럼 받는 사람이 곧 보낸 사람이면 남기지 않는다.
// 알림을 남긴 행(좋아요 · 댓글 · 팔로우 가운데 하나)의 번호도 함께 적는다 - 그 행이 지워지면 데이터베이스가 알림도 지운다.
export async function notify(tx, { type, receiverId, senderId, postId, postLikeId, commentId, followId }) {
  if (receiverId === senderId) return;

  await tx.notification.create({ data: { type, receiverId, senderId, postId, postLikeId, commentId, followId } });
}
