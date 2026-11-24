-- ~/instagram-api/lab/p3-56/fix-hashtag-count.sql
-- 태그마다 적힌 게시물 수(post_count)를 실제 짝 수로 다시 맞춘다.
-- 지금 짝을 세어 그 값을 적으므로 몇 번 실행해도 결과가 같다.
UPDATE hashtags
SET post_count = (
  SELECT count(*)
  FROM post_hashtags
  WHERE post_hashtags.hashtag_id = hashtags.id
);

-- 태그마다 적힌 숫자와 실제 짝 수를 나란히 본다. 짝이 하나도 없는 태그도 나오게 LEFT JOIN 으로 잇는다.
SELECT hashtags.name, hashtags.post_count, count(post_hashtags.id) AS links
FROM hashtags
LEFT JOIN post_hashtags ON post_hashtags.hashtag_id = hashtags.id
GROUP BY hashtags.id
ORDER BY hashtags.id;
