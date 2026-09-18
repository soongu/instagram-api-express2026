-- p2-28 「관계와 JOIN」 교안이 인용하는 SQL «전량 · 교안 순서 그대로»
--
-- 구분자 `-- @@`.  `-- @@bookstore` / `-- @@instagram` 은 그 뒤 블록의 대상 DB.
-- `-- @@fails <SQLSTATE>` 는 «일부러 막히는» 블록이다 — 게이트가 그 코드로 막히는지 본다.
--   p2-27 은 「전부 성공」이었는데 이 회차는 막히는 것을 보여주는 회차라 축이 하나 더 필요했다.
-- @@instagram

-- ── 시작하기 전에 ──────────────────────────────────────
-- @@
SELECT id, username, post_alt, comment_count FROM posts ORDER BY id;
-- @@
DROP TABLE comments;
-- @@
CREATE TABLE comments (
  id         SERIAL       PRIMARY KEY,
  post_id    INTEGER      NOT NULL,
  username   VARCHAR(50)  NOT NULL,
  content    TEXT         NOT NULL,
  like_count INTEGER      NOT NULL DEFAULT 0,
  created_at TIMESTAMP(3) NOT NULL DEFAULT now()
);
-- @@
INSERT INTO comments (post_id, username, content, like_count, created_at)
VALUES
  (1, 'minji',    '저도 가봤어요',         7, '2026-09-28 08:50:00'),
  (1, 'seungwoo', '사진 잘 나왔네요',      2, '2026-09-28 08:52:00'),
  (1, 'nayeon',   '다음에 같이 가요',      0, '2026-09-28 08:55:00'),
  (2, 'jaehoon',  '크루아상 색이 좋네요', 12, '2026-09-28 08:20:00'),
  (2, 'minji',    '레시피 공유해주세요',   5, '2026-09-28 08:25:00'),
  (2, 'dahye',    '저도 구워볼래요',       3, '2026-09-28 08:30:00'),
  (2, 'nayeon',   '냄새가 여기까지',      21, '2026-09-28 08:48:00'),
  (3, 'seungwoo', '다음엔 저도 낄게요',   12, '2026-09-28 07:00:00'),
  (3, 'dahye',    '코트 어디예요?',       30, '2026-09-28 08:00:00');
-- @@
SELECT post_id, username, content, like_count, created_at FROM comments ORDER BY id;

-- ── Step 1: 두 표는 서로를 모른다 ──────────────────────
-- @@
SELECT post_id, username, content FROM comments WHERE post_id = 6;
-- @@
INSERT INTO comments (post_id, username, content)
VALUES (999, 'nobody', '있지도 않은 게시물에 다는 댓글');
-- @@
SELECT post_id, username, content FROM comments WHERE post_id = 999;

-- ── Step 2: Foreign Key ────────────────────────────────
-- @@fails 23503
ALTER TABLE comments
  ADD CONSTRAINT comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES posts (id);
-- @@
DELETE FROM comments WHERE post_id = 999;
-- @@
ALTER TABLE comments
  ADD CONSTRAINT comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES posts (id);
-- @@fails 23503
INSERT INTO comments (post_id, username, content)
VALUES (999, 'nobody', '이번엔 막힐 거예요');
-- @@fails 23503
DELETE FROM posts WHERE id = 1;
-- @@fails 2BP01
DROP TABLE posts;

-- ── 직접 해보기 1 (서점) ───────────────────────────────
-- @@bookstore
-- @@
SELECT id, book_title, reviewer, score FROM reviews ORDER BY id;
-- @@
SELECT id, title FROM books ORDER BY id;
-- @@
INSERT INTO reviews (book_title, reviewer, score) VALUES ('클린 코두', 'oops', 5);
-- @@
UPDATE books SET title = '클린 코드 2판' WHERE id = 1;
-- @@
SELECT id, book_title, reviewer FROM reviews WHERE book_title = '클린 코드';
-- @@
UPDATE books SET title = '클린 코드' WHERE id = 1;
-- @@
DELETE FROM reviews WHERE reviewer = 'oops';
-- @@
ALTER TABLE reviews ADD COLUMN book_id INTEGER;
-- @@
UPDATE reviews SET book_id = 1 WHERE book_title = '클린 코드';
UPDATE reviews SET book_id = 2 WHERE book_title = '리팩터링';
UPDATE reviews SET book_id = 4 WHERE book_title = '테스트 주도 개발';
UPDATE reviews SET book_id = 5 WHERE book_title = '함께 자라기';
-- @@
SELECT count(*) AS 빈칸 FROM reviews WHERE book_id IS NULL;
-- @@
ALTER TABLE reviews
  ADD CONSTRAINT reviews_book_id_fkey FOREIGN KEY (book_id) REFERENCES books (id);

-- ── Step 3: 두 표를 한 번에 ────────────────────────────
-- @@instagram
-- @@
SELECT count(*) AS 줄수 FROM posts, comments;
-- @@fails 42601
SELECT * FROM posts JOIN comments;
-- @@
SELECT * FROM posts JOIN comments ON comments.post_id = posts.id;
-- @@
SELECT posts.post_alt, comments.username, comments.content
FROM posts JOIN comments ON comments.post_id = posts.id
ORDER BY posts.id, comments.created_at DESC;
-- @@
SELECT p.post_alt, c.username, c.content
FROM posts p JOIN comments c ON c.post_id = p.id
WHERE p.id = 1
ORDER BY c.created_at DESC;

-- ── Step 4: 한쪽에만 있는 줄 ───────────────────────────
-- @@
SELECT p.id, p.post_alt, c.username, c.content
FROM posts p JOIN comments c ON c.post_id = p.id
ORDER BY p.id, c.created_at DESC;
-- @@
SELECT p.id, p.post_alt, c.username, c.content
FROM posts p LEFT JOIN comments c ON c.post_id = p.id
ORDER BY p.id, c.created_at DESC;

-- ── 직접 해보기 2 (서점) ───────────────────────────────
-- @@bookstore
-- @@
INSERT INTO books (title, author, price, stock) VALUES ('오브젝트', '조영호', 36000, 3);
-- @@
SELECT b.title, r.reviewer, r.score
FROM books b JOIN reviews r ON r.book_id = b.id
ORDER BY b.id, r.id;
-- @@
SELECT b.title, r.reviewer, r.score
FROM books b LEFT JOIN reviews r ON r.book_id = b.id
ORDER BY b.id, r.id;

-- ── Step 5: 세어달라기 ─────────────────────────────────
-- @@instagram
-- @@
SELECT count(*) AS 개수 FROM comments;
-- @@
SELECT count(*) AS 전체, count(content) AS 내용있는줄 FROM posts;
-- @@
SELECT count(*) AS 별표, count(c.id) AS 칸이름
FROM posts p LEFT JOIN comments c ON c.post_id = p.id;

-- ── Step 6: 묶어서 세기 ────────────────────────────────
-- @@
SELECT post_id, count(*) AS 개수 FROM comments GROUP BY post_id ORDER BY post_id;
-- @@fails 42803
SELECT post_id, username, count(*) FROM comments GROUP BY post_id;
-- @@
SELECT p.id, p.post_alt, count(*) AS 별표, count(c.id) AS 칸이름
FROM posts p LEFT JOIN comments c ON c.post_id = p.id
GROUP BY p.id, p.post_alt
ORDER BY p.id;
-- @@
SELECT p.id, p.post_alt, p.comment_count AS 적어둔, count(c.id) AS 세어본
FROM posts p LEFT JOIN comments c ON c.post_id = p.id
GROUP BY p.id, p.post_alt, p.comment_count
ORDER BY p.id;

-- ── Step 7: 묶은 결과에 조건 ───────────────────────────
-- @@fails 42803
SELECT post_id, count(*) FROM comments WHERE count(*) >= 3 GROUP BY post_id;
-- @@
SELECT post_id, count(*) AS 개수
FROM comments
GROUP BY post_id
HAVING count(*) >= 3
ORDER BY post_id;
-- @@
SELECT post_id, count(*) AS 개수
FROM comments
WHERE like_count > 0
GROUP BY post_id
ORDER BY post_id;
-- @@
SELECT post_id, count(*) AS 개수
FROM comments
WHERE like_count > 0
GROUP BY post_id
HAVING count(*) >= 3
ORDER BY post_id;
-- @@
SELECT post_id, count(*) AS 개수
FROM comments
GROUP BY post_id
ORDER BY count(*) DESC
LIMIT 1;

-- ── Step 8: 합·평균·최대·최소 ──────────────────────────
-- @@
SELECT count(*) AS 개수, sum(like_count) AS 합,
       avg(like_count) AS 평균, max(like_count) AS 최대, min(like_count) AS 최소
FROM comments;
-- @@
SELECT round(avg(like_count), 1) AS 평균 FROM comments;
-- @@
SELECT post_id, count(*) AS 개수, sum(like_count) AS 합,
       round(avg(like_count), 1) AS 평균, max(like_count) AS 최대
FROM comments
GROUP BY post_id
ORDER BY post_id;
-- @@
SELECT p.id, p.post_alt, count(c.id) AS 댓글수, round(avg(c.like_count), 1) AS 평균
FROM posts p LEFT JOIN comments c ON c.post_id = p.id
GROUP BY p.id, p.post_alt
ORDER BY p.id;

-- ── 직접 해보기 3 (서점) ───────────────────────────────
-- @@bookstore
-- @@
SELECT b.title, count(r.id) AS 리뷰수, round(avg(r.score), 1) AS 평균별점
FROM books b LEFT JOIN reviews r ON r.book_id = b.id
GROUP BY b.id, b.title
ORDER BY b.id;
-- @@
SELECT b.title, count(r.id) AS 리뷰수, round(avg(r.score), 1) AS 평균별점
FROM books b JOIN reviews r ON r.book_id = b.id
GROUP BY b.id, b.title
HAVING count(r.id) >= 2
ORDER BY b.id;
