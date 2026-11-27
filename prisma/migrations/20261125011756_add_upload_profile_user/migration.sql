/*
  Warnings:

  - A unique constraint covering the columns `[profile_user_id]` on the table `uploads` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "uploads" ADD COLUMN     "profile_user_id" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "uploads_profile_user_id_key" ON "uploads"("profile_user_id");

-- AddForeignKey
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_profile_user_id_fkey" FOREIGN KEY ("profile_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
