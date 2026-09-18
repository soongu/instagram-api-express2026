-- 이미 들어 있는 사진 주소를 새 표로 옮긴다.
-- 게시물마다 한 장뿐이었으니 차례는 전부 1이다.
INSERT INTO "post_images" ("post_id", "image_url", "img_order")
SELECT "id", "post_image", 1 FROM "posts";

-- 옮기고 «난 뒤에» 옛 칸을 지운다.
ALTER TABLE "posts" DROP COLUMN "post_image";
