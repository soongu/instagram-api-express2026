-- p2-29 과제 답안이 «학생이 직접 치는» SQL. 마이그레이션이 뽑아준 것은
-- snapshots/p2-29/answers-*.sql 에 따로 있다.
-- @@instagram
UPDATE "comments" SET "updated_at" = "created_at";
-- @@bookstore
INSERT INTO publishers (name, founded_year) VALUES ('인사이트', 2006), ('한빛미디어', 1993);
UPDATE books SET publisher_id = 1 WHERE title IN ('클린 코드', '클린 아키텍처', '함께 자라기', '테스트 주도 개발');
UPDATE books SET publisher_id = 2 WHERE title = '리팩터링';
-- @@
SELECT b.title, b.price, p.name AS publisher
FROM books b LEFT JOIN publishers p ON p.id = b.publisher_id
ORDER BY b.id;
