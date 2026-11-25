-- 자기 자신을 팔로우하는 행은 넣지 못하게 한다.
-- Prisma 스키마에는 이 규칙을 적을 자리가 없어서 SQL 로 직접 적는다.
ALTER TABLE "follows" ADD CONSTRAINT "follows_not_self" CHECK ("follower_id" <> "following_id");
