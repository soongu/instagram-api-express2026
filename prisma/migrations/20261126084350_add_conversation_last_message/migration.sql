-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "last_message_id" INTEGER;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_last_message_id_fkey" FOREIGN KEY ("last_message_id") REFERENCES "direct_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 이미 있는 대화방 - 메시지가 있는 방은 그 방의 가장 최근 메시지로 채운다.
-- 가장 최근 메시지는 목록과 이력이 쓰는 차례(시각이 늦은 것, 시각이 같으면 번호가 큰 것)의 맨 앞이다.
UPDATE "conversations" c
SET "last_message_id" = m."id", "last_message_at" = m."created_at"
FROM (
  SELECT DISTINCT ON ("conversation_id") "conversation_id", "id", "created_at"
  FROM "direct_messages"
  ORDER BY "conversation_id", "created_at" DESC, "id" DESC
) m
WHERE m."conversation_id" = c."id";

-- 메시지가 하나도 없는 방은 만든 시각으로 채운다.
UPDATE "conversations" SET "last_message_at" = "created_at" WHERE "last_message_id" IS NULL;
