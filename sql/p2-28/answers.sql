-- p2-28 답안이 인용하는 SQL «전량 · 답안 순서 그대로»
--
-- 🚨 출발 상태는 「교안을 끝까지 따라간 학생」이다 — 게이트가 blocks.sql 을 먼저 돌린 뒤
--    이 파일을 돌린다(PRELUDE). 그래서 comments 에는 외래 키가 걸려 있고 books 에는
--    오브젝트(7번)가 들어 있으며 reviews 에는 book_id 가 채워져 있다.
-- @@instagram

-- ── 과제 1 [기초] ──────────────────────────────────────
-- @@
SELECT p.post_alt, c.username, c.content, c.like_count
FROM posts p JOIN comments c ON c.post_id = p.id
ORDER BY c.like_count DESC, c.created_at DESC
LIMIT 3;
-- @@
SELECT p.id, p.post_alt, count(c.id) AS 댓글수, sum(c.like_count) AS 좋아요합
FROM posts p LEFT JOIN comments c ON c.post_id = p.id
GROUP BY p.id, p.post_alt
ORDER BY p.id;
-- @@
SELECT p.id, p.post_alt, count(c.id) AS 댓글수, sum(c.like_count) AS 좋아요합
FROM posts p LEFT JOIN comments c ON c.post_id = p.id
GROUP BY p.id, p.post_alt
ORDER BY count(c.id) DESC, p.id;
-- @@
SELECT username, count(*) AS 댓글수
FROM comments
GROUP BY username
ORDER BY count(*) DESC, username;
-- @@
SELECT username, count(*) AS 댓글수
FROM comments
GROUP BY username
HAVING count(*) >= 2
ORDER BY username;
-- @@
SELECT round(avg(like_count), 1) AS 평균 FROM comments WHERE post_id = 1;
-- @@fails 23503
INSERT INTO comments (post_id, username, content) VALUES (999, 'nobody', '없는 게시물');

-- ── 과제 2 [응용] ──────────────────────────────────────
-- @@bookstore
-- @@
INSERT INTO books (title, author, price, stock) VALUES ('클린 아키텍처', '로버트 마틴', 32000, 4);
-- @@
SELECT id, title, author FROM books ORDER BY id;
-- @@
CREATE TABLE authors (
  id   SERIAL       PRIMARY KEY,
  name VARCHAR(100) NOT NULL
);
-- @@
INSERT INTO authors (name)
VALUES ('로버트 마틴'), ('마틴 파울러'), ('켄트 벡'), ('김창준'), ('조영호');
-- @@
SELECT id, name FROM authors ORDER BY id;
-- @@
ALTER TABLE books ADD COLUMN author_id INTEGER;
-- @@
UPDATE books SET author_id = 1 WHERE author = '로버트 마틴';
UPDATE books SET author_id = 2 WHERE author = '마틴 파울러';
UPDATE books SET author_id = 3 WHERE author = '켄트 벡';
UPDATE books SET author_id = 4 WHERE author = '김창준';
UPDATE books SET author_id = 5 WHERE author = '조영호';
-- @@
SELECT count(*) AS 빈칸 FROM books WHERE author_id IS NULL;
-- @@
ALTER TABLE books
  ADD CONSTRAINT books_author_id_fkey FOREIGN KEY (author_id) REFERENCES authors (id);
-- @@
SELECT a.name, b.title, b.price
FROM authors a JOIN books b ON b.author_id = a.id
ORDER BY a.id, b.id;
-- @@
SELECT a.name, count(b.id) AS 책수, round(avg(b.price), 1) AS 평균가격
FROM authors a LEFT JOIN books b ON b.author_id = a.id
GROUP BY a.id, a.name
ORDER BY a.id;
-- @@
SELECT a.name, count(b.id) AS 책수, round(avg(b.price), 1) AS 평균가격
FROM authors a JOIN books b ON b.author_id = a.id
GROUP BY a.id, a.name
HAVING count(b.id) >= 2
ORDER BY a.id;
