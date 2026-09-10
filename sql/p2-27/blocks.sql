-- p2-27 「SQL 로 데이터 다루기」 — 교안이 인용하는 ```sql 블록 «전량 · 순서대로»
-- 🚨 교안의 ```sql 블록 목록과 이 파일이 «순서까지» 같아야 한다. 구분자는 `-- @@` 한 줄.
-- 🚨 `-- @@reset` 은 표를 p2-26 종료 상태(게시물 셋)로 되돌리는 지점이다 — 교안 블록이 아니다.
--    Step 1 의 두 시연은 «같은 상태에서» 재야 비교가 성립한다.
-- @@
DELETE FROM posts;
-- @@reset
-- @@
UPDATE posts SET like_count = 0;
-- @@reset
-- @@
INSERT INTO posts (username, profile_image, post_image, post_alt, content, minutes_ago, like_count, comment_count)
VALUES
  ('dahye',   '/images/dahye.jpg',   '/images/post-4.jpg', '아침 커피',    '커피 한 잔으로 시작하는 하루',   5,  43,  1),
  ('jaehoon', '/images/jaehoon.jpg', '/images/post-5.jpg', '퇴근길 지하철', NULL,                           90,  12,  0),
  ('minji',   '/images/minji.jpg',   '/images/post-6.jpg', '새 렌즈',      '오늘 도착한 렌즈',             300, 205, 11);
-- @@
SELECT id, username, like_count FROM posts WHERE like_count > 100;
-- @@
SELECT id, username, minutes_ago FROM posts WHERE username = 'jaehoon';
-- @@
SELECT id, username FROM posts WHERE username = 'Jaehoon';
-- @@
SELECT id, username, like_count FROM posts WHERE username <> 'jaehoon';
-- @@
SELECT id, username, minutes_ago FROM posts WHERE minutes_ago <= 45;
-- @@
SELECT id, username, like_count, minutes_ago FROM posts WHERE like_count > 100 AND minutes_ago < 60;
-- @@
SELECT id, username, like_count FROM posts WHERE username = 'minji' OR username = 'seungwoo';
-- @@
SELECT id, username, like_count FROM posts WHERE username = 'jaehoon' OR username = 'minji' AND like_count > 300;
-- @@
SELECT id, username, like_count FROM posts WHERE (username = 'jaehoon' OR username = 'minji') AND like_count > 300;
-- @@
SELECT id, username FROM posts WHERE username IN ('minji', 'dahye');
-- @@
SELECT id, username, like_count FROM posts WHERE like_count BETWEEN 43 AND 128;
-- @@
SELECT id, content FROM posts WHERE content LIKE '%한강%';
-- @@
SELECT id, username FROM posts WHERE username LIKE 'j%';
-- @@
SELECT id, username, content FROM posts ORDER BY id;
-- @@
SELECT id, username FROM posts WHERE content = NULL;
-- @@
SELECT id, username FROM posts WHERE content IS NULL;
-- @@
SELECT id, username, content FROM posts WHERE content <> '오늘 도착한 렌즈';
-- @@
SELECT id, username, minutes_ago FROM posts ORDER BY minutes_ago;
-- @@
SELECT id, username, like_count FROM posts ORDER BY like_count DESC;
-- @@
SELECT id, username, minutes_ago FROM posts ORDER BY username, minutes_ago;
-- @@
SELECT id, username, minutes_ago FROM posts ORDER BY minutes_ago LIMIT 5;
-- @@
SELECT id, username, minutes_ago FROM posts ORDER BY minutes_ago LIMIT 2 OFFSET 2;
-- @@
UPDATE posts SET like_count = like_count + 1 WHERE id = 1;
-- @@
SELECT id, username, like_count FROM posts WHERE id = 1;
-- @@
UPDATE posts SET content = '지하철 창밖이 예뻐서', post_alt = '퇴근길 지하철 창밖' WHERE id = 5;
-- @@
UPDATE posts SET like_count = like_count + 1 WHERE id = 1 RETURNING id, username, like_count;
-- @@
UPDATE posts SET like_count = 0 WHERE id = 999;
-- @@
SELECT id, username, like_count FROM posts WHERE like_count < 50;
-- @@
DELETE FROM posts WHERE like_count < 50;
-- @@
SELECT id, username, like_count FROM posts ORDER BY id;
-- @@
INSERT INTO posts (username, post_image, post_alt) VALUES ('dahye', '/images/post-7.jpg', '저녁 산책') RETURNING id;
