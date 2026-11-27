-- ~/instagram-api/lab/p3-57/sunset-posts.sql
-- minji 가 올린 #노을 게시물 24개를 넣는다. 지금 있는 게시물보다 모두 오래된 시각이라 피드에서는 맨 뒤에 나온다.
-- 번호가 4의 배수인 게시물에는 사진을 두 장 넣는다.
WITH new_posts AS (
  INSERT INTO posts (author_id, content, created_at, updated_at)
  SELECT (SELECT id FROM users WHERE username = 'minji'),
         '노을 사진 ' || n || '번째 #노을',
         TIMESTAMP '2026-01-01 09:00:00' - n * INTERVAL '1 hour',
         TIMESTAMP '2026-01-01 09:00:00' - n * INTERVAL '1 hour'
  FROM generate_series(1, 24) AS numbers(n)
  RETURNING id
),
first_images AS (
  INSERT INTO post_images (post_id, image_url, img_order)
  SELECT id, 'https://picsum.photos/seed/sunset' || id || '/600/600', 1 FROM new_posts
),
second_images AS (
  INSERT INTO post_images (post_id, image_url, img_order)
  SELECT id, 'https://picsum.photos/seed/sunset' || id || 'b/600/600', 2 FROM new_posts WHERE id % 4 = 0
)
INSERT INTO post_hashtags (post_id, hashtag_id)
SELECT id, (SELECT id FROM hashtags WHERE name = '노을') FROM new_posts;

-- 짝을 24개 더했으니 붙은 게시물 수도 24 올린다.
UPDATE hashtags SET post_count = post_count + 24 WHERE name = '노을';

-- 숫자가 맞는지 본다 - post_count 와 짝의 수가 같아야 한다.
SELECT h.name, h.post_count, count(ph.id) AS links
FROM hashtags h LEFT JOIN post_hashtags ph ON ph.hashtag_id = h.id
WHERE h.name = '노을'
GROUP BY h.id;
