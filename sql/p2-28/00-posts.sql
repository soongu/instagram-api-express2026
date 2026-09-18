-- p2-28 착수 상태 (instagram) — 「p2-27 교안을 끝까지 따라간 학생의 posts」
--
-- 🚨 손으로 옮겨 적은 것이 아니라 p2-27 blocks.sql 을 재생해서 «뽑은» 것이다.
--    p2-27 이 바뀌면 이 파일이 낡는데, p2-28 게이트가 재생본과 이 파일을 대조해서 잡는다.
--    4·5번이 비어 있는 것은 p2-27 Step 8 이 지운 자리다 — 지운 번호는 안 돌아온다.
-- 🚨 7번의 created_at 은 «학생마다 다르다» — p2-27 Step 8 이 시각 없이 칸 셋만 넣어서
--    그 줄을 실행한 순간의 now() 가 들어간다. 여기에는 1~6번과 같은 「지금」(한국 18:00 =
--    UTC 09:00)을 적어두고, 게이트는 7번의 이 칸만 «비어 있지 않은가»로 대조한다.
DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS posts;
CREATE TABLE posts (
  id            SERIAL       PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL,
  profile_image TEXT,
  post_image    TEXT         NOT NULL,
  post_alt      TEXT,
  content       TEXT,
  like_count    INTEGER      NOT NULL DEFAULT 0,
  comment_count INTEGER      NOT NULL DEFAULT 0,
  created_at    TIMESTAMP(3) NOT NULL DEFAULT now()
);
INSERT INTO posts (id, username, profile_image, post_image, post_alt, content, like_count, comment_count, created_at)
VALUES
  (1, 'jaehoon', '/images/jaehoon.jpg', '/images/post-1.jpg', '노을 진 한강', '퇴근길에 한강이 너무 예뻤어요', 130, 4, '2026-09-28 08:48:00'),
  (2, 'minji', '/images/minji.jpg', '/images/post-2.jpg', '갓 구운 크루아상', '오늘의 베이킹 성공', 512, 23, '2026-09-28 08:15:00'),
  (3, 'seungwoo', '/images/seungwoo.jpg', '/images/post-3.jpg', '농구 코트', '주말 농구 한 판', 76, 8, '2026-09-28 06:00:00'),
  (6, 'minji', '/images/minji.jpg', '/images/post-6.jpg', '새 렌즈', '오늘 도착한 렌즈', 205, 11, '2026-09-28 04:00:00'),
  (7, 'dahye', NULL, '/images/post-7.jpg', '저녁 산책', NULL, 0, 0, '2026-09-28 09:00:00');
SELECT setval('posts_id_seq', 7);

-- ── 학생이 «들고 오는» comments 표 ─────────────────────
-- p2-26 과제로 짓고 p2-27 과제로 넷을 더 넣고 셋을 지운 상태다(그 회차 답안 기준).
-- p2-26 과제의 필수 실패 INSERT 가 4번을 써버려서 p2-27 이 넣은 넷은 5~8번이고,
-- 좋아요 0 인 줄(2·3·5번)을 지워 1·6·7·8번이 남는다. created_at 은 넣은 순간의 now() 다.
-- 🚨 이 표의 like_count 는 «학생마다 다르다» — p2-27 과제 5번이 「댓글 하나를 골라
--    좋아요를 1 올리세요」라 어느 줄이 올라갔는지가 사람마다 갈린다. 오늘은 그 칸으로
--    합·평균·최대를 내는 회차라, 교안 「시작하기 전에」가 이 표를 지우고 다시 세운다.
--    여기 있는 이유는 교안의 `DROP TABLE comments;` 가 지울 «대상»이기 때문이다.
CREATE TABLE comments (
  id         SERIAL       PRIMARY KEY,
  post_id    INTEGER      NOT NULL,
  username   VARCHAR(50)  NOT NULL,
  content    TEXT         NOT NULL,
  like_count INTEGER      NOT NULL DEFAULT 0,
  created_at TIMESTAMP(3) NOT NULL DEFAULT now()
);
INSERT INTO comments (id, post_id, username, content, like_count)
VALUES
  (1, 1, 'minji',    '저도 가봤어요',        8),
  (6, 2, 'minji',    '레시피 공유해주세요',  5),
  (7, 3, 'seungwoo', '다음엔 저도 낄게요',  12),
  (8, 3, 'dahye',    '코트 어디예요?',      30);
SELECT setval('comments_id_seq', 8);
