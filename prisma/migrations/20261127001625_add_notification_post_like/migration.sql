-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "post_like_id" INTEGER;

-- 이미 남아 있는 좋아요 알림을 정리한다 - Prisma 가 만든 두 문장 사이에 손으로 넣었다.
-- 좋아요가 지금은 없는 알림은 지운다. 취소한 좋아요의 알림이라 «좋아합니다» 가 거짓이다.
DELETE FROM "notifications" AS n
WHERE n."type" = 'LIKE'
  AND NOT EXISTS (
    SELECT 1 FROM "post_likes" AS l
    WHERE l."post_id" = n."post_id" AND l."user_id" = n."sender_id"
  );

-- 좋아요가 아직 있는 알림에는 그 좋아요의 번호를 적는다.
UPDATE "notifications" AS n
SET "post_like_id" = l."id"
FROM "post_likes" AS l
WHERE n."type" = 'LIKE' AND l."post_id" = n."post_id" AND l."user_id" = n."sender_id";

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_post_like_id_fkey" FOREIGN KEY ("post_like_id") REFERENCES "post_likes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
