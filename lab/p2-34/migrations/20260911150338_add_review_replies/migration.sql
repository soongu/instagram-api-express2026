-- AlterTable
ALTER TABLE "reviews" ADD COLUMN     "parent_id" INTEGER;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
