-- ~/instagram-api/lab/p3-57/many-tags.sql
-- 실습 데이터베이스(instagram_lab)의 게시물 10만 개에 해시태그를 붙인다.
-- 번호가 짝수인 게시물 5만 개에는 #여행, 오래된 게시물 셋에만 #노을.
INSERT INTO hashtags (name, post_count) VALUES ('여행', 0), ('노을', 0);

INSERT INTO post_hashtags (post_id, hashtag_id)
SELECT id, (SELECT id FROM hashtags WHERE name = '여행') FROM posts WHERE id > 5 AND id % 2 = 0;

INSERT INTO post_hashtags (post_id, hashtag_id)
SELECT id, (SELECT id FROM hashtags WHERE name = '노을') FROM posts WHERE id IN (30001, 60001, 90001);

UPDATE hashtags SET post_count = (SELECT count(*) FROM post_hashtags WHERE hashtag_id = hashtags.id);

-- 행이 크게 늘었으니 통계를 새로 모은다.
ANALYZE post_hashtags;

SELECT id, name, post_count FROM hashtags ORDER BY id;
