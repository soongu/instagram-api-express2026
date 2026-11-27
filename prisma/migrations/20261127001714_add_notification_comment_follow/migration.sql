-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "comment_id" INTEGER,
ADD COLUMN     "follow_id" INTEGER;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_follow_id_fkey" FOREIGN KEY ("follow_id") REFERENCES "follows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
