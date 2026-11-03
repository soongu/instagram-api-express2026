-- p2-27 답안이 인용하는 SQL «전량 · 답안 순서 그대로» — 구분자 `-- @@`
--
-- 🚨 2026-09-11 재생성. 이 파일은 만들어져 있었지만 «게이트가 읽지도 않았고»(p2-27 테스트가
--    ANSWERS 를 채점 포인트 수 세는 데만 썼다) 그 사이에 답안 문서와 어긋나 있었다
--    (문서 20블록 ↔ 파일 19블록 · 11번부터 순서가 밀려 있었다). 문서에서 다시 뽑았다.
-- `-- @@setup` 은 답안 블록이 아니라 p2-26 과제 산출물을 재현하는 자리다.
-- @@instagram
-- @@setup
CREATE TABLE comments (
  id         SERIAL       PRIMARY KEY,
  post_id    INTEGER      NOT NULL,
  username   VARCHAR(50)  NOT NULL,
  content    TEXT         NOT NULL,
  like_count INTEGER      NOT NULL DEFAULT 0,
  created_at TIMESTAMP(3) NOT NULL DEFAULT now()
);
INSERT INTO comments (post_id, username, content, like_count) VALUES (1, 'minji', '저도 가봤어요', 7);
INSERT INTO comments (post_id, username, content) VALUES (1, 'seungwoo', '사진 잘 나왔네요');
INSERT INTO comments (post_id, username, content) VALUES (1, 'nayeon', '다음에 같이 가요');
-- p2-26 과제 요구사항 10 이 «반드시» 시키는 실패 INSERT(content 비움)가 번호 4를 써버린다 —
-- 그래서 과제를 끝까지 한 학생의 새 댓글은 5번부터다(2026-09-18 학생 낭독 두 번이 4번 기준 답안에서 멈췄다).
-- 실패하는 문장 대신 그 흔적(시퀀스 4)만 재현한다.
SELECT setval('comments_id_seq', 4);
-- @@
INSERT INTO comments (post_id, username, content, like_count) VALUES
  (2, 'jaehoon',  '크루아상 색이 좋네요',  0),
  (2, 'minji',    '레시피 공유해주세요',   5),
  (3, 'seungwoo', '다음엔 저도 낄게요',   12),
  (3, 'dahye',    '코트 어디예요?',       30);
-- @@
SELECT id, username, content FROM comments WHERE post_id = 1;
-- @@
SELECT id, username, like_count FROM comments WHERE like_count >= 10;
-- @@
SELECT id, post_id, username FROM comments WHERE post_id IN (1, 2);
-- @@
SELECT id, username, content FROM comments WHERE content LIKE '%다음%';
-- @@
SELECT id, username, like_count FROM comments ORDER BY like_count DESC LIMIT 3;
-- @@
UPDATE comments SET like_count = like_count + 1 WHERE id = 1 RETURNING id, username, like_count;
-- @@
SELECT id, username, like_count FROM comments WHERE like_count = 0;
-- @@
DELETE FROM comments WHERE like_count = 0;
-- @@
SELECT id, post_id, username, like_count FROM comments ORDER BY id;
-- @@
DELETE FROM comments WHERE like_count = 0 RETURNING id, username;

-- ── 과제 2 [응용] (서점) ───────────────────────────────
-- @@bookstore
-- @@
CREATE TABLE reviews (
  id         SERIAL       PRIMARY KEY,
  book_title VARCHAR(200) NOT NULL,
  reviewer   VARCHAR(100) NOT NULL,
  score      INTEGER      NOT NULL,
  comment    TEXT
);
-- @@
INSERT INTO reviews (book_title, reviewer, score, comment) VALUES
  ('클린 코드',        'jaehoon',  5, '두고두고 봐요'),
  ('클린 코드',        'minji',    2, '별로예요'),
  ('리팩터링',         'seungwoo', 4, '예제가 친절해요'),
  ('리팩터링',         'dahye',    3, NULL),
  ('테스트 주도 개발', 'nayeon',   5, '실습이 좋아요'),
  ('함께 자라기',      'jaehoon',  4, NULL);
-- @@
SELECT id, reviewer, comment FROM reviews WHERE comment <> '별로예요';
-- @@
SELECT id, reviewer, score FROM reviews WHERE comment IS NULL;
-- @@
SELECT id, reviewer, comment FROM reviews WHERE comment <> '별로예요' OR comment IS NULL;
-- @@
UPDATE reviews SET comment = '한 줄 평을 아직 안 남겼어요' WHERE comment IS NULL;
-- @@
SELECT id, reviewer, comment FROM reviews WHERE comment <> '별로예요';
-- @@
SELECT id, reviewer, comment FROM reviews WHERE comment <> '별로예요' ORDER BY id;
-- @@
SELECT id, reviewer FROM reviews WHERE COALESCE(comment, '') <> '별로예요';
