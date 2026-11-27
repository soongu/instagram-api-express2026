-- 알림을 남긴 행(좋아요 · 댓글 · 팔로우)은 셋 가운데 정확히 하나만 적게 한다.
-- 하나도 없으면 그 알림은 무엇이 지워질 때 함께 사라질지 모르고, 둘이면 어느 쪽이 남긴 것인지 모른다.
-- Prisma 스키마에는 이 규칙을 적을 자리가 없어서 SQL 로 직접 적는다.
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_one_cause"
  CHECK (num_nonnulls("post_like_id", "comment_id", "follow_id") = 1);
