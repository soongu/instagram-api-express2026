-- ~/instagram-api/lab/p3-33/practice1.sql
-- 1. 지금 인덱스로 프로필 목록을 측정한다.
EXPLAIN (ANALYZE, COSTS OFF, BUFFERS OFF)
SELECT * FROM posts
WHERE author_id = 5
ORDER BY created_at DESC, id DESC
LIMIT 20;

-- 2. 작성자를 앞에 둔 인덱스를 만든다.
CREATE INDEX lab_author_first ON posts (author_id, created_at DESC, id DESC);

-- 3. 같은 쿼리를 Buffers 를 켜고 두 번 실행한다. 둘째 실행의 계획을 본다.
EXPLAIN (ANALYZE, COSTS OFF)
SELECT * FROM posts
WHERE author_id = 5
ORDER BY created_at DESC, id DESC
LIMIT 20;

-- 4. 실습에서 만든 인덱스를 지운다.
DROP INDEX lab_author_first;
