-- ~/instagram-api/lab/p3-33/many-posts.sql
-- 게시물 10만 개를 한 번에 넣는다. n 이 커질수록 37초씩 오래된 게시물이 된다.
INSERT INTO posts (author_id, content, created_at, updated_at)
SELECT CASE WHEN n % 1000 = 0 THEN 5 ELSE n % 4 + 1 END,
       '게시물 ' || n,
       TIMESTAMP '2026-01-01 00:00:00' - n * INTERVAL '37 seconds',
       TIMESTAMP '2026-01-01 00:00:00' - n * INTERVAL '37 seconds'
FROM generate_series(1, 100000) AS numbers(n);

-- 화면에서 카드로 볼 때 쓸 사진을 게시물마다 한 장씩 넣는다.
INSERT INTO post_images (post_id, image_url, img_order)
SELECT id, 'https://picsum.photos/seed/post' || id || '/600/600', 1
FROM posts
WHERE id > 5;

-- 데이터베이스는 테이블의 통계를 보고 실행 계획을 고른다. 행이 크게 늘었으니 통계를 새로 모은다.
ANALYZE posts;
