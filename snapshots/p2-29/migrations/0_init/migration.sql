-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "posts" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "profile_image" TEXT,
    "post_image" TEXT NOT NULL,
    "post_alt" TEXT,
    "content" TEXT,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "comment_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" SERIAL NOT NULL,
    "post_id" INTEGER NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "content" TEXT NOT NULL,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

