-- 글쓴이를 글자에서 번호로 옮긴다.
--
-- Prisma가 써준 판은 칸을 지우고 새로 더하기만 해서, 이미 들어 있는 게시물 5줄과
-- 댓글 9줄이 통째로 사라진다. 그래서 순서를 바꾸고 데이터를 옮기는 줄을 더했다.

-- ① 사람을 담을 표를 먼저 만든다. Prisma가 아래쪽에 써둔 것을 위로 올렸다.
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "profile_image" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- ② 지금 데이터에 있는 사람을 모아 넣는다.
--    게시물은 안 쓰고 댓글만 쓴 사람도 있어서 두 표를 합쳐서 본다.
INSERT INTO "users" ("username")
SELECT "username" FROM "posts"
UNION
SELECT "username" FROM "comments"
ORDER BY "username";

-- ③ 프로필 사진은 게시물에 적혀 있던 것을 옮긴다.
UPDATE "users" u
SET "profile_image" = p."profile_image"
FROM "posts" p
WHERE p."username" = u."username" AND p."profile_image" IS NOT NULL;

-- ④ posts — 널을 허용해 칸을 먼저 더하고, 채우고, 그제야 조인다.
ALTER TABLE "posts" ADD COLUMN "author_id" INTEGER;

UPDATE "posts" p
SET "author_id" = u."id"
FROM "users" u
WHERE u."username" = p."username";

ALTER TABLE "posts" ALTER COLUMN "author_id" SET NOT NULL;

ALTER TABLE "posts" DROP COLUMN "username",
DROP COLUMN "profile_image";

-- ⑤ comments — 같은 세 박자.
ALTER TABLE "comments" ADD COLUMN "author_id" INTEGER;

UPDATE "comments" c
SET "author_id" = u."id"
FROM "users" u
WHERE u."username" = c."username";

ALTER TABLE "comments" ALTER COLUMN "author_id" SET NOT NULL;

ALTER TABLE "comments" DROP COLUMN "username";

-- ⑥ 외래 키를 건다. Prisma가 써준 두 줄 그대로다.
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
