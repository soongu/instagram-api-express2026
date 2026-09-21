-- p2-27 「SQL 로 데이터 다루기」 — 교안이 인용하는 ```sql 블록 «전량 · 순서대로»
--
-- 🚨 교안의 ```sql 블록 목록과 이 파일이 «순서까지» 같아야 한다. 구분자는 `-- @@` 한 줄.
-- 🚨 `-- @@reset` 은 posts 를 p2-26 종료 상태(게시물 셋)로 되돌리는 지점이다 — 교안 블록이 아니다.
--    Step 1 의 두 시연은 «같은 상태에서» 재야 비교가 성립한다.
-- 🚨 `-- @@bookstore` / `-- @@instagram` 은 그 뒤 블록이 «어느 데이터베이스» 것인지 말한다.
--    실습은 전부 서점(5433) 에서 한다 — 위험한 명령을 게시물 셋에 대고 시키지 않는다.
--    이 표시가 없으면 실습 블록이 게이트 밖으로 샌다(p2-26 이 `.sql` 을 무검사로 흘린 그 모양).

-- ── 오프닝 ──────────────────────────────────────────────
-- @@
DELETE FROM posts;
-- @@reset
-- @@
UPDATE posts SET like_count = 0;
-- @@reset

-- ── Step 1 직접 해보기 (서점) ────────────────────────────
-- @@bookstore
-- @@
CREATE TABLE stock_check (
  id    SERIAL       PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  stock INTEGER      NOT NULL
);
-- @@
INSERT INTO stock_check (title, stock) VALUES ('첫 번째 책', 3), ('두 번째 책', 7), ('세 번째 책', 0);
-- @@
UPDATE stock_check SET stock = 0;
-- @@
SELECT id, title, stock FROM stock_check ORDER BY id;
-- @@
DROP TABLE stock_check;

-- ── Step 2 ─────────────────────────────────────────────
-- @@instagram
-- @@
-- 🚨 created_at 은 p2-26 과 같은 「지금」(한국 2026-09-28 18:00) 기준 옛 5·90·300분 전을 «UTC» 로 적는다.
--    한 INSERT 의 DEFAULT now() 는 셋 다 같은 시각이라(p2-26 실측) 안 적으면 최신순이 동점이 된다.
INSERT INTO posts (username, profile_image, post_image, post_alt, content, like_count, comment_count, created_at)
VALUES
  ('dahye',   '/images/dahye.jpg',   '/images/post-4.jpg', '아침 커피',     '커피 한 잔으로 시작하는 하루',  43,  1, '2026-09-28 08:55:00'),
  ('jaehoon', '/images/jaehoon.jpg', '/images/post-5.jpg', '퇴근길 지하철', NULL,                            12,  0, '2026-09-28 07:30:00'),
  ('minji',   '/images/minji.jpg',   '/images/post-6.jpg', '새 렌즈',       '오늘 도착한 렌즈',             205, 11, '2026-09-28 04:00:00');
-- @@
SELECT id, username, like_count FROM posts WHERE like_count > 100;
-- @@
SELECT id, username, post_alt FROM posts WHERE username = 'jaehoon';
-- @@
SELECT id, username FROM posts WHERE username = 'Jaehoon';
-- @@
SELECT id, username, like_count FROM posts WHERE username <> 'jaehoon';
-- @@
SELECT id, username, comment_count FROM posts WHERE comment_count <= 8;

-- ── Step 3 ─────────────────────────────────────────────
-- @@
SELECT id, username, like_count, comment_count FROM posts WHERE like_count > 100 AND comment_count > 10;
-- @@
SELECT id, username, like_count FROM posts WHERE username = 'minji' OR username = 'seungwoo';
-- @@
SELECT id, username, like_count FROM posts WHERE username = 'jaehoon' OR username = 'minji' AND like_count > 300;
-- @@
SELECT id, username, like_count FROM posts WHERE (username = 'jaehoon' OR username = 'minji') AND like_count > 300;

-- ── Step 4 ─────────────────────────────────────────────
-- @@
SELECT id, username FROM posts WHERE username IN ('minji', 'dahye');
-- @@
SELECT id, username, like_count FROM posts WHERE like_count BETWEEN 43 AND 128;
-- @@
SELECT id, content FROM posts WHERE content LIKE '%한강%';
-- @@
SELECT id, username FROM posts WHERE username LIKE 'j%';

-- ── Step 4 직접 해보기 (서점) ────────────────────────────
-- @@bookstore
-- @@
DROP TABLE books;
-- @@
CREATE TABLE books (
  id     SERIAL       PRIMARY KEY,
  title  VARCHAR(200) NOT NULL,
  author VARCHAR(100) NOT NULL,
  price  INTEGER      NOT NULL,
  stock  INTEGER      NOT NULL DEFAULT 0
);
-- @@
INSERT INTO books (title, author, price, stock) VALUES
  ('클린 코드',        '로버트 마틴', 33000,  5),
  ('리팩터링',         '마틴 파울러', 55000,  2),
  ('클린 아키텍처',    '로버트 마틴', 32000,  0),
  ('테스트 주도 개발', '켄트 벡',     25000,  8),
  ('함께 자라기',      '김창준',      12000, 12),
  ('실용주의 프로그래머', '데이비드 토머스', 28000, 0);
-- @@
SELECT id, title, price FROM books WHERE price > 30000;
-- @@
SELECT id, title, stock FROM books WHERE stock = 0;
-- @@
SELECT id, title, author FROM books WHERE author IN ('로버트 마틴', '켄트 벡');
-- @@
SELECT id, title, price FROM books WHERE price BETWEEN 20000 AND 40000;
-- @@
SELECT id, title FROM books WHERE title LIKE '%클린%';

-- ── Step 5 ─────────────────────────────────────────────
-- @@instagram
-- @@
SELECT id, username, content FROM posts ORDER BY id;
-- @@
SELECT id, username FROM posts WHERE content = NULL;
-- @@
SELECT id, username FROM posts WHERE content IS NULL;
-- @@
SELECT id, username, content FROM posts WHERE content <> '오늘 도착한 렌즈';

-- ── Step 6 ─────────────────────────────────────────────
-- @@
SELECT id, username, created_at FROM posts ORDER BY created_at;
-- @@
SELECT id, username, created_at FROM posts ORDER BY created_at DESC;
-- @@
SELECT id, username, created_at FROM posts ORDER BY username, created_at;
-- @@
SELECT id, username, created_at FROM posts ORDER BY created_at DESC LIMIT 5;
-- @@
SELECT id, username, created_at FROM posts ORDER BY created_at DESC LIMIT 2 OFFSET 2;

-- ── Step 7 ─────────────────────────────────────────────
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

-- ── Step 8 ─────────────────────────────────────────────
-- @@
SELECT id, username, like_count FROM posts WHERE like_count < 50;
-- @@
DELETE FROM posts WHERE like_count < 50;
-- @@
SELECT id, username, like_count FROM posts ORDER BY id;
-- @@
INSERT INTO posts (username, post_image, post_alt) VALUES ('dahye', '/images/post-7.jpg', '저녁 산책') RETURNING id;

-- ── Step 8 직접 해보기 (서점) ────────────────────────────
-- @@bookstore
-- @@
SELECT id, title, stock FROM books WHERE stock = 0;
-- @@
UPDATE books SET price = price - 3000 WHERE stock > 5;
-- @@
DELETE FROM books WHERE stock = 0;
-- @@
SELECT id, title, price, stock FROM books ORDER BY price DESC;
