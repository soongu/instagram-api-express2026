-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('LIKE', 'COMMENT', 'FOLLOW', 'MENTION');

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "type" "notification_type" NOT NULL,
    "receiver_id" INTEGER NOT NULL,
    "sender_id" INTEGER NOT NULL,
    "post_id" INTEGER,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_receiver_id_created_at_id_idx" ON "notifications"("receiver_id", "created_at" DESC, "id" DESC);

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
