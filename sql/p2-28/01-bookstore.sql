-- p2-28 착수 상태 (bookstore) — 「p2-27 실습과 과제를 끝낸 학생의 서점」
--
-- 🚨 손으로 옮긴 것이 아니라 p2-27 blocks.sql(실습)·answers.sql(과제)을 재생해서 «뽑은» 것이다.
--    books 의 3·6번과 reviews 의 번호가 그 회차가 지우고 넣은 자국이다.
-- 🚨 답안이 만드는 authors 까지 지운다. 안 지우면 게이트를 두 번 돌릴 때 저자가 5→10→15 로
--    쌓여서, 「책 0권짜리 저자」가 유령처럼 늘어난다(실측 — 두 번째 실행에서 18번 블록이 15줄).
DROP TABLE IF EXISTS authors CASCADE;
DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS stock_check;
DROP TABLE IF EXISTS books;
CREATE TABLE books (
  id     SERIAL       PRIMARY KEY,
  title  VARCHAR(200) NOT NULL,
  author VARCHAR(100) NOT NULL,
  price  INTEGER      NOT NULL,
  stock  INTEGER      NOT NULL DEFAULT 0
);
INSERT INTO books (id, title, author, price, stock)
VALUES
  (1, '클린 코드', '로버트 마틴', 33000, 5),
  (2, '리팩터링', '마틴 파울러', 55000, 2),
  (4, '테스트 주도 개발', '켄트 벡', 22000, 8),
  (5, '함께 자라기', '김창준', 9000, 12);
SELECT setval('books_id_seq', 6);
CREATE TABLE reviews (
  id         SERIAL       PRIMARY KEY,
  book_title VARCHAR(200) NOT NULL,
  reviewer   VARCHAR(100) NOT NULL,
  score      INTEGER      NOT NULL,
  comment    TEXT
);
INSERT INTO reviews (id, book_title, reviewer, score, comment)
VALUES
  (1, '클린 코드', 'jaehoon', 5, '두고두고 봐요'),
  (2, '클린 코드', 'minji', 2, '별로예요'),
  (3, '리팩터링', 'seungwoo', 4, '예제가 친절해요'),
  (4, '리팩터링', 'dahye', 3, '한 줄 평을 아직 안 남겼어요'),
  (5, '테스트 주도 개발', 'nayeon', 5, '실습이 좋아요'),
  (6, '함께 자라기', 'jaehoon', 4, '한 줄 평을 아직 안 남겼어요');
SELECT setval('reviews_id_seq', 6);
