-- CreateIndex
CREATE INDEX "follows_following_id_created_at_id_idx" ON "follows"("following_id", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "follows_follower_id_created_at_id_idx" ON "follows"("follower_id", "created_at" DESC, "id" DESC);
