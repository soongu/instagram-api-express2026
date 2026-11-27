-- CreateTable
CREATE TABLE "uploads" (
    "id" SERIAL NOT NULL,
    "file_name" TEXT NOT NULL,
    "uploader_id" INTEGER NOT NULL,
    "post_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uploads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uploads_file_name_key" ON "uploads"("file_name");

-- CreateIndex
CREATE INDEX "uploads_post_id_idx" ON "uploads"("post_id");

-- AddForeignKey
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 이미 게시물에 쓰인 우리 서버의 사진(/uploads/…)도 기록한다.
-- 올린 사람은 그 게시물을 쓴 사람, 올린 시각은 그 게시물을 만든 시각으로 적는다.
-- 파일 이름은 주소를 / 로 나눈 마지막 조각이다 — /uploads/abc.jpg 의 abc.jpg
-- 같은 주소가 두 게시물에 들어 있으면 먼저 만든 게시물 하나에만 적는다 — 파일 이름은 한 번만 들어갈 수 있다.
INSERT INTO "uploads" ("file_name", "uploader_id", "post_id", "created_at")
SELECT DISTINCT ON ("file_name")
  split_part(pi."image_url", '/', -1) AS "file_name", p."author_id", p."id", p."created_at"
FROM "post_images" pi
JOIN "posts" p ON p."id" = pi."post_id"
WHERE pi."image_url" LIKE '/uploads/%'
ORDER BY "file_name", p."created_at", p."id";
