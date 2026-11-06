-- ~/instagram-api/lab/p3-33/practice2.sql
-- 1. 게시물 100개의 시각을 똑같이 맞춘다. 한꺼번에 들여온 게시물이 이렇게 된다.
UPDATE posts SET created_at = '2025-12-31 00:00:00' WHERE id BETWEEN 2001 AND 2100;

-- 2. 앞 페이지가 2050번에서 끝났다고 하자. 시각만 비교한 다음 페이지다.
SELECT id, created_at FROM posts
WHERE created_at < '2025-12-31 00:00:00'
ORDER BY created_at DESC, id DESC
LIMIT 3;

-- 3. 시각과 번호를 함께 비교한 다음 페이지다.
SELECT id, created_at FROM posts
WHERE (created_at, id) < ('2025-12-31 00:00:00', 2050)
ORDER BY created_at DESC, id DESC
LIMIT 3;

-- 4. 시각만 비교했을 때 건너뛴 행의 개수다.
SELECT count(*) FROM posts
WHERE created_at = '2025-12-31 00:00:00' AND id < 2050;

-- 5. 시각을 되돌린다.
UPDATE posts
SET created_at = TIMESTAMP '2026-01-01 00:00:00' - (id - 5) * INTERVAL '37 seconds'
WHERE id BETWEEN 2001 AND 2100;
