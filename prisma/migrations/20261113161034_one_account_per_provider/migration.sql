/*
  Warnings:

  - A unique constraint covering the columns `[user_id,provider]` on the table `social_accounts` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "social_accounts_user_id_provider_key" ON "social_accounts"("user_id", "provider");
